import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PartiesService } from '../parties/parties.service';
import { CreateInviteDto } from './invites.dto';
import { VisibilityService } from '../visibility/visibility.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RestrictionsService } from '../restrictions/restrictions.service';

type InviteWithRelations = Awaited<ReturnType<InvitesService['getInviteById']>>;

@Injectable()
export class InvitesService {
  constructor(
    private prisma: PrismaService,
    private parties: PartiesService,
    private visibility: VisibilityService,
    private notifications: NotificationsService,
    private restrictions: RestrictionsService,
  ) {}

  private async areFriends(a: string, b: string) {
    const [userId, friendId] = a < b ? [a, b] : [b, a];
    const row = await this.prisma.friendship.findUnique({
      where: { userId_friendId: { userId, friendId } },
    });
    return Boolean(row);
  }

  private async getInviteById(inviteId: string) {
    return this.prisma.invite.findUnique({
      where: { id: inviteId },
      include: {
        sender: { select: { id: true, nickname: true, avatarUrl: true } },
        receiver: { select: { id: true, nickname: true, avatarUrl: true } },
        party: {
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, nickname: true, avatarUrl: true },
                },
              },
            },
            chatRoom: {
              select: { id: true, name: true, roomCode: true, status: true },
            },
          },
        },
      },
    });
  }

  private getLeader(invite: NonNullable<InviteWithRelations>) {
    return invite.party?.members.find((member) => member.role === 'leader') ?? null;
  }

  private getRoomLabel(invite: NonNullable<InviteWithRelations>) {
    return invite.party?.chatRoom?.name ?? '聊天室';
  }

  private async rejectInvite(
    invite: NonNullable<InviteWithRelations>,
    actorId: string,
    title: string,
    senderMessage: string,
    receiverMessage?: string,
  ) {
    await this.prisma.invite.update({
      where: { id: invite.id },
      data: { status: 'rejected' },
    });

    if (invite.senderId !== actorId) {
      await this.notifications.create(invite.senderId, {
        type: invite.partyId ? 'room_invite_reject' : 'invite_reject',
        title,
        message: senderMessage,
        link: '/invites',
        refId: invite.id,
      });
    }

    if (receiverMessage && invite.receiverId !== actorId) {
      await this.notifications.create(invite.receiverId, {
        type: 'room_invite_leader_reject',
        title: '入队申请未通过',
        message: receiverMessage,
        link: '/invites',
        refId: invite.id,
      });
    }

    return { status: 'rejected' as const };
  }

  private async assertInviteSenderEligible(senderId: string, receiverId: string) {
    await this.visibility.assertOnline(senderId);
    await this.restrictions.assertAllowed(senderId, 'invite');

    if (senderId === receiverId) {
      throw new BadRequestException('不能邀请自己');
    }

    const iBlocked = await this.prisma.block.findFirst({
      where: { blockerId: senderId, blockedId: receiverId },
    });
    if (iBlocked) {
      throw new BadRequestException('你已拉黑该用户，无法发送邀请');
    }

    const theyBlocked = await this.prisma.block.findFirst({
      where: { blockerId: receiverId, blockedId: senderId },
    });
    if (theyBlocked) {
      throw new BadRequestException('你已被对方拉黑');
    }
  }

  async create(senderId: string, dto: CreateInviteDto) {
    if (dto.partyId) {
      return this.createRoomInvite(senderId, dto.partyId, dto);
    }
    return this.createTeamInvite(senderId, dto);
  }

  private async createRoomInvite(
    senderId: string,
    partyId: string,
    dto: CreateInviteDto,
  ) {
    await this.assertInviteSenderEligible(senderId, dto.receiverId);

    if (!(await this.areFriends(senderId, dto.receiverId))) {
      throw new BadRequestException('只能邀请好友加入聊天室');
    }

    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
      include: {
        members: true,
        chatRoom: {
          select: { id: true, name: true, roomCode: true, status: true },
        },
      },
    });
    if (!party || party.status !== 'active') {
      throw new NotFoundException('聊天室不存在或已解散');
    }
    if (!party.chatRoom || party.chatRoom.status !== 'active') {
      throw new NotFoundException('聊天室不存在或已注销');
    }
    if (!party.members.some((member) => member.userId === senderId)) {
      throw new ForbiddenException('你不是该聊天室成员');
    }
    if (party.members.some((member) => member.userId === dto.receiverId)) {
      throw new BadRequestException('对方已经在聊天室里了');
    }
    this.parties.assertPartyHasCapacity(party);

    const pendingRoomInvite = await this.prisma.invite.findFirst({
      where: {
        partyId,
        receiverId: dto.receiverId,
        status: { in: ['pending', 'pending_leader'] },
      },
    });
    if (pendingRoomInvite) {
      throw new BadRequestException('已经邀请过这位好友了，请等待对方或房主处理');
    }

    const invite = await this.prisma.invite.create({
      data: {
        senderId,
        receiverId: dto.receiverId,
        partyId,
        message: dto.message,
      },
      include: {
        sender: { select: { id: true, nickname: true, avatarUrl: true } },
        receiver: { select: { id: true, nickname: true, avatarUrl: true } },
        party: {
          include: {
            chatRoom: { select: { id: true, name: true, roomCode: true } },
          },
        },
      },
    });

    const roomLabel = invite.party?.chatRoom?.name ?? '聊天室';
    await this.notifications.create(dto.receiverId, {
      type: 'room_invite_received',
      title: '收到聊天室邀请',
      message: `${invite.sender.nickname} 邀请你加入「${roomLabel}」`,
      link: '/invites',
      refId: invite.id,
    });

    return invite;
  }

  private async createTeamInvite(senderId: string, dto: CreateInviteDto) {
    await this.assertInviteSenderEligible(senderId, dto.receiverId);

    const sharedParty = await this.prisma.party.findFirst({
      where: {
        status: 'active',
        AND: [
          { members: { some: { userId: senderId } } },
          { members: { some: { userId: dto.receiverId } } },
        ],
      },
    });
    if (sharedParty) {
      throw new BadRequestException('你们已经在同一个队伍中，无需重复发起邀约');
    }

    const pendingInvite = await this.prisma.invite.findFirst({
      where: {
        status: 'pending',
        partyId: null,
        OR: [
          { senderId, receiverId: dto.receiverId },
          { senderId: dto.receiverId, receiverId: senderId },
        ],
      },
    });
    if (pendingInvite) {
      if (pendingInvite.senderId === senderId) {
        throw new BadRequestException('你已经向对方发起过邀约了，请等待对方处理');
      }
      throw new BadRequestException('对方已经向你发起邀约，请先处理现有邀约');
    }

    const invite = await this.prisma.invite.create({
      data: {
        senderId,
        receiverId: dto.receiverId,
        gameId: dto.gameId,
        message: dto.message,
      },
      include: {
        sender: { select: { id: true, nickname: true, avatarUrl: true } },
      },
    });

    await this.notifications.create(dto.receiverId, {
      type: 'invite_received',
      title: '收到新邀约',
      message: `${invite.sender.nickname} 向你发起了组队邀约`,
      link: '/invites',
      refId: invite.id,
    });

    return invite;
  }

  async listReceived(userId: string) {
    const directInvites = await this.prisma.invite.findMany({
      where: {
        receiverId: userId,
        status: { in: ['pending', 'pending_leader'] },
      },
      include: {
        sender: { select: { id: true, nickname: true, avatarUrl: true } },
        receiver: { select: { id: true, nickname: true, avatarUrl: true } },
        party: {
          include: {
            chatRoom: { select: { id: true, name: true, roomCode: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const leaderParties = await this.prisma.partyMember.findMany({
      where: {
        userId,
        role: 'leader',
        party: { status: 'active' },
      },
      select: { partyId: true },
    });

    const leaderPendingInvites =
      leaderParties.length > 0
        ? await this.prisma.invite.findMany({
            where: {
              partyId: { in: leaderParties.map((row) => row.partyId) },
              status: 'pending_leader',
              receiverId: { not: userId },
            },
            include: {
              sender: { select: { id: true, nickname: true, avatarUrl: true } },
              receiver: { select: { id: true, nickname: true, avatarUrl: true } },
              party: {
                include: {
                  chatRoom: { select: { id: true, name: true, roomCode: true } },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          })
        : [];

    return [...directInvites, ...leaderPendingInvites]
      .map((invite) => ({
        ...invite,
        actionMode:
          invite.receiverId === userId ? ('receiver' as const) : ('leader' as const),
      }))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }

  async listSent(userId: string) {
    return this.prisma.invite.findMany({
      where: { senderId: userId },
      include: {
        receiver: { select: { id: true, nickname: true, avatarUrl: true } },
        party: {
          include: {
            chatRoom: { select: { id: true, name: true, roomCode: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private ensureInviteReceiver(
    invite: NonNullable<InviteWithRelations>,
    userId: string,
  ) {
    if (invite.receiverId !== userId) {
      throw new NotFoundException();
    }
  }

  private ensureLeaderInvite(
    invite: NonNullable<InviteWithRelations>,
    userId: string,
  ) {
    const leader = this.getLeader(invite);
    if (!invite.partyId || !invite.party || !leader) {
      throw new NotFoundException('聊天室不存在或已解散');
    }
    if (leader.userId !== userId) {
      throw new ForbiddenException('仅房主可审批入队申请');
    }
    return leader;
  }

  private ensureActiveRoomInvite(invite: NonNullable<InviteWithRelations>) {
    const leader = this.getLeader(invite);
    if (!invite.party || invite.party.status !== 'active' || !leader) {
      throw new NotFoundException('聊天室不存在或已解散');
    }
    if (!invite.party.chatRoom || invite.party.chatRoom.status !== 'active') {
      throw new NotFoundException('聊天室不存在或已注销');
    }
    this.parties.assertPartyHasCapacity(invite.party);
    return leader;
  }

  private async updateInviteStatus(inviteId: string, status: 'pending_leader' | 'accepted') {
    await this.prisma.invite.update({
      where: { id: inviteId },
      data: { status },
    });
  }

  private async resolvePendingInvite(
    invite: NonNullable<InviteWithRelations>,
    userId: string,
    accept: boolean,
  ) {
    this.ensureInviteReceiver(invite, userId);

    if (!accept) {
      return this.rejectInvite(
        invite,
        userId,
        invite.partyId ? '聊天室邀请被拒绝' : '邀约被拒绝',
        invite.partyId
          ? `${invite.receiver.nickname} 拒绝了你的聊天室邀请`
          : `${invite.receiver.nickname} 拒绝了你的邀约`,
      );
    }

    if (invite.partyId) {
      return this.moveRoomInviteToLeaderApproval(invite);
    }

    return this.acceptTeamInvite(invite);
  }

  private async moveRoomInviteToLeaderApproval(invite: NonNullable<InviteWithRelations>) {
    const leader = this.ensureActiveRoomInvite(invite);
    await this.updateInviteStatus(invite.id, 'pending_leader');

    const roomLabel = this.getRoomLabel(invite);
    await this.notifications.create(leader.userId, {
      type: 'room_join_request_received',
      title: '收到入队申请',
      message: `${invite.receiver.nickname} 已接受「${roomLabel}」邀请，等待你审批`,
      link: '/invites',
      refId: invite.id,
    });

    if (invite.senderId !== leader.userId) {
      await this.notifications.create(invite.senderId, {
        type: 'room_invite_waiting_leader',
        title: '好友已接受邀请',
        message: `${invite.receiver.nickname} 已接受邀请，等待房主确认入队`,
        link: '/invites',
        refId: invite.id,
      });
    }

    return { status: 'pending_leader' as const, kind: 'room' as const };
  }

  private async acceptTeamInvite(invite: NonNullable<InviteWithRelations>) {
    const party = await this.parties.createFromUsers(
      [invite.senderId, invite.receiverId],
      invite.gameId ?? undefined,
      invite.senderId,
    );

    await this.updateInviteStatus(invite.id, 'accepted');
    await this.notifications.create(invite.senderId, {
      type: 'invite_accept',
      title: '邀约已接受',
      message: `${invite.receiver.nickname} 接受了你的邀约`,
      link: party.chatRoom ? `/chat/${party.chatRoom.id}` : '/parties',
      refId: invite.id,
    });

    return { status: 'accepted' as const, party, kind: 'team' as const };
  }

  private async resolvePendingLeaderInvite(
    invite: NonNullable<InviteWithRelations>,
    userId: string,
    accept: boolean,
  ) {
    this.ensureLeaderInvite(invite, userId);

    if (!accept) {
      return this.rejectInvite(
        invite,
        userId,
        '入队申请未通过',
        `${invite.receiver.nickname} 的入队申请未通过`,
        `房主未通过你加入「${this.getRoomLabel(invite)}」的申请`,
      );
    }

    const party = await this.parties.addMember(invite.partyId!, invite.receiverId);
    await this.updateInviteStatus(invite.id, 'accepted');

    const roomId = party?.chatRoom?.id;
    const roomLabel = this.getRoomLabel(invite);

    if (invite.senderId !== userId) {
      await this.notifications.create(invite.senderId, {
        type: 'room_join_request_approved',
        title: '房主已同意入队',
        message: `${invite.receiver.nickname} 已通过房主审批并加入「${roomLabel}」`,
        link: roomId ? `/chat/${roomId}` : '/parties',
        refId: invite.id,
      });
    }

    await this.notifications.create(invite.receiverId, {
      type: 'room_join_request_approved',
      title: '入队申请已通过',
      message: `房主已同意你加入「${roomLabel}」`,
      link: roomId ? `/chat/${roomId}` : '/parties',
      refId: invite.id,
    });

    return { status: 'accepted' as const, party, kind: 'room' as const };
  }

  async resolve(inviteId: string, userId: string, accept: boolean) {
    const invite = await this.getInviteById(inviteId);
    if (!invite) {
      throw new NotFoundException();
    }

    if (invite.status === 'pending') {
      return this.resolvePendingInvite(invite, userId, accept);
    }

    if (invite.status === 'pending_leader') {
      return this.resolvePendingLeaderInvite(invite, userId, accept);
    }

    throw new BadRequestException('该邀约已处理');
  }
}
