import { Module } from '@nestjs/common';
import { UploadModule } from '../upload/upload.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { ShutdownService } from './shutdown.service';

@Module({
  imports: [UploadModule],
  controllers: [HealthController],
  providers: [HealthService, ShutdownService],
})
export class HealthModule {}
