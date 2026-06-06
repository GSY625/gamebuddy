# Windows 桌面安装包构建脚本（需已安装 Rust + Tauri CLI）
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "Building web assets..."
Set-Location $root
npm run build -w @gamebuddy/web

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Host "Rust 未安装。请访问 https://rustup.rs 安装后重试。"
    Write-Host "开发阶段可直接使用: npm run dev:web"
    exit 1
}

Write-Host "Run Tauri build from apps/desktop after configuring src-tauri (see apps/desktop/README.md)"
