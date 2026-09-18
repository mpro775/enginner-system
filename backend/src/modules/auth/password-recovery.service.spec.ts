import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { AuditAction } from '../../common/enums';
import { PasswordRecoveryErrorCode } from './password-recovery.errors';
import { PasswordRecoveryService } from './password-recovery.service';

describe('PasswordRecoveryService', () => {
  const user = {
    _id: { toString: () => 'user-1' },
    name: 'User',
    email: 'user@example.com',
    password: 'current-hash',
    isActive: true,
    deletedAt: null,
    authVersion: 2,
  };

  function setup() {
    const userModel = {
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };
    const redisService = { execute: jest.fn() };
    const mailService = { sendPasswordResetOtp: jest.fn() };
    const passwordSecurityService = {
      assertDifferent: jest.fn().mockResolvedValue(undefined),
      hash: jest.fn().mockResolvedValue('next-hash'),
    };
    const auditLogsService = { create: jest.fn().mockResolvedValue(undefined) };
    const configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        const values: Record<string, string> = {
          PASSWORD_RESET_OTP_SECRET:
            '0123456789abcdef0123456789abcdef-recovery',
          PASSWORD_RESET_OTP_TTL_SECONDS: '600',
          PASSWORD_RESET_MAX_ATTEMPTS: '5',
          PASSWORD_RESET_RESEND_COOLDOWN_SECONDS: '60',
          PASSWORD_RESET_MAX_SENDS_PER_HOUR: '5',
          PASSWORD_RESET_TOKEN_TTL_SECONDS: '600',
        };
        return values[key] ?? fallback;
      }),
    };
    const service = new PasswordRecoveryService(
      userModel as any,
      configService as any,
      redisService as any,
      mailService as any,
      passwordSecurityService as any,
      auditLogsService as any,
    );
    return {
      service,
      userModel,
      redisService,
      mailService,
      passwordSecurityService,
      auditLogsService,
    };
  }

  function exceptionCode(error: unknown): string | undefined {
    if (!(error instanceof HttpException)) return undefined;
    const response = error.getResponse();
    return typeof response === 'object'
      ? (response as { code?: string }).code
      : undefined;
  }

  it('atomically establishes one canonical challenge for concurrent forgot requests', async () => {
    const { service, userModel, redisService, mailService } = setup();
    userModel.findOne.mockResolvedValue(user);
    mailService.sendPasswordResetOtp.mockResolvedValue(undefined);
    let currentChallengeId: string | null = null;
    const evalMock = jest.fn(
      async (
        script: string,
        keyCount: number,
        _cooldownKey: string,
        _hourlyKey: string,
        _currentKey: string,
        _challengeKey: string,
        cooldown: string,
        _maxSends: string,
        candidateId: string,
      ) => {
        expect(keyCount).toBe(4);
        expect(script).toContain("redis.call('SET', KEYS[1]");
        expect(script).toContain("redis.call('SET', KEYS[3]");
        if (currentChallengeId) return [0, 41, currentChallengeId];
        currentChallengeId = candidateId;
        return [1, Number(cooldown), candidateId];
      },
    );
    redisService.execute.mockImplementation(
      async (operation: (client: { eval: typeof evalMock }) => Promise<unknown>) =>
        operation({ eval: evalMock }),
    );

    const [first, second] = await Promise.all([
      service.request('user@example.com'),
      service.request('user@example.com'),
    ]);

    expect(first.challengeId).toBe(second.challengeId);
    expect(mailService.sendPasswordResetOtp).toHaveBeenCalledTimes(1);
  });

  it('stores only an OTP digest for a real challenge', async () => {
    const { service, userModel, mailService } = setup();
    userModel.findOne.mockResolvedValue(user);
    mailService.sendPasswordResetOtp.mockResolvedValue(undefined);
    const initialize = jest
      .spyOn(service as any, 'initializeRequest')
      .mockImplementation(
        async (
          _identity: string,
          challengeId: string,
          record: Record<string, unknown>,
        ) => ({ allowed: true, challengeId, record }),
      );

    const response = await service.request(' User@Example.com ');
    const mailedOtp = mailService.sendPasswordResetOtp.mock.calls[0][0].otp;
    const record = initialize.mock.calls[0][2] as Record<string, unknown>;

    expect(response.challengeId).toMatch(/^[a-f0-9]{64}$/);
    expect(record.type).toBe('real');
    expect(record.otpDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(record.otpDigest).not.toBe(mailedOtp);
    expect(record).not.toHaveProperty('email');
  });

  it('keeps synthetic decoys synthetic and never sends email', async () => {
    const { service, userModel, mailService } = setup();
    userModel.findOne.mockResolvedValue(null);
    jest
      .spyOn(service as any, 'initializeRequest')
      .mockImplementation(async (_identity: string, challengeId: string) => ({
        allowed: true,
        challengeId,
      }));

    const result = await service.request('missing@example.com');

    expect(result.challengeId).toMatch(/^[a-f0-9]{64}$/);
    expect(mailService.sendPasswordResetOtp).not.toHaveBeenCalled();
  });

  it('marks a current SMTP failure as recoverable and invalidates its OTP', async () => {
    const { service, redisService, mailService } = setup();
    mailService.sendPasswordResetOtp.mockRejectedValue(new Error('SMTP down'));
    let storedFailure: Record<string, unknown> | undefined;
    const evalMock = jest.fn(
      async (
        script: string,
        _keys: number,
        _challengeKey: string,
        _currentKey: string,
        _challengeId: string,
        failedJson: string,
      ) => {
        expect(script).toContain("'KEEPTTL'");
        storedFailure = JSON.parse(failedJson) as Record<string, unknown>;
        return 1;
      },
    );
    redisService.execute.mockImplementation(
      async (operation: (client: { eval: typeof evalMock }) => Promise<unknown>) =>
        operation({ eval: evalMock }),
    );

    await (service as any).dispatchEmail({
      challengeId: 'a'.repeat(64),
      identityDigest: 'identity',
      email: user.email,
      otp: '123456',
      deliveryFailedRecord: {
        userId: 'user-1',
        identityDigest: 'identity',
        otpDigest: null,
        attempts: 0,
        authVersion: 2,
        type: 'delivery_failed',
      },
    });

    expect(storedFailure).toEqual(
      expect.objectContaining({
        type: 'delivery_failed',
        otpDigest: null,
        userId: 'user-1',
        authVersion: 2,
      }),
    );
  });

  it('rotates a delivery-failed challenge back to real on resend', async () => {
    const { service, userModel, mailService } = setup();
    jest.spyOn(service as any, 'readChallenge').mockResolvedValue({
      userId: 'user-1',
      identityDigest: 'identity',
      otpDigest: null,
      attempts: 0,
      authVersion: 2,
      type: 'delivery_failed',
    });
    jest.spyOn(service as any, 'reserveSend').mockResolvedValue({ allowed: true });
    const store = jest
      .spyOn(service as any, 'storeChallenge')
      .mockResolvedValue(undefined);
    userModel.findOne.mockResolvedValue(user);
    mailService.sendPasswordResetOtp.mockResolvedValue(undefined);

    await service.resend('a'.repeat(64));

    expect(store).toHaveBeenCalledWith(
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.objectContaining({ type: 'real', userId: 'user-1' }),
    );
    expect(mailService.sendPasswordResetOtp).toHaveBeenCalledTimes(1);
  });

  it('does not let a stale SMTP failure overwrite a newer challenge', async () => {
    const { service, redisService } = setup();
    redisService.execute.mockResolvedValue(0);
    const converted = await (service as any).markDeliveryFailedIfCurrent(
      'old-id',
      'identity',
      { type: 'delivery_failed' },
    );
    expect(converted).toBe(false);
  });

  it('returns stable codes for invalid challenges and max attempts', async () => {
    const { service, redisService } = setup();
    jest.spyOn(service as any, 'readChallenge').mockResolvedValueOnce(null);
    await service.verify('a'.repeat(64), '123456').catch((error) => {
      expect(exceptionCode(error)).toBe(
        PasswordRecoveryErrorCode.CHALLENGE_INVALID,
      );
    });

    jest.spyOn(service as any, 'readChallenge').mockResolvedValueOnce({
      userId: 'user-1',
      identityDigest: 'identity',
      otpDigest: 'digest',
      attempts: 4,
      authVersion: 2,
      type: 'real',
    });
    redisService.execute.mockResolvedValue([-1]);
    await service.verify('a'.repeat(64), '123456').catch((error) => {
      expect(exceptionCode(error)).toBe(
        PasswordRecoveryErrorCode.ATTEMPTS_EXCEEDED,
      );
    });
  });

  it('uses Mongo authVersion CAS before best-effort Redis cleanup', async () => {
    const {
      service,
      userModel,
      redisService,
      auditLogsService,
    } = setup();
    const raw = JSON.stringify({
      userId: 'user-1',
      identityDigest: 'identity',
      authVersion: 2,
    });
    redisService.execute
      .mockResolvedValueOnce(raw)
      .mockRejectedValueOnce(new ServiceUnavailableException())
      .mockRejectedValueOnce(new ServiceUnavailableException());
    userModel.findOne.mockResolvedValue(user);
    userModel.findOneAndUpdate.mockResolvedValue({ ...user, authVersion: 3 });
    auditLogsService.create.mockRejectedValue(new Error('audit down'));

    await expect(
      service.reset('f'.repeat(64), 'new-password', '127.0.0.1', 'agent'),
    ).resolves.toBeUndefined();

    expect(userModel.findOneAndUpdate.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        _id: 'user-1',
        isActive: true,
        deletedAt: null,
      }),
    );
    expect(userModel.findOneAndUpdate.mock.calls[0][1]).toEqual({
      $set: { password: 'next-hash', refreshToken: null },
      $inc: { authVersion: 1 },
    });
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.PASSWORD_RESET,
        changes: { passwordChanged: true },
        ipAddress: '127.0.0.1',
        userAgent: 'agent',
      }),
    );
  });

  it('allows exactly one winner for concurrent reset attempts', async () => {
    const { service, userModel, redisService } = setup();
    const raw = JSON.stringify({
      userId: 'user-1',
      identityDigest: 'identity',
      authVersion: 2,
    });
    redisService.execute.mockResolvedValue(raw);
    userModel.findOne.mockResolvedValue(user);
    userModel.findOneAndUpdate
      .mockResolvedValueOnce({ ...user, authVersion: 3 })
      .mockResolvedValueOnce(null);
    jest
      .spyOn(service as any, 'cleanupAfterSuccessfulReset')
      .mockResolvedValue(undefined);
    jest
      .spyOn(service as any, 'auditSuccessfulReset')
      .mockResolvedValue(undefined);

    await expect(
      service.reset('f'.repeat(64), 'new-password'),
    ).resolves.toBeUndefined();
    await service.reset('f'.repeat(64), 'new-password').catch((error) => {
      expect(exceptionCode(error)).toBe(PasswordRecoveryErrorCode.TOKEN_INVALID);
    });
    expect(userModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  it('fails closed when Redis is unavailable', async () => {
    const { service, userModel, redisService } = setup();
    userModel.findOne.mockResolvedValue(user);
    redisService.execute.mockRejectedValue(new ServiceUnavailableException());

    await expect(service.request('user@example.com')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
