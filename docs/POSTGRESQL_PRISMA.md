# PostgreSQL 与 Prisma 说明

## 本地启动数据库

项目根目录已提供 `docker-compose.yml`，本地开发直接启动：

```bash
docker compose up -d postgres redis
```

默认连接信息与 `server/.env` 保持一致：

- PostgreSQL: `postgresql://gamebuddy:gamebuddy@localhost:5432/gamebuddy?schema=public`
- Redis: `redis://localhost:6379`

## Prisma 常用命令

在 `server/` 目录执行：

```bash
npm run prisma:generate
npm run db:migrate
npm run db:seed
```

开发时新增迁移：

```bash
npm run db:migrate:dev -- --name 你的迁移名
```

查看迁移状态：

```bash
npm run db:migrate:status
```

重建本地数据库：

```bash
npm run db:reset
```

## 从旧 SQLite 一次性导入

历史 SQLite 已经降级为备份文件，默认路径是：

```text
server/prisma/backup/dev-legacy-sqlite.db
```

它只用于历史数据导入，不再作为开发数据库使用。

在 `server/` 目录执行：

```bash
npm run db:import:sqlite
```

如果目标 PostgreSQL 已有数据，想先清空再导入：

```bash
npm run db:import:sqlite -- --reset-target
```

如果你的 SQLite 备份文件不在默认位置：

```bash
npm run db:import:sqlite -- --source 路径/你的旧库.db
```

说明：

- 脚本会通过本机 `sqlite3` 读取旧库
- 默认要求目标 PostgreSQL 为空库，避免误覆盖
- 如果旧库里没有新表，比如 `auth_sessions`，脚本会自动跳过
- 导入完成后会按表校验数量是否一致

## 当前约定

- 当前主流程默认使用 PostgreSQL，不再使用 SQLite `db push`
- 正式环境启动前执行 `prisma migrate deploy`
- 初始化历史结构的首个迁移文件位于
  `server/prisma/migrations/0001_init/migration.sql`
