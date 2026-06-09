import type { CSSProperties } from 'react';

type Variant = 'wave' | 'sleep' | 'party' | 'search' | 'chat';

type Props = {
  variant?: Variant;
  className?: string;
  style?: CSSProperties;
  brandText?: string;
  lookAt?: {
    x: number;
    y: number;
  };
  privacyMode?: boolean;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** 原创萌系搭子小精灵 SVG，与暗色主题统一 */
export function MascotSvg({
  variant = 'wave',
  className = '',
  style,
  brandText,
  lookAt,
  privacyMode = false,
}: Props) {
  const eyeY = variant === 'sleep' ? 52 : 48;
  const lookX = clamp(lookAt?.x ?? 0, -1.6, 1.6);
  const lookY = clamp(lookAt?.y ?? 0, -1.15, 1.15);

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
      style={style}
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
        <linearGradient id="mascotBrandBadge" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
        <filter id="mascotBrandGlow" x="-40%" y="-80%" width="180%" height="260%">
          <feGaussianBlur stdDeviation="1.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {accessory}
      <ellipse cx="28" cy="32" rx="10" ry="14" fill="url(#mascotEar)" />
      <ellipse cx="72" cy="32" rx="10" ry="14" fill="url(#mascotEar)" />
      <circle cx="50" cy="55" r="28" fill="url(#mascotBody)" />
      <ellipse cx="50" cy="62" rx="18" ry="12" fill="#fff" opacity={privacyMode ? 0.18 : 0.35} />

      {privacyMode ? (
        <>
          <path
            d="M36 49 Q50 39 64 49"
            stroke="#ffffff"
            strokeOpacity="0.32"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M42 60 Q50 66 58 60"
            stroke="#7c3aed"
            strokeOpacity="0.24"
            strokeWidth="2.4"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M39 66 Q50 70 61 66"
            stroke="#ffffff"
            strokeOpacity="0.18"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
        </>
      ) : variant === 'sleep' ? (
        <>
          <path d="M38 52 Q42 48 46 52" stroke="#2d2640" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M54 52 Q58 48 62 52" stroke="#2d2640" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="42" cy={eyeY} rx="5.4" ry="5.9" fill="#ffffff" />
          <ellipse cx="58" cy={eyeY} rx="5.4" ry="5.9" fill="#ffffff" />
          <g transform={`translate(${lookX}, ${lookY})`}>
            <circle cx="42" cy={eyeY} r="2.45" fill="#2d2640" />
            <circle cx="58" cy={eyeY} r="2.45" fill="#2d2640" />
          </g>
          <circle cx="43.4" cy={eyeY - 1.7} r="0.9" fill="#fff" opacity="0.92" />
          <circle cx="59.4" cy={eyeY - 1.7} r="0.9" fill="#fff" opacity="0.92" />
        </>
      )}

      {!privacyMode && (
        <>
          <path
            d="M44 58 Q50 62 56 58"
            stroke="#2d2640"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
          <ellipse cx="35" cy="58" rx="4" ry="2.5" fill="#fda4af" opacity="0.5" />
          <ellipse cx="65" cy="58" rx="4" ry="2.5" fill="#fda4af" opacity="0.5" />
        </>
      )}

      {variant === 'wave' && !privacyMode && (
        <g transform={`translate(78,48) rotate(${lookX * 3 - 10})`}>
          <ellipse cx="0" cy="0" rx="6" ry="8" fill="url(#mascotBody)" />
        </g>
      )}
      {brandText && (
        <g
          transform={`translate(${lookX * 0.8}, 0)`}
          opacity={privacyMode ? 0.92 : 1}
        >
          <ellipse
            cx="50"
            cy="67.8"
            rx="18"
            ry="8"
            fill="#120d1d"
            opacity="0.18"
          />
          <rect
            x="31.5"
            y="61.8"
            width="37"
            height="12.8"
            rx="6.4"
            fill="url(#mascotBrandBadge)"
            stroke="rgba(255,255,255,0.32)"
            strokeWidth="0.9"
            filter="url(#mascotBrandGlow)"
          />
          <path
            d="M35 62.5 Q50 58.8 65 62.5"
            fill="rgba(255,255,255,0.14)"
          />
          <text
            x="50"
            y="70.2"
            textAnchor="middle"
            fontSize="6.9"
            fontWeight="800"
            letterSpacing="0.35"
            fill="#fff8ff"
            style={{ fontFamily: '"Nunito", "Microsoft YaHei", sans-serif' }}
          >
            {brandText}
          </text>
        </g>
      )}
      <rect x="38" y="78" width="24" height="14" rx="4" fill="#7c3aed" opacity="0.85" />
      <circle cx="44" cy="92" r="3" fill="#a78bfa" />
      <circle cx="56" cy="92" r="3" fill="#a78bfa" />
    </svg>
  );
}
