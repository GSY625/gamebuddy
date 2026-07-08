import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AdminService } from '../admin/admin.service';
import { containsSensitive } from '../common/sensitive-filter';
import { PrismaService } from '../prisma/prisma.service';
import { ProfilesService } from '../profiles/profiles.service';
import {
  CreateChatIcebreakerDto,
  CreateLfgDraftDto,
  MatchRecommendationFeedbackDto,
  ModerationSuggestDto,
  RecommendMatchDto,
} from './ai.dto';
import { AiLogService } from './ai-log.service';
import { AiProviderService } from './ai-provider.service';
import type {
  AiChatCompletionOptions,
  AiChatCompletionResult,
  AiHealthStatus,
} from './ai.types';

type MatchProfile = Awaited<ReturnType<ProfilesService['search']>>[number];
type AdminReportContext = Awaited<ReturnType<AdminService['getReport']>>;

type MatchCandidate = {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  online: boolean;
  score: number;
  reasons: string[];
  possibleRisks: string[];
  icebreaker: string;
};

type ChatIcebreakerTone = 'friendly' | 'competitive' | 'casual';
type ModerationRiskLevel = 'low' | 'medium' | 'high';
type ModerationCategory =
  | 'abuse'
  | 'spam'
  | 'scam'
  | 'harassment'
  | 'external_traffic'
  | 'normal';
type ModerationSuggestedAction =
  | 'none'
  | 'hide_lfg'
  | 'ban'
  | 'manual_review';

type ModerationSuggestion = {
  riskLevel: ModerationRiskLevel;
  categories: ModerationCategory[];
  reason: string;
  suggestedAction: ModerationSuggestedAction;
  confidence: number;
};

const MODERATION_CATEGORIES: ModerationCategory[] = [
  'abuse',
  'spam',
  'scam',
  'harassment',
  'external_traffic',
  'normal',
];

const MODERATION_ACTIONS: ModerationSuggestedAction[] = [
  'none',
  'hide_lfg',
  'ban',
  'manual_review',
];

const UNSAFE_ICEBREAKER_PATTERNS = [
  /wechat/i,
  /weixin/i,
  /qq\b/i,
  /discord/i,
  /telegram/i,
  /alipay/i,
  /paypal/i,
  /transfer/i,
  /payment/i,
  /money/i,
  /\u52a0\u5fae\u4fe1/,
  /\u52a0\s*q/i,
  /\u8f6c\u8d26/,
  /\u4ed8\u6b3e/,
  /\u6253\u94b1/,
  /\u88f8\u804a/,
  /\u7ea6\u70ae/,
  /\u8272\u60c5/,
  /\u8fb1\u9a82/,
  /\u4f4e\u4fd7/,
  /\u9a9a\u6270/,
  /加微信/,
  /加qq/i,
  /转账/,
  /付款/,
  /打钱/,
  /裸聊/,
  /约炮/,
  /色情/,
  /辱骂/,
];

@Injectable()
export class AiService {
  constructor(
    private provider: AiProviderService,
    private prisma: PrismaService,
    private profiles: ProfilesService,
    private logs: AiLogService,
    private admin: AdminService,
  ) {}

  getHealth(): AiHealthStatus {
    return this.provider.getHealth();
  }

  chatCompletion(
    options: AiChatCompletionOptions,
  ): Promise<AiChatCompletionResult> {
    return this.provider.chatCompletion(options);
  }


  private aiInputSummary(messages: AiChatCompletionOptions['messages']) {
    return messages
      .map((message) => `${message.role}: ${message.content}`)
      .join('\n')
      .slice(0, 2000);
  }

