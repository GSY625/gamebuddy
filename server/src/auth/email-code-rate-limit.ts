export const EMAIL_CODE_COOLDOWN_SECONDS = 60;
export const EMAIL_CODE_DAILY_LIMIT = 5;

/** 中国时区自然日 YYYY-MM-DD */
export function getChinaDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(
    now,
  );
}

/** 距离北京时间次日 0 点的秒数（至少 1） */
export function secondsUntilChinaMidnight(now = Date.now()): number {
  const shanghaiMs = now + 8 * 3600 * 1000;
  const shanghaiDay = Math.floor(shanghaiMs / 86400000);
  const nextDayStartMs = (shanghaiDay + 1) * 86400000 - 8 * 3600 * 1000;
  return Math.max(1, Math.ceil((nextDayStartMs - now) / 1000));
}

export function normalizeEmailForRateLimit(email: string): string {
  return email.trim().toLowerCase();
}
