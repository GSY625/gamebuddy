import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { api, getToken } from '@gamebuddy/api-client';
import { useAuth } from '../context/AuthContext';
import { ThemeConfirmModal } from '../components/ThemeConfirmModal';
import { ThemeAlertModal } from '../components/ThemeAlertModal';
import { ThemeModal } from '../components/ThemeModal';
import { ThemeToast } from '../components/ThemeToast';
import { UserAvatarLink } from '../components/UserAvatarLink';
import { useOnlineGuard } from '../hooks/useOnlineGuard';
import { ChatEmojiPicker } from '../components/ChatEmojiPicker';
import {
  ChatMentionPicker,
  renderMessageContent,
} from '../components/ChatMentionPicker';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:3000';

type Msg = {
  id: string;
  content: string;
  type: string;
  createdAt: string;
  user?: { id?: string; nickname: string };
};

type PresenceStatus = 'online' | 'invisible' | 'offline';

type Member = {
  userId: string;
  role: string;
  isLeader: boolean;
  presenceStatus?: PresenceStatus;
  user: { id: string; nickname: string; avatarUrl?: string | null };
};

function presenceLabel(status: PresenceStatus) {
  if (status === 'online') return '在线';
  if (status === 'invisible') return '隐身';
  return '离线';
}

function patchMemberPresence(
  members: Member[],
  payload: {
    userId: string;
    online?: boolean;
    visibility?: 'online' | 'invisible';
  },
  viewerId?: string,
): Member[] {
  return members.map((m) => {
    if (m.userId !== payload.userId) return m;
    const isSelf = m.userId === viewerId;
    if (payload.online === false) return { ...m, presenceStatus: 'offline' };
    if (payload.visibility === 'invisible') {
      return { ...m, presenceStatus: isSelf ? 'invisible' : 'offline' };
    }
    if (payload.visibility === 'online' || payload.online === true) {
      return { ...m, presenceStatus: 'online' };
    }
    return m;
  });
}

type RoomMeta = {
  room: { id: string; roomCode: string | null; name: string | null };
  party: { id: string; maxMembers?: number | null };
  members: Member[];
  leaderId: string | null;
  isLeader: boolean;
};

