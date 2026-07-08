import { useEffect, useState } from 'react';

type Props = {
  url?: string | null;
  name?: string;
  size?: number;
  className?: string;
  /** 在线状态指示（绿/灰） */
  status?: 'online' | 'invisible';
};

type ImageState = 'idle' | 'loading' | 'loaded' | 'failed';

export function UserAvatar({
  url,
  name = '',
  size = 36,
  className = '',
  status,
}: Props) {
  const normalizedUrl = url?.trim() ?? '';
  const [imageState, setImageState] = useState<ImageState>(
    normalizedUrl ? 'loading' : 'idle',
  );
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  useEffect(() => {
    if (!normalizedUrl) {
      setImageState('idle');
      return;
    }

    let cancelled = false;
    const image = new window.Image();
    setImageState('loading');

    image.onload = () => {
      if (!cancelled) {
        setImageState('loaded');
      }
    };
    image.onerror = () => {
      if (!cancelled) {
        setImageState('failed');
      }
    };
    image.src = normalizedUrl;

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [normalizedUrl]);

  const statusClass =
    status === 'online'
      ? 'user-avatar-status-online'
      : status === 'invisible'
        ? 'user-avatar-status-invisible'
        : '';

  const canShowImage = imageState === 'loaded';

  return (
    <span
      className={`user-avatar ${statusClass} ${className}`.trim()}
      style={{ width: size, height: size }}
      aria-hidden={!name}
    >
      {canShowImage ? (
        <img src={normalizedUrl} alt="" aria-hidden="true" />
      ) : (
        <span className="user-avatar-fallback">{initial}</span>
      )}
    </span>
  );
}
