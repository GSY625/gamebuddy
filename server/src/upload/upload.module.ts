import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { UploadQuotaService } from './upload-quota.service';

@Module({
  controllers: [UploadController],
  providers: [UploadService, UploadQuotaService],
  exports: [UploadService],
})
export class UploadModule {}
