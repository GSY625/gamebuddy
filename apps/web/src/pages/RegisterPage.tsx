import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@gamebuddy/api-client';
import { useAuth } from '../context/AuthContext';
import { AppShell } from '../components/AppShell';
import { MascotSvg } from '../components/MascotSvg';
import { CaptchaField } from '../components/CaptchaField';
import { useSendVerificationCode } from '../hooks/useSendVerificationCode';
import { validateEmailInput } from '../utils/emailValidation';

export default function RegisterPage() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [codeHint, setCodeHint] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const { send, sendDisabled, sendButtonLabel } = useSendVerificationCode();

  const sendCode = async () => {
    const emailValidation = validateEmailInput(email);
    if (!emailValidation.ok) {
      setError(emailValidation.message);
      return;
    }

    if (!captchaCode.trim()) {
      setError('请输入图形验证码');
      return;
    }

    setError('');
    try {
      const res = await send({
        email: emailValidation.normalized,
        captchaId,
        captchaCode: captchaCode.trim(),
      });
      setCodeSent(true);
      if (res.devCode) {
        setCodeHint(`开发环境验证码：${res.devCode}`);
      } else {
        setCodeHint(res.message ?? '验证码已发送，请查收邮箱。');
      }
    } catch (err) {
      setCodeSent(false);
      setCodeHint(
        '如果刚才发送失败或超时，之前邮件里的验证码可能已经失效，请重新获取最新验证码。',
      );
      setError(err instanceof Error ? err.message : '发送验证码失败');
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const emailValidation = validateEmailInput(email);
    const trimmedNickname = nickname.trim();
    const trimmedCode = code.trim();

    if (!emailValidation.ok) {
      setError(emailValidation.message);
      return;
    }
    if (!trimmedNickname) {
      setError('昵称不能为空');
      return;
    }
    if (!trimmedCode) {
      setError('请输入邮箱验证码');
      return;
    }

    try {
      const check = await api.checkNickname(trimmedNickname);
      if (!check.available) {
        setError(check.message ?? '昵称已存在');
        return;
      }

      await register({
        email: emailValidation.normalized,
        password,
        nickname: trimmedNickname,
        code: trimmedCode,
      });
      nav('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
    }
  };

  return (
    <AppShell>
      <div className="auth-page">
        <div className="auth-mascot-wrap">
          <MascotSvg variant="party" className="auth-mascot" brandText="开黑鸭" />
        </div>
        <form className="auth-card glass-panel" onSubmit={submit}>
          <h1>加入开黑鸭</h1>
          <p className="auth-lead muted">开始你的下一场开黑之旅</p>
          <input
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <CaptchaField
            value={captchaCode}
            onChange={setCaptchaCode}
            onCaptchaIdChange={setCaptchaId}
          />
          <div className="row">
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
              {codeSent && !sendDisabled ? '重新发送' : sendButtonLabel}
            </button>
          </div>
          {codeHint && <p className="code-hint">{codeHint}</p>}
          <input
            type="password"
            placeholder="密码（至少 6 位）"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <input
            placeholder="昵称"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            required
          />
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn-primary">
            注册
          </button>
          <p className="auth-footer">
            已有账号？<Link to="/login">登录</Link>
          </p>
        </form>
      </div>
    </AppShell>
  );
}
