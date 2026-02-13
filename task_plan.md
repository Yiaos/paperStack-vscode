# Task Plan: 修复 OpenCode 进程重复启动（port=0 异常进程）
<!-- 
  WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk."
  WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh.
  WHEN: Create this FIRST, before starting any work. Update after each phase completes.
-->

## Goal
<!-- 
  WHAT: One clear sentence describing what you're trying to achieve.
  WHY: This is your north star. Re-reading this keeps you focused on the end state.
  EXAMPLE: "Create a Python CLI todo app with add, list, and delete functionality."
-->
打开插件时仅启动单个 OpenCode 服务进程（固定端口策略/可复用策略），不再出现 `--port=0` 的多余进程。

## Current Phase
<!-- 
  WHAT: Which phase you're currently working on (e.g., "Phase 1", "Phase 3").
  WHY: Quick reference for where you are in the task. Update this as you progress.
-->
Phase 5

## Phases
<!-- 
  WHAT: Break your task into 3-7 logical phases. Each phase should be completable.
  WHY: Breaking work into phases prevents overwhelm and makes progress visible.
  WHEN: Update status after completing each phase: pending → in_progress → complete
-->

### Phase 1: Requirements & Discovery
<!-- 
  WHAT: Understand what needs to be done and gather initial information.
  WHY: Starting without understanding leads to wasted effort. This phase prevents that.
-->
- [x] Understand user intent
- [x] Identify constraints and requirements
- [x] Document findings in findings.md
- **Status:** complete
<!-- 
  STATUS VALUES:
  - pending: Not started yet
  - in_progress: Currently working on this
  - complete: Finished this phase
-->

### Phase 2: Planning & Structure
<!-- 
  WHAT: Decide how you'll approach the problem and what structure you'll use.
  WHY: Good planning prevents rework. Document decisions so you remember why you chose them.
-->
- [x] Analyze upstream/opencode official implementation to learn expected server lifecycle
- [x] Define technical approach to prevent duplicate server processes
- [x] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation
<!-- 
  WHAT: Actually build/create/write the solution.
  WHY: This is where the work happens. Break into smaller sub-tasks if needed.
-->
- [x] Implement minimal, low-intrusion fix in extension server lifecycle
- [x] Keep changes localized to OpenCodeService/activation flow
- [x] Add/adjust tests if needed (new feature → add tests)
- **Status:** complete

### Phase 4: Testing & Verification
<!-- 
  WHAT: Verify everything works and meets requirements.
  WHY: Catching issues early saves time. Document test results in progress.md.
-->
- [x] Run `./bin/build-and-install.sh`
- [x] Document test results in progress.md
- [x] Fix any issues found
- **Status:** complete

### Phase 5: Delivery
<!-- 
  WHAT: Final review and handoff to user.
  WHY: Ensures nothing is forgotten and deliverables are complete.
-->
- [x] Update README.md with behavior change
- [x] Summarize changes, reasons, and possible side effects
- [x] Deliver to user
- **Status:** complete

## Key Questions
<!-- 
  WHAT: Important questions you need to answer during the task.
  WHY: These guide your research and decision-making. Answer them as you go.
  EXAMPLE: 
    1. Should tasks persist between sessions? (Yes - need file storage)
    2. What format for storing tasks? (JSON file)
-->
1. 端口为 0 的进程是由哪个调用链触发的（扩展内/SDK/CLI）？
2. 上游 opencode web/官方实现如何管理 server 启动与复用？
3. 需要采用固定端口还是复用外部进程的策略？

## Decisions Made
<!-- 
  WHAT: Technical and design decisions you've made, with the reasoning behind them.
  WHY: You'll forget why you made choices. This table helps you remember and justify decisions.
  WHEN: Update whenever you make a significant choice (technology, approach, structure).
  EXAMPLE:
    | Use JSON for storage | Simple, human-readable, built-in Python support |
