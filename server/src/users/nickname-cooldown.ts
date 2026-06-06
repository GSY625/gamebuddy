export const NICKNAME_CHANGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export type NicknameCooldown = {
  canChange: boolean;
  nextChangeAt: string | null;
  remainingMs: number;
};

export function getNicknameCooldown(
  nicknameChangedAt: Date | null | undefined,
  now = Date.now(),
): NicknameCooldown {
  if (!nicknameChangedAt) {
    return { canChange: true, nextChangeAt: null, remainingMs: 0 };
  }
  const changedAt = nicknameChangedAt.getTime();
  const unlockAt = changedAt + NICKNAME_CHANGE_COOLDOWN_MS;
  const remainingMs = Math.max(0, unlockAt - now);
  if (remainingMs <= 0) {
    return { canChange: true, nextChangeAt: null, remainingMs: 0 };
  }
  return {
    canChange: false,
    nextChangeAt: new Date(unlockAt).toISOString(),
    remainingMs,
  };
}
