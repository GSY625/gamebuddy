import { request } from './core';

export const adminApi = {
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
  adminAiStats: () =>
    request<{
      todayCalls: number;
      totalCalls: number;
      sceneCounts: Record<string, number>;
      successRate: number;
      failedCalls: number;
      averageLatencyMs: number;
      modelDistribution: Record<string, number>;
      matchFeedback: {
        total: number;
        suitable: number;
        unsuitable: number;
        ignored: number;
        pending: number;
      };
      moderationSuggestions: {
        total: number;
        adopted: number;
        ignored: number;
        pending: number;
      };
    }>('/admin/ai/stats'),
  adminMarkAiModerationSuggestionAction: (
    reportId: string,
    body: { adminAction: 'adopted' | 'ignored' },
  ) =>
    request<{ ok: true }>(`/admin/ai/moderation-suggestions/${reportId}/action`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
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
        refId?: string | null;
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
  deleteAllNotifications: () =>
    request('/notifications', { method: 'DELETE' }),
  markRoomRead: (roomId: string) =>
    request(`/rooms/${roomId}/read`, { method: 'POST' }),
  getRoomUnreadCount: (roomId: string) =>
    request<{ count: number }>(`/rooms/${roomId}/unread-count`),
  getPendingMention: (roomId: string) =>
    request<{ messageId: string | null }>(`/rooms/${roomId}/pending-mention`)
};
