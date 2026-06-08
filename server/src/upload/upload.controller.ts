import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  SupportedImageExtension,
  UploadService,
} from './upload.service';
import { UploadQuotaService } from './upload-quota.service';
import { HttpRateLimitGuard } from '../rate-limit/rate-limit.guard';
import { RateLimit } from '../rate-limit/rate-limit.decorator';

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

function detectImageType(
  buffer: Buffer,
): { ext: SupportedImageExtension; mime: string } | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { ext: '.jpg', mime: 'image/jpeg' };
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { ext: '.png', mime: 'image/png' };
  }

  if (
    buffer.length >= 6 &&
    buffer.subarray(0, 6).toString('ascii') === 'GIF87a'
  ) {
    return { ext: '.gif', mime: 'image/gif' };
  }

  if (
    buffer.length >= 6 &&
    buffer.subarray(0, 6).toString('ascii') === 'GIF89a'
  ) {
    return { ext: '.gif', mime: 'image/gif' };
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ext: '.webp', mime: 'image/webp' };
  }

  return null;
}

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(
    private upload: UploadService,
    private uploadQuota: UploadQuotaService,
  ) {}

  @Post('image')
  @UseGuards(HttpRateLimitGuard)
  @RateLimit({
    bucket: 'upload-image',
    limit: 10,
    windowSeconds: 60,
    keyBy: 'user-or-ip',
    message: '上传图片过于频繁，请稍后再试',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
          cb(
            new BadRequestException(
              '仅支持 JPG、PNG、GIF、WebP 格式的图片',
            ) as Error,
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadImage(
    @Req() req: { user: { id: string } },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('未上传文件');
    }

    const detected = detectImageType(file.buffer);
    if (!detected) {
      throw new BadRequestException('图片内容无效或格式不受支持');
    }

    if (detected.mime !== file.mimetype) {
      throw new BadRequestException('文件类型与图片内容不匹配');
    }

    await this.uploadQuota.assertCanUpload(req.user.id);
    const filename = await this.upload.saveImage(file.buffer, detected.ext);
    await this.uploadQuota.recordUpload(req.user.id);
    return { url: this.upload.buildPublicUrl(filename) };
  }
}
