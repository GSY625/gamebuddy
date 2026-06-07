import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@gamebuddy/api-client';
import { PageHeader } from '../components/PageHeader';
import { AdminNav } from '../components/AdminNav';
import { EmptyState } from '../components/EmptyState';

type ReportRow = {
  id: string;
  reason: string;
  detail?: string | null;
  reviewStatus: string;
  actionTaken?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  reporter: { id: string; nickname: string; email: string };
  reported: {
    id: string;
    nickname: string;
    email: string;
    role: string;
    isBanned: boolean;
  };
};

export default function AdminReportsPage() {
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .adminListReports(status === 'all' ? undefined : status)
      .then((res) => setItems(res as ReportRow[]))
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <div className="page-wrap">
      <PageHeader title="举报审核" subtitle="先聚焦待处理举报，快速判断并记录处理动作。" />
      <AdminNav />

      <div className="admin-toolbar glass-panel">
        <label className="form-field">
          <span className="form-field-label">筛选状态</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="pending">待处理</option>
            <option value="resolved">已处理</option>
            <option value="rejected">已驳回</option>
            <option value="all">全部</option>
          </select>
        </label>
      </div>

      {loading ? (
        <div className="loading">加载举报中...</div>
      ) : items.length === 0 ? (
        <EmptyState
          variant="search"
          title="没有符合条件的举报"
          description="当前筛选条件下没有待审核内容。"
        />
      ) : (
        <ul className="admin-card-list">
          {items.map((item) => (
            <li key={item.id} className="glass-panel admin-card-item">
              <div className="admin-card-head">
                <div>
                  <strong>{item.reason}</strong>
                  <p className="muted small">
                    举报人：{item.reporter.nickname} / 被举报人：{item.reported.nickname}
                  </p>
                </div>
                <span className={`admin-badge ${item.reviewStatus}`}>
                  {item.reviewStatus}
                </span>
              </div>
              {item.detail && <p className="admin-card-body">{item.detail}</p>}
              <div className="admin-card-foot">
                <time className="muted small">
                  {new Date(item.createdAt).toLocaleString('zh-CN')}
                </time>
                <Link to={`/admin/reports/${item.id}`} className="ghost small-btn">
                  查看详情
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
