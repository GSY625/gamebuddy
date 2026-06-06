type Variant = 'wave' | 'sleep' | 'party' | 'search' | 'chat';

type Props = {
  variant?: Variant;
  className?: string;
};

/** 原创萌系搭子小精灵 SVG，与暗色主题统一 */
export function MascotSvg({ variant = 'wave', className = '' }: Props) {
  const eyeY = variant === 'sleep' ? 52 : 48;
  const eyePath =
    variant === 'sleep' ? (
      <>
        <path d="M38 52 Q42 48 46 52" stroke="#2d2640" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M54 52 Q58 48 62 52" stroke="#2d2640" strokeWidth="2" fill="none" strokeLinecap="round" />
      </>
    ) : (
      <>
        <circle cx="42" cy={eyeY} r="3" fill="#2d2640" />
        <circle cx="58" cy={eyeY} r="3" fill="#2d2640" />
        <circle cx="43" cy={eyeY - 1} r="1" fill="#fff" opacity="0.8" />
        <circle cx="59" cy={eyeY - 1} r="1" fill="#fff" opacity="0.8" />
      </>
    );

  const accessory =
    variant === 'party' ? (
      <text x="50" y="22" textAnchor="middle" fontSize="14">
        ✨
      </text>
    ) : variant === 'search' ? (
      <circle cx="72" cy="38" r="8" fill="none" stroke="#c084fc" strokeWidth="2" />
    ) : variant === 'chat' ? (
      <ellipse cx="78" cy="58" rx="10" ry="7" fill="#f9a8d4" opacity="0.9" />
    ) : null;

  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="搭子小精灵"
    >
      <defs>
        <linearGradient id="mascotBody" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e9d5ff" />
          <stop offset="100%" stopColor="#f9a8d4" />
        </linearGradient>
        <linearGradient id="mascotEar" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      {accessory}
      <ellipse cx="28" cy="32" rx="10" ry="14" fill="url(#mascotEar)" />
      <ellipse cx="72" cy="32" rx="10" ry="14" fill="url(#mascotEar)" />
      <circle cx="50" cy="55" r="28" fill="url(#mascotBody)" />
      <ellipse cx="50" cy="62" rx="18" ry="12" fill="#fff" opacity="0.35" />
      {eyePath}
      <path
        d="M44 58 Q50 64 56 58"
        stroke="#2d2640"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <ellipse cx="35" cy="58" rx="4" ry="2.5" fill="#fda4af" opacity="0.6" />
      <ellipse cx="65" cy="58" rx="4" ry="2.5" fill="#fda4af" opacity="0.6" />
      {variant === 'wave' && (
        <g transform="translate(78,48) rotate(-12)">
          <ellipse cx="0" cy="0" rx="6" ry="8" fill="url(#mascotBody)" />
        </g>
      )}
      <rect x="38" y="78" width="24" height="14" rx="4" fill="#7c3aed" opacity="0.85" />
      <circle cx="44" cy="92" r="3" fill="#a78bfa" />
      <circle cx="56" cy="92" r="3" fill="#a78bfa" />
    </svg>
  );
}
