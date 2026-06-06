import { BadRequestException, Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import {
  EMAIL_CODE_COOLDOWN_SECONDS,
  EMAIL_CODE_DAILY_LIMIT,
  getChinaDateKey,
  normalizeEmailForRateLimit,
  secondsUntilChinaMidnight,
} from './email-code-rate-limit';

type MemoryDaily = { count: number; day: string };

@Injectable()
export class EmailCodeRateLimitService {
  private readonly memoryLastSend = new Map<string, number>();
  private readonly memoryDaily = new Map<string, MemoryDaily>();

  constructor(private readonly redis: RedisService) {}

  async assertCanSend(email: string): Promise<void> {
    const normalized = normalizeEmailForRateLimit(email);
    await this.assertCooldown(normalized);
    await this.assertDailyLimit(normalized);
  }

  async recordSend(email: string): Promise<void> {
    const normalized = normalizeEmailForRateLimit(email);
    const now = Date.now();
    await this.setLastSend(normalized, now);
    await this.incrementDaily(normalized);
  }

  private cooldownKey(email: string) {
    return `email-code:last:${email}`;
  }

  private dailyKey(email: string, day: string) {
    return `email-code:count:${email}:${day}`;
  }

  private async assertCooldown(email: string) {
    const last = await this.getLastSend(email);
    if (last == null) return;
    const elapsed = Math.floor((Date.now() - last) / 1000);
    if (elapsed < EMAIL_CODE_COOLDOWN_SECONDS) {
      const retryAfter = EMAIL_CODE_COOLDOWN_SECONDS - elapsed;
      throw new BadRequestException({
        message: `发送过于频繁，请 ${retryAfter} 秒后再试`,
        retryAfterSeconds: retryAfter,
      });
    }
  }

  private async assertDailyLimit(email: string) {
    const count = await this.getDailyCount(email);
    if (count >= EMAIL_CODE_DAILY_LIMIT) {
      throw new BadRequestException({
        message: `该邮箱今日验证码发送次数已达上限（${EMAIL_CODE_DAILY_LIMIT} 次），请明天再试`,
      });
    }
  }

  private async getLastSend(email: string): Promise<number | null> {
    const key = this.cooldownKey(email);
    const raw = await this.redis.get(key);
    if (raw != null) {
      const ts = parseInt(raw, 10);
      return Number.isFinite(ts) ? ts : null;
    }
    const mem = this.memoryLastSend.get(email);
    if (mem == null) return null;
    if (Date.now() - mem >= EMAIL_CODE_COOLDOWN_SECONDS * 1000) {
      this.memoryLastSend.delete(email);
      return null;
    }
    return mem;
  }

  private async setLastSend(email: string, ts: number) {
    const key = this.cooldownKey(email);
    await this.redis.set(
      key,
      String(ts),
      'EX',
      EMAIL_CODE_COOLDOWN_SECONDS,
    );
    this.memoryLastSend.set(email, ts);
  }

  private async getDailyCount(email: string): Promise<number> {
    const day = getChinaDateKey();
    const key = this.dailyKey(email, day);
    const raw = await this.redis.get(key);
    if (raw != null) {
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? n : 0;
    }
    const mem = this.memoryDaily.get(email);
    if (!mem || mem.day !== day) return 0;
    return mem.count;
  }

  private async incrementDaily(email: string) {
    const day = getChinaDateKey();
    const key = this.dailyKey(email, day);
    const count = (await this.getDailyCount(email)) + 1;
    await this.redis.set(key, String(count), 'EX', secondsUntilChinaMidnight());
    this.memoryDaily.set(email, { count, day });
  }
}
