import * as Sentry from '@sentry/react';

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
  return Boolean(import.meta.env.VITE_SENTRY_DSN?.trim());
}

export function initSentry() {
  if (initialized || !isSentryEnabled()) {
    return false;
  }

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN?.trim(),
    environment:
      import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim() ||
      import.meta.env.MODE ||
      'development',
    tracesSampleRate: parseSampleRate(
      import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE,
      0,
    ),
    sendDefaultPii: false,
  });

  initialized = true;
  return true;
}
