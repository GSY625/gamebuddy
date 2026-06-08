import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { basename, resolve } from 'path';
import { Prisma, PrismaClient } from '../src/generated/prisma';

type ScalarField = {
  name: string;
  dbName?: string | null;
  type: string;
};

type DmmfModel = {
  name: string;
  dbName?: string | null;
  fields: Array<{
    name: string;
    dbName?: string | null;
    kind: string;
    type: string;
    relationFromFields?: string[];
  }>;
};

type PrismaDelegate = {
  count: () => Promise<number>;
  createMany: (args: { data: Record<string, unknown>[] }) => Promise<unknown>;
};

const CHUNK_SIZE = 500;
const MAX_SQLITE_BUFFER = 256 * 1024 * 1024;
const DEFAULT_SOURCE_DB = resolve(
  process.cwd(),
  'prisma/backup/dev-legacy-sqlite.db',
);
const prisma = new PrismaClient();

function lowerFirst(value: string) {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    source: DEFAULT_SOURCE_DB,
    resetTarget: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--source') {
      const next = args[index + 1];
      if (!next) {
        throw new Error('缺少 --source 的数据库路径');
      }
      options.source = resolve(process.cwd(), next);
      index += 1;
      continue;
    }

    if (arg === '--reset-target') {
      options.resetTarget = true;
      continue;
    }

    throw new Error(`不支持的参数：${arg}`);
  }

  return options;
}

