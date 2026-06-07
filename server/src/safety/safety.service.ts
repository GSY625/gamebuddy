import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PartiesService } from '../parties/parties.service';
import { BlockDto, ReportDto } from './safety.dto';
import { BusinessLogService } from '../logging/business-log.service';

@Injectable()
export class SafetyService {
  constructor(
    private prisma: PrismaService,
    private parties: PartiesService,
    private businessLog: BusinessLogService,
  ) {}

  async report(reporterId: string, dto: ReportDto) {
    if (reporterId === dto.reportedId) {
      throw new BadRequestException('不能举报自己');
    }

    const reason = dto.reason?.trim();
    if (!reason) {
      throw new BadRequestException('请输入举报原因');
    }

    const report = await this.prisma.report.create({
      data: {
        reporterId,
        reportedId: dto.reportedId,
        targetType: dto.targetType?.trim() || 'user',
        targetId: dto.targetId?.trim() || dto.reportedId,
        reason,
        detail: dto.detail?.trim() || undefined,
      },
    });

    this.businessLog.log('safety.report.created', {
      reportId: report.id,
      reporterId,
      reportedId: dto.reportedId,
      targetType: report.targetType,
      targetId: report.targetId,
    });

    return report;
  }

  async block(blockerId: string, dto: BlockDto) {
    if (blockerId === dto.blockedId) {
      throw new BadRequestException('不能拉黑自己');
    }

    const blockedUser = await this.prisma.user.findUnique({
      where: { id: dto.blockedId },
      select: { id: true },
    });
    if (!blockedUser) {
      throw new NotFoundException('用户不存在');
    }

    const block = await this.prisma.block.upsert({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId: dto.blockedId,
        },
      },
      create: { blockerId, blockedId: dto.blockedId },
      update: {},
    });

    await this.prisma.$transaction([
      this.prisma.friendship.deleteMany({
        where: {
          OR: [
            { userId: blockerId, friendId: dto.blockedId },
            { userId: dto.blockedId, friendId: blockerId },
          ],
        },
      }),
      this.prisma.friendRequest.deleteMany({
        where: {
          OR: [
            { senderId: blockerId, receiverId: dto.blockedId },
            { senderId: dto.blockedId, receiverId: blockerId },
          ],
        },
      }),
      this.prisma.invite.deleteMany({
        where: {
          status: 'pending',
          OR: [
            { senderId: blockerId, receiverId: dto.blockedId },
            { senderId: dto.blockedId, receiverId: blockerId },
          ],
        },
      }),
      this.prisma.lfgApplicantCooldown.deleteMany({
        where: {
          OR: [
            { authorId: blockerId, applicantId: dto.blockedId },
            { authorId: dto.blockedId, applicantId: blockerId },
          ],
        },
      }),
    ]);

    await this.parties.removeUserFromSharedParties(
      blockerId,
      dto.blockedId,
      '由于拉黑关系，你已被移出聊天室',
    );

    this.businessLog.log('safety.block.created', {
      blockId: block.id,
      blockerId,
      blockedId: dto.blockedId,
    });

    return block;
  }

  async listBlocks(userId: string) {
    return this.prisma.block.findMany({
      where: { blockerId: userId },
      include: {
        blocked: { select: { id: true, nickname: true } },
      },
    });
  }

  async unblock(blockerId: string, blockedId: string) {
    await this.prisma.block.deleteMany({
      where: { blockerId, blockedId },
    });
    this.businessLog.log('safety.block.removed', {
      blockerId,
      blockedId,
    });
    return { ok: true };
  }
}
