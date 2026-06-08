import { BadRequestException, Injectable } from '@nestjs/common';
import { secondsUntilChinaMidnight } from '../auth/email-code-rate-limit';
import { BusinessLogService } from '../logging/business-log.service';
import { RedisService } from '../redis/redis.service';

const UPLOAD_DAILY_LIMIT = 30;

@Injectable()
export class UploadQuotaService {
  constructor(
    private readonly redis: RedisService,
    private readonly businessLog: BusinessLogService,
  ) {}

  async assertCanUpload(userId: string) {
    const count = await this.getDailyCount(userId);
    if (count < UPLOAD_DAILY_LIMIT) {
      return;
    }

    const retryAfterSeconds = secondsUntilChinaMidnight();
    this.businessLog.warn('upload.daily_quota.hit', {
      userId,
      dailyLimit: UPLOAD_DAILY_LIMIT,
      retryAfterSeconds,
    });
    throw new BadRequestException({
      message: `今日上传次数已达上限（${UPLOAD_DAILY_LIMIT} 次），请明天再试`,
      retryAfterSeconds,
    });
  }

  async recordUpload(userId: string) {
    const key = this.getDailyKey(userId);
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.set(key, '1', 'EX', secondsUntilChinaMidnight());
    }
    return {
      count,
      limit: UPLOAD_DAILY_LIMIT,
      remaining: Math.max(0, UPLOAD_DAILY_LIMIT - count),
    };
  }

  private async getDailyCount(userId: string) {
    const raw = await this.redis.get(this.getDailyKey(userId));
    const count = Number.parseInt(raw ?? '0', 10);
    return Number.isFinite(count) ? count : 0;
  }

  private getDailyKey(userId: string) {
    return `upload:daily:${userId}`;
  }
}
