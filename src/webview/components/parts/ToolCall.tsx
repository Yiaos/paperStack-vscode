/* @jsxImportSource solid-js */
import { Match, Show, Switch, createSignal } from "solid-js";
import type { ToolState as BaseToolState, MessagePart } from "../../types";

type ToolName =
  | "read"
  | "write"
  | "edit"
  | "web_search"
  | "webfetch"
  | "grep"
  | "glob"
  | "list"
  | "bash"
  | "todowrite"
  | "todoread"
  | "playwright_browser_navigate"
  | "playwright_browser_click"
  | "playwright_browser_type"
  | "playwright_browser_snapshot"
  | "playwright_browser_take_screenshot"
  | "clipboard_copy_selection"
  | "clipboard_cut_selection"
  | "clipboard_paste_clipboard"
  | "task"
  | "query_db"
  | "logs"
  | "enrich_profile";

type ReadInput = { filePath?: string; path?: string };
type WriteInput = { filePath?: string; path?: string };
type WebSearchInput = { query?: string };
type WebFetchInput = { url?: string };
type GrepInput = { pattern?: string };
type GlobInput = { pattern?: string };
type ListInput = { path?: string };
type BashInput = { command?: string; description?: string };
type PlaywrightNavigateInput = { url?: string };
type PlaywrightClickInput = { element?: string };
type PlaywrightTypeInput = { element?: string };
type ClipboardInput = { selection?: string };
type TaskInput = { description?: string };

type ToolInputMap = {
  read: ReadInput;
  write: WriteInput;
  edit: WriteInput;
  web_search: WebSearchInput;
  webfetch: WebFetchInput;
  grep: GrepInput;
  glob: GlobInput;
  list: ListInput;
  bash: BashInput;
  todowrite: Record<string, unknown>;
  todoread: Record<string, unknown>;
  playwright_browser_navigate: PlaywrightNavigateInput;
  playwright_browser_click: PlaywrightClickInput;
  playwright_browser_type: PlaywrightTypeInput;
  playwright_browser_snapshot: Record<string, unknown>;
  playwright_browser_take_screenshot: Record<string, unknown>;
  clipboard_copy_selection: ClipboardInput;
  clipboard_cut_selection: ClipboardInput;
  clipboard_paste_clipboard: ClipboardInput;
  task: TaskInput;
  query_db: Record<string, unknown>;
  logs: Record<string, unknown>;
  enrich_profile: Record<string, unknown>;
};

type ToolInput = ToolInputMap[ToolName] | Record<string, unknown>;

type ToolState = Omit<BaseToolState, "input"> & {
  input?: ToolInput;
};

// Icon components
const FileIcon = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
    <path
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="1.5"
      d="M7.75 19.25H16.25C17.3546 19.25 18.25 18.3546 18.25 17.25V9L14 4.75H7.75C6.64543 4.75 5.75 5.64543 5.75 6.75V17.25C5.75 18.3546 6.64543 19.25 7.75 19.25Z"
    ></path>
    <path
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="1.5"
      d="M18 9.25H13.75V5"
    ></path>
  </svg>
);

const FileDiffIcon = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
    <path
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="1.5"
      d="M7.75 19.25H16.25C17.3546 19.25 18.25 18.3546 18.25 17.25V9L14 4.75H7.75C6.64543 4.75 5.75 5.64543 5.75 6.75V17.25C5.75 18.3546 6.64543 19.25 7.75 19.25Z"
    ></path>
    <path
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="1.5"
      d="M18 9.25H13.75V5"
    ></path>
    <path
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="1.5"
      d="M9.75 15.25H14.25"
    ></path>
    <path
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="1.5"
      d="M9.75 12.25H14.25"
    ></path>
  </svg>
);

const GlobeIcon = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
    <circle
      cx="12"
      cy="12"
      r="7.25"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="1.5"
    ></circle>
    <path
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="1.5"
      d="M15.25 12C15.25 16.5 13.2426 19.25 12 19.25C10.7574 19.25 8.75 16.5 8.75 12C8.75 7.5 10.7574 4.75 12 4.75C13.2426 4.75 15.25 7.5 15.25 12Z"
    ></path>
    <path
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="1.5"
      d="M5 12H12H19"
    ></path>
  </svg>
);

const MagnifyingGlassIcon = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
    <path
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="1.5"
      d="M19.25 19.25L15.5 15.5M4.75 11C4.75 7.54822 7.54822 4.75 11 4.75C14.4518 4.75 17.25 7.54822 17.25 11C17.25 14.4518 14.4518 17.25 11 17.25C7.54822 17.25 4.75 14.4518 4.75 11Z"
    ></path>
  </svg>
);

const FolderIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    fill="none"
    viewBox="0 0 24 24"
  >
    <path
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="1.5"
      d="M4.75 18.25V7.75c0-1.105.918-2 2.05-2h1.368c.531 0 1.042.201 1.424.561l.932.878c.382.36.892.561 1.424.561h5.302a1 1 0 0 1 1 1v3m-13.5 6.5h12.812l1.642-5.206c.2-.635-.278-1.278-.954-1.294m-13.5 6.5 1.827-5.794c.133-.42.53-.706.98-.706H18.25"
    ></path>
  </svg>
);

const TerminalIcon = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
    <rect
      width="14.5"
      height="14.5"
      x="4.75"
      y="4.75"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="1.5"
      rx="2"
    ></rect>
    <path
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="1.5"
      d="M8.75 10.75L11.25 13L8.75 15.25"
    ></path>
  </svg>
);

const GenericToolIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M10.75 13.25V10.25H8.25V11.25C8.25 11.8023 7.80228 12.25 7.25 12.25H5.75C5.19772 12.25 4.75 11.8023 4.75 11.25V5.75C4.75 5.19772 5.19772 4.75 5.75 4.75H7.25C7.80228 4.75 8.25 5.19772 8.25 5.75V6.75H15C15 6.75 19.25 6.75 19.25 11.25C19.25 11.25 17 10.25 14.25 10.25V13.25M10.75 13.25H14.25M10.75 13.25V19.25M14.25 13.25V19.25"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    ></path>
  </svg>
);

const ChevronDownIcon = (props: { isOpen: boolean }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    style={{
      transform: props.isOpen ? "rotate(180deg)" : "rotate(0deg)",
      transition: "transform 0.2s ease",
    }}
  >
    <path
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="1.5"
      d="M15.25 10.75L12 14.25L8.75 10.75"
    ></path>
  </svg>
);

interface ToolCallProps {
  part: MessagePart;
  workspaceRoot?: string;
}

interface ToolDisplayInfo {
  icon: any;
  text: string;
  monospace: boolean;
  isLight?: boolean; // For todo tools
  isFilePath?: boolean; // For file paths that need special rendering
  dirPath?: string; // Directory part of the path
  fileName?: string; // File name part
}

function toRelativePath(absolutePath: string | undefined, workspaceRoot?: string): string | undefined {
  if (!absolutePath || !workspaceRoot) return absolutePath;
  
  // Ensure paths have consistent separators
  const normalizedAbsolute = absolutePath.replace(/\\/g, '/');
  const normalizedRoot = workspaceRoot.replace(/\\/g, '/');
  
  // Check if the path starts with the workspace root
  if (normalizedAbsolute.startsWith(normalizedRoot)) {
    let relativePath = normalizedAbsolute.slice(normalizedRoot.length);
    // Remove leading slash if present
    if (relativePath.startsWith('/')) {
      relativePath = relativePath.slice(1);
    }
    return relativePath || '.';
  }
  
  return absolutePath;
}

function splitFilePath(filePath: string): { dirPath: string; fileName: string } {
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  
  if (lastSlash === -1) {
    // No directory, just filename
    return { dirPath: '', fileName: filePath };
  }
  
  return {
    dirPath: filePath.substring(0, lastSlash + 1), // Include trailing slash
    fileName: filePath.substring(lastSlash + 1)
  };
}

