import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VisibilityService } from '../visibility/visibility.service';

@Injectable()
export class SearchService {
  constructor(
    private prisma: PrismaService,
    private visibility: VisibilityService,
  ) {}

  private async getHiddenUserIds(viewerId: string) {
    const rows = await this.prisma.block.findMany({
      where: {
        OR: [{ blockerId: viewerId }, { blockedId: viewerId }],
      },
      select: { blockerId: true, blockedId: true },
    });
    return new Set(
      rows.map((row) =>
        row.blockerId === viewerId ? row.blockedId : row.blockerId,
      ),
    );
  }

  async searchUsers(viewerId: string, query: string, limit = 20) {
    const q = query.trim();
    if (!q) return [];
    const hiddenUserIds = await this.getHiddenUserIds(viewerId);
    const candidates = await this.prisma.user.findMany({
      where: {
        isBanned: false,
        nickname: { contains: q },
        id: {
          notIn: [viewerId, ...hiddenUserIds],
        },
      },
      select: { id: true, nickname: true, avatarUrl: true },
      take: limit * 3,
      orderBy: { nickname: 'asc' },
    });

    const visibleUsers = [];
    for (const user of candidates) {
      if (!(await this.visibility.isVisibleToOthers(user.id))) continue;
      visibleUsers.push(user);
      if (visibleUsers.length >= limit) break;
    }

    return visibleUsers;
  }

  async searchRoomByCode(code: string) {
    const roomCode = code.trim().toUpperCase();
    if (!roomCode) return null;
    const room = await this.prisma.chatRoom.findFirst({
      where: { roomCode, status: 'active' },
      include: {
        party: {
          select: {
            id: true,
            gameId: true,
            members: {
              include: {
                user: { select: { id: true, nickname: true } },
              },
            },
          },
        },
      },
    });
    if (!room) return null;
    const leader = room.party.members.find((m) => m.role === 'leader');
    return {
      roomId: room.id,
      roomCode: room.roomCode,
      name: room.name,
      partyId: room.partyId,
      leaderNickname: leader?.user.nickname,
      memberCount: room.party.members.length,
    };
  }
}
