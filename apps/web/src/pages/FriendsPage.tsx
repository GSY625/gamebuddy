import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@gamebuddy/api-client';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { UserAvatarLink } from '../components/UserAvatarLink';
import { ThemeToast } from '../components/ThemeToast';
import { ThemeConfirmModal } from '../components/ThemeConfirmModal';

type FriendRow = {
  id: string;
  friend: { id: string; nickname: string; avatarUrl?: string };
};

type RequestRow = {
  id: string;
  sender: { id: string; nickname: string; avatarUrl?: string };
};

type PendingDelete = {
  friendId: string;
  nickname: string;
};

export default function FriendsPage() {
  const nav = useNavigate();
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [toast, setToast] = useState('');
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const [f, r] = await Promise.all([api.listFriends(), api.listFriendRequests()]);
    setFriends(f as FriendRow[]);
    setRequests(r as RequestRow[]);
  }, []);

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
      setFriends((prev) => prev.filter((f) => f.friend.id !== pendingDelete.friendId));
      setToast(`已删除好友「${pendingDelete.nickname}」`);
      setPendingDelete(null);
    } catch (err) {
      setToast(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  };

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
        <h3>好友申请 ({requests.length})</h3>
        {requests.length === 0 ? (
          <p className="muted small">暂无待处理申请</p>
        ) : (
          <ul className="friend-request-list">
            {requests.map((r) => (
              <li key={r.id} className="friend-request-item">
                <UserAvatarLink
                  userId={r.sender.id}
                  url={r.sender.avatarUrl}
                  name={r.sender.nickname}
                  size={40}
                />
                <span>{r.sender.nickname}</span>
                <div className="friend-request-actions">
                  <button type="button" onClick={() => void resolve(r.id, true)}>
                    同意
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => void resolve(r.id, false)}
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
        <h3>我的好友 ({friends.length})</h3>
        {friends.length === 0 ? (
          <EmptyState
            variant="wave"
            title="还没有好友"
            description="先从搜索、聊天室成员或玩家资料页添加几位常一起玩的好友吧。"
          />
        ) : (
          <ul className="friend-list">
            {friends.map((f) => (
              <li key={f.id} className="friend-list-item">
                <UserAvatarLink
                  userId={f.friend.id}
                  url={f.friend.avatarUrl}
                  name={f.friend.nickname}
                  size={40}
                />
                <span>{f.friend.nickname}</span>
                <button
                  type="button"
                  className="ghost small-btn"
                  onClick={() => nav(`/messages/${f.friend.id}`)}
                >
                  私信
                </button>
                <button
                  type="button"
                  className="friend-delete-btn"
                  aria-label={`删除好友 ${f.friend.nickname}`}
                  onClick={() =>
                    setPendingDelete({
                      friendId: f.friend.id,
                      nickname: f.friend.nickname,
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
