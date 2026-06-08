import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@gamebuddy/api-client';
import { PageHeader } from '../components/PageHeader';
import { AdminNav } from '../components/AdminNav';
import {
  formatAdminActionLabel,
  formatAdminActionNote,
  formatAdminTargetLabel,
} from '../utils/adminActionLog';

type Overview = {
  metrics: {
    pendingReports: number;
    totalReports: number;
    reviewedToday: number;
    bannedUsers: number;
    adminUsers: number;
    activeRestrictions: number;
  };
  recentActions: Array<{
    id: string;
    action: string;
    targetType: string;
    targetId?: string | null;
    note?: string | null;
    createdAt: string;
    actor: { id: string; nickname: string; role: string };
  }>;
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .adminOverview()
      .then((res) => setData(res as Overview))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="loading page-wrap">加载后台中...</div>;
  }

  return (
    <div className="page-wrap">
      <PageHeader
        title="后台概览"
        subtitle="先处理举报和用户风险，再逐步完善内容审核能力。"
      />
      <AdminNav />

      {data && (
        <>
          <section className="admin-metric-grid">
            <div className="glass-panel admin-metric-card">
              <span className="muted small">待处理举报</span>
              <strong>{data.metrics.pendingReports}</strong>
            </div>
            <div className="glass-panel admin-metric-card">
              <span className="muted small">今日已审核</span>
              <strong>{data.metrics.reviewedToday}</strong>
            </div>
            <div className="glass-panel admin-metric-card">
              <span className="muted small">封禁用户</span>
              <strong>{data.metrics.bannedUsers}</strong>
            </div>
            <div className="glass-panel admin-metric-card">
              <span className="muted small">管理员账号</span>
              <strong>{data.metrics.adminUsers}</strong>
            </div>
            <div className="glass-panel admin-metric-card">
              <span className="muted small">生效限制</span>
              <strong>{data.metrics.activeRestrictions}</strong>
            </div>
          </section>

          <section className="glass-panel admin-section">
            <div className="admin-section-head">
              <h3>快捷入口</h3>
            </div>
            <div className="admin-quick-links">
              <Link to="/admin/reports" className="admin-quick-link glass-panel">
                去处理举报
              </Link>
              <Link to="/admin/users" className="admin-quick-link glass-panel">
                去查看用户
              </Link>
            </div>
          </section>

          <section className="glass-panel admin-section">
            <div className="admin-section-head">
              <h3>最近操作</h3>
            </div>
            {data.recentActions.length === 0 ? (
              <p className="muted small">还没有管理员操作记录</p>
            ) : (
              <ul className="admin-simple-list">
                {data.recentActions.map((item) => {
                  const note = formatAdminActionNote(item.note);

                  return (
                    <li key={item.id} className="admin-simple-item">
                      <div>
                        <strong>{item.actor.nickname}</strong>
                        <span className="muted small">
                          {' '}
                          执行了 {formatAdminActionLabel(item.action)} /{' '}
                          {formatAdminTargetLabel(item.targetType)}
                        </span>
                        {note && <p className="muted small">{note}</p>}
                      </div>
                      <time className="muted small">
                        {new Date(item.createdAt).toLocaleString('zh-CN')}
                      </time>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
