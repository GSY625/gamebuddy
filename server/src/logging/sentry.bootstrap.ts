import * as Sentry from '@sentry/nestjs';

let initialized = false;

function parseSampleRate(value: string | undefined, fallback: number) {
  if (!value?.trim()) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return fallback;
  }

  return parsed;
}

export function isSentryEnabled() {
  return Boolean(process.env.SENTRY_DSN?.trim());
}

export function initializeSentry() {
  if (initialized || !isSentryEnabled()) {
    return false;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN?.trim(),
    environment:
      process.env.SENTRY_ENVIRONMENT?.trim() ||
      process.env.NODE_ENV ||
      'development',
    release: process.env.SENTRY_RELEASE?.trim() || undefined,
    tracesSampleRate: parseSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE, 0),
    sendDefaultPii: false,
  });

  initialized = true;
  return true;
}