  private aiErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  private async runLoggedCompletion<T>(
    options: AiChatCompletionOptions,
    parseResult: (
      content: string,
      result: AiChatCompletionResult,
    ) => T | Promise<T>,
  ): Promise<T> {
    const startedAt = Date.now();
    const inputSummary =
      options.inputSummary?.trim() || this.aiInputSummary(options.messages);
    let result: AiChatCompletionResult | null = null;

    try {
      result = await this.provider.chatCompletion({ ...options, deferLog: true });
    } catch (error) {
      await this.logs.record({
        userId: options.userId,
        scene: options.scene,
        model: options.modelTier || 'unknown',
        inputSummary,
        latencyMs: Date.now() - startedAt,
        status: 'failed',
        errorMessage: this.aiErrorMessage(error),
      });
      throw error;
    }

    try {
      const parsed = await parseResult(result.content, result);
      await this.logs.record({
        userId: options.userId,
        scene: options.scene,
        model: result.model,
        inputSummary,
        outputSummary: result.content,
        latencyMs: result.latencyMs,
        status: 'success',
      });
      return parsed;
    } catch (error) {
      await this.logs.record({
        userId: options.userId,
        scene: options.scene,
        model: result.model,
        inputSummary,
        outputSummary: result.content,
        latencyMs: result.latencyMs,
        status: 'failed',
        errorMessage: this.aiErrorMessage(error),
      });
      throw error;
    }
  }

