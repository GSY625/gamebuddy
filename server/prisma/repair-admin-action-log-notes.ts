import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

const GENERIC_DAMAGED_NOTE = '历史备注已损坏（旧 SQLite 导入）';
const RESTRICTION_TYPE_LABELS: Record<string, string> = {
  invite: '发送邀请',
  direct_message: '发送私信',
  lfg: '发布招募',
  chat: '聊天发言',
};

const DAMAGED_NOTE_PATTERN = /�|\?{3,}/;

function repairDamagedNote(note: string) {
  const trimmed = note.trim();
  if (!DAMAGED_NOTE_PATTERN.test(trimmed)) {
    return null;
  }

  const restrictionMatch = trimmed.match(/^([a-z_]+)[：:](.*)$/i);
  if (restrictionMatch) {
    const [, type] = restrictionMatch;
    const label = RESTRICTION_TYPE_LABELS[type];
    if (label) {
      return `${label}：${GENERIC_DAMAGED_NOTE}`;
    }
  }

  return GENERIC_DAMAGED_NOTE;
}

async function main() {
  const targetLogs = await prisma.adminActionLog.findMany({
    where: {
      OR: [{ note: { contains: '?' } }, { note: { contains: '�' } }],
    },
    select: {
      id: true,
      note: true,
      action: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const updates = targetLogs
    .map((item) => {
      if (!item.note) {
        return null;
      }

      const nextNote = repairDamagedNote(item.note);
      if (!nextNote || nextNote === item.note) {
        return null;
      }

      return {
        id: item.id,
        action: item.action,
        createdAt: item.createdAt,
        previousNote: item.note,
        nextNote,
      };
    })
    .filter(Boolean) as Array<{
    id: string;
    action: string;
    createdAt: Date;
    previousNote: string;
    nextNote: string;
  }>;

  if (updates.length === 0) {
    console.log('没有发现需要修复的管理员历史备注。');
    return;
  }

  await prisma.$transaction(
    updates.map((item) =>
      prisma.adminActionLog.update({
        where: { id: item.id },
        data: { note: item.nextNote },
      }),
    ),
  );

  console.log(`已修复 ${updates.length} 条管理员历史备注：`);
  for (const item of updates) {
    console.log(
      `- ${item.id} | ${item.action} | ${item.createdAt.toISOString()} | ${item.previousNote} -> ${item.nextNote}`,
    );
  }
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`修复失败：${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
