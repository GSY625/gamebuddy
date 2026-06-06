import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  parseGameSchema,
  validateFieldValues,
} from '../common/schema-validator';
import { CreateProfileDto, UpdateProfileDto } from './profiles.dto';
import { VisibilityService } from '../visibility/visibility.service';

function parseFieldValues(raw: string) {
  return JSON.parse(raw) as Record<string, unknown>;
}

function toProfileDto(row: {
  id: string;
  userId: string;
  gameId: string;
  name: string;
  fieldValues: string;
  publishedToSquare: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    userId: row.userId,
    gameId: row.gameId,
    name: row.name,
    fieldValues: parseFieldValues(row.fieldValues),
    publishedToSquare: row.publishedToSquare,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class ProfilesService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
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

  private async validateGameFields(
    gameId: string,
    fieldValues: Record<string, unknown>,
  ) {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new NotFoundException('游戏不存在');
    const schema = parseGameSchema(JSON.parse(game.schema));
    const err = validateFieldValues(schema, fieldValues, game.slug);
    if (err) throw new BadRequestException(err);
    return game;
  }

  private async assertOwner(profileId: string, userId: string) {
    const profile = await this.prisma.userGameProfile.findUnique({
      where: { id: profileId },
    });
    if (!profile) throw new NotFoundException('方案不存在');
    if (profile.userId !== userId) throw new ForbiddenException();
    return profile;
  }

  async listMine(userId: string, gameId: string) {
    const rows = await this.prisma.userGameProfile.findMany({
      where: { userId, gameId },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(toProfileDto);
  }

  async getOne(profileId: string, userId: string) {
    const row = await this.assertOwner(profileId, userId);
    return toProfileDto(row);
  }

  async create(userId: string, gameId: string, dto: CreateProfileDto) {
    await this.visibility.assertOnline(userId);
    await this.validateGameFields(gameId, dto.fieldValues);
    const publish = dto.publishToSquare ?? false;
    if (publish) {
      await this.unpublishSiblings(userId, gameId);
    }
    const row = await this.prisma.userGameProfile.create({
      data: {
        userId,
        gameId,
        name: dto.name.trim(),
        fieldValues: JSON.stringify(dto.fieldValues),
        publishedToSquare: publish,
      },
    });
    return toProfileDto(row);
  }

  async update(profileId: string, userId: string, dto: UpdateProfileDto) {
    await this.visibility.assertOnline(userId);
    const existing = await this.assertOwner(profileId, userId);
    if (dto.fieldValues) {
      await this.validateGameFields(existing.gameId, dto.fieldValues);
    }
    const row = await this.prisma.userGameProfile.update({
      where: { id: profileId },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.fieldValues
          ? { fieldValues: JSON.stringify(dto.fieldValues) }
          : {}),
      },
    });
    return toProfileDto(row);
  }

  async remove(profileId: string, userId: string) {
    await this.assertOwner(profileId, userId);
    await this.prisma.userGameProfile.delete({ where: { id: profileId } });
    return { ok: true };
  }

  private async unpublishSiblings(
    userId: string,
    gameId: string,
    exceptId?: string,
  ) {
    await this.prisma.userGameProfile.updateMany({
      where: {
        userId,
        gameId,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      data: { publishedToSquare: false },
    });
  }

  async setPublished(profileId: string, userId: string, published: boolean) {
    await this.visibility.assertOnline(userId);
    const existing = await this.assertOwner(profileId, userId);
    if (published) {
      await this.unpublishSiblings(userId, existing.gameId, profileId);
    }
    const row = await this.prisma.userGameProfile.update({
      where: { id: profileId },
      data: { publishedToSquare: published },
    });
    return toProfileDto(row);
  }

  async search(
    gameId: string,
    filters: { rank?: string; mode?: string; region?: string },
    viewerId: string,
  ) {
    await this.visibility.assertOnline(viewerId);
    const hiddenUserIds = await this.getHiddenUserIds(viewerId);

    const profiles = await this.prisma.userGameProfile.findMany({
      where: { gameId, publishedToSquare: true },
      orderBy: { updatedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
            isVip: true,
          },
        },
      },
    });

    const seen = new Set<string>();
    const redis = this.redis;
    const results = [];

    for (const p of profiles) {
      if (p.userId === viewerId || hiddenUserIds.has(p.userId)) continue;
      if (!(await this.visibility.isVisibleToOthers(p.userId))) continue;
      if (seen.has(p.userId)) continue;
      seen.add(p.userId);

      const values = parseFieldValues(p.fieldValues);
      if (filters.mode && values.game_mode !== filters.mode) continue;
      if (
        filters.region &&
        values.game_server_region !== filters.region
      ) {
        continue;
      }
      if (filters.rank && values.rank !== filters.rank) continue;
      const online = (await redis.get(`presence:${p.userId}`)) === '1';
      results.push({
        userId: p.userId,
        nickname: p.user.nickname,
        avatarUrl: p.user.avatarUrl,
        isVip: p.user.isVip,
        fieldValues: values,
        profileName: p.name,
        online,
        updatedAt: p.updatedAt,
      });
    }
    return results.sort((a, b) => Number(b.online) - Number(a.online));
  }
}
