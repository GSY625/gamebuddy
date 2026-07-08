import { request } from './core';

export type LfgDraftRequest = {
  gameId: string;
  voiceMode?: string;
  playStyle?: string;
  timeNote?: string;
  genderPreference?: string;
  extraRequirement?: string;
};

export type LfgDraftResponse = {
  title: string;
  description: string;
  voiceMode: string | null;
  playStyle: string | null;
  timeNote: string | null;
  genderPreference: string | null;
  riskNotes: string[];
};

export type AiMatchCandidate = {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  online: boolean;
  score: number;
  reasons: string[];
  possibleRisks: string[];
  icebreaker: string;
};

export type MatchRecommendationRequest = {
  gameId: string;
  rank?: string;
  mode?: string;
  region?: string;
  limit?: number;
};

export type MatchRecommendationResponse = {
  candidates: AiMatchCandidate[];
};

export type MatchRecommendationFeedback = 'suitable' | 'unsuitable' | 'ignored';

export type ChatIcebreakerContext =
  | 'first_message'
  | 'team_invite'
  | 'after_match';

export type ChatIcebreakerResponse = {
  message: string;
  tone: 'friendly' | 'competitive' | 'casual';
  alternatives: string[];
};
export type ModerationRiskLevel = 'low' | 'medium' | 'high';

export type ModerationCategory =
  | 'abuse'
  | 'spam'
  | 'scam'
  | 'harassment'
  | 'external_traffic'
  | 'normal';

export type ModerationSuggestedAction =
  | 'none'
  | 'hide_lfg'
  | 'ban'
  | 'manual_review';

export type ModerationSuggestionResponse = {
  riskLevel: ModerationRiskLevel;
  categories: ModerationCategory[];
  reason: string;
  suggestedAction: ModerationSuggestedAction;
  confidence: number;
};

export const aiApi = {
  createLfgDraft: (body: LfgDraftRequest) =>
    request<LfgDraftResponse>('/ai/lfg/draft', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  createMatchRecommendations: (body: MatchRecommendationRequest) =>
    request<MatchRecommendationResponse>('/ai/match/recommend', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  submitMatchRecommendationFeedback: (body: {
    gameId: string;
    candidateUserId: string;
    feedback: MatchRecommendationFeedback;
  }) =>
    request<{ ok: true }>('/ai/match/feedback', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  createChatIcebreaker: (body: {
    roomId?: string;
    threadId?: string;
    contextType: ChatIcebreakerContext;
  }) =>
    request<ChatIcebreakerResponse>('/ai/chat/icebreaker', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  createModerationSuggestion: (body: { reportId: string }) =>
    request<ModerationSuggestionResponse>('/ai/moderation/suggest', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};