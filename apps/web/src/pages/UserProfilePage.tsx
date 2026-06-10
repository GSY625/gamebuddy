import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@gamebuddy/api-client';
import { BackButton } from '../components/BackButton';
import { PageHeader } from '../components/PageHeader';
import { ThemeToast } from '../components/ThemeToast';
import { UserAvatar } from '../components/UserAvatar';
import { useAuth } from '../context/AuthContext';
import { prefetchDirectConversation } from '../features/directMessages/cache';
import { usePlayerSafety } from '../hooks/usePlayerSafety';

type PublicUser = {
  id: string;
  nickname: string;
  avatarUrl?: string | null;
  bio?: string | null;
  isVip?: boolean;
  emailVerified?: boolean;
  online?: boolean;
};

export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const nav = useNavigate();
  const { user: me } = useAuth();
  const safety = usePlayerSafety();
  const [profile, setProfile] = useState<PublicUser | null>(null);
  const [friendStatus, setFriendStatus] = useState<string>('none');
  const [requestId, setRequestId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [openingConversation, setOpeningConversation] = useState(false);

  useEffect(() => {
    if (!userId) return;
    if (userId === me?.id) {
      nav('/profile', { replace: true });
      return;
    }

    setLoading(true);
    Promise.all([api.getUser(userId), api.friendStatus(userId)])
      .then(([nextProfile, status]) => {
        setProfile(nextProfile as PublicUser);
        setFriendStatus(status.status);
        setRequestId(status.requestId);
      })
      .catch(() => {
        nav(-1);
      })
      .finally(() => setLoading(false));
  }, [userId, me?.id, nav]);

  const sendFriend = async () => {
    if (!userId) return;
    try {
      await api.sendFriendRequest(userId);
      setFriendStatus('pending_sent');
      setToast('好友申请已发送');
    } catch (err) {
      safety.showAlert(err instanceof Error ? err.message : '发送失败');
    }
  };

  const acceptFriend = async () => {
    if (!requestId) return;
    try {
      await api.resolveFriendRequest(requestId, true);
      setFriendStatus('friends');
      setToast('已添加好友');
    } catch (err) {
      safety.showAlert(err instanceof Error ? err.message : '操作失败');
    }
  };

  const openDirectMessage = async () => {
    if (!profile) return;
    setOpeningConversation(true);
    try {
      await prefetchDirectConversation(profile.id);
      nav(`/messages/${profile.id}`);
    } catch (err) {
      safety.showAlert(err instanceof Error ? err.message : '打开私信失败');
    } finally {
      setOpeningConversation(false);
    }
  };

  if (loading) {
    return <div className="loading page-wrap">加载中...</div>;
  }

  if (!profile) return null;

  return (
    <div className="page-wrap page-with-back user-profile-page">
      {safety.modals}
      <BackButton fallback="/friends" />
      <ThemeToast message={toast} show={Boolean(toast)} onClose={() => setToast('')} />
      <PageHeader title="用户主页" subtitle="查看搭子资料" />

      <div className="glass-panel user-profile-card">
        <UserAvatar
          url={profile.avatarUrl}
          name={profile.nickname}
          size={96}
          className="profile-avatar-lg"
          status={profile.online ? 'online' : 'invisible'}
        />

        <h2 className="user-profile-nickname">
          {profile.nickname}
          {profile.isVip && <span className="vip-badge">VIP</span>}
        </h2>

        <p className={`user-profile-status ${profile.online ? 'online' : ''}`}>
          {profile.online ? '在线' : '离线'}
        </p>

        <div className="user-profile-meta-chips">
          <span
            className={`profile-verify-badge ${profile.emailVerified ? 'verified' : 'pending'}`}
          >
            {profile.emailVerified ? '邮箱已验证' : '邮箱未验证'}
          </span>
          <span className="user-profile-meta-chip">
            {profile.bio?.trim() ? '资料较完整' : '资料待完善'}
          </span>
        </div>

        <p className="user-profile-bio">
          {profile.bio?.trim() ? profile.bio : '这个人还没有留下自我介绍。'}
        </p>

        <div className="user-profile-actions">
          {friendStatus === 'friends' && (
            <>
              <span className="muted">已经是好友</span>
              <button
                type="button"
                className="ghost"
                disabled={openingConversation}
                onClick={() => void openDirectMessage()}
              >
                {openingConversation ? '打开中...' : '私信'}
              </button>
            </>
          )}

          {friendStatus === 'pending_sent' && <span className="muted">好友申请已发送</span>}

          {friendStatus === 'pending_received' && (
            <button type="button" onClick={() => void acceptFriend()}>
              同意好友申请
            </button>
          )}

          {friendStatus === 'none' && (
            <button type="button" onClick={() => void sendFriend()}>
              加好友
            </button>
          )}
        </div>

        <div className="user-profile-safety actions">
          <button
            type="button"
            className="ghost"
            onClick={() => safety.openReport(profile.id, profile.nickname)}
          >
            举报
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => safety.requestBlock(profile.id, profile.nickname)}
          >
            拉黑
          </button>
        </div>
      </div>
    </div>
  );
}
