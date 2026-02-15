import { createSignal, createMemo, Show, onMount, onCleanup, createEffect, For } from "solid-js";
import { InputBar } from "./components/InputBar";
import { MessageList } from "./components/MessageList";
import { TopBar } from "./components/TopBar";
import { SettingsDrawer } from "./components/SettingsDrawer";
import { LoadingOverlay } from "./components/LoadingOverlay";
import { ContextIndicator } from "./components/ContextIndicator";
import { FileChangesSummary } from "./components/FileChangesSummary";
import { PermissionPrompt } from "./components/PermissionPrompt";
import { useOpenCode, type PromptPartInput } from "./hooks/useOpenCode";
import { useSync } from "./state/sync";
import type { FilePartInput } from "@opencode-ai/sdk/v2/client";
import type { Message, Agent, Session, Permission, FileChangesInfo, MessagePart, MentionItem } from "./types";
import { parseHostMessage } from "./types";

export interface QueuedMessage {
  id: string;
  text: string;
  agent: string | null;
  attachments: SelectionAttachment[];
}

// In-flight message tracking for the outbox
interface InFlightMessage {
  messageID: string;
  sessionId: string;
}
interface SelectionAttachment {
  id: string;
  filePath: string;
  fileUrl: string;
  startLine?: number;
  endLine?: number;
}

interface MentionSearchResult {
  requestId: string;
  items: MentionItem[];
}
import { vscode } from "./utils/vscode";
import { Id } from "./utils/id";
import { logger } from "./utils/logger";

const NEW_SESSION_KEY = "__new__";

