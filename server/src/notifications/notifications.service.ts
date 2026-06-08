import { Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from '../chat/chat.gateway';

export type CreateNotificationInput = {
  type: string;
  title: string;
  message: string;
  link?: string;
  refId?: string;
};

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway,
  ) {}

  async create(userId: string, data: CreateNotificationInput) {
    const notification = await this.prisma.notification.create({
      data: { userId, ...data },
    });
    const unreadCount = await this.unreadCount(userId);
    this.chatGateway.emitToUser(userId, 'notification:update', { unreadCount });
    return notification;
  }

  async list(userId: string, limit = 50) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async unreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, read: false },
    });
  }

  async markRead(userId: string, id: string) {
    const row = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!row) throw new NotFoundException();
    await this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
    const unreadCount = await this.unreadCount(userId);
    this.chatGateway.emitToUser(userId, 'notification:update', { unreadCount });
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    this.chatGateway.emitToUser(userId, 'notification:update', { unreadCount: 0 });
    return { ok: true };
  }

  async remove(userId: string, id: string) {
    const row = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!row) throw new NotFoundException();
    await this.prisma.notification.delete({ where: { id } });
    const unreadCount = await this.unreadCount(userId);
    this.chatGateway.emitToUser(userId, 'notification:update', { unreadCount });
    return { ok: true };
  }

  async removeAll(userId: string) {
    await this.prisma.notification.deleteMany({
      where: { userId },
    });
    this.chatGateway.emitToUser(userId, 'notification:update', { unreadCount: 0 });
    return { ok: true };
  }
}
