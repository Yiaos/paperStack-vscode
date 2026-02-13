# Progress Log
<!-- 
  WHAT: Your session log - a chronological record of what you did, when, and what happened.
  WHY: Answers "What have I done?" in the 5-Question Reboot Test. Helps you resume after breaks.
  WHEN: Update after completing each phase or encountering errors. More detailed than task_plan.md.
-->

## Session: 2026-02-07
<!-- 
  WHAT: The date of this work session.
  WHY: Helps track when work happened, useful for resuming after time gaps.
  EXAMPLE: 2026-01-15
-->

### Phase 1: Requirements & Discovery
<!-- 
  WHAT: Detailed log of actions taken during this phase.
  WHY: Provides context for what was done, making it easier to resume or debug.
  WHEN: Update as you work through the phase, or at least when you complete it.
-->
- **Status:** complete
- **Started:** 2026-02-07 02:05
- **Ended:** 2026-02-07 02:15
<!-- 
  STATUS: Same as task_plan.md (pending, in_progress, complete)
  TIMESTAMP: When you started this phase (e.g., "2026-01-15 10:00")
-->
- Actions taken:
  <!-- 
    WHAT: List of specific actions you performed.
    EXAMPLE:
      - Created todo.py with basic structure
      - Implemented add functionality
      - Fixed FileNotFoundError
  -->
  - 搜索扩展代码中 `opencode serve`/`port=0` 调用路径
  - 检查 `OpenCodeService`/`extension.ts` 启动逻辑
  - 检查 `@opencode-ai/sdk` 的 server 启动实现
  - 确认本地 `opencode` 二进制路径
- Files created/modified:
  <!-- 
    WHAT: Which files you created or changed.
    WHY: Quick reference for what was touched. Helps with debugging and review.
    EXAMPLE:
      - todo.py (created)
      - todos.json (created by app)
      - task_plan.md (updated)
  -->
  - task_plan.md（更新）
  - findings.md（更新）
  - progress.md（更新）

### Phase 2: Planning & Structure
<!-- 
  WHAT: Same structure as Phase 1, for the next phase.
  WHY: Keep a separate log entry for each phase to track progress clearly.
-->
- **Status:** in_progress
- **Started:** 2026-02-07 02:16
- Actions taken:
  - 通过 agent-browser 打开 anomalyco/opencode 仓库的 `sdks/vscode/src/extension.ts`
  - 发现官方扩展采用 VSCode Terminal + `opencode --port <随机端口>` 的方式，而非 SDK `opencode serve`
  - 验证 `opencode serve --help` 默认端口为 `0`
  - 检查本机已安装的 VSCode 插件，发现 `tanishqkancharla.opencode-vscode` 使用 `createOpencode({ port: 0 })`
  - 验证二次启动同端口 `40960` 会失败，不会自动回退到 `0`
  - 观察 `opencode` CLI 包装器会生成子进程，单独 kill 包装器会遗留子进程
- Files created/modified:
  - findings.md（更新）

## Session: 2026-02-08

### Phase 3-5: Implementation / Testing / Delivery

- **Status:** complete
- Actions taken:
  - 在 `~/.vscode/extensions/*/package.json` 确认 `paperstack.ai` 与 `tanishqkancharla.opencode-vscode` 存在相同的 view/command id（`opencode.chatView` / `opencode.addSelectionToPrompt`）
  - 将本扩展 view id/command id 命名空间化为 `paperstack.ai.chatView` / `paperstack.ai.addSelectionToPrompt`，并补齐 `activationEvents`
  - 更新扩展代码与文档引用（`OpenCodeViewProvider.viewType`、命令注册、README）
  - 修复本环境 `PATH` 不含 `/usr/local/bin` 导致脚本找不到 `pnpm/node` 的执行问题（通过运行时注入 PATH，不修改脚本）
  - 执行依赖安装并跑完 `./bin/build-and-install.sh` 全流程
- Files created/modified:
  - package.json（更新 view/command id + activationEvents）
  - src/OpenCodeViewProvider.ts（更新 viewType）
  - src/extension.ts（更新命令 id + OutputChannel 名称）
  - README.md（增加冲突说明）
  - docs/todos/style-improvements-amp-style.md（同步 id）
  - task_plan.md / findings.md / progress.md（更新记录）

## Session: 2026-02-09

### Fix: Webview 初始化断连（无需重启）

- **Status:** complete
- Actions taken:
  - 复现“首次打开视图显示已断开连接、必须重启窗口才恢复”的竞态：Webview `ready` 比 OpenCode server 启动更快，导致 `init` 消息缺少 `serverUrl` 被 Webview 忽略
  - 扩展侧在 `OpenCodeService.initialize()` 完成后，补发 `server-url` 消息，确保 Webview 在 server 就绪后能拿到 URL 并自动建立 SSE 连接
  - 为 `HostMessageSchema` 增加 `server-url` 类型，并补齐对应单测
