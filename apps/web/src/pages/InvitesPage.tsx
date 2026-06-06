import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@gamebuddy/api-client';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { useOnlineGuard } from '../hooks/useOnlineGuard';

type ReceivedInvite = {
  id: string;
  message?: string;
  status: string;
  createdAt: string;
  partyId?: string | null;
  actionMode?: 'receiver' | 'leader';
  sender: { id: string; nickname: string };
  receiver?: { id: string; nickname: string };
  party?: {
    chatRoom?: { id: string; name?: string | null; roomCode?: string | null };
  } | null;
};

type SentInvite = {
  id: string;
  message?: string;
  status: string;
  createdAt: string;
  partyId?: string | null;
  receiver: { id: string; nickname: string };
  party?: {
    chatRoom?: { id: string; name?: string | null; roomCode?: string | null };
  } | null;
};

type Tab = 'received' | 'sent';

function inviteStatusLabel(status: string) {
  if (status === 'pending') return '待对方处理';
  if (status === 'pending_leader') return '待房主确认';
  if (status === 'accepted') return '已通过';
  if (status === 'rejected') return '已拒绝';
  return status;
}

function inviteKindLabel(inv: { partyId?: string | null }) {
  return inv.partyId ? '聊天室邀请' : '组队邀约';
}

export default function InvitesPage() {
  const [tab, setTab] = useState<Tab>('received');
  const [invites, setInvites] = useState<ReceivedInvite[]>([]);
  const [sent, setSent] = useState<SentInvite[]>([]);
  const nav = useNavigate();
  const { guard } = useOnlineGuard();

  const loadReceived = () =>
    api.receivedInvites().then((data) => setInvites(data as ReceivedInvite[]));

  const loadSent = () =>
    api.sentInvites().then((data) => setSent(data as SentInvite[]));

  useEffect(() => {
    void loadReceived();
    void loadSent();
  }, []);

  const resolve = (invite: ReceivedInvite, accept: boolean) => {
    guard(async () => {
      const res = (await api.resolveInvite(invite.id, accept)) as {
        status?: string;
        party?: { chatRoom?: { id: string } };
      };
      if (
        accept &&
        invite.actionMode === 'receiver' &&
        res.status === 'accepted' &&
        res.party?.chatRoom?.id
      ) {
        nav(`/chat/${res.party.chatRoom.id}`);
      }
      void loadReceived();
      void loadSent();
    });
  };

  return (
    <div className="page-wrap">
      <PageHeader
        title="邀约"
        subtitle="组队邀约会直接创建新队伍；聊天室邀请需要好友先接受，再由房主确认后才能入队"
      />
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
            title="还没有邀约哦"
            description="去游戏分区筛选玩家发起组队，或在聊天室邀请好友吧"
          />
        ) : (
          <ul className="post-list">
            {invites.map((inv) => {
              const isLeaderApproval = inv.actionMode === 'leader';
              const isReceiverWaitingLeader =
                inv.actionMode === 'receiver' && inv.status === 'pending_leader';
              const roomName = inv.party?.chatRoom?.name ?? '未命名聊天室';

              return (
                <li key={inv.id} className="post-card glass-panel">
                  <span className="invite-kind-badge">{inviteKindLabel(inv)}</span>
                  <strong>
                    {isLeaderApproval
                      ? `${inv.receiver?.nickname ?? '该用户'} 申请加入聊天室`
                      : inv.sender.nickname}
                  </strong>
                  {inv.partyId && inv.party?.chatRoom && (
                    <p className="muted small">
                      聊天室：{roomName}
                      {inv.party.chatRoom.roomCode && (
                        <>
                          {' '}
                          · ID <code className="room-code-inline">{inv.party.chatRoom.roomCode}</code>
                        </>
                      )}
                    </p>
                  )}
                  {isLeaderApproval ? (
                    <p className="muted small">
                      {inv.sender.nickname} 邀请了 {inv.receiver?.nickname ?? '该用户'}，对方已接受，等待你审批。
                    </p>
                  ) : isReceiverWaitingLeader ? (
                    <p className="muted small">你已接受邀请，当前正在等待房主审批。</p>
                  ) : inv.message ? (
                    <p>{inv.message}</p>
                  ) : !inv.partyId ? (
                    <p className="muted small">对方向你发起了组队邀约</p>
                  ) : (
                    <p className="muted small">接受后会提交给房主审批，通过后才会加入聊天室</p>
                  )}
                  {isReceiverWaitingLeader ? (
                    <p className="muted small">
                      当前状态：<span className={`status-badge status-${inv.status}`}>{inviteStatusLabel(inv.status)}</span>
                    </p>
                  ) : (
                    <div className="actions">
                      <button type="button" onClick={() => resolve(inv, true)}>
                        {isLeaderApproval ? '同意入队' : '接受'}
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => resolve(inv, false)}
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
            description="在游戏分区找到玩家后可以发起邀约，或在聊天室邀请好友"
          />
        ) : (
          <ul className="post-list">
            {sent.map((inv) => (
              <li key={inv.id} className="post-card glass-panel">
                <span className="invite-kind-badge">{inviteKindLabel(inv)}</span>
                <strong>发给 {inv.receiver.nickname}</strong>
                {inv.partyId && inv.party?.chatRoom && (
                  <p className="muted small">
                    聊天室：{inv.party.chatRoom.name ?? '未命名聊天室'}
                  </p>
                )}
                {inv.message && <p>{inv.message}</p>}
                <p className="muted small">
                  状态：
                  <span className={`status-badge status-${inv.status}`}>
                    {inviteStatusLabel(inv.status)}
                  </span>
                  {' · '}
                  {new Date(inv.createdAt).toLocaleString('zh-CN')}
                </p>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
