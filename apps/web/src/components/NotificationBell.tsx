import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { api, getToken } from '@gamebuddy/api-client';
import { WS_URL } from '../utils/runtimeEnv';

export function NotificationBell() {
  const [count, setCount] = useState(0);

  const refresh = () => {
    api.notificationUnreadCount().then((r) => setCount(r.count)).catch(() => {});
  };

  useEffect(() => {
    refresh();
    const socket = io(WS_URL, { auth: { token: getToken() } });
    socket.on('notification:update', (payload: { unreadCount?: number }) => {
      if (typeof payload.unreadCount === 'number') {
        setCount(payload.unreadCount);
      } else {
        refresh();
      }
    });
    const timer = setInterval(refresh, 60000);
    return () => {
      socket.disconnect();
      clearInterval(timer);
    };
  }, []);

  return (
    <Link to="/notifications" className="notification-bell" title="消息通知">
      <span className="notification-bell-icon" aria-hidden>
        🔔
      </span>
      {count > 0 && (
        <span className="notification-bell-badge">{count > 99 ? '99+' : count}</span>
      )}
    </Link>
  );
}
