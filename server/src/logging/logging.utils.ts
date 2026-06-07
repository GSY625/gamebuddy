import { randomUUID } from 'crypto';

const SENSITIVE_KEYS = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'passwordHash',
  'code',
  'captchaCode',
  'token',
  'accessToken',
  'authorization',
  'refreshToken',
]);

type PlainObject = Record<string, unknown>;

export function createRequestId() {
  return randomUUID();
}

export function getClientIp(req: {
  headers?: Record<string, unknown>;
  ip?: string;
  socket?: { remoteAddress?: string | null };
}) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return String(forwarded[0]);
  }
  return req.ip ?? req.socket?.remoteAddress ?? undefined;
}

export function shouldSkipRequestLogging(path?: string) {
  if (!path) return false;
  return path.startsWith('/uploads/') || path === '/favicon.ico';
}

export function sanitizeForLog(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (depth >= 5) return '[MaxDepth]';

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLog(item, depth + 1));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    const output: PlainObject = {};
    for (const [key, nestedValue] of Object.entries(value as PlainObject)) {
      output[key] = SENSITIVE_KEYS.has(key)
        ? '[REDACTED]'
        : sanitizeForLog(nestedValue, depth + 1);
    }
    return output;
  }

  if (typeof value === 'string' && value.length > 1000) {
    return `${value.slice(0, 1000)}...[truncated]`;
  }

  return value;
}

export function pruneUndefined<T extends PlainObject>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, nestedValue]) => nestedValue !== undefined),
  ) as T;
}

export function serializeError(error: unknown) {
  if (error instanceof Error) {
    const extra =
      'getStatus' in error && typeof error.getStatus === 'function'
        ? { statusCode: error.getStatus() as number }
        : {};

    return pruneUndefined({
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...extra,
    });
  }

  return sanitizeForLog(error);
}
