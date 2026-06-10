export type Msg = {
  id: string;
  content: string;
  type: string;
  createdAt: string;
  user?: { id?: string; nickname: string };
};

export type PresenceStatus = 'online' | 'invisible' | 'offline';

export type Member = {
  userId: string;
  role: string;
  isLeader: boolean;
  presenceStatus?: PresenceStatus;
  user: { id: string; nickname: string; avatarUrl?: string | null };
};

export type RoomMeta = {
  room: { id: string; roomCode: string | null; name: string | null };
  party: { id: string; maxMembers?: number | null };
  members: Member[];
  leaderId: string | null;
  isLeader: boolean;
};

export type FriendStatusMap = Record<
  string,
  { status: string; requestId?: string }
>;

export type ChatAlert = {
  title?: string;
  message: string;
};

export type ChatToast = {
  title: string;
  message: string;
};

export type FriendListItem = {
  id: string;
  friend: { id: string; nickname: string; avatarUrl?: string };
};
