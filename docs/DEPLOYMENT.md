# 部署说明

## 上线前最低要求

当前项目已经补上了以下上线基础设施：

- PostgreSQL + Prisma 迁移体系
- Redis 限流、在线状态、Socket 跨实例同步
- HttpOnly Refresh Cookie 会话模型
- 健康检查接口
- GitHub Actions 最小 CI

正式上线前，建议你至少保证下面这些条件满足：

- API 使用 PostgreSQL，不再连接 SQLite
- 生产环境 Redis 使用真实实例，不能再用 `REDIS_URL=memory`
- 上传切到对象存储，不要继续依赖本地磁盘
- 反向代理或平台要能探活 `/health/live` 和 `/health/ready`
- 每次发布前跑 `prisma migrate deploy`

## 后端环境变量

参考文件：

- [server/.env.example](../server/.env.example)

关键字段说明：

- `DATABASE_URL`
  PostgreSQL 连接串，生产环境不能指向 `localhost`
- `REDIS_URL`
  Redis 连接串，生产环境不能为 `memory`
- `JWT_SECRET`
  必须替换为高强度随机字符串
- `REFRESH_TOKEN_SECRET`
  必须替换为高强度随机字符串
- `ADMIN_EMAILS`
  管理员邮箱白名单，多个值用逗号分隔
- `PUBLIC_BASE_URL`
  后端对外访问地址，例如 `https://api.your-domain.com`
- `CORS_ORIGIN`
  前端站点地址，多个值可用逗号分隔

## S3 / 对象存储

现在上传支持双驱动：

- `UPLOAD_DRIVER=local`
  仅适合本地开发
- `UPLOAD_DRIVER=s3`
  生产环境必须使用

需要配置的字段：

- `S3_ENDPOINT`
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_PUBLIC_BASE_URL`
  如果你用了 CDN 或自定义域名，就填这里
- `S3_FORCE_PATH_STYLE`
  MinIO 或部分 S3 兼容存储常用 `true`

示例：

```env
UPLOAD_DRIVER=s3
S3_ENDPOINT=https://s3.ap-east-1.amazonaws.com
S3_REGION=ap-east-1
S3_BUCKET=gamebuddy-prod
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_PUBLIC_BASE_URL=https://cdn.your-domain.com
S3_FORCE_PATH_STYLE=false
```

## 健康检查

后端已提供两个健康接口：

- `GET /health/live`
  只判断服务进程是否存活
- `GET /health/ready`
  检查数据库、Redis、上传驱动是否可用

示例：

```bash
curl http://localhost:3000/health/live
curl http://localhost:3000/health/ready
```

推荐接法：

- 容器平台或 PaaS 的 liveness probe 指向 `/health/live`
- readiness probe 指向 `/health/ready`
- 网关或负载均衡只把 ready 的实例加入流量

## CI

仓库已新增 GitHub Actions 工作流：

- `.github/workflows/ci.yml`

当前 CI 会做这些事：

- 安装依赖
- 启动 PostgreSQL 与 Redis 服务容器
- 执行 `prisma generate`
- 执行 `prisma migrate deploy`
- 构建后端
- 构建前端

如果你后续接 GitHub 仓库，建议保持：

- `main` 分支保护
- Pull Request 必须通过 CI
- 发布前强制看一次迁移结果和健康检查

## 推荐发布流程

```bash
docker compose up -d postgres redis
cd server
npm run prisma:generate
npm run db:migrate
npm run build
cd ..
npm run build -w @gamebuddy/web
```

然后再部署：

1. 先发后端并执行 `prisma migrate deploy`
2. 验证 `/health/ready` 为 `ok`
3. 再发前端
4. 登录、私信、聊天室、上传图片各测一轮

## 作为合伙人的建议

当前项目已经走到“可继续往上线推进”的阶段，但我建议你后面优先继续补这几类：

- 对象存储真实联调
  现在代码支持了，但你还需要接入真实桶并走一轮上传回归
- 监控与告警
  现在有日志和健康检查，但还没有真正的错误告警通道
- 管理后台的审核闭环
  要继续补管理员的批量操作效率和审计体验
- 发布环境配置分层
  后面最好把本地、测试、正式环境的 env 明确分开
