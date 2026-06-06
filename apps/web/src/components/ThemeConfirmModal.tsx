import { ThemeModal } from './ThemeModal';

type Props = {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ThemeConfirmModal({
  open,
  title = '请确认',
  message,
  confirmLabel = '确定',
  cancelLabel = '取消',
  confirming = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <ThemeModal
      open={open}
      title={title}
      onClose={onCancel}
      closeOnBackdrop={false}
      footer={
        <>
          <button type="button" className="ghost" onClick={onCancel} disabled={confirming}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn-primary theme-modal-submit theme-modal-danger"
            disabled={confirming}
            onClick={onConfirm}
          >
            {confirming ? '处理中…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="theme-alert-message">{message}</p>
    </ThemeModal>
  );
}
