import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { isProductionRuntime } from '../common/runtime-env';

type MemoryEntry = { value: string; expiresAt?: number };
type RedisMessageHandler = (message: string) => void | Promise<void>;

@Injectable()
export class RedisService implements OnModuleDestroy, OnModuleInit {
  private static memorySubscribers = new Map<string, Set<RedisMessageHandler>>();
  private static memoryLists = new Map<string, string[]>();

  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private publisher: Redis | null = null;
  private subscriber: Redis | null = null;
  private readonly memory = new Map<string, MemoryEntry>();
  private readonly channelHandlers = new Map<string, Set<RedisMessageHandler>>();
  private useMemory =
    !process.env.REDIS_URL || process.env.REDIS_URL === 'memory';
  private readonly production = isProductionRuntime();

  private get redisUrl() {
    return process.env.REDIS_URL!;
  }

  private createClient() {
    const client = new Redis(this.redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    client.on('error', (err) => {
      if (this.production) {
        this.logger.error(`生产环境 Redis 异常: ${err.message}`);
        return;
      }
      this.logger.warn(`Redis 不可用，切换为内存模式: ${err.message}`);
    });

    return client;
  }

  private getClient(): Redis {
    if (!this.client) {
      this.client = this.createClient();
    }
    return this.client;
  }

  private getPublisher(): Redis {
    if (!this.publisher) {
      this.publisher = this.createClient();
    }
    return this.publisher;
  }

  private getSubscriber(): Redis {
    if (!this.subscriber) {
      this.subscriber = this.createClient();
      this.subscriber.on('message', (channel, message) => {
        const handlers = this.channelHandlers.get(channel);
        if (!handlers) {
          return;
        }
        for (const handler of handlers) {
          void handler(message);
        }
      });
    }
    return this.subscriber;
  }

  async onModuleInit() {
    if (this.useMemory || !this.production) {
      return;
    }

    try {
      await this.getClient().connect();
      await this.getClient().ping();
      this.logger.log('Redis 已连接，生产环境使用外部 Redis');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '无法连接到 Redis';
      throw new Error(`生产环境 Redis 连接失败：${message}`);
    }
  }

  isMemoryMode() {
    return this.useMemory;
  }

  async ping() {
    if (this.useMemory) {
      return 'PONG';
    }

    if (!this.client) {
      await this.getClient().connect();
    }
    return this.getClient().ping();
  }

  async publish(channel: string, message: string) {
    if (this.useMemory) {
      const handlers = RedisService.memorySubscribers.get(channel);
      if (!handlers) {
        return 0;
      }
      for (const handler of handlers) {
        await handler(message);
      }
      return handlers.size;
    }

    if (!this.publisher) {
      await this.getPublisher().connect();
    }
    return this.getPublisher().publish(channel, message);
  }

  async subscribe(channel: string, handler: RedisMessageHandler) {
    if (this.useMemory) {
      const handlers =
        RedisService.memorySubscribers.get(channel) ?? new Set<RedisMessageHandler>();
      handlers.add(handler);
      RedisService.memorySubscribers.set(channel, handlers);

      return async () => {
        const current = RedisService.memorySubscribers.get(channel);
        current?.delete(handler);
        if (current && current.size === 0) {
          RedisService.memorySubscribers.delete(channel);
        }
      };
    }

    const firstSubscriber = !this.channelHandlers.has(channel);
    const handlers = this.channelHandlers.get(channel) ?? new Set<RedisMessageHandler>();
    handlers.add(handler);
    this.channelHandlers.set(channel, handlers);

    if (!this.subscriber) {
      await this.getSubscriber().connect();
    }
    if (firstSubscriber) {
      await this.getSubscriber().subscribe(channel);
    }

    return async () => {
      const current = this.channelHandlers.get(channel);
      current?.delete(handler);
      if (!current || current.size > 0) {
        return;
      }
      this.channelHandlers.delete(channel);
      if (this.subscriber) {
        await this.subscriber.unsubscribe(channel);
      }
    };
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
      if (this.production) {
        throw new Error('生产环境 Redis 读取失败，已拒绝降级到内存模式');
      }
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
      if (this.production) {
        throw new Error('生产环境 Redis 写入失败，已拒绝降级到内存模式');
      }
      this.useMemory = true;
      await this.set(key, value, mode, ttl);
    }
  }

  async incr(key: string): Promise<number> {
    if (this.useMemory) {
      const entry = this.memory.get(key);
      const current = Number((await this.get(key)) ?? '0');
      const next = current + 1;
      this.memory.set(key, {
        value: String(next),
        expiresAt: entry?.expiresAt,
      });
      return next;
    }
    try {
      if (!this.client) await this.getClient().connect();
      return await this.getClient().incr(key);
    } catch {
      if (this.production) {
        throw new Error('生产环境 Redis 自增失败，已拒绝降级到内存模式');
      }
      this.useMemory = true;
      return this.incr(key);
    }
  }

  async decr(key: string): Promise<number> {
    if (this.useMemory) {
      const entry = this.memory.get(key);
      const current = Number((await this.get(key)) ?? '0');
      const next = Math.max(0, current - 1);
      if (next === 0) {
        await this.del(key);
      } else {
        this.memory.set(key, {
          value: String(next),
          expiresAt: entry?.expiresAt,
        });
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
      if (this.production) {
        throw new Error('生产环境 Redis 自减失败，已拒绝降级到内存模式');
      }
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
      if (this.production) {
        throw new Error('生产环境 Redis 删除失败，已拒绝降级到内存模式');
      }
      this.useMemory = true;
      this.memory.delete(key);
    }
  }

  async lpush(key: string, value: string): Promise<number> {
    if (this.useMemory) {
      const list = RedisService.memoryLists.get(key) ?? [];
      list.unshift(value);
      RedisService.memoryLists.set(key, list);
      return list.length;
    }

    try {
      if (!this.client) await this.getClient().connect();
      return await this.getClient().lpush(key, value);
    } catch {
      if (this.production) {
        throw new Error('生产环境 Redis 队列写入失败，已拒绝降级到内存模式');
      }
      this.useMemory = true;
      return this.lpush(key, value);
    }
  }

  async rpop(key: string): Promise<string | null> {
    if (this.useMemory) {
      const list = RedisService.memoryLists.get(key);
      if (!list || list.length === 0) {
        return null;
      }
      const value = list.pop() ?? null;
      if (list.length === 0) {
        RedisService.memoryLists.delete(key);
      } else {
        RedisService.memoryLists.set(key, list);
      }
      return value;
    }

    try {
      if (!this.client) await this.getClient().connect();
      return await this.getClient().rpop(key);
    } catch {
      if (this.production) {
        throw new Error('生产环境 Redis 队列读取失败，已拒绝降级到内存模式');
      }
      this.useMemory = true;
      return this.rpop(key);
    }
  }

  async ttl(key: string): Promise<number> {
    if (this.useMemory) {
      const item = this.memory.get(key);
      if (!item) return -2;
      if (!item.expiresAt) return -1;
      const ttl = Math.ceil((item.expiresAt - Date.now()) / 1000);
      if (ttl <= 0) {
        this.memory.delete(key);
        return -2;
      }
      return ttl;
    }
    try {
      if (!this.client) await this.getClient().connect();
      return await this.getClient().ttl(key);
    } catch {
      if (this.production) {
        throw new Error('生产环境 Redis TTL 读取失败，已拒绝降级到内存模式');
      }
      this.useMemory = true;
      return this.ttl(key);
    }
  }

  async onModuleDestroy() {
    await this.client?.quit();
    await this.publisher?.quit();
    await this.subscriber?.quit();
  }
}
