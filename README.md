# LogTimeLine

[中文](README.md) | [English](README.en.md)

本地日志合并编辑器：导入文本时可以筛选行、替换内容，再按时间戳生成时序图。

适合把多份 JSON 日志（或带 ISO 时间的纯文本）拼到一起对照请求顺序。数据只留在浏览器本地，不会上传。

尤其适合 [go-zero](https://go-zero.dev/) 的 `logx` JSON 日志：把 API / RPC 等多服务日志合并后，按 `@timestamp` 还原一次请求的时序。

## 用于 go-zero 日志

go-zero 默认 JSON 日志是**每行一条**，字段与本工具对齐，例如：

```json
{"@timestamp":"2026-08-28T15:36:40.862+08:00","caller":"handler/loghandler.go:149","content":"[HTTP] 503 - POST /v1/api/order/pay","duration":"3001.0ms","level":"error","span":"...","trace":"..."}
```

典型用法：

1. 从各服务收集日志（gateway、api、rpc、job），分别导入或一次粘贴。
2. 导入时筛选：只保留某条路径、某个 `trace`、或 `"level":"error"`。
3. 替换脱敏：`oauth_token`、`phone` 等（弹窗里可插入脱敏规则）。
4. 选择 **按时间戳交错**，把多份日志合成一条时间线。
5. 右侧时序图会标出 HTTP 方法、状态码、耗时、caller，以及 `trace` / `span`。

筛选示例：

| 目的 | 保留包含 | 排除包含 |
| --- | --- | --- |
| 只看某个接口 | `/v1/api/order/pay` | |
| 去掉探针 | | `kube-probe` |
| 只看错误 | `"level":"error"` | |
| 跟一条链路 | `"trace":"a64f6dda` | |

## 功能

- **导入文本**：拖入文件或粘贴；支持多文件
- **筛选行**：按包含 / 排除关键字过滤（正则、大小写、任一或同时满足）
- **替换**：多条查找替换；可一键插入 `oauth_token`、`phone` 等脱敏规则
- **合并**：覆盖当前、追加到末尾、按时间戳交错
- **时序图**：解析 `@timestamp`（也识别行内 ISO 时间），按时间排列事件
- **联动**：点击时序图事件会定位到编辑器对应行
- **导出**：将当前文本下载为 `merged-logs.txt`

当前文本会缓存在 `localStorage`，刷新页面不会丢失。

## 下载后直接运行

发版后会生成桌面安装包，下载即可用，不需要安装 Node。

| 系统 | 下载文件 | 用法 |
| --- | --- | --- |
| macOS | `LogTimeLine_x.x.x_aarch64.dmg` | 打开 dmg，拖到「应用程序」（Apple Silicon） |
| Windows | `LogTimeLine_x.x.x_x64-setup.exe` | 双击安装 |
| Linux | `.AppImage` 或 `.deb` | AppImage 赋权后双击运行 |

macOS 未签名时，若提示无法打开：右键图标选「打开」，或到「系统设置 → 隐私与安全性」允许运行。

### 发布到 GitHub Release

把代码推到 GitHub 后打标签：

```bash
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions 会构建 macOS / Windows / Linux 安装包，并挂到 **Draft Release**。到仓库的 Releases 页面检查后点 Publish。

也可以在 Actions 里手动跑 **release** 工作流。

### 本机打包（macOS）

需要 Node.js 18+ 和 [Rust](https://rustup.rs/)。

```bash
npm install
npm run desktop:build
```

安装包在：

```
src-tauri/target/release/bundle/dmg/LogTimeLine_0.1.0_aarch64.dmg
```

本机默认打出当前芯片架构（Apple Silicon 为 `aarch64`）。GitHub Release 在 `macos-latest` 上同样打出 Apple Silicon 包。

## 开发调试

需要 Node.js 18+。

```bash
npm install
npm run dev
```

浏览器打开 [http://localhost:5173/](http://localhost:5173/)。

也可以用 pnpm：

```bash
pnpm install
pnpm dev
```

其它命令：

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 浏览器开发 |
| `npm run desktop:dev` | 桌面窗口开发 |
| `npm run desktop:build` | 打出可安装包 |
| `npm run build` | 仅构建前端到 `dist/` |

## 使用

1. 点击 **载入示例** 看效果，或直接把日志粘贴进左侧编辑器。
2. 点击 **导入**，粘贴或选择另一份日志。
3. 在弹窗里设置筛选、替换，确认预览后选择合并方式。
4. 右侧时序图会按时间戳更新；也可切到「文本」或「时序图」单栏。
5. 需要对已有内容再处理时，用 **筛选当前**。

快捷键：`Ctrl/Cmd + O` 打开导入，`Esc` 关闭弹窗。

## 日志格式

优先支持 [go-zero](https://go-zero.dev/) `logx` 的每行一条 JSON，例如：

```json
{"@timestamp":"2026-08-28T15:36:40.862+08:00","caller":"handler/loghandler.go:149","content":"[HTTP] 503 - POST /v1/api/order/pay","duration":"3001.0ms","level":"error","span":"...","trace":"..."}
```

时序图会尽量读取这些字段：

| 字段 | 用途 |
| --- | --- |
| `@timestamp` / `timestamp` / `time` | 事件时间 |
| `level` | 级别着色 |
| `content` / `msg` | 摘要；可解析 `[HTTP] 503 - POST /path` |
| `duration` | 耗时条 |
| `caller` | 调用来源 |
| `trace` / `span` | 追踪标识 |

没有 JSON 结构时，只要行内有 ISO 时间，仍会进入时序图。

## 技术栈

Vite + React + TypeScript 前端，Tauri 打包成桌面应用。日志处理都在本地完成。
