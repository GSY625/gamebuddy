import { useEffect, useState } from 'react';

type Props = {
  url?: string | null;
  name?: string;
  size?: number;
  className?: string;
  /** 在线状态指示（绿/灰） */
  status?: 'online' | 'invisible';
};

export function UserAvatar({
  url,
  name = '',
  size = 36,
  className = '',
  status,
}: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  useEffect(() => {
    setImgFailed(false);
  }, [url]);

  const statusClass =
    status === 'online'
      ? 'user-avatar-status-online'
      : status === 'invisible'
        ? 'user-avatar-status-invisible'
        : '';

  const canShowImage = Boolean(url) && !imgFailed;

  return (
    <span
      className={`user-avatar ${statusClass} ${className}`.trim()}
      style={{ width: size, height: size }}
      aria-hidden={!name}
    >
      {canShowImage ? (
        <img
          src={url ?? undefined}
          alt={name ? `${name}的头像` : '头像'}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="user-avatar-fallback">{initial}</span>
      )}
    </span>
  );
}
