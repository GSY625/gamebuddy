import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AppShell } from '../components/AppShell';
import { MascotSvg } from '../components/MascotSvg';
import { validateEmailInput } from '../utils/emailValidation';

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [pageMotion, setPageMotion] = useState({ x: 0, y: 0 });
  const [pageActive, setPageActive] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handlePageMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    setPageMotion({
      x: clamp(x * 2, -1, 1),
      y: clamp(y * 2, -1, 1),
    });
    setPageActive(true);
  };

  const resetPageMotion = () => {
    setPageMotion({ x: 0, y: 0 });
    setPageActive(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const emailValidation = validateEmailInput(email);
    if (!emailValidation.ok) {
      setError(emailValidation.message);
      return;
    }

    try {
      await login(emailValidation.normalized, password);
      nav('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    }
  };

  return (
    <AppShell showDecor={false}>
      <div
        className="auth-page auth-page-login"
        onMouseMove={handlePageMove}
        onMouseLeave={resetPageMotion}
      >
        <div
          className="auth-login-backdrop auth-login-backdrop-a"
          style={{
            transform: `translate(${pageMotion.x * -26}px, ${pageMotion.y * -18}px)`,
          }}
        />
        <div
          className="auth-login-backdrop auth-login-backdrop-b"
          style={{
            transform: `translate(${pageMotion.x * 22}px, ${pageMotion.y * 16}px)`,
          }}
        />

        <div className="auth-mascot-wrap auth-mascot-wrap-login">
          <div className="auth-mascot-scene">
            <div
              className="auth-mascot-shadow"
              style={{
                transform: `translateX(${pageMotion.x * 18}px) scale(${1 - Math.abs(pageMotion.y) * 0.08})`,
              }}
            />
            <MascotSvg
              variant="wave"
              className="auth-mascot auth-mascot-hero"
              privacyMode={passwordFocused}
              lookAt={
                passwordFocused
                  ? undefined
                  : {
                      x: pageMotion.x * 1.4,
                      y: pageMotion.y * 1.1,
                    }
              }
              style={{
                transform: passwordFocused
                  ? `translate(${pageMotion.x * -10}px, ${pageMotion.y * 8}px) rotate(${-10 + pageMotion.x * 3}deg) scale(1.02)`
                  : `translate(${pageMotion.x * 14}px, ${pageMotion.y * 10}px) rotate(${pageMotion.x * 4}deg) scale(${pageActive ? 1.02 : 1})`,
              }}
            />
          </div>
          <div className="auth-mascot-copy">
            <p className="auth-mascot-kicker">
              {passwordFocused ? '隐私模式已开启' : '整个页面都能触发视线联动'}
            </p>
            <h2>{passwordFocused ? '你输密码时，我先转过去。' : '在页面里移动鼠标，看看它会不会偷看你。'}</h2>
            <p>
              {passwordFocused
                ? '聚焦密码框后，小搭子会主动背过身，不会盯着你的密码输入。'
                : '现在不只是左边一小块区域，鼠标在整个登录界面移动时，它都会轻轻跟着你转动视线。'}
            </p>
          </div>
        </div>

        <form
          className="auth-card auth-card-login glass-panel"
          style={{
            transform: `translate(${pageMotion.x * -8}px, ${pageMotion.y * -6}px)`,
          }}
          onSubmit={submit}
        >
          <h1>欢迎回来</h1>
          <p className="auth-lead muted">登录后继续寻找你的游戏搭子</p>
          <input
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div className="password-field">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? '隐藏密码' : '显示密码'}
              aria-pressed={showPassword}
            >
              {showPassword ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn-primary">
            登录
          </button>
          <p className="auth-footer">
            <Link to="/forgot-password">忘记密码？</Link>
          </p>
          <p className="auth-footer">
            没有账号？<Link to="/register">注册</Link>
          </p>
        </form>
      </div>
    </AppShell>
  );
}
