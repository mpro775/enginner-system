import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { RedisService } from '../../infrastructure/redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(private readonly redisService: RedisService) {}

  @Public()
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Public()
  @Get('dependencies')
  async dependencies() {
    const redisAvailable = await this.redisService.ping();
    return {
      status: redisAvailable ? 'ok' : 'degraded',
      redis: redisAvailable ? 'available' : 'unavailable',
      smtp: 'unknown',
      timestamp: new Date().toISOString(),
    };
  }
}