export default function ChatPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const nav = useNavigate();
  const { user } = useAuth();
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
  const [alert, setAlert] = useState<{ title?: string; message: string } | null>(
    null,
  );
  const [notifyToast, setNotifyToast] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [friendStatus, setFriendStatus] = useState<
    Record<string, { status: string; requestId?: string }>
  >({});
  const [mentionScrollId, setMentionScrollId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [friends, setFriends] = useState<
    Array<{ id: string; friend: { id: string; nickname: string; avatarUrl?: string } }>
  >([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const { guard } = useOnlineGuard();

  const mentionFilter = (() => {
    const match = text.match(/@([^\s@]*)$/);
    return match ? match[0] : null;
  })();

  const mentionQuery = mentionFilter ? mentionFilter.slice(1) : '';

  const loadMeta = useCallback(async () => {
    if (!roomId) return;
    const data = (await api.getRoomMeta(roomId)) as RoomMeta;
    setMeta(data);
    setRoomNameEdit(data.room.name ?? '');
    setMemberLimitEdit(
      typeof data.party.maxMembers === 'number' ? String(data.party.maxMembers) : '',
    );
    const party = await api.getParty(data.party.id);
    setVoiceHint(party.voiceHint ?? '');

    const statuses: Record<string, { status: string; requestId?: string }> = {};
    for (const m of data.members) {
      if (m.userId === user?.id) continue;
      statuses[m.userId] = await api.friendStatus(m.userId);
    }
    setFriendStatus(statuses);
  }, [roomId, user?.id]);

  useEffect(() => {
    if (!roomId) return;
    setLoading(true);
    Promise.all([
      api.getPendingMention(roomId).then((r) => {
        if (r.messageId) setMentionScrollId(r.messageId);
      }),
      api.getMessages(roomId).then((msgs) => {
        setMessages([...(msgs as Msg[])].reverse());
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
    socket.on('room:message', (msg: Msg) => {
      setMessages((prev) => [...prev, msg]);
      if (msg.type === 'system' && msg.content.includes('加入了聊天室')) {
        void loadMeta();
      }
      if (
        user?.nickname &&
        msg.user?.id !== user.id &&
        msg.content.includes(`@${user.nickname}`)
      ) {
        setMentionScrollId(msg.id);
      }
    });
    socket.on(
      'room:mention',
      (payload: { roomId: string; messageId: string }) => {
        if (payload.roomId === roomId) setMentionScrollId(payload.messageId);
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
    socket.on('user:notify', (payload: { title: string; message: string }) => {
      setNotifyToast({ title: payload.title, message: payload.message });
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
  }, [roomId, loadMeta, nav, user?.id, user?.nickname]);

  useEffect(() => {
    if (mentionScrollId) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, mentionScrollId]);

  const pickMention = (nickname: string) => {
    setText((t) => t.replace(/@([^\s@]*)$/, `@${nickname} `));
  };

  const insertMention = (nickname: string) => {
    setText((t) => (t ? `${t} @${nickname} ` : `@${nickname} `));
  };

  const scrollToMention = () => {
    if (!mentionScrollId) return;
    const el = messageRefs.current.get(mentionScrollId);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setMentionScrollId(null);
  };

  const send = () => {
    if (!text.trim() || !socketRef.current || !roomId) return;
    socketRef.current.emit('room:message', { roomId, content: text });
    setText('');
  };

  const saveVoice = async () => {
    if (!meta?.isLeader) return;
    await api.setVoiceHint(meta.party.id, voiceHint);
    setNotifyToast({ title: '已保存', message: '语音说明已更新' });
  };

  const saveRoomName = async () => {
    if (!meta?.isLeader) return;
    try {
      await api.setRoomName(meta.party.id, roomNameEdit);
      await loadMeta();
      setNotifyToast({ title: '已保存', message: '聊天室名称已更新' });
    } catch (err) {
      setAlert({ message: err instanceof Error ? err.message : '保存失败' });
    }
  };

  const saveMemberLimit = async () => {
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
  };

  const doLeave = async () => {
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
  };

  const doDissolve = async () => {
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
  };

  const addFriend = async (otherId: string) => {
    try {
      await api.sendFriendRequest(otherId);
      setFriendStatus((s) => ({ ...s, [otherId]: { status: 'pending_sent' } }));
      setNotifyToast({ title: '已发送', message: '好友申请已发送' });
    } catch (err) {
      setAlert({ message: err instanceof Error ? err.message : '发送失败' });
    }
  };

  const copyCode = async () => {
    if (!meta?.room.roomCode) return;
    try {
      await navigator.clipboard.writeText(meta.room.roomCode);
      setNotifyToast({ title: '已复制', message: '聊天室 ID 已复制' });
    } catch {
      setAlert({ message: '复制失败' });
    }
  };

  const refreshChat = async () => {
    if (!roomId || refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([
        api.getMessages(roomId).then((msgs) => {
          setMessages([...(msgs as Msg[])].reverse());
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
  };

  const openInviteModal = () => {
    if (
      meta &&
      typeof meta.party.maxMembers === 'number' &&
      meta.members.length >= meta.party.maxMembers
    ) {
      setAlert({ message: '该聊天室已满' });
      return;
    }
    setInviteOpen(true);
    setFriendsLoading(true);
    void api
      .listFriends()
      .then((data) =>
        setFriends(
          data as Array<{
            id: string;
            friend: { id: string; nickname: string; avatarUrl?: string };
          }>,
        ),
      )
      .finally(() => setFriendsLoading(false));
  };

  const inviteFriend = (friendId: string, nickname: string) => {
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
  };

  const memberIds = new Set(meta?.members.map((m) => m.userId) ?? []);
  const invitableFriends = friends.filter((f) => !memberIds.has(f.friend.id));
  const isPartyFull =
    typeof meta?.party.maxMembers === 'number' &&
    meta.members.length >= meta.party.maxMembers;

  if (loading) return <div className="loading page-wrap">加载聊天室中...</div>;

  if (!meta) {
    return (
      <div className="page-wrap">
        <ThemeAlertModal
          open
          title={alert?.title ?? '提示'}
          message={alert?.message ?? '聊天室不可用'}
          onClose={() => nav('/parties')}
        />
      </div>
    );
  }

  return (
    <div className="chat-page page-wrap">
      <ThemeToast
        message={notifyToast ? `${notifyToast.title}：${notifyToast.message}` : ''}
        show={Boolean(notifyToast)}
        variant="warn"
        durationMs={4000}
        onClose={() => setNotifyToast(null)}
      />
      <ThemeAlertModal
        open={alert !== null}
        title={alert?.title}
        message={alert?.message ?? ''}
        onClose={() => setAlert(null)}
      />
      <ThemeConfirmModal
        open={confirmLeave}
        title="退出聊天室"
        message="确定要退出这个聊天室吗？退出后将无法查看此房间消息。"
        confirmLabel="确认退出"
        confirming={actionLoading}
        onConfirm={() => void doLeave()}
        onCancel={() => setConfirmLeave(false)}
      />
      <ThemeConfirmModal
        open={confirmDissolve}
        title="注销聊天室"
        message="确定要注销聊天室吗？所有成员将被移出，聊天室 ID 可能会被新房间复用，此操作不可撤销。"
        confirmLabel="确认注销"
        confirming={actionLoading}
        onConfirm={() => void doDissolve()}
        onCancel={() => setConfirmDissolve(false)}
      />

      <aside className="chat-settings glass-panel">
        <div className="chat-settings-header">
          <h2>聊天室设置</h2>
          <button
            type="button"
            className="chat-refresh-btn"
            title="刷新聊天室"
            aria-label="刷新聊天室"
            disabled={refreshing}
            onClick={() => void refreshChat()}
          >
            <svg
              className={`chat-refresh-icon${refreshing ? ' spinning' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
            >
              <path
                d="M21 12a9 9 0 1 1-2.64-6.36"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M21 3v6h-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div className="chat-room-id-box">
          <span className="form-field-label">聊天室 ID</span>
          <div className="chat-room-id-row">
            <code className="room-code">{meta.room.roomCode ?? '—'}</code>
            <button type="button" className="ghost small-btn" onClick={copyCode}>
              复制
            </button>
          </div>
        </div>

        <div className="form-field">
          <span className="form-field-label">聊天室名称</span>
          {meta.isLeader ? (
            <>
              <input
                value={roomNameEdit}
                onChange={(e) => setRoomNameEdit(e.target.value)}
                maxLength={32}
              />
              <button type="button" className="ghost small-btn" onClick={saveRoomName}>
                保存名称
              </button>
            </>
          ) : (
            <p className="room-name-display">{meta.room.name ?? '未命名'}</p>
          )}
        </div>

        <div className="form-field">
          <span className="form-field-label">人数上限</span>
          {meta.isLeader ? (
            <>
              <p className="muted small">留空表示不限制，范围 2 - 99 人</p>
              <input
                type="number"
                min={2}
                max={99}
                step={1}
                placeholder="不限制"
                value={memberLimitEdit}
                onChange={(e) => setMemberLimitEdit(e.target.value)}
              />
              <button
                type="button"
                className="ghost small-btn"
                onClick={() => void saveMemberLimit()}
              >
                保存上限
              </button>
            </>
          ) : (
            <p className="room-name-display">
              {typeof meta.party.maxMembers === 'number'
                ? `当前上限 ${meta.party.maxMembers} 人`
                : '当前未限制人数'}
            </p>
          )}
        </div>

        <hr className="chat-divider" />

        <h3>语音（第三方）</h3>
        {meta.isLeader ? (
          <>
            <p className="muted small">填写 QQ/微信语音房间说明</p>
            <input
              placeholder="例如：微信语音群 / QQ 123456"
              value={voiceHint}
              onChange={(e) => setVoiceHint(e.target.value)}
            />
            <button type="button" onClick={saveVoice}>
              保存语音说明
            </button>
          </>
        ) : (
          <>
            <p className="muted small">仅房主可修改，成员可查看</p>
            <p className="room-name-display">
              {voiceHint.trim() || '房主暂未填写语音说明'}
            </p>
          </>
        )}

        <hr className="chat-divider" />

        {meta.isLeader ? (
          <button
            type="button"
            className="btn-danger-outline"
            onClick={() => setConfirmDissolve(true)}
          >
            注销聊天室
          </button>
        ) : (
          <button
            type="button"
            className="btn-danger-outline"
            onClick={() => setConfirmLeave(true)}
          >
            退出聊天室
          </button>
        )}
      </aside>

      <div className="chat-main glass-panel">
        <header className="chat-header">
          <h2>{meta.room.name ?? '聊天室'}</h2>
          <span className="muted small">ID: {meta.room.roomCode}</span>
        </header>

        <div className="messages">
          {mentionScrollId && (
            <button
              type="button"
              className="chat-mention-banner"
              onClick={scrollToMention}
            >
              有人@你，点击跳转
            </button>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              ref={(el) => {
                if (el) messageRefs.current.set(m.id, el);
                else messageRefs.current.delete(m.id);
              }}
              className={`msg ${m.type === 'system' ? 'system' : ''} ${
                m.type === 'system_alert' ? 'system-alert' : ''
              } ${mentionScrollId === m.id ? 'msg-mentioned' : ''}`}
            >
              {m.type === 'text' && m.user && <strong>{m.user.nickname}: </strong>}
              {m.type === 'text'
                ? renderMessageContent(m.content, user?.nickname)
                : m.content}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="chat-input-wrap">
          {mentionFilter && meta && (
            <ChatMentionPicker
              members={meta.members}
              filter={mentionQuery}
              selfId={user?.id}
              onPick={pickMention}
              onClose={() => setText((t) => t.replace(/@([^\s@]*)$/, ''))}
            />
          )}
          <div className="chat-input">
            <ChatEmojiPicker onPick={(emoji) => setText((t) => t + emoji)} />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="输入消息，@ 可提及成员..."
            />
            <button type="button" onClick={send}>
              发送
            </button>
          </div>
        </div>
      </div>

      <aside className="chat-members glass-panel">
        <div className="chat-members-header">
          <h2>
            成员 ({meta.members.length}
            {typeof meta.party.maxMembers === 'number'
              ? `/${meta.party.maxMembers}`
              : ''}
            )
          </h2>
          <button
            type="button"
            className="ghost small-btn"
            disabled={isPartyFull}
            onClick={openInviteModal}
          >
            邀请好友
          </button>
        </div>

        <ul className="chat-member-list">
          {meta.members.map((m) => {
            const fs = friendStatus[m.userId];
            return (
              <li key={m.userId} className="chat-member-item">
                <UserAvatarLink
                  userId={m.userId}
                  url={m.user.avatarUrl}
                  name={m.user.nickname}
                  size={36}
                  status={
                    m.presenceStatus === 'online'
                      ? 'online'
                      : m.presenceStatus === 'invisible'
                        ? 'invisible'
                        : undefined
                  }
                />
                <div className="chat-member-info">
                  <span className="chat-member-name">
                    {m.user.nickname}
                    {m.isLeader && <span className="leader-badge">房主</span>}
                    {m.userId === user?.id && <span className="muted small">（我）</span>}
                  </span>
                  <div className="member-presence-row">
                    <span
                      className={`member-presence-dot ${m.presenceStatus ?? 'offline'}`}
                      aria-hidden
                    />
                    <span
                      className={`member-presence-label ${
                        m.presenceStatus === 'online' ? 'online' : ''
                      }`}
                    >
                      {presenceLabel(m.presenceStatus ?? 'offline')}
                    </span>
                  </div>

                  {m.userId !== user?.id && (
                    <div className="chat-member-actions">
                      <button
                        type="button"
                        className="ghost small-btn"
                        title={`@${m.user.nickname}`}
                        onClick={() => insertMention(m.user.nickname)}
                      >
                        @
                      </button>
                      {fs?.status === 'friends' && (
                        <span className="muted small">已经是好友</span>
                      )}
                      {fs?.status === 'pending_sent' && (
                        <span className="muted small">已申请</span>
                      )}
                      {fs?.status === 'pending_received' && fs.requestId && (
                        <button
                          type="button"
                          className="ghost small-btn"
                          onClick={async () => {
                            try {
                              await api.resolveFriendRequest(fs.requestId!, true);
                              setFriendStatus((s) => ({
                                ...s,
                                [m.userId]: { status: 'friends' },
                              }));
                              setNotifyToast({
                                title: '已是好友',
                                message: `已与 ${m.user.nickname} 成为好友`,
                              });
                            } catch (err) {
                              setAlert({
                                message: err instanceof Error ? err.message : '操作失败',
                              });
                            }
                          }}
                        >
                          同意好友
                        </button>
                      )}
                      {(!fs || fs.status === 'none') && (
                        <button
                          type="button"
                          className="ghost small-btn"
                          onClick={() => addFriend(m.userId)}
                        >
                          加好友
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </aside>

      <ThemeModal
        open={inviteOpen}
        title="邀请好友加入聊天室"
        onClose={() => setInviteOpen(false)}
      >
        <p className="muted small">
          好友接受邀请后，仍需房主同意，才会正式加入聊天室。
        </p>
        {typeof meta.party.maxMembers === 'number' && (
          <p className="muted small">
            当前人数 {meta.members.length}/{meta.party.maxMembers}
          </p>
        )}
        {friendsLoading ? (
          <p className="muted">加载好友列表中...</p>
        ) : invitableFriends.length === 0 ? (
          <p className="muted">没有可邀请的好友（已是成员或未添加好友）</p>
        ) : (
          <ul className="invite-friend-list">
            {invitableFriends.map((f) => (
              <li key={f.id} className="invite-friend-item">
                <UserAvatarLink
                  userId={f.friend.id}
                  url={f.friend.avatarUrl}
                  name={f.friend.nickname}
                  size={36}
                />
                <span>{f.friend.nickname}</span>
                <button
                  type="button"
                  className="ghost small-btn"
                  disabled={invitingId === f.friend.id}
                  onClick={() => inviteFriend(f.friend.id, f.friend.nickname)}
                >
                  {invitingId === f.friend.id ? '发送中...' : '邀请'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </ThemeModal>
    </div>
  );
}
