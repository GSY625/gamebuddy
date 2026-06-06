import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@gamebuddy/api-client';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { ThemeConfirmModal } from '../components/ThemeConfirmModal';

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  read: boolean;
  createdAt: string;
};

export default function NotificationsPage() {
  const nav = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<Notification | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = () =>
    api.listNotifications().then((data) => setItems(data as Notification[]));

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const openItem = async (n: Notification) => {
    if (!n.read) {
      await api.markNotificationRead(n.id);
      setItems((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)),
      );
    }
    if (n.link) nav(n.link);
  };

  const markAllRead = async () => {
    await api.markAllNotificationsRead();
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.deleteNotification(pendingDelete.id);
      setItems((prev) => prev.filter((x) => x.id !== pendingDelete.id));
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="loading page-wrap">加载通知…</div>;
  }

  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="page-wrap">
      <ThemeConfirmModal
        open={pendingDelete !== null}
        title="删除通知"
        message={
          pendingDelete ? `确认删除「${pendingDelete.title}」？` : ''
        }
        confirmLabel="确认删除"
        confirming={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          if (!deleting) setPendingDelete(null);
        }}
      />
      <PageHeader
        title="消息通知"
        subtitle="组队申请、好友与邀约的动态会出现在这里"
      />
      {unread > 0 && (
        <div className="notifications-toolbar">
          <button type="button" className="ghost small-btn" onClick={() => void markAllRead()}>
            全部标为已读
          </button>
        </div>
      )}
      {items.length === 0 ? (
        <EmptyState
          variant="search"
          title="暂无通知"
          description="有新的申请或邀约时会在这里提醒你"
        />
      ) : (
        <ul className="notification-list">
          {items.map((n) => (
            <li key={n.id} className="notification-list-item">
              <button
                type="button"
                className={`notification-item glass-panel ${n.read ? 'read' : 'unread'}`}
                onClick={() => void openItem(n)}
              >
                <div className="notification-item-head">
                  <strong>{n.title}</strong>
                  {!n.read && <span className="notification-dot" aria-hidden />}
                </div>
                <p className="muted small">{n.message}</p>
                <time className="muted small">
                  {new Date(n.createdAt).toLocaleString('zh-CN')}
                </time>
                {n.link && (
                  <span className="notification-link-hint small">点击查看 →</span>
                )}
              </button>
              <button
                type="button"
                className="ghost notification-delete-btn"
                aria-label="删除通知"
                onClick={() => setPendingDelete(n)}
              >
                删除
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small notifications-footer">
        也可从顶部导航进入
        <Link to="/lfg"> 找搭子帖 </Link>、
        <Link to="/invites"> 邀约 </Link>、
        <Link to="/friends"> 好友 </Link>
        查看详情
      </p>
    </div>
  );
}
