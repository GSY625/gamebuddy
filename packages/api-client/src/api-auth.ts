import { clearAccessToken, request, storeAccessToken } from './core';

export const authApi = {
getCaptcha: () => request<{ captchaId: string; image: string }>('/auth/captcha'),
  sendCode: (body: { email: string; captchaId: string; captchaCode: string }) =>
    request('/auth/send-code', { method: 'POST', body: JSON.stringify(body) }),
  register: async (body: {
    email: string;
    password: string;
    nickname: string;
    code: string;
  }) => {
    const result = await request<{
      accessToken: string;
      user: { id: string; email: string; nickname: string; role?: string };
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    storeAccessToken(result.accessToken);
    return result;
  },
  login: async (body: { email: string; password: string }) => {
    const result = await request<{
      accessToken: string;
      user: { id: string; email: string; nickname: string; role?: string };
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    storeAccessToken(result.accessToken);
    return result;
  },
  refreshSession: async () => {
    const result = await request<{
      accessToken: string;
      user: { id: string; email: string; nickname: string; role?: string };
    }>(
      '/auth/refresh',
      { method: 'POST' },
      { retryOn401: false, includeAuthHeader: false, allowRefresh: false },
    );
    storeAccessToken(result.accessToken);
    return result;
  },
  logout: async () => {
    try {
      await request<{ message: string }>(
        '/auth/logout',
        { method: 'POST' },
        { retryOn401: false, includeAuthHeader: false, allowRefresh: false },
      );
    } finally {
      clearAccessToken();
    }
  },
  resetPassword: (body: { email: string; code: string; password: string }) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(body),
    })
};
