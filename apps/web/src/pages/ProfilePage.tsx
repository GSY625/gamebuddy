import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { api } from '@gamebuddy/api-client';
import { PageHeader } from '../components/PageHeader';
import { ProfileBlocklistButton } from '../components/ProfileBlocklist';
import { ThemeToast } from '../components/ThemeToast';
import { UserAvatar } from '../components/UserAvatar';
import { useAuth, type NicknameCooldown } from '../context/AuthContext';
import { formatCooldownMs, getRemainingMs } from '../utils/formatCooldown';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [cooldown, setCooldown] = useState<NicknameCooldown | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!user) return;
    setNickname(user.nickname);
    setBio(user.bio ?? '');
    setAvatarUrl(user.avatarUrl ?? '');
    if (user.nicknameCooldown) setCooldown(user.nicknameCooldown);
  }, [user]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const remainingMs = cooldown?.nextChangeAt
    ? getRemainingMs(cooldown.nextChangeAt, now)
    : cooldown?.remainingMs ?? 0;
  const nicknameLocked = remainingMs > 0;
  const nicknameChanged = nickname.trim() !== (user?.nickname ?? '');

  const profileChecks = [
    Boolean((avatarUrl || user?.avatarUrl)?.trim()),
    Boolean(nickname.trim()),
    Boolean(bio.trim()),
    Boolean(user?.emailVerified),
  ];
  const completeCount = profileChecks.filter(Boolean).length;
  const profileCompletion = Math.round((completeCount / profileChecks.length) * 100);
  const profileTips = [
    !(avatarUrl || user?.avatarUrl)?.trim() ? '上传头像，更容易被搭子快速记住。' : '',
    !bio.trim() ? '补一句常玩时间或玩法偏好，别人会更愿意主动联系你。' : '',
    !user?.emailVerified ? '完成邮箱验证，能明显提升资料可信度。' : '',
  ].filter(Boolean);

  const pickAvatar = () => fileRef.current?.click();

  const onAvatarFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('头像不能超过 5MB');
      return;
    }

    setError('');
    setUploading(true);
    try {
      const { url } = await api.uploadImage(file);
      setAvatarUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '头像上传失败');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      setError('昵称不能为空');
      return;
    }

    if (nicknameChanged && nicknameLocked) {
      setError('昵称修改冷却中，请等待倒计时结束');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (nicknameChanged) {
        const check = await api.checkNickname(trimmed, user?.id);
        if (!check.available) {
          setError(check.message ?? '该昵称已存在');
          return;
        }
      }

      const payload: { nickname?: string; bio: string; avatarUrl: string | null } = {
        bio,
        avatarUrl: avatarUrl || null,
      };
      if (nicknameChanged) payload.nickname = trimmed;

      const updated = (await api.updateMe(payload)) as {
        nicknameCooldown?: NicknameCooldown;
      };
      if (updated.nicknameCooldown) {
        setCooldown(updated.nicknameCooldown);
      }

      await refreshUser();
      setToast(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!currentPassword || newPassword.length < 6) {
      setPasswordMsg('请填写当前密码，新密码至少 6 位');
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordMsg('新密码不能与当前密码相同');
      return;
    }

    setChangingPassword(true);
    setPasswordMsg('');
    try {
      await api.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setPasswordMsg('密码已修改');
      window.setTimeout(() => {
        setPasswordOpen(false);
        setPasswordMsg('');
      }, 1500);
    } catch (err) {
      setPasswordMsg(err instanceof Error ? err.message : '修改失败');
    } finally {
      setChangingPassword(false);
    }
  };

  const closePasswordPanel = () => {
    setPasswordOpen(false);
    setCurrentPassword('');
    setNewPassword('');
    setPasswordMsg('');
  };

  return (
    <div className="page-wrap profile-page">
      <PageHeader title="我的资料" subtitle="管理头像、昵称、简介与账号安全" />
      <ThemeToast message="保存成功" show={toast} onClose={() => setToast(false)} />

      <section className="glass-panel profile-card profile-card-single">
        <div className="profile-card-head">
          <button
            type="button"
            className="profile-avatar-btn"
            onClick={pickAvatar}
            disabled={uploading}
            aria-label="更换头像"
          >
            <UserAvatar
              url={avatarUrl}
              name={nickname || user?.nickname}
              size={88}
              className="profile-avatar-lg"
            />
            <span className="profile-avatar-hint">
              {uploading ? '上传中...' : '点击更换头像'}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="image-upload-input-hidden"
            onChange={onAvatarFile}
          />
        </div>

        <div className="profile-fields">
          <div className="profile-completion-card">
            <div className="profile-completion-head">
              <strong>资料完整度 {profileCompletion}%</strong>
              <span
                className={`profile-verify-badge ${user?.emailVerified ? 'verified' : 'pending'}`}
              >
                {user?.emailVerified ? '邮箱已验证' : '邮箱待验证'}
              </span>
            </div>
            <p className="muted small">
              头像、简介和认证越完整，别人越愿意主动加你、回你、拉你进队。
            </p>
            {profileTips.length > 0 && (
              <ul className="profile-completion-tips">
                {profileTips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            )}
          </div>

          <label className="form-field">
            <span className="form-field-label">昵称</span>
            <input
              className="input-themed"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={32}
              disabled={nicknameLocked}
            />
            <span className="muted small profile-field-hint">每周仅可修改一次昵称</span>
            {nicknameLocked && (
              <p className="profile-cooldown" role="status">
                距离下次可修改：
                <strong>{formatCooldownMs(remainingMs)}</strong>
              </p>
            )}
          </label>

          <label className="form-field">
            <span className="form-field-label">简介</span>
            <textarea
              className="input-themed"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="写一句介绍自己，比如常玩时间、擅长位置、语音习惯..."
            />
          </label>

          <div className="form-field profile-readonly">
            <span className="form-field-label">邮箱</span>
            <p className="profile-email-value">{user?.email}</p>
          </div>
        </div>

        {error && <p className="error profile-error">{error}</p>}

        <div className="profile-card-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => void save()}
            disabled={saving || uploading}
          >
            {saving ? '保存中...' : '保存资料'}
          </button>
        </div>

        <hr className="profile-divider" />

        <div className="profile-security">
          <div className="profile-security-head">
            <h3 className="profile-section-title">账号安全</h3>
            <div className="profile-security-actions">
              <ProfileBlocklistButton />
              {!passwordOpen && (
                <button
                  type="button"
                  className="ghost small-btn"
                  onClick={() => setPasswordOpen(true)}
                >
                  修改密码
                </button>
              )}
            </div>
          </div>

          {passwordOpen && (
            <div className="profile-password-form">
              <label className="form-field">
                <span className="form-field-label">当前密码</span>
                <input
                  type="password"
                  className="input-themed"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
              <label className="form-field">
                <span className="form-field-label">新密码</span>
                <input
                  type="password"
                  className="input-themed"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  autoComplete="new-password"
                />
              </label>
              {passwordMsg && (
                <p className={passwordMsg === '密码已修改' ? 'success-text' : 'error'}>
                  {passwordMsg}
                </p>
              )}
              <div className="profile-password-actions">
                <button type="button" className="ghost" onClick={closePasswordPanel}>
                  取消
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => void changePassword()}
                  disabled={changingPassword}
                >
                  {changingPassword ? '提交中...' : '确认修改'}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
