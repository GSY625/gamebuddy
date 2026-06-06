import { useEffect, useState } from 'react';
import { ThemeModal } from './ThemeModal';

type Props = {
  open: boolean;
  targetNickname?: string;
  submitting?: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (reason: string) => void;
};

export function ReportReasonModal({
  open,
  targetNickname,
  submitting = false,
  error,
  onClose,
  onSubmit,
}: Props) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  const handleSubmit = () => {
    const trimmed = reason.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <ThemeModal
      open={open}
      title="举报用户"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ghost" onClick={onClose} disabled={submitting}>
            取消
          </button>
          <button
            type="button"
            className="btn-primary theme-modal-submit"
            disabled={submitting || !reason.trim()}
            onClick={handleSubmit}
          >
            {submitting ? '提交中…' : '提交举报'}
          </button>
        </>
      }
    >
      {targetNickname && (
        <p className="muted small theme-modal-hint">
          举报对象：<strong>{targetNickname}</strong>
        </p>
      )}
      <div className="form-field theme-modal-field">
        <label className="form-field-label" htmlFor="report-reason">
          举报原因：
        </label>
        <textarea
          id="report-reason"
          className="report-reason-input"
          rows={4}
          placeholder="请简要说明举报原因，便于我们核实处理"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
        />
      </div>
      {error && <p className="error">{error}</p>}
    </ThemeModal>
  );
}
