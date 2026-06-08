import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@gamebuddy/api-client';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { ThemeToast } from '../components/ThemeToast';
import { useOnlineGuard } from '../hooks/useOnlineGuard';

type ChatRoomPreview = {
  id: string;
  name?: string | null;
  roomCode?: string | null;
};

type InviteParty = {
  chatRoom?: ChatRoomPreview;
} | null;

type ReceivedInvite = {
  id: string;
  message?: string | null;
  status: string;
  createdAt: string;
  partyId?: string | null;
  actionMode?: 'receiver' | 'leader';
  sender: { id: string; nickname: string };
  receiver?: { id: string; nickname: string };
  party?: InviteParty;
};

type SentInvite = {
  id: string;
  message?: string | null;
  status: string;
  createdAt: string;
  partyId?: string | null;
  receiver: { id: string; nickname: string };
  party?: InviteParty;
};

type Tab = 'received' | 'sent';

function inviteStatusLabel(status: string) {
  if (status === 'pending') return '待对方处理';
  if (status === 'pending_leader') return '待房主审批';
  if (status === 'accepted') return '已通过';
  if (status === 'rejected') return '已拒绝';
  return status;
}

function inviteKindLabel(invite: { partyId?: string | null }) {
  return invite.partyId ? '聊天室邀请' : '组队邀约';
}

function getRoomName(room?: ChatRoomPreview) {
  return room?.name?.trim() || '未命名聊天室';
}

