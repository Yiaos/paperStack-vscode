/**
 * Sync context for managing server state.
 * 
 * Uses createStore with nested objects keyed by ID for efficient updates.
 */

import {
  createSignal,
  createEffect,
  createMemo,
  onCleanup,
  batch,
  createContext,
  useContext,
  type ParentProps,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { useOpenCode, type Event, type SSEStatus } from "../hooks/useOpenCode";
import type { Message, Permission } from "../types";
import { type SyncState, type SyncStatus, createEmptyState } from "./types";
import { applyEvent, type EventHandlerContext } from "./eventHandlers";
import { fetchBootstrapData, commitBootstrapData, fetchSessionData, commitSessionData } from "./bootstrap";
import { logger } from "../utils/logger";

export type { SyncStatus } from "./types";

function createSync() {
  const sdk = useOpenCode();
  const [store, setStore] = createStore<SyncState>(createEmptyState());
  const [currentSessionId, setCurrentSessionIdInternal] = createSignal<string | null>(null);
  const [sseCleanup, setSseCleanup] = createSignal<(() => void) | null>(null);
  const [bootstrapCount, setBootstrapCount] = createSignal(0);

  const inflight = new Map<string, Promise<void>>();
  let bootstrapToken = 0;
  const messageToSession = new Map<string, string>();
  const sessionIdleCallbacks = new Set<(sessionId: string) => void>();

  // Event batching: queue events and flush every 30ms
  const EVENT_BATCH_MS = 30;
  const eventQueue: Event[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  const eventContext: EventHandlerContext = {
    get store() { return store; },
    setStore,
    currentSessionId,
    messageToSession,
    sessionIdleCallbacks,
  };

  function flushEventQueue() {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (eventQueue.length === 0) return;

    const events = eventQueue.splice(0);
    batch(() => {
      for (const event of events) {
        applyEvent(event, eventContext);
      }
    });
  }

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(flushEventQueue, EVENT_BATCH_MS);
  }

  function setCurrentSessionId(id: string | null) {
    const prevId = currentSessionId();
    if (prevId && prevId !== id) {
      const prevMessages = store.message[prevId] ?? [];
      batch(() => {
        setStore("message", produce((draft) => { delete draft[prevId]; }));
        setStore("part", produce((draft) => {
          for (const msg of prevMessages) { delete draft[msg.id]; }
        }));
        setStore("permission", produce((draft) => { delete draft[prevId]; }));
      });
      // Clean up messageToSession mapping
      for (const msg of prevMessages) {
        messageToSession.delete(msg.id);
      }
    }
    setCurrentSessionIdInternal(id);
  }

  // Derived state
  const messages = createMemo(() => {
    const sessionId = currentSessionId();
    if (!sessionId) return [];
    return store.message[sessionId] ?? [];
  });

  const sessions = createMemo(() => store.sessions);
  const agents = createMemo(() => store.agents);

  const permissions = createMemo(() => {
    const sessionId = currentSessionId();
    if (!sessionId) return new Map<string, Permission>();
    const perms = store.permission[sessionId] ?? [];
    const map = new Map<string, Permission>();
    for (const p of perms) {
      const key = p.tool?.callID || p.id;
      map.set(key, p);
    }
    return map;
  });

  // Aggregate permissions across current session and its children
  const aggregatedPermissions = createMemo(() => {
    const sessionId = currentSessionId();
    if (!sessionId) return new Map<string, Permission>();

    const currentSession = store.sessions.find((s) => s.id === sessionId);

    // Find root session (current if no parent, otherwise its parent)
    let rootId = sessionId;
    if (currentSession?.parentID) {
      rootId = currentSession.parentID;
    }

    // Collect all sessions where parentID === root (and optionally root itself)
    const childSessions = store.sessions.filter((s) => s.parentID === rootId);
    const relevantSessionIds = [rootId, ...childSessions.map((s) => s.id)];

    // Flatten permissions from all relevant sessions
    const map = new Map<string, Permission>();
    for (const sid of relevantSessionIds) {
      const perms = store.permission[sid] ?? [];
      for (const p of perms) {
        const key = p.tool?.callID || p.id;
        map.set(key, p);
      }
    }
    return map;
  });

  const isThinking = createMemo(() => {
    const sessionId = currentSessionId();
    return sessionId ? store.thinking[sessionId] ?? false : false;
  });

  const sessionError = createMemo(() => {
    const sessionId = currentSessionId();
    return sessionId ? store.sessionError[sessionId] ?? null : null;
  });

  const contextInfo = createMemo(() => store.contextInfo);
  const fileChanges = createMemo(() => store.fileChanges);

  function setThinking(sessionId: string, thinking: boolean) {
    setStore("thinking", sessionId, thinking);
  }

  function setSessionError(sessionId: string, error: string | null) {
    if (error === null) {
      setStore("sessionError", produce((draft) => { delete draft[sessionId]; }));
    } else {
      setStore("sessionError", sessionId, error);
    }
  }

  async function bootstrap(): Promise<void> {
    const client = sdk.client();
    if (!client) {
      console.warn("[Sync] Cannot bootstrap: SDK client not ready");
      return;
    }

    const sessionId = currentSessionId();
    const workspaceRoot = sdk.workspaceRoot();
    const key = `bootstrap:${sessionId ?? "none"}`;

    const pending = inflight.get(key);
    if (pending) return pending;

    const thisToken = ++bootstrapToken;
    const startedForSession = sessionId;

    setStore("status", { status: "bootstrapping" });

    const promise = (async () => {
      try {
        const data = await fetchBootstrapData({
          client: client as Parameters<typeof fetchBootstrapData>[0]["client"],
          sessionId,
          workspaceRoot,
        });

        if (thisToken !== bootstrapToken) {
          return;
        }
        if (startedForSession && startedForSession !== currentSessionId()) {
          return;
        }

        commitBootstrapData(data, sessionId, setStore);

        // Flush any events that arrived during bootstrap
        flushEventQueue();
      } catch (err) {
        console.error("[Sync] Bootstrap failed:", err);
        setStore("status", { status: "error", message: (err as Error).message });
        throw err;
      }
    })();

    inflight.set(key, promise);
    promise.finally(() => inflight.delete(key));
    return promise;
  }

  async function switchSession(sessionId: string): Promise<void> {
    const client = sdk.client();
    if (!client) return;

    // specific optimization: just set ID if already loaded? 
    // No, we need to ensure we have the latest messages.

    // Update ID immediately to show optimistic UI state (empty/loading)
    setCurrentSessionId(sessionId);

    const workspaceRoot = sdk.workspaceRoot();
    const key = `switch:${sessionId}`;

    const pending = inflight.get(key);
    if (pending) return pending;

    setStore("status", { status: "bootstrapping" });

    const promise = (async () => {
      try {
        // Only fetch session-specific data
        const data = await fetchSessionData({
          client: client as Parameters<typeof fetchSessionData>[0]["client"],
          sessionId,
          workspaceRoot,
        });

        if (currentSessionId() !== sessionId) return;

        commitSessionData(data, sessionId, setStore);
        flushEventQueue();
        setStore("status", { status: "connected" });
      } catch (err) {
        console.error("[Sync] Switch session failed:", err);
        setStore("status", { status: "error", message: (err as Error).message });
      }
    })();

    inflight.set(key, promise);
    promise.finally(() => inflight.delete(key));
    return promise;
  }

  function handleEvent(event: Event) {
    // Log error events prominently
    if (event.type === "session.error") {
      logger.error("SSE session.error event received", { event });
    }

    if ((event.type as string) === "server.instance.disposed") {
      // Flush pending events before re-bootstrap
      flushEventQueue();
      logger.info("Server disposed, re-bootstrapping...");
      setBootstrapCount((c) => c + 1);
      return;
    }

    // Buffer events during bootstrap, queue for batched processing
    eventQueue.push(event);

    // If bootstrapping, don't schedule flush - will flush after commit
    if (store.status.status === "bootstrapping") return;

    scheduleFlush();
  }

  function handleStatus(status: SSEStatus) {
    if (status.status === "connecting") {
      setStore("status", { status: "connecting" });
    } else if (status.status === "connected") {
      // 连接成功后进入 bootstrapping 状态，待数据加载完成后才变为 connected
      // 避免在 bootstrap 完成前就显示为 connected
      if (store.status.status !== "bootstrapping" && store.status.status !== "connected") {
        setStore("status", { status: "bootstrapping" });
      }
      setBootstrapCount((c) => c + 1);
    } else if (status.status === "reconnecting") {
      setStore("status", { status: "reconnecting", attempt: status.attempt ?? 0 });
    } else if (status.status === "closed") {
      setStore("status", { status: "disconnected" });
    }
  }

  // 连接超时检测
  const CONNECTION_TIMEOUT_MS = 10000;
  let connectionTimeoutId: ReturnType<typeof setTimeout> | null = null;

  function startSSE() {
    const cleanup = sseCleanup();
    if (cleanup) cleanup();

    // 清除之前的超时
    if (connectionTimeoutId) {
      clearTimeout(connectionTimeoutId);
      connectionTimeoutId = null;
    }

    if (!sdk.isReady()) return;

    // 设置连接超时：如果 10 秒内一直处于 connecting 状态，自动重连
    connectionTimeoutId = setTimeout(() => {
      if (store.status.status === "connecting") {
        console.warn("[Sync] Connection timeout, will retry");
        reconnect();
      }
    }, CONNECTION_TIMEOUT_MS);

    try {
      const newCleanup = sdk.subscribeToEvents(handleEvent, handleStatus);
      setSseCleanup(() => () => {
        if (connectionTimeoutId) {
          clearTimeout(connectionTimeoutId);
          connectionTimeoutId = null;
        }
        newCleanup();
      });
    } catch (err) {
      console.error("[Sync] Failed to start SSE:", err);
    }
  }

  function reconnect() {
    startSSE();
    setBootstrapCount((c) => c + 1);
  }

  function onSessionIdle(callback: (sessionId: string) => void): () => void {
    sessionIdleCallbacks.add(callback);
    return () => sessionIdleCallbacks.delete(callback);
  }

  // SSE startup
  let sseStarted = false;
  createEffect(() => {
    if (!sdk.isReady()) return;
    if (sseStarted) return;
    sseStarted = true;
    startSSE();
  });

  // Bootstrap on count change
  createEffect(async () => {
    const count = bootstrapCount();
    if (count === 0) return;
    if (!sdk.isReady()) return;
    await bootstrap();
  });

  // Initialize from SDK init data
  createEffect(() => {
    const init = sdk.initData();
    if (!init) return;
    if (init.currentSessionId) {
      setCurrentSessionIdInternal(init.currentSessionId);
    }
  });

  onCleanup(() => {
    // Flush pending events before cleanup
    flushEventQueue();
    const cleanup = sseCleanup();
    if (cleanup) cleanup();
  });

  const getParts = (messageId: string) => store.part[messageId] ?? [];
  const sessionStatus = (sessionId: string) => store.sessionStatus[sessionId] ?? null;
  const isReady = () => {
    if (!sdk.isReady()) return false;
    return store.status.status === "connected" || store.status.status === "bootstrapping";
  };

  return {
    messages,
    sessions,
    agents,
    permissions,
    aggregatedPermissions,
    isThinking,
    sessionError,
    sessionStatus,
    contextInfo,
    fileChanges,
    status: () => store.status,
    getParts,

    currentSessionId,
    setCurrentSessionId,
    switchSession,

    setThinking,
    setSessionError,
    bootstrap,
    reconnect,
    onSessionIdle,

    isReady,
    workspaceRoot: sdk.workspaceRoot,
  };
}

export const SyncContext = createContext<ReturnType<typeof createSync>>();

export function SyncProvider(props: ParentProps) {
  const value = createSync();
  return <SyncContext.Provider value={value}>{props.children}</SyncContext.Provider>;
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) throw new Error("useSync must be used within SyncProvider");
  return context;
}

export type SyncContextValue = ReturnType<typeof createSync>;
