# Findings & Decisions
<!-- 
  WHAT: Your knowledge base for the task. Stores everything you discover and decide.
  WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited.
  WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule).
-->

## Requirements
<!-- 
  WHAT: What the user asked for, broken down into specific requirements.
  WHY: Keeps requirements visible so you don't forget what you're building.
  WHEN: Fill this in during Phase 1 (Requirements & Discovery).
  EXAMPLE:
    - Command-line interface
    - Add tasks
    - List all tasks
    - Delete tasks
    - Python implementation
-->
<!-- Captured from user request -->
- 打开插件会启动两个进程：`opencode serve --hostname=127.0.0.1 --port=0` 与 `opencode serve --hostname=127.0.0.1 --port=40960`。
- 期望只保留一个进程，`port=0` 的进程不应存在。
- 新增诉求：首次启动时应等待服务就绪，避免用户看到“重连”提示造成困惑。
- 新增诉求：插件中发送消息时需稳定有响应，不能出现“点击发送但无返回”。

## Research Findings
<!-- 
  WHAT: Key discoveries from web searches, documentation reading, or exploration.
  WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately.
  WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule).
  EXAMPLE:
    - Python's argparse module supports subcommands for clean CLI design
    - JSON module handles file persistence easily
    - Standard pattern: python script.py <command> [args]
-->
<!-- Key discoveries during exploration -->
- 代码中仅 `src/OpenCodeService.ts` 调用了 `createOpencode({ hostname: "127.0.0.1", port: 40960 + i })` 启动服务。
- 项目内未搜索到 `port=0` 或 `--port=0` 的显式调用。
- `@opencode-ai/sdk` 的 `createOpencodeServer` 仅按传入端口拼接 `opencode serve --port=<port>`，默认端口为 4096。
- 扩展激活时仅在 `src/extension.ts` 调用一次 `openCodeService.initialize(workspaceRoot)`。
- `opencode` 可执行文件位于 `/Users/iaos/.opencode/bin/opencode`（二进制，无法直接文本检索）。
- `docs/OPENCODE_TUI_SYNC_SYSTEM.md` 仅描述 SSE 事件与 server.instance.disposed 的重启处理，没有直接说明 server 启动/端口策略。
- 已通过 GitHub 浏览 anomalyco/opencode 仓库的 `sdks/vscode` 目录，可继续查看官方扩展实现（待深入到 `src`）。
- `sdks/vscode/src` 目录中仅发现 `extension.ts`（需打开查看具体 server 启动逻辑）。
- 官方 `sdks/vscode/src/extension.ts` 使用 VSCode Terminal 运行 `opencode --port <随机端口>`，并通过 `http://localhost:<port>/tui/append-prompt` 交互；未见 `opencode serve` 的 SDK 启动方式。
- `opencode serve --help` 显示默认端口为 `0`；任何未显式指定端口的 `opencode serve` 都会以 `--port=0` 启动。
- `opencode --help` 也显示默认端口为 `0`（通用 `--port` 选项），说明 CLI 未指定端口时会走随机端口。
- 代码库内仅 `tests/e2e/fixtures.ts` 显式使用 `--port 0` 启动 `opencode serve`（E2E 测试夹具）。
- `package.json` 的 `main` 指向 `dist/extension.js`，运行时使用编译产物而非 `src`。
- `@opencode-ai/sdk@1.1.18` 的 `createOpencodeServer` 会显式拼接 `--port=<port>`，默认端口为 `4096`（与 CLI 默认端口 `0` 不同）。
- 本机已安装多个 OpenCode/PaperStack 相关插件，其中 `tanishqkancharla.opencode-vscode` 的 `dist/extension.js` 明确调用 `createOpencode({ port: 0 })`，会启动 `opencode serve --port=0` 进程。
- 根因已确认：`paperstack.ai` 与 `tanishqkancharla.opencode-vscode` **同时贡献了相同的 view id `opencode.chatView` 和 command id `opencode.addSelectionToPrompt`**，导致打开视图时 VSCode 同时激活两套扩展，各自拉起一套 server（一个固定端口 `40960`，另一个使用 `port: 0`）。
- 现象澄清：`opencode` 在本机是 Node 包装器（`/usr/local/bin/opencode`），会再拉起平台二进制（如 `.../node_modules/opencode-darwin-x64/bin/opencode`）；因此在进程列表里看到同一端口 `40960` 的两条命令行（`node .../opencode serve ...` + `.../bin/opencode serve ...`）属于“包装器 + 实际服务进程”，不是两套服务重复监听同一端口。
- “已断开连接且需要重启”的根因：Webview 初始化比 server 启动更快时，扩展最初发送的 `init` 消息里 `serverUrl` 为空，Webview 端会忽略该消息，后续 server 启动完成也不会再收到更新，导致 UI 长期停留在 disconnected 状态。
- 新一轮修复策略：在扩展激活阶段直接 `await openCodeService.initialize(...)`，保证 Webview 首次可见时 server 已就绪，避免首屏出现 disconnected/reconnect 状态。
- “发送无响应”的直接诱因：UI 的可发送条件此前仅依赖 SDK client 是否创建（`sdk.isReady()`），当 SSE 已断开时仍允许发送，导致用户看到“发送了但没有流式返回”；应改为仅在 `status === connected` 时允许发送。

