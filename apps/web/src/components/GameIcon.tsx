type Props = {
  icon: string | null | undefined;
  name: string;
  className?: string;
};

/** 支持 /icons/xxx.png 图片路径或 emoji 回退 */
export function GameIcon({ icon, name, className = 'game-icon' }: Props) {
  const isImage =
    icon?.startsWith('/') || icon?.startsWith('http');

  if (isImage && icon) {
    return (
      <img
        src={icon}
        alt={name}
        className={`${className} game-icon-img`}
      />
    );
  }

  return <span className={className}>{icon ?? '🎮'}</span>;
}
