import { isAbsolute } from 'path';

const DEFAULT_DEV_JWT_SECRET = 'dev-secret';
const DEFAULT_DEV_PUBLIC_BASE_URL = 'http://localhost:3000';
const DEFAULT_DEV_UPLOAD_DIR = './uploads';
const DEFAULT_UPLOAD_DRIVER = 'local';
const PLACEHOLDER_PROD_JWT_SECRET =
  'change-me-in-production-use-long-random-string';

export type UploadDriver = 'local' | 's3';

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function isDevelopment() {
  return process.env.NODE_ENV === 'development';
}

function isLocalHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '0.0.0.0' ||
    normalized === '::1' ||
    normalized.endsWith('.local')
  );
}

function normalizeUrl(value: string) {
  return value.replace(/\/+$/, '');
}

function parseHttpUrl(name: string, value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} 必须是合法的绝对地址`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${name} 必须以 http:// 或 https:// 开头`);
  }

  return url;
}

function validateDatabaseUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('DATABASE_URL 必须是合法的 PostgreSQL 连接串');
  }

  if (!['postgresql:', 'postgres:'].includes(url.protocol)) {
    throw new Error('DATABASE_URL 必须以 postgresql:// 或 postgres:// 开头');
  }

  return url;
}

function normalizeUploadDriver(value?: string | null): UploadDriver {
  return value?.trim().toLowerCase() === 's3' ? 's3' : 'local';
}

function isTruthy(value?: string | null) {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

export function getJwtSecret() {
  const configured = process.env.JWT_SECRET?.trim();
  if (configured) {
    return configured;
  }
  return DEFAULT_DEV_JWT_SECRET;
}

export function getPublicBaseUrl() {
  const configured = process.env.PUBLIC_BASE_URL?.trim();
  if (configured) {
    return normalizeUrl(configured);
  }
  return DEFAULT_DEV_PUBLIC_BASE_URL;
}

export function shouldUseLocalDevMailFlow() {
  if (isProduction()) {
    return false;
  }

  if (isDevelopment()) {
    return true;
  }

  const configured = process.env.PUBLIC_BASE_URL?.trim();
  if (!configured) {
    return false;
  }

  try {
    const url = parseHttpUrl('PUBLIC_BASE_URL', configured);
    return isLocalHostname(url.hostname);
  } catch {
    return false;
  }
}

export function getConfiguredAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function isProductionRuntime() {
  return isProduction();
}

export function getUploadDriver(): UploadDriver {
  return normalizeUploadDriver(
    process.env.UPLOAD_DRIVER?.trim() ?? DEFAULT_UPLOAD_DRIVER,
  );
}

export function shouldServeLocalUploads() {
  return getUploadDriver() === 'local';
}

export function getUploadDir() {
  return process.env.UPLOAD_DIR?.trim() || DEFAULT_DEV_UPLOAD_DIR;
}

export function getS3Endpoint() {
  return process.env.S3_ENDPOINT?.trim() ?? '';
}

export function getS3Region() {
  return process.env.S3_REGION?.trim() ?? '';
}

export function getS3Bucket() {
  return process.env.S3_BUCKET?.trim() ?? '';
}

export function getS3AccessKeyId() {
  return process.env.S3_ACCESS_KEY_ID?.trim() ?? '';
}

export function getS3SecretAccessKey() {
  return process.env.S3_SECRET_ACCESS_KEY?.trim() ?? '';
}

export function getS3PublicBaseUrl() {
  const configured = process.env.S3_PUBLIC_BASE_URL?.trim();
  if (!configured) {
    return null;
  }
  return normalizeUrl(configured);
}

export function getS3ForcePathStyle() {
  return isTruthy(process.env.S3_FORCE_PATH_STYLE);
}

export function getSmtpPort() {
  const raw = process.env.SMTP_PORT?.trim();
  if (!raw) {
    return 587;
  }

  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('SMTP_PORT 必须是 1-65535 之间的整数');
  }

  return port;
}

export function getSmtpSecure() {
  const configured = process.env.SMTP_SECURE?.trim();
  if (configured) {
    return isTruthy(configured);
  }

  return getSmtpPort() === 465;
}

