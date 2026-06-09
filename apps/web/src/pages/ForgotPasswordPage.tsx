import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@gamebuddy/api-client';
import { AppShell } from '../components/AppShell';
import { MascotSvg } from '../components/MascotSvg';
import { CaptchaField } from '../components/CaptchaField';
import { useSendVerificationCode } from '../hooks/useSendVerificationCode';
import { validateEmailInput } from '../utils/emailValidation';

export default function ForgotPasswordPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const { send, sendDisabled, sendButtonLabel } = useSendVerificationCode();

  const sendCode = async () => {
    const emailValidation = validateEmailInput(email);
    if (!emailValidation.ok) {
      setError(emailValidation.message);
      return;
    }

    if (!captchaId.trim()) {
      setError('图形验证码尚未加载成功，请先点刷新重试');
      return;
    }

    if (!captchaCode.trim()) {
      setError('请输入图形验证码');
      return;
    }

    setError('');
    setSuccess('');
    try {
      const res = await send({
        email: emailValidation.normalized,
        captchaId,
        captchaCode: captchaCode.trim(),
      });
      setSuccess(
        res.devCode
          ? `验证码已发送（开发环境：${res.devCode}）`
          : '验证码已发送，请查收邮箱。',
      );
    } catch (err) {
      setSuccess(
        '如果刚才发送失败或超时，之前邮件里的验证码可能已经失效，请重新获取最新验证码。',
      );
      setError(err instanceof Error ? err.message : '发送失败');
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const emailValidation = validateEmailInput(email);
    if (!emailValidation.ok) {
      setError(emailValidation.message);
      return;
    }

    setSubmitting(true);
    try {
      await api.resetPassword({
        email: emailValidation.normalized,
        code: code.trim(),
        password,
      });
      setSuccess('密码已重置，即将跳转到登录页。');
      setTimeout(() => nav('/login'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : '重置失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="auth-page">
        <div className="auth-mascot-wrap">
          <MascotSvg variant="wave" className="auth-mascot" brandText="开黑鸭" />
        </div>
        <form className="auth-card glass-panel" onSubmit={submit}>
          <h1>找回密码</h1>
          <p className="auth-lead muted">通过邮箱验证码重置密码</p>
          <input
            type="email"
            placeholder="注册邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <CaptchaField
            value={captchaCode}
            onChange={setCaptchaCode}
            onCaptchaIdChange={setCaptchaId}
          />
          <div className="auth-code-row">
            <input
              placeholder="邮箱验证码"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <button
              type="button"
              className="ghost"
              disabled={sendDisabled}
              onClick={() => void sendCode()}
            >
              {sendButtonLabel}
            </button>
          </div>
          {error && <p className="error">{error}</p>}
          {success && <p className="success-text">{success}</p>}
          <input
            type="password"
            placeholder="新密码（至少 6 位）"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? '提交中...' : '重置密码'}
          </button>
          <p className="auth-footer">
            <Link to="/login">返回登录</Link>
          </p>
        </form>
      </div>
    </AppShell>
  );
}
