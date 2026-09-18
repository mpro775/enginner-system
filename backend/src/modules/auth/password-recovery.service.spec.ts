import {
  BadRequestException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PasswordRecoveryService } from './password-recovery.service';
import { AuditAction } from '../../common/enums';

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
          PASSWORD_RESET_OTP_SECRET: 'a-long-test-only-secret',
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

  it('stores only an OTP digest and returns an opaque challenge', async () => {
    const { service, userModel, mailService } = setup();
    userModel.findOne.mockResolvedValue(user);
    jest.spyOn(service as any, 'reserveSend').mockResolvedValue({ allowed: true });
    const store = jest
      .spyOn(service as any, 'storeChallenge')
      .mockResolvedValue(undefined);
    mailService.sendPasswordResetOtp.mockResolvedValue(undefined);

    const response = await service.request(' User@Example.com ');
    const mailedOtp = mailService.sendPasswordResetOtp.mock.calls[0][0].otp;
    const storedRecord = store.mock.calls[0][1] as {
      otpDigest: string;
      email?: string;
    };

    expect(response.challengeId).toMatch(/^[a-f0-9]{64}$/);
    expect(response.resendAfterSeconds).toBe(60);
    expect(mailedOtp).toMatch(/^\d{6}$/);
    expect(storedRecord.otpDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(storedRecord.otpDigest).not.toBe(mailedOtp);
    expect(storedRecord).not.toHaveProperty('email');
  });

  it('uses the same response for an unknown account and does not send mail', async () => {
    const { service, userModel, mailService } = setup();
    userModel.findOne.mockResolvedValue(null);
    jest.spyOn(service as any, 'reserveSend').mockResolvedValue({ allowed: true });

    const response = await service.request('missing@example.com');

    expect(response.challengeId).toMatch(/^[a-f0-9]{64}$/);
    expect(response.resendAfterSeconds).toBe(60);
    expect(mailService.sendPasswordResetOtp).not.toHaveBeenCalled();
    expect(userModel.findOne).toHaveBeenCalledWith({
      email: 'missing@example.com',
      isActive: true,
      deletedAt: null,
    });
  });

  it('returns the current challenge when forgot is repeated during cooldown', async () => {
    const { service, userModel, mailService } = setup();
    userModel.findOne.mockResolvedValue(user);
    jest
      .spyOn(service as any, 'reserveSend')
      .mockResolvedValueOnce({ allowed: true })
      .mockResolvedValueOnce({
        allowed: false,
        reason: 'cooldown',
        retryAfterSeconds: 41,
      });
    let currentChallengeId: string | null = null;
    jest
      .spyOn(service as any, 'storeChallenge')
      .mockImplementation(async (challengeId: string) => {
        currentChallengeId = challengeId;
      });
    jest
      .spyOn(service as any, 'readCurrentChallengeId')
      .mockImplementation(async () => currentChallengeId);
    mailService.sendPasswordResetOtp.mockResolvedValue(undefined);

    const first = await service.request('user@example.com');
    const repeated = await service.request('user@example.com');

    expect(repeated).toEqual({
      challengeId: first.challengeId,
      resendAfterSeconds: 41,
    });
    expect(mailService.sendPasswordResetOtp).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['active', { ...user, isActive: true, deletedAt: null }],
    ['inactive', { ...user, isActive: false, deletedAt: null }],
    ['deleted', { ...user, isActive: true, deletedAt: new Date() }],
    ['unknown', null],
  ])(
    'keeps forgot to resend responses indistinguishable for %s accounts',
    async (_label, candidate) => {
      const { service, userModel, mailService } = setup();
      userModel.findOne.mockImplementation(async (query: Record<string, any>) => {
        if (!candidate) return null;
        if (candidate.isActive !== true || candidate.deletedAt != null) return null;
        if (query.email && query.email !== candidate.email) return null;
        if (query._id && query._id !== candidate._id.toString()) return null;
        return candidate;
      });
      jest
        .spyOn(service as any, 'reserveSend')
        .mockResolvedValue({ allowed: true });
      const records = new Map<string, any>();
      let currentChallengeId: string | null = null;
      jest
        .spyOn(service as any, 'storeChallenge')
        .mockImplementation(async (challengeId: string, record: any) => {
          if (currentChallengeId) records.delete(currentChallengeId);
          records.set(challengeId, record);
          currentChallengeId = challengeId;
        });
      jest
        .spyOn(service as any, 'readChallenge')
        .mockImplementation(async (challengeId: string) =>
          records.get(challengeId) ?? null,
        );
      mailService.sendPasswordResetOtp.mockResolvedValue(undefined);

      const forgot = await service.request('user@example.com');
      const resent = await service.resend(forgot.challengeId);

      expect(forgot).toEqual({
        challengeId: expect.stringMatching(/^[a-f0-9]{64}$/),
        resendAfterSeconds: 60,
      });
      expect(resent).toEqual({
        challengeId: expect.stringMatching(/^[a-f0-9]{64}$/),
        resendAfterSeconds: 60,
      });
      expect(resent.challengeId).not.toBe(forgot.challengeId);
      expect(records.has(forgot.challengeId)).toBe(false);
      expect(records.has(resent.challengeId)).toBe(true);
    },
  );

  it('fails closed when Redis is unavailable', async () => {
    const { service, redisService } = setup();
    redisService.execute.mockRejectedValue(
      new ServiceUnavailableException('temporarily unavailable'),
    );

    await expect(service.request('user@example.com')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('enforces resend cooldown and hourly limits returned by Redis', async () => {
    const { service, redisService } = setup();
    redisService.execute
      .mockResolvedValueOnce([0, 42])
      .mockResolvedValueOnce([-1, 1800]);

    await expect((service as any).reserveSend('identity')).resolves.toEqual({
      allowed: false,
      reason: 'cooldown',
      retryAfterSeconds: 42,
    });
    await expect((service as any).reserveSend('identity')).resolves.toEqual({
      allowed: false,
      reason: 'hourly',
      retryAfterSeconds: 1800,
    });
  });

  it('issues a one-time reset token after a correct OTP', async () => {
    const { service, redisService } = setup();
    jest.spyOn(service as any, 'readChallenge').mockResolvedValue({
      userId: 'user-1',
      identityDigest: 'identity',
      otpDigest: 'digest',
      attempts: 0,
      authVersion: 2,
      isDecoy: false,
    });
    redisService.execute.mockResolvedValue([1]);

    await expect(service.verify('a'.repeat(64), '123456')).resolves.toEqual({
      resetToken: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it('rejects an expired challenge', async () => {
    const { service, redisService } = setup();
    jest.spyOn(service as any, 'readChallenge').mockResolvedValue(null);

    await expect(service.verify('a'.repeat(64), '123456')).rejects.toThrow(
      BadRequestException,
    );
    expect(redisService.execute).not.toHaveBeenCalled();
  });

  it('increments invalid verification attempts without issuing a reset token', async () => {
    const { service, redisService } = setup();
    jest.spyOn(service as any, 'readChallenge').mockResolvedValue({
      userId: 'user-1',
      identityDigest: 'identity',
      otpDigest: 'digest',
      attempts: 0,
      authVersion: 2,
      isDecoy: false,
    });
    redisService.execute.mockResolvedValue([-2, 1]);

    await expect(service.verify('a'.repeat(64), '123456')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('returns 429 after the maximum OTP attempts', async () => {
    const { service, redisService } = setup();
    jest.spyOn(service as any, 'readChallenge').mockResolvedValue({
      userId: 'user-1',
      identityDigest: 'identity',
      otpDigest: 'digest',
      attempts: 4,
      authVersion: 2,
      isDecoy: false,
    });
    redisService.execute.mockResolvedValue([-1]);

    try {
      await service.verify('a'.repeat(64), '123456');
      throw new Error('Expected verification to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
    }
  });

  it('consumes the reset token, increments authVersion, and never audits secrets', async () => {
    const {
      service,
      userModel,
      redisService,
      auditLogsService,
    } = setup();
    redisService.execute
      .mockResolvedValueOnce(
        JSON.stringify({
          userId: 'user-1',
          identityDigest: 'identity',
          authVersion: 2,
        }),
      )
      .mockResolvedValueOnce(1);
    userModel.findOne.mockResolvedValue(user);
    userModel.findOneAndUpdate.mockResolvedValue({ ...user, authVersion: 3 });

    await service.reset('f'.repeat(64), 'new-password', '127.0.0.1');

    expect(userModel.findOneAndUpdate.mock.calls[0][1]).toEqual({
      $set: { password: 'next-hash', refreshToken: null },
      $inc: { authVersion: 1 },
    });
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.PASSWORD_RESET,
        changes: { passwordChanged: true },
      }),
    );
    const auditPayload = JSON.stringify(auditLogsService.create.mock.calls[0][0]);
    expect(auditPayload).not.toContain('new-password');
    expect(auditPayload).not.toContain('f'.repeat(64));
  });

  it('rejects a replayed reset token', async () => {
    const { service, redisService } = setup();
    redisService.execute.mockResolvedValue(null);

    await expect(service.reset('f'.repeat(64), 'new-password')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('does not consume the reset token when the new password matches the current password', async () => {
    const { service, userModel, redisService, passwordSecurityService } = setup();
    redisService.execute.mockResolvedValueOnce(
      JSON.stringify({
        userId: 'user-1',
        identityDigest: 'identity',
        authVersion: 2,
      }),
    );
    userModel.findOne.mockResolvedValue(user);
    passwordSecurityService.assertDifferent.mockRejectedValue(
      new BadRequestException('same password'),
    );

    await expect(service.reset('f'.repeat(64), 'same-password')).rejects.toThrow(
      BadRequestException,
    );
    expect(redisService.execute).toHaveBeenCalledTimes(1);
    expect(userModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects a reset token after authVersion has changed', async () => {
    const { service, userModel, redisService } = setup();
    redisService.execute.mockResolvedValueOnce(
      JSON.stringify({
        userId: 'user-1',
        identityDigest: 'identity',
        authVersion: 2,
      }),
    );
    userModel.findOne.mockResolvedValue({ ...user, authVersion: 3 });

    await expect(service.reset('f'.repeat(64), 'new-password')).rejects.toThrow(
      BadRequestException,
    );
    expect(userModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects reset when the account is inactive or deleted', async () => {
    const { service, userModel, redisService } = setup();
    redisService.execute.mockResolvedValueOnce(
      JSON.stringify({
        userId: 'user-1',
        identityDigest: 'identity',
        authVersion: 2,
      }),
    );
    userModel.findOne.mockResolvedValue(null);

    await expect(service.reset('f'.repeat(64), 'new-password')).rejects.toThrow(
      BadRequestException,
    );
    expect(userModel.findOne).toHaveBeenCalledWith({
      _id: 'user-1',
      isActive: true,
      deletedAt: null,
    });
  });
});
