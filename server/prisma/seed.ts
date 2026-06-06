import { PrismaClient } from '../src/generated/prisma';
import { MVP_GAMES_SEED } from '../../packages/shared/src/index';

const prisma = new PrismaClient();

async function main() {
  const activeSlugs = MVP_GAMES_SEED.map((game) => game.slug);

  for (const game of MVP_GAMES_SEED) {
    await prisma.game.upsert({
      where: { slug: game.slug },
      create: {
        slug: game.slug,
        name: game.name,
        icon: game.icon,
        platform: game.platform,
        enabled: true,
        tags: JSON.stringify([...game.tags]),
        schema: JSON.stringify(game.schema),
      },
      update: {
        name: game.name,
        icon: game.icon,
        platform: game.platform,
        enabled: true,
        tags: JSON.stringify([...game.tags]),
        schema: JSON.stringify(game.schema),
      },
    });
  }

  await prisma.game.updateMany({
    where: {
      slug: {
        notIn: activeSlugs,
      },
    },
    data: {
      enabled: false,
    },
  });

  console.log('Seeded games:', MVP_GAMES_SEED.map((g) => g.name).join(', '));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
