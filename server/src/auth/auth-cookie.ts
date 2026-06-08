import { CookieOptions } from 'express';

export const REFRESH_TOKEN_COOKIE_NAME = 'gb_refresh_token';

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

export function getRefreshTokenCookieOptions(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction(),
    path: '/auth',
    maxAge: maxAgeMs,
  };
}

export function getRefreshTokenClearCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction(),
    path: '/auth',
  };
}

export function readCookieFromHeader(
  cookieHeader: string | undefined,
  name: string,
) {
  if (!cookieHeader) {
    return null;
  }

  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }

  return null;
}
