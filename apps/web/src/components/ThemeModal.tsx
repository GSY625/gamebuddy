import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { lockBodyScroll, unlockBodyScroll } from '../utils/scrollLock';

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** 点击遮罩是否关闭，确认类弹窗应设为 false */
  closeOnBackdrop?: boolean;
};

export function ThemeModal({
  open,
  title,
  onClose,
  children,
  footer,
  closeOnBackdrop = true,
}: Props) {
  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="theme-modal-backdrop"
      role="presentation"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className="theme-modal glass-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="theme-modal-title" className="theme-modal-title">
          {title}
        </h3>
        <div className="theme-modal-body">{children}</div>
        {footer && <div className="theme-modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
