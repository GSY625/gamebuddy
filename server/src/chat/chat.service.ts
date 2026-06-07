import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PartiesService } from '../parties/parties.service';
import { filterSensitive } from '../common/sensitive-filter';
import { RestrictionsService } from '../restrictions/restrictions.service';

export type RoomMember = {
  userId: string;
  user: { id: string; nickname: string; avatarUrl: string | null };
};

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => PartiesService))
    private parties: PartiesService,
    private restrictions: RestrictionsService,
  ) {}

  async getRoomMembers(roomId: string): Promise<RoomMember[]> {
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        party: {
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, nickname: true, avatarUrl: true },
                },
              },
            },
          },
        },
      },
    });
    if (!room?.party) return [];
    return room.party.members.map((m) => ({
      userId: m.userId,
      user: m.user,
    }));
  }

  parseMentions(
    content: string,
    members: RoomMember[],
    senderId: string,
  ): RoomMember[] {
    const regex = /@([^\s@]+)/g;
    const mentioned = new Map<string, RoomMember>();
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content))) {
      const nick = match[1];
      const member = members.find((m) => m.user.nickname === nick);
      if (member && member.userId !== senderId) {
        mentioned.set(member.userId, member);
      }
    }
    return [...mentioned.values()];
  }

  async markRoomRead(roomId: string, userId: string) {
    await this.parties.assertRoomMember(roomId, userId);
    await this.prisma.roomReadState.upsert({
      where: { userId_roomId: { userId, roomId } },
      create: { userId, roomId, lastReadAt: new Date() },
      update: { lastReadAt: new Date() },
    });
    return { ok: true };
  }

  async getUnreadCount(roomId: string, userId: string) {
    const state = await this.prisma.roomReadState.findUnique({
      where: { userId_roomId: { userId, roomId } },
    });
    const since = state?.lastReadAt ?? new Date(0);
    return this.prisma.chatMessage.count({
      where: {
        roomId,
        createdAt: { gt: since },
        OR: [{ userId: { not: userId } }, { userId: null }],
      },
    });
  }

  async getMessages(roomId: string, userId: string, cursor?: string) {
    await this.parties.assertRoomMember(roomId, userId);
    const take = 50;
    const messages = await this.prisma.chatMessage.findMany({
      where: { roomId },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, nickname: true, avatarUrl: true } },
      },
    });
    await this.markRoomRead(roomId, userId);
    return messages;
  }

  async findPendingMention(roomId: string, userId: string) {
    await this.parties.assertRoomMember(roomId, userId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { nickname: true },
    });
    if (!user?.nickname) return null;

    const state = await this.prisma.roomReadState.findUnique({
      where: { userId_roomId: { userId, roomId } },
    });
    const since = state?.lastReadAt ?? new Date(0);
    const members = await this.getRoomMembers(roomId);
    const messages = await this.prisma.chatMessage.findMany({
      where: { roomId, createdAt: { gt: since } },
      orderBy: { createdAt: 'asc' },
    });

    for (const msg of messages) {
      if (!msg.userId || msg.userId === userId) continue;
      const mentioned = this.parseMentions(msg.content, members, msg.userId);
      if (mentioned.some((m) => m.userId === userId)) {
        return msg.id;
      }
    }
    return null;
  }

  async sendMessage(roomId: string, userId: string, content: string) {
    await this.restrictions.assertAllowed(userId, 'chat');
    await this.parties.assertRoomMember(roomId, userId);
    const filtered = filterSensitive(content.trim());
    const members = await this.getRoomMembers(roomId);
    const mentioned = this.parseMentions(filtered, members, userId);
    const sender = members.find((m) => m.userId === userId);

    const message = await this.prisma.chatMessage.create({
      data: {
        roomId,
        userId,
        type: 'text',
        content: filtered,
      },
      include: {
        user: { select: { id: true, nickname: true, avatarUrl: true } },
      },
    });

    await this.markRoomRead(roomId, userId);

    return {
      message,
      mentioned,
      senderNickname: sender?.user.nickname ?? '有人',
    };
  }
}