## Technical Decisions
<!-- 
  WHAT: Architecture and implementation choices you've made, with reasoning.
  WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge.
  WHEN: Update whenever you make a significant technical choice.
  EXAMPLE:
    | Use JSON for storage | Simple, human-readable, built-in Python support |
    | argparse with subcommands | Clean CLI: python todo.py add "task" |
-->
<!-- Decisions made with rationale -->
| Decision | Rationale |
|----------|-----------|
| 将 view/command id 命名空间化为 `paperstack.ai.*` | 避免与其他 OpenCode GUI 扩展（尤其是 `tanishqkancharla.opencode-vscode`）发生全局 id 冲突，从源头消除“打开视图触发双进程” |
| 扩展在 server 初始化完成后，向 Webview 额外发送 `server-url` 消息 | 修复“init 先到但缺少 serverUrl 导致 Webview 忽略并永久断连”的竞态；并避免重复发送不完整 `init` 覆盖 `logoUri` 等初始化数据 |
| 激活阶段先等待服务初始化完成再注册交互视图 | 满足“首次启动等待完成”的用户预期，减少“重连提示”心智负担 |
| `sync.isReady` 改为 `sdk.isReady && status === connected` | 防止断连状态下继续发送请求造成“发送无响应”假象，强制用户先恢复连接 |

## Issues Encountered
<!-- 
  WHAT: Problems you ran into and how you solved them.
  WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors).
  WHEN: Document when you encounter blockers or unexpected challenges.
  EXAMPLE:
    | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() |
-->
<!-- Errors and how they were resolved -->
| Issue | Resolution |
|-------|------------|
| Playwright E2E 在 `http://localhost:5199/src/webview/standalone.html` 报 `ECONNREFUSED` | 记录为环境/测试入口依赖问题（本次仅修复连接状态闪烁，不变更 e2e 基建）；故障定位点：`tests/e2e/fixtures.ts:336` |

## Resources
<!-- 
  WHAT: URLs, file paths, API references, documentation links you've found useful.
  WHY: Easy reference for later. Don't lose important links in context.
  WHEN: Add as you discover useful resources.
  EXAMPLE:
    - Python argparse docs: https://docs.python.org/3/library/argparse.html
    - Project structure: src/main.py, src/utils.py
-->
<!-- URLs, file paths, API references -->
- src/OpenCodeService.ts
- src/extension.ts
- node_modules/.pnpm/@opencode-ai+sdk@1.1.18/node_modules/@opencode-ai/sdk/dist/v2/server.js
- docs/OPENCODE_TUI_SYNC_SYSTEM.md
- https://github.com/anomalyco/opencode/tree/dev/sdks/vscode
- https://github.com/anomalyco/opencode/tree/dev/sdks/vscode/src
- https://github.com/anomalyco/opencode/blob/dev/sdks/vscode/src/extension.ts

