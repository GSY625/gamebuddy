const DEFAULT_LOCAL_SERVER = 'http://localhost:3000';

type ViteEnvShape = {
  PROD?: boolean;
  VITE_WS_URL?: string;
};

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

function readEnv() {
  return (import.meta as ImportMeta & { env?: ViteEnvShape }).env ?? {};
}

function resolveWsUrl() {
  const env = readEnv();
  const configured = env.VITE_WS_URL?.trim();
  if (!env.PROD) {
    return configured ? normalizeUrl(configured) : DEFAULT_LOCAL_SERVER;
  }

  if (!configured) {
    throw new Error('生产环境缺少 VITE_WS_URL，前端已停止启动');
  }

  const url = parsePublicUrl('VITE_WS_URL', configured);
  if (isLocalHostname(url.hostname)) {
    throw new Error('生产环境的 VITE_WS_URL 不能指向 localhost 或本机地址');
  }

  return normalizeUrl(configured);
}

export const WS_URL = resolveWsUrl();
