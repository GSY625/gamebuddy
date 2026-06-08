import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getClientIp } from '../logging/logging.utils';
import {
  RATE_LIMIT_METADATA,
  RateLimitPolicy,
} from './rate-limit.decorator';
import { RateLimitService } from './rate-limit.service';

@Injectable()
export class HttpRateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimit: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const policy = this.reflector.getAllAndOverride<RateLimitPolicy>(
      RATE_LIMIT_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (!policy) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: { id?: string };
      headers?: Record<string, unknown>;
      ip?: string;
      method?: string;
      originalUrl?: string;
      url?: string;
      socket?: { remoteAddress?: string | null };
    }>();
    const userId = request.user?.id;
    const ip = getClientIp(request) ?? 'unknown';
    const keyBy = policy.keyBy ?? 'ip';

    const identity =
      keyBy === 'user'
        ? userId ?? `ip:${ip}`
        : keyBy === 'user-or-ip'
          ? userId
            ? `user:${userId}`
            : `ip:${ip}`
          : `ip:${ip}`;

    await this.rateLimit.consume(identity, policy, {
      channel: 'http',
      route: `${request.method ?? 'UNKNOWN'} ${request.originalUrl ?? request.url ?? ''}`.trim(),
      userId,
      ip,
    });
    return true;
  }
}