export default function InvitesPage() {
  const nav = useNavigate();
  const { guard } = useOnlineGuard();
  const [tab, setTab] = useState<Tab>('received');
  const [invites, setInvites] = useState<ReceivedInvite[]>([]);
  const [sent, setSent] = useState<SentInvite[]>([]);
  const [toast, setToast] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);

  const loadReceived = () =>
    api.receivedInvites().then((data) => setInvites(data as ReceivedInvite[]));

  const loadSent = () => api.sentInvites().then((data) => setSent(data as SentInvite[]));

  const reloadAll = () => Promise.all([loadReceived(), loadSent()]);

  useEffect(() => {
    void reloadAll();
  }, []);

  const summary = useMemo(() => {
    const pendingCount = invites.filter(
      (invite) => invite.actionMode === 'receiver' && invite.status === 'pending',
    ).length;
    const waitingLeaderCount =
      invites.filter(
        (invite) =>
          (invite.actionMode === 'receiver' && invite.status === 'pending_leader') ||
          invite.actionMode === 'leader',
      ).length + sent.filter((invite) => invite.status === 'pending_leader').length;
    const acceptedCount = sent.filter((invite) => invite.status === 'accepted').length;

    return { pendingCount, waitingLeaderCount, acceptedCount };
  }, [invites, sent]);

  const resolve = (invite: ReceivedInvite, accept: boolean) => {
    guard(async () => {
      setActingId(invite.id);
      try {
        const result = (await api.resolveInvite(invite.id, accept)) as {
          status?: string;
          party?: { chatRoom?: { id: string } };
        };

        if (!accept) {
          setToast('已拒绝邀约');
          return;
        }

        if (
          invite.actionMode === 'receiver' &&
          result.status === 'accepted' &&
          result.party?.chatRoom?.id
        ) {
          setToast('已接受邀约，正在进入聊天室');
          window.setTimeout(() => {
            nav(`/chat/${result.party?.chatRoom?.id}`);
          }, 250);
          return;
        }

        if (invite.actionMode === 'leader') {
          setToast('已同意入队，对方现在可以进入聊天室');
          return;
        }

        if (result.status === 'pending_leader') {
          setToast('已接受邀请，等待房主确认入队');
          return;
        }

        setToast('已处理邀约');
      } catch (err) {
        setToast(err instanceof Error ? err.message : '处理邀约失败');
      } finally {
        setActingId(null);
        void reloadAll();
      }
    });
  };

  return (
    <div className="page-wrap">
      <ThemeToast message={toast} show={Boolean(toast)} onClose={() => setToast('')} />
      <PageHeader
        title="邀约"
        subtitle="组队邀约可直接建队，聊天室邀请需要好友先接受，再由房主审批后入队"
      />

      <section className="invites-summary">
        <div className="glass-panel invite-summary-chip">
          <span className="muted small">待你处理</span>
          <strong>{summary.pendingCount}</strong>
        </div>
        <div className="glass-panel invite-summary-chip">
          <span className="muted small">待房主审批</span>
          <strong>{summary.waitingLeaderCount}</strong>
        </div>
        <div className="glass-panel invite-summary-chip">
          <span className="muted small">已通过</span>
          <strong>{summary.acceptedCount}</strong>
        </div>
      </section>

      <div className="tabs">
        <button
          type="button"
          className={tab === 'received' ? 'active' : ''}
          onClick={() => setTab('received')}
        >
          收到的邀约
          {invites.length > 0 && <span className="tab-badge">{invites.length}</span>}
        </button>
        <button
          type="button"
          className={tab === 'sent' ? 'active' : ''}
          onClick={() => setTab('sent')}
        >
          我发出的
        </button>
      </div>

      {tab === 'received' &&
        (invites.length === 0 ? (
          <EmptyState
            variant="search"
            title="还没有收到邀约"
            description="你在游戏分区、聊天室和好友页的互动，都会慢慢沉淀成新的组队机会"
          />
        ) : (
          <ul className="post-list">
            {invites.map((invite) => {
              const isLeaderApproval = invite.actionMode === 'leader';
              const isWaitingLeader =
                invite.actionMode === 'receiver' && invite.status === 'pending_leader';
              const room = invite.party?.chatRoom;

              return (
                <li key={invite.id} className="post-card glass-panel">
                  <span className="invite-kind-badge">{inviteKindLabel(invite)}</span>
                  <strong>
                    {isLeaderApproval
                      ? `${invite.receiver?.nickname ?? '该用户'} 申请加入聊天室`
                      : invite.sender.nickname}
                  </strong>

                  {invite.partyId && room && (
                    <p className="muted small">
                      聊天室：{getRoomName(room)}
                      {room.roomCode && (
                        <>
                          {' '}
                          · ID <code className="room-code-inline">{room.roomCode}</code>
                        </>
                      )}
                    </p>
                  )}

                  {isLeaderApproval ? (
                    <p className="muted small">
                      {invite.sender.nickname} 邀请了
                      {invite.receiver?.nickname ?? '该用户'}，对方已接受，现在等你审批入队。
                    </p>
                  ) : isWaitingLeader ? (
                    <p className="muted small">
                      你已经接受邀请，当前正在等待房主审批。
                    </p>
                  ) : invite.message?.trim() ? (
                    <p>{invite.message}</p>
                  ) : invite.partyId ? (
                    <p className="muted small">
                      接受后会先进入审批队列，房主同意后才能正式加入聊天室。
                    </p>
                  ) : (
                    <p className="muted small">对方向你发起了一次组队邀约。</p>
                  )}

                  <p className="muted small">
                    状态：
                    <span className={`status-badge status-${invite.status}`}>
                      {inviteStatusLabel(invite.status)}
                    </span>
                    {' · '}
                    {new Date(invite.createdAt).toLocaleString('zh-CN')}
                  </p>

                  {isWaitingLeader ? null : (
                    <div className="actions">
                      <button
                        type="button"
                        onClick={() => resolve(invite, true)}
                        disabled={actingId === invite.id}
                      >
                        {actingId === invite.id
                          ? '处理中...'
                          : isLeaderApproval
                            ? '同意入队'
                            : '接受'}
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => resolve(invite, false)}
                        disabled={actingId === invite.id}
                      >
                        {isLeaderApproval ? '拒绝入队' : '拒绝'}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ))}

      {tab === 'sent' &&
        (sent.length === 0 ? (
          <EmptyState
            variant="search"
            title="还没有发出邀约"
            description="找到合适的搭子后，可以从资料页、好友页或聊天室邀请对方一起开黑"
          />
        ) : (
          <ul className="post-list">
            {sent.map((invite) => {
              const room = invite.party?.chatRoom;
              const canEnterRoom = invite.status === 'accepted' && room?.id;

              return (
                <li key={invite.id} className="post-card glass-panel">
                  <span className="invite-kind-badge">{inviteKindLabel(invite)}</span>
                  <strong>发给 {invite.receiver.nickname}</strong>

                  {invite.partyId && room && (
                    <p className="muted small">
                      聊天室：{getRoomName(room)}
                      {room.roomCode && (
                        <>
                          {' '}
                          · ID <code className="room-code-inline">{room.roomCode}</code>
                        </>
                      )}
                    </p>
                  )}

                  {invite.message?.trim() && <p>{invite.message}</p>}

                  <p className="muted small">
                    状态：
                    <span className={`status-badge status-${invite.status}`}>
                      {inviteStatusLabel(invite.status)}
                    </span>
                    {' · '}
                    {new Date(invite.createdAt).toLocaleString('zh-CN')}
                  </p>

                  {canEnterRoom ? (
                    <div className="actions">
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => nav(`/chat/${room.id}`)}
                      >
                        进入聊天室
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ))}
    </div>
  );
}
