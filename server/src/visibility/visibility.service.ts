import { ForbiddenException, Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export type VisibilityStatus = 'online' | 'invisible';

@Injectable()
export class VisibilityService {
  constructor(private redis: RedisService) {}

  private key(userId: string) {
    return `visibility:${userId}`;
  }

  async get(userId: string): Promise<VisibilityStatus> {
    const v = await this.redis.get(this.key(userId));
    return v === 'invisible' ? 'invisible' : 'online';
  }

  async set(userId: string, status: VisibilityStatus) {
    await this.redis.set(this.key(userId), status);
  }

  async assertOnline(userId: string) {
    if ((await this.get(userId)) === 'invisible') {
      throw new ForbiddenException('请先切换为在线状态');
    }
  }

  async isVisibleToOthers(userId: string) {
    return (await this.get(userId)) === 'online';
  }
}
