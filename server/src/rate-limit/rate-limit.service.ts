import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { BusinessLogService } from '../logging/business-log.service';
import { RateLimitPolicy } from './rate-limit.decorator';

type RateLimitConsumeContext = {
  channel?: 'http' | 'ws';
  route?: string;
  event?: string;
  userId?: string;
  ip?: string;
};

@Injectable()
export class RateLimitService {
  constructor(
    private readonly redis: RedisService,
    private readonly businessLog: BusinessLogService,
  ) {}

  async consume(
    identity: string,
    policy: RateLimitPolicy,
    context: RateLimitConsumeContext = {},
  ) {
    const key = `rate-limit:${policy.bucket}:${identity}`;
    const current = await this.redis.incr(key);
    if (current === 1) {
      await this.redis.set(key, '1', 'EX', policy.windowSeconds);
    }

    if (current <= policy.limit) {
      return;
    }

    const ttl = await this.redis.ttl(key);
    const retryAfterSeconds =
      typeof ttl === 'number' && ttl > 0 ? ttl : policy.windowSeconds;
    this.businessLog.warn('security.rate_limit.hit', {
      identity,
      bucket: policy.bucket,
      limit: policy.limit,
      windowSeconds: policy.windowSeconds,
      retryAfterSeconds,
      ...context,
    });

    throw new HttpException(
      {
        message:
          policy.message ?? `操作过于频繁，请 ${retryAfterSeconds} 秒后再试`,
        retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
