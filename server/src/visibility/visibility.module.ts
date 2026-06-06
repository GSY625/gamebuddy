import { Global, Module } from '@nestjs/common';
import { VisibilityService } from './visibility.service';

@Global()
@Module({
  providers: [VisibilityService],
  exports: [VisibilityService],
})
export class VisibilityModule {}