-->
| Decision | Rationale |
|----------|-----------|
| 将 view id/command id 从 `opencode.*` 改为 `paperstack.ai.*` | 与本机已安装的 `tanishqkancharla.opencode-vscode` 存在相同 id，导致 VSCode 同时激活两套扩展进而拉起两个 `opencode serve` 进程；命名空间化可彻底隔离冲突 |
| 为本扩展补齐 `activationEvents`（`onView`/`onCommand`） | 避免无关场景下激活扩展，且不再触发其他同名 onView/onCommand 的扩展激活链 |
| server 初始化完成后补发 `server-url` 消息给 Webview | 消除“Webview ready 早于 server 启动，导致首个 init 缺少 serverUrl 被忽略并永久断连”的竞态；避免要求用户重启窗口 |
| `activate` 阶段同步等待 `OpenCodeService.initialize` 完成 | 首次进入插件时先确保后端可用，避免用户先看到 disconnected/reconnect 状态 |
| 前端可交互状态收敛为 `status=connected` | 避免 SSE 断连时仍允许发消息导致“发送无响应” |

## Errors Encountered
<!-- 
  WHAT: Every error you encounter, what attempt number it was, and how you resolved it.
  WHY: Logging errors prevents repeating the same mistakes. This is critical for learning.
  WHEN: Add immediately when an error occurs, even if you fix it quickly.
  EXAMPLE:
    | FileNotFoundError | 1 | Check if file exists, create empty list if not |
    | JSONDecodeError | 2 | Handle empty file case explicitly |
-->
| Error | Attempt | Resolution |
|-------|---------|------------|
| Playwright E2E `ECONNREFUSED ::1:5199` | 1 | 记录为当前环境的 e2e 入口依赖问题，已完成代码修复与 build/install 验证 |
| Playwright E2E `opencodeServer` 启动超时（fixtures 初始化阶段） | 2 | `tests/e2e/fixtures.ts` 改为 worker 级持久 runtime cache（避免每轮冷启动重复安装）并将 server URL 等待超时从 30s 提升到 120s |

## Notes
<!-- 
  REMINDERS:
  - Update phase status as you progress: pending → in_progress → complete
  - Re-read this plan before major decisions (attention manipulation)
  - Log ALL errors - they help avoid repetition
  - Never repeat a failed action - mutate your approach instead
-->
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition

## 2026-02-13 Worktree Addendum
- 已在 `.worktrees/opencode-single-server` 复现并确认“首屏已断开连接闪现”根因。
- 已完成最小修复（初始状态 `disconnected -> connecting`）并新增单测保护。
- 已执行 `./bin/build-and-install.sh`，结果通过。

## 2026-02-13 E2E Fix Plan (localhost/IPv6 连接失败)
- 目标：修复 Playwright E2E 中 `ECONNREFUSED ::1:5199`，使测试能稳定连接 Web 前端入口。
- 步骤：
  1) 统一 e2e Web server 与 `baseURL` 到 `127.0.0.1`，避免 `localhost -> ::1` 解析差异。
  2) 清理 fixture 中将 `127.0.0.1` 强制改写为 `localhost` 的逻辑，消除同类波动。
  3) 回归执行 `pnpm exec playwright test --max-failures=1` + `./bin/build-and-install.sh`。

## 2026-02-13 E2E 收敛结果（worktree）
- 已清理 `tests/e2e/fixtures.ts` 中临时调试落盘与运行时打印。
- 已完成 fixture 稳定性修复：
  1) OpenCode runtime 改为 `os.tmpdir()/paperstack-e2e-runtime/worker-<index>` 持久目录；
  2) server 首次 URL 检测超时由 30s 放宽到 120s。
- 验证结果：
  1) `pnpm exec playwright test tests/e2e/attachments.spec.ts --reporter=line` 通过（7/7）；
  2) `pnpm test:e2e` 通过（31 passed, 6 skipped）；
  3) `./bin/build-and-install.sh` 通过（vitest 271/271，构建、打包、安装成功）。

## 2026-02-13 Root Cause Fix（单进程已连通但无历史）
- 目标：修复“仅一个 `opencode serve --port=40960` 且连接成功，但会话/历史为空”。
- 实施步骤：
  1) 在 `src/webview/state/bootstrap.ts` 为 worktree 路径增加目录回退：当 `workspaceRoot` 查询为空时，回退到父仓库目录再拉取 session/status/permission。
  2) 在 `src/webview/App.tsx` 删除冗余的前端二次目录过滤（`s.directory === workspaceRoot`），避免把回退拿到的数据再次隐藏。
  3) 在 `src/OpenCodeService.ts` 删除临时调试栈日志，减少噪音与无效输出。
  4) 新增 `tests/frontend/bootstrap.test.ts` 回退单测并执行验证。
