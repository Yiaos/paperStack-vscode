import { batch } from "solid-js";
import { reconcile, type SetStoreFunction } from "solid-js/store";
import type {
  Agent as SDKAgent,
  Session as SDKSession,
  Message as SDKMessage,
  Part as SDKPart,
  AssistantMessage,
  PermissionRequest as SDKPermission,
} from "@opencode-ai/sdk/v2/client";
import type {
  Message,
  MessagePart,
  Session,
  Agent,
  Permission,
  ContextInfo,
  FileChangesInfo,
} from "../types";
import type { SyncState, SessionStatus } from "./types";
import { extractTextFromParts } from "./utils";

// ======== Session 数据缓存 ========
// 简单的 LRU 风格缓存，最多缓存 5 个会话的消息，有效期 60 秒
const SESSION_CACHE_TTL_MS = 60000;
const SESSION_CACHE_MAX_SIZE = 10;

interface CachedSessionData {
  data: SessionData;
  timestamp: number;
}

const sessionDataCache = new Map<string, CachedSessionData>();

function getCachedSessionData(sessionId: string): SessionData | null {
  const cached = sessionDataCache.get(sessionId);
  if (!cached) return null;

  // 检查是否过期
  if (Date.now() - cached.timestamp > SESSION_CACHE_TTL_MS) {
    sessionDataCache.delete(sessionId);
    return null;
  }

  return cached.data;
}

function setCachedSessionData(sessionId: string, data: SessionData): void {
  // LRU: 如果超出最大容量，移除最早的条目
  if (sessionDataCache.size >= SESSION_CACHE_MAX_SIZE) {
    const oldestKey = sessionDataCache.keys().next().value;
    if (oldestKey) sessionDataCache.delete(oldestKey);
  }

  sessionDataCache.set(sessionId, {
    data,
    timestamp: Date.now(),
  });
}

/** 清除指定 session 的缓存（当 session 数据变化时调用） */
export function invalidateSessionCache(sessionId: string): void {
  sessionDataCache.delete(sessionId);
}

/** 清除所有会话缓存 */
export function clearAllSessionCache(): void {
  sessionDataCache.clear();
}
// ======== End of Session 数据缓存 ========

/** API response for session.messages endpoint */
interface MessageWithParts {
  info: SDKMessage;
  parts: SDKPart[];
}

export interface BootstrapContext {
  client: {
    app: { agents: () => Promise<{ data?: SDKAgent[] }> };
    session: {
      list: (opts?: { directory?: string }) => Promise<{ data?: SDKSession[] }>;
      messages: (opts: { sessionID: string }) => Promise<{ data?: MessageWithParts[] }>;
      get: (opts: { sessionID: string }) => Promise<{ data?: SDKSession }>;
      status: (opts?: { directory?: string }) => Promise<{ data?: { [key: string]: any } }>;
    };
    permission: {
      list: (opts?: { directory?: string }) => Promise<{ data?: any[] }>;
    };
  };
  sessionId: string | null;
  workspaceRoot: string | undefined;
}

export interface BootstrapResult {
  agents: Agent[];
  sessions: Session[];
  messageList: Message[];
  partMap: { [messageID: string]: MessagePart[] };
  permissionMap: { [sessionID: string]: Permission[] };
  sessionStatusMap: { [sessionID: string]: SessionStatus };
  contextInfo: ContextInfo | null;
  fileChanges: FileChangesInfo | null;
}

/** Convert SDK Agent to internal Agent type */
function toAgent(sdkAgent: SDKAgent): Agent {
  return {
    name: sdkAgent.name,
    description: sdkAgent.description,
    mode: sdkAgent.mode,
    builtIn: (sdkAgent as any).builtIn,
    options: sdkAgent.color ? { color: sdkAgent.color } : undefined,
  };
}

