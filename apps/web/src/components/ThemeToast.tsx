import { useEffect } from 'react';

type Props = {
  message: string;
  show: boolean;
  onClose: () => void;
  durationMs?: number;
  variant?: 'success' | 'warn';
};

export function ThemeToast({
  message,
  show,
  onClose,
  durationMs = 2600,
  variant = 'success',
}: Props) {
  useEffect(() => {
    if (!show) return;
    const t = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(t);
  }, [show, onClose, durationMs]);

  if (!show) return null;

  return (
    <div className="theme-toast-wrap" role="status" aria-live="polite">
      <div className={`theme-toast glass-panel theme-toast-${variant}`}>
        <span className={`theme-toast-icon theme-toast-icon-${variant}`} aria-hidden>
          {variant === 'warn' ? '!' : '✓'}
        </span>
        <span>{message}</span>
      </div>
    </div>
  );
}
