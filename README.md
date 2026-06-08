# GameBuddy

游戏搭子平台 Web 应用，核心目标是帮助用户高效找到合适的游戏伙伴，围绕找搭子、发招募、即时沟通、筛选匹配和建立信任来设计。

## 本地运行

### 1. 安装依赖

```bash
cd gamebuddy
npm install --legacy-peer-deps
```

### 2. 启动基础服务

项目当前默认使用 PostgreSQL + Redis，本地开发直接启动：

```bash
docker compose up -d postgres redis
```

### 3. 初始化数据库

```bash
cd server
npm run prisma:generate
npm run db:migrate
npm run db:seed
```

### 4. 启动项目

在仓库根目录执行：

```bash
npm run dev
```

- API: `http://localhost:3000`
- Web: `http://localhost:5173`

如果本地没有配置 SMTP，注册时的邮箱验证码会打印到后端终端。

## 技术栈

- 前端：React + Vite，目录在 `apps/web`
- 后端：NestJS + Prisma + PostgreSQL
- 实时通信：Socket.IO
- 缓存与限流：Redis

## 主要功能

- 邮箱注册 / 登录 / 找回密码
- 游戏分区与个人搭子资料
- 发招募、筛选玩家、邀请组队
- 聊天室聊天与好友私信
- 举报、封禁、功能限制、后台审核

## 项目结构

```text
gamebuddy/
  apps/web/            # React Web 客户端
  packages/shared/     # 共享类型与游戏配置
  packages/api-client/ # 接口调用封装
  server/              # NestJS API
  docs/                # 项目文档
```

## 数据库说明

- `server/prisma/backup/dev-legacy-sqlite.db` 仅作为历史 SQLite 备份使用
- 当前开发与运行流程不再依赖 `server/prisma/dev.db`
- 旧 SQLite 导入 PostgreSQL 的方式见 [docs/POSTGRESQL_PRISMA.md](docs/POSTGRESQL_PRISMA.md)

## 部署相关文档

- PostgreSQL / Prisma 开发与导入说明：
  [docs/POSTGRESQL_PRISMA.md](docs/POSTGRESQL_PRISMA.md)
- 上线部署、S3、健康检查、CI 说明：
  [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