/** Convert SDK Session to internal Session type */
function toSession(sdkSession: SDKSession): Session {
  return {
    id: sdkSession.id,
    title: sdkSession.title,
    projectID: sdkSession.projectID,
    directory: sdkSession.directory,
    parentID: sdkSession.parentID,
    time: sdkSession.time,
    summary: sdkSession.summary
      ? {
        additions: sdkSession.summary.additions,
        deletions: sdkSession.summary.deletions,
        files: sdkSession.summary.files,
        diffs: sdkSession.summary.diffs
      }
      : undefined,
  };
}

/** Convert SDK Part to internal MessagePart type */
function toPart(sdkPart: SDKPart): MessagePart {
  return sdkPart as MessagePart;
}

/** Convert SDK Permission to internal Permission type */
function toPermission(sdkPerm: SDKPermission): Permission {
  return {
    id: sdkPerm.id,
    permission: sdkPerm.permission,
    patterns: sdkPerm.patterns,
    sessionID: sdkPerm.sessionID,
    metadata: sdkPerm.metadata ?? {},
    always: sdkPerm.always,
    tool: sdkPerm.tool,
  };
}

// System agents that should be hidden from the UI
const HIDDEN_AGENTS = new Set(["compaction", "title", "summary"]);


export interface GlobalData {
  agents: Agent[];
  sessions: Session[];
  sessionStatusMap: { [sessionID: string]: SessionStatus };
  permissionMap: { [sessionID: string]: Permission[] };
}

export interface SessionData {
  messageList: Message[];
  partMap: { [messageID: string]: MessagePart[] };
  contextInfo: ContextInfo | null;
  fileChanges: FileChangesInfo | null;
}

export async function fetchGlobalData(ctx: BootstrapContext): Promise<GlobalData> {
  const { client, workspaceRoot } = ctx;

  const [agentsRes, sessionsRes, sessionStatusRes, permissionsRes] = await Promise.all([
    client.app.agents(),
    client.session.list(workspaceRoot ? { directory: workspaceRoot } : undefined),
    client.session.status(workspaceRoot ? { directory: workspaceRoot } : undefined),
    client.permission.list(workspaceRoot ? { directory: workspaceRoot } : undefined)
  ]);

  const agents = (agentsRes?.data ?? [])
    .filter((a): a is SDKAgent =>
      (a.mode === "primary" || a.mode === "all") && !HIDDEN_AGENTS.has(a.name)
    )
    .map(toAgent);

  const sessions = (sessionsRes?.data ?? [])
    .filter((s): s is SDKSession => !!s?.id && !s.parentID)
    .map(toSession)
    .sort((a, b) => a.id.localeCompare(b.id));

  const sessionStatusMap: { [sessionID: string]: SessionStatus } = sessionStatusRes?.data ?? {};

  const permissionMap: { [sessionID: string]: Permission[] } = {};
  const permissions = permissionsRes?.data ?? [];
  for (const sdkPerm of permissions) {
    const perm = toPermission(sdkPerm as SDKPermission);
    if (!permissionMap[perm.sessionID]) {
      permissionMap[perm.sessionID] = [];
    }
    permissionMap[perm.sessionID].push(perm);
  }

  return { agents, sessions, sessionStatusMap, permissionMap };
}

