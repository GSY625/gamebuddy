import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type ModerationSuggestionResponse } from '@gamebuddy/api-client';
import { PageHeader } from '../components/PageHeader';
import { AdminNav } from '../components/AdminNav';
import { ThemeToast } from '../components/ThemeToast';

type ReportDetail = {
  id: string;
  reason: string;
  detail?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  reviewStatus: string;
  actionTaken?: string | null;
  reviewNote?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  reporter: { id: string; nickname: string; email: string };
  reported: {
    id: string;
    nickname: string;
    email: string;
    role: string;
    isBanned: boolean;
    createdAt: string;
  };
  reviewer?: { id: string; nickname: string; role: string } | null;
  targetContext?: unknown;
  recentReports: Array<{
    id: string;
    reason: string;
    detail?: string | null;
    reviewStatus: string;
    createdAt: string;
    reporter: { id: string; nickname: string };
  }>;
};

const riskLevelLabels: Record<ModerationSuggestionResponse['riskLevel'], string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
};

const categoryLabels: Record<
  ModerationSuggestionResponse['categories'][number],
  string
> = {
  abuse: '辱骂',
  spam: '垃圾信息',
  scam: '诈骗',
  harassment: '骚扰',
  external_traffic: '外部引流',
  normal: '正常',
};

const actionLabels: Record<ModerationSuggestionResponse['suggestedAction'], string> = {
  none: '仅人工查看',
  hide_lfg: '建议隐藏招募帖',
  ban: '建议封禁',
  manual_review: '建议人工复核',
};

