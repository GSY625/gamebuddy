import { ApiError, fetchWithSessionRetry, notifyAuthFailure, parseErrorPayload, request } from './core';

export const accountApi = {
getMe: () => request('/users/me'),
  getUser: (id: string) =>
    request<{
      id: string;
      nickname: string;
      avatarUrl?: string | null;
      bio?: string | null;
      isVip?: boolean;
      emailVerified?: boolean;
      online?: boolean;
    }>(`/users/${id}`),
  updateMe: (body: Record<string, unknown>) =>
    request('/users/me', { method: 'PUT', body: JSON.stringify(body) }),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    request<{ message: string }>('/users/me/password', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  setVisibility: (status: 'online' | 'invisible') =>
    request('/users/me/visibility', {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
  checkNickname: (nickname: string, excludeUserId?: string) => {
    const q = new URLSearchParams({ nickname });
    if (excludeUserId) q.set('excludeUserId', excludeUserId);
    return request<{ available: boolean; message?: string }>(
      `/users/check-nickname?${q}`,
    );
  },
  getGames: () =>
    request<
      Array<{
        id: string;
        slug: string;
        name: string;
        icon: string;
        platform: 'pc' | 'mobile' | 'both';
        tags: string[];
      }>
    >('/games'),
  getGameSchema: (id: string) => request(`/games/${id}/schema`),
  listMyProfiles: (gameId: string) =>
    request(`/users/me/game-profiles/${gameId}/list`),
  createProfile: (
    gameId: string,
    body: {
      name: string;
      fieldValues: Record<string, unknown>;
      publishToSquare?: boolean;
    },
  ) =>
    request(`/users/me/game-profiles/${gameId}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getProfileScheme: (profileId: string) =>
    request(`/users/me/game-profiles/schemes/${profileId}`),
  updateProfileScheme: (
    profileId: string,
    body: { name?: string; fieldValues?: Record<string, unknown> },
  ) =>
    request(`/users/me/game-profiles/schemes/${profileId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteProfileScheme: (profileId: string) =>
    request(`/users/me/game-profiles/schemes/${profileId}`, {
      method: 'DELETE',
    }),
  publishProfileScheme: (profileId: string) =>
    request(`/users/me/game-profiles/schemes/${profileId}/publish`, {
      method: 'PUT',
    }),
  unpublishProfileScheme: (profileId: string) =>
    request(`/users/me/game-profiles/schemes/${profileId}/unpublish`, {
      method: 'PUT',
    }),
  searchProfiles: (
    gameId: string,
    filters?: { rank?: string; mode?: string; region?: string },
  ) => {
    const q = new URLSearchParams({ gameId });
    if (filters?.rank) q.set('rank', filters.rank);
    if (filters?.mode) q.set('mode', filters.mode);
    if (filters?.region) q.set('region', filters.region);
    return request(`/game-profiles?${q}`);
  },
  uploadImage: async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetchWithSessionRetry('/upload/image', {
      method: 'POST',
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      const { text, retryAfterSeconds } = parseErrorPayload(err);
      if (res.status === 401) {
        notifyAuthFailure(text || '请求失败');
      }
      throw new ApiError(text || '上传失败', retryAfterSeconds);
    }
    return res.json() as Promise<{ url: string }>;
  }
};
