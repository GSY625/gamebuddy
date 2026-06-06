import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserAvatar } from './UserAvatar';

type Props = {
  userId: string;
  url?: string | null;
  name?: string;
  size?: number;
  className?: string;
  status?: 'online' | 'invisible';
};

/** 点击头像进入用户主页（自己则进入「我的资料」），全站通用 */
export function UserAvatarLink({
  userId,
  url,
  name = '',
  size = 36,
  className = '',
  status,
}: Props) {
  const nav = useNavigate();
  const { user } = useAuth();

  const openProfile = () => {
    if (userId === user?.id) {
      nav('/profile');
      return;
    }
    nav(`/users/${userId}`);
  };

  return (
    <button
      type="button"
      className="user-avatar-link"
      onClick={openProfile}
      aria-label={name ? `查看 ${name} 的主页` : '查看用户主页'}
    >
      <UserAvatar
        url={url}
        name={name}
        size={size}
        className={className}
        status={status}
      />
    </button>
  );
}
