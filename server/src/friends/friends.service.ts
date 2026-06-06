import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class FriendsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /** 好友关系在库中只存一条（userId < friendId 字典序），避免列表重复 */
  private pairIds(a: string, b: string): [string, string] {
    return a < b ? [a, b] : [b, a];
  }

  private async areFriends(a: string, b: string) {
    const [userId, friendId] = this.pairIds(a, b);
    const row = await this.prisma.friendship.findUnique({
      where: { userId_friendId: { userId, friendId } },
    });
    return Boolean(row);
  }

  async listFriends(userId: string) {
    const rows = await this.prisma.friendship.findMany({
      where: {
        OR: [{ userId }, { friendId: userId }],
      },
      include: {
        user: { select: { id: true, nickname: true, avatarUrl: true } },
        friend: { select: { id: true, nickname: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const seen = new Set<string>();
    const result: Array<{
      id: string;
      friend: { id: string; nickname: string; avatarUrl: string | null };
      since: Date;
    }> = [];
    for (const r of rows) {
      const other = r.userId === userId ? r.friend : r.user;
      if (seen.has(other.id)) continue;
      seen.add(other.id);
      result.push({ id: r.id, friend: other, since: r.createdAt });
    }
    return result;
  }

  async listReceivedRequests(userId: string) {
    return this.prisma.friendRequest.findMany({
      where: { receiverId: userId, status: 'pending' },
      include: {
        sender: { select: { id: true, nickname: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async sendRequest(senderId: string, receiverId: string) {
    if (senderId === receiverId) {
      throw new BadRequestException('不能添加自己为好友');
    }
    const receiver = await this.prisma.user.findUnique({
      where: { id: receiverId },
    });
    if (!receiver) throw new NotFoundException('用户不存在');

    const block = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: senderId, blockedId: receiverId },
          { blockerId: receiverId, blockedId: senderId },
        ],
      },
    });
    if (block) throw new BadRequestException('无法向该用户发送好友申请');

    if (await this.areFriends(senderId, receiverId)) {
      throw new ConflictException('你们已经是好友');
    }

    const pending = await this.prisma.friendRequest.findFirst({
      where: {
        status: 'pending',
        OR: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      },
    });
    if (pending) {
      if (pending.senderId === senderId) {
        throw new ConflictException('好友申请已发送，请等待对方处理');
      }
      throw new ConflictException('对方已向你发送好友申请，请到「好友」页处理');
    }

    const req = await this.prisma.friendRequest.create({
      data: { senderId, receiverId },
      include: {
        sender: { select: { id: true, nickname: true } },
        receiver: { select: { id: true, nickname: true } },
      },
    });

    await this.notifications.create(receiverId, {
      type: 'friend_request',
      title: '新的好友申请',
      message: `${req.sender.nickname} 请求添加你为好友`,
      link: '/friends',
      refId: req.id,
    });

    return req;
  }

  async resolveRequest(
    requestId: string,
    userId: string,
    accept: boolean,
  ) {
    const req = await this.prisma.friendRequest.findUnique({
      where: { id: requestId },
      include: {
        sender: { select: { nickname: true } },
        receiver: { select: { nickname: true } },
      },
    });
    if (!req || req.receiverId !== userId) {
      throw new NotFoundException();
    }
    if (req.status !== 'pending') {
      throw new BadRequestException('申请已处理');
    }

    await this.prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: accept ? 'accepted' : 'rejected' },
    });

    if (!accept) return { status: 'rejected' };

    const [uid, fid] = this.pairIds(req.senderId, req.receiverId);
    await this.prisma.friendship.upsert({
      where: { userId_friendId: { userId: uid, friendId: fid } },
      create: { userId: uid, friendId: fid },
      update: {},
    });

    // 清理旧版双向重复数据
    await this.prisma.friendship.deleteMany({
      where: {
        OR: [
          { userId: req.senderId, friendId: req.receiverId },
          { userId: req.receiverId, friendId: req.senderId },
        ],
        NOT: { userId: uid, friendId: fid },
      },
    });

    await this.notifications.create(req.senderId, {
      type: 'friend_accept',
      title: '好友申请已通过',
      message: `${req.receiver.nickname} 已接受你的好友申请`,
      link: '/friends',
      refId: requestId,
    });

    return { status: 'accepted' };
  }

  async removeFriend(userId: string, otherId: string) {
    if (userId === otherId) {
      throw new BadRequestException('无法删除自己');
    }
    if (!(await this.areFriends(userId, otherId))) {
      throw new NotFoundException('好友关系不存在');
    }

    await this.prisma.friendship.deleteMany({
      where: {
        OR: [
          { userId, friendId: otherId },
          { userId: otherId, friendId: userId },
        ],
      },
    });

    return { ok: true };
  }

  async friendshipStatus(userId: string, otherId: string) {
    if (userId === otherId) return { status: 'self' as const };
    if (await this.areFriends(userId, otherId)) {
      return { status: 'friends' as const };
    }
    const pending = await this.prisma.friendRequest.findFirst({
      where: {
        status: 'pending',
        OR: [
          { senderId: userId, receiverId: otherId },
          { senderId: otherId, receiverId: userId },
        ],
      },
    });
    if (!pending) return { status: 'none' as const };
    if (pending.senderId === userId) return { status: 'pending_sent' as const };
    return { status: 'pending_received' as const, requestId: pending.id };
  }
}
