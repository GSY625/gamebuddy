import type { FriendListItem, Member, Msg, RoomMeta } from './chatTypes';

export type PresenceUpdatePayload = {
  userId: string;
  online?: boolean;
  visibility?: 'online' | 'invisible';
};

export function patchMemberPresence(
  members: Member[],
  payload: PresenceUpdatePayload,
  viewerId?: string,
): Member[] {
  return members.map((member) => {
    if (member.userId !== payload.userId) return member;

    const isSelf = member.userId === viewerId;
    if (payload.online === false) {
      return { ...member, presenceStatus: 'offline' };
    }
    if (payload.visibility === 'invisible') {
      return { ...member, presenceStatus: isSelf ? 'invisible' : 'offline' };
    }
    if (payload.visibility === 'online' || payload.online === true) {
      return { ...member, presenceStatus: 'online' };
    }
    return member;
  });
}

export function getMentionFilter(text: string) {
  const match = text.match(/@([^\s@]*)$/);
  return match ? match[0] : null;
}

export function sanitizeMemberLimitInput(value: string) {
  return value.replace(/\D/g, '').slice(0, 2);
}

export function isPartyFull(meta: RoomMeta | null) {
  return (
    typeof meta?.party.maxMembers === 'number' &&
    meta.members.length >= meta.party.maxMembers
  );
}

export function getInvitableFriends(
  friends: FriendListItem[],
  meta: Pick<RoomMeta, 'members'> | null,
) {
  const memberIds = new Set(meta?.members.map((member) => member.userId) ?? []);
  return friends.filter((friend) => !memberIds.has(friend.friend.id));
}

export function shouldRefreshMetaForMessage(message: Msg) {
  return message.type === 'system' && message.content.includes('加入了聊天室');
}

export function shouldMarkMentionForMessage(
  message: Msg,
  currentUser?: { id?: string; nickname?: string | null } | null,
) {
  return Boolean(
    currentUser?.nickname &&
      message.user?.id !== currentUser.id &&
      message.content.includes(`@${currentUser.nickname}`),
  );
}
