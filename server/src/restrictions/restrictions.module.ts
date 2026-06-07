import { Module } from '@nestjs/common';
import { RestrictionsService } from './restrictions.service';

@Module({
  providers: [RestrictionsService],
  exports: [RestrictionsService],
})
export class RestrictionsModule {}