function getToolDisplayInfo(
  tool: ToolName | string | undefined,
  state: ToolState,
  workspaceRoot?: string
): ToolDisplayInfo {
  if (!tool) return { icon: GenericToolIcon, text: "Tool", monospace: false };

  const inputs = state.input || {};

  switch (tool) {
    // File reads
    case "read": {
      const relativePath = toRelativePath(
        (inputs as ReadInput).filePath || (inputs as ReadInput).path,
        workspaceRoot
      );
      if (relativePath) {
        const { dirPath, fileName } = splitFilePath(relativePath);
        return {
          icon: FileIcon,
          text: relativePath,
          monospace: false,
          isFilePath: true,
          dirPath,
          fileName,
        };
      }
      return {
        icon: FileIcon,
        text: "Read file",
        monospace: false,
      };
    }

    // File writes/edits
    case "write":
    case "edit": {
      const relativePath = toRelativePath(
        (inputs as WriteInput).filePath || (inputs as WriteInput).path,
        workspaceRoot
      );
      if (relativePath) {
        const { dirPath, fileName } = splitFilePath(relativePath);
        return {
          icon: FileDiffIcon,
          text: relativePath,
          monospace: false,
          isFilePath: true,
          dirPath,
          fileName,
        };
      }
      return {
        icon: FileDiffIcon,
        text: "Edit file",
        monospace: false,
      };
    }

    // Web search
    case "web_search":
      return {
        icon: GlobeIcon,
        text: (inputs as WebSearchInput).query || "Search",
        monospace: false,
      };

    // Web fetch
    case "webfetch":
      return {
        icon: GlobeIcon,
        text: (inputs as WebFetchInput).url || "Fetch page",
        monospace: false,
      };

    // Grep/glob search
    case "grep":
      return {
        icon: MagnifyingGlassIcon,
        text: (inputs as GrepInput).pattern || "Search pattern",
        monospace: true,
      };

    case "glob":
      return {
        icon: MagnifyingGlassIcon,
        text: (inputs as GlobInput).pattern || "File pattern",
        monospace: true,
      };

    // List directory
    case "list":
      return {
        icon: FolderIcon,
        text: (inputs as ListInput).path || ".",
        monospace: true,
      };

    // Bash
    case "bash":
      return {
        icon: TerminalIcon,
        text:
          (inputs as BashInput).description ||
          (inputs as BashInput).command ||
          "Run command",
        monospace: true,
      };
    // Todo tools (lighter weight)
    case "todowrite":
    case "todoread":
      return {
        icon: null,
        text: tool === "todowrite" ? "Update todos" : "Read todos",
        monospace: false,
        isLight: true,
      };

    // Playwright browser tools
    case "playwright_browser_navigate":
      return {
        icon: GlobeIcon,
        text: (inputs as PlaywrightNavigateInput).url || "Navigate",
        monospace: false,
      };

    case "playwright_browser_click":
      return {
        icon: GenericToolIcon,
        text: `Click: ${(inputs as PlaywrightClickInput).element || "element"}`,
        monospace: false,
      };

    case "playwright_browser_type":
      return {
        icon: GenericToolIcon,
        text: `Type: ${(inputs as PlaywrightTypeInput).element || "element"}`,
        monospace: false,
      };

    case "playwright_browser_snapshot":
      return {
        icon: GenericToolIcon,
        text: "Take snapshot",
        monospace: false,
      };

    case "playwright_browser_take_screenshot":
      return {
        icon: GenericToolIcon,
        text: "Screenshot",
        monospace: false,
      };

    // Clipboard operations
    case "clipboard_copy_selection":
      return {
        icon: GenericToolIcon,
        text: `Copy: ${(inputs as ClipboardInput).selection || "selection"}`,
        monospace: true,
      };

    case "clipboard_cut_selection":
      return {
        icon: GenericToolIcon,
        text: `Cut: ${(inputs as ClipboardInput).selection || "selection"}`,
        monospace: true,
      };

    case "clipboard_paste_clipboard":
      return {
        icon: GenericToolIcon,
        text: `Paste: ${(inputs as ClipboardInput).selection || "location"}`,
        monospace: true,
      };

    // Task/agent
    case "task":
      return {
        icon: GenericToolIcon,
        text: (inputs as TaskInput).description || "Run task",
        monospace: false,
      };

    // Database
    case "query_db":
      return {
        icon: GenericToolIcon,
        text: "Database query",
        monospace: false,
      };

    case "logs":
      return {
        icon: GenericToolIcon,
        text: "Fetch logs",
        monospace: false,
      };

    // Profile enrichment
    case "enrich_profile":
      return {
        icon: GenericToolIcon,
        text: "Enrich profile",
        monospace: false,
      };

    // Default
    default:
      return {
        icon: GenericToolIcon,
        text: state.title || tool,
        monospace: false,
      };
  }
}

export function ToolCall(props: ToolCallProps) {
  const tool = props.part.tool as ToolName | string | undefined;
  const state = props.part.state as ToolState | undefined;
  if (!state) return null;

  const [isOpen, setIsOpen] = createSignal(false);
  const displayInfo = getToolDisplayInfo(tool, state, props.workspaceRoot);
  const Icon = displayInfo.icon;
  const hasOutput = !!(state.output || state.error);

  return (
    <Switch>
      <Match when={displayInfo.isLight}>
        <div class="tool-call-light">
          <span class="tool-text" style={{ "font-weight": "500" }}>
            {displayInfo.text}
          </span>
        </div>
      </Match>
      <Match when={!displayInfo.isLight}>
        <div class="tool-call">
          <div
            class="tool-header"
            onClick={() => hasOutput && setIsOpen(!isOpen())}
            style={{ cursor: hasOutput ? "pointer" : "default" }}
          >
            {Icon && <Icon />}
            <Show when={displayInfo.isFilePath} fallback={
              <span
                class="tool-text"
                style={{
                  "font-family": displayInfo.monospace ? "monospace" : "inherit",
                }}
              >
                {displayInfo.text}
              </span>
            }>
              <span class="tool-text tool-file-path">
                <span class="tool-file-dir">{displayInfo.dirPath}</span>
                <span class="tool-file-name">{displayInfo.fileName}</span>
              </span>
            </Show>
            {hasOutput && <ChevronDownIcon isOpen={isOpen()} />}
          </div>
          <Show when={hasOutput && isOpen()}>
            <pre class="tool-output">{state.error || state.output}</pre>
          </Show>
        </div>
      </Match>
    </Switch>
  );
}
