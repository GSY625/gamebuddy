import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

type MemoryEntry = { value: string; expiresAt?: number };

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private memory = new Map<string, MemoryEntry>();
  private useMemory =
    !process.env.REDIS_URL || process.env.REDIS_URL === 'memory';

  private getClient(): Redis {
    if (!this.client) {
      this.client = new Redis(process.env.REDIS_URL!, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });
      this.client.on('error', (err) => {
        this.logger.warn(`Redis 不可用，使用内存模式: ${err.message}`);
        this.useMemory = true;
      });
    }
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    if (this.useMemory) {
      const item = this.memory.get(key);
      if (!item) return null;
      if (item.expiresAt && Date.now() > item.expiresAt) {
        this.memory.delete(key);
        return null;
      }
      return item.value;
    }
    try {
      if (!this.client) await this.getClient().connect();
      return this.getClient().get(key);
    } catch {
      this.useMemory = true;
      return this.get(key);
    }
  }

  async set(key: string, value: string, mode?: 'EX', ttl?: number) {
    if (this.useMemory) {
      this.memory.set(key, {
        value,
        expiresAt: mode === 'EX' && ttl ? Date.now() + ttl * 1000 : undefined,
      });
      return;
    }
    try {
      if (!this.client) await this.getClient().connect();
      if (mode === 'EX' && ttl) {
        await this.getClient().set(key, value, 'EX', ttl);
      } else {
        await this.getClient().set(key, value);
      }
    } catch {
      this.useMemory = true;
      await this.set(key, value, mode, ttl);
    }
  }

  async incr(key: string): Promise<number> {
    if (this.useMemory) {
      const current = Number((await this.get(key)) ?? '0');
      const next = current + 1;
      await this.set(key, String(next));
      return next;
    }
    try {
      if (!this.client) await this.getClient().connect();
      return await this.getClient().incr(key);
    } catch {
      this.useMemory = true;
      return this.incr(key);
    }
  }

  async decr(key: string): Promise<number> {
    if (this.useMemory) {
      const current = Number((await this.get(key)) ?? '0');
      const next = Math.max(0, current - 1);
      if (next === 0) {
        await this.del(key);
      } else {
        await this.set(key, String(next));
      }
      return next;
    }
    try {
      if (!this.client) await this.getClient().connect();
      const next = await this.getClient().decr(key);
      if (next <= 0) {
        await this.getClient().del(key);
        return 0;
      }
      return next;
    } catch {
      this.useMemory = true;
      return this.decr(key);
    }
  }

  async del(key: string) {
    if (this.useMemory) {
      this.memory.delete(key);
      return;
    }
    try {
      if (!this.client) await this.getClient().connect();
      await this.getClient().del(key);
    } catch {
      this.useMemory = true;
      this.memory.delete(key);
    }
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }
}
