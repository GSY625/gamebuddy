import { Injectable } from '@nestjs/common';
import { createHash, createHmac } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { isAbsolute, join } from 'path';
import { v4 as uuid } from 'uuid';
import {
  getPublicBaseUrl,
  getS3AccessKeyId,
  getS3Bucket,
  getS3Endpoint,
  getS3ForcePathStyle,
  getS3PublicBaseUrl,
  getS3Region,
  getS3SecretAccessKey,
  getUploadDir,
  getUploadDriver,
  isProductionRuntime,
  type UploadDriver,
} from '../common/runtime-env';

export type SupportedImageExtension = '.jpg' | '.png' | '.gif' | '.webp';

type UploadHealthStatus = {
  driver: UploadDriver;
  ok: boolean;
  detail: string;
};

type S3Config = {
  endpoint: URL;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string | null;
  forcePathStyle: boolean;
};

@Injectable()
export class UploadService {
  private readonly production = isProductionRuntime();
  private readonly uploadDriver = getUploadDriver();
  private readonly uploadDir = getUploadDir();
  private readonly s3Config = this.uploadDriver === 's3' ? this.readS3Config() : null;

  constructor() {
    if (this.uploadDriver === 'local') {
      if (this.production && !isAbsolute(this.uploadDir)) {
        throw new Error('生产环境的上传目录必须是绝对路径');
      }
      if (!existsSync(this.uploadDir)) {
        mkdirSync(this.uploadDir, { recursive: true });
      }
    }
  }

  buildPublicUrl(filename: string) {
    if (this.uploadDriver === 's3') {
      return this.buildS3PublicUrl(filename);
    }

    const base = getPublicBaseUrl();
    return `${base}/uploads/${filename}`;
  }

  getUploadDir() {
    return this.uploadDir;
  }

  shouldServeLocalAssets() {
    return this.uploadDriver === 'local';
  }

  getHealthStatus(): UploadHealthStatus {
    if (this.uploadDriver === 's3') {
      return {
        driver: 's3',
        ok: Boolean(this.s3Config),
        detail: this.s3Config
          ? `bucket=${this.s3Config.bucket}, endpoint=${this.s3Config.endpoint.origin}`
          : 's3-not-configured',
      };
    }

    return {
      driver: 'local',
      ok: existsSync(this.uploadDir),
      detail: this.uploadDir,
    };
  }

  saveFilename(ext: SupportedImageExtension) {
    return `${uuid()}${ext}`;
  }

  localPath(filename: string) {
    return join(this.uploadDir, filename);
  }

  async saveImage(buffer: Buffer, ext: SupportedImageExtension) {
    const filename = this.saveFilename(ext);
    if (this.uploadDriver === 's3') {
      await this.uploadToS3(buffer, filename, this.getMimeType(ext));
      return filename;
    }

    await writeFile(this.localPath(filename), buffer);
    return filename;
  }

  private getMimeType(ext: SupportedImageExtension) {
    switch (ext) {
      case '.jpg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.gif':
        return 'image/gif';
      case '.webp':
        return 'image/webp';
      default:
        return 'application/octet-stream';
    }
  }

  private readS3Config(): S3Config {
    const endpointValue = getS3Endpoint();
    const region = getS3Region();
    const bucket = getS3Bucket();
    const accessKeyId = getS3AccessKeyId();
    const secretAccessKey = getS3SecretAccessKey();
    const publicBaseUrl = getS3PublicBaseUrl();
    const forcePathStyle = getS3ForcePathStyle();

    if (!endpointValue || !region || !bucket || !accessKeyId || !secretAccessKey) {
      throw new Error('S3 上传配置不完整');
    }

    return {
      endpoint: new URL(endpointValue),
      region,
      bucket,
      accessKeyId,
      secretAccessKey,
      publicBaseUrl: publicBaseUrl ?? null,
      forcePathStyle,
    };
  }

  private buildS3PublicUrl(key: string) {
    const config = this.s3Config;
    if (!config) {
      throw new Error('S3 上传配置未初始化');
    }

    if (config.publicBaseUrl) {
      return `${config.publicBaseUrl}/${this.encodeObjectKey(key)}`;
    }

    return this.buildS3RequestUrl(key).toString();
  }

  private encodeObjectKey(key: string) {
    return key
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
  }

  private buildS3RequestUrl(key: string) {
    const config = this.s3Config;
    if (!config) {
      throw new Error('S3 上传配置未初始化');
    }

    const encodedKey = this.encodeObjectKey(key);
    const endpoint = new URL(config.endpoint.toString());
    const basePath =
      endpoint.pathname && endpoint.pathname !== '/'
        ? endpoint.pathname.replace(/\/+$/, '')
        : '';

    if (config.forcePathStyle) {
      endpoint.pathname = `${basePath}/${config.bucket}/${encodedKey}`;
      return endpoint;
    }

    endpoint.hostname = `${config.bucket}.${endpoint.hostname}`;
    endpoint.pathname = `${basePath}/${encodedKey}`;
    return endpoint;
  }

  private buildCanonicalUri(url: URL) {
    const normalized = url.pathname
      .split('/')
      .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
      .join('/');

    return normalized.startsWith('/') ? normalized : `/${normalized}`;
  }

  private sha256Hex(value: string | Buffer) {
    return createHash('sha256').update(value).digest('hex');
  }

  private hmac(key: Buffer | string, value: string) {
    return createHmac('sha256', key).update(value).digest();
  }

  private buildSigningKey(secretAccessKey: string, dateStamp: string, region: string) {
    const kDate = this.hmac(`AWS4${secretAccessKey}`, dateStamp);
    const kRegion = this.hmac(kDate, region);
    const kService = this.hmac(kRegion, 's3');
    return this.hmac(kService, 'aws4_request');
  }

  private buildAmzDate(now: Date) {
    return now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  }

  private async uploadToS3(buffer: Buffer, key: string, contentType: string) {
    const config = this.s3Config;
    if (!config) {
      throw new Error('S3 上传配置未初始化');
    }

    const requestUrl = this.buildS3RequestUrl(key);
    const now = new Date();
    const amzDate = this.buildAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = this.sha256Hex(buffer);
    const canonicalUri = this.buildCanonicalUri(requestUrl);
    const canonicalQueryString = '';
    const canonicalHeaders =
      `content-type:${contentType}\n` +
      `host:${requestUrl.host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;
    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = [
      'PUT',
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      this.sha256Hex(canonicalRequest),
    ].join('\n');
    const signingKey = this.buildSigningKey(
      config.secretAccessKey,
      dateStamp,
      config.region,
    );
    const signature = createHmac('sha256', signingKey)
      .update(stringToSign)
      .digest('hex');
    const authorization =
      `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const response = await fetch(requestUrl, {
      method: 'PUT',
      headers: {
        authorization,
        'content-type': contentType,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
      },
      body: new Uint8Array(buffer),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `对象存储上传失败: ${response.status} ${response.statusText} ${body}`.trim(),
      );
    }
  }
}
