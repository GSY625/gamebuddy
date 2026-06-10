import { api } from '@gamebuddy/api-client';

export type DirectConversation = {
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
};

export type DirectMessage = {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
  sender: { id: string; nickname: string; avatarUrl?: string | null };
};

export type DirectConversationDetailCache = {
  conversation: DirectConversation;
  messages: DirectMessage[];
};

let directConversationsCache: DirectConversation[] | null = null;
const directConversationDetailCache = new Map<string, DirectConversationDetailCache>();
const directConversationPrefetches = new Map<
  string,
  Promise<DirectConversationDetailCache>
>();

export function getCachedDirectConversations() {
  return directConversationsCache;
}

export function setCachedDirectConversations(rows: DirectConversation[]) {
  directConversationsCache = rows;
}

export function getCachedDirectConversationDetail(friendId: string) {
  return directConversationDetailCache.get(friendId) ?? null;
}

export function hasCachedDirectConversationDetail(friendId: string) {
  return directConversationDetailCache.has(friendId);
}

export function setCachedDirectConversationDetail(
  friendId: string,
  detail: DirectConversationDetailCache,
) {
  directConversationDetailCache.set(friendId, detail);
}

export function updateCachedDirectConversationMessages(
  friendId: string,
  updater: (messages: DirectMessage[]) => DirectMessage[],
) {
  const detail = directConversationDetailCache.get(friendId);
  if (!detail) return null;

  const next = { ...detail, messages: updater(detail.messages) };
  directConversationDetailCache.set(friendId, next);
  return next;
}

export async function prefetchDirectConversation(friendId: string) {
  const cached = directConversationDetailCache.get(friendId);
  if (cached) return cached;

  const inFlight = directConversationPrefetches.get(friendId);
  if (inFlight) return inFlight;

  const request = Promise.all([
    api.getDirectConversation(friendId),
    api.getDirectMessages(friendId),
  ])
    .then(([conversation, rows]) => {
      const detail = {
        conversation: conversation as DirectConversation,
        messages: [...(rows as DirectMessage[])].reverse(),
      };
      directConversationDetailCache.set(friendId, detail);
      return detail;
    })
    .finally(() => {
      directConversationPrefetches.delete(friendId);
    });

  directConversationPrefetches.set(friendId, request);
  return request;
}

export function warmDirectConversationDetails(conversations: DirectConversation[]) {
  void Promise.allSettled(
    conversations.map((conversation) => prefetchDirectConversation(conversation.friend.id)),
  );
}