function resolveSqliteBinary() {
  if (process.env.SQLITE3_PATH?.trim()) {
    return process.env.SQLITE3_PATH.trim();
  }

  try {
    const locator = process.platform === 'win32' ? 'where' : 'which';
    const output = execFileSync(locator, ['sqlite3'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const first = output.split(/\r?\n/).find(Boolean);
    if (first) {
      return first.trim();
    }
  } catch {
    return 'sqlite3';
  }

  return 'sqlite3';
}

function sqliteQuery(sqliteBinary: string, sourceDb: string, sql: string) {
  const output = execFileSync(
    sqliteBinary,
    ['-json', sourceDb, sql],
    {
      encoding: 'utf8',
      maxBuffer: MAX_SQLITE_BUFFER,
    },
  ).trim();

  if (!output) {
    return [];
  }

  return JSON.parse(output) as Record<string, unknown>[];
}

function getSqliteTableNames(sqliteBinary: string, sourceDb: string) {
  const rows = sqliteQuery(
    sqliteBinary,
    sourceDb,
    "SELECT name FROM sqlite_master WHERE type = 'table';",
  );

  return new Set(
    rows
      .map((row) => row.name)
      .filter((name): name is string => typeof name === 'string' && name.length > 0),
  );
}

function toDate(value: unknown) {
  if (value == null || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return new Date(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (/^\d+$/.test(trimmed)) {
      return new Date(Number(trimmed));
    }

    return new Date(trimmed);
  }

  return value;
}

function toBoolean(value: unknown) {
  if (value == null) {
    return value;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === '1' || normalized === 'true') {
      return true;
    }
    if (normalized === '0' || normalized === 'false') {
      return false;
    }
  }

  return Boolean(value);
}

function convertValue(type: string, value: unknown) {
  if (value == null) {
    return value;
  }

  if (type === 'DateTime') {
    return toDate(value);
  }

  if (type === 'Boolean') {
    return toBoolean(value);
  }

  return value;
}

function getModels() {
  return Prisma.dmmf.datamodel.models as unknown as DmmfModel[];
}

function getScalarFields(model: DmmfModel) {
  return model.fields.filter((field) => field.kind === 'scalar') as ScalarField[];
}

function getTableName(model: DmmfModel) {
  return model.dbName ?? model.name;
}

function getTargetDelegate(modelName: string) {
  return (prisma as unknown as Record<string, PrismaDelegate>)[lowerFirst(modelName)];
}

function buildImportOrder(models: DmmfModel[]) {
  const byName = new Map(models.map((model) => [model.name, model]));
  const dependencies = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>();

  for (const model of models) {
    const deps = new Set<string>();
    for (const field of model.fields) {
      if (
        field.kind === 'object' &&
        field.relationFromFields &&
        field.relationFromFields.length > 0 &&
        byName.has(field.type) &&
        field.type !== model.name
      ) {
        deps.add(field.type);
      }
    }
    dependencies.set(model.name, deps);

    for (const dep of Array.from(deps)) {
      if (!dependents.has(dep)) {
        dependents.set(dep, new Set());
      }
      dependents.get(dep)!.add(model.name);
    }
  }

  const queue = models
    .filter((model) => (dependencies.get(model.name)?.size ?? 0) === 0)
    .map((model) => model.name);
  const ordered: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    ordered.push(current);
    for (const dependent of Array.from(dependents.get(current) ?? [])) {
      const deps = dependencies.get(dependent);
      deps?.delete(current);
      if ((deps?.size ?? 0) === 0) {
        queue.push(dependent);
      }
    }
  }

  if (ordered.length === models.length) {
    return ordered;
  }

  const remaining = models
    .map((model) => model.name)
    .filter((name) => !ordered.includes(name));
  return [...ordered, ...remaining];
}

function mapRowToPrisma(model: DmmfModel, row: Record<string, unknown>) {
  const mapped: Record<string, unknown> = {};

  for (const field of getScalarFields(model)) {
    const sourceKey = field.dbName ?? field.name;
    mapped[field.name] = convertValue(field.type, row[sourceKey]);
  }

  return mapped;
}

async function ensureTargetIsSafe(modelNames: string[], resetTarget: boolean) {
  const counts: Array<{ modelName: string; count: number }> = [];
  for (const modelName of modelNames) {
    const delegate = getTargetDelegate(modelName);
    if (!delegate) {
      continue;
    }
    const count = await delegate.count();
    if (count > 0) {
      counts.push({ modelName, count });
    }
  }

  if (counts.length === 0) {
    return;
  }

  if (!resetTarget) {
    const preview = counts
      .slice(0, 6)
      .map((item) => `${item.modelName}:${item.count}`)
      .join(', ');
    throw new Error(
      `目标 PostgreSQL 不是空库，已检测到数据（${preview}）。如确认覆盖，请加 --reset-target`,
    );
  }

  const tableNames = getModels()
    .map((model) => `"${getTableName(model)}"`)
    .join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE;`);
}

async function insertInChunks(
  modelName: string,
  rows: Record<string, unknown>[],
) {
  if (rows.length === 0) {
    return;
  }

  const delegate = getTargetDelegate(modelName);
  if (!delegate) {
    throw new Error(`未找到 Prisma delegate：${modelName}`);
  }

  for (let index = 0; index < rows.length; index += CHUNK_SIZE) {
    const chunk = rows.slice(index, index + CHUNK_SIZE);
    await delegate.createMany({ data: chunk });
  }
}

async function verifyCounts(summary: Array<{ modelName: string; sourceCount: number }>) {
  for (const item of summary) {
    const delegate = getTargetDelegate(item.modelName);
    if (!delegate) {
      continue;
    }
    const targetCount = await delegate.count();
    if (targetCount !== item.sourceCount) {
      throw new Error(
        `${item.modelName} 导入后数量不一致：SQLite=${item.sourceCount}，PostgreSQL=${targetCount}`,
      );
    }
  }
}

async function main() {
  const { source, resetTarget } = parseArgs();
  const sqliteBinary = resolveSqliteBinary();
  if (!existsSync(source)) {
    throw new Error(`找不到 SQLite 源库：${source}`);
  }

  const models = getModels();
  const importOrder = buildImportOrder(models);
  const sourceTableNames = getSqliteTableNames(sqliteBinary, source);
  const skippedModels: Array<{ modelName: string; tableName: string }> = [];
  console.log(`准备导入 SQLite 数据：${basename(source)}`);
  console.log(`SQLite 客户端：${sqliteBinary}`);
  console.log(`导入顺序：${importOrder.join(' -> ')}`);

  await prisma.$connect();
  await ensureTargetIsSafe(importOrder, resetTarget);

  const summary: Array<{ modelName: string; sourceCount: number }> = [];

  for (const modelName of importOrder) {
    const model = models.find((item) => item.name === modelName);
    if (!model) {
      continue;
    }

    const tableName = getTableName(model);
    if (!sourceTableNames.has(tableName)) {
      console.log(`跳过 ${modelName}：旧 SQLite 库中不存在表 ${tableName}`);
      skippedModels.push({ modelName, tableName });
      continue;
    }

    const sourceRows = sqliteQuery(
      sqliteBinary,
      source,
      `SELECT * FROM "${tableName}";`,
    );
    const mappedRows = sourceRows.map((row) => mapRowToPrisma(model, row));

    console.log(`正在导入 ${modelName}（${mappedRows.length} 条）`);
    await insertInChunks(modelName, mappedRows);
    summary.push({ modelName, sourceCount: mappedRows.length });
  }

  await verifyCounts(summary);

  console.log('SQLite -> PostgreSQL 导入完成');
  for (const item of summary) {
    console.log(`- ${item.modelName}: ${item.sourceCount}`);
  }

  if (skippedModels.length > 0) {
    console.log('以下模型因旧库缺表而跳过：');
    for (const item of skippedModels) {
      console.log(`- ${item.modelName}: ${item.tableName}`);
    }
  }
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`导入失败：${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