## Visual/Browser Findings
<!-- 
  WHAT: Information you learned from viewing images, PDFs, or browser results.
  WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text.
  WHEN: IMMEDIATELY after viewing images or browser results. Don't wait!
  EXAMPLE:
    - Screenshot shows login form has email and password fields
    - Browser shows API returns JSON with "status" and "data" keys
-->
<!-- CRITICAL: Update after every 2 view/browser operations -->
<!-- Multimodal content must be captured as text immediately -->
-

---
<!-- 
  REMINDER: The 2-Action Rule
  After every 2 view/browser/search operations, you MUST update this file.
  This prevents visual information from being lost when context resets.
-->
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*

## 2026-02-13 Worktree 补充结论
- 在 `.worktrees/opencode-single-server` 中复核后，`src/webview/state/types.ts#createEmptyState()` 仍默认 `status: { status: "disconnected" }`。
- `src/webview/state/sync.tsx#handleStatus` 的 `connecting`/`connected` 依赖 SSE 回调异步到达，因此首次渲染存在时间窗，会先显示“已断开连接”。
- 本次修复将初始状态改为 `connecting`，并新增 `src/webview/state/types.test.ts` 锁定该行为，避免回归。

## 2026-02-13 E2E 追加发现
- 当前失败点：`tests/e2e/fixtures.ts:336` 跳转 `/src/webview/standalone.html` 时，经 `route.fetch()` 访问 `http://localhost:5199/...` 报 `ECONNREFUSED ::1:5199`。
- 这说明浏览器侧将 `localhost` 解析到 IPv6 回环 `::1`，而 dev server 很可能仅监听 IPv4（或仅被 IPv4 可达）。
- 可行最小修复：Playwright `baseURL/webServer.url` 与启动命令统一使用 `127.0.0.1`，并移除 fixture 的 `127.0.0.1 -> localhost` 改写。

## 2026-02-13 E2E 稳定性补充（worktree）
- 新增发现：本地偶发的 `opencodeServer` 启动超时并非断言逻辑问题，而是 fixture 每次测试都使用全新 `HOME/XDG`，触发多个 worker 并发冷启动安装插件，导致启动阶段抖动。
- 修复策略：将 OpenCode runtime 目录改为按 worker 持久复用（`/tmp/paperstack-e2e-runtime/worker-*`），保留 workspace 隔离，同时复用缓存以消除重复冷启动成本。
- 兜底策略：`startOpenCodeServer` 的 URL 检测超时从 30s 提升至 120s，覆盖冷缓存或网络波动场景。
- 清理项：移除 `fixtures.ts` 中临时调试逻辑（`debug-standalone.html` 落盘和 runtime debug 打印），避免测试噪音与额外 I/O。
- 验证结论：
  1) `attachments.spec.ts` 全通过（7/7）；
  2) 全量 e2e 通过（31 passed, 6 skipped）；
  3) `./bin/build-and-install.sh` 通过（vitest 271/271，构建/打包/安装成功）。

## 2026-02-13 单进程连接成功但无历史（worktree）
- 根因 1：`src/webview/state/bootstrap.ts` 仅以 `workspaceRoot` 精确目录拉取 session/status/permission；在 git worktree 场景下，历史常落在父仓库目录，导致返回空集合。
- 根因 2：`src/webview/App.tsx` 额外做了 `s.directory === workspaceRoot` 的前端二次过滤，即使后端已有可用会话也会被隐藏。
- 修复策略：
  1) 当 `workspaceRoot` 命中 `/.worktrees/` 且查询为空时，自动回退父仓库目录二次拉取；
  2) 删除前端冗余目录过滤，避免重复筛掉合法数据。
- 代码清理：
  - 移除 `src/OpenCodeService.ts` 中用于临时排查的 `_doInitialize` 调用栈日志输出。
