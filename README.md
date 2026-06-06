# GameBuddy — 游戏搭子平台

找游戏搭子、发帖组队、邀约匹配、应用内文字聊天；语音 MVP 通过 QQ/微信/Discord 说明。

## 本地运行（无需 Docker）

### 1. 安装依赖

```bash
cd gamebuddy
npm install --legacy-peer-deps
```

### 2. 初始化数据库（SQLite，自动创建 `server/prisma/dev.db`）

```bash
cd server
npx prisma db push
npm run db:seed
```

### 3. 启动

在仓库根目录：

```bash
npm run dev
```

- API：http://localhost:3000
- Web：http://localhost:5173

注册时若未配置 SMTP，邮箱验证码会打印在后端控制台。

## 技术栈

- **前端**：React + Vite（`apps/web`）
- **后端**：NestJS + Prisma + SQLite（本地）/ PostgreSQL（生产可选）
- **实时**：Socket.IO 文字聊天
- **种子游戏**：英雄联盟、王者荣耀、无畏契约

## 主要功能

- 邮箱注册 / 登录
- 游戏分区 + 动态搭子档案（段位、截图等按游戏配置）
- 发帖找搭子 / 筛选玩家 / 发起邀约
- 组队后进入聊天室（文字 + 第三方语音说明）
- 举报 / 拉黑 / 敏感词过滤

## 项目结构

```
gamebuddy/
  apps/web/          # React 客户端
  apps/desktop/      # Tauri 桌面（需 Rust，见该目录 README）
  packages/shared/   # 游戏 Schema 种子
  packages/api-client/
  server/            # NestJS API
```

## 生产部署

见 `docs/DEPLOYMENT.md`（可选，本地开发可忽略）。
