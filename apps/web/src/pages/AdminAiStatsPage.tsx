import { useEffect, useState } from 'react';
import { api } from '@gamebuddy/api-client';
import { PageHeader } from '../components/PageHeader';
import { AdminNav } from '../components/AdminNav';

type AiStats = {
  todayCalls: number;
  totalCalls: number;
  sceneCounts: Record<string, number>;
  successRate: number;
  failedCalls: number;
  averageLatencyMs: number;
  modelDistribution: Record<string, number>;
  matchFeedback: {
    total: number;
    suitable: number;
    unsuitable: number;
    ignored: number;
    pending: number;
  };
  moderationSuggestions: {
    total: number;
    adopted: number;
    ignored: number;
    pending: number;
  };
};

const sceneLabels: Record<string, string> = {
  lfg_draft: 'LFG 草稿',
  match_recommend: '队友推荐',
  chat_icebreaker: '聊天破冰',
  moderation_suggest: '审核建议',
};

const modelLabels: Record<string, string> = {
  fast: '快速模型',
  quality: '高质量模型',
  none: '未记录',
};

const matchFeedbackLabels: Record<string, string> = {
  total: '总反馈数',
  suitable: '合适',
  unsuitable: '不合适',
  ignored: '忽略',
  pending: '待反馈',
};

const moderationSuggestionLabels: Record<string, string> = {
  total: '总建议数',
  adopted: '已采纳',
  ignored: '已忽略',
  pending: '待处理',
};

type StatListProps = {
  data: Record<string, number>;
  labelMap?: Record<string, string>;
};

function StatList({ data, labelMap }: StatListProps) {
  const entries = Object.entries(data);
  if (entries.length === 0) return <p className="muted small">暂无数据</p>;

  return (
    <ul className="admin-simple-list">
      {entries.map(([key, value]) => (
        <li key={key} className="admin-simple-item">
          <strong>{labelMap?.[key] ?? key}</strong>
          <span className="muted small">{value}</span>
        </li>
      ))}
    </ul>
  );
}

export default function AdminAiStatsPage() {
  const [data, setData] = useState<AiStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .adminAiStats()
      .then((res) => setData(res as AiStats))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="loading page-wrap">加载 AI 统计中...</div>;
  }

  return (
    <div className="page-wrap">
      <PageHeader
        title="AI 使用统计"
        subtitle="查看 AI 调用次数、稳定性、耗时和采纳情况。"
      />
      <AdminNav />

      {data && (
        <>
          <section className="admin-metric-grid">
            <div className="glass-panel admin-metric-card">
              <span className="muted small">今日调用次数</span>
              <strong>{data.todayCalls}</strong>
            </div>
            <div className="glass-panel admin-metric-card">
              <span className="muted small">累计调用次数</span>
              <strong>{data.totalCalls}</strong>
            </div>
            <div className="glass-panel admin-metric-card">
              <span className="muted small">成功率</span>
              <strong>{data.successRate}%</strong>
            </div>
            <div className="glass-panel admin-metric-card">
              <span className="muted small">失败次数</span>
              <strong>{data.failedCalls}</strong>
            </div>
            <div className="glass-panel admin-metric-card">
              <span className="muted small">平均耗时</span>
              <strong>{data.averageLatencyMs}ms</strong>
            </div>
          </section>

          <div className="admin-detail-grid">
            <section className="glass-panel admin-section">
              <div className="admin-section-head">
                <h3>场景调用分布</h3>
              </div>
              <StatList data={data.sceneCounts} labelMap={sceneLabels} />
            </section>

            <section className="glass-panel admin-section">
              <div className="admin-section-head">
                <h3>模型分布</h3>
              </div>
              <StatList data={data.modelDistribution} labelMap={modelLabels} />
            </section>

            <section className="glass-panel admin-section">
              <div className="admin-section-head">
                <h3>推荐反馈</h3>
              </div>
              <StatList
                data={{
                  total: data.matchFeedback.total,
                  suitable: data.matchFeedback.suitable,
                  unsuitable: data.matchFeedback.unsuitable,
                  ignored: data.matchFeedback.ignored,
                  pending: data.matchFeedback.pending,
                }}
                labelMap={matchFeedbackLabels}
              />
            </section>

            <section className="glass-panel admin-section">
              <div className="admin-section-head">
                <h3>审核建议</h3>
              </div>
              <StatList
                data={{
                  total: data.moderationSuggestions.total,
                  adopted: data.moderationSuggestions.adopted,
                  ignored: data.moderationSuggestions.ignored,
                  pending: data.moderationSuggestions.pending,
                }}
                labelMap={moderationSuggestionLabels}
              />
            </section>
          </div>
        </>
      )}
    </div>
  );
}