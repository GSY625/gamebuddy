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

    const nextAction = dto.actionTaken ?? 'none';

    if (nextAction === 'ban') {
      this.assertCanManageUser(actor, report.reported);
    }
    if (nextAction === 'hide_lfg' && report.targetType !== 'lfg_post') {
      throw new BadRequestException('当前举报对象不支持下架招募内容');
    }

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

      if (dto.reviewStatus === 'resolved' && nextAction === 'ban' && !report.reported.isBanned) {
        await tx.user.update({
          where: { id: report.reported.id },
          data: { isBanned: true },
        });
        await tx.adminActionLog.create({
          data: {
            actorId: actor.id,
            action: 'user_banned',
            targetType: 'user',
            targetId: report.reported.id,
            note: dto.reviewNote?.trim() || `由举报 ${id} 触发`,
          },
        });
      }

      if (dto.reviewStatus === 'resolved' && nextAction === 'hide_lfg' && report.targetId) {
        await tx.lfgPost.update({
          where: { id: report.targetId },
          data: { status: 'hidden_by_admin' },
        });
        await tx.adminActionLog.create({
          data: {
            actorId: actor.id,
            action: 'lfg_hidden_by_admin',
            targetType: 'lfg_post',
            targetId: report.targetId,
            note: dto.reviewNote?.trim() || `由举报 ${id} 触发`,
          },
        });
      }
    });

    await this.notifications.create(report.reporter.id, {
      type: 'report_result',
      title: dto.reviewStatus === 'resolved' ? '举报已处理' : '举报未通过',
      message:
        dto.reviewStatus === 'resolved'
          ? '你提交的举报已经处理，感谢帮助我们维护社区环境。'
          : '你提交的举报经审核暂未通过，感谢你的反馈。',
      link: '/notifications',
      refId: id,
    });

    if (dto.reviewStatus === 'resolved' && nextAction === 'ban') {
      await this.notifications.create(report.reported.id, {
        type: 'admin_action',
        title: '账号已被封禁',
        message: '由于收到并核实违规举报，你的账号已被管理员封禁。',
        link: '/notifications',
        refId: id,
      });
    }

    if (dto.reviewStatus === 'resolved' && nextAction === 'hide_lfg') {
      await this.notifications.create(report.reported.id, {
        type: 'admin_action',
        title: '招募内容已被下架',
        message: '你发布的招募内容因违规举报核实成立，已被管理员下架。',
        link: '/notifications',
        refId: report.targetId ?? id,
      });
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

    await this.notifications.create(userId, {
      type: 'admin_action',
      title: dto.banned ? '账号已被封禁' : '账号已恢复使用',
      message: dto.banned
        ? '你的账号已被管理员封禁，如有疑问请联系平台。'
        : '你的账号已被管理员解除封禁，可重新登录使用。',
      link: '/notifications',
      refId: userId,
    });

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

    await this.notifications.create(userId, {
      type: 'admin_action',
      title: dto.enabled ? '功能已被限制' : '功能限制已解除',
      message: dto.enabled
        ? `你已被限制${RESTRICTION_LABELS[dto.type]}。`
        : `你被限制的“${RESTRICTION_LABELS[dto.type]}”功能已恢复。`,
      link: '/notifications',
      refId: userId,
    });

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
