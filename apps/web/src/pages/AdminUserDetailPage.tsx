import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@gamebuddy/api-client';
import { PageHeader } from '../components/PageHeader';
import { AdminNav } from '../components/AdminNav';
import { ThemeToast } from '../components/ThemeToast';

type UserDetail = {
  id: string;
  email: string;
  nickname: string;
  role: string;
  avatarUrl?: string | null;
  bio?: string | null;
  isVip: boolean;
  isBanned: boolean;
  createdAt: string;
  _count: {
    reportsAgainst: number;
    reportsFiled: number;
    friendshipsAsUser: number;
    friendshipsAsFriend: number;
  };
  reportsAgainst: Array<{
    id: string;
    reason: string;
    detail?: string | null;
    reviewStatus: string;
    createdAt: string;
    reporter: { id: string; nickname: string };
    reviewer?: { id: string; nickname: string } | null;
  }>;
  reportsFiled: Array<{
    id: string;
    reason: string;
    detail?: string | null;
    reviewStatus: string;
    createdAt: string;
    reported: { id: string; nickname: string };
  }>;
  actionLogs: Array<{
    id: string;
    action: string;
    targetType: string;
    targetId?: string | null;
    note?: string | null;
    createdAt: string;
    actor: { id: string; nickname: string; role: string };
  }>;
  restrictions: Array<{
    id: string;
    type: 'invite' | 'direct_message' | 'lfg' | 'chat';
    active: boolean;
    note?: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  lfgPosts: Array<{
    id: string;
    title: string;
    description?: string | null;
    status: string;
    createdAt: string;
    game: { id: string; name: string; icon: string };
  }>;
};

const RESTRICTION_ITEMS: Array<{
  type: 'invite' | 'direct_message' | 'lfg' | 'chat';
  label: string;
}> = [
  { type: 'invite', label: '发送邀请' },
  { type: 'direct_message', label: '发送私信' },
  { type: 'lfg', label: '发布招募' },
  { type: 'chat', label: '聊天发言' },
];

export default function AdminUserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const [data, setData] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState('');
  const [toast, setToast] = useState('');
  const [restrictionType, setRestrictionType] = useState<
    'invite' | 'direct_message' | 'lfg' | 'chat'
  >('invite');

  const load = async () => {
    if (!userId) return;
    const res = (await api.adminGetUser(userId)) as UserDetail;
    setData(res);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [userId]);

  const toggleBan = async () => {
    if (!userId || !data) return;
    setSubmitting(true);
    try {
      const res = (await api.adminSetUserBan(userId, {
        banned: !data.isBanned,
        note,
      })) as UserDetail;
      setData(res);
      setToast(res.isBanned ? '用户已封禁' : '用户已解除封禁');
      setNote('');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleRestriction = async (enabled: boolean) => {
    if (!userId) return;
    setSubmitting(true);
    try {
      const res = (await api.adminSetUserRestriction(userId, {
        type: restrictionType,
        enabled,
        note,
      })) as UserDetail;
      setData(res);
      setToast(enabled ? '限制已启用' : '限制已解除');
      setNote('');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="loading page-wrap">加载用户详情中...</div>;
  }

  if (!data) {
    return <div className="loading page-wrap">用户不存在</div>;
  }

  return (
    <div className="page-wrap">
      <ThemeToast message={toast} show={Boolean(toast)} onClose={() => setToast('')} />
      <PageHeader title="用户详情" subtitle="结合举报记录、封禁状态和管理员日志判断是否需要进一步处理。" />
      <AdminNav />

      <div className="admin-detail-grid">
        <section className="glass-panel admin-section">
          <div className="admin-section-head">
            <h3>账号信息</h3>
            <div className="admin-status-group">
              <span className={`admin-badge ${data.isBanned ? 'rejected' : 'resolved'}`}>
                {data.isBanned ? '已封禁' : '正常'}
              </span>
              <span className="admin-badge neutral">{data.role}</span>
            </div>
          </div>
          <p><strong>昵称：</strong>{data.nickname}</p>
          <p><strong>邮箱：</strong>{data.email}</p>
          <p><strong>简介：</strong>{data.bio || '无'}</p>
          <p><strong>注册时间：</strong>{new Date(data.createdAt).toLocaleString('zh-CN')}</p>
          <p className="muted small">
            被举报 {data._count.reportsAgainst} 次 / 发起举报 {data._count.reportsFiled} 次
          </p>
        </section>

        <section className="glass-panel admin-section">
          <div className="admin-section-head">
            <h3>账号处理</h3>
          </div>
          <label className="form-field">
            <span className="form-field-label">处理备注</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder="例如：多次骚扰举报核实成立。"
            />
          </label>
          <button type="button" disabled={submitting} onClick={() => void toggleBan()}>
            {data.isBanned ? '解除封禁' : '封禁用户'}
          </button>
          <hr className="profile-divider" />
          <label className="form-field">
            <span className="form-field-label">功能限制类型</span>
            <select
              value={restrictionType}
              onChange={(e) =>
                setRestrictionType(
                  e.target.value as 'invite' | 'direct_message' | 'lfg' | 'chat',
                )
              }
            >
              {RESTRICTION_ITEMS.map((item) => (
                <option key={item.type} value={item.type}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <div className="admin-action-row">
            <button
              type="button"
              disabled={submitting}
              onClick={() => void toggleRestriction(true)}
            >
              启用限制
            </button>
            <button
              type="button"
              className="ghost"
              disabled={submitting}
              onClick={() => void toggleRestriction(false)}
            >
              解除限制
            </button>
          </div>
        </section>
      </div>

      <section className="glass-panel admin-section">
        <div className="admin-section-head">
          <h3>当前功能限制</h3>
        </div>
        {data.restrictions.length === 0 ? (
          <p className="muted small">当前没有生效中的功能限制</p>
        ) : (
          <ul className="admin-simple-list">
            {data.restrictions.map((item) => (
              <li key={item.id} className="admin-simple-item">
                <div>
                  <strong>
                    {RESTRICTION_ITEMS.find((x) => x.type === item.type)?.label || item.type}
                  </strong>
                  {item.note && <p className="muted small">{item.note}</p>}
                </div>
                <time className="muted small">
                  {new Date(item.updatedAt).toLocaleString('zh-CN')}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass-panel admin-section">
        <div className="admin-section-head">
          <h3>招募内容</h3>
        </div>
        {data.lfgPosts.length === 0 ? (
          <p className="muted small">暂无招募记录</p>
        ) : (
          <ul className="admin-simple-list">
            {data.lfgPosts.map((item) => (
              <li key={item.id} className="admin-simple-item">
                <div>
                  <strong>{item.title}</strong>
                  <p className="muted small">
                    {item.game.name} / 状态：{item.status}
                  </p>
                  {item.description && <p className="muted small">{item.description}</p>}
                </div>
                <time className="muted small">
                  {new Date(item.createdAt).toLocaleString('zh-CN')}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass-panel admin-section">
        <div className="admin-section-head">
          <h3>被举报记录</h3>
        </div>
        {data.reportsAgainst.length === 0 ? (
          <p className="muted small">暂无被举报记录</p>
        ) : (
          <ul className="admin-simple-list">
            {data.reportsAgainst.map((item) => (
              <li key={item.id} className="admin-simple-item">
                <div>
                  <strong>{item.reason}</strong>
                  <p className="muted small">
                    举报人：{item.reporter.nickname} / 状态：{item.reviewStatus}
                  </p>
                </div>
                <time className="muted small">
                  {new Date(item.createdAt).toLocaleString('zh-CN')}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass-panel admin-section">
        <div className="admin-section-head">
          <h3>管理员操作日志</h3>
        </div>
        {data.actionLogs.length === 0 ? (
          <p className="muted small">暂无相关操作</p>
        ) : (
          <ul className="admin-simple-list">
            {data.actionLogs.map((item) => (
              <li key={item.id} className="admin-simple-item">
                <div>
                  <strong>{item.action}</strong>
                  <p className="muted small">
                    操作者：{item.actor.nickname} / {item.actor.role}
                  </p>
                  {item.note && <p className="muted small">{item.note}</p>}
                </div>
                <time className="muted small">
                  {new Date(item.createdAt).toLocaleString('zh-CN')}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
