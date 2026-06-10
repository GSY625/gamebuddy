import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { api, getToken } from '@gamebuddy/api-client';
import { useAuth } from '../context/AuthContext';
import { useOnlineGuard } from './useOnlineGuard';
import {
  getInvitableFriends,
  getMentionFilter,
  isPartyFull,
  patchMemberPresence,
  shouldMarkMentionForMessage,
  shouldRefreshMetaForMessage,
} from '../pages/chatRoomUtils';
import type {
  ChatAlert,
  ChatToast,
  FriendListItem,
  FriendStatusMap,
  Msg,
  RoomMeta,
} from '../pages/chatTypes';
import { WS_URL } from '../utils/runtimeEnv';

type UseChatRoomStateResult = {
  meta: RoomMeta | null;
  messages: Msg[];
  text: string;
  setText: Dispatch<SetStateAction<string>>;
  voiceHint: string;
  setVoiceHint: Dispatch<SetStateAction<string>>;
  roomNameEdit: string;
  setRoomNameEdit: Dispatch<SetStateAction<string>>;
  memberLimitEdit: string;
  setMemberLimitEdit: Dispatch<SetStateAction<string>>;
  loading: boolean;
  confirmLeave: boolean;
  setConfirmLeave: Dispatch<SetStateAction<boolean>>;
  confirmDissolve: boolean;
  setConfirmDissolve: Dispatch<SetStateAction<boolean>>;
  actionLoading: boolean;
  alert: ChatAlert | null;
  setAlert: Dispatch<SetStateAction<ChatAlert | null>>;
  notifyToast: ChatToast | null;
  setNotifyToast: Dispatch<SetStateAction<ChatToast | null>>;
  friendStatus: FriendStatusMap;
  mentionFilter: string | null;
  mentionQuery: string;
  mentionScrollId: string | null;
  inviteOpen: boolean;
  setInviteOpen: Dispatch<SetStateAction<boolean>>;
  friendsLoading: boolean;
  invitableFriends: FriendListItem[];
  invitingId: string | null;
  refreshing: boolean;
  bottomRef: RefObject<HTMLDivElement | null>;
  messageRefs: RefObject<Map<string, HTMLDivElement>>;
  isPartyFull: boolean;
  pickMention: (nickname: string) => void;
  insertMention: (nickname: string) => void;
  scrollToMention: () => void;
  send: () => void;
  saveVoice: () => Promise<void>;
  saveRoomName: () => Promise<void>;
  saveMemberLimit: () => Promise<void>;
  doLeave: () => Promise<void>;
  doDissolve: () => Promise<void>;
  addFriend: (otherId: string) => Promise<void>;
  acceptFriendRequest: (
    otherId: string,
    requestId: string,
    nickname: string,
  ) => Promise<void>;
  copyCode: () => Promise<void>;
  refreshChat: () => Promise<void>;
  openInviteModal: () => void;
  inviteFriend: (friendId: string, nickname: string) => void;
};

