import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { UploadService } from '../upload/upload.service';

@Injectable()
export class HealthService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private upload: UploadService,
  ) {}

  getLiveness() {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness() {
    const checks = {
      database: 'down' as 'up' | 'down',
      redis: 'down' as 'up' | 'down',
      upload: this.upload.getHealthStatus(),
    };

    const failures: string[] = [];

    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      checks.database = 'up';
    } catch {
      failures.push('database');
    }

    try {
      await this.redis.ping();
      checks.redis = 'up';
    } catch {
      failures.push('redis');
    }

    if (!checks.upload.ok) {
      failures.push('upload');
    }

    const payload = {
      status: failures.length === 0 ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    };

    if (failures.length > 0) {
      throw new ServiceUnavailableException(payload);
    }

    return payload;
  }
}
