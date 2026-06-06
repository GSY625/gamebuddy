import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@gamebuddy/api-client';
import { useAuth } from '../context/AuthContext';
import { ThemeAlertModal } from './ThemeAlertModal';
import { ThemeSelect } from './ThemeSelect';
import { UserAvatarLink } from './UserAvatarLink';

type SearchMode = 'nickname' | 'room';

const MODE_ITEMS = [
  { value: 'nickname', label: '昵称' },
  { value: 'room', label: '聊天室 ID' },
];

export function GlobalSearch() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<SearchMode>('nickname');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<
    Array<{ id: string; nickname: string; avatarUrl?: string }>
  >([]);
  const [room, setRoom] = useState<{
    roomId: string;
    roomCode: string;
    name: string | null;
    leaderNickname?: string;
    memberCount: number;
  } | null>(null);
  const [friendMap, setFriendMap] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    if (mode === 'nickname') {
      const list = await api.searchUsers(q);
      setUsers(list.filter((u) => u.id !== user?.id));
      setRoom(null);
      const map: Record<string, string> = {};
      for (const u of list) {
        if (u.id === user?.id) continue;
        const st = await api.friendStatus(u.id);
        map[u.id] = st.status;
      }
      setFriendMap(map);
    } else {
      const r = await api.searchRoom(q.toUpperCase());
      setRoom(r);
      setUsers([]);
    }
    setOpen(true);
  };

  const sendFriend = async (receiverId: string) => {
    try {
      await api.sendFriendRequest(receiverId);
      setFriendMap((m) => ({ ...m, [receiverId]: 'pending_sent' }));
      setAlert('好友申请已发送');
    } catch (err) {
      setAlert(err instanceof Error ? err.message : '发送失败');
    }
  };

  return (
    <div className="global-search" ref={wrapRef}>
      <ThemeAlertModal
        open={alert !== null}
        message={alert ?? ''}
        onClose={() => setAlert(null)}
      />
      <div className="global-search-bar">
        <ThemeSelect
          className="global-search-mode-select"
          value={mode}
          onChange={(v) => setMode(v as SearchMode)}
          items={MODE_ITEMS}
          required
        />
        <input
          className="global-search-input"
          placeholder={
            mode === 'nickname' ? '搜索用户昵称…' : '输入 8 位聊天室 ID…'
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void runSearch()}
          maxLength={mode === 'room' ? 8 : 32}
        />
        <button type="button" className="ghost global-search-btn" onClick={() => void runSearch()}>
          搜索
        </button>
      </div>
      {open && (
        <div className="global-search-results glass-panel">
          {mode === 'nickname' && users.length === 0 && (
            <p className="muted small">未找到用户</p>
          )}
          {mode === 'nickname' &&
            users.map((u) => (
              <div key={u.id} className="global-search-row">
                <UserAvatarLink
                  userId={u.id}
                  url={u.avatarUrl}
                  name={u.nickname}
                  size={32}
                />
                <Link
                  to={`/users/${u.id}`}
                  className="global-search-nickname"
                  onClick={() => setOpen(false)}
                >
                  {u.nickname}
                </Link>
                {friendMap[u.id] === 'friends' && (
                  <span className="muted small">已是好友</span>
                )}
                {friendMap[u.id] === 'pending_sent' && (
                  <span className="muted small">已申请</span>
                )}
                {friendMap[u.id] === 'pending_received' && (
                  <Link to="/friends" className="small-btn" onClick={() => setOpen(false)}>
                    去处理
                  </Link>
                )}
                {(!friendMap[u.id] || friendMap[u.id] === 'none') && (
                  <button
                    type="button"
                    className="ghost small-btn"
                    onClick={() => void sendFriend(u.id)}
                  >
                    加好友
                  </button>
                )}
              </div>
            ))}
          {mode === 'room' && !room && (
            <p className="muted small">未找到该聊天室 ID</p>
          )}
          {mode === 'room' && room && (
            <div className="global-search-room">
              <p>
                <strong>{room.name ?? '聊天室'}</strong>
              </p>
              <p className="muted small">
                ID: {room.roomCode} · {room.memberCount} 人
                {room.leaderNickname && ` · 房主 ${room.leaderNickname}`}
              </p>
              <Link
                to={`/chat/${room.roomId}`}
                className="btn-link"
                onClick={() => setOpen(false)}
              >
                进入聊天室
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
