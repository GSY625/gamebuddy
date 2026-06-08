import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { api, getToken } from '@gamebuddy/api-client';
import { ChatEmojiPicker } from '../components/ChatEmojiPicker';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { ThemeAlertModal } from '../components/ThemeAlertModal';
import { ThemeToast } from '../components/ThemeToast';
import { UserAvatar } from '../components/UserAvatar';
import { UserAvatarLink } from '../components/UserAvatarLink';
import { useAuth } from '../context/AuthContext';
import { useOnlineGuard } from '../hooks/useOnlineGuard';
import { WS_URL } from '../utils/runtimeEnv';

type Conversation = {
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

type DirectMessage = {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
  sender: { id: string; nickname: string; avatarUrl?: string | null };
};

const quickDmPhrases = [
  '晚上一起开黑吗？',
  '你一般几点在线？',
  '这把想打什么模式？',
  '要不要直接拉个房间语音？',
];

export default function DirectMessagesPage() {
  const { friendId } = useParams<{ friendId?: string }>();
  const { user, forceLogout } = useAuth();
  const { guard } = useOnlineGuard();
  const nav = useNavigate();
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(
    null,
  );
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [alert, setAlert] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  const loadConversations = useCallback(async () => {
    const rows = (await api.listDirectConversations()) as Conversation[];
    setConversations(rows);
    return rows;
  }, []);

  const mergeConversation = useCallback((conversation: Conversation) => {
    setConversations((prev) => {
      const rest = prev.filter((item) => item.threadId !== conversation.threadId);
      return [conversation, ...rest];
    });
  }, []);

  const loadActiveConversation = useCallback(
    async (targetFriendId: string) => {
      setMessagesLoading(true);
      try {
        const [conversation, rows] = await Promise.all([
          api.getDirectConversation(targetFriendId),
          api.getDirectMessages(targetFriendId),
        ]);
        const currentConversation = conversation as Conversation;
        setActiveConversation(currentConversation);
        setMessages([...(rows as DirectMessage[])].reverse());
        mergeConversation({ ...currentConversation, unreadCount: 0 });
        await api.markDirectConversationRead(targetFriendId);
      } catch (err) {
        setAlert(err instanceof Error ? err.message : '加载私信失败');
      } finally {
        setMessagesLoading(false);
      }
    },
    [mergeConversation],
  );

  useEffect(() => {
    loadConversations()
      .catch((err) => {
        setAlert(err instanceof Error ? err.message : '加载私信失败');
      })
      .finally(() => setLoading(false));
  }, [loadConversations]);

  useEffect(() => {
    if (!friendId) {
      setActiveConversation(null);
      setMessages([]);
      return;
    }
    void loadActiveConversation(friendId);
  }, [friendId, loadActiveConversation]);

  useEffect(() => {
    if (!user) return;

    const socket = io(WS_URL, { auth: { token: getToken() } });
    socketRef.current = socket;

    socket.on('dm:message', (payload: { threadId: string; message: DirectMessage }) => {
      setConversations((prev) =>
        prev
          .map((item) => {
            if (item.threadId !== payload.threadId) return item;
            const unreadCount =
              payload.message.senderId === user.id ||
              activeConversation?.threadId === payload.threadId
                ? 0
                : item.unreadCount + 1;

            return {
              ...item,
              unreadCount,
              lastMessageAt: payload.message.createdAt,
              lastMessage: {
                id: payload.message.id,
                content: payload.message.content,
                createdAt: payload.message.createdAt,
                senderId: payload.message.senderId,
                sender: payload.message.sender,
              },
            };
          })
          .sort(
            (a, b) =>
              new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
          ),
      );

      if (activeConversation?.threadId === payload.threadId) {
        setMessages((prev) =>
          prev.some((item) => item.id === payload.message.id)
            ? prev
            : [...prev, payload.message],
        );
        if (payload.message.senderId !== user.id) {
          void api.markDirectConversationRead(activeConversation.friend.id);
        }
      }
    });

    socket.on('dm:conversation:update', () => {
      void loadConversations().catch(() => {});
    });

    socket.on('user:banned', (payload: { message?: string }) => {
      forceLogout(payload.message ?? '账号已被封禁');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [
    activeConversation?.friend.id,
    activeConversation?.threadId,
    forceLogout,
    loadConversations,
    user,
  ]);

  useEffect(() => {
    if (!activeConversation?.threadId || !socketRef.current) return;
    socketRef.current.emit('dm:join', { threadId: activeConversation.threadId });
  }, [activeConversation?.threadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    if (!text.trim() || !activeConversation || !socketRef.current) return;
    socketRef.current.emit('dm:message', {
      receiverId: activeConversation.friend.id,
      content: text.trim(),
    });
    setText('');
  };

  const inviteFriend = () => {
    if (!activeConversation?.friend.id) return;
    guard(async () => {
      setInviting(true);
      try {
        await api.createInvite({
          receiverId: activeConversation.friend.id,
          message: '刚刚私信里约好了，直接一起开黑吧',
        });
        setToast('邀约已发送，对方可以去“邀约”页查看');
      } catch (err) {
        setToast(err instanceof Error ? err.message : '发送邀约失败');
      } finally {
        setInviting(false);
      }
    });
  };

  const activeThreadId = activeConversation?.threadId;

  const selectedConversation = useMemo(() => {
    if (activeThreadId) {
      return (
        conversations.find((item) => item.threadId === activeThreadId) ??
        activeConversation
      );
    }
    if (!friendId) return null;
    return conversations.find((item) => item.friend.id === friendId) ?? null;
  }, [activeConversation, activeThreadId, conversations, friendId]);

  if (loading) {
    return <div className="loading page-wrap">加载私信中...</div>;
  }

  return (
    <div className="page-wrap">
      <ThemeToast message={toast} show={Boolean(toast)} onClose={() => setToast('')} />
      <ThemeAlertModal
        open={alert !== null}
        title="提示"
        message={alert ?? ''}
        onClose={() => setAlert(null)}
      />

      <PageHeader
        title="好友私信"
        subtitle="和已添加的好友单独交流，约时间、约模式、约语音都会更高效"
      />

      <div className="dm-page">
        <aside className="glass-panel dm-sidebar">
          <div className="dm-sidebar-head">
            <h3>最近会话</h3>
            <span className="muted small">{conversations.length} 个</span>
          </div>

          {conversations.length === 0 ? (
            <EmptyState
              variant="wave"
              title="还没有私信会话"
              description="先去好友页找一个搭子，发起第一条私信吧"
            />
          ) : (
            <ul className="dm-conversation-list">
              {conversations.map((item) => {
                const active = selectedConversation?.threadId === item.threadId;
                return (
                  <li key={item.threadId}>
                    <button
                      type="button"
                      className={`dm-conversation-btn glass-panel ${active ? 'active' : ''}`}
                      onClick={() => nav(`/messages/${item.friend.id}`)}
                    >
                      <UserAvatar
                        url={item.friend.avatarUrl}
                        name={item.friend.nickname}
                        size={42}
                      />
                      <div className="dm-conversation-meta">
                        <div className="dm-conversation-name-row">
                          <strong>{item.friend.nickname}</strong>
                          {item.unreadCount > 0 && (
                            <span className="dm-unread-badge">
                              {item.unreadCount > 99 ? '99+' : item.unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="muted small dm-conversation-preview">
                          {item.lastMessage?.content || '点击开始聊天'}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className="glass-panel dm-chat">
          {!friendId ? (
            <div className="dm-empty-state">
              <EmptyState
                variant="search"
                title="选择一个会话"
                description="从左侧打开已有私信，或者去好友页给好友发起新的私信"
              />
            </div>
          ) : messagesLoading || !activeConversation ? (
            <div className="loading">加载会话中...</div>
          ) : (
            <>
              <header className="dm-chat-header">
                <div className="dm-chat-user">
                  <UserAvatarLink
                    userId={activeConversation.friend.id}
                    url={activeConversation.friend.avatarUrl}
                    name={activeConversation.friend.nickname}
                    size={44}
                  />
                  <div>
                    <h3>{activeConversation.friend.nickname}</h3>
                    <p className="muted small">只有互为好友后，才可以开启私信交流</p>
                  </div>
                </div>
                <div className="dm-chat-header-actions">
                  <button
                    type="button"
                    className="ghost small-btn"
                    onClick={inviteFriend}
                    disabled={inviting}
                  >
                    {inviting ? '发送中...' : '直接邀约'}
                  </button>
                </div>
              </header>

              <div className="dm-messages">
                {messages.length === 0 ? (
                  <div className="dm-empty-tip muted">还没有消息，先打个招呼吧。</div>
                ) : (
                  messages.map((message) => {
                    const self = message.senderId === user?.id;
                    return (
                      <div
                        key={message.id}
                        className={`dm-message-row ${self ? 'self' : 'other'}`}
                      >
                        {!self && (
                          <UserAvatarLink
                            userId={message.sender.id}
                            url={message.sender.avatarUrl}
                            name={message.sender.nickname}
                            size={32}
                          />
                        )}
                        <div className={`dm-message-bubble ${self ? 'self' : 'other'}`}>
                          <p>{message.content}</p>
                          <time className="muted small">
                            {new Date(message.createdAt).toLocaleString('zh-CN')}
                          </time>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              <div className="dm-quick-actions">
                {quickDmPhrases.map((phrase) => (
                  <button
                    key={phrase}
                    type="button"
                    className="ghost"
                    onClick={() => setText(phrase)}
                  >
                    {phrase}
                  </button>
                ))}
              </div>

              <div className="chat-input">
                <ChatEmojiPicker onPick={(emoji) => setText((prev) => prev + emoji)} />
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && send()}
                  placeholder="输入私信内容，和好友约时间、约模式、约语音..."
                />
                <button type="button" onClick={send}>
                  发送
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
