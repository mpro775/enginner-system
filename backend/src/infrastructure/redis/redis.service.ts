import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PasswordRecoveryErrorCode } from '../../modules/auth/password-recovery.errors';

const UNAVAILABLE_MESSAGE =
  'خدمة استعادة كلمة المرور غير متاحة مؤقتاً، يرجى المحاولة لاحقاً.';

@Injectable()
export class RedisService implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis | null;
  private connectPromise: Promise<void> | null = null;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL')?.trim();

    if (!redisUrl) {
      this.client = null;
      this.logger.warn(
        'External Redis is not configured; password recovery is unavailable.',
      );
      return;
    }

    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 5_000,
      commandTimeout: 5_000,
      retryStrategy: (times) => Math.min(times * 250, 5_000),
    });

    this.client.on('error', () => {
      this.logger.warn('External Redis connection is unavailable.');
    });
    this.client.on('ready', () => {
      this.logger.log('External Redis connection is ready.');
    });
  }

  async execute<T>(operation: (client: Redis) => Promise<T>): Promise<T> {
    const client = await this.getReadyClient();
    try {
      return await operation(client);
    } catch {
      this.logger.warn('A password recovery Redis operation failed.');
      throw this.unavailableException();
    }
  }

  async ping(): Promise<boolean> {
    try {
      const client = await this.getReadyClient();
      return (await client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.client || this.client.status === 'end') return;
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect(false);
    }
  }

  private async getReadyClient(): Promise<Redis> {
    if (!this.client) {
      throw this.unavailableException();
    }

    if (this.client.status === 'ready') return this.client;

    if (!this.connectPromise) {
      this.connectPromise = this.connectClient(this.client).finally(() => {
        this.connectPromise = null;
      });
    }

    try {
      await this.connectPromise;
      return this.client;
    } catch {
      throw this.unavailableException();
    }
  }

  private unavailableException(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: PasswordRecoveryErrorCode.SERVICE_UNAVAILABLE,
      message: UNAVAILABLE_MESSAGE,
    });
  }

  private async connectClient(client: Redis): Promise<void> {
    if (client.status === 'wait' || client.status === 'end') {
      await client.connect();
    }
    if (client.status !== 'ready') {
      await client.ping();
    }
  }
}

export { UNAVAILABLE_MESSAGE as PASSWORD_RECOVERY_UNAVAILABLE_MESSAGE };
