# GameBuddy 桌面端（Tauri）

当前环境未检测到 Rust 时，请先用 Web 客户端开发：

```bash
npm run dev:web
```

## 构建 Windows 安装包

1. 安装 [Rust](https://rustup.rs/) 与 [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/)
2. 安装 Tauri CLI：`cargo install tauri-cli --version "^2.0.0"`
3. 将 `apps/web/dist` 作为前端产物，在 `src-tauri` 中配置 `tauri.conf.json` 指向 `../web/dist`
4. 运行 `tauri build` 生成 `msi` / `nsis` 安装包

桌面端与 Web 共享 `packages/ui`（当前实现于 `apps/web`），仅壳层不同。
