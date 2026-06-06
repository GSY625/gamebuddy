export function formatCooldownMs(ms: number): string {
  if (ms <= 0) return '0 秒';
  const totalSec = Math.ceil(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} 天`);
  if (hours > 0) parts.push(`${hours} 小时`);
  if (minutes > 0) parts.push(`${minutes} 分`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds} 秒`);
  return parts.join(' ');
}

export function getRemainingMs(nextChangeAt: string | null | undefined, now: number) {
  if (!nextChangeAt) return 0;
  return Math.max(0, new Date(nextChangeAt).getTime() - now);
}
