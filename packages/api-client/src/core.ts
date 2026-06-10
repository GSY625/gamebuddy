type ViteEnvShape = {
  PROD?: boolean;
  VITE_API_URL?: string;
};

const DEFAULT_LOCAL_API_BASE = '/api';
const FALLBACK_LOCAL_API_BASE = 'http://localhost:3000';

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

function parsePublicUrl(name: string, value: string) {
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

function normalizeUrl(value: string) {
  return value.replace(/\/+$/, '');
}

function normalizeDevApiBase(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_LOCAL_API_BASE;
  }

  if (trimmed.startsWith('/')) {
    return normalizeUrl(trimmed);
  }

  const url = parsePublicUrl('VITE_API_URL', trimmed);
  return normalizeUrl(url.toString());
}

function uniqueBases(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function resolveApiBases() {
  const env =
    (import.meta as ImportMeta & { env?: ViteEnvShape }).env ?? {};
  const configured = env.VITE_API_URL?.trim();

  if (!env.PROD) {
    const primary = configured
      ? normalizeDevApiBase(configured)
      : DEFAULT_LOCAL_API_BASE;
    const secondary =
      primary === DEFAULT_LOCAL_API_BASE
        ? FALLBACK_LOCAL_API_BASE
        : DEFAULT_LOCAL_API_BASE;
    return uniqueBases([primary, secondary]);
  }

  if (!configured) {
    throw new Error('生产环境缺少 VITE_API_URL，前端已停止启动');
  }

  if (configured.startsWith('/')) {
    return [normalizeUrl(configured)];
  }

  const url = parsePublicUrl('VITE_API_URL', configured);
  if (isLocalHostname(url.hostname)) {
    throw new Error('生产环境的 VITE_API_URL 不能指向 localhost 或本机地址');
  }

  return [normalizeUrl(configured)];
}

const API_BASES = resolveApiBases();
const API_BASE = API_BASES[0];

function buildRequestUrl(base: string, path: string) {
  return `${base}${path}`;
}

export type TokenStorage = {
  get: () => string | null;
  set: (token: string) => void;
  clear: () => void;
};

let inMemoryToken: string | null = null;
const AUTH_FAILURE_MESSAGES = new Set(['账号已被封禁', '登录状态已失效，请重新登录']);
const authFailureListeners = new Set<(message: string) => void>();

let storage: TokenStorage = {
  get: () => inMemoryToken,
  set: (token: string) => {
    inMemoryToken = token;
  },
  clear: () => {
    inMemoryToken = null;
  },
};

export function configureAuth(s: TokenStorage) {
  storage = s;
}

export function getToken() {
  return storage.get();
}

export function subscribeAuthFailure(listener: (message: string) => void) {
  authFailureListeners.add(listener);
  return () => {
    authFailureListeners.delete(listener);
  };
}

function notifyAuthFailure(message: string) {
  if (!AUTH_FAILURE_MESSAGES.has(message)) {
    return;
  }

  authFailureListeners.forEach((listener) => {
    try {
      listener(message);
    } catch {
      // noop
    }
  });
}

function storeAccessToken(token: string) {
  storage.set(token);
}

function clearAccessToken() {
  storage.clear();
}

export class ApiError extends Error {
  retryAfterSeconds?: number;

  constructor(message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = 'ApiError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function parseErrorPayload(err: {
  message?: unknown;
  retryAfterSeconds?: number;
}) {
  const msg = err.message;
  if (msg && typeof msg === 'object' && !Array.isArray(msg)) {
    const nested = msg as { message?: unknown; retryAfterSeconds?: number };
    const text = Array.isArray(nested.message)
      ? nested.message.join('; ')
      : typeof nested.message === 'string'
        ? nested.message
        : undefined;
    return {
      text: text ?? '请求失败',
      retryAfterSeconds:
        typeof nested.retryAfterSeconds === 'number'
          ? nested.retryAfterSeconds
          : err.retryAfterSeconds,
    };
  }
  const text = Array.isArray(msg)
    ? msg.join('; ')
    : typeof msg === 'string'
      ? msg
      : undefined;
  return {
    text: text ?? '请求失败',
    retryAfterSeconds:
      typeof err.retryAfterSeconds === 'number'
        ? err.retryAfterSeconds
        : undefined,
  };
}

type RequestMeta = {
  retryOn401?: boolean;
  includeAuthHeader?: boolean;
  allowRefresh?: boolean;
};

let refreshPromise: Promise<string | null> | null = null;

function shouldAttemptRefresh(path: string, meta: RequestMeta) {
  if (meta.retryOn401 === false || meta.allowRefresh === false) {
    return false;
  }

  return ![
    '/auth/captcha',
    '/auth/send-code',
    '/auth/register',
    '/auth/login',
    '/auth/reset-password',
    '/auth/refresh',
    '/auth/logout',
  ].includes(path);
}

function buildHeaders(options: RequestInit, includeAuthHeader: boolean) {
  const headers = new Headers(options.headers as HeadersInit | undefined);
  const token = storage.get();

  if (
    options.body !== undefined &&
    !(options.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  if (includeAuthHeader && token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return headers;
}

async function fetchWithSessionRetry(
  path: string,
  options: RequestInit = {},
  meta: RequestMeta = {},
) {
  const response = await fetchWithApiBases(path, options, meta);

  if (response.status !== 401 || !shouldAttemptRefresh(path, meta)) {
    return response;
  }

  const refreshedToken = await refreshAccessToken();
  if (!refreshedToken) {
    clearAccessToken();
    return response;
  }

  return fetchWithApiBases(path, options, meta);
}

async function fetchWithApiBases(
  path: string,
  options: RequestInit = {},
  meta: RequestMeta = {},
) {
  const headers = buildHeaders(options, meta.includeAuthHeader !== false);
  let lastError: unknown;

  for (const base of API_BASES) {
    try {
      return await fetch(buildRequestUrl(base, path), {
        ...options,
        credentials: 'include',
        headers,
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('无法连接服务器，请确认后端已启动');
}

async function refreshAccessToken() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetchWithSessionRetry(
        '/auth/refresh',
        { method: 'POST' },
        {
          retryOn401: false,
          includeAuthHeader: false,
          allowRefresh: false,
        },
      );

      if (!response.ok) {
        clearAccessToken();
        return null;
      }

      const data = (await response.json()) as { accessToken: string };
      storeAccessToken(data.accessToken);
      return data.accessToken;
    } catch {
      clearAccessToken();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  meta: RequestMeta = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetchWithSessionRetry(path, options, meta);
  } catch (error) {
    throw new ApiError(
      error instanceof Error && error.message
        ? `无法连接服务器，请确认后端已启动：${error.message}`
        : '无法连接服务器，请确认后端已启动',
    );
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    const { text, retryAfterSeconds } = parseErrorPayload(err);
    if (res.status === 401) {
      notifyAuthFailure(text || '请求失败');
    }
    throw new ApiError(text || 'Request failed', retryAfterSeconds);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export {
  API_BASE,
  clearAccessToken,
  fetchWithSessionRetry,
  notifyAuthFailure,
  parseErrorPayload,
  request,
  storeAccessToken,
};
