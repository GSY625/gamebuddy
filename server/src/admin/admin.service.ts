import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ReviewReportDto,
  SetUserBanDto,
  SetUserRestrictionDto,
} from './admin.dto';
import { BusinessLogService } from '../logging/business-log.service';
import { AuthSessionService } from '../auth/auth-session.service';
import { ChatGateway } from '../chat/chat.gateway';

type AdminActor = {
  id: string;
  role: string;
  nickname: string;
};

type ReviewAction = NonNullable<ReviewReportDto['actionTaken']> | 'none';

const RESTRICTION_LABELS: Record<
  SetUserRestrictionDto['type'],
  string
> = {
  invite: '发送邀请',
  direct_message: '发送私信',
  lfg: '发布招募',
  chat: '聊天发言',
};

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private businessLog: BusinessLogService,
    private authSessions: AuthSessionService,
    private chatGateway: ChatGateway,
  ) {}

  private async logAction(
    actorId: string,
    action: string,
    targetType: string,
    targetId?: string,
    note?: string,
  ) {
    return this.prisma.adminActionLog.create({
      data: {
        actorId,
        action,
        targetType,
        targetId,
        note: note?.trim() || undefined,
      },
    });
  }

  private async notifyAdminAction(
    userId: string,
    title: string,
    message: string,
    refId: string,
  ) {
    await this.notifications.create(userId, {
      type: 'admin_action',
      title,
      message,
      link: '/notifications',
      refId,
    });
  }

  private async notifyReportResult(
    reporterId: string,
    reportId: string,
    reviewStatus: ReviewReportDto['reviewStatus'],
  ) {
    await this.notifications.create(reporterId, {
      type: 'report_result',
      title: reviewStatus === 'resolved' ? '举报已处理' : '举报未通过',
      message:
        reviewStatus === 'resolved'
          ? '你提交的举报已经处理，感谢帮助我们维护社区环境。'
          : '你提交的举报经审核暂未通过，感谢你的反馈。',
      link: '/notifications',
      refId: reportId,
    });
  }

  private assertCanManageUser(actor: AdminActor, target: { id: string; role: string }) {
    if (actor.id === target.id) {
      throw new BadRequestException('不能操作自己的管理员账号');
    }
    if (target.role === 'superAdmin') {
      throw new ForbiddenException('不能修改超级管理员');
    }
    if (target.role === 'admin' && actor.role !== 'superAdmin') {
      throw new ForbiddenException('仅超级管理员可修改管理员账号');
    }
  }

  private validateReviewAction(
    actor: AdminActor,
    report: {
      targetType: string | null;
      reported: { id: string; role: string };
    },
    nextAction: ReviewAction,
  ) {
    if (nextAction === 'ban') {
      this.assertCanManageUser(actor, report.reported);
    }

    if (nextAction === 'hide_lfg' && report.targetType !== 'lfg_post') {
      throw new BadRequestException('当前举报对象不支持下架招募内容');
    }
  }

  private async applyResolvedReviewAction(
    tx: Pick<PrismaService, 'user' | 'lfgPost' | 'adminActionLog'>,
    actorId: string,
    report: {
      reported: { id: string; isBanned: boolean };
      targetId: string | null;
    },
    reportId: string,
    nextAction: ReviewAction,
    reviewNote?: string,
  ) {
    if (nextAction === 'ban' && !report.reported.isBanned) {
      await tx.user.update({
        where: { id: report.reported.id },
        data: { isBanned: true },
      });
      await tx.adminActionLog.create({
        data: {
          actorId,
          action: 'user_banned',
          targetType: 'user',
          targetId: report.reported.id,
          note: reviewNote?.trim() || `由举报 ${reportId} 触发`,
        },
      });
    }

    if (nextAction === 'hide_lfg' && report.targetId) {
      await tx.lfgPost.update({
        where: { id: report.targetId },
        data: { status: 'hidden_by_admin' },
      });
      await tx.adminActionLog.create({
        data: {
          actorId,
          action: 'lfg_hidden_by_admin',
          targetType: 'lfg_post',
          targetId: report.targetId,
          note: reviewNote?.trim() || `由举报 ${reportId} 触发`,
        },
      });
    }
  }

  private async notifyResolvedReviewAction(
    report: {
      reported: { id: string };
      targetId: string | null;
    },
    reportId: string,
    nextAction: ReviewAction,
  ) {
    if (nextAction === 'ban') {
      await this.notifyAdminAction(
        report.reported.id,
        '账号已被封禁',
        '由于收到并核实违规举报，你的账号已被管理员封禁。',
        reportId,
      );
    }

    if (nextAction === 'hide_lfg') {
      await this.notifyAdminAction(
        report.reported.id,
        '招募内容已被下架',
        '你发布的招募内容因违规举报核实成立，已被管理员下架。',
        report.targetId ?? reportId,
      );
    }
  }

  private async resolveReportContext(report: {
    targetType: string | null;
    targetId: string | null;
  }) {
    if (!report.targetType || !report.targetId) return null;

    if (report.targetType === 'lfg_post') {
      return this.prisma.lfgPost.findUnique({
        where: { id: report.targetId },
        include: {
          author: { select: { id: true, nickname: true, avatarUrl: true } },
          game: { select: { id: true, name: true, icon: true } },
        },
      });
    }

    if (report.targetType === 'chat_message') {
      return this.prisma.chatMessage.findUnique({
        where: { id: report.targetId },
        include: {
          user: { select: { id: true, nickname: true, avatarUrl: true } },
          room: { select: { id: true, roomCode: true, name: true } },
        },
      });
    }

    if (report.targetType === 'direct_message') {
      return this.prisma.directMessage.findUnique({
        where: { id: report.targetId },
        include: {
          sender: { select: { id: true, nickname: true, avatarUrl: true } },
          thread: { select: { id: true, userAId: true, userBId: true } },
        },
      });
    }

    return null;
  }

  async getOverview() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      pendingReports,
      totalReports,
      bannedUsers,
      adminUsers,
      activeRestrictions,
      recentActions,
    ] = await Promise.all([
      this.prisma.report.count({ where: { reviewStatus: 'pending' } }),
      this.prisma.report.count(),
      this.prisma.user.count({ where: { isBanned: true } }),
      this.prisma.user.count({
        where: { role: { in: ['admin', 'superAdmin'] } },
      }),
      this.prisma.userRestriction.count({ where: { active: true } }),
      this.prisma.adminActionLog.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { id: true, nickname: true, role: true } },
        },
      }),
    ]);

    const reviewedToday = await this.prisma.report.count({
      where: {
        reviewedAt: { gte: today },
        reviewStatus: { in: ['resolved', 'rejected'] },
      },
    });

    return {
      metrics: {
        pendingReports,
        totalReports,
        reviewedToday,
        bannedUsers,
        adminUsers,
        activeRestrictions,
      },
      recentActions,
    };
  }


  private numberValue(value: unknown) {
    if (typeof value === 'bigint') return Number(value);
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return Number(value) || 0;
    if (value && typeof value === 'object' && 'toString' in value) {
      const parsed = Number(value.toString());
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  private countMap(rows: Array<Record<string, unknown>>, key = 'key') {
    return Object.fromEntries(
      rows.map((row) => [String(row[key] ?? 'unknown'), this.numberValue(row.count)]),
    );
  }

  async getAiStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [summaryRows, sceneRows, modelRows, feedbackRows, moderationRows] =
      await Promise.all([
        this.prisma.$queryRaw<
          Array<{
            total_calls: unknown;
            today_calls: unknown;
            success_calls: unknown;
            failed_calls: unknown;
            avg_latency_ms: unknown;
          }>
        >`
          SELECT
            COUNT(*) AS total_calls,
            COUNT(*) FILTER (WHERE "created_at" >= ${today}) AS today_calls,
            COUNT(*) FILTER (WHERE "status" = 'success') AS success_calls,
            COUNT(*) FILTER (WHERE "status" = 'failed') AS failed_calls,
            COALESCE(AVG("latency_ms"), 0) AS avg_latency_ms
          FROM "ai_interaction_logs"
        `,
        this.prisma.$queryRaw<Array<{ key: string; count: unknown }>>`
          SELECT "scene" AS key, COUNT(*) AS count
          FROM "ai_interaction_logs"
          GROUP BY "scene"
          ORDER BY count DESC
        `,
        this.prisma.$queryRaw<Array<{ key: string; count: unknown }>>`
          SELECT "model" AS key, COUNT(*) AS count
          FROM "ai_interaction_logs"
          GROUP BY "model"
          ORDER BY count DESC
        `,
        this.prisma.$queryRaw<Array<{ key: string; count: unknown }>>`
          SELECT COALESCE("feedback", 'pending') AS key, COUNT(*) AS count
          FROM "ai_match_recommendations"
          GROUP BY COALESCE("feedback", 'pending')
          ORDER BY count DESC
        `,
        this.prisma.$queryRaw<Array<{ key: string; count: unknown }>>`
          SELECT COALESCE("admin_action", 'pending') AS key, COUNT(*) AS count
          FROM "ai_moderation_suggestions"
          GROUP BY COALESCE("admin_action", 'pending')
          ORDER BY count DESC
        `,
      ]);

    const summary = summaryRows[0] ?? {
      total_calls: 0,
      today_calls: 0,
      success_calls: 0,
      failed_calls: 0,
      avg_latency_ms: 0,
    };
    const totalCalls = this.numberValue(summary.total_calls);
    const successCalls = this.numberValue(summary.success_calls);
    const failedCalls = this.numberValue(summary.failed_calls);
    const feedback = this.countMap(feedbackRows);
    const moderation = this.countMap(moderationRows);

    return {
      todayCalls: this.numberValue(summary.today_calls),
      totalCalls,
      sceneCounts: this.countMap(sceneRows),
      successRate: totalCalls > 0 ? Math.round((successCalls / totalCalls) * 1000) / 10 : 0,
      failedCalls,
      averageLatencyMs: Math.round(this.numberValue(summary.avg_latency_ms)),
      modelDistribution: this.countMap(modelRows),
      matchFeedback: {
        total: feedbackRows.reduce((sum, row) => sum + this.numberValue(row.count), 0),
        suitable: feedback.suitable ?? 0,
        unsuitable: feedback.unsuitable ?? 0,
        ignored: feedback.ignored ?? 0,
        pending: feedback.pending ?? 0,
      },
      moderationSuggestions: {
        total: moderationRows.reduce((sum, row) => sum + this.numberValue(row.count), 0),
        adopted: moderation.adopted ?? 0,
        ignored: moderation.ignored ?? 0,
        pending: moderation.pending ?? 0,
      },
    };
  }


  async markAiModerationSuggestionAction(
    reportId: string,
    adminAction: 'adopted' | 'ignored',
  ) {
    if (adminAction !== 'adopted' && adminAction !== 'ignored') {
      throw new BadRequestException('Invalid AI suggestion action');
    }

    await this.prisma.$executeRaw`
      UPDATE "ai_moderation_suggestions"
      SET "admin_action" = ${adminAction}
      WHERE "id" = (
        SELECT "id"
        FROM "ai_moderation_suggestions"
        WHERE "report_id" = ${reportId}
        ORDER BY "created_at" DESC
        LIMIT 1
      )
    `;

    return { ok: true };
  }

  async listReports(status?: string) {
    return this.prisma.report.findMany({
      where: status ? { reviewStatus: status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: { select: { id: true, nickname: true, email: true } },
        reported: {
          select: { id: true, nickname: true, email: true, isBanned: true, role: true },
        },
        reviewer: { select: { id: true, nickname: true, role: true } },
      },
    });
  }

  async getReport(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        reporter: { select: { id: true, nickname: true, email: true } },
        reported: {
          select: {
            id: true,
            nickname: true,
            email: true,
            isBanned: true,
            role: true,
            createdAt: true,
          },
        },
        reviewer: { select: { id: true, nickname: true, role: true } },
      },
    });
    if (!report) throw new NotFoundException('举报记录不存在');
    const recentReports = await this.prisma.report.findMany({
      where: { reportedId: report.reportedId },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: { select: { id: true, nickname: true } },
      },
    });

    return {
      ...report,
      targetContext: await this.resolveReportContext(report),
      recentReports,
    };
  }

  async reviewReport(actor: AdminActor, id: string, dto: ReviewReportDto) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        reporter: { select: { id: true, nickname: true } },
        reported: { select: { id: true, nickname: true, role: true, isBanned: true } },
      },
    });
    if (!report) throw new NotFoundException('举报记录不存在');

    const nextAction: ReviewAction = dto.actionTaken ?? 'none';
    this.validateReviewAction(actor, report, nextAction);

    await this.prisma.$transaction(async (tx) => {
      await tx.report.update({
        where: { id },
        data: {
          reviewStatus: dto.reviewStatus,
          reviewedBy: actor.id,
          reviewedAt: new Date(),
          reviewNote: dto.reviewNote?.trim() || null,
          actionTaken: nextAction,
          status: dto.reviewStatus === 'resolved' ? 'resolved' : 'rejected',
        },
      });

      await tx.adminActionLog.create({
        data: {
          actorId: actor.id,
          action: `report_${dto.reviewStatus}`,
          targetType: 'report',
          targetId: id,
          note: dto.reviewNote?.trim() || nextAction,
        },
      });

      if (dto.reviewStatus === 'resolved') {
        await this.applyResolvedReviewAction(
          tx,
          actor.id,
          report,
          id,
          nextAction,
          dto.reviewNote,
        );
      }
    });

    await this.notifyReportResult(report.reporter.id, id, dto.reviewStatus);

    if (dto.reviewStatus === 'resolved') {
      await this.notifyResolvedReviewAction(report, id, nextAction);
    }

    this.businessLog.log('admin.report.reviewed', {
      actorId: actor.id,
      reportId: id,
      reviewStatus: dto.reviewStatus,
      actionTaken: nextAction,
      reportedId: report.reported.id,
      targetType: report.targetType,
      targetId: report.targetId,
    });

    return this.getReport(id);
  }

  async listUsers(query?: string, banned?: string) {
    const trimmed = query?.trim();
    return this.prisma.user.findMany({
      where: {
        ...(trimmed
          ? {
              OR: [
                { nickname: { contains: trimmed } },
                { email: { contains: trimmed } },
              ],
            }
          : {}),
        ...(banned === 'true'
          ? { isBanned: true }
          : banned === 'false'
            ? { isBanned: false }
            : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        nickname: true,
        role: true,
        avatarUrl: true,
        isVip: true,
        isBanned: true,
        createdAt: true,
        _count: {
          select: {
            reportsAgainst: true,
            reportsFiled: true,
          },
        },
      },
    });
  }

  async getUserDetail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        nickname: true,
        role: true,
        avatarUrl: true,
        bio: true,
        isVip: true,
        isBanned: true,
        createdAt: true,
        _count: {
          select: {
            reportsAgainst: true,
            reportsFiled: true,
            friendshipsAsUser: true,
            friendshipsAsFriend: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('用户不存在');

    const [reportsAgainst, reportsFiled, actionLogs, restrictions, lfgPosts] =
      await Promise.all([
        this.prisma.report.findMany({
          where: { reportedId: id },
          orderBy: { createdAt: 'desc' },
          take: 12,
          include: {
            reporter: { select: { id: true, nickname: true } },
            reviewer: { select: { id: true, nickname: true } },
          },
        }),
        this.prisma.report.findMany({
          where: { reporterId: id },
          orderBy: { createdAt: 'desc' },
          take: 12,
          include: {
            reported: { select: { id: true, nickname: true } },
          },
        }),
        this.prisma.adminActionLog.findMany({
          where: { targetType: 'user', targetId: id },
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            actor: { select: { id: true, nickname: true, role: true } },
          },
        }),
        this.prisma.userRestriction.findMany({
          where: { userId: id, active: true },
          orderBy: { updatedAt: 'desc' },
        }),
        this.prisma.lfgPost.findMany({
          where: { authorId: id },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            createdAt: true,
            game: { select: { id: true, name: true, icon: true } },
          },
        }),
      ]);

    return {
      ...user,
      reportsAgainst,
      reportsFiled,
      actionLogs,
      restrictions,
      lfgPosts,
    };
  }

  async setUserBan(actor: AdminActor, userId: string, dto: SetUserBanDto) {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, nickname: true, role: true, isBanned: true },
    });
    if (!target) throw new NotFoundException('用户不存在');

    this.assertCanManageUser(actor, target);

    if (target.isBanned === dto.banned) {
      return this.getUserDetail(userId);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isBanned: dto.banned },
    });

    if (dto.banned) {
      await this.authSessions.revokeAllUserSessions(userId);
      await this.chatGateway.disconnectUserByBan(
        userId,
        '你的账号已被管理员封禁，如有疑问请联系平台。',
      );
    }

    await this.logAction(
      actor.id,
      dto.banned ? 'user_banned' : 'user_unbanned',
      'user',
      userId,
      dto.note,
    );

    await this.notifyAdminAction(
      userId,
      dto.banned ? '账号已被封禁' : '账号已恢复使用',
      dto.banned
        ? '你的账号已被管理员封禁，如有疑问请联系平台。'
        : '你的账号已被管理员解除封禁，可重新登录使用。',
      userId,
    );

    this.businessLog.log('admin.user.ban_changed', {
      actorId: actor.id,
      targetUserId: userId,
      banned: dto.banned,
    });

    return this.getUserDetail(userId);
  }

  async setUserRestriction(
    actor: AdminActor,
    userId: string,
    dto: SetUserRestrictionDto,
  ) {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!target) throw new NotFoundException('用户不存在');

    this.assertCanManageUser(actor, target);

    await this.prisma.userRestriction.upsert({
      where: { userId_type: { userId, type: dto.type } },
      create: {
        userId,
        type: dto.type,
        active: dto.enabled,
        note: dto.note?.trim() || null,
      },
      update: {
        active: dto.enabled,
        note: dto.note?.trim() || null,
      },
    });

    await this.logAction(
      actor.id,
      dto.enabled ? 'user_restriction_enabled' : 'user_restriction_disabled',
      'user',
      userId,
      `${dto.type}${dto.note ? `：${dto.note}` : ''}`,
    );

    await this.notifyAdminAction(
      userId,
      dto.enabled ? '功能已被限制' : '功能限制已解除',
      dto.enabled
        ? `你已被限制${RESTRICTION_LABELS[dto.type]}。`
        : `你被限制的“${RESTRICTION_LABELS[dto.type]}”功能已恢复。`,
      userId,
    );

    this.businessLog.log('admin.user.restriction_changed', {
      actorId: actor.id,
      targetUserId: userId,
      type: dto.type,
      enabled: dto.enabled,
    });

    return this.getUserDetail(userId);
  }

  async listActionLogs(limit = 50) {
    return this.prisma.adminActionLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { id: true, nickname: true, role: true } },
      },
    });
  }
}
