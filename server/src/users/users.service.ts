import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ChangePasswordDto, UpdateUserDto } from './users.dto';
import {
  VisibilityService,
  VisibilityStatus,
} from '../visibility/visibility.service';
import { ChatGateway } from '../chat/chat.gateway';
import { getNicknameCooldown } from './nickname-cooldown';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private visibility: VisibilityService,
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway,
  ) {}

  sanitize(user: {
    id: string;
    email: string;
    nickname: string;
    avatarUrl: string | null;
    bio: string | null;
    isVip: boolean;
    emailVerified: boolean;
  }) {
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      isVip: user.isVip,
      emailVerified: user.emailVerified,
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    const presence = await this.redis.get(`presence:${userId}`);
    const visibilityStatus = await this.visibility.get(userId);
    const nicknameCooldown = getNicknameCooldown(user.nicknameChangedAt);
    return {
      ...this.sanitize(user),
      online: presence === '1',
      visibilityStatus,
      nicknameCooldown,
    };
  }

  async setVisibility(userId: string, status: VisibilityStatus) {
    await this.visibility.set(userId, status);
    const connected = (await this.redis.get(`presence:${userId}`)) === '1';
    this.chatGateway.server.emit('presence:update', {
      userId,
      online: connected,
      visibility: status,
    });
    return { visibilityStatus: status };
  }

  async isNicknameTaken(nickname: string, excludeUserId?: string) {
    const trimmed = nickname.trim();
    if (!trimmed) return false;
    const existing = await this.prisma.user.findFirst({
      where: {
        nickname: trimmed,
        ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
      },
      select: { id: true },
    });
    return Boolean(existing);
  }

  async checkNickname(nickname: string, excludeUserId?: string) {
    const trimmed = nickname.trim();
    if (!trimmed) {
      return { available: false, message: '昵称不能为空' };
    }
    const taken = await this.isNicknameTaken(trimmed, excludeUserId);
    return {
      available: !taken,
      message: taken ? '该昵称已存在' : undefined,
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('当前密码不正确');
    const sameAsCurrent = await bcrypt.compare(
      dto.newPassword,
      user.passwordHash,
    );
    if (sameAsCurrent) {
      throw new BadRequestException('新密码不能与当前密码相同');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    return { message: '密码已修改' };
  }

  async updateMe(userId: string, dto: UpdateUserDto) {
    const current = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!current) throw new NotFoundException();

    const data: {
      nickname?: string;
      bio?: string;
      avatarUrl?: string | null;
      nicknameChangedAt?: Date;
    } = {};

    if (dto.bio !== undefined) data.bio = dto.bio;
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;

    if (dto.nickname !== undefined) {
      const trimmed = dto.nickname.trim();
      if (!trimmed) {
        throw new BadRequestException('昵称不能为空');
      }
      if (trimmed !== current.nickname) {
        const cooldown = getNicknameCooldown(current.nicknameChangedAt);
        if (!cooldown.canChange) {
          const days = Math.ceil(cooldown.remainingMs / (24 * 60 * 60 * 1000));
          throw new BadRequestException(
            `昵称每周仅可修改一次，请 ${days} 天后再试`,
          );
        }
        if (await this.isNicknameTaken(trimmed, userId)) {
          throw new ConflictException('该昵称已存在');
        }
        data.nickname = trimmed;
        data.nicknameChangedAt = new Date();
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
    });
    return {
      ...this.sanitize(user),
      nicknameCooldown: getNicknameCooldown(user.nicknameChangedAt),
    };
  }

  async findById(id: string, viewerId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException();
    if (viewerId) {
      const blocked = await this.prisma.block.findFirst({
        where: {
          OR: [
            { blockerId: viewerId, blockedId: id },
            { blockerId: id, blockedId: viewerId },
          ],
        },
      });
      if (blocked) throw new NotFoundException();
    }
    const connected = (await this.redis.get(`presence:${id}`)) === '1';
    const visible = await this.visibility.isVisibleToOthers(id);
    return {
      id: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      isVip: user.isVip,
      online: connected && visible,
    };
  }
}
