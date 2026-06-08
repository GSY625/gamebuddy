import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@gamebuddy/api-client';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { ThemeConfirmModal } from '../components/ThemeConfirmModal';
import { ThemeToast } from '../components/ThemeToast';

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  refId?: string | null;
  read: boolean;
  createdAt: string;
};

function getNotificationActionText(type: string) {
  if (type === 'friend_request') {
    return { confirm: '同意', cancel: '拒绝' };
  }

  if (
    type === 'invite_received' ||
    type === 'room_invite_received' ||
    type === 'room_join_request_received'
  ) {
    return { confirm: '接受', cancel: '拒绝' };
  }

  return null;
}

export default function NotificationsPage() {
  const nav = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<Notification | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [toast, setToast] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);

  const load = () =>
    api.listNotifications().then((data) => setItems(data as Notification[]));

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const openItem = async (item: Notification) => {
    if (!item.read) {
      await api.markNotificationRead(item.id);
      setItems((prev) =>
        prev.map((current) =>
          current.id === item.id ? { ...current, read: true } : current,
        ),
      );
    }

    if (item.link) nav(item.link);
  };

  const markAllRead = async () => {
    await api.markAllNotificationsRead();
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    setToast('已全部标为已读');
  };

  const handleAction = async (item: Notification, accept: boolean) => {
    if (!item.refId) return;
    setActingId(item.id);

    try {
      if (item.type === 'friend_request') {
        await api.resolveFriendRequest(item.refId, accept);
        setToast(accept ? '已同意好友申请' : '已拒绝好友申请');
      } else if (
        item.type === 'invite_received' ||
        item.type === 'room_invite_received' ||
        item.type === 'room_join_request_received'
      ) {
        const result = (await api.resolveInvite(item.refId, accept)) as {
          status?: string;
          party?: { chatRoom?: { id: string } };
        };

        if (
          accept &&
          item.type === 'invite_received' &&
          result.status === 'accepted' &&
          result.party?.chatRoom?.id
        ) {
          await api.markNotificationRead(item.id).catch(() => {});
          nav(`/chat/${result.party.chatRoom.id}`);
          return;
        }

        if (accept && item.type === 'room_invite_received') {
          setToast(
            result.status === 'pending_leader'
              ? '已接受邀请，等待房主确认入队'
              : '已接受邀请',
          );
        } else if (accept) {
          setToast('已处理通知');
        } else {
          setToast('已拒绝');
        }
      }

      await api.markNotificationRead(item.id).catch(() => {});
      await load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : '操作失败');
    } finally {
      setActingId(null);
    }
  };

  const confirmDeleteNotification = async () => {
    if (!pendingDelete) return;

    setDeleting(true);
    try {
      await api.deleteNotification(pendingDelete.id);
      setItems((prev) => prev.filter((item) => item.id !== pendingDelete.id));
      setPendingDelete(null);
      setToast('已删除该条通知');
    } finally {
      setDeleting(false);
    }
  };

  const confirmDeleteAllNotifications = async () => {
    setDeletingAll(true);
    try {
      await api.deleteAllNotifications();
      setItems([]);
      setConfirmDeleteAll(false);
      setToast('已删除全部消息通知');
    } finally {
      setDeletingAll(false);
    }
  };

  if (loading) {
    return <div className="loading page-wrap">加载通知中...</div>;
  }

  const unread = items.filter((item) => !item.read).length;

  return (
    <div className="page-wrap">
      <ThemeToast message={toast} show={Boolean(toast)} onClose={() => setToast('')} />
      <ThemeConfirmModal
        open={pendingDelete !== null}
        title="删除通知"
        message={pendingDelete ? `确认删除“${pendingDelete.title}”吗？` : ''}
        confirmLabel="确认删除"
        confirming={deleting}
        onConfirm={() => void confirmDeleteNotification()}
        onCancel={() => {
          if (!deleting) setPendingDelete(null);
        }}
      />
      <ThemeConfirmModal
        open={confirmDeleteAll}
        title="删除全部消息"
        message="确认删除全部消息通知吗？删除后将无法恢复。"
        confirmLabel="删除全部"
        confirming={deletingAll}
        onConfirm={() => void confirmDeleteAllNotifications()}
        onCancel={() => {
          if (!deletingAll) setConfirmDeleteAll(false);
        }}
      />

      <PageHeader
        title="消息通知"
        subtitle="组队申请、好友动态和邀约提醒都会出现在这里"
      />

      {(unread > 0 || items.length > 0) && (
        <div className="notifications-toolbar">
          {unread > 0 && (
            <button
              type="button"
              className="ghost small-btn"
              onClick={() => void markAllRead()}
            >
              全部标为已读
            </button>
          )}
          {items.length > 0 && (
            <button
              type="button"
              className="ghost small-btn"
              onClick={() => setConfirmDeleteAll(true)}
            >
              删除全部消息
            </button>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          variant="search"
          title="暂无通知"
          description="有新的申请、邀约或提醒时，会第一时间出现在这里"
        />
      ) : (
        <ul className="notification-list">
          {items.map((item) => (
            <li key={item.id} className="notification-list-item">
              <button
                type="button"
                className={`notification-item glass-panel ${item.read ? 'read' : 'unread'}`}
                onClick={() => void openItem(item)}
              >
                <div className="notification-item-head">
                  <strong>{item.title}</strong>
                  {!item.read && <span className="notification-dot" aria-hidden />}
                </div>
                <p className="muted small">{item.message}</p>
                <time className="muted small">
                  {new Date(item.createdAt).toLocaleString('zh-CN')}
                </time>
                {item.link && (
                  <span className="notification-link-hint small">点击查看 →</span>
                )}
              </button>

              {getNotificationActionText(item.type) && item.refId && (
                <div className="notification-action-row">
                  <button
                    type="button"
                    disabled={actingId === item.id}
                    onClick={() => void handleAction(item, true)}
                  >
                    {getNotificationActionText(item.type)?.confirm}
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    disabled={actingId === item.id}
                    onClick={() => void handleAction(item, false)}
                  >
                    {getNotificationActionText(item.type)?.cancel}
                  </button>
                </div>
              )}

              <button
                type="button"
                className="ghost notification-delete-btn"
                aria-label="删除通知"
                onClick={() => setPendingDelete(item)}
              >
                删除
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="muted small notifications-footer">
        你也可以从顶部导航进入
        <Link to="/lfg"> 找搭子帖 </Link>、
        <Link to="/invites"> 邀约 </Link>、
        <Link to="/friends"> 好友 </Link>
        查看相关详情。
      </p>
    </div>
  );
}
