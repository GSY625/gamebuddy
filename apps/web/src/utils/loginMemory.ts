export type LoginMemoryAccount = {
  email: string;
  rememberedPassword: string | null;
  updatedAt: number;
};

export type LoginMemoryState = {
  lastEmail: string;
  accounts: LoginMemoryAccount[];
};

const LOGIN_MEMORY_KEY = 'gamebuddy.login-memory.v1';
const MAX_LOGIN_ACCOUNTS = 10;

function isBrowser() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function normalizeLoginEmail(value: string) {
  return value.trim().toLowerCase();
}

function emptyLoginMemory(): LoginMemoryState {
  return {
    lastEmail: '',
    accounts: [],
  };
}

export function loadLoginMemory(): LoginMemoryState {
  if (!isBrowser()) return emptyLoginMemory();

  try {
    const raw = localStorage.getItem(LOGIN_MEMORY_KEY);
    if (!raw) return emptyLoginMemory();

    const parsed = JSON.parse(raw) as Partial<LoginMemoryState>;
    const accounts = Array.isArray(parsed.accounts)
      ? parsed.accounts
          .filter(
            (item): item is LoginMemoryAccount =>
              Boolean(item) &&
              typeof item.email === 'string' &&
              typeof item.updatedAt === 'number',
          )
          .map((item) => ({
            email: normalizeLoginEmail(item.email),
            rememberedPassword:
              typeof item.rememberedPassword === 'string'
                ? item.rememberedPassword
                : null,
            updatedAt: item.updatedAt,
          }))
          .filter((item) => item.email)
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, MAX_LOGIN_ACCOUNTS)
      : [];

    return {
      lastEmail:
        typeof parsed.lastEmail === 'string'
          ? normalizeLoginEmail(parsed.lastEmail)
          : '',
      accounts,
    };
  } catch {
    return emptyLoginMemory();
  }
}

function persistLoginMemory(state: LoginMemoryState) {
  if (!isBrowser()) return;
  localStorage.setItem(LOGIN_MEMORY_KEY, JSON.stringify(state));
}

export function findLoginMemoryAccount(
  accounts: LoginMemoryAccount[],
  email: string,
) {
  const normalized = normalizeLoginEmail(email);
  return accounts.find((account) => account.email === normalized);
}

export function saveLoginMemory(params: {
  email: string;
  password: string;
  rememberPassword: boolean;
}) {
  const normalizedEmail = normalizeLoginEmail(params.email);
  if (!normalizedEmail) return loadLoginMemory();

  const current = loadLoginMemory();
  const nextAccount: LoginMemoryAccount = {
    email: normalizedEmail,
    rememberedPassword: params.rememberPassword ? params.password : null,
    updatedAt: Date.now(),
  };
  const accounts = [
    nextAccount,
    ...current.accounts.filter((account) => account.email !== normalizedEmail),
  ].slice(0, MAX_LOGIN_ACCOUNTS);
  const nextState: LoginMemoryState = {
    lastEmail: normalizedEmail,
    accounts,
  };

  persistLoginMemory(nextState);
  return nextState;
}