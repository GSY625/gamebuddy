import { Global, Module } from '@nestjs/common';
import { HttpRateLimitGuard } from './rate-limit.guard';
import { RateLimitService } from './rate-limit.service';

@Global()
@Module({
  providers: [RateLimitService, HttpRateLimitGuard],
  exports: [RateLimitService, HttpRateLimitGuard],
})
export class RateLimitModule {}
