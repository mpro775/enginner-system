import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHmac, randomBytes, randomInt } from 'crypto';
import { Model } from 'mongoose';
import { validatePasswordRecoveryOtpSecret } from '../../config/environment.validation';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { passwordResetKeys } from '../../infrastructure/redis/redis.constants';
import { MailService } from '../mail/mail.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction } from '../../common/enums';
import { PasswordSecurityService } from './password-security.service';
import {
  PasswordRecoveryErrorCode,
  passwordRecoveryException,
} from './password-recovery.errors';

type ChallengeType = 'real' | 'synthetic_decoy' | 'delivery_failed';

interface ChallengeRecord {
  userId: string;
  identityDigest: string;
  otpDigest: string | null;
  attempts: number;
  authVersion: number;
  type: ChallengeType;
}

interface ResetTokenRecord {
  userId: string;
  identityDigest: string;
  authVersion: number;
}

interface SendReservation {
  allowed: boolean;
  reason?: 'cooldown' | 'hourly';
  retryAfterSeconds?: number;
}

const GENERIC_REQUEST_MESSAGE =
  'إذا كان البريد الإلكتروني مرتبطاً بحساب فعال، سيتم إرسال رمز التحقق إليه.';
const INVALID_OTP_MESSAGE = 'رمز التحقق غير صحيح أو انتهت صلاحيته.';
const INVALID_TOKEN_MESSAGE =
  'رابط إعادة التعيين غير صالح أو انتهت صلاحيته.';
const CHALLENGE_KEY_PREFIX = 'maintenance:auth:password-reset:challenge:';

