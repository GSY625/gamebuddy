import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { getToken } from '@gamebuddy/api-client';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AppShell } from './AppShell';
import { UserAvatar } from './UserAvatar';
import { UserStatusMenu } from './UserStatusMenu';
import { ThemeToast } from './ThemeToast';
import { GlobalSearch } from './GlobalSearch';
import { NotificationBell } from './NotificationBell';
import { useOnboarding } from '../context/OnboardingContext';
import { WS_URL } from '../utils/runtimeEnv';

export function Layout() {
  const { user, logout, visibilityStatus } = useAuth();
  const { startTour } = useOnboarding();
  const nav = useNavigate();
  const [copyToast, setCopyToast] = useState(false);
  const [globalNotify, setGlobalNotify] = useState<{
    title: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    const socket = io(WS_URL, { auth: { token: getToken() } });
    socket.on(
      'user:notify',
      (payload: { title: string; message: string; roomId?: string }) => {
        setGlobalNotify({
          title: payload.title,
          message: payload.message,
        });
      },
    );
    socket.on(
      'room:dissolved',
      (payload: { roomId: string; message: string }) => {
        setGlobalNotify({
          title: '聊天室已注销',
          message: payload.message ?? '房主已注销聊天室',
        });
      },
    );
    return () => {
      socket.disconnect();
    };
  }, [user]);

  const copyNickname = async () => {
    if (!user?.nickname) return;
    try {
      await navigator.clipboard.writeText(user.nickname);
      setCopyToast(true);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = user.nickname;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopyToast(true);
    }
  };

  return (
    <AppShell>
      <ThemeToast
        message="已复制到剪切板"
        show={copyToast}
        onClose={() => setCopyToast(false)}
      />
      <ThemeToast
        message={
          globalNotify
            ? `${globalNotify.title}：${globalNotify.message}`
            : ''
        }
        show={Boolean(globalNotify)}
        variant="warn"
        durationMs={5000}
        onClose={() => setGlobalNotify(null)}
      />
      <div className="app-shell">
        <header className="topbar glass-panel">
          <Link to="/" className="brand">
            <span className="brand-dot" />
            GameBuddy
          </Link>
          <nav>
            <Link to="/games">游戏分区</Link>
            <Link to="/lfg">找搭子帖</Link>
            <Link to="/invites">邀约</Link>
            <Link to="/parties">我的队伍</Link>
            <Link to="/friends">好友</Link>
            <Link to="/messages">私信</Link>
            {(user?.role === 'admin' || user?.role === 'superAdmin') && (
              <Link to="/admin">后台</Link>
            )}
            <button
              type="button"
              className="nav-guide-btn"
              onClick={() => void startTour()}
            >
              指引
            </button>
          </nav>
          <div className="user-area">
            {user && (
              <>
                <GlobalSearch />
                <NotificationBell />
                <UserStatusMenu />
                <div className="user-identity">
                  <Link to="/profile" className="user-avatar-link" title="我的资料">
                    <UserAvatar
                      url={user.avatarUrl}
                      name={user.nickname}
                      size={40}
                      status={visibilityStatus}
                    />
                  </Link>
                  <button
                    type="button"
                    className="user-pill user-pill-copy"
                    onClick={copyNickname}
                    title="点击复制昵称"
                  >
                    {user.nickname}
                  </button>
                </div>
                <button type="button" onClick={() => nav('/profile')}>
                  我的资料
                </button>
                <button type="button" className="ghost" onClick={logout}>
                  退出
                </button>
              </>
            )}
          </div>
        </header>
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </AppShell>
  );
}
