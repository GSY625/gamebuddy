import { useCallback, useState } from 'react';
import { api } from '@gamebuddy/api-client';
import { ReportReasonModal } from '../components/ReportReasonModal';
import { ThemeAlertModal } from '../components/ThemeAlertModal';
import { ThemeConfirmModal } from '../components/ThemeConfirmModal';

type UserTarget = {
  userId: string;
  nickname?: string;
  targetType?: string;
  targetId?: string;
  detail?: string;
  modalTitle?: string;
  hint?: string;
};

type AlertState = { title?: string; message: string };

export const BLOCKED_BY_PLAYER_MSG = '您已被该玩家拉黑';

export function usePlayerSafety() {
  const [reportTarget, setReportTarget] = useState<UserTarget | null>(null);
  const [blockConfirm, setBlockConfirm] = useState<UserTarget | null>(null);
  const [reportError, setReportError] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [blockSubmitting, setBlockSubmitting] = useState(false);
  const [alert, setAlert] = useState<AlertState | null>(null);

  const showAlert = useCallback((message: string, title?: string) => {
    setAlert({ message, title });
  }, []);

  const showInviteError = useCallback(
    (message: string) => {
      const normalized =
        message.includes('拉黑') && message !== BLOCKED_BY_PLAYER_MSG
          ? BLOCKED_BY_PLAYER_MSG
          : message;
      showAlert(normalized, normalized === BLOCKED_BY_PLAYER_MSG ? '无法发送邀请' : '提示');
    },
    [showAlert],
  );

  const openReport = useCallback(
    (
      userId: string,
      nickname?: string,
      options?: {
        targetType?: string;
        targetId?: string;
        detail?: string;
        modalTitle?: string;
        hint?: string;
      },
    ) => {
      setReportError('');
      setReportTarget({
        userId,
        nickname,
        targetType: options?.targetType,
        targetId: options?.targetId,
        detail: options?.detail,
        modalTitle: options?.modalTitle,
        hint: options?.hint,
      });
    },
    [],
  );

  const closeReport = useCallback(() => {
    if (reportSubmitting) return;
    setReportTarget(null);
    setReportError('');
  }, [reportSubmitting]);

  const submitReport = useCallback(
    async (reason: string) => {
      if (!reportTarget) return;
      setReportSubmitting(true);
      setReportError('');
      try {
        await api.report({
          reportedId: reportTarget.userId,
          reason,
          detail: reportTarget.detail,
          targetType: reportTarget.targetType,
          targetId: reportTarget.targetId,
        });
        setReportTarget(null);
        showAlert('举报已提交，我们会尽快处理', '举报成功');
      } catch (err) {
        setReportError(err instanceof Error ? err.message : '提交失败');
      } finally {
        setReportSubmitting(false);
      }
    },
    [reportTarget, showAlert],
  );

  const requestBlock = useCallback((userId: string, nickname?: string) => {
    setBlockConfirm({ userId, nickname });
  }, []);

  const cancelBlock = useCallback(() => {
    if (blockSubmitting) return;
    setBlockConfirm(null);
  }, [blockSubmitting]);

  const confirmBlock = useCallback(async () => {
    if (!blockConfirm) return;
    setBlockSubmitting(true);
    try {
      await api.block(blockConfirm.userId);
      const who = blockConfirm.nickname ? `「${blockConfirm.nickname}」` : '该玩家';
      setBlockConfirm(null);
      showAlert(`已将${who}加入黑名单，双方将无法互相发送邀请`, '拉黑成功');
    } catch (err) {
      showAlert(err instanceof Error ? err.message : '拉黑失败');
    } finally {
      setBlockSubmitting(false);
    }
  }, [blockConfirm, showAlert]);

  const blockConfirmMessage = blockConfirm?.nickname
    ? `是否将「${blockConfirm.nickname}」拉黑？拉黑后双方将无法互相发送邀请。`
    : '是否将该玩家拉黑？拉黑后双方将无法互相发送邀请。';

  const modals = (
    <>
      <ReportReasonModal
        open={reportTarget !== null}
        title={reportTarget?.modalTitle}
        hint={reportTarget?.hint}
        targetNickname={reportTarget?.nickname}
        submitting={reportSubmitting}
        error={reportError}
        onClose={closeReport}
        onSubmit={submitReport}
      />
      <ThemeConfirmModal
        open={blockConfirm !== null}
        title="拉黑确认"
        message={blockConfirmMessage}
        confirmLabel="确认拉黑"
        confirming={blockSubmitting}
        onConfirm={() => void confirmBlock()}
        onCancel={cancelBlock}
      />
      <ThemeAlertModal
        open={alert !== null}
        title={alert?.title}
        message={alert?.message ?? ''}
        onClose={() => setAlert(null)}
      />
    </>
  );

  return {
    openReport,
    requestBlock,
    showAlert,
    showInviteError,
    modals,
  };
}
