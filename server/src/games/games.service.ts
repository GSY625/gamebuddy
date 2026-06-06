import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parseGameSchema } from '../common/schema-validator';

@Injectable()
export class GamesService {
  constructor(private prisma: PrismaService) {}

  async list() {
    const games = await this.prisma.game.findMany({
      where: { enabled: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        icon: true,
        platform: true,
        tags: true,
      },
    });
    return games.map((g: { id: string; slug: string; name: string; icon: string | null; platform: string; tags: string }) => ({
      id: g.id,
      slug: g.slug,
      name: g.name,
      icon: g.icon,
      platform: g.platform as 'pc' | 'mobile' | 'both',
      tags: JSON.parse(g.tags || '[]') as string[],
    }));
  }

  async getSchema(gameId: string) {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new NotFoundException('游戏不存在');
    return {
      id: game.id,
      slug: game.slug,
      name: game.name,
      schema: parseGameSchema(JSON.parse(game.schema)),
    };
  }
}