export default function AdminReportDetailPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const [item, setItem] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<ModerationSuggestionResponse | null>(null);
  const [toast, setToast] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [actionTaken, setActionTaken] = useState<'none' | 'ban' | 'hide_lfg'>('none');

  const load = async () => {
    if (!reportId) return;
    const res = (await api.adminGetReport(reportId)) as ReportDetail;
    setItem(res);
    setReviewNote(res.reviewNote ?? '');
    if (res.actionTaken === 'ban' || res.actionTaken === 'hide_lfg') {
      setActionTaken(res.actionTaken);
    } else {
      setActionTaken('none');
    }
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [reportId]);

  const submit = async (reviewStatus: 'resolved' | 'rejected') => {
    if (!reportId) return;
    setSubmitting(true);
    try {
      const res = (await api.adminReviewReport(reportId, {
        reviewStatus,
        reviewNote,
        actionTaken: reviewStatus === 'resolved' ? actionTaken : 'none',
      })) as ReportDetail;
      setItem(res);
      setToast(reviewStatus === 'resolved' ? '举报已处理' : '举报已驳回');
    } finally {
      setSubmitting(false);
    }
  };


  const requestAiSuggestion = async () => {
    if (!reportId || aiLoading) return;
    setAiLoading(true);
    try {
      const suggestion = await api.createModerationSuggestion({ reportId });
      setAiSuggestion(suggestion);
      setToast('AI 审核建议已生成');
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'AI 审核建议生成失败');
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiSuggestion = async () => {
    if (!aiSuggestion || !item) return;
    const nextAction =
      aiSuggestion.suggestedAction === 'ban'
        ? 'ban'
        : aiSuggestion.suggestedAction === 'hide_lfg' && item.targetType === 'lfg_post'
          ? 'hide_lfg'
          : 'none';
    const note = [
      `AI 建议：风险等级 ${riskLevelLabels[aiSuggestion.riskLevel]}，置信度 ${aiSuggestion.confidence}%`,
      `分类：${aiSuggestion.categories.map((category) => categoryLabels[category]).join('、')}`,
      `建议动作：${actionLabels[aiSuggestion.suggestedAction]}`,
      `原因：${aiSuggestion.reason}`,
    ].join('\n');

    setReviewNote((current) => (current.trim() ? `${current.trim()}\n\n${note}` : note));
    setActionTaken(nextAction);
    await api.adminMarkAiModerationSuggestionAction(item.id, { adminAction: 'adopted' });
    setToast('AI 建议已写入备注，请确认后再提交');
  };

  const ignoreAiSuggestion = async () => {
    if (!aiSuggestion || !item) return;
    await api.adminMarkAiModerationSuggestionAction(item.id, { adminAction: 'ignored' });
    setAiSuggestion(null);
    setToast('已忽略 AI 建议');
  };
  if (loading) {
    return <div className="loading page-wrap">加载举报详情中...</div>;
  }

  if (!item) {
    return <div className="loading page-wrap">举报记录不存在</div>;
  }

  return (
    <div className="page-wrap">
      <ThemeToast message={toast} show={Boolean(toast)} onClose={() => setToast('')} />
      <PageHeader title="举报详情" subtitle="查看举报原因、用户信息和历史举报，再决定是否封禁。" />
      <AdminNav />

      <div className="admin-detail-grid">
        <section className="glass-panel admin-section">
          <div className="admin-section-head">
            <h3>举报信息</h3>
            <span className={`admin-badge ${item.reviewStatus}`}>{item.reviewStatus}</span>
          </div>
          <p><strong>举报原因：</strong>{item.reason}</p>
          <p><strong>补充说明：</strong>{item.detail || '无'}</p>
          <p><strong>举报目标：</strong>{item.targetType || 'user'}</p>
          <p><strong>举报人：</strong>{item.reporter.nickname} / {item.reporter.email}</p>
          <p><strong>被举报人：</strong>{item.reported.nickname} / {item.reported.email}</p>
          <p><strong>当前状态：</strong>{item.reported.isBanned ? '已封禁' : '正常'}</p>
          <p className="muted small">
            提交时间：{new Date(item.createdAt).toLocaleString('zh-CN')}
          </p>
          {item.reviewer && item.reviewedAt && (
            <p className="muted small">
              最近审核：{item.reviewer.nickname} /{' '}
              {new Date(item.reviewedAt).toLocaleString('zh-CN')}
            </p>
          )}
        </section>

        <section className="glass-panel admin-section">
          <div className="admin-section-head">
            <h3>审核动作</h3>
          </div>
          <label className="form-field">
            <span className="form-field-label">处理备注</span>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              rows={4}
              placeholder="记录你的判断依据，方便后续追踪。"
            />
          </label>
          <label className="form-field">
            <span className="form-field-label">处理动作</span>
            <select
              value={actionTaken}
              onChange={(e) =>
                setActionTaken(e.target.value as 'none' | 'ban' | 'hide_lfg')
              }
            >
              <option value="none">仅完成审核</option>
              <option value="ban">审核通过并封禁该用户</option>
              {item.targetType === 'lfg_post' && (
                <option value="hide_lfg">审核通过并下架招募贴</option>
              )}
            </select>
          </label>
          <div className="admin-action-row">
            <button type="button" disabled={submitting} onClick={() => void submit('resolved')}>
              标记已处理
            </button>
            <button
              type="button"
              className="ghost"
              disabled={submitting}
              onClick={() => void submit('rejected')}
            >
              驳回举报
            </button>
            <Link to={`/admin/users/${item.reported.id}`} className="ghost small-btn">
              查看该用户
            </Link>
          </div>
        </section>
        <section className="glass-panel admin-section">
          <div className="admin-section-head">
            <h3>AI 审核建议</h3>
            {aiSuggestion && (
              <span className={`admin-badge ${aiSuggestion.riskLevel}`}>
                {riskLevelLabels[aiSuggestion.riskLevel]}
              </span>
            )}
          </div>
          <button
            type="button"
            className="ghost"
            disabled={aiLoading}
            onClick={() => void requestAiSuggestion()}
          >
            {aiLoading ? 'AI 分析中...' : '生成 AI 建议'}
          </button>
          {aiSuggestion ? (
            <div className="admin-ai-suggestion">
              <p><strong>风险等级：</strong>{riskLevelLabels[aiSuggestion.riskLevel]}</p>
              <p><strong>分类：</strong>{aiSuggestion.categories.map((category) => categoryLabels[category]).join('、')}</p>
              <p><strong>建议动作：</strong>{actionLabels[aiSuggestion.suggestedAction]}</p>
              <p><strong>置信度：</strong>{aiSuggestion.confidence}%</p>
              <p><strong>原因：</strong>{aiSuggestion.reason}</p>
              <button type="button" onClick={() => void applyAiSuggestion()}>
                采纳到备注
              </button>
              <button type="button" className="ghost" onClick={() => void ignoreAiSuggestion()}>
                忽略
              </button>
            </div>
          ) : (
            <p className="muted small">AI 仅提供审核建议，不会自动处理举报。</p>
          )}
        </section>
      </div>

      {item.targetType === 'lfg_post' && Boolean(item.targetContext) && (
        <section className="glass-panel admin-section">
          <div className="admin-section-head">
            <h3>关联招募内容</h3>
          </div>
          <pre className="admin-context-block">
            {String(JSON.stringify(item.targetContext, null, 2) ?? '')}
          </pre>
        </section>
      )}

      <section className="glass-panel admin-section">
        <div className="admin-section-head">
          <h3>该用户最近相关举报</h3>
        </div>
        {item.recentReports.length === 0 ? (
          <p className="muted small">暂无历史举报</p>
        ) : (
          <ul className="admin-simple-list">
            {item.recentReports.map((report) => (
              <li key={report.id} className="admin-simple-item">
                <div>
                  <strong>{report.reason}</strong>
                  <p className="muted small">
                    举报人：{report.reporter.nickname} / 状态：{report.reviewStatus}
                  </p>
                </div>
                <time className="muted small">
                  {new Date(report.createdAt).toLocaleString('zh-CN')}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
