import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PartiesService } from '../parties/parties.service';
import { CreateLfgPostDto, ApplyLfgDto, UpdateLfgPostDto } from './lfg.dto';
import { VisibilityService } from '../visibility/visibility.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class LfgService {
  constructor(
    private prisma: PrismaService,
    private parties: PartiesService,
    private visibility: VisibilityService,
    private notifications: NotificationsService,
  ) {}

  async create(authorId: string, dto: CreateLfgPostDto) {
    await this.visibility.assertOnline(authorId);
    return this.prisma.lfgPost.create({
      data: {
        authorId,
        gameId: dto.gameId,
        title: dto.title,
        description: dto.description,
        mode: dto.mode,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
      include: {
        game: { select: { name: true, icon: true } },
        author: { select: { id: true, nickname: true, avatarUrl: true } },
      },
    });
  }

  async update(postId: string, authorId: string, dto: UpdateLfgPostDto) {
    const post = await this.prisma.lfgPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('帖子不存在');
    if (post.authorId !== authorId) {
      throw new ForbiddenException('只能编辑自己的帖子');
    }
    if (post.status !== 'open') {
      throw new BadRequestException('帖子已关闭，无法编辑');
    }
    if (dto.title !== undefined && !dto.title.trim()) {
      throw new BadRequestException('标题不能为空');
    }
    return this.prisma.lfgPost.update({
      where: { id: postId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.mode !== undefined ? { mode: dto.mode } : {}),
      },
      include: {
        game: { select: { name: true, icon: true } },
        author: { select: { id: true, nickname: true, avatarUrl: true } },
        _count: {
          select: {
            applications: { where: { status: 'pending' } },
          },
        },
      },
    });
  }

  async list(gameId?: string, status = 'open') {
    return this.prisma.lfgPost.findMany({
      where: {
        status,
        ...(gameId ? { gameId } : {}),
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ weight: 'desc' }, { createdAt: 'desc' }],
      include: {
        game: { select: { name: true, icon: true } },
        author: { select: { id: true, nickname: true, avatarUrl: true } },
        _count: {
          select: {
            applications: { where: { status: 'pending' } },
          },
        },
      },
    });
  }

  async myApplications(userId: string) {
    return this.prisma.lfgApplication.findMany({
      where: { userId },
      include: {
        post: {
          include: {
            game: { select: { name: true, icon: true } },
            author: { select: { id: true, nickname: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async apply(postId: string, userId: string, dto: ApplyLfgDto) {
    await this.visibility.assertOnline(userId);
    const post = await this.prisma.lfgPost.findUnique({
      where: { id: postId },
      include: { author: { select: { nickname: true } } },
    });
    if (!post || post.status !== 'open') {
      throw new NotFoundException('帖子不存在或已关闭');
    }
    if (post.authorId === userId) {
      throw new BadRequestException('不能申请自己的帖子');
    }

    const applicant = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { nickname: true },
    });

    const existing = await this.prisma.lfgApplication.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existing?.status === 'pending') {
      throw new BadRequestException('已申请，请等待对方处理');
    }

    const cooldown = await this.prisma.lfgApplicantCooldown.findUnique({
      where: {
        authorId_applicantId: { authorId: post.authorId, applicantId: userId },
      },
    });
    if (cooldown) {
      if (cooldown.expiresAt > new Date()) {
        throw new BadRequestException('对方已暂时拒绝您的申请，请 30 分钟后再试');
      }
      await this.prisma.lfgApplicantCooldown.delete({
        where: { id: cooldown.id },
      });
    }

    const app = await this.prisma.lfgApplication.upsert({
      where: { postId_userId: { postId, userId } },
      create: { postId, userId, message: dto.message },
      update: { message: dto.message, status: 'pending' },
    });

    if (!existing || existing.status !== 'pending') {
      await this.notifications.create(post.authorId, {
        type: 'lfg_apply',
        title: '新的组队申请',
        message: `${applicant?.nickname ?? '有人'} 申请加入「${post.title}」`,
        link: `/lfg?manage=${postId}`,
        refId: app.id,
      });
    }

    return app;
  }

  async resolveApplication(
    postId: string,
    applicationId: string,
    authorId: string,
    accept: boolean,
    blockApplicant = false,
  ) {
    const post = await this.prisma.lfgPost.findUnique({ where: { id: postId } });
    if (!post || post.authorId !== authorId) {
      throw new ForbiddenException();
    }
    const app = await this.prisma.lfgApplication.findUnique({
      where: { id: applicationId },
      include: { user: { select: { nickname: true } } },
    });
    if (!app || app.postId !== postId) throw new NotFoundException();

    if (!accept) {
      await this.prisma.lfgApplication.update({
        where: { id: applicationId },
        data: { status: 'rejected' },
      });
      if (blockApplicant) {
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
        await this.prisma.lfgApplicantCooldown.upsert({
          where: {
            authorId_applicantId: {
              authorId,
              applicantId: app.userId,
            },
          },
          create: { authorId, applicantId: app.userId, expiresAt },
          update: { expiresAt },
        });
        await this.notifications.create(app.userId, {
          type: 'lfg_reject',
          title: '申请未通过',
          message: `「${post.title}」的组队申请已被拒绝，30 分钟内无法再次向该用户申请`,
          link: '/lfg',
          refId: applicationId,
        });
      } else {
        await this.notifications.create(app.userId, {
          type: 'lfg_reject',
          title: '申请未通过',
          message: `「${post.title}」的组队申请已被拒绝`,
          link: '/lfg',
          refId: applicationId,
        });
      }
      return this.prisma.lfgApplication.findUnique({
        where: { id: applicationId },
      });
    }

    await this.prisma.lfgApplication.update({
      where: { id: applicationId },
      data: { status: 'accepted' },
    });
    await this.prisma.lfgPost.update({
      where: { id: postId },
      data: { status: 'matched' },
    });
    const party = await this.parties.createFromUsers(
      [authorId, app.userId],
      post.gameId,
      authorId,
    );
    await this.notifications.create(app.userId, {
      type: 'lfg_accept',
      title: '申请已通过',
      message: `「${post.title}」的组队申请已通过，快去聊天室吧`,
      link: party.chatRoom ? `/chat/${party.chatRoom.id}` : '/parties',
      refId: applicationId,
    });
    return { application: app, party };
  }

  async getApplications(postId: string, authorId: string) {
    const post = await this.prisma.lfgPost.findUnique({ where: { id: postId } });
    if (!post || post.authorId !== authorId) {
      throw new ForbiddenException();
    }
    return this.prisma.lfgApplication.findMany({
      where: { postId },
      include: {
        user: { select: { id: true, nickname: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async delete(postId: string, authorId: string) {
    const post = await this.prisma.lfgPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('帖子不存在');
    if (post.authorId !== authorId) {
      throw new ForbiddenException('只能删除自己的帖子');
    }
    await this.prisma.lfgPost.delete({ where: { id: postId } });
    return { ok: true };
  }
}
