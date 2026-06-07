const API_BASE =
  (import.meta as ImportMeta & { env?: { VITE_API_URL?: string } }).env
    ?.VITE_API_URL ?? 'http://localhost:3000';

export type TokenStorage = {
  get: () => string | null;
  set: (token: string) => void;
  clear: () => void;
};

let storage: TokenStorage = {
  get: () => localStorage.getItem('gb_token'),
  set: (t) => localStorage.setItem('gb_token', t),
  clear: () => localStorage.removeItem('gb_token'),
};

export function configureAuth(s: TokenStorage) {
  storage = s;
}

export function getToken() {
  return storage.get();
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

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  const token = storage.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    const { text, retryAfterSeconds } = parseErrorPayload(err);
    throw new ApiError(text || '请求失败', retryAfterSeconds);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getCaptcha: () => request<{ captchaId: string; image: string }>('/auth/captcha'),
  sendCode: (body: { email: string; captchaId: string; captchaCode: string }) =>
    request('/auth/send-code', { method: 'POST', body: JSON.stringify(body) }),
  register: (body: { email: string; password: string; nickname: string; code: string }) =>
    request<{ accessToken: string; user: { id: string; email: string; nickname: string } }>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify(body) },
    ),
  login: (body: { email: string; password: string }) =>
    request<{ accessToken: string; user: { id: string; email: string; nickname: string } }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify(body) },
    ),
  resetPassword: (body: { email: string; code: string; password: string }) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getMe: () => request('/users/me'),
  getUser: (id: string) =>
    request<{
      id: string;
      nickname: string;
      avatarUrl?: string | null;
      bio?: string | null;
      isVip?: boolean;
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
    const token = storage.get();
    const res = await fetch(`${API_BASE}/upload/image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (!res.ok) throw new Error('上传失败');
    return res.json() as Promise<{ url: string }>;
  },
  createLfg: (body: Record<string, unknown>) =>
    request('/lfg-posts', { method: 'POST', body: JSON.stringify(body) }),
  updateLfg: (
    id: string,
    body: { title?: string; description?: string; mode?: string },
  ) =>
    request(`/lfg-posts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  listLfg: (gameId?: string) =>
    request(`/lfg-posts${gameId ? `?gameId=${gameId}` : ''}`),
  myLfgApplications: () => request('/lfg-posts/my-applications'),
  applyLfg: (id: string, message?: string) =>
    request(`/lfg-posts/${id}/apply`, { method: 'POST', body: JSON.stringify({ message }) }),
  lfgApplications: (id: string) => request(`/lfg-posts/${id}/applications`),
  resolveLfgApp: (
    postId: string,
    appId: string,
    body: { accept: boolean; blockApplicant?: boolean },
  ) =>
    request(`/lfg-posts/${postId}/applications/${appId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteLfg: (id: string) => request(`/lfg-posts/${id}`, { method: 'DELETE' }),
  createInvite: (body: {
    receiverId: string;
    gameId?: string;
    partyId?: string;
    message?: string;
  }) =>
    request('/invites', { method: 'POST', body: JSON.stringify(body) }),
  receivedInvites: () => request('/invites/received'),
  sentInvites: () => request('/invites/sent'),
  resolveInvite: (id: string, accept: boolean) =>
    request(`/invites/${id}`, { method: 'PATCH', body: JSON.stringify({ accept }) }),
  createParty: (body?: { gameId?: string; name?: string }) =>
    request<{ id: string; chatRoom?: { id: string; roomCode?: string; name?: string } }>(
      '/parties',
      { method: 'POST', body: JSON.stringify(body ?? {}) },
    ),
  listParties: () => request('/parties'),
  getParty: (id: string) =>
    request<{
      id: string;
      voiceHint?: string | null;
      maxMembers?: number | null;
      members: Array<{ userId: string; role: string }>;
      chatRoom?: { id: string; roomCode?: string | null; name?: string | null };
    }>(`/parties/${id}`),
  setVoiceHint: (id: string, voiceHint: string) =>
    request(`/parties/${id}/voice-hint`, {
      method: 'PATCH',
      body: JSON.stringify({ voiceHint }),
    }),
  setRoomName: (partyId: string, name: string) =>
    request(`/parties/${partyId}/room-name`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),
  setPartyMemberLimit: (partyId: string, maxMembers: number | null) =>
    request(`/parties/${partyId}/member-limit`, {
      method: 'PATCH',
      body: JSON.stringify({ maxMembers }),
    }),
  leaveParty: (partyId: string) =>
    request(`/parties/${partyId}/leave`, { method: 'POST' }),
  dissolveParty: (partyId: string) =>
    request(`/parties/${partyId}/dissolve`, { method: 'POST' }),
  getRoomMeta: (roomId: string) =>
    request<{
      room: { id: string; roomCode: string | null; name: string | null };
      party: {
        id: string;
        gameId?: string | null;
        status?: string;
        maxMembers?: number | null;
      };
      members: Array<{
        userId: string;
        role: string;
        isLeader: boolean;
        presenceStatus?: 'online' | 'invisible' | 'offline';
        user: { id: string; nickname: string; avatarUrl?: string | null };
      }>;
      leaderId: string | null;
      isLeader: boolean;
    }>(`/rooms/${roomId}/meta`),
  getMessages: (roomId: string, cursor?: string) =>
    request(`/rooms/${roomId}/messages${cursor ? `?cursor=${cursor}` : ''}`),
  searchUsers: (q: string) =>
    request<Array<{ id: string; nickname: string; avatarUrl?: string }>>(
      `/search/users?q=${encodeURIComponent(q)}`,
    ),
  searchRoom: (code: string) =>
    request<{
      roomId: string;
      roomCode: string;
      name: string | null;
      partyId: string;
      leaderNickname?: string;
      memberCount: number;
    } | null>(`/search/rooms?code=${encodeURIComponent(code)}`),
  listFriends: () =>
    request<
      Array<{
        id: string;
        friend: { id: string; nickname: string; avatarUrl?: string };
      }>
    >('/friends'),
  listFriendRequests: () =>
    request<
      Array<{
        id: string;
        sender: { id: string; nickname: string; avatarUrl?: string };
      }>
    >('/friends/requests/received'),
  sendFriendRequest: (receiverId: string) =>
    request('/friends/requests', {
      method: 'POST',
      body: JSON.stringify({ receiverId }),
    }),
  resolveFriendRequest: (id: string, accept: boolean) =>
    request(`/friends/requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ accept }),
    }),
  removeFriend: (friendId: string) =>
    request(`/friends/${friendId}`, { method: 'DELETE' }),
  friendStatus: (otherId: string) =>
    request<{
      status:
        | 'self'
        | 'friends'
        | 'none'
        | 'pending_sent'
        | 'pending_received';
      requestId?: string;
    }>(`/friends/status/${otherId}`),
  listDirectConversations: () =>
    request<
      Array<{
        threadId: string;
        friend: { id: string; nickname: string; avatarUrl?: string | null };
        unreadCount: number;
        createdAt: string;
        lastMessageAt: string;
        lastMessage: {
          id: string;
          content: string;
          createdAt: string;
          senderId: string;
          sender: { id: string; nickname: string; avatarUrl?: string | null };
        } | null;
      }>
    >('/direct-messages'),
  getDirectConversation: (friendId: string) =>
    request<{
      threadId: string;
      friend: { id: string; nickname: string; avatarUrl?: string | null };
      unreadCount: number;
      createdAt: string;
      lastMessageAt: string;
      lastMessage: {
        id: string;
        content: string;
        createdAt: string;
        senderId: string;
        sender: { id: string; nickname: string; avatarUrl?: string | null };
      } | null;
    }>(`/direct-messages/with/${friendId}`),
  getDirectMessages: (friendId: string, cursor?: string) =>
    request<
      Array<{
        id: string;
        content: string;
        createdAt: string;
        senderId: string;
        sender: { id: string; nickname: string; avatarUrl?: string | null };
      }>
    >(`/direct-messages/with/${friendId}/messages${cursor ? `?cursor=${cursor}` : ''}`),
  markDirectConversationRead: (friendId: string) =>
    request(`/direct-messages/with/${friendId}/read`, { method: 'POST' }),
  adminOverview: () =>
    request<{
      metrics: {
        pendingReports: number;
        totalReports: number;
        reviewedToday: number;
        bannedUsers: number;
        adminUsers: number;
        activeRestrictions: number;
      };
      recentActions: Array<{
        id: string;
        action: string;
        targetType: string;
        targetId?: string | null;
        note?: string | null;
        createdAt: string;
        actor: { id: string; nickname: string; role: string };
      }>;
    }>('/admin/overview'),
  adminListReports: (status?: string) =>
    request<
      Array<{
        id: string;
        reason: string;
        detail?: string | null;
        targetType?: string | null;
        targetId?: string | null;
        reviewStatus: string;
        actionTaken?: string | null;
        createdAt: string;
        reviewedAt?: string | null;
        reporter: { id: string; nickname: string; email: string };
        reported: {
          id: string;
          nickname: string;
          email: string;
          role: string;
          isBanned: boolean;
        };
        reviewer?: { id: string; nickname: string; role: string } | null;
      }>
    >(`/admin/reports${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  adminGetReport: (id: string) =>
    request<{
      id: string;
      reason: string;
      detail?: string | null;
      targetType?: string | null;
      targetId?: string | null;
      reviewStatus: string;
      actionTaken?: string | null;
      reviewNote?: string | null;
      createdAt: string;
      reviewedAt?: string | null;
      reporter: { id: string; nickname: string; email: string };
      reported: {
        id: string;
        nickname: string;
        email: string;
        role: string;
        isBanned: boolean;
        createdAt: string;
      };
      reviewer?: { id: string; nickname: string; role: string } | null;
      targetContext?: unknown;
      recentReports: Array<{
        id: string;
        reason: string;
        detail?: string | null;
        reviewStatus: string;
        createdAt: string;
        reporter: { id: string; nickname: string };
      }>;
    }>(`/admin/reports/${id}`),
  adminReviewReport: (
    id: string,
    body: {
      reviewStatus: 'resolved' | 'rejected';
      actionTaken?: 'none' | 'ban' | 'hide_lfg';
      reviewNote?: string;
    },
  ) =>
    request(`/admin/reports/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  adminListUsers: (params?: { q?: string; banned?: string }) => {
    const q = new URLSearchParams();
    if (params?.q) q.set('q', params.q);
    if (params?.banned) q.set('banned', params.banned);
    const query = q.toString();
    return request<
      Array<{
        id: string;
        email: string;
        nickname: string;
        role: string;
        avatarUrl?: string | null;
        isVip: boolean;
        isBanned: boolean;
        createdAt: string;
        _count: { reportsAgainst: number; reportsFiled: number };
      }>
    >(`/admin/users${query ? `?${query}` : ''}`);
  },
  adminGetUser: (id: string) =>
    request<{
      id: string;
      email: string;
      nickname: string;
      role: string;
      avatarUrl?: string | null;
      bio?: string | null;
      isVip: boolean;
      isBanned: boolean;
      createdAt: string;
      _count: {
        reportsAgainst: number;
        reportsFiled: number;
        friendshipsAsUser: number;
        friendshipsAsFriend: number;
      };
      reportsAgainst: Array<{
        id: string;
        reason: string;
        detail?: string | null;
        reviewStatus: string;
        createdAt: string;
        reporter: { id: string; nickname: string };
        reviewer?: { id: string; nickname: string } | null;
      }>;
      reportsFiled: Array<{
        id: string;
        reason: string;
        detail?: string | null;
        reviewStatus: string;
        createdAt: string;
        reported: { id: string; nickname: string };
      }>;
      actionLogs: Array<{
        id: string;
        action: string;
        targetType: string;
        targetId?: string | null;
        note?: string | null;
        createdAt: string;
        actor: { id: string; nickname: string; role: string };
      }>;
      restrictions: Array<{
        id: string;
        type: 'invite' | 'direct_message' | 'lfg' | 'chat';
        active: boolean;
        note?: string | null;
        createdAt: string;
        updatedAt: string;
      }>;
      lfgPosts: Array<{
        id: string;
        title: string;
        description?: string | null;
        status: string;
        createdAt: string;
        game: { id: string; name: string; icon: string };
      }>;
    }>(`/admin/users/${id}`),
  adminSetUserBan: (id: string, body: { banned: boolean; note?: string }) =>
    request(`/admin/users/${id}/ban`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  adminSetUserRestriction: (
    id: string,
    body: {
      type: 'invite' | 'direct_message' | 'lfg' | 'chat';
      enabled: boolean;
      note?: string;
    },
  ) =>
    request(`/admin/users/${id}/restrictions`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  adminActionLogs: (limit?: number) =>
    request<
      Array<{
        id: string;
        action: string;
        targetType: string;
        targetId?: string | null;
        note?: string | null;
        createdAt: string;
        actor: { id: string; nickname: string; role: string };
      }>
    >(`/admin/action-logs${limit ? `?limit=${limit}` : ''}`),
  report: (body: {
    reportedId: string;
    reason: string;
    detail?: string;
    targetType?: string;
    targetId?: string;
  }) =>
    request('/safety/reports', { method: 'POST', body: JSON.stringify(body) }),
  block: (blockedId: string) =>
    request('/safety/blocks', { method: 'POST', body: JSON.stringify({ blockedId }) }),
  listBlocks: () =>
    request<
      Array<{
        id: string;
        blockedId: string;
        blocked: { id: string; nickname: string };
      }>
    >('/safety/blocks'),
  unblock: (blockedId: string) =>
    request(`/safety/blocks/${blockedId}`, { method: 'DELETE' }),
  listNotifications: () =>
    request<
      Array<{
        id: string;
        type: string;
        title: string;
        message: string;
        link?: string | null;
        read: boolean;
        createdAt: string;
      }>
    >('/notifications'),
  notificationUnreadCount: () =>
    request<{ count: number }>('/notifications/unread-count'),
  markNotificationRead: (id: string) =>
    request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () =>
    request('/notifications/read-all', { method: 'PATCH' }),
  deleteNotification: (id: string) =>
    request(`/notifications/${id}`, { method: 'DELETE' }),
  markRoomRead: (roomId: string) =>
    request(`/rooms/${roomId}/read`, { method: 'POST' }),
  getRoomUnreadCount: (roomId: string) =>
    request<{ count: number }>(`/rooms/${roomId}/unread-count`),
  getPendingMention: (roomId: string) =>
    request<{ messageId: string | null }>(`/rooms/${roomId}/pending-mention`),
};

export { API_BASE };
