import { SetMetadata } from '@nestjs/common';

export type RateLimitIdentity = 'ip' | 'user' | 'user-or-ip';

export type RateLimitPolicy = {
  bucket: string;
  limit: number;
  windowSeconds: number;
  keyBy?: RateLimitIdentity;
  message?: string;
};

export const RATE_LIMIT_METADATA = 'rate_limit_policy';

export const RateLimit = (policy: RateLimitPolicy) =>
  SetMetadata(RATE_LIMIT_METADATA, policy);
