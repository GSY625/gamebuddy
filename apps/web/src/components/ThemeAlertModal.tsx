import { ThemeModal } from './ThemeModal';

type Props = {
  open: boolean;
  title?: string;
  message: string;
  onClose: () => void;
};

export function ThemeAlertModal({
  open,
  title = '提示',
  message,
  onClose,
}: Props) {
  return (
    <ThemeModal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <button type="button" className="btn-primary theme-modal-submit" onClick={onClose}>
          确定
        </button>
      }
    >
      <p className="theme-alert-message">{message}</p>
    </ThemeModal>
  );
}