export async function fetchSessionData(ctx: BootstrapContext): Promise<SessionData> {
  const { client, sessionId } = ctx;

  // 先检查缓存
  if (sessionId) {
    const cached = getCachedSessionData(sessionId);
    if (cached) {
      console.debug("[Bootstrap] Using cached session data for:", sessionId);
      return cached;
    }
  }

  let messageList: Message[] = [];
  let contextInfo: ContextInfo | null = null;
  let fileChanges: FileChangesInfo | null = null;
  const partMap: { [messageID: string]: MessagePart[] } = {};

  if (sessionId) {
    try {
      const [messagesRes, sessionRes] = await Promise.all([
        client.session.messages({ sessionID: sessionId }),
        client.session.get({ sessionID: sessionId }),
      ]);

      const rawMessages = messagesRes?.data ?? [];

      messageList = rawMessages
        .map((raw) => {
          const msgInfo = raw.info;
          const parts = raw.parts;
          const text = extractTextFromParts(parts.map(toPart));
          const messageId = msgInfo.id;
          const role = msgInfo.role;

          let normalizedParts = parts;
          if (role === "user") {
            normalizedParts = parts.filter((p) => {
              if (p.type !== "text") return true;
              return !p.synthetic && !p.ignored;
            });
          }

          if (normalizedParts.length > 0) {
            partMap[messageId] = normalizedParts
              .map(toPart)
              .sort((a, b) => a.id.localeCompare(b.id));
          }

          return {
            id: messageId,
            type: role,
            text,
          } as Message;
        })
        .filter((m) => !!m.id)
        .sort((a, b) => a.id.localeCompare(b.id));

      const session = sessionRes?.data;

      if (session?.summary) {
        if (session.summary.diffs && session.summary.diffs.length > 0) {
          const diffs = session.summary.diffs;
          fileChanges = {
            fileCount: diffs.length,
            additions: diffs.reduce((sum, d) => sum + (d.additions || 0), 0),
            deletions: diffs.reduce((sum, d) => sum + (d.deletions || 0), 0),
          };
        } else if (session.summary.files > 0) {
          fileChanges = {
            fileCount: session.summary.files,
            additions: session.summary.additions,
            deletions: session.summary.deletions,
          };
        }
      }

      const lastAssistant = [...rawMessages]
        .reverse()
        .find((raw) => raw.info.role === "assistant");

      if (lastAssistant && lastAssistant.info.role === "assistant") {
        const assistantMsg = lastAssistant.info as AssistantMessage;
        const tokens = assistantMsg.tokens;
        const usedTokens =
          tokens.input +
          tokens.output +
          tokens.reasoning +
          tokens.cache.read +
          tokens.cache.write;
        if (usedTokens > 0) {
          const limit = 200000;
          contextInfo = {
            usedTokens,
            limitTokens: limit,
            percentage: Math.min(100, (usedTokens / limit) * 100),
          };
        }
      }
    } catch (err) {
      console.error("[Sync] Failed to load session messages:", err);
    }
  }

  const result = { messageList, partMap, contextInfo, fileChanges };

  // 存入缓存
  if (sessionId) {
    setCachedSessionData(sessionId, result);
  }

  return result;
}

export async function fetchBootstrapData(ctx: BootstrapContext): Promise<BootstrapResult> {
  const [globalData, sessionData] = await Promise.all([
    fetchGlobalData(ctx),
    fetchSessionData(ctx)
  ]);

  return {
    ...globalData,
    ...sessionData
  };
}


export function commitGlobalData(
  data: GlobalData,
  setStore: SetStoreFunction<SyncState>
): void {
  batch(() => {
    setStore("agents", data.agents);
    setStore("sessions", data.sessions);
    setStore("sessionStatus", reconcile(data.sessionStatusMap));
    setStore("permission", reconcile(data.permissionMap));
  });
}

export function commitSessionData(
  data: SessionData,
  sessionId: string | null,
  setStore: SetStoreFunction<SyncState>
): void {
  batch(() => {
    if (sessionId) {
      setStore("message", sessionId, data.messageList);
    }
    // Replace partMap entirely for the new session to prevent stale data accumulation
    setStore("part", reconcile(data.partMap));

    setStore("contextInfo", data.contextInfo);
    setStore("fileChanges", data.fileChanges);
  });
}

export function commitBootstrapData(
  data: BootstrapResult,
  sessionId: string | null,
  setStore: SetStoreFunction<SyncState>
): void {
  batch(() => {
    commitGlobalData(data, setStore);
    commitSessionData(data, sessionId, setStore);
    setStore("status", { status: "connected" });
  });
}
