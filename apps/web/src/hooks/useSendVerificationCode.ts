import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '@gamebuddy/api-client';

export const VERIFICATION_CODE_COOLDOWN_SECONDS = 60;

type SendCodeResult = {
  message?: string;
  devCode?: string;
};

export function useSendVerificationCode() {
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((seconds) => (seconds <= 1 ? 0 : seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const startCooldown = useCallback(
    (seconds = VERIFICATION_CODE_COOLDOWN_SECONDS) => {
      setCooldown(seconds);
    },
    [],
  );

  const send = useCallback(
    async (params: {
      email: string;
      captchaId: string;
      captchaCode: string;
    }): Promise<SendCodeResult> => {
      if (cooldown > 0) {
        throw new Error(`${cooldown} 秒后可重新发送`);
      }

      setSending(true);
      try {
        const res = (await api.sendCode(params)) as SendCodeResult;
        startCooldown();
        return res;
      } catch (err) {
        if (err instanceof ApiError && err.retryAfterSeconds) {
          startCooldown(err.retryAfterSeconds);
        }
        throw err;
      } finally {
        setSending(false);
      }
    },
    [cooldown, startCooldown],
  );

  const sendButtonLabel = sending
    ? '发送中...'
    : cooldown > 0
      ? `${cooldown} 秒后重发`
      : '获取验证码';

  const sendDisabled = sending || cooldown > 0;

  return {
    send,
    sending,
    cooldown,
    sendDisabled,
    sendButtonLabel,
  };
}
