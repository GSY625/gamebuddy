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
import {
  getCachedDirectConversationDetail,
  getCachedDirectConversations,
  hasCachedDirectConversationDetail,
  prefetchDirectConversation,
  setCachedDirectConversationDetail,
  setCachedDirectConversations,
  updateCachedDirectConversationMessages,
  warmDirectConversationDetails,
  type DirectConversation,
  type DirectMessage,
} from '../features/directMessages/cache';
import { useOnlineGuard } from '../hooks/useOnlineGuard';
import { WS_URL } from '../utils/runtimeEnv';

const quickDmPhrases = [
  '晚上一起开黑吗？',
  '你一般几点在线？',
  '这把想打什么模式？',
  '要不要直接拉一个房间语音？',
];

export default function DirectMessagesPage() {
  const { friendId } = useParams<{ friendId?: string }>();
  const { user, forceLogout } = useAuth();
  const { guard } = useOnlineGuard();
  const nav = useNavigate();
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const cachedDetail = friendId ? getCachedDirectConversationDetail(friendId) : null;
  const [conversations, setConversations] = useState<DirectConversation[]>(
    () => getCachedDirectConversations() ?? [],
  );
  const [activeConversation, setActiveConversation] = useState<DirectConversation | null>(
    () => cachedDetail?.conversation ?? null,
  );
  const [messages, setMessages] = useState<DirectMessage[]>(() => cachedDetail?.messages ?? []);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(() => getCachedDirectConversations() === null);
  const [messagesLoading, setMessagesLoading] = useState(
    () => Boolean(friendId && !cachedDetail),
  );
  const [openingFriendId, setOpeningFriendId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [alert, setAlert] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [icebreakerLoading, setIcebreakerLoading] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  const syncConversations = useCallback((rows: DirectConversation[]) => {
    setCachedDirectConversations(rows);
    setConversations(rows);
  }, []);

  const mergeConversation = useCallback((conversation: DirectConversation) => {
    setConversations((prev) => {
      const base = prev.length > 0 ? prev : getCachedDirectConversations() ?? [];
      const rest = base.filter((item) => item.threadId !== conversation.threadId);
      const next = [conversation, ...rest];
      setCachedDirectConversations(next);
      return next;
    });

    const detail = getCachedDirectConversationDetail(conversation.friend.id);
    if (detail) {
      setCachedDirectConversationDetail(conversation.friend.id, {
        conversation,
        messages: detail.messages,
      });
    }
  }, []);

  const loadConversations = useCallback(async () => {
    const rows = (await api.listDirectConversations()) as DirectConversation[];
    syncConversations(rows);
    warmDirectConversationDetails(rows);
    return rows;
  }, [syncConversations]);

  const loadActiveConversation = useCallback(
    async (targetFriendId: string) => {
      setMessagesLoading(true);
      try {
        const detail = await prefetchDirectConversation(targetFriendId);
        setActiveConversation(detail.conversation);
        setMessages(detail.messages);
        mergeConversation({ ...detail.conversation, unreadCount: 0 });
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
      setMessagesLoading(false);
      return;
    }

    const cached = getCachedDirectConversationDetail(friendId);
    const listedConversation =
      getCachedDirectConversations()?.find((item) => item.friend.id === friendId) ?? null;

    if (cached) {
      setActiveConversation(cached.conversation);
      setMessages(cached.messages);
      setMessagesLoading(false);
    } else {
      setActiveConversation(listedConversation);
      setMessages([]);
      setMessagesLoading(true);
      void loadActiveConversation(friendId);
    }
  }, [friendId, loadActiveConversation]);

  useEffect(() => {
    if (!user) return;

    const socket = io(WS_URL, { auth: { token: getToken() } });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
    });
    socket.on('disconnect', () => {
      setSocketConnected(false);
    });
    socket.on('connect_error', () => {
      setSocketConnected(false);
      setAlert('聊天连接失败，请稍后重试');
    });
    socket.on('dm:message', (payload: { threadId: string; message: DirectMessage }) => {
      setConversations((prev) => {
        const next = prev
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
          );

        setCachedDirectConversations(next);
        return next;
      });

      if (activeConversation?.threadId === payload.threadId) {
        setMessages((prev) => {
          if (prev.some((item) => item.id === payload.message.id)) {
            return prev;
          }

          const detail = updateCachedDirectConversationMessages(
            activeConversation.friend.id,
            (current) => [...current, payload.message],
          );

          return detail?.messages ?? [...prev, payload.message];
        });

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
      setSocketConnected(false);
    };
  }, [activeConversation, forceLogout, loadConversations, user]);

  useEffect(() => {
    if (!activeConversation?.threadId || !socketRef.current?.connected) return;
    socketRef.current.emit('dm:join', { threadId: activeConversation.threadId });
  }, [activeConversation?.threadId, socketConnected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openConversation = useCallback(
    async (conversation: DirectConversation) => {
      if (friendId === conversation.friend.id) return;

      if (!hasCachedDirectConversationDetail(conversation.friend.id)) {
        setOpeningFriendId(conversation.friend.id);
        try {
          await prefetchDirectConversation(conversation.friend.id);
        } catch (err) {
          setAlert(err instanceof Error ? err.message : '加载会话失败');
          return;
        } finally {
          setOpeningFriendId(null);
        }
      }

      nav(`/messages/${conversation.friend.id}`);
    },
    [friendId, nav],
  );

  const send = () => {
    const content = text.trim();
    if (!content || !activeConversation) return;

    const socket = socketRef.current;
    if (!socket) {
      setAlert('聊天连接尚未建立，请稍后重试');
      return;
    }

    const emitMessage = () => {
      socket.emit('dm:message', {
        receiverId: activeConversation.friend.id,
        content,
      });
    };

    if (socket.connected) {
      emitMessage();
    } else {
      socket.once('connect', () => {
        socket.emit('dm:join', { threadId: activeConversation.threadId });
        emitMessage();
      });
      socket.connect();
      setToast('正在重连聊天服务，请稍候');
    }

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

  const createChatIcebreaker = useCallback(async () => {
    if (!activeConversation?.threadId || icebreakerLoading) return;

    setIcebreakerLoading(true);
    try {
      const result = await api.createChatIcebreaker({
        threadId: activeConversation.threadId,
        contextType: messages.length > 0 ? 'after_match' : 'first_message',
      });
      setText(result.message);
      setToast('AI 破冰已插入输入框，请确认后手动发送');
    } catch (err) {
      setAlert(err instanceof Error ? err.message : 'AI 破冰失败');
    } finally {
      setIcebreakerLoading(false);
    }
  }, [activeConversation?.threadId, icebreakerLoading, messages.length]);
  const activeThreadId = activeConversation?.threadId;
  const selectedConversation = useMemo(() => {
    if (activeThreadId) {
      return (
        conversations.find((item) => item.threadId === activeThreadId) ?? activeConversation
      );
    }
    if (!friendId) return null;
    return conversations.find((item) => item.friend.id === friendId) ?? null;
  }, [activeConversation, activeThreadId, conversations, friendId]);

  const conversationCountLabel =
    loading && getCachedDirectConversations() === null ? '...' : `${conversations.length} 个`;

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
        subtitle="和已添加好友单独交流，约时间、约模式、约语音都会更高效"
      />

      <div className="dm-page">
        <aside className="glass-panel dm-sidebar">
          <div className="dm-sidebar-head">
            <h3>最近会话</h3>
            <span className="muted small">{conversationCountLabel}</span>
          </div>

          {loading && getCachedDirectConversations() === null ? (
            <div className="loading dm-panel-loading">加载会话列表中...</div>
          ) : conversations.length === 0 ? (
            <EmptyState
              variant="wave"
              title="还没有私信会话"
              description="先去好友页找一个搭子，发起第一条私信吧"
            />
          ) : (
            <ul className="dm-conversation-list">
              {conversations.map((conversation) => {
                const active = selectedConversation?.threadId === conversation.threadId;
                const opening = openingFriendId === conversation.friend.id;
                return (
                  <li key={conversation.threadId}>
                    <button
                      type="button"
                      className={`dm-conversation-btn glass-panel ${active ? 'active' : ''}`}
                      onClick={() => void openConversation(conversation)}
                      disabled={opening}
                    >
                      <UserAvatar
                        url={conversation.friend.avatarUrl}
                        name={conversation.friend.nickname}
                        size={42}
                      />
                      <div className="dm-conversation-meta">
                        <div className="dm-conversation-name-row">
                          <strong>{conversation.friend.nickname}</strong>
                          {conversation.unreadCount > 0 && (
                            <span className="dm-unread-badge">
                              {conversation.unreadCount > 99
                                ? '99+'
                                : conversation.unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="muted small dm-conversation-preview">
                          {opening
                            ? '正在打开会话...'
                            : conversation.lastMessage?.content || '点击开始聊天'}
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
            <div className="loading chat-inline-loading">加载会话中...</div>
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
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && send()}
                  placeholder="输入私信内容，和好友约时间、约模式、约语音..."
                />
                <button
                  type="button"
                  className="ghost small-btn"
                  disabled={icebreakerLoading}
                  onClick={() => void createChatIcebreaker()}
                >
                  {icebreakerLoading ? 'AI...' : 'AI 破冰'}
                </button>
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