- Files created/modified:
  - src/extension.ts（初始化完成后补发 `server-url`）
  - src/shared/messages.ts（新增 `server-url` 消息类型）
  - src/shared/messages.test.ts（新增测试用例）

## Session: 2026-02-13

### Fix: 首启等待就绪 + 断连禁发

- **Status:** complete
- Actions taken:
  - 将 `activate()` 调整为先等待 `openCodeService.initialize()` 完成，再注册/展示交互视图，满足“首次启动等待服务就绪”
  - 保留初始化失败时的错误上报，并通过 `provider.sendHostMessage({ type: "error" })` 向 Webview 透传
  - 将 `sync.isReady` 从“SDK 已创建”收敛为“SDK 已创建且 `status === connected`”，避免断连态发送导致“无响应”
  - 同步更新 README 技术特性说明
- Files created/modified:
  - src/extension.ts
  - src/webview/state/sync.tsx
  - README.md
  - task_plan.md / findings.md / progress.md

## Test Results
<!-- 
  WHAT: Table of tests you ran, what you expected, what actually happened.
  WHY: Documents verification of functionality. Helps catch regressions.
  WHEN: Update as you test features, especially during Phase 4 (Testing & Verification).
  EXAMPLE:
    | Add task | python todo.py add "Buy milk" | Task added | Task added successfully | ✓ |
    | List tasks | python todo.py list | Shows all tasks | Shows all tasks | ✓ |
-->
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| build-and-install | `PATH=/usr/local/bin:$PATH ./bin/build-and-install.sh` | 单测通过、构建成功、VSIX 打包成功并安装 | vitest 268/268 通过；vite 构建成功；vsce 产出 `ai-1.3.2.vsix` 并安装成功 | ✓ |
| build-and-install (server-url) | `PATH=/usr/local/bin:$PATH ./bin/build-and-install.sh` | 单测通过、构建成功、VSIX 打包成功并安装 | vitest 269/269 通过；vite 构建成功；vsce 产出 `ai-1.3.2.vsix` 并安装成功 | ✓ |
| build-and-install (startup-wait + connected-gating) | `PATH=/usr/local/bin:$PATH ./bin/build-and-install.sh` | 单测通过、构建成功、VSIX 打包成功并安装 | vitest 269/269 通过；vite 构建成功；vsce 产出 `ai-1.3.2.vsix` 并安装成功 | ✓ |
| build-and-install (worktree reconnect-flicker fix) | `./bin/build-and-install.sh` | 单测通过、构建成功、VSIX 打包成功并安装 | vitest 271/271 通过；vite 构建成功；vsce 产出 `ai-1.3.2.vsix` 并安装成功 | ✓ |
| e2e quick-check (worktree) | `pnpm exec playwright test --max-failures=1` | E2E 通过 | 首个用例失败：`ECONNREFUSED ::1:5199`（`tests/e2e/fixtures.ts:336` 打开 `/src/webview/standalone.html` 时目标端口未监听） | ✗ |

## Error Log
<!-- 
  WHAT: Detailed log of every error encountered, with timestamps and resolution attempts.
  WHY: More detailed than task_plan.md's error table. Helps you learn from mistakes.
  WHEN: Add immediately when an error occurs, even if you fix it quickly.
  EXAMPLE:
    | 2026-01-15 10:35 | FileNotFoundError | 1 | Added file existence check |
    | 2026-01-15 10:37 | JSONDecodeError | 2 | Added empty file handling |
-->
<!-- Keep ALL errors - they help avoid repetition -->
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
|           |       | 1       |            |
| 2026-02-13 15:50 | `ECONNREFUSED ::1:5199` (Playwright E2E) | 1 | 记录为环境/测试入口依赖问题；本次连接闪烁修复不涉及该链路 |

## 5-Question Reboot Check
<!-- 
  WHAT: Five questions that verify your context is solid. If you can answer these, you're on track.
  WHY: This is the "reboot test" - if you can answer all 5, you can resume work effectively.
  WHEN: Update periodically, especially when resuming after a break or context reset.
  
  THE 5 QUESTIONS:
  1. Where am I? → Current phase in task_plan.md
  2. Where am I going? → Remaining phases
  3. What's the goal? → Goal statement in task_plan.md
  4. What have I learned? → See findings.md
  5. What have I done? → See progress.md (this file)
