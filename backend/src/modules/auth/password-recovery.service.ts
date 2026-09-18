import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHmac, randomBytes, randomInt } from 'crypto';
import { Model } from 'mongoose';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { passwordResetKeys } from '../../infrastructure/redis/redis.constants';
import { MailService } from '../mail/mail.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction } from '../../common/enums';
import { PasswordSecurityService } from './password-security.service';

interface ChallengeRecord {
  userId: string;
  identityDigest: string;
  otpDigest: string;
  attempts: number;
  authVersion: number;
  isDecoy: boolean;
}

interface ResetTokenRecord {
  userId: string;
  identityDigest: string;
  authVersion: number;
}

const GENERIC_REQUEST_MESSAGE =
  'إذا كان البريد الإلكتروني مرتبطاً بحساب فعال، سيتم إرسال رمز التحقق إليه.';
const INVALID_OTP_MESSAGE = 'رمز التحقق غير صحيح أو انتهت صلاحيته.';

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
    const challengeId = randomBytes(32).toString('hex');
    const identityDigest = this.digest(`email:${normalizedEmail}`);

    const reservation = await this.reserveSend(identityDigest);
    if (!reservation.allowed) {
      const currentChallengeId =
        await this.readCurrentChallengeId(identityDigest);
      if (currentChallengeId) {
        return {
          challengeId: currentChallengeId,
          resendAfterSeconds:
            reservation.retryAfterSeconds ?? this.resendCooldown,
        };
      }

      await this.storeChallenge(
        challengeId,
        this.createDecoyChallenge(identityDigest, challengeId),
      );
      return {
        challengeId,
        resendAfterSeconds:
          reservation.retryAfterSeconds ?? this.resendCooldown,
      };
    }

    const user = await this.userModel.findOne({
      email: normalizedEmail,
      isActive: true,
      deletedAt: null,
    });

    if (!user) {
      await this.storeChallenge(
        challengeId,
        this.createDecoyChallenge(identityDigest, challengeId),
      );
      return { challengeId, resendAfterSeconds: this.resendCooldown };
    }

    const otp = this.generateOtp();
    const record: ChallengeRecord = {
      userId: user._id.toString(),
      identityDigest,
      otpDigest: this.digest(`otp:${challengeId}:${otp}`),
      attempts: 0,
      authVersion: user.authVersion ?? 0,
      isDecoy: false,
    };

    await this.storeChallenge(challengeId, record);

    // Dispatch outside the public response path so account existence cannot be
    // inferred from SMTP latency. Failures invalidate the undelivered challenge.
    void this.dispatchInitialEmail({
      challengeId,
      identityDigest,
      email: user.email,
      name: user.name,
      otp,
    });

    return { challengeId, resendAfterSeconds: this.resendCooldown };
  }

  async resend(
    challengeId: string,
  ): Promise<{ challengeId: string; resendAfterSeconds: number }> {
    const record = await this.readChallenge(challengeId);
    if (!record) throw new BadRequestException(INVALID_OTP_MESSAGE);

    const reservation = await this.reserveSend(record.identityDigest);
    if (!reservation.allowed) {
      throw new HttpException({
        message:
          reservation.reason === 'cooldown'
            ? 'يرجى الانتظار قبل طلب رمز جديد.'
            : 'تم تجاوز الحد المسموح لإرسال الرموز. يرجى المحاولة لاحقاً.',
        retryAfterSeconds: reservation.retryAfterSeconds,
      }, HttpStatus.TOO_MANY_REQUESTS);
    }

    const nextChallengeId = randomBytes(32).toString('hex');
    const user = await this.userModel.findOne({
      _id: record.userId,
      isActive: true,
      deletedAt: null,
    });
    const shouldRemainDecoy =
      record.isDecoy ||
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
    const nextRecord: ChallengeRecord = {
      ...record,
      otpDigest: this.digest(`otp:${nextChallengeId}:${otp}`),
      attempts: 0,
    };

    await this.storeChallenge(nextChallengeId, nextRecord);
    void this.dispatchInitialEmail({
      challengeId: nextChallengeId,
      identityDigest: record.identityDigest,
      email: user.email,
      name: user.name,
      otp,
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
      if record.isDecoy == true or record.otpDigest ~= ARGV[2] then
        attempts = attempts + 1
        record.attempts = attempts
        if attempts >= maxAttempts then
          redis.call('DEL', KEYS[1], KEYS[2])
          return {-1}
        end
        local ttl = redis.call('PTTL', KEYS[1])
        if ttl > 0 then redis.call('SET', KEYS[1], cjson.encode(record), 'PX', ttl) end
        return {-2, attempts}
      end
      redis.call('DEL', KEYS[1], KEYS[2])
      redis.call('SET', KEYS[3], ARGV[4], 'EX', ARGV[5], 'NX')
      return {1}
    `;

    const preliminaryRecord = await this.readChallenge(challengeId);
    if (!preliminaryRecord) throw new BadRequestException(INVALID_OTP_MESSAGE);
    const resetRecord: ResetTokenRecord = {
      userId: preliminaryRecord.userId,
      identityDigest: preliminaryRecord.identityDigest,
      authVersion: preliminaryRecord.authVersion,
    };

    const result = (await this.redisService.execute((client) =>
      client.eval(
        script,
        3,
        passwordResetKeys.challenge(challengeId),
        passwordResetKeys.currentChallenge(preliminaryRecord.identityDigest),
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
      throw new HttpException(
        'تم تجاوز عدد محاولات التحقق المسموح بها. اطلب رمزاً جديداً.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (code !== 1) throw new BadRequestException(INVALID_OTP_MESSAGE);

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

    if (typeof raw !== 'string') {
      throw new BadRequestException('رابط إعادة التعيين غير صالح أو انتهت صلاحيته.');
    }

    let tokenRecord: ResetTokenRecord;
    try {
      tokenRecord = JSON.parse(raw) as ResetTokenRecord;
    } catch {
      throw new BadRequestException('رابط إعادة التعيين غير صالح أو انتهت صلاحيته.');
    }

    const user = await this.userModel.findOne({
      _id: tokenRecord.userId,
      isActive: true,
      deletedAt: null,
    });
    if (!user || (user.authVersion ?? 0) !== tokenRecord.authVersion) {
      throw new BadRequestException('رابط إعادة التعيين غير صالح أو انتهت صلاحيته.');
    }

    await this.passwordSecurityService.assertDifferent(newPassword, user.password);
    const password = await this.passwordSecurityService.hash(newPassword);
    const consumed = await this.redisService.execute((client) =>
      client.eval(
        "if redis.call('GET',KEYS[1]) == ARGV[1] then redis.call('DEL',KEYS[1]); return 1 end; return 0",
        1,
        tokenKey,
        raw,
      ),
    );
    if (Number(consumed) !== 1) {
      throw new BadRequestException('رابط إعادة التعيين غير صالح أو انتهت صلاحيته.');
    }

    const updated = await this.userModel.findOneAndUpdate(
      {
        _id: user._id,
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

    if (!updated) {
      throw new BadRequestException('رابط إعادة التعيين غير صالح أو انتهت صلاحيته.');
    }

    await this.invalidateCurrentChallenge(tokenRecord.identityDigest);
    await this.auditLogsService.create({
      userId: updated._id.toString(),
      userName: updated.name,
      action: AuditAction.PASSWORD_RESET,
      entity: 'User',
      entityId: updated._id.toString(),
      changes: { passwordChanged: true },
      ipAddress,
      userAgent,
    });
  }

  get requestMessage(): string {
    return GENERIC_REQUEST_MESSAGE;
  }

  private async reserveSend(identityDigest: string): Promise<{
    allowed: boolean;
    reason?: 'cooldown' | 'hourly';
    retryAfterSeconds?: number;
  }> {
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

  private async dispatchInitialEmail(input: {
    challengeId: string;
    identityDigest: string;
    email: string;
    name?: string;
    otp: string;
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
      await this.decoyifyChallengeIfCurrent(
        input.challengeId,
        input.identityDigest,
      ).catch(() => undefined);
      this.logger.warn('Password reset email could not be dispatched.');
    }
  }

  private async decoyifyChallengeIfCurrent(
    challengeId: string,
    identityDigest: string,
  ): Promise<boolean> {
    const challengeKey = passwordResetKeys.challenge(challengeId);
    const currentKey = passwordResetKeys.currentChallenge(identityDigest);
    const decoyRecord = this.createDecoyChallenge(
      identityDigest,
      challengeId,
    );
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
        challengeKey,
        currentKey,
        challengeId,
        JSON.stringify(decoyRecord),
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
        'maintenance:auth:password-reset:challenge:',
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

  private async readCurrentChallengeId(
    identityDigest: string,
  ): Promise<string | null> {
    return this.redisService.execute((client) =>
      client.get(passwordResetKeys.currentChallenge(identityDigest)),
    );
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
      isDecoy: true,
    };
  }

  private async invalidateCurrentChallenge(identityDigest: string): Promise<void> {
    await this.redisService.execute((client) =>
      client.eval(
        "local id=redis.call('GET',KEYS[1]); if id then redis.call('DEL',ARGV[1]..id) end; redis.call('DEL',KEYS[1]); return 1",
        1,
        passwordResetKeys.currentChallenge(identityDigest),
        'maintenance:auth:password-reset:challenge:',
      ),
    );
  }

  private generateOtp(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private digest(value: string): string {
    const secret = this.configService
      .get<string>('PASSWORD_RESET_OTP_SECRET')
      ?.trim();
    if (!secret) {
      throw new ServiceUnavailableException(
        'خدمة استعادة كلمة المرور غير مهيأة حالياً.',
      );
    }
    return createHmac('sha256', secret).update(value).digest('hex');
  }

  private configInt(name: string, fallback: number): number {
    const parsed = Number(this.configService.get<string | number>(name, fallback));
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
