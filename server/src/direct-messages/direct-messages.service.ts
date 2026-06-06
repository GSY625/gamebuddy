import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { filterSensitive } from '../common/sensitive-filter';

type ThreadWithUsers = {
  id: string;
  userAId: string;
  userBId: string;
  lastMessageAt: Date;
  createdAt: Date;
  userA: { id: string; nickname: string; avatarUrl: string | null };
  userB: { id: string; nickname: string; avatarUrl: string | null };
} | null;

@Injectable()
export class DirectMessagesService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  private pairIds(a: string, b: string): [string, string] {
    return a < b ? [a, b] : [b, a];
  }

  private async assertFriendship(userId: string, friendId: string) {
    if (userId === friendId) {
      throw new BadRequestException('不能给自己发私信');
    }

    const friend = await this.prisma.user.findUnique({
      where: { id: friendId },
      select: { id: true, nickname: true, avatarUrl: true },
    });
    if (!friend) {
      throw new NotFoundException('好友不存在');
    }

    const [uid, fid] = this.pairIds(userId, friendId);
    const friendship = await this.prisma.friendship.findUnique({
      where: { userId_friendId: { userId: uid, friendId: fid } },
    });
    if (!friendship) {
      throw new ForbiddenException('仅已添加好友可进行私信');
    }

    const block = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: friendId },
          { blockerId: friendId, blockedId: userId },
        ],
      },
    });
    if (block) {
      throw new ForbiddenException('当前无法与该好友私信');
    }

    return friend;
  }

  private async findThreadWithUsers(threadId: string): Promise<ThreadWithUsers> {
    return this.prisma.directMessageThread.findUnique({
      where: { id: threadId },
      include: {
        userA: { select: { id: true, nickname: true, avatarUrl: true } },
        userB: { select: { id: true, nickname: true, avatarUrl: true } },
      },
    });
  }

  private async ensureThread(userId: string, friendId: string) {
    await this.assertFriendship(userId, friendId);
    const [userAId, userBId] = this.pairIds(userId, friendId);
    return this.prisma.directMessageThread.upsert({
      where: { userAId_userBId: { userAId, userBId } },
      create: { userAId, userBId },
      update: {},
    });
  }

  async assertThreadParticipant(threadId: string, userId: string) {
    const thread = await this.findThreadWithUsers(threadId);
    if (!thread || (thread.userAId !== userId && thread.userBId !== userId)) {
      throw new NotFoundException('私信会话不存在');
    }
    return thread;
  }

  private async countUnread(threadId: string, userId: string, lastReadAt?: Date) {
    const since = lastReadAt ?? new Date(0);
    return this.prisma.directMessage.count({
      where: {
        threadId,
        createdAt: { gt: since },
        senderId: { not: userId },
      },
    });
  }

  private async buildConversationSummary(
    thread: NonNullable<ThreadWithUsers>,
    userId: string,
  ) {
    const friend = thread.userAId === userId ? thread.userB : thread.userA;
    const [lastMessage, readState] = await Promise.all([
      this.prisma.directMessage.findFirst({
        where: { threadId: thread.id },
        orderBy: { createdAt: 'desc' },
        include: {
          sender: { select: { id: true, nickname: true, avatarUrl: true } },
        },
      }),
      this.prisma.directMessageReadState.findUnique({
        where: { threadId_userId: { threadId: thread.id, userId } },
      }),
    ]);

    const unreadCount = await this.countUnread(
      thread.id,
      userId,
      readState?.lastReadAt,
    );

    return {
      threadId: thread.id,
      friend,
      unreadCount,
      lastMessageAt: thread.lastMessageAt,
      createdAt: thread.createdAt,
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            content: lastMessage.content,
            createdAt: lastMessage.createdAt,
            senderId: lastMessage.senderId,
            sender: lastMessage.sender,
          }
        : null,
    };
  }

  async listConversations(userId: string) {
    const [threads, friendships] = await Promise.all([
      this.prisma.directMessageThread.findMany({
        where: {
          OR: [{ userAId: userId }, { userBId: userId }],
        },
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          userA: { select: { id: true, nickname: true, avatarUrl: true } },
          userB: { select: { id: true, nickname: true, avatarUrl: true } },
        },
      }),
      this.prisma.friendship.findMany({
        where: {
          OR: [{ userId }, { friendId: userId }],
        },
        select: { userId: true, friendId: true },
      }),
    ]);

    const activeFriendIds = new Set(
      friendships.map((row) => (row.userId === userId ? row.friendId : row.userId)),
    );

    const activeThreads = threads.filter((thread) => {
      const friendId = thread.userAId === userId ? thread.userBId : thread.userAId;
      return activeFriendIds.has(friendId);
    });

    return Promise.all(
      activeThreads.map((thread) => this.buildConversationSummary(thread, userId)),
    );
  }

  async getConversation(userId: string, friendId: string) {
    const thread = await this.ensureThread(userId, friendId);
    const fullThread = await this.findThreadWithUsers(thread.id);
    if (!fullThread) {
      throw new NotFoundException('私信会话不存在');
    }
    return this.buildConversationSummary(fullThread, userId);
  }

  async markRead(threadId: string, userId: string) {
    await this.assertThreadParticipant(threadId, userId);
    await this.prisma.directMessageReadState.upsert({
      where: { threadId_userId: { threadId, userId } },
      create: { threadId, userId, lastReadAt: new Date() },
      update: { lastReadAt: new Date() },
    });
    return { ok: true };
  }

  async markConversationRead(userId: string, friendId: string) {
    const thread = await this.ensureThread(userId, friendId);
    return this.markRead(thread.id, userId);
  }

  async getMessages(userId: string, friendId: string, cursor?: string) {
    const thread = await this.ensureThread(userId, friendId);
    const messages = await this.prisma.directMessage.findMany({
      where: { threadId: thread.id },
      take: 50,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, nickname: true, avatarUrl: true } },
      },
    });
    await this.markRead(thread.id, userId);
    return messages;
  }

  async sendMessage(senderId: string, receiverId: string, content: string) {
    const friend = await this.assertFriendship(senderId, receiverId);
    const filtered = filterSensitive(content.trim());
    if (!filtered) {
      throw new BadRequestException('消息内容不能为空');
    }

    const [userAId, userBId] = this.pairIds(senderId, receiverId);
    const now = new Date();

    const thread = await this.prisma.directMessageThread.upsert({
      where: { userAId_userBId: { userAId, userBId } },
      create: { userAId, userBId, lastMessageAt: now },
      update: { lastMessageAt: now },
    });

    const message = await this.prisma.directMessage.create({
      data: {
        threadId: thread.id,
        senderId,
        content: filtered,
      },
      include: {
        sender: { select: { id: true, nickname: true, avatarUrl: true } },
      },
    });

    await this.markRead(thread.id, senderId);

    await this.notifications.create(receiverId, {
      type: 'direct_message',
      title: '新的好友私信',
      message: `${message.sender.nickname} 给你发来一条私信`,
      link: `/messages/${senderId}`,
      refId: message.id,
    });

    return {
      threadId: thread.id,
      message,
      receiver: friend,
      senderNickname: message.sender.nickname,
    };
  }
}