export function validateServerRuntimeEnv() {
  if (!isProduction()) {
    return;
  }

  const errors: string[] = [];

  const databaseUrl = process.env.DATABASE_URL?.trim() ?? '';
  if (!databaseUrl) {
    errors.push('DATABASE_URL 未配置');
  } else {
    try {
      const url = validateDatabaseUrl(databaseUrl);
      if (isLocalHostname(url.hostname)) {
        errors.push('DATABASE_URL 不能指向 localhost 或本机地址');
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'DATABASE_URL 非法');
    }
  }

  const jwtSecret = process.env.JWT_SECRET?.trim() ?? '';
  if (!jwtSecret) {
    errors.push('JWT_SECRET 未配置');
  } else if (
    jwtSecret === DEFAULT_DEV_JWT_SECRET ||
    jwtSecret === PLACEHOLDER_PROD_JWT_SECRET
  ) {
    errors.push('JWT_SECRET 仍在使用开发占位值');
  } else if (jwtSecret.length < 24) {
    errors.push('JWT_SECRET 过短，至少需要 24 位');
  }

  const publicBaseUrl = process.env.PUBLIC_BASE_URL?.trim() ?? '';
  if (!publicBaseUrl) {
    errors.push('PUBLIC_BASE_URL 未配置');
  } else {
    try {
      const url = parseHttpUrl('PUBLIC_BASE_URL', publicBaseUrl);
      if (isLocalHostname(url.hostname)) {
        errors.push('PUBLIC_BASE_URL 不能指向 localhost 或本机地址');
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'PUBLIC_BASE_URL 非法');
    }
  }

  const adminEmails = getConfiguredAdminEmails();
  if (adminEmails.length === 0) {
    errors.push('ADMIN_EMAILS 未配置，生产环境必须显式指定管理员邮箱');
  }

  for (const email of adminEmails) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push(`ADMIN_EMAILS 中存在非法邮箱：${email}`);
    }
  }

  const smtpHost = process.env.SMTP_HOST?.trim() ?? '';
  const smtpPort = process.env.SMTP_PORT?.trim() ?? '';
  const smtpUser = process.env.SMTP_USER?.trim() ?? '';
  const smtpPass = process.env.SMTP_PASS?.trim() ?? '';
  const smtpFrom = process.env.SMTP_FROM?.trim() ?? '';

  if (!smtpHost) {
    errors.push('生产环境必须配置 SMTP_HOST');
  }
  if (!smtpPort) {
    errors.push('生产环境必须配置 SMTP_PORT');
  } else {
    try {
      getSmtpPort();
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'SMTP_PORT 非法');
    }
  }
  if (!smtpUser) {
    errors.push('生产环境必须配置 SMTP_USER');
  }
  if (!smtpPass) {
    errors.push('生产环境必须配置 SMTP_PASS');
  }
  if (!smtpFrom) {
    errors.push('生产环境必须配置 SMTP_FROM');
  }

  const redisUrl = process.env.REDIS_URL?.trim() ?? '';
  if (!redisUrl) {
    errors.push('REDIS_URL 未配置');
  } else if (redisUrl === 'memory') {
    errors.push('生产环境禁止使用 REDIS_URL=memory');
  } else {
    try {
      const url = new URL(redisUrl);
      if (!['redis:', 'rediss:'].includes(url.protocol)) {
        errors.push('REDIS_URL 必须以 redis:// 或 rediss:// 开头');
      }
      if (isLocalHostname(url.hostname)) {
        errors.push('REDIS_URL 不能指向 localhost 或本机地址');
      }
    } catch {
      errors.push('REDIS_URL 必须是合法的 Redis 连接串');
    }
  }

  const uploadDriver = getUploadDriver();
  if (uploadDriver === 'local') {
    errors.push('生产环境必须使用 UPLOAD_DRIVER=s3，不能继续使用本地上传目录');
  }

  if (uploadDriver === 'local') {
    const uploadDir = getUploadDir();
    if (!uploadDir) {
      errors.push('UPLOAD_DIR 未配置');
    } else if (uploadDir === DEFAULT_DEV_UPLOAD_DIR) {
      errors.push('生产环境不能继续使用默认上传目录 ./uploads');
    } else if (!isAbsolute(uploadDir)) {
      errors.push('生产环境的 UPLOAD_DIR 必须是绝对路径');
    }
  }

  if (uploadDriver === 's3') {
    const endpoint = getS3Endpoint();
    if (!endpoint) {
      errors.push('S3_ENDPOINT 未配置');
    } else {
      try {
        const url = parseHttpUrl('S3_ENDPOINT', endpoint);
        if (url.username || url.password) {
          errors.push('S3_ENDPOINT 不能在地址中包含账号或密码');
        }
        if (isLocalHostname(url.hostname)) {
          errors.push('S3_ENDPOINT 不能指向 localhost 或本机地址');
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'S3_ENDPOINT 非法');
      }
    }

    if (!getS3Region()) {
      errors.push('S3_REGION 未配置');
    }
    if (!getS3Bucket()) {
      errors.push('S3_BUCKET 未配置');
    }
    if (!getS3AccessKeyId()) {
      errors.push('S3_ACCESS_KEY_ID 未配置');
    }
    if (!getS3SecretAccessKey()) {
      errors.push('S3_SECRET_ACCESS_KEY 未配置');
    }

    const publicUrl = getS3PublicBaseUrl();
    if (publicUrl) {
      try {
        parseHttpUrl('S3_PUBLIC_BASE_URL', publicUrl);
      } catch (error) {
        errors.push(
          error instanceof Error ? error.message : 'S3_PUBLIC_BASE_URL 非法',
        );
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`生产环境配置校验失败：${errors.join('；')}`);
  }
}