function App() {
  // Use the sync context for server-owned state
  const sync = useSync();

  // Local UI-only state
  const [defaultAgent, setDefaultAgent] = createSignal<string | null>(null);
  const [drafts, setDrafts] = createSignal<Map<string, string>>(new Map());
  const [sessionAgents, setSessionAgents] = createSignal<Map<string, string>>(new Map());
  const [selectionAttachmentsBySession, setSelectionAttachmentsBySession] = createSignal<
    Map<string, SelectionAttachment[]>
  >(new Map());
  const [mentionSearchResult, setMentionSearchResult] = createSignal<MentionSearchResult | null>(null);

  // Editing state for previous messages
  const [editingMessageId, setEditingMessageId] = createSignal<string | null>(null);
  const [editingText, setEditingText] = createSignal<string>("");

  // Message queue for queuing messages while generating
  const [messageQueue, setMessageQueue] = createSignal<QueuedMessage[]>([]);

  // Settings drawer state
  const [settingsOpen, setSettingsOpen] = createSignal(false);

  // 状态条关闭状态
  const [statusBannerDismissed, setStatusBannerDismissed] = createSignal(false);

  // In-flight message tracking for outbox pattern
  const [inFlightMessage, setInFlightMessage] = createSignal<InFlightMessage | null>(null);

  // History visible state
  const [historyOpen, setHistoryOpen] = createSignal(false);

  // Get SDK hook for actions only
  const {
    initData,
    createSession,
    abortSession,
    sendPrompt,
    respondToPermission,
    revertToMessage,
    hostError,
    clearHostError,
    updateSession,
    deleteSession,
    copyToClipboard,
    exportSession,
    getMessages,
  } = useOpenCode();

  // Get the current session key for drafts/agents
  const sessionKey = () => sync.currentSessionId() || NEW_SESSION_KEY;

  // Derive current session title from store
  const isDefaultTitle = (title: string) => /^(New session|Child session) - \d{4}-\d{2}-\d{2}T/.test(title);
  const currentSessionTitle = createMemo(() => {
    const id = sync.currentSessionId();
    if (!id) return "New Session";
    const sessions = sync.sessions();
    const session = sessions.find(s => s.id === id);
    const title = session?.title;
    return title && !isDefaultTitle(title) ? title : "New Session";
  });

  // Current input for the active session
  const input = () => drafts().get(sessionKey()) || "";
  const setInput = (value: string) => {
    const key = sessionKey();
    setDrafts((prev) => {
      const next = new Map(prev);
      next.set(key, value);
      return next;
    });
  };

  // Current agent for the active session
  const selectedAgent = () => sessionAgents().get(sessionKey()) || defaultAgent();
  const setSelectedAgent = (agent: string | null) => {
    if (!agent) return;
    const key = sessionKey();
    setSessionAgents((prev) => {
      const next = new Map(prev);
      next.set(key, agent);
      return next;
    });
  };

  // Convenience accessors from sync store
  const messages = () => sync.messages();
  const agents = () => sync.agents();
  const sessions = () => sync.sessions();
  const pendingPermissions = () => sync.aggregatedPermissions();
  const contextInfo = () => sync.contextInfo();
  const fileChanges = () => sync.fileChanges();
  const isThinking = () => sync.isThinking();
  const sessionError = () => sync.sessionError();
  const canRetry = () => !isThinking() && !inFlightMessage();

  const selectionAttachments = () => selectionAttachmentsBySession().get(sessionKey()) || [];
  const setSelectionAttachmentsForKey = (
    key: string,
    value: SelectionAttachment[] | ((prev: SelectionAttachment[]) => SelectionAttachment[])
  ) => {
    setSelectionAttachmentsBySession((prev) => {
      const next = new Map(prev);
      const current = next.get(key) || [];
      const updated = typeof value === "function" ? value(current) : value;
      next.set(key, updated);
      return next;
    });
  };
  const setSelectionAttachments = (
    value: SelectionAttachment[] | ((prev: SelectionAttachment[]) => SelectionAttachment[])
  ) => {
    setSelectionAttachmentsForKey(sessionKey(), value);
  };

  const getFilename = (filePath: string) => {
    const normalized = filePath.replace(/\\/g, "/");
    const parts = normalized.split("/");
    return parts[parts.length - 1] || filePath;
  };

  const formatSelectionLabel = (attachment: SelectionAttachment) => {
    const filename = getFilename(attachment.filePath);
    if (attachment.startLine && attachment.endLine && attachment.startLine !== attachment.endLine) {
      return `${filename} L${attachment.startLine}-${attachment.endLine}`;
    }
    if (attachment.startLine) {
      return `${filename} L${attachment.startLine}`;
    }
    return filename;
  };

  const buildSelectionParts = (attachments: SelectionAttachment[]): FilePartInput[] => {
    return attachments.map((attachment) => {
      const url = new URL(attachment.fileUrl);

      if (attachment.startLine !== undefined) {
        const start = attachment.endLine
          ? Math.min(attachment.startLine, attachment.endLine)
          : attachment.startLine;
        const end = attachment.endLine
          ? Math.max(attachment.startLine, attachment.endLine)
          : attachment.startLine;
        url.searchParams.set("start", String(start));
        url.searchParams.set("end", String(end));
      }

      return {
        type: "file" as const,
        mime: "text/plain",
        url: url.toString(),
        filename: getFilename(attachment.filePath),
        source: {
          type: "file" as const,
          path: attachment.filePath,
          text: {
            value: "",
            start: 0,
            end: 0,
          },
        },
      };
    });
  };

  const attachmentChips = createMemo(() =>
    selectionAttachments().map((attachment) => ({
      id: attachment.id,
      label: formatSelectionLabel(attachment),
      title: attachment.filePath,
    }))
  );

  const hasMessages = createMemo(() =>
    messages().some((m) => m.type === "user" || m.type === "assistant")
  );

  // Find permissions that should show as standalone modals (not inline with tools)
  const standalonePermissions = createMemo(() => {
    const result: Permission[] = [];
    for (const [, perm] of pendingPermissions().entries()) {
      if (!perm.tool) {
        result.push(perm);
      }
    }
    return result;
  });

  const sessionsToShow = createMemo(() => {
    return sessions()
      .filter(s => {
        // Only list sessions with primary agents (no parentID)
        if (s.parentID) return false;
        return true;
      })
      // Sort by edited time (updated) instead of started time (created)
      .sort((a, b) => b.time.updated - a.time.updated);
  });

  onMount(() => {
    const handleHostMessage = (event: MessageEvent) => {
      const parsed = parseHostMessage(event.data);
      if (!parsed) return;

      if (parsed.type === "mention-results") {
        setMentionSearchResult({
          requestId: parsed.requestId,
          items: parsed.items,
        });
        return;
      }

      if (parsed.type === "editor-selection") {
        const startLine = parsed.selection?.startLine;
        const endLine = parsed.selection?.endLine ?? startLine;
        const normalizedStart =
          startLine !== undefined && endLine !== undefined ? Math.min(startLine, endLine) : startLine;
        const normalizedEnd =
          startLine !== undefined && endLine !== undefined ? Math.max(startLine, endLine) : endLine;

        setSelectionAttachments((prev) => {
          if (
            prev.some(
              (item) =>
                item.fileUrl === parsed.fileUrl &&
                item.startLine === normalizedStart &&
                item.endLine === normalizedEnd
            )
          ) {
            return prev;
          }
          return [
            ...prev,
            {
              id: crypto.randomUUID(),
              filePath: parsed.filePath,
              fileUrl: parsed.fileUrl,
              startLine: normalizedStart,
              endLine: normalizedEnd,
            },
          ];
        });
      }
    };

    window.addEventListener("message", handleHostMessage);
    onCleanup(() => window.removeEventListener("message", handleHostMessage));
  });

  // Set default agent from initData once available
  createEffect(() => {
    const init = initData();
    if (!init) return;

    const agentList = agents();
    const persistedDefault = init.defaultAgent;
    if (persistedDefault && agentList.some(a => a.name === persistedDefault)) {
      setDefaultAgent(persistedDefault);
    } else if (!defaultAgent() && agentList.length > 0) {
      setDefaultAgent(agentList[0].name);
    }
  });

  // Clear inFlightMessage when session becomes idle and trigger queue drain
  onMount(() => {
    const cleanup = sync.onSessionIdle((sessionId) => {
      const inflight = inFlightMessage();

      if (inflight?.sessionId !== sessionId) {
        return;
      }

      setInFlightMessage(null);

      // Schedule queue drain in a microtask to avoid interleaving with SSE batch
      queueMicrotask(() => {
        void processNextQueuedMessage();
      });
    });
    onCleanup(cleanup);
  });

  // Handlers
  const handleSubmit = async () => {
    const text = input().trim();
    if (!text || !sync.isReady()) {
      return;
    }

    const agent = agents().some((a) => a.name === selectedAgent())
      ? selectedAgent()
      : null;
    const attachmentsKey = sessionKey();
    const attachments = selectionAttachments();
    const extraParts = buildSelectionParts(attachments);

    // Generate sortable client-side messageID for idempotent sends
    const messageID = Id.ascending("message");

    // Ensure we have a session
    let sessionId = sync.currentSessionId();
    if (!sessionId) {
      try {
        const res = await createSession();
        const newSession = res?.data as Session | undefined;
        if (!newSession?.id) {
          console.error("[App] Failed to create session");
          return;
        }
        sessionId = newSession.id;
        sync.setCurrentSessionId(sessionId);
      } catch (err) {
        console.error("[App] Failed to create session:", err);
        return;
      }
    }

    setInput("");
    sync.setThinking(sessionId, true);

    // Track this message as in-flight
    setInFlightMessage({ messageID, sessionId });

    logger.info("Sending prompt", { sessionId, messageID, textLen: text.length });

    try {
      const result = await sendPrompt(sessionId, text, agent, extraParts, messageID);

      // Log the full result for debugging
      logger.info("sendPrompt result", {
        hasError: !!result?.error,
        hasData: !!result?.data,
        response: result?.response?.status,
      });

      // Check for SDK error in result (SDK doesn't throw by default)
      if (result?.error) {
        // Log full error structure for debugging
        logger.error("sendPrompt returned error", {
          error: result.error,
          response: result?.response,
        });

        // Extract error message from nested structure: result.error may be { error: { data: { message } } } or { data: { message } }
        const errorData = result.error as { data?: { message?: string }; error?: { data?: { message?: string } } };
        const errorMessage =
          errorData.data?.message ||
          errorData.error?.data?.message ||
          (typeof errorData === 'string' ? errorData : JSON.stringify(errorData)) ||
          "Unknown error";
        sync.setThinking(sessionId, false);
        setInFlightMessage(null);
        sync.setSessionError(sessionId, errorMessage);
        return;
      }

      if (attachments.length > 0) {
        setSelectionAttachmentsForKey(attachmentsKey, []);
      }
    } catch (err) {
      logger.error("sendPrompt exception", { error: String(err), stack: (err as Error).stack });
      const errorMessage = (err as Error).message;

      // Show all errors inline and clear in-flight
      sync.setThinking(sessionId, false);
      setInFlightMessage(null);
      sync.setSessionError(sessionId, errorMessage);
    }
  };

  const processNextQueuedMessage = async () => {
    const queue = messageQueue();
    const inflight = inFlightMessage();
    const sessionId = sync.currentSessionId();

    if (queue.length === 0) {
      return;
    }

    // Don't process if there's already an in-flight message
    if (inflight) {
      return;
    }

    if (!sessionId || !sync.isReady()) {
      return;
    }

    const [next, ...rest] = queue;

    // Generate a FRESH messageID right before sending to ensure it's newer than the last assistant message
    // This is critical - IDs generated earlier (when queueing) will be older than assistant responses
    const messageID = Id.ascending("message");

    setMessageQueue(rest);
    sync.setThinking(sessionId, true);

    // Track this queued message as in-flight using the fresh messageID
    setInFlightMessage({ messageID, sessionId });

    try {
      const extraParts = buildSelectionParts(next.attachments);

      const result = await sendPrompt(sessionId, next.text, next.agent, extraParts, messageID);

      // Check for SDK error in result (SDK doesn't throw by default)
      if (result?.error) {
        const errorData = result.error as { data?: { message?: string }; error?: { data?: { message?: string } } };
        const errorMessage =
          errorData.data?.message ||
          errorData.error?.data?.message ||
          (typeof errorData === 'string' ? errorData : JSON.stringify(errorData)) ||
          "Unknown error";
        sync.setThinking(sessionId, false);
        setInFlightMessage(null);
        setMessageQueue([]);
        sync.setSessionError(sessionId, errorMessage);
        return;
      }
    } catch (err) {
      console.error("[App] Queue sendPrompt failed:", err);
      const errorMessage = (err as Error).message;

      // Show all errors inline and clear queue + in-flight
      sync.setThinking(sessionId, false);
      setInFlightMessage(null);
      setMessageQueue([]);
      sync.setSessionError(sessionId, errorMessage);
    }
  };

  const handleQueueMessage = () => {
    const text = input().trim();
    if (!text || !sync.isReady()) return;

    const agent = agents().some((a) => a.name === selectedAgent())
      ? selectedAgent()
      : null;
    const attachmentsKey = sessionKey();
    const attachments = selectionAttachments();

    // Queue the message without a messageID - we'll generate it fresh when sending
    const queuedMessage: QueuedMessage = {
      id: crypto.randomUUID(),
      text,
      agent,
      attachments,
    };

    setMessageQueue((prev) => [...prev, queuedMessage]);
    setInput("");
    if (attachments.length > 0) {
      setSelectionAttachmentsForKey(attachmentsKey, []);
    }
  };

  const handleRemoveFromQueue = (id: string) => {
    setMessageQueue((prev) => prev.filter((m) => m.id !== id));
  };

  const handleEditQueuedMessage = (id: string) => {
    const queue = messageQueue();
    const index = queue.findIndex((m) => m.id === id);
    if (index === -1) return;

    const message = queue[index];
    // Remove this message and all after it
    setMessageQueue(queue.slice(0, index));
    // Put the message text in the input
    setInput(message.text);
    setSelectionAttachments(message.attachments);
    // Set the agent if different
    if (message.agent) {
      setSelectedAgent(message.agent);
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setSelectionAttachments((prev) => prev.filter((item) => item.id !== id));
  };

  const handleMentionSearch = (query: string, requestId: string, limit = 20) => {
    vscode.postMessage({
      type: "mention-search",
      requestId,
      query,
      limit,
    });
  };

  const handleMentionSelect = (item: MentionItem) => {
    setSelectionAttachments((prev) => {
      if (prev.some((entry) => entry.fileUrl === item.fileUrl)) {
        return prev;
      }

      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          filePath: item.filePath,
          fileUrl: item.fileUrl,
        },
      ];
    });
  };

  const handleSessionSelect = async (sessionId: string) => {
    if (!sync.isReady()) return;

    // Clear local UI state
    setMessageQueue([]);
    setInFlightMessage(null);
    setEditingMessageId(null);
    setEditingText("");

    // Set session and bootstrap to load messages
    await sync.switchSession(sessionId);
  };

  const handleNewSession = async () => {
    if (!sync.isReady()) return;
    try {
      const res = await createSession();
      const newSession = res?.data as Session | undefined;
      if (!newSession?.id) return;

      // Clear local UI state
      setMessageQueue([]);
      setInFlightMessage(null);
      setEditingMessageId(null);
      setEditingText("");

      // Set new session and bootstrap
      sync.setCurrentSessionId(newSession.id);
      await sync.bootstrap();
    } catch (err) {
      console.error("[App] Failed to create session:", err);
    }
  };

  const handleCancel = async () => {
    const sessionId = sync.currentSessionId();
    if (!sync.isReady() || !sessionId) return;
    try {
      await abortSession(sessionId);
    } finally {
      sync.setThinking(sessionId, false);
      setInFlightMessage(null);
    }
  };

  const handleAgentChange = (agent: string | null) => {
    setSelectedAgent(agent);
    // Persist as global default for new sessions
    if (agent && !sync.currentSessionId()) {
      vscode.postMessage({ type: "agent-changed", agent });
    }
  };

  const handleStartEdit = (messageId: string, text: string) => {
    setEditingMessageId(messageId);
    setEditingText(text);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText("");
  };

  const handleSubmitEdit = async (newText: string) => {
    const messageId = editingMessageId();
    const sessionId = sync.currentSessionId();
    if (!messageId || !sessionId || !newText.trim() || !sync.isReady()) return;

    const agent = agents().some((a) => a.name === selectedAgent())
      ? selectedAgent()
      : null;

    // Generate sortable client-side messageID for the new prompt
    const newMessageID = Id.ascending("message");

    sync.setThinking(sessionId, true);
    setEditingMessageId(null);
    setEditingText("");

    // Track this as in-flight
    setInFlightMessage({ messageID: newMessageID, sessionId });

    try {
      await revertToMessage(sessionId, messageId);
      const result = await sendPrompt(sessionId, newText.trim(), agent, [], newMessageID);

      // Check for SDK error in result (SDK doesn't throw by default)
      if (result?.error) {
        const errorData = result.error as { data?: { message?: string }; error?: { data?: { message?: string } } };
        const errorMessage =
          errorData.data?.message ||
          errorData.error?.data?.message ||
          (typeof errorData === 'string' ? errorData : JSON.stringify(errorData)) ||
          "Unknown error";
        sync.setThinking(sessionId, false);
        setInFlightMessage(null);
        sync.setSessionError(sessionId, `Error editing message: ${errorMessage}`);
        return;
      }
    } catch (err) {
      console.error("[App] Failed to edit message:", err);
      const errorMessage = (err as Error).message;

      // Show all errors inline and clear in-flight
      sync.setThinking(sessionId, false);
      setInFlightMessage(null);
      sync.setSessionError(sessionId, `Error editing message: ${errorMessage}`);
    }
  };

  const handlePermissionResponse = async (
    permissionId: string,
    response: "once" | "always" | "reject"
  ) => {
    const perms = pendingPermissions();
    let permission: Permission | undefined;
    for (const [, perm] of perms.entries()) {
      if (perm.id === permissionId) {
        permission = perm;
        break;
      }
    }

    const sessionId = permission?.sessionID || sync.currentSessionId();
    if (!sessionId || !sync.isReady()) {
      console.error("[App] Cannot respond to permission: no session ID");
      return;
    }

    await respondToPermission(sessionId, permissionId, response);
    // Permission removal is handled by store via SSE events
  };

  // Refresh sessions - just re-bootstrap
  const refreshSessions = async () => {
    await sync.bootstrap();
  };

  // Session management handlers
  const handleRenameSession = async (sessionId: string, newTitle: string) => {
    try {
      await updateSession(sessionId, newTitle);
    } catch (err) {
      console.error("[App] Failed to rename session:", err);
      sync.setSessionError(sessionId, "Failed to rename session.");
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteSession(sessionId);
      // If we just deleted the current session, create a new one
      if (sync.currentSessionId() === sessionId) {
        const remaining = sessions().filter(s => s.id !== sessionId);
        if (remaining.length > 0) {
          await sync.switchSession(remaining[0].id);
        } else {
          await handleNewSession();
        }
      }
    } catch (err) {
      console.error("[App] Failed to delete session:", err);
      sync.setSessionError(sessionId, "Failed to delete session.");
    }
  };

  const handleExportSession = async (sessionId: string) => {
    try {
      const result = await getMessages(sessionId);
      if (result?.error) {
        sync.setSessionError(sessionId, "Failed to export session.");
        return;
      }
      const msgs = result?.data;
      if (!msgs || !Array.isArray(msgs)) return;

      const session = sessions().find(s => s.id === sessionId);
      const title = session?.title || "Untitled Session";
      const date = new Date().toISOString().slice(0, 10);

      let markdown = `# ${title}\n\n`;
      for (const item of msgs) {
        const msg = item.info;
        const role = msg.role === "user" ? "User" : "Assistant";
        const msgParts = item.parts;
        let text = "";
        if (msgParts && msgParts.length > 0) {
          text = msgParts
            .filter((p) => p.type === "text" && "text" in p && (p as { text?: string }).text)
            .map((p) => (p as { text: string }).text)
            .join("\n");
        }
        const msgText = (msg as { text?: string }).text;
        if (!text && msgText) {
          text = msgText;
        }
        if (!text) continue;
        markdown += `## ${role}\n\n${text}\n\n---\n\n`;
      }

      const safeName = title.replace(/[^a-zA-Z0-9\u4e00-\u9fff-_ ]/g, "").slice(0, 50);
      exportSession(markdown, `${safeName}-${date}.md`);
    } catch (err) {
      console.error("[App] Failed to export session:", err);
      sync.setSessionError(sessionId, "Failed to export session.");
    }
  };

  // Copy assistant message text to clipboard
  const handleCopyMessage = (text: string) => {
    copyToClipboard(text);
  };

  // Retry an assistant message — revert to the preceding user message, then re-send
  const handleRetryMessage = async (assistantMessageId: string) => {
    const sessionId = sync.currentSessionId();
    if (!sessionId || !sync.isReady()) return;
    if (!canRetry()) return;

    const msgs = messages();
    const idx = msgs.findIndex(m => m.id === assistantMessageId);
    if (idx < 1) return;

    // Find the preceding user message
    let userMsg: Message | undefined;
    for (let i = idx - 1; i >= 0; i--) {
      if (msgs[i].type === "user") {
        userMsg = msgs[i];
        break;
      }
    }
    if (!userMsg) return;

    // Get user message text from parts
    const userParts = sync.getParts(userMsg.id);
    let userText = userMsg.text || "";
    if (!userText && userParts.length > 0) {
      userText = userParts
        .filter(p => p.type === "text" && p.text && !(p as { synthetic?: boolean }).synthetic)
        .map(p => p.text as string)
        .join("\n");
    }
    if (!userText.trim()) return;

    const agent = agents().some((a) => a.name === selectedAgent())
      ? selectedAgent()
      : null;
    const newMessageID = Id.ascending("message");

    sync.setThinking(sessionId, true);
    setInFlightMessage({ messageID: newMessageID, sessionId });

    try {
      await revertToMessage(sessionId, userMsg.id);
      const result = await sendPrompt(sessionId, userText.trim(), agent, [], newMessageID);

      if (result?.error) {
        const errorData = result.error as { data?: { message?: string }; error?: { data?: { message?: string } } };
        const errorMessage =
          errorData.data?.message ||
          errorData.error?.data?.message ||
          (typeof errorData === 'string' ? errorData : JSON.stringify(errorData)) ||
          "Unknown error";
        sync.setThinking(sessionId, false);
        setInFlightMessage(null);
        sync.setSessionError(sessionId, `Retry failed: ${errorMessage}`);
      }
    } catch (err) {
      console.error("[App] Retry failed:", err);
      sync.setThinking(sessionId, false);
      setInFlightMessage(null);
      sync.setSessionError(sessionId, `Retry failed: ${(err as Error).message}`);
    }
  };

  return (
    <div class={`app ${hasMessages() ? "app--has-messages" : ""}`}>
      <Show when={sync.status().status !== "connected" && !statusBannerDismissed()}>
        <LoadingOverlay
          status={sync.status()}
          logoUri={initData()?.logoUri}
          onDismiss={() => setStatusBannerDismissed(true)}
          onReconnect={() => {
            setStatusBannerDismissed(false);
            sync.reconnect();
          }}
        />
      </Show>

      <Show when={hostError()}>
        <div class="error-banner">
          <span class="error-banner__message">{hostError()}</span>
          <button class="error-banner__dismiss" onClick={clearHostError} aria-label="Dismiss error">×</button>
        </div>
      </Show>

      <TopBar
        sessions={sessionsToShow()}
        currentSessionId={sync.currentSessionId()}
        currentSessionTitle={currentSessionTitle()}
        sessionStatus={sync.sessionStatus}
        onSessionSelect={handleSessionSelect}
        onNewSession={handleNewSession}
        onRefreshSessions={refreshSessions}
        onOpenSettings={() => setSettingsOpen(true)}
        onRenameSession={handleRenameSession}
        onDeleteSession={handleDeleteSession}
        onExportSession={handleExportSession}
        onToggleHistory={() => setHistoryOpen(!historyOpen())}
        isHistoryOpen={historyOpen()}
      />

      <SettingsDrawer
        isOpen={settingsOpen()}
        onClose={() => setSettingsOpen(false)}
      />

      <MessageList
        messages={messages()}
        isThinking={isThinking()}
        workspaceRoot={sync.workspaceRoot()}
        pendingPermissions={pendingPermissions}
        onPermissionResponse={handlePermissionResponse}
        editingMessageId={editingMessageId()}
        editingText={editingText()}
        onStartEdit={handleStartEdit}
        onCancelEdit={handleCancelEdit}
        onSubmitEdit={handleSubmitEdit}
        onEditTextChange={setEditingText}
        sessionError={sessionError()}
        onCopy={handleCopyMessage}
        onRetry={handleRetryMessage}
        canRetry={canRetry()}
        recentSessions={sessionsToShow()}
        onSessionSelect={(id) => {
          handleSessionSelect(id);
          setHistoryOpen(false);
        }}
        onViewAllSessions={() => setHistoryOpen(true)}
        showHistory={historyOpen()}
        onRenameSession={handleRenameSession}
        onDeleteSession={handleDeleteSession}
        onExportSession={handleExportSession}
        onCloseHistory={() => setHistoryOpen(false)}
      />

      <div class="input-status-row">
        <FileChangesSummary fileChanges={fileChanges()} />
      </div>

      <Show when={standalonePermissions().length > 0}>
        <div class="standalone-permissions">
          <For each={standalonePermissions()}>
            {(permission) => (
              <PermissionPrompt
                permission={permission}
                onResponse={handlePermissionResponse}
                workspaceRoot={sync.workspaceRoot()}
              />
            )}
          </For>
        </div>
      </Show>

      <InputBar
        value={input()}
        onInput={setInput}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        onQueue={handleQueueMessage}
        disabled={!sync.isReady()}
        isThinking={isThinking()}
        selectedAgent={selectedAgent()}
        agents={agents()}
        onAgentChange={handleAgentChange}
        queuedMessages={messageQueue()}
        onRemoveFromQueue={handleRemoveFromQueue}
        onEditQueuedMessage={handleEditQueuedMessage}
        attachments={attachmentChips()}
        onRemoveAttachment={handleRemoveAttachment}
        mentionSearchResult={mentionSearchResult()}
        onMentionSearch={handleMentionSearch}
        onMentionSelect={handleMentionSelect}
        contextInfo={contextInfo()}
      />
    </div>
  );
}

export default App;
