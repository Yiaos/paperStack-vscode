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
|          |           |

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
|       |            |

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
