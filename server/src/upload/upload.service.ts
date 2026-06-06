import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuid } from 'uuid';

export type SupportedImageExtension = '.jpg' | '.png' | '.gif' | '.webp';

@Injectable()
export class UploadService {
  private uploadDir: string;

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR ?? './uploads';
    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  buildPublicUrl(filename: string) {
    const base = process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000';
    return `${base}/uploads/${filename}`;
  }

  getUploadDir() {
    return this.uploadDir;
  }

  saveFilename(ext: SupportedImageExtension) {
    return `${uuid()}${ext}`;
  }

  localPath(filename: string) {
    return join(this.uploadDir, filename);
  }

  async saveImage(buffer: Buffer, ext: SupportedImageExtension) {
    const filename = this.saveFilename(ext);
    await writeFile(this.localPath(filename), buffer);
    return filename;
  }
}
