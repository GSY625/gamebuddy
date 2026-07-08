import type {
  AiMatchCandidate,
  MatchRecommendationFeedback,
} from '@gamebuddy/api-client';
import { UserAvatarLink } from './UserAvatarLink';

type Props = {
  candidates: AiMatchCandidate[];
  loading: boolean;
  error?: string;
  feedbackByUserId: Record<string, MatchRecommendationFeedback | undefined>;
  onRecommend: () => void;
  onInvite: (candidate: AiMatchCandidate) => void;
  onFeedback: (
    candidate: AiMatchCandidate,
    feedback: MatchRecommendationFeedback,
  ) => void;
};

const feedbackLabels: Record<MatchRecommendationFeedback, string> = {
  suitable: '合适',
  unsuitable: '不合适',
  ignored: '忽略',
};

export function AiMatchPanel({
  candidates,
  loading,
  error,
  feedbackByUserId,
  onRecommend,
  onInvite,
  onFeedback,
}: Props) {
  return (
    <section className="ai-match-panel glass-panel">
      <div className="ai-match-head">
        <div>
          <h3>AI 推荐队友</h3>
          <p className="muted small">
            仅提供建议，只有你点击邀请后才会发送邀请。
          </p>
        </div>
        <button type="button" className="ghost" disabled={loading} onClick={onRecommend}>
          {loading ? '生成中...' : 'AI 推荐'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {candidates.length > 0 && (
        <ul className="ai-match-list">
          {candidates.map((candidate) => (
            <li key={candidate.userId} className="ai-match-item">
              <div className="ai-match-user">
                <UserAvatarLink
                  userId={candidate.userId}
                  url={candidate.avatarUrl}
                  name={candidate.nickname}
                  size={44}
                  status={candidate.online ? 'online' : 'invisible'}
                />
                <div>
                  <strong>{candidate.nickname}</strong>
                  <div className="ai-match-meta">
                    <span className="status-badge status-accepted">
                      {candidate.score}
                    </span>
                    <span className="muted small">
                      {candidate.online ? '在线' : '离线'}
                    </span>
                  </div>
                </div>
              </div>

              {candidate.reasons.length > 0 && (
                <div className="ai-match-chips">
                  {candidate.reasons.map((reason) => (
                    <span key={reason} className="lfg-post-chip">
                      {reason}
                    </span>
                  ))}
                </div>
              )}

              {candidate.possibleRisks.length > 0 && (
                <p className="muted small">
                  风险提示：{candidate.possibleRisks.join(' / ')}
                </p>
              )}

              <p className="ai-match-icebreaker">{candidate.icebreaker}</p>

              <div className="ai-match-actions">
                <button type="button" onClick={() => onInvite(candidate)}>
                  邀请
                </button>
                {(['suitable', 'unsuitable', 'ignored'] as const).map((feedback) => (
                  <button
                    key={feedback}
                    type="button"
                    className="ghost"
                    disabled={feedbackByUserId[candidate.userId] !== undefined}
                    onClick={() => onFeedback(candidate, feedback)}
                  >
                    {feedbackByUserId[candidate.userId] === feedback
                      ? '已记录'
                      : feedbackLabels[feedback]}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}