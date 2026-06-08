import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { api, getToken } from '@gamebuddy/api-client';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { ThemeModal } from '../components/ThemeModal';
import { ThemeAlertModal } from '../components/ThemeAlertModal';
import { useOnlineGuard } from '../hooks/useOnlineGuard';
import { WS_URL } from '../utils/runtimeEnv';

type Party = {
  id: string;
  voiceHint?: string;
  members: Array<{ user: { nickname: string } }>;
  chatRoom?: { id: string; roomCode?: string; name?: string; unreadCount?: number };
};

export default function PartiesPage() {
  const [parties, setParties] = useState<Party[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [creating, setCreating] = useState(false);
  const [alert, setAlert] = useState<string | null>(null);
  const nav = useNavigate();
  const { guard } = useOnlineGuard();

  const load = () => api.listParties().then((data) => setParties(data as Party[]));

  useEffect(() => {
    void load();
    const socket = io(WS_URL, { auth: { token: getToken() } });
    socket.on('room:unread', () => {
      void load();
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  const handleCreate = () => {
    guard(async () => {
      setCreating(true);
      try {
        const party = await api.createParty(
          roomName.trim() ? { name: roomName.trim() } : undefined,
        );
        setCreateOpen(false);
        setRoomName('');
        if (party.chatRoom?.id) {
          nav(`/chat/${party.chatRoom.id}`);
        } else {
          void load();
        }
      } catch (err) {
        setAlert(err instanceof Error ? err.message : '创建失败');
      } finally {
        setCreating(false);
      }
    });
  };

  return (
    <div className="page-wrap">
      <PageHeader title="我的队伍" subtitle="在这里创建聊天室，或进入已有队伍聊天">
        <button type="button" onClick={() => setCreateOpen(true)}>
          创建聊天室
        </button>
      </PageHeader>
      {parties.length === 0 ? (
        <EmptyState
          variant="party"
          title="还没有队伍呢"
          description="点击上方「创建聊天室」，或接受邀约、找搭子后队伍会出现在这里～"
        />
      ) : (
        <ul className="post-list">
          {parties.map((p) => {
            const unread = p.chatRoom?.unreadCount ?? 0;
            return (
              <li key={p.id} className="post-card glass-panel">
                <p>
                  成员：{p.members.map((m) => m.user.nickname).join('、')}
                </p>
                {p.voiceHint && (
                  <p className="voice-hint">语音房间：{p.voiceHint}</p>
                )}
                {p.chatRoom && (
                  <>
                    {p.chatRoom.roomCode && (
                      <p className="muted small">
                        聊天室：{p.chatRoom.name ?? '未命名'} · ID{' '}
                        <code className="room-code-inline">{p.chatRoom.roomCode}</code>
                      </p>
                    )}
                    <div className="party-chat-entry">
                      <Link to={`/chat/${p.chatRoom.id}`} className="btn-link">
                        进入聊天室
                      </Link>
                      {unread > 0 && (
                        <span className="party-unread-badge">
                          {unread > 99 ? '99+' : unread} 条未读
                        </span>
                      )}
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ThemeModal
        open={createOpen}
        title="创建聊天室"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <button type="button" className="ghost" onClick={() => setCreateOpen(false)}>
              取消
            </button>
            <button
              type="button"
              className="btn-primary theme-modal-submit"
              disabled={creating}
              onClick={() => void handleCreate()}
            >
              {creating ? '创建中…' : '创建并进入'}
            </button>
          </>
        }
      >
        <p className="muted small">创建后你可以邀请好友加入聊天室</p>
        <div className="form-field">
          <span className="form-field-label">聊天室名称（可选）</span>
          <input
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="例：今晚开黑"
            maxLength={32}
          />
        </div>
      </ThemeModal>

      <ThemeAlertModal
        open={Boolean(alert)}
        message={alert ?? ''}
        onClose={() => setAlert(null)}
      />
    </div>
  );
}