-->
<!-- If you can answer these, context is solid -->
| Question | Answer |
|----------|--------|
| Where am I? | Phase X |
| Where am I going? | Remaining phases |
| What's the goal? | [goal statement] |
| What have I learned? | See findings.md |
| What have I done? | See above |

---
<!-- 
  REMINDER: 
  - Update after completing each phase or encountering errors
  - Be detailed - this is your "what happened" log
  - Include timestamps for errors to track when issues occurred
-->
*Update after completing each phase or encountering errors*

## Session: 2026-02-13（worktree: opencode-single-server）

### Fix: 首屏断连闪现（基于 worktree 复查）
- **Status:** complete
- Actions taken:
  - 在 `.worktrees/opencode-single-server` 重新分析状态时序，确认首帧 `disconnected` 误报根因
  - 修改 `src/webview/state/types.ts` 初始状态为 `connecting`
  - 新增 `src/webview/state/types.test.ts` 单测（2 case）
  - 同步更新 `README.md` 技术特性说明
  - 执行 `./bin/build-and-install.sh`，完成单测、构建、打包、安装全链路验证
- Files created/modified:
  - src/webview/state/types.ts
  - src/webview/state/types.test.ts
  - README.md

### Session: 2026-02-13（E2E修复）
- **Status:** complete
- Actions taken:
  - 复核 `playwright.config.ts` 与 `tests/e2e/fixtures.ts`
  - 定位失败为 `localhost` 在浏览器侧走 `::1` 导致连接拒绝
  - 清理 `fixtures.ts` 中临时调试代码（`debug-standalone.html` 落盘与 runtime debug 日志）
  - 修复 `opencodeServer` 启动抖动：将 runtime 目录改为按 worker 持久复用（`/tmp/paperstack-e2e-runtime/worker-*`）
  - 将 `startOpenCodeServer` 的 URL 检测超时从 `30s` 提升到 `120s`
  - 先执行 `attachments.spec.ts` 定向回归，再执行全量 `pnpm test:e2e`
  - 执行 `./bin/build-and-install.sh` 完成最终验收
- Files created/modified:
  - tests/e2e/fixtures.ts
  - task_plan.md
  - findings.md
  - progress.md

## Session: 2026-02-13（E2E修复回归记录）

## Test Results (追加)
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| e2e attachments targeted | `pnpm exec playwright test tests/e2e/attachments.spec.ts --reporter=line` | 7 条附件相关用例通过 | 7 passed | ✓ |
| e2e full regression | `pnpm test:e2e` | 全量 e2e 通过 | 31 passed, 6 skipped | ✓ |
| build-and-install (post e2e fix) | `./bin/build-and-install.sh` | 单测通过、构建成功、VSIX 打包并安装成功 | vitest 271/271；build 成功；`ai-1.3.2.vsix` 打包并安装成功 | ✓ |

## Error Log (追加)
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-02-13 17:18 | Playwright fixture 初始化偶发超时（`opencodeServer` setup） | 2 | runtime cache 改为 worker 持久目录 + server URL 等待超时提高到 120s，随后回归通过 |

## Session: 2026-02-13（单进程连接成功但历史为空）

### Fix: worktree 目录回退 + 冗余过滤清理
- **Status:** complete
- Actions taken:
  - 复核未提交改动并定位根因：`bootstrap` 目录精确过滤 + `App` 二次目录过滤叠加导致历史为空。
  - 在 `src/webview/state/bootstrap.ts` 增加 worktree 回退策略（`/.worktrees/<name>` -> 父仓库目录）。
  - 在 `src/webview/App.tsx` 删除冗余 `s.directory === workspaceRoot` 过滤逻辑。
  - 在 `src/OpenCodeService.ts` 删除临时调试堆栈日志输出。
  - 新增 `tests/frontend/bootstrap.test.ts` 用例覆盖 worktree 回退行为。
- Files created/modified:
  - src/webview/state/bootstrap.ts
  - src/webview/App.tsx
  - src/OpenCodeService.ts
  - tests/frontend/bootstrap.test.ts
  - task_plan.md / findings.md / progress.md

## Test Results (追加)
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| vitest focused (worktree fallback) | `pnpm exec vitest run tests/frontend/bootstrap.test.ts -t "falls back to repo directory when worktree scoped data is empty"` | 新增回退用例通过 | 1 passed, 5 skipped | ✓ |
| vitest focused (types) | `pnpm exec vitest run src/webview/state/types.test.ts` | 状态初始化单测通过 | 2 passed | ✓ |
| build-and-install (final) | `./bin/build-and-install.sh` | 单测通过、构建成功、VSIX 安装成功 | vitest 271/271；build 成功；VSIX 打包并安装成功 | ✓ |
