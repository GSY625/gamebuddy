import { request } from './core';

export const socialApi = {
createLfg: (body: {
    gameId: string;
    title: string;
    description?: string;
    mode?: string;
    voiceMode?: string;
    playStyle?: string;
    timeNote?: string;
    genderPreference?: string;
  }) =>
    request('/lfg-posts', { method: 'POST', body: JSON.stringify(body) }),
  updateLfg: (
    id: string,
    body: {
      title?: string;
      description?: string;
      mode?: string;
      voiceMode?: string;
      playStyle?: string;
      timeNote?: string;
      genderPreference?: string;
    },
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
        since: string;
        presenceStatus: 'online' | 'invisible' | 'offline';
        lastMessageAt?: string | null;
        lastMessagePreview?: string | null;
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
    request(`/direct-messages/with/${friendId}/read`, { method: 'POST' })
};
