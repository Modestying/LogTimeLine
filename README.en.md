# LogTimeLine

[中文](README.md) | [English](README.en.md)

A local log merge editor: filter and replace lines while importing, then build a timeline from timestamps.

Use it to stitch JSON logs (or any text with ISO timestamps) into one chronological view. Everything stays in the browser or desktop app — nothing is uploaded.

It is built around [go-zero](https://go-zero.dev/) `logx` JSON logs. Merge API, RPC, and gateway output, then replay a request by `@timestamp`.

## Use with go-zero

[go-zero](https://go-zero.dev/) writes one JSON object per line. The fields match this tool:

```json
{"@timestamp":"2026-08-28T15:36:40.862+08:00","caller":"handler/loghandler.go:149","content":"[HTTP] 503 - POST /v1/api/order/pay","duration":"3001.0ms","level":"error","span":"...","trace":"..."}
```

Typical workflow:

1. Collect logs from each service (gateway, REST API, zRPC, jobs) and import or paste them.
2. Filter on import: keep one path, a `trace` id, or `"level":"error"`.
3. Redact secrets in `content` (`oauth_token`, `phone`, …). The import dialog can insert redact rules.
4. Choose **Interleave by timestamp** so multiple files become one timeline.
5. The sequence view shows HTTP method, status, duration, `caller`, `trace`, and `span`.

Filter examples:

| Goal | Include | Exclude |
| --- | --- | --- |
| One HTTP route | `/v1/api/order/pay` | |
| Drop probes | | `kube-probe` |
| Errors only | `"level":"error"` | |
| Follow a trace | `"trace":"a64f6dda` | |

Enable JSON logging in go-zero (`logx` / rest `Log` config) so each line is a single object with `@timestamp`. Access logs that look like `[HTTP] 503 - POST /path` are parsed automatically.

## Features

- **Import**: drop files or paste; multiple files at once
- **Filter lines**: include / exclude keywords (regex, case sensitivity, any vs all)
- **Replace**: multiple find/replace rules; one-click redact for tokens and phone numbers
- **Merge**: overwrite, append, or interleave by timestamp
- **Timeline**: reads `@timestamp` (also ISO timestamps in plain text)
- **Jump**: click a timeline event or a log line to keep both panes in sync; in split view, scrolling the text pane follows the matching timeline event
- **Find**: `Ctrl/Cmd + F` searches the current text, with match-case and regex options
- **Export**: download the merged text as `merged-logs.txt`

The current document is stored in `localStorage` and survives a refresh.

## Download and run

Release builds are desktop installers. No Node.js required.

| OS | Artifact | How to run |
| --- | --- | --- |
| macOS | `LogTimeLine_x.x.x_aarch64.dmg` | Open the dmg, drag to Applications (Apple Silicon) |
| Windows | `LogTimeLine_x.x.x_x64-setup.exe` | Double-click to install |
| Linux | `.AppImage` or `.deb` | Make the AppImage executable, then run it |

If macOS says the app is **damaged**, the download is fine — Gatekeeper is blocking an unnotarized build. After dragging it to Applications, run:

```bash
xattr -cr /Applications/LogTimeLine.app
```

Then right-click the icon and choose **Open**, or allow it under **System Settings → Privacy & Security**.

### Publish a GitHub Release

```bash
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions builds macOS, Windows, and Linux packages and attaches them to a **draft release**. Open Releases, review, then publish.

You can also run the **release** workflow manually from Actions.

### Package locally (macOS)

Needs Node.js 18+ and [Rust](https://rustup.rs/).

```bash
npm install
npm run desktop:build
```

Output:

```
src-tauri/target/release/bundle/dmg/LogTimeLine_0.1.0_aarch64.dmg
```

A local build matches the current CPU (Apple Silicon → `aarch64`). GitHub Release on `macos-latest` also produces an Apple Silicon package.

## Development

Needs Node.js 18+.

```bash
npm install
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/).

pnpm:

```bash
pnpm install
pnpm dev
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Browser dev server |
| `npm run desktop:dev` | Desktop window |
| `npm run desktop:build` | Installer / dmg |
| `npm run build` | Frontend only (`dist/`) |

## Usage

1. Click **Load sample**, or paste logs into the left editor.
2. Click **Import** and paste or choose another log file.
3. Set filters and replacements, check the preview, then pick a merge mode.
4. The timeline on the right updates by timestamp. Switch to **Text** or **Timeline** for a single pane.
5. Use **Filter current** to process text already in the editor.

Shortcuts: `Ctrl/Cmd + O` to import, `Ctrl/Cmd + F` to find, `F3` for next match, `Esc` to close the dialog or find bar.

## Log format

Prefer NDJSON (one JSON object per line). go-zero `logx` is the primary target; other JSON logs work if they have a timestamp field.

```json
{"@timestamp":"2026-08-28T15:36:40.862+08:00","caller":"handler/loghandler.go:149","content":"[HTTP] 503 - POST /v1/api/order/pay","duration":"3001.0ms","level":"error","span":"...","trace":"..."}
```

Fields used by the timeline:

| Field | Use |
| --- | --- |
| `@timestamp` / `timestamp` / `time` | Event time (go-zero uses `@timestamp`) |
| `level` | Color by severity |
| `content` / `msg` | Summary; parses `[HTTP] 503 - POST /path` |
| `duration` | Duration bar |
| `caller` | Source location |
| `trace` / `span` | Trace identifiers |

Plain-text lines still appear on the timeline if they contain an ISO timestamp.

## Stack

Vite + React + TypeScript UI, packaged with Tauri. Log processing is entirely local.
