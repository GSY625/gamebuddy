import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@gamebuddy/api-client';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { UserAvatarLink } from '../components/UserAvatarLink';
import { ThemeToast } from '../components/ThemeToast';
import { ThemeConfirmModal } from '../components/ThemeConfirmModal';
import { prefetchDirectConversation } from '../features/directMessages/cache';

type FriendRow = {
  id: string;
  friend: { id: string; nickname: string; avatarUrl?: string };
  since: string;
  presenceStatus: 'online' | 'invisible' | 'offline';
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
};

type RequestRow = {
  id: string;
  sender: { id: string; nickname: string; avatarUrl?: string };
};

type PendingDelete = {
  friendId: string;
  nickname: string;
};

type FriendsPageCache = {
  friends: FriendRow[];
  requests: RequestRow[];
};

let friendsPageCache: FriendsPageCache | null = null;

function presenceLabel(status: FriendRow['presenceStatus']) {
  if (status === 'online') return '在线';
  if (status === 'invisible') return '隐身';
  return '离线';
}

function formatFriendTime(value?: string | null) {
  if (!value) return '还没有私信过';
  return new Date(value).toLocaleString('zh-CN');
}

export default function FriendsPage() {
  const nav = useNavigate();
  const [friends, setFriends] = useState<FriendRow[]>(() => friendsPageCache?.friends ?? []);
  const [requests, setRequests] = useState<RequestRow[]>(
    () => friendsPageCache?.requests ?? [],
  );
  const [loading, setLoading] = useState(() => friendsPageCache === null);
  const [toast, setToast] = useState('');
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openingFriendId, setOpeningFriendId] = useState<string | null>(null);

  const syncRows = useCallback((nextFriends: FriendRow[], nextRequests: RequestRow[]) => {
    friendsPageCache = { friends: nextFriends, requests: nextRequests };
    setFriends(nextFriends);
    setRequests(nextRequests);
  }, []);

  const load = useCallback(async () => {
    try {
      const [friendRows, requestRows] = await Promise.all([
        api.listFriends(),
        api.listFriendRequests(),
      ]);
      syncRows(friendRows as FriendRow[], requestRows as RequestRow[]);
    } catch (err) {
      setToast(err instanceof Error ? err.message : '加载好友失败');
    } finally {
      setLoading(false);
    }
  }, [syncRows]);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async (id: string, accept: boolean) => {
    try {
      await api.resolveFriendRequest(id, accept);
      setToast(accept ? '已添加好友' : '已拒绝申请');
      await load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : '操作失败');
    }
  };

  const confirmRemoveFriend = async () => {
    if (!pendingDelete) return;
    setDeleting(true);

    try {
      await api.removeFriend(pendingDelete.friendId);
      const nextFriends = friends.filter((item) => item.friend.id !== pendingDelete.friendId);
      syncRows(nextFriends, requests);
      setToast(`已删除好友「${pendingDelete.nickname}」`);
      setPendingDelete(null);
    } catch (err) {
      setToast(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const openDirectMessage = async (friendId: string) => {
    setOpeningFriendId(friendId);
    try {
      await prefetchDirectConversation(friendId);
      nav(`/messages/${friendId}`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : '打开私信失败');
    } finally {
      setOpeningFriendId(null);
    }
  };

  const requestCountLabel = loading && friendsPageCache === null ? '...' : requests.length;
  const friendCountLabel = loading && friendsPageCache === null ? '...' : friends.length;

  return (
    <div className="page-wrap">
      <PageHeader
        title="好友"
        subtitle="通过顶部搜索、聊天室成员或资料页添加好友，建立更稳定的开黑关系。"
      />
      <ThemeToast message={toast} show={Boolean(toast)} onClose={() => setToast('')} />
      <ThemeConfirmModal
        open={pendingDelete !== null}
        title="删除好友"
        message={pendingDelete ? `确认删除「${pendingDelete.nickname}」？` : ''}
        confirmLabel="确认删除"
        confirming={deleting}
        onConfirm={() => void confirmRemoveFriend()}
        onCancel={() => {
          if (!deleting) setPendingDelete(null);
        }}
      />

      <section className="glass-panel friends-section">
        <h3>好友申请 ({requestCountLabel})</h3>
        {loading && friendsPageCache === null ? (
          <div className="loading">加载好友申请中...</div>
        ) : requests.length === 0 ? (
          <p className="muted small">暂无待处理申请</p>
        ) : (
          <ul className="friend-request-list">
            {requests.map((request) => (
              <li key={request.id} className="friend-request-item">
                <UserAvatarLink
                  userId={request.sender.id}
                  url={request.sender.avatarUrl}
                  name={request.sender.nickname}
                  size={40}
                />
                <span>{request.sender.nickname}</span>
                <div className="friend-request-actions">
                  <button type="button" onClick={() => void resolve(request.id, true)}>
                    同意
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => void resolve(request.id, false)}
                  >
                    拒绝
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass-panel friends-section">
        <h3>我的好友 ({friendCountLabel})</h3>
        {loading && friendsPageCache === null ? (
          <div className="loading">加载好友列表中...</div>
        ) : friends.length === 0 ? (
          <EmptyState
            variant="wave"
            title="还没有好友"
            description="先从搜索、聊天室成员或玩家资料页添加几位常一起玩的好友吧。"
          />
        ) : (
          <ul className="friend-list">
            {friends.map((friend) => (
              <li key={friend.id} className="friend-list-item">
                <UserAvatarLink
                  userId={friend.friend.id}
                  url={friend.friend.avatarUrl}
                  name={friend.friend.nickname}
                  size={40}
                />
                <div className="friend-list-meta">
                  <div className="friend-list-name-row">
                    <span>{friend.friend.nickname}</span>
                    <span className={`friend-presence-badge ${friend.presenceStatus}`}>
                      {presenceLabel(friend.presenceStatus)}
                    </span>
                  </div>
                  <p className="muted small friend-list-preview">
                    {friend.lastMessagePreview ||
                      '先发一句私信，把常玩的时间和模式约起来'}
                  </p>
                  <p className="muted small friend-list-time">
                    最近私信: {formatFriendTime(friend.lastMessageAt)}
                  </p>
                </div>
                <button
                  type="button"
                  className="ghost small-btn"
                  disabled={openingFriendId === friend.friend.id}
                  onClick={() => void openDirectMessage(friend.friend.id)}
                >
                  {openingFriendId === friend.friend.id ? '打开中...' : '私信'}
                </button>
                <button
                  type="button"
                  className="friend-delete-btn"
                  aria-label={`删除好友 ${friend.friend.nickname}`}
                  onClick={() =>
                    setPendingDelete({
                      friendId: friend.friend.id,
                      nickname: friend.friend.nickname,
                    })
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
