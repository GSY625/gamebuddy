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
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  const statusClass =
    status === 'online'
      ? 'user-avatar-status-online'
      : status === 'invisible'
        ? 'user-avatar-status-invisible'
        : '';

  return (
    <span
      className={`user-avatar ${statusClass} ${className}`.trim()}
      style={{ width: size, height: size }}
      aria-hidden={!name}
    >
      {url ? (
        <img src={url} alt={name ? `${name}的头像` : '头像'} />
      ) : (
        <span className="user-avatar-fallback">{initial}</span>
      )}
    </span>
  );
}
