# Project Status

## Goal

Build a VSCode sidebar extension for OpenCode that provides a UI similar to the Amp screenshot - a simple chat interface with input box, thinking indicator, and message history.

## Current State

✅ **Working Implementation**

We have a functional OpenCode integration with:

- Chat UI with input box and message history
- OpenCode server running embedded in the extension
- Session management and prompt handling
- Real-time thinking indicator
- Full TypeScript type safety with proper SDK types

## What Works

- Extension loads and activates correctly
- OpenCode SDK (`@opencode-ai/sdk`) integrated via ESM with Vite bundling
- OpenCode server starts automatically on extension activation
- Workspace `opencode.json` configuration is loaded and used
- Session creation and management
- Sending prompts and receiving AI responses
- Message history display (user and assistant messages)
- Thinking indicator during AI processing
- Error handling and display
- VSCode theme integration for UI styling
- Vite bundling for both extension and webview

## Architecture

Extension side (TypeScript/ESM):

- src/extension.ts: Entry point, initializes OpenCodeService and registers webview provider
- src/OpenCodeService.ts: Manages OpenCode client/server lifecycle, handles sessions and prompts
- src/OpenCodeViewProvider.ts: WebviewViewProvider implementation, message passing between UI and service

Webview side (React + TypeScript):

- src/webview/App.tsx: Chat UI component with input, message history, and thinking indicator
- src/webview/App.css: Styles using VSCode CSS variables for theming

Build system:

- vite.config.extension.ts: Vite config for extension (CJS output, Node.js target)
- vite.config.ts: Vite config for webview (ESM, React)
- Both bundle to respective output directories (dist/ and out/)

## OpenCode Integration Details

The extension uses `@opencode-ai/sdk` which provides:

- `createOpencode()`: Starts both server and client in a single call
- Full TypeScript types for sessions, messages, config, etc.
- HTTP/REST API communication between client and server
- Server runs on localhost with random port

Configuration flow:

1. Extension reads workspace `opencode.json` if present
2. Falls back to user's global config at `~/.config/opencode/opencode.json`
3. Passes config to `createOpencode()` which applies it

Message flow:

1. User types in webview input box
2. Webview sends message to extension via `postMessage`
3. Extension calls `OpenCodeService.sendPrompt()`
4. Service creates session if needed, sends prompt to OpenCode server
5. Response comes back, extracted text parts sent to webview
6. Webview displays response in message history

## What's Missing

- Real-time streaming of responses (currently waits for full response)
- File attachments and context from workspace
- Advanced UI features (markdown rendering, code highlighting)
- Settings UI for configuration
- Multi-session support in UI
- Undo/redo functionality
- Session persistence across extension reloads

## Technical Notes

- Extension is ESM-based, bundled with Vite to CommonJS for VSCode compatibility
- SDK types are properly imported and used throughout (no `any` types)
- OpenCode server runs in the extension host process
- Server URL is localhost with random port (not exposed to user)
- Webview and extension communicate via typed message passing
- CSP configured for webview security

## Development Workflow

1. Run `npm run watch` to start watch mode for both extension and webview
2. Press F5 to launch Extension Development Host
3. Extension code changes: Reload window (Cmd+R)
4. Webview changes: Hot reload automatically

Build for production: `npm run build`

## Publishing

To publish a new version, always use:

```bash
npm run publish
```

This publishes to both VS Code Marketplace and Open VSX. Requires:
- VS Code Marketplace PAT (login with `npx vsce login TanishqKancharla`)
- Open VSX key in `.env` as `OPEN_VSX_KEY`

Azure DevOps for PAT management: https://dev.azure.com/tanishqk/

## Debugging

Extension logs:

- Output panel: Command Palette → "Output" → Select "OpenCode" from dropdown
- Log files: the extension writes logs to this file: '/Users/tanishqkancharla/Library/Application Support/Cursor/logs/20251009T174918/window50/exthost/opencode.opencode-vscode/OpenCode.log'

## API Configuration Required

For the extension to work, users need:

1. OpenCode API key configured via `opencode auth login`
2. Or API keys for their chosen provider (Anthropic, OpenAI, etc.)

The extension will show an error if OpenCode cannot connect to the AI provider.
