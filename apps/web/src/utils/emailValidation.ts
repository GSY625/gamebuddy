const COMMON_EMAIL_DOMAINS = [
  'qq.com',
  'gmail.com',
  'outlook.com',
  'hotmail.com',
  '163.com',
  '126.com',
  'foxmail.com',
  'yeah.net',
  'icloud.com',
];

const EMAIL_PATTERN = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

function levenshtein(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, () =>
    Array<number>(b.length + 1).fill(0),
  );

  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[a.length][b.length];
}

function suggestDomain(domain: string) {
  let best: string | null = null;
  let bestDistance = Infinity;

  for (const candidate of COMMON_EMAIL_DOMAINS) {
    const distance = levenshtein(domain, candidate);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return bestDistance <= 2 ? best : null;
}

export function validateEmailInput(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return { ok: false as const, message: '请先输入邮箱' };
  }

  const parts = normalized.split('@');
  if (parts.length !== 2) {
    return { ok: false as const, message: '邮箱格式不正确' };
  }

  const [localPart, domain] = parts;
  if (!localPart || !domain) {
    return { ok: false as const, message: '邮箱格式不正确' };
  }

  if (normalized.includes('..')) {
    return { ok: false as const, message: '邮箱格式不正确' };
  }

  if (domain.startsWith('.') || domain.endsWith('.')) {
    return { ok: false as const, message: '邮箱域名格式不正确' };
  }

  if (!domain.includes('.')) {
    return {
      ok: false as const,
      message: '邮箱域名不完整，请检查是否少写了 .com 等后缀',
    };
  }

  if (!EMAIL_PATTERN.test(normalized)) {
    return { ok: false as const, message: '邮箱格式不正确' };
  }

  const suggestedDomain = suggestDomain(domain);
  if (suggestedDomain && suggestedDomain !== domain) {
    return {
      ok: false as const,
      message: `邮箱后缀可能写错了，你是不是想写 ${localPart}@${suggestedDomain}？`,
    };
  }

  return { ok: true as const, normalized };
}
