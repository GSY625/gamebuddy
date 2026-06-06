# GameBuddy 首次初始化（PowerShell）
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ">>> 停止可能占用文件的 Node 进程..."
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host ">>> 清理旧的 Prisma 引擎（根目录 node_modules，易在 Windows 被锁）..."
Remove-Item -Recurse -Force "$root\node_modules\.prisma" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$root\server\src\generated" -ErrorAction SilentlyContinue

Write-Host ">>> 安装依赖..."
npm install --legacy-peer-deps

Set-Location "$root\server"

Write-Host ">>> 生成 Prisma Client（输出到 server/src/generated/prisma）..."
npx prisma generate

Write-Host ">>> 创建数据库..."
npx prisma db push

Write-Host ">>> 写入种子数据..."
npm run db:seed

Write-Host ""
Write-Host "完成！启动项目请执行："
Write-Host "  cd $root"
Write-Host "  npm run dev"
Write-Host "然后浏览器打开 http://localhost:5173"
