import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@gamebuddy/api-client';
import { PageHeader } from '../components/PageHeader';
import { AdminNav } from '../components/AdminNav';
import { EmptyState } from '../components/EmptyState';

type UserRow = {
  id: string;
  email: string;
  nickname: string;
  role: string;
  avatarUrl?: string | null;
  isVip: boolean;
  isBanned: boolean;
  createdAt: string;
  _count: { reportsAgainst: number; reportsFiled: number };
};

export default function AdminUsersPage() {
  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState('');
  const [banned, setBanned] = useState('all');
  const [items, setItems] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .adminListUsers({
        q: query || undefined,
        banned: banned === 'all' ? undefined : banned,
      })
      .then((res) => setItems(res as UserRow[]))
      .finally(() => setLoading(false));
  }, [query, banned]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setQuery(keyword.trim());
  };

  return (
    <div className="page-wrap">
      <PageHeader title="用户管理" subtitle="先看举报频次和封禁状态，再进入用户详情判断处理。" />
      <AdminNav />

      <form className="admin-toolbar glass-panel" onSubmit={submit}>
        <label className="form-field">
          <span className="form-field-label">搜索用户</span>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="按昵称或邮箱搜索"
          />
        </label>
        <label className="form-field">
          <span className="form-field-label">封禁状态</span>
          <select value={banned} onChange={(e) => setBanned(e.target.value)}>
            <option value="all">全部</option>
            <option value="false">正常</option>
            <option value="true">已封禁</option>
          </select>
        </label>
        <button type="submit">搜索</button>
      </form>

      {loading ? (
        <div className="loading">加载用户中...</div>
      ) : items.length === 0 ? (
        <EmptyState
          variant="search"
          title="没有找到用户"
          description="换个昵称、邮箱关键词或封禁条件再试试。"
        />
      ) : (
        <ul className="admin-card-list">
          {items.map((item) => (
            <li key={item.id} className="glass-panel admin-card-item">
              <div className="admin-card-head">
                <div>
                  <strong>{item.nickname}</strong>
                  <p className="muted small">{item.email}</p>
                </div>
                <div className="admin-status-group">
                  <span className={`admin-badge ${item.isBanned ? 'rejected' : 'resolved'}`}>
                    {item.isBanned ? '已封禁' : '正常'}
                  </span>
                  <span className="admin-badge neutral">{item.role}</span>
                </div>
              </div>
              <p className="muted small">
                被举报 {item._count.reportsAgainst} 次 / 发起举报 {item._count.reportsFiled} 次
              </p>
              <div className="admin-card-foot">
                <time className="muted small">
                  {new Date(item.createdAt).toLocaleString('zh-CN')}
                </time>
                <Link to={`/admin/users/${item.id}`} className="ghost small-btn">
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
