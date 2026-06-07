import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type RestrictionType = 'invite' | 'direct_message' | 'lfg' | 'chat';

const RESTRICTION_MESSAGES: Record<RestrictionType, string> = {
  invite: '你当前已被限制发送邀请',
  direct_message: '你当前已被限制发送私信',
  lfg: '你当前已被限制发布招募',
  chat: '你当前已被限制发送聊天消息',
};

@Injectable()
export class RestrictionsService {
  constructor(private prisma: PrismaService) {}

  async assertAllowed(userId: string, type: RestrictionType) {
    const restriction = await this.prisma.userRestriction.findUnique({
      where: { userId_type: { userId, type } },
      select: { active: true },
    });
    if (restriction?.active) {
      throw new ForbiddenException(RESTRICTION_MESSAGES[type]);
    }
  }

  async listActive(userId: string) {
    return this.prisma.userRestriction.findMany({
      where: { userId, active: true },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