  async createLfgDraft(userId: string, dto: CreateLfgDraftDto) {
    const game = await this.prisma.game.findUnique({
      where: { id: dto.gameId },
      select: { name: true },
    });
    if (!game) throw new NotFoundException('Game not found');

    return this.runLoggedCompletion({
      userId,
      scene: 'lfg_draft',
      modelTier: 'fast',
      temperature: 0.5,
      maxTokens: 700,
      inputSummary: JSON.stringify({
        gameId: dto.gameId,
        gameName: game.name,
        voiceMode: dto.voiceMode,
        playStyle: dto.playStyle,
        timeNote: dto.timeNote,
        genderPreference: dto.genderPreference,
        extraRequirement: dto.extraRequirement,
      }),
      messages: [
        {
          role: 'system',
          content:
            'You are GameBuddy LFG copy helper. Only draft a post. Do not publish, invite, apply, or send messages. Output strict JSON only.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'Draft a friendly and clear looking-for-group post.',
            outputSchema: {
              title: 'string, <= 30 Chinese chars or concise equivalent',
              description: 'string, <= 120 Chinese chars or concise equivalent',
              voiceMode: 'string|null',
              playStyle: 'string|null',
              timeNote: 'string|null',
              genderPreference: 'string|null',
              riskNotes: 'string[], max 3',
            },
            safety: [
              'No insults, discrimination, harassment, or privacy requests.',
              'Never say the post has been published.',
              'Return JSON only.',
            ],
            context: {
              gameName: game.name,
              voiceMode: dto.voiceMode ?? null,
              playStyle: dto.playStyle ?? null,
              timeNote: dto.timeNote ?? null,
              genderPreference: dto.genderPreference ?? null,
              extraRequirement: dto.extraRequirement ?? null,
            },
          }),
        },
      ],
    }, (content) => this.parseLfgDraft(content));
  }

  async recommendMatch(userId: string, dto: RecommendMatchDto) {
    const limit = dto.limit ?? 5;
    const game = await this.prisma.game.findUnique({
      where: { id: dto.gameId },
      select: { name: true, slug: true },
    });
    if (!game) throw new NotFoundException('Game not found');

    const profiles = await this.profiles.search(
      dto.gameId,
      {
        rank: dto.rank,
        mode: dto.mode,
        region: dto.region,
      },
      userId,
    );
    const pool = profiles.slice(0, Math.max(limit * 4, 12));

    if (pool.length === 0) {
      await this.logs.record({
        userId,
        scene: 'match_recommend',
        model: 'none',
        inputSummary: JSON.stringify({ gameId: dto.gameId, emptyPool: true }),
        outputSummary: 'no candidates',
        latencyMs: 0,
        status: 'success',
      });
      return { candidates: [] };
    }

    const aiCandidates = await this.askAiForMatchRecommendations({
      userId,
      gameName: game.name,
      filters: dto,
      profiles: pool,
      limit,
    });
    const candidates = this.mergeAiMatchCandidates(pool, aiCandidates, limit);
    await Promise.all(
      candidates.map((candidate) =>
        this.recordMatchRecommendation(userId, dto.gameId, candidate),
      ),
    );

    return { candidates };
  }

  async recordMatchFeedback(
    userId: string,
    dto: MatchRecommendationFeedbackDto,
  ) {
    await this.prisma.$executeRaw`
      UPDATE "ai_match_recommendations"
      SET "feedback" = ${dto.feedback}
      WHERE "id" = (
        SELECT "id"
        FROM "ai_match_recommendations"
        WHERE "user_id" = ${userId}
          AND "game_id" = ${dto.gameId}
          AND "candidate_user_id" = ${dto.candidateUserId}
        ORDER BY "created_at" DESC
        LIMIT 1
      )
    `;
    return { ok: true };
  }

  async createChatIcebreaker(userId: string, dto: CreateChatIcebreakerDto) {
    if (dto.roomId && dto.threadId) {
      throw new BadRequestException('Provide either roomId or threadId, not both');
    }

    if (dto.threadId) {
      return this.createDirectMessageIcebreaker(userId, dto);
    }

    if (dto.roomId) {
      return this.createRoomIcebreaker(userId, dto);
    }

    throw new BadRequestException('roomId or threadId is required');
  }

  private async createRoomIcebreaker(userId: string, dto: CreateChatIcebreakerDto) {
    if (!dto.roomId) {
      throw new BadRequestException('roomId is required');
    }

    const room = await this.prisma.chatRoom.findUnique({
      where: { id: dto.roomId },
      select: {
        id: true,
        roomCode: true,
        name: true,
        party: {
          select: {
            id: true,
            gameId: true,
            voiceHint: true,
            maxMembers: true,
            members: {
              select: {
                userId: true,
                role: true,
                user: { select: { nickname: true } },
              },
            },
          },
        },
      },
    });
    if (!room?.party) throw new NotFoundException('Room not found');

    const self = room.party.members.find((member) => member.userId === userId);
    if (!self) throw new ForbiddenException('You are not a room member');

    const game = room.party.gameId
      ? await this.prisma.game.findUnique({
          where: { id: room.party.gameId },
          select: { name: true },
        })
      : null;

    const memberNicknames = room.party.members
      .map((member) => member.user.nickname)
      .filter(Boolean)
      .slice(0, 8);

    return this.runLoggedCompletion({
      userId,
      scene: 'chat_icebreaker',
      modelTier: 'fast',
      temperature: 0.55,
      maxTokens: 500,
      inputSummary: JSON.stringify({
        roomId: dto.roomId,
        contextType: dto.contextType,
        gameName: game?.name ?? null,
        memberCount: room.party.members.length,
      }),
      messages: [
        {
          role: 'system',
          content:
            'You are GameBuddy chat icebreaker assistant. Generate one message draft only. Do not send messages. Output strict JSON only. Use Simplified Chinese. No insults, vulgarity, harassment, payment/transfer requests, or external contact diversion.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'Write a short Simplified Chinese chat icebreaker for a game party room.',
            outputSchema: {
              message: 'string, <= 80 Chinese chars',
              tone: 'friendly | competitive | casual',
              alternatives: 'string[], max 3, each <= 80 Chinese chars',
            },
            context: {
              contextType: dto.contextType,
              roomName: room.name,
              roomCode: room.roomCode,
              gameName: game?.name ?? null,
              voiceHint: room.party.voiceHint,
              maxMembers: room.party.maxMembers,
              selfNickname: self.user.nickname,
              memberNicknames,
            },
          }),
        },
      ],
    }, (content) => this.parseChatIcebreaker(content));
  }

  private async createDirectMessageIcebreaker(
    userId: string,
    dto: CreateChatIcebreakerDto,
  ) {
    if (!dto.threadId) {
      throw new BadRequestException('threadId is required');
    }

    const thread = await this.prisma.directMessageThread.findUnique({
      where: { id: dto.threadId },
      select: {
        id: true,
        userAId: true,
        userBId: true,
        userA: { select: { nickname: true } },
        userB: { select: { nickname: true } },
        messages: {
          take: 3,
          orderBy: { createdAt: 'desc' },
          select: {
            content: true,
            sender: { select: { id: true, nickname: true } },
          },
        },
      },
    });

    if (!thread) throw new NotFoundException('Direct message thread not found');
    if (thread.userAId !== userId && thread.userBId !== userId) {
      throw new ForbiddenException('You are not a direct message participant');
    }

    const self = thread.userAId === userId ? thread.userA : thread.userB;
    const friend = thread.userAId === userId ? thread.userB : thread.userA;
    const recentMessages = [...thread.messages].reverse().map((message) => ({
      senderNickname: message.sender.nickname,
      fromSelf: message.sender.id === userId,
      content: message.content.slice(0, 120),
    }));

    return this.runLoggedCompletion({
      userId,
      scene: 'chat_icebreaker',
      modelTier: 'fast',
      temperature: 0.55,
      maxTokens: 500,
      inputSummary: JSON.stringify({
        threadId: dto.threadId,
        contextType: dto.contextType,
        friendNickname: friend.nickname,
        recentMessageCount: recentMessages.length,
      }),
      messages: [
        {
          role: 'system',
          content:
            'You are GameBuddy direct-message icebreaker assistant. Generate one message draft only. Do not send messages. Output strict JSON only. Use Simplified Chinese. No insults, vulgarity, harassment, payment/transfer requests, or external contact diversion.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'Write a short Simplified Chinese private-message icebreaker between two GameBuddy friends.',
            outputSchema: {
              message: 'string, <= 80 Chinese chars',
              tone: 'friendly | competitive | casual',
              alternatives: 'string[], max 3, each <= 80 Chinese chars',
            },
            context: {
              contextType: dto.contextType,
              selfNickname: self.nickname,
              friendNickname: friend.nickname,
              recentMessages,
            },
          }),
        },
      ],
    }, (content) => this.parseChatIcebreaker(content));
  }

  async suggestModeration(adminId: string, dto: ModerationSuggestDto) {
    const report = await this.admin.getReport(dto.reportId);
    const moderationContext = this.buildModerationContext(report);

    const suggestion = await this.runLoggedCompletion({
      userId: adminId,
      scene: 'moderation_suggest',
      modelTier: 'fast',
      temperature: 0.2,
      maxTokens: 700,
      inputSummary: JSON.stringify({
        reportId: report.id,
        targetType: report.targetType ?? 'user',
        reason: report.reason,
        recentReports: report.recentReports.length,
      }),
      messages: [
        {
          role: 'system',
          content:
            'You are GameBuddy admin moderation assistant. Only provide review advice. Do not approve, reject, ban, hide posts, or change report status. Output strict JSON only.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'Assess this user report and suggest a moderation decision for a human admin.',
            outputSchema: {
              riskLevel: 'low | medium | high',
              categories:
                'array of abuse | spam | scam | harassment | external_traffic | normal',
              reason: 'string, concise evidence-based explanation',
              suggestedAction: 'none | hide_lfg | ban | manual_review',
              confidence: 'number from 0 to 100',
            },
            rules: [
              'Advice only; do not claim any action has been executed.',
              'Use only supplied report context and recent report patterns.',
              'Prefer manual_review when evidence is incomplete.',
              'Use hide_lfg only when targetType is lfg_post.',
              'Return JSON only.',
            ],
            report: moderationContext,
          }),
        },
      ],
    }, (content) =>
      this.parseModerationSuggestion(content, report.targetType),
    );
    await this.recordModerationSuggestion(report.id, suggestion);
    return suggestion;
  }

  private async askAiForMatchRecommendations(input: {
    userId: string;
    gameName: string;
    filters: RecommendMatchDto;
    profiles: MatchProfile[];
    limit: number;
  }) {
    return this.runLoggedCompletion({
      userId: input.userId,
      scene: 'match_recommend',
      modelTier: 'quality',
      temperature: 0.35,
      maxTokens: 1200,
      inputSummary: JSON.stringify({
        gameId: input.filters.gameId,
        rank: input.filters.rank,
        mode: input.filters.mode,
        region: input.filters.region,
        profileCount: input.profiles.length,
      }),
      messages: [
        {
          role: 'system',
          content:
            'You are GameBuddy teammate recommendation assistant. You only rank already-visible candidates and write reasons. Do not invite, apply, create parties, or send messages. Output strict JSON only.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'Rank teammate candidates for a game square search.',
            gameName: input.gameName,
            filters: {
              rank: input.filters.rank ?? null,
              mode: input.filters.mode ?? null,
              region: input.filters.region ?? null,
            },
            outputSchema: {
              candidates:
                'array of { userId, score 0-100, reasons string[], possibleRisks string[], icebreaker string }',
            },
            rules: [
              'Use only userIds from candidates.',
              'Give practical reasons based on profile fields and online state.',
              'Do not infer sensitive attributes.',
              'Keep icebreaker friendly and non-pushy.',
              `Return at most ${input.limit} candidates.`,
            ],
            candidates: input.profiles.map((profile) => ({
              userId: profile.userId,
              nickname: profile.nickname,
              online: profile.online,
              profileName: profile.profileName,
              fieldValues: profile.fieldValues,
              updatedAt: profile.updatedAt,
            })),
          }),
        },
      ],
    }, (content) => {
      const parsed = this.parseJsonObject(content);
      return Array.isArray(parsed.candidates) ? parsed.candidates : [];
    });
  }

  private mergeAiMatchCandidates(
    profiles: MatchProfile[],
    aiCandidates: unknown[],
    limit: number,
  ): MatchCandidate[] {
    const profileMap = new Map(profiles.map((profile) => [profile.userId, profile]));
    const picked = new Set<string>();
    const merged: MatchCandidate[] = [];

    for (const raw of aiCandidates) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as Record<string, unknown>;
      const userId = this.stringValue(item.userId, 120);
      const profile = profileMap.get(userId);
      if (!profile || picked.has(userId)) continue;
      picked.add(userId);
      merged.push(this.toMatchCandidate(profile, item));
      if (merged.length >= limit) return merged;
    }

    for (const profile of profiles) {
      if (picked.has(profile.userId)) continue;
      picked.add(profile.userId);
      merged.push(this.toMatchCandidate(profile));
      if (merged.length >= limit) break;
    }

    return merged;
  }

  private toMatchCandidate(
    profile: MatchProfile,
    ai?: Record<string, unknown>,
  ): MatchCandidate {
    return {
      userId: profile.userId,
      nickname: profile.nickname,
      avatarUrl: profile.avatarUrl ?? null,
      online: profile.online,
      score: this.scoreValue(ai?.score, profile.online),
      reasons: this.stringArrayValue(ai?.reasons, 3, 120),
      possibleRisks: this.stringArrayValue(ai?.possibleRisks, 3, 120),
      icebreaker:
        this.stringValue(ai?.icebreaker, 160) ||
        `Want to team up for ${profile.profileName || 'this game'}?`,
    };
  }

  private scoreValue(value: unknown, online: boolean) {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(100, Math.round(parsed)));
    }
    return online ? 75 : 55;
  }

  private async recordMatchRecommendation(
    userId: string,
    gameId: string,
    candidate: MatchCandidate,
  ) {
    await this.prisma.$executeRaw`
      INSERT INTO "ai_match_recommendations" (
        "id",
        "user_id",
        "game_id",
        "candidate_user_id",
        "score",
        "reasons",
        "icebreaker"
      )
      VALUES (
        ${randomUUID()},
        ${userId},
        ${gameId},
        ${candidate.userId},
        ${candidate.score},
        ${JSON.stringify(candidate.reasons)},
        ${candidate.icebreaker}
      )
    `;
  }


  private buildModerationContext(report: AdminReportContext) {
    return {
      id: report.id,
      reason: report.reason,
      detail: report.detail ?? null,
      targetType: report.targetType ?? 'user',
      targetId: report.targetId ?? null,
      reviewStatus: report.reviewStatus,
      createdAt: report.createdAt,
      reporter: {
        id: report.reporter.id,
        nickname: report.reporter.nickname,
      },
      reported: {
        id: report.reported.id,
        nickname: report.reported.nickname,
        role: report.reported.role,
        isBanned: report.reported.isBanned,
        createdAt: report.reported.createdAt,
      },
      targetContext: report.targetContext,
      recentReports: report.recentReports.slice(0, 10).map((recent) => ({
        id: recent.id,
        reason: recent.reason,
        detail: recent.detail ?? null,
        reviewStatus: recent.reviewStatus,
        createdAt: recent.createdAt,
        reporterNickname: recent.reporter.nickname,
      })),
    };
  }

  private async recordModerationSuggestion(
    reportId: string,
    suggestion: ModerationSuggestion,
  ) {
    await this.prisma.$executeRaw`
      INSERT INTO "ai_moderation_suggestions" (
        "id",
        "report_id",
        "risk_level",
        "categories",
        "reason",
        "suggested_action",
        "confidence"
      )
      VALUES (
        ${randomUUID()},
        ${reportId},
        ${suggestion.riskLevel},
        ${JSON.stringify(suggestion.categories)},
        ${suggestion.reason},
        ${suggestion.suggestedAction},
        ${suggestion.confidence}
      )
    `;
  }

  private parseModerationSuggestion(
    content: string,
    targetType?: string | null,
  ): ModerationSuggestion {
    const parsed = this.parseJsonObject(content);
    const categories = this.moderationCategoriesValue(parsed.categories);
    return {
      riskLevel: this.riskLevelValue(parsed.riskLevel),
      categories,
      reason:
        this.stringValue(parsed.reason, 600) ||
        'AI could not produce a clear moderation reason.',
      suggestedAction: this.suggestedActionValue(parsed.suggestedAction, targetType),
      confidence: this.confidenceValue(parsed.confidence),
    };
  }

  private riskLevelValue(value: unknown): ModerationRiskLevel {
    return value === 'high' || value === 'medium' ? value : 'low';
  }

  private moderationCategoriesValue(value: unknown): ModerationCategory[] {
    if (!Array.isArray(value)) return ['normal'];
    const categories = value.filter((item): item is ModerationCategory =>
      MODERATION_CATEGORIES.includes(item as ModerationCategory),
    );
    const unique = [...new Set(categories)];
    if (unique.length === 0) return ['normal'];
    return unique.length > 1 ? unique.filter((item) => item !== 'normal') : unique;
  }

  private suggestedActionValue(
    value: unknown,
    targetType?: string | null,
  ): ModerationSuggestedAction {
    const action = MODERATION_ACTIONS.includes(value as ModerationSuggestedAction)
      ? (value as ModerationSuggestedAction)
      : 'manual_review';
    if (action === 'hide_lfg' && targetType !== 'lfg_post') return 'manual_review';
    return action;
  }

  private confidenceValue(value: unknown) {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) return 0;
    const normalized = numeric > 0 && numeric <= 1 ? numeric * 100 : numeric;
    return Math.max(0, Math.min(100, Math.round(normalized)));
  }

  private parseLfgDraft(content: string) {
    const parsed = this.parseJsonObject(content);
    return {
      title: this.stringValue(parsed.title, 60),
      description: this.stringValue(parsed.description, 240),
      voiceMode: this.nullableStringValue(parsed.voiceMode, 32),
      playStyle: this.nullableStringValue(parsed.playStyle, 32),
      timeNote: this.nullableStringValue(parsed.timeNote, 40),
      genderPreference: this.nullableStringValue(parsed.genderPreference, 32),
      riskNotes: this.stringArrayValue(parsed.riskNotes, 3, 120),
    };
  }

  private parseChatIcebreaker(content: string) {
    const parsed = this.parseJsonObject(content);
    const message = this.stringValue(parsed.message, 120);
    const alternatives = this.stringArrayValue(parsed.alternatives, 3, 120).filter(
      (item) => this.isSafeIcebreakerText(item),
    );
    const tone = this.toneValue(parsed.tone);

    if (!message || !this.isSafeIcebreakerText(message)) {
      throw new BadGatewayException('AI icebreaker did not pass safety checks.');
    }

    return {
      message,
      tone,
      alternatives,
    };
  }

  private toneValue(value: unknown): ChatIcebreakerTone {
    return value === 'competitive' || value === 'casual' ? value : 'friendly';
  }

  private isSafeIcebreakerText(value: string) {
    if (!value.trim()) return false;
    if (containsSensitive(value)) return false;
    return !UNSAFE_ICEBREAKER_PATTERNS.some((pattern) => pattern.test(value));
  }

  private parseJsonObject(content: string): Record<string, unknown> {
    const cleaned = content
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    try {
      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          const parsed = JSON.parse(cleaned.slice(start, end + 1));
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
          }
        } catch {
          // fall through
        }
      }
    }

    throw new BadGatewayException('AI response parse failed. Please retry later.');
  }

  private stringValue(value: unknown, maxLength: number) {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
  }

  private nullableStringValue(value: unknown, maxLength: number) {
    const text = this.stringValue(value, maxLength);
    return text || null;
  }

  private stringArrayValue(value: unknown, maxItems: number, maxLength: number) {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => this.stringValue(item, maxLength))
      .filter(Boolean)
      .slice(0, maxItems);
  }
}