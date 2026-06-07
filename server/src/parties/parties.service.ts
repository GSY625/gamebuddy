import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { filterSensitive } from '../common/sensitive-filter';
import { generateRoomCode } from '../common/room-code';
import { ChatGateway } from '../chat/chat.gateway';
import { ChatService } from '../chat/chat.service';
import { RedisService } from '../redis/redis.service';
import { VisibilityService } from '../visibility/visibility.service';

export type MemberPresenceStatus = 'online' | 'invisible' | 'offline';

@Injectable()
export class PartiesService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private visibility: VisibilityService,
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway,
    @Inject(forwardRef(() => ChatService))
    private chatService: ChatService,
  ) {}

  async resolveMemberPresence(
    userId: string,
    viewerId?: string,
  ): Promise<MemberPresenceStatus> {
    const connected = (await this.redis.get(`presence:${userId}`)) === '1';
    if (!connected) return 'offline';
    const visibility = await this.visibility.get(userId);
    if (visibility === 'invisible') {
      return viewerId === userId ? 'invisible' : 'offline';
    }
    return 'online';
  }

  private async allocateRoomCode(): Promise<string> {
    for (let i = 0; i < 30; i++) {
      const roomCode = generateRoomCode(8);
      const taken = await this.prisma.chatRoom.findFirst({
        where: { roomCode },
      });
      if (!taken) return roomCode;
    }
    throw new BadRequestException('无法生成聊天室 ID，请稍后重试');
  }

  getPartyFullMessage() {
    return '该聊天室已满';
  }

  assertPartyHasCapacity(party: {
    members: Array<{ userId: string }>;
    maxMembers?: number | null;
  }) {
    if (
      typeof party.maxMembers === 'number' &&
      party.members.length >= party.maxMembers
    ) {
      throw new BadRequestException(this.getPartyFullMessage());
    }
  }

  async ensureRoomMetadata(roomId: string) {
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
    });
    if (!room || room.status !== 'active' || room.roomCode) return room;
    const roomCode = await this.allocateRoomCode();
    return this.prisma.chatRoom.update({
      where: { id: roomId },
      data: {
        roomCode,
        name: room.name ?? `聊天室 ${roomCode}`,
      },
    });
  }

  async createSystemMessage(
    roomId: string,
    content: string,
    type: 'system' | 'system_alert' = 'system',
  ) {
    return this.prisma.chatMessage.create({
      data: { roomId, type, content },
      include: {
        user: { select: { id: true, nickname: true, avatarUrl: true } },
      },
    });
  }

  async createFromUsers(
    userIds: string[],
    gameId?: string,
    leaderId?: string,
  ) {
    const unique = [...new Set(userIds)];
    const leader =
      leaderId && unique.includes(leaderId) ? leaderId : unique[0];
    const roomCode = await this.allocateRoomCode();
    const party = await this.prisma.party.create({
      data: {
        gameId,
        status: 'active',
        maxMembers: null,
        members: {
          create: unique.map((userId) => ({
            userId,
            role: userId === leader ? 'leader' : 'member',
          })),
        },
        chatRoom: {
          create: {
            roomCode,
            name: `聊天室 ${roomCode}`,
            status: 'active',
          },
        },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, nickname: true, avatarUrl: true } },
          },
        },
        chatRoom: true,
      },
    });

    if (party.chatRoom) {
      const welcome =
        unique.length === 1
          ? `聊天室已创建！聊天室 ID：${roomCode}。你可以邀请好友加入。`
          : `组队成功！聊天室 ID：${roomCode}。房主可修改聊天室名称。`;
      const msg = await this.createSystemMessage(party.chatRoom.id, welcome);
      this.chatGateway.emitRoomMessage(party.chatRoom.id, msg);
    }

    return party;
  }

  async createSolo(userId: string, gameId?: string, roomName?: string) {
    const roomCode = await this.allocateRoomCode();
    const trimmedName = roomName?.trim()
      ? filterSensitive(roomName.trim())
      : `聊天室 ${roomCode}`;
    const party = await this.prisma.party.create({
      data: {
        gameId,
        status: 'active',
        maxMembers: null,
        members: {
          create: [{ userId, role: 'leader' }],
        },
        chatRoom: {
          create: {
            roomCode,
            name: trimmedName,
            status: 'active',
          },
        },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, nickname: true, avatarUrl: true } },
          },
        },
        chatRoom: true,
      },
    });

    if (party.chatRoom) {
      const msg = await this.createSystemMessage(
        party.chatRoom.id,
        `聊天室已创建！聊天室 ID：${roomCode}。你可以邀请好友加入。`,
      );
      this.chatGateway.emitRoomMessage(party.chatRoom.id, msg);
    }

    return party;
  }

  async addMember(partyId: string, userId: string) {
    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
      include: {
        members: {
          include: {
            user: { select: { id: true, nickname: true, avatarUrl: true } },
          },
        },
        chatRoom: true,
      },
    });
    if (!party || party.status !== 'active') {
      throw new NotFoundException('队伍不存在或已解散');
    }
    if (!party.chatRoom || party.chatRoom.status !== 'active') {
      throw new NotFoundException('聊天室不存在或已注销');
    }
    if (party.members.some((m) => m.userId === userId)) {
      throw new BadRequestException('你已是聊天室成员');
    }
    this.assertPartyHasCapacity(party);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { nickname: true },
    });
    if (!user) throw new NotFoundException('用户不存在');

    await this.prisma.partyMember.create({
      data: { partyId, userId, role: 'member' },
    });

    const msg = await this.createSystemMessage(
      party.chatRoom.id,
      `${user.nickname} 加入了聊天室`,
    );
    this.chatGateway.emitRoomMessage(party.chatRoom.id, msg);

    return this.prisma.party.findUnique({
      where: { id: partyId },
      include: {
        members: {
          include: {
            user: { select: { id: true, nickname: true, avatarUrl: true } },
          },
        },
        chatRoom: true,
      },
    });
  }

  async removeUserFromSharedParties(
    retainedUserId: string,
    removedUserId: string,
    reason = '由于拉黑关系，你已被移出聊天室',
  ) {
    const sharedParties = await this.prisma.party.findMany({
      where: {
        status: 'active',
        AND: [
          { members: { some: { userId: retainedUserId } } },
          { members: { some: { userId: removedUserId } } },
        ],
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, nickname: true, avatarUrl: true } },
          },
        },
        chatRoom: true,
      },
    });

    for (const party of sharedParties) {
      await this.removeUserFromPartyForSafety(party.id, removedUserId, reason);
    }
  }

  private async removeUserFromPartyForSafety(
    partyId: string,
    userId: string,
    reason: string,
  ) {
    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
      include: {
        members: {
          include: {
            user: { select: { id: true, nickname: true, avatarUrl: true } },
          },
        },
        chatRoom: true,
      },
    });

    if (!party || party.status !== 'active' || !party.chatRoom) return;

    const removedMember = party.members.find((member) => member.userId === userId);
    if (!removedMember) return;

    const remainingMembers = party.members.filter((member) => member.userId !== userId);
    const nextLeader = removedMember.role === 'leader' ? remainingMembers[0] : null;

    await this.prisma.$transaction(async (tx) => {
      await tx.partyMember.deleteMany({
        where: { partyId, userId },
      });
      await tx.roomReadState.deleteMany({
        where: { roomId: party.chatRoom!.id, userId },
      });
      if (nextLeader) {
        await tx.partyMember.update({
          where: {
            partyId_userId: {
              partyId,
              userId: nextLeader.userId,
            },
          },
          data: { role: 'leader' },
        });
      }
    });

    const systemMessage = await this.createSystemMessage(
      party.chatRoom.id,
      `${removedMember.user.nickname} 因拉黑关系已离开聊天室`,
      'system_alert',
    );
    this.chatGateway.emitRoomMessage(party.chatRoom.id, systemMessage);
    this.chatGateway.removeUserFromRoom(userId, party.chatRoom.id, {
      partyId,
      message: reason,
    });
  }

  async listForUser(userId: string) {
    const rawParties = await this.prisma.party.findMany({
      where: { members: { some: { userId } }, status: 'active' },
      include: {
        members: {
          include: {
            user: { select: { id: true, nickname: true, avatarUrl: true } },
          },
        },
        chatRoom: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    for (const p of rawParties) {
      if (p.chatRoom) {
        await this.ensureRoomMetadata(p.chatRoom.id);
      }
    }

    const parties = await this.prisma.party.findMany({
      where: { members: { some: { userId } }, status: 'active' },
      include: {
        members: {
          include: {
            user: { select: { id: true, nickname: true, avatarUrl: true } },
          },
        },
        chatRoom: {
          select: {
            id: true,
            roomCode: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      parties.map(async (p) => {
        if (!p.chatRoom) return p;
        const unreadCount = await this.chatService.getUnreadCount(
          p.chatRoom.id,
          userId,
        );
        return {
          ...p,
          chatRoom: { ...p.chatRoom, unreadCount },
        };
      }),
    );
  }

  async getOne(partyId: string, userId: string) {
    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
      include: {
        members: {
          include: {
            user: { select: { id: true, nickname: true, avatarUrl: true } },
          },
        },
        chatRoom: true,
      },
    });
    if (!party || party.status !== 'active') throw new NotFoundException();
    if (!party.members.some((m: { userId: string }) => m.userId === userId)) {
      throw new ForbiddenException();
    }
    if (party.chatRoom) {
      await this.ensureRoomMetadata(party.chatRoom.id);
      const refreshed = await this.prisma.party.findUnique({
        where: { id: partyId },
        include: {
          members: {
            include: {
              user: { select: { id: true, nickname: true, avatarUrl: true } },
            },
          },
          chatRoom: true,
        },
      });
      return refreshed ?? party;
    }
    return party;
  }

  async getByRoomId(roomId: string, userId: string) {
    await this.ensureRoomMetadata(roomId);
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
    if (!room || room.status !== 'active') {
      throw new NotFoundException('聊天室不存在或已注销');
    }
    if (
      !room.party.members.some(
        (m: { userId: string }) => m.userId === userId,
      )
    ) {
      throw new ForbiddenException();
    }
    const leader = room.party.members.find(
      (m: { role: string }) => m.role === 'leader',
    );
    const members = await Promise.all(
      room.party.members.map(
        async (m: {
          userId: string;
          role: string;
          user: { id: string; nickname: string; avatarUrl: string | null };
        }) => {
          const presenceStatus = await this.resolveMemberPresence(
            m.userId,
            userId,
          );
          return {
            userId: m.userId,
            role: m.role,
            isLeader: m.role === 'leader',
            user: m.user,
            presenceStatus,
          };
        },
      ),
    );
    return {
      room: {
        id: room.id,
        roomCode: room.roomCode,
        name: room.name,
        status: room.status,
      },
      party: {
        id: room.party.id,
        gameId: room.party.gameId,
        status: room.party.status,
        maxMembers: room.party.maxMembers,
      },
      members,
      leaderId: leader?.userId ?? null,
      isLeader: leader?.userId === userId,
    };
  }

  async updateRoomName(partyId: string, userId: string, name: string) {
    const party = await this.getOne(partyId, userId);
    const leader = party!.members.find(
      (m: { role: string }) => m.role === 'leader',
    );
    if (leader?.userId !== userId) {
      throw new ForbiddenException('仅房主可修改聊天室名称');
    }
    const trimmed = filterSensitive(name.trim());
    if (!trimmed) throw new BadRequestException('名称不能为空');
    if (!party!.chatRoom) throw new NotFoundException();
    const room = await this.prisma.chatRoom.update({
      where: { id: party!.chatRoom.id },
      data: { name: trimmed },
    });
    const msg = await this.createSystemMessage(
      room.id,
      `房主已将聊天室更名为「${trimmed}」`,
    );
    this.chatGateway.emitRoomMessage(room.id, msg);
    return room;
  }

  async updateVoiceHint(partyId: string, userId: string, voiceHint: string) {
    const party = await this.getOne(partyId, userId);
    const leader = party!.members.find(
      (m: { role: string }) => m.role === 'leader',
    );
    if (leader?.userId !== userId) {
      throw new ForbiddenException('仅房主可修改语音说明');
    }
    return this.prisma.party.update({
      where: { id: party!.id },
      data: { voiceHint: filterSensitive(voiceHint) },
    });
  }

  async updateMemberLimit(
    partyId: string,
    userId: string,
    maxMembers: number | null,
  ) {
    const party = await this.getOne(partyId, userId);
    const leader = party!.members.find(
      (m: { role: string }) => m.role === 'leader',
    );
    if (leader?.userId !== userId) {
      throw new ForbiddenException('仅房主可修改聊天室人数上限');
    }

    const normalizedMaxMembers =
      typeof maxMembers === 'number' ? Math.trunc(maxMembers) : null;
    if (
      normalizedMaxMembers !== null &&
      normalizedMaxMembers < party!.members.length
    ) {
      throw new BadRequestException(
        `人数上限不能小于当前成员数（${party!.members.length} 人）`,
      );
    }

    return this.prisma.party.update({
      where: { id: party!.id },
      data: { maxMembers: normalizedMaxMembers },
    });
  }

  async leaveParty(partyId: string, userId: string) {
    const party = await this.getOne(partyId, userId);
    const member = party!.members.find(
      (m: { userId: string }) => m.userId === userId,
    );
    if (member?.role === 'leader') {
      throw new BadRequestException('房主请使用「注销聊天室」');
    }
    if (!party!.chatRoom) throw new NotFoundException();

    const nickname = member?.user?.nickname ?? '某用户';

    await this.prisma.$transaction([
      this.prisma.partyMember.deleteMany({
        where: { partyId, userId },
      }),
      this.prisma.roomReadState.deleteMany({
        where: { roomId: party!.chatRoom.id, userId },
      }),
    ]);

    const roomMsg = await this.createSystemMessage(
      party!.chatRoom.id,
      `${nickname} 已退出聊天室`,
    );
    this.chatGateway.emitRoomMessage(party!.chatRoom.id, roomMsg);

    const leader = party!.members.find(
      (m: { role: string }) => m.role === 'leader',
    );
    if (leader) {
      this.chatGateway.emitToUser(leader.userId, 'user:notify', {
        type: 'member_left',
        title: '队员退出',
        message: `${nickname} 已退出聊天室`,
        partyId,
        roomId: party!.chatRoom.id,
      });
      const alertMsg = await this.createSystemMessage(
        party!.chatRoom.id,
        `【醒目】${nickname} 已退出聊天室`,
        'system_alert',
      );
      this.chatGateway.emitRoomMessage(party!.chatRoom.id, alertMsg);
    }

    return { ok: true };
  }

  async dissolveParty(partyId: string, userId: string) {
    const party = await this.getOne(partyId, userId);
    const leader = party!.members.find(
      (m: { role: string }) => m.role === 'leader',
    );
    if (leader?.userId !== userId) {
      throw new ForbiddenException('仅房主可注销聊天室');
    }
    if (!party!.chatRoom) throw new NotFoundException();

    const roomId = party!.chatRoom.id;
    const memberIds = party!.members.map((m: { userId: string }) => m.userId);

    await this.prisma.$transaction([
      this.prisma.party.update({
        where: { id: partyId },
        data: { status: 'dissolved' },
      }),
      this.prisma.chatRoom.update({
        where: { id: roomId },
        data: {
          status: 'dissolved',
          roomCode: null,
          dissolvedAt: new Date(),
        },
      }),
    ]);

    const msg = await this.createSystemMessage(
      roomId,
      '房主已注销聊天室',
      'system_alert',
    );
    this.chatGateway.emitRoomMessage(roomId, msg);
    this.chatGateway.emitRoomDissolved(roomId, memberIds, {
      partyId,
      message: '房主已注销聊天室',
    });

    return { ok: true };
  }

  async assertRoomMember(roomId: string, userId: string) {
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: { party: { include: { members: true } } },
    });
    if (!room || room.status !== 'active') {
      throw new NotFoundException('房间不存在或已注销');
    }
    if (room.party.status !== 'active') {
      throw new NotFoundException('队伍已解散');
    }
    if (
      !room.party.members.some((m: { userId: string }) => m.userId === userId)
    ) {
      throw new ForbiddenException();
    }
    return room;
  }
}