@Injectable()
export class PasswordRecoveryService {
  private readonly logger = new Logger(PasswordRecoveryService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly mailService: MailService,
    private readonly passwordSecurityService: PasswordSecurityService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async request(
    email: string,
  ): Promise<{ challengeId: string; resendAfterSeconds: number }> {
    const normalizedEmail = email.trim().toLowerCase();
    const identityDigest = this.digest(`email:${normalizedEmail}`);
    const challengeId = randomBytes(32).toString('hex');
    const user = await this.userModel.findOne({
      email: normalizedEmail,
      isActive: true,
      deletedAt: null,
    });

    const otp = user ? this.generateOtp() : null;
    const record = user
      ? this.createRealChallenge(
          user._id.toString(),
          identityDigest,
          challengeId,
          otp!,
          user.authVersion ?? 0,
        )
      : this.createDecoyChallenge(identityDigest, challengeId);
    const undeliveredRecord = user
      ? this.createDeliveryFailedChallenge(record)
      : record;

    const initialization = await this.initializeRequest(
      identityDigest,
      challengeId,
      record,
      undeliveredRecord,
    );

    if (initialization.allowed && user && otp) {
      void this.dispatchEmail({
        challengeId,
        identityDigest,
        email: user.email,
        name: user.name,
        otp,
        deliveryFailedRecord: undeliveredRecord,
      });
    }

    return {
      challengeId: initialization.challengeId,
      resendAfterSeconds:
        initialization.retryAfterSeconds ?? this.resendCooldown,
    };
  }

  async resend(
    challengeId: string,
  ): Promise<{ challengeId: string; resendAfterSeconds: number }> {
    const record = await this.readChallenge(challengeId);
    if (!record) throw this.challengeInvalid();

    const reservation = await this.reserveSend(record.identityDigest);
    if (!reservation.allowed) {
      throw passwordRecoveryException(
        PasswordRecoveryErrorCode.RATE_LIMITED,
        reservation.reason === 'cooldown'
          ? 'يرجى الانتظار قبل طلب رمز جديد.'
          : 'تم تجاوز الحد المسموح لإرسال الرموز. يرجى المحاولة لاحقاً.',
        HttpStatus.TOO_MANY_REQUESTS,
        reservation.retryAfterSeconds,
      );
    }

    const nextChallengeId = randomBytes(32).toString('hex');
    // Keep the lookup shape the same for real and synthetic records.
    const user = await this.userModel.findOne({
      _id: record.userId,
      isActive: true,
      deletedAt: null,
    });
    const shouldRemainDecoy =
      record.type === 'synthetic_decoy' ||
      !user ||
      (user.authVersion ?? 0) !== record.authVersion;

    if (shouldRemainDecoy) {
      await this.storeChallenge(
        nextChallengeId,
        this.createDecoyChallenge(record.identityDigest, nextChallengeId),
      );
      return {
        challengeId: nextChallengeId,
        resendAfterSeconds: this.resendCooldown,
      };
    }

    const otp = this.generateOtp();
    const nextRecord = this.createRealChallenge(
      user._id.toString(),
      record.identityDigest,
      nextChallengeId,
      otp,
      user.authVersion ?? 0,
    );
    await this.storeChallenge(nextChallengeId, nextRecord);
    void this.dispatchEmail({
      challengeId: nextChallengeId,
      identityDigest: record.identityDigest,
      email: user.email,
      name: user.name,
      otp,
      deliveryFailedRecord: this.createDeliveryFailedChallenge(nextRecord),
    });

    return {
      challengeId: nextChallengeId,
      resendAfterSeconds: this.resendCooldown,
    };
  }

  async verify(
    challengeId: string,
    otp: string,
  ): Promise<{ resetToken: string }> {
    const resetToken = randomBytes(32).toString('hex');
    const tokenDigest = this.digest(`token:${resetToken}`);
    const tokenKey = passwordResetKeys.resetToken(tokenDigest);
    const otpDigest = this.digest(`otp:${challengeId}:${otp}`);
    const preliminaryRecord = await this.readChallenge(challengeId);
    if (!preliminaryRecord) throw this.challengeInvalid();

    const resetRecord: ResetTokenRecord = {
      userId: preliminaryRecord.userId,
      identityDigest: preliminaryRecord.identityDigest,
      authVersion: preliminaryRecord.authVersion,
    };
    const script = `
      local raw = redis.call('GET', KEYS[1])
      if not raw then return {0} end
      if redis.call('GET', KEYS[2]) ~= ARGV[1] then
        redis.call('DEL', KEYS[1])
        return {0}
      end
      local record = cjson.decode(raw)
      local attempts = tonumber(record.attempts or 0)
      local maxAttempts = tonumber(ARGV[3])
      if attempts >= maxAttempts then
        redis.call('DEL', KEYS[1], KEYS[2])
        return {-1}
      end
      if record.type ~= 'real' or record.otpDigest ~= ARGV[2] then
        attempts = attempts + 1
        record.attempts = attempts
        if attempts >= maxAttempts then
          redis.call('DEL', KEYS[1], KEYS[2])
          return {-1}
        end
        local ttl = redis.call('PTTL', KEYS[1])
        if ttl > 0 then
          redis.call('SET', KEYS[1], cjson.encode(record), 'PX', ttl)
        end
        return {-2, attempts}
      end
      redis.call('DEL', KEYS[1], KEYS[2])
      redis.call('SET', KEYS[3], ARGV[4], 'EX', ARGV[5], 'NX')
      return {1}
    `;

    const result = (await this.redisService.execute((client) =>
      client.eval(
        script,
        3,
        passwordResetKeys.challenge(challengeId),
        passwordResetKeys.currentChallenge(
          preliminaryRecord.identityDigest,
        ),
        tokenKey,
        challengeId,
        otpDigest,
        String(this.maxAttempts),
        JSON.stringify(resetRecord),
        String(this.tokenTtl),
      ),
    )) as Array<number | string>;

    const code = Number(result[0]);
    if (code === -1) {
      throw passwordRecoveryException(
        PasswordRecoveryErrorCode.ATTEMPTS_EXCEEDED,
        'تم تجاوز عدد محاولات التحقق المسموح بها. ابدأ الاستعادة من جديد.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (code !== 1) throw this.challengeInvalid();

    return { resetToken };
  }

  async reset(
    resetToken: string,
    newPassword: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const tokenDigest = this.digest(`token:${resetToken}`);
    const tokenKey = passwordResetKeys.resetToken(tokenDigest);
    const raw = await this.redisService.execute((client) => client.get(tokenKey));
    if (typeof raw !== 'string') throw this.tokenInvalid();

    let tokenRecord: ResetTokenRecord;
    try {
      tokenRecord = JSON.parse(raw) as ResetTokenRecord;
    } catch {
      throw this.tokenInvalid();
    }

    const user = await this.userModel.findOne({
      _id: tokenRecord.userId,
      isActive: true,
      deletedAt: null,
    });
    if (!user || (user.authVersion ?? 0) !== tokenRecord.authVersion) {
      throw this.tokenInvalid();
    }

    await this.passwordSecurityService.assertDifferent(
      newPassword,
      user.password,
    );
    const password = await this.passwordSecurityService.hash(newPassword);

    // MongoDB authVersion CAS is authoritative: one concurrent reset wins.
    const updated = await this.userModel.findOneAndUpdate(
      {
        _id: tokenRecord.userId,
        isActive: true,
        deletedAt: null,
        $or: [
          { authVersion: tokenRecord.authVersion },
          ...(tokenRecord.authVersion === 0
            ? [{ authVersion: { $exists: false } }]
            : []),
        ],
      },
      {
        $set: { password, refreshToken: null },
        $inc: { authVersion: 1 },
      },
      { new: true },
    );
    if (!updated) throw this.tokenInvalid();

    await this.cleanupAfterSuccessfulReset(
      tokenKey,
      raw,
      tokenRecord.identityDigest,
    );
    await this.auditSuccessfulReset(updated, ipAddress, userAgent);
  }

  get requestMessage(): string {
    return GENERIC_REQUEST_MESSAGE;
  }

  private async initializeRequest(
    identityDigest: string,
    challengeId: string,
    deliverableRecord: ChallengeRecord,
    undeliveredRecord: ChallengeRecord,
  ): Promise<{
    allowed: boolean;
    challengeId: string;
    retryAfterSeconds?: number;
  }> {
    const script = `
      local cooldownTtl = redis.call('TTL', KEYS[1])
      if cooldownTtl > 0 then
        local currentId = redis.call('GET', KEYS[3])
        if currentId and redis.call('GET', ARGV[7] .. currentId) then
          return {0, cooldownTtl, currentId}
        end
        redis.call('DEL', KEYS[3])
      end
      local count = tonumber(redis.call('GET', KEYS[2]) or '0')
      if count >= tonumber(ARGV[2]) then
        local retryAfter = math.max(redis.call('TTL', KEYS[2]), 1)
        local currentId = redis.call('GET', KEYS[3])
        if currentId and redis.call('GET', ARGV[7] .. currentId) then
          return {-1, retryAfter, currentId}
        end
        local fallbackTtl = math.max(tonumber(ARGV[6]), retryAfter)
        redis.call('SET', KEYS[4], ARGV[5], 'EX', fallbackTtl)
        redis.call('SET', KEYS[3], ARGV[3], 'EX', fallbackTtl)
        return {-1, retryAfter, ARGV[3]}
      end
      if count == 0 then
        redis.call('SET', KEYS[2], 1, 'EX', 3600)
      else
        redis.call('INCR', KEYS[2])
      end
      redis.call('SET', KEYS[1], 1, 'EX', ARGV[1])
      local oldId = redis.call('GET', KEYS[3])
      if oldId then redis.call('DEL', ARGV[7] .. oldId) end
      redis.call('SET', KEYS[4], ARGV[4], 'EX', ARGV[6])
      redis.call('SET', KEYS[3], ARGV[3], 'EX', ARGV[6])
      return {1, tonumber(ARGV[1]), ARGV[3]}
    `;
    const result = (await this.redisService.execute((client) =>
      client.eval(
        script,
        4,
        passwordResetKeys.cooldown(identityDigest),
        passwordResetKeys.hourly(identityDigest),
        passwordResetKeys.currentChallenge(identityDigest),
        passwordResetKeys.challenge(challengeId),
        String(this.resendCooldown),
        String(this.maxSendsPerHour),
        challengeId,
        JSON.stringify(deliverableRecord),
        JSON.stringify(undeliveredRecord),
        String(this.otpTtl),
        CHALLENGE_KEY_PREFIX,
      ),
    )) as Array<number | string>;

    return {
      allowed: Number(result[0]) === 1,
      retryAfterSeconds: Number(result[1]) || undefined,
      challengeId: String(result[2] || challengeId),
    };
  }

  private async reserveSend(identityDigest: string): Promise<SendReservation> {
    const script = `
      local cooldownTtl = redis.call('TTL', KEYS[1])
      if cooldownTtl > 0 then return {0, cooldownTtl} end
      local count = tonumber(redis.call('GET', KEYS[2]) or '0')
      if count >= tonumber(ARGV[2]) then
        return {-1, math.max(redis.call('TTL', KEYS[2]), 1)}
      end
      if count == 0 then redis.call('SET', KEYS[2], 1, 'EX', 3600)
      else redis.call('INCR', KEYS[2]) end
      redis.call('SET', KEYS[1], 1, 'EX', ARGV[1])
      return {1, tonumber(ARGV[1])}
    `;
    const result = (await this.redisService.execute((client) =>
      client.eval(
        script,
        2,
        passwordResetKeys.cooldown(identityDigest),
        passwordResetKeys.hourly(identityDigest),
        String(this.resendCooldown),
        String(this.maxSendsPerHour),
      ),
    )) as Array<number | string>;
    const code = Number(result[0]);
    return code === 1
      ? { allowed: true }
      : {
          allowed: false,
          reason: code === 0 ? 'cooldown' : 'hourly',
          retryAfterSeconds: Number(result[1]) || undefined,
        };
  }

  private async dispatchEmail(input: {
    challengeId: string;
    identityDigest: string;
    email: string;
    name?: string;
    otp: string;
    deliveryFailedRecord: ChallengeRecord;
  }): Promise<void> {
    try {
      await this.mailService.sendPasswordResetOtp({
        to: input.email,
        name: input.name,
        otp: input.otp,
        expiresInMinutes: Math.max(1, Math.ceil(this.otpTtl / 60)),
      });
      this.logger.log('Password reset email dispatched.');
    } catch {
      await this.markDeliveryFailedIfCurrent(
        input.challengeId,
        input.identityDigest,
        input.deliveryFailedRecord,
      ).catch(() => undefined);
      this.logger.warn('Password reset email could not be dispatched.');
    }
  }

  private async markDeliveryFailedIfCurrent(
    challengeId: string,
    identityDigest: string,
    failedRecord: ChallengeRecord,
  ): Promise<boolean> {
    const script = `
      if redis.call('GET', KEYS[2]) ~= ARGV[1] then return 0 end
      local ttl = redis.call('PTTL', KEYS[1])
      if ttl <= 0 then return 0 end
      redis.call('SET', KEYS[1], ARGV[2], 'KEEPTTL')
      return 1
    `;
    const result = await this.redisService.execute((client) =>
      client.eval(
        script,
        2,
        passwordResetKeys.challenge(challengeId),
        passwordResetKeys.currentChallenge(identityDigest),
        challengeId,
        JSON.stringify(failedRecord),
      ),
    );
    return Number(result) === 1;
  }

  private async storeChallenge(
    challengeId: string,
    record: ChallengeRecord,
  ): Promise<void> {
    const script = `
      local oldId = redis.call('GET', KEYS[2])
      if oldId then redis.call('DEL', ARGV[4] .. oldId) end
      redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
      redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[3])
      return 1
    `;
    await this.redisService.execute((client) =>
      client.eval(
        script,
        2,
        passwordResetKeys.challenge(challengeId),
        passwordResetKeys.currentChallenge(record.identityDigest),
        challengeId,
        JSON.stringify(record),
        String(this.otpTtl),
        CHALLENGE_KEY_PREFIX,
      ),
    );
  }

  private async readChallenge(
    challengeId: string,
  ): Promise<ChallengeRecord | null> {
    const raw = await this.redisService.execute((client) =>
      client.get(passwordResetKeys.challenge(challengeId)),
    );
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ChallengeRecord;
    } catch {
      return null;
    }
  }

  private createRealChallenge(
    userId: string,
    identityDigest: string,
    challengeId: string,
    otp: string,
    authVersion: number,
  ): ChallengeRecord {
    return {
      userId,
      identityDigest,
      otpDigest: this.digest(`otp:${challengeId}:${otp}`),
      attempts: 0,
      authVersion,
      type: 'real',
    };
  }

  private createDeliveryFailedChallenge(
    record: ChallengeRecord,
  ): ChallengeRecord {
    return {
      ...record,
      otpDigest: null,
      attempts: 0,
      type: 'delivery_failed',
    };
  }

  private createDecoyChallenge(
    identityDigest: string,
    challengeId: string,
  ): ChallengeRecord {
    const undisclosedOtp = this.generateOtp();
    return {
      userId: randomBytes(12).toString('hex'),
      identityDigest,
      otpDigest: this.digest(`otp:${challengeId}:${undisclosedOtp}`),
      attempts: 0,
      authVersion: 0,
      type: 'synthetic_decoy',
    };
  }

  private async cleanupAfterSuccessfulReset(
    tokenKey: string,
    expectedTokenRecord: string,
    identityDigest: string,
  ): Promise<void> {
    const results = await Promise.allSettled([
      this.redisService.execute((client) =>
        client.eval(
          "if redis.call('GET',KEYS[1]) == ARGV[1] then redis.call('DEL',KEYS[1]); return 1 end; return 0",
          1,
          tokenKey,
          expectedTokenRecord,
        ),
      ),
      this.invalidateCurrentChallenge(identityDigest),
    ]);
    if (results.some((result) => result.status === 'rejected')) {
      this.logger.warn(
        'Password reset succeeded, but recovery-state cleanup was incomplete.',
      );
    }
  }

  private async auditSuccessfulReset(
    user: UserDocument,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      await this.auditLogsService.create({
        userId: user._id.toString(),
        userName: user.name,
        action: AuditAction.PASSWORD_RESET,
        entity: 'User',
        entityId: user._id.toString(),
        changes: { passwordChanged: true },
        ipAddress,
        userAgent,
      });
    } catch {
      this.logger.warn(
        'Password reset succeeded, but its security audit event could not be recorded.',
      );
    }
  }

  private async invalidateCurrentChallenge(
    identityDigest: string,
  ): Promise<void> {
    await this.redisService.execute((client) =>
      client.eval(
        "local id=redis.call('GET',KEYS[1]); if id then redis.call('DEL',ARGV[1]..id) end; redis.call('DEL',KEYS[1]); return 1",
        1,
        passwordResetKeys.currentChallenge(identityDigest),
        CHALLENGE_KEY_PREFIX,
      ),
    );
  }

  private challengeInvalid(): Error {
    return passwordRecoveryException(
      PasswordRecoveryErrorCode.CHALLENGE_INVALID,
      INVALID_OTP_MESSAGE,
      HttpStatus.BAD_REQUEST,
    );
  }

  private tokenInvalid(): Error {
    return passwordRecoveryException(
      PasswordRecoveryErrorCode.TOKEN_INVALID,
      INVALID_TOKEN_MESSAGE,
      HttpStatus.BAD_REQUEST,
    );
  }

  private generateOtp(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private digest(value: string): string {
    const secret = validatePasswordRecoveryOtpSecret(
      this.configService.get<string>('PASSWORD_RESET_OTP_SECRET'),
    );
    return createHmac('sha256', secret).update(value).digest('hex');
  }

  private configInt(name: string, fallback: number): number {
    const parsed = Number(
      this.configService.get<string | number>(name, fallback),
    );
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
  }

  private get otpTtl(): number {
    return this.configInt('PASSWORD_RESET_OTP_TTL_SECONDS', 600);
  }

  private get maxAttempts(): number {
    return this.configInt('PASSWORD_RESET_MAX_ATTEMPTS', 5);
  }

  private get resendCooldown(): number {
    return this.configInt('PASSWORD_RESET_RESEND_COOLDOWN_SECONDS', 60);
  }

  private get maxSendsPerHour(): number {
    return this.configInt('PASSWORD_RESET_MAX_SENDS_PER_HOUR', 5);
  }

  private get tokenTtl(): number {
    return this.configInt('PASSWORD_RESET_TOKEN_TTL_SECONDS', 600);
  }
}