export function useChatRoomState(roomId?: string): UseChatRoomStateResult {
  const nav = useNavigate();
  const { user, forceLogout } = useAuth();
  const { guard } = useOnlineGuard();
  const [meta, setMeta] = useState<RoomMeta | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [voiceHint, setVoiceHint] = useState('');
  const [roomNameEdit, setRoomNameEdit] = useState('');
  const [memberLimitEdit, setMemberLimitEdit] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDissolve, setConfirmDissolve] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [alert, setAlert] = useState<ChatAlert | null>(null);
  const [notifyToast, setNotifyToast] = useState<ChatToast | null>(null);
  const [friendStatus, setFriendStatus] = useState<FriendStatusMap>({});
  const [mentionScrollId, setMentionScrollId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const mentionFilter = getMentionFilter(text);
  const mentionQuery = mentionFilter ? mentionFilter.slice(1) : '';

  const loadMeta = useCallback(async () => {
    if (!roomId) return;

    const data = (await api.getRoomMeta(roomId)) as RoomMeta;
    setMeta(data);
    setRoomNameEdit(data.room.name ?? '');
    setMemberLimitEdit(
      typeof data.party.maxMembers === 'number' ? String(data.party.maxMembers) : '',
    );

    const membersToCheck = data.members.filter((member) => member.userId !== user?.id);
    const [party, statusEntries] = await Promise.all([
      api.getParty(data.party.id),
      Promise.all(
        membersToCheck.map(async (member) => {
          const status = await api.friendStatus(member.userId);
          return [member.userId, status] as const;
        }),
      ),
    ]);

    setVoiceHint(party.voiceHint ?? '');
    setFriendStatus(Object.fromEntries(statusEntries) as FriendStatusMap);
  }, [roomId, user?.id]);

  useEffect(() => {
    if (!roomId) return;

    setLoading(true);
    setMeta(null);
    setMessages([]);
    setVoiceHint('');
    setRoomNameEdit('');
    setMemberLimitEdit('');
    setFriendStatus({});
    setMentionScrollId(null);
    Promise.all([
      api.getPendingMention(roomId).then((result) => {
        if (result.messageId) setMentionScrollId(result.messageId);
      }),
      api.getMessages(roomId).then((roomMessages) => {
        setMessages([...(roomMessages as Msg[])].reverse());
      }),
      loadMeta(),
    ])
      .catch((err) => {
        setAlert({
          title: '无法进入',
          message: err instanceof Error ? err.message : '加载失败',
        });
      })
      .finally(() => setLoading(false));

    const socket = io(WS_URL, { auth: { token: getToken() } });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('room:join', { roomId });
    });
    socket.on('room:message', (message: Msg) => {
      setMessages((prev) => [...prev, message]);
      if (shouldRefreshMetaForMessage(message)) {
        void loadMeta();
      }
      if (shouldMarkMentionForMessage(message, user)) {
        setMentionScrollId(message.id);
      }
    });
    socket.on(
      'room:mention',
      (payload: { roomId: string; messageId: string }) => {
        if (payload.roomId === roomId) {
          setMentionScrollId(payload.messageId);
        }
      },
    );
    socket.on(
      'presence:update',
      (payload: {
        userId: string;
        online?: boolean;
        visibility?: 'online' | 'invisible';
      }) => {
        setMeta((prev) =>
          prev
            ? {
                ...prev,
                members: patchMemberPresence(prev.members, payload, user?.id),
              }
            : prev,
        );
      },
    );
    socket.on('user:notify', (payload: ChatToast) => {
      setNotifyToast({ title: payload.title, message: payload.message });
    });
    socket.on('user:banned', (payload: { message?: string }) => {
      forceLogout(payload.message ?? '账号已被封禁');
    });
    socket.on(
      'room:removed',
      (payload: { roomId: string; message?: string }) => {
        if (payload.roomId !== roomId) return;
        setAlert({
          title: '已退出聊天室',
          message: payload.message ?? '你已被移出当前聊天室',
        });
        setTimeout(() => nav('/parties', { replace: true }), 1800);
      },
    );
    socket.on('room:dissolved', () => {
      setAlert({ title: '聊天室已注销', message: '房主已注销聊天室' });
      setTimeout(() => nav('/parties', { replace: true }), 1800);
    });

    return () => {
      socket.disconnect();
    };
  }, [forceLogout, loadMeta, nav, roomId, user?.id, user?.nickname]);

  useEffect(() => {
    if (mentionScrollId) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mentionScrollId, messages]);

  const pickMention = useCallback((nickname: string) => {
    setText((current) => current.replace(/@([^\s@]*)$/, `@${nickname} `));
  }, []);

  const insertMention = useCallback((nickname: string) => {
    setText((current) => (current ? `${current} @${nickname} ` : `@${nickname} `));
  }, []);

  const scrollToMention = useCallback(() => {
    if (!mentionScrollId) return;
    const element = messageRefs.current.get(mentionScrollId);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setMentionScrollId(null);
  }, [mentionScrollId]);

  const send = useCallback(() => {
    if (!text.trim() || !socketRef.current || !roomId) return;
    socketRef.current.emit('room:message', { roomId, content: text });
    setText('');
  }, [roomId, text]);

  const saveVoice = useCallback(async () => {
    if (!meta?.isLeader) return;
    await api.setVoiceHint(meta.party.id, voiceHint);
    setNotifyToast({ title: '已保存', message: '语音说明已更新' });
  }, [meta, voiceHint]);

  const saveRoomName = useCallback(async () => {
    if (!meta?.isLeader) return;

    try {
      await api.setRoomName(meta.party.id, roomNameEdit);
      await loadMeta();
      setNotifyToast({ title: '已保存', message: '聊天室名称已更新' });
    } catch (err) {
      setAlert({ message: err instanceof Error ? err.message : '保存失败' });
    }
  }, [loadMeta, meta, roomNameEdit]);

  const saveMemberLimit = useCallback(async () => {
    if (!meta?.isLeader) return;

    const trimmed = memberLimitEdit.trim();
    if (!trimmed) {
      try {
        await api.setPartyMemberLimit(meta.party.id, null);
        await loadMeta();
        setNotifyToast({ title: '已保存', message: '已取消人数上限' });
      } catch (err) {
        setAlert({ message: err instanceof Error ? err.message : '保存失败' });
      }
      return;
    }

    const maxMembers = Number(trimmed);
    if (!Number.isInteger(maxMembers) || maxMembers < 2 || maxMembers > 99) {
      setAlert({ message: '人数上限需为 2 到 99 的整数，留空表示不限制' });
      return;
    }

    try {
      await api.setPartyMemberLimit(meta.party.id, maxMembers);
      await loadMeta();
      setNotifyToast({
        title: '已保存',
        message: `聊天室人数上限已更新为 ${maxMembers} 人`,
      });
    } catch (err) {
      setAlert({ message: err instanceof Error ? err.message : '保存失败' });
    }
  }, [loadMeta, memberLimitEdit, meta]);

  const doLeave = useCallback(async () => {
    if (!meta) return;

    setActionLoading(true);
    try {
      await api.leaveParty(meta.party.id);
      nav('/parties', { replace: true });
    } catch (err) {
      setAlert({ message: err instanceof Error ? err.message : '退出失败' });
    } finally {
      setActionLoading(false);
      setConfirmLeave(false);
    }
  }, [meta, nav]);

  const doDissolve = useCallback(async () => {
    if (!meta) return;

    setActionLoading(true);
    try {
      await api.dissolveParty(meta.party.id);
      nav('/parties', { replace: true });
    } catch (err) {
      setAlert({ message: err instanceof Error ? err.message : '注销失败' });
    } finally {
      setActionLoading(false);
      setConfirmDissolve(false);
    }
  }, [meta, nav]);

  const addFriend = useCallback(async (otherId: string) => {
    try {
      await api.sendFriendRequest(otherId);
      setFriendStatus((current) => ({
        ...current,
        [otherId]: { status: 'pending_sent' },
      }));
      setNotifyToast({ title: '已发送', message: '好友申请已发送' });
    } catch (err) {
      setAlert({ message: err instanceof Error ? err.message : '发送失败' });
    }
  }, []);

  const acceptFriendRequest = useCallback(
    async (otherId: string, requestId: string, nickname: string) => {
      try {
        await api.resolveFriendRequest(requestId, true);
        setFriendStatus((current) => ({
          ...current,
          [otherId]: { status: 'friends' },
        }));
        setNotifyToast({
          title: '已成为好友',
          message: `你和 ${nickname} 已成为好友`,
        });
      } catch (err) {
        setAlert({ message: err instanceof Error ? err.message : '操作失败' });
      }
    },
    [],
  );

  const copyCode = useCallback(async () => {
    if (!meta?.room.roomCode) return;

    try {
      await navigator.clipboard.writeText(meta.room.roomCode);
      setNotifyToast({ title: '已复制', message: '聊天室 ID 已复制' });
    } catch {
      setAlert({ message: '复制失败' });
    }
  }, [meta]);

  const refreshChat = useCallback(async () => {
    if (!roomId || refreshing) return;

    setRefreshing(true);
    try {
      await Promise.all([
        api.getMessages(roomId).then((roomMessages) => {
          setMessages([...(roomMessages as Msg[])].reverse());
        }),
        loadMeta(),
      ]);

      if (socketRef.current?.connected) {
        socketRef.current.emit('room:join', { roomId });
      }
    } catch (err) {
      setAlert({ message: err instanceof Error ? err.message : '刷新失败' });
    } finally {
      setRefreshing(false);
    }
  }, [loadMeta, refreshing, roomId]);

  const roomIsFull = isPartyFull(meta);

  const openInviteModal = useCallback(() => {
    if (roomIsFull) {
      setAlert({ message: '该聊天室已满' });
      return;
    }

    setInviteOpen(true);
    setFriendsLoading(true);
    void api
      .listFriends()
      .then((data) => setFriends(data as FriendListItem[]))
      .finally(() => setFriendsLoading(false));
  }, [roomIsFull]);

  const inviteFriend = useCallback(
    (friendId: string, nickname: string) => {
      if (!meta) return;

      guard(async () => {
        setInvitingId(friendId);
        try {
          await api.createInvite({
            receiverId: friendId,
            partyId: meta.party.id,
          });
          setNotifyToast({
            title: '邀请已发送',
            message: `已向 ${nickname} 发送聊天室邀请`,
          });
        } catch (err) {
          setAlert({ message: err instanceof Error ? err.message : '邀请失败' });
        } finally {
          setInvitingId(null);
        }
      });
    },
    [guard, meta],
  );

  const invitableFriends = useMemo(
    () => getInvitableFriends(friends, meta),
    [friends, meta],
  );

  return {
    meta,
    messages,
    text,
    setText,
    voiceHint,
    setVoiceHint,
    roomNameEdit,
    setRoomNameEdit,
    memberLimitEdit,
    setMemberLimitEdit,
    loading,
    confirmLeave,
    setConfirmLeave,
    confirmDissolve,
    setConfirmDissolve,
    actionLoading,
    alert,
    setAlert,
    notifyToast,
    setNotifyToast,
    friendStatus,
    mentionFilter,
    mentionQuery,
    mentionScrollId,
    inviteOpen,
    setInviteOpen,
    friendsLoading,
    invitableFriends,
    invitingId,
    refreshing,
    bottomRef,
    messageRefs,
    isPartyFull: roomIsFull,
    pickMention,
    insertMention,
    scrollToMention,
    send,
    saveVoice,
    saveRoomName,
    saveMemberLimit,
    doLeave,
    doDissolve,
    addFriend,
    acceptFriendRequest,
    copyCode,
    refreshChat,
    openInviteModal,
    inviteFriend,
  };
}
