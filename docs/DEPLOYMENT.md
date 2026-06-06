# 国内云部署指南

## 环境变量（生产）

```
DATABASE_URL=postgresql://user:pass@host:5432/gamebuddy
REDIS_URL=redis://:pass@host:6379
JWT_SECRET=<随机长字符串>
CORS_ORIGIN=https://your-domain.com
PUBLIC_BASE_URL=https://api.your-domain.com
SMTP_HOST=smtp.example.com
SMTP_USER=
SMTP_PASS=
```

## 推荐拓扑

- 1× API 容器（NestJS，含 WebSocket）
- 托管 PostgreSQL + Redis
- OSS 存截图；CDN 托管 Web 静态文件
- HTTPS 终止于负载均衡

## 备案清单

1. 域名 ICP 备案
2. 公安备案（开通论坛/聊天类功能时）
3. 用户协议与隐私政策页面
4. 18+ 或未成年人保护说明（游戏社交场景）

## CI 示例

1. `docker build -f server/Dockerfile -t gamebuddy-api .`
2. `npm run build -w @gamebuddy/web` → 上传 `apps/web/dist` 至 OSS
3. 有 Rust 环境时执行 `scripts/build-windows.ps1` 产出安装包
