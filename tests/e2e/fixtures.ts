import { test as base, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

interface OpenCodeConfig {
  serverUrl: string;
  workspaceRoot?: string;
  opencodeConfig?: Record<string, unknown>;
}

interface LogEntry {
  level: string;
  timestamp: string;
  service?: string;
  message: string;
  raw: string;
  metadata: Record<string, string>;
}

interface OpenCodeServer {
  url: string;
  workspaceRoot: string;
  process: ChildProcess;
  logs: string[];
  getLogs: () => string;
  searchLogs: (pattern: string | RegExp) => boolean;
  getLogEntries: () => LogEntry[];
  searchLogEntries: (filter: Partial<LogEntry>) => LogEntry[];
}

export interface OpenCodeWorkerFixtures {
  opencodeServer: OpenCodeServer;
}

export interface OpenCodeFixtures {
  openWebview: (config?: Partial<OpenCodeConfig>) => Promise<Page>;
  serverLogs: OpenCodeServer["logs"];
  getServerLogs: () => string;
  searchServerLogs: (pattern: string | RegExp) => boolean;
  getServerLogEntries: () => LogEntry[];
  searchServerLogEntries: (filter: Partial<LogEntry>) => LogEntry[];
}

function parseLogLine(line: string): LogEntry {
  // Parse format: "LEVEL  timestamp +offset service=value key=value message"
  // Example: "INFO  2026-01-13T03:11:44 +0ms service=config path=/path/to/file loading"
  const match = line.match(/^(DEBUG|INFO|WARN|ERROR)\s+(\S+)\s+\+\S+\s+(.*)$/);
  if (!match) {
    return {
      level: "UNKNOWN",
      timestamp: "",
      message: line.trim(),
      raw: line,
      metadata: {},
    };
  }

  const [, level, timestamp, rest] = match;
  const metadata: Record<string, string> = {};
  let service: string | undefined;
  let message = "";

  // Parse key=value pairs and remaining message
  const parts = rest.split(/\s+/);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    // Match key=value where value can be anything (including quoted strings, JSON, etc)
    const kvMatch = part.match(/^([a-zA-Z_][a-zA-Z0-9_.-]*)=(.+)$/);
    if (kvMatch) {
      const [, key, value] = kvMatch;
      metadata[key] = value;
      if (key === "service") {
        service = value;
      }
    } else {
      // Rest is the message
      message = parts.slice(i).join(" ");
      break;
    }
  }

  return {
    level,
    timestamp,
    service,
    message: message.trim(),
    raw: line,
    metadata,
  };
}

async function waitForServerReady(url: string, timeout = 120000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(`${url}/session`);
      if (response.ok) {
        console.log(`[fixture] Server health check passed`);
        return;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Server at ${url} did not become ready within ${timeout}ms`);
}

function prepareWorkerSandbox(templateRoot: string, workspaceRoot: string): void {
  if (fs.existsSync(workspaceRoot)) {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
  fs.mkdirSync(workspaceRoot, { recursive: true });
  fs.cpSync(templateRoot, workspaceRoot, { recursive: true });
}

async function startOpenCodeServer(
  workspaceRoot: string,
  runtimeRoot: string
): Promise<OpenCodeServer> {
  return new Promise((resolve, reject) => {
    console.log(`[fixture] Spawning opencode serve in ${workspaceRoot}`);

    const logs: string[] = [];
    const homeDir = path.join(runtimeRoot, "home");
    const xdgConfigHome = path.join(runtimeRoot, "xdg-config");
    const xdgCacheHome = path.join(runtimeRoot, "xdg-cache");
    fs.mkdirSync(homeDir, { recursive: true });
    fs.mkdirSync(xdgConfigHome, { recursive: true });
    fs.mkdirSync(xdgCacheHome, { recursive: true });

    const serverProcess = spawn(
      "opencode",
      [
        "serve",
        "--port",
        "0", // Let OS pick an available port
        "--hostname",
        "127.0.0.1",
        "--cors",
        "*",
        "--print-logs",
      ],
      {
        cwd: workspaceRoot,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          HOME: homeDir,
          XDG_CONFIG_HOME: xdgConfigHome,
          XDG_CACHE_HOME: xdgCacheHome,
        },
      }
    );

    let serverUrl: string | null = null;
    let outputBuffer = "";

    const handleOutput = (data: Buffer) => {
      const text = data.toString();
      outputBuffer += text;

      // Store logs for test access
      logs.push(text);

      console.log(`[opencode] ${text.trim()}`);

      // Look for the server URL in the output
      // OpenCode outputs: "opencode server listening on http://127.0.0.1:XXXXX"
      const urlMatch = outputBuffer.match(/listening on (http:\/\/[\d.:]+)/i);
      if (urlMatch && !serverUrl) {
        // Keep IPv4 loopback address to avoid localhost => ::1 resolution mismatch
        serverUrl = urlMatch[1];
        console.log(`[fixture] Detected server URL: ${serverUrl}`);

        const getLogEntries = () => {
          return logs
            .map((log) => {
              const lines = log.split("\n").filter((l) => l.trim());
              return lines.map(parseLogLine);
            })
            .flat();
        };

        const searchLogEntries = (filter: Partial<LogEntry>) => {
          return getLogEntries().filter((entry) => {
            for (const [key, value] of Object.entries(filter)) {
              if (key === "metadata") {
                // Check if all metadata keys match
                const metadataFilter = value as Record<string, string>;
                for (const [k, v] of Object.entries(metadataFilter)) {
                  if (entry.metadata[k] !== v) return false;
                }
              } else if (entry[key as keyof LogEntry] !== value) {
                return false;
              }
            }
            return true;
          });
        };

        resolve({
          url: serverUrl,
          workspaceRoot,
          process: serverProcess,
          logs,
          getLogs: () => logs.join(""),
          searchLogs: (pattern: string | RegExp) => {
            const logsText = logs.join("");
            if (typeof pattern === "string") {
              return logsText.includes(pattern);
            }
            return pattern.test(logsText);
          },
          getLogEntries,
          searchLogEntries,
        });
      }
    };

    serverProcess.stdout?.on("data", handleOutput);
    serverProcess.stderr?.on("data", handleOutput);

    serverProcess.on("error", (err) => {
      reject(new Error(`Failed to start OpenCode server: ${err.message}`));
    });

    serverProcess.on("exit", (code) => {
      if (!serverUrl) {
        reject(
          new Error(
            `OpenCode server exited with code ${code} before providing URL. Output: ${outputBuffer}`
          )
        );
      }
    });

    // OpenCode bootstrap may include dependency/plugin installs on cold cache.
    // Allow enough time before considering startup failed.
    setTimeout(() => {
      if (!serverUrl) {
        serverProcess.kill();
        reject(
          new Error(
            `Timeout waiting for OpenCode server to start. Output: ${outputBuffer}`
          )
        );
      }
    }, 120000);
  });
}

export const test = base.extend<OpenCodeFixtures, OpenCodeWorkerFixtures>({
  // Share the server across all tests in a worker
  opencodeServer: [
    async ({ }, use, workerInfo) => {
      // Use isolated sandbox per worker to avoid startup contention.
      const templateRoot = path.join(process.cwd(), "tests", "sandbox");
      const isolatedRoot = path.join(
        os.tmpdir(),
        "paperstack-e2e",
        String(process.pid),
        `worker-${workerInfo.workerIndex}`
      );
      const runtimeRoot = path.join(
        os.tmpdir(),
        "paperstack-e2e-runtime",
        `worker-${workerInfo.workerIndex}`
      );
      const workspaceRoot = process.env.OPENCODE_WORKSPACE_ROOT || isolatedRoot;

      if (process.env.OPENCODE_WORKSPACE_ROOT) {
        if (!fs.existsSync(workspaceRoot)) {
          fs.mkdirSync(workspaceRoot, { recursive: true });
        }
      } else {
        prepareWorkerSandbox(templateRoot, workspaceRoot);
      }

      console.log(`[fixture] Starting OpenCode server in ${workspaceRoot}`);
      const server = await startOpenCodeServer(workspaceRoot, runtimeRoot);
      console.log(`[fixture] OpenCode server started at ${server.url}`);

      // Wait for server to be fully ready
      await waitForServerReady(server.url);

      await use(server);

      // Cleanup: kill the server after tests
      console.log(`[fixture] Stopping OpenCode server`);
      server.process.kill("SIGTERM");
    },
    { scope: "worker" },
  ],

  openWebview: async ({ page, opencodeServer }, use) => {
    const openWebview = async (config?: Partial<OpenCodeConfig>) => {
      const workspaceRoot = process.env.OPENCODE_WORKSPACE_ROOT || opencodeServer.workspaceRoot;

      const defaultConfig: OpenCodeConfig = {
        serverUrl: opencodeServer.url,
        workspaceRoot,
      };

      const finalConfig = { ...defaultConfig, ...config };

      // If custom opencode config is provided, write it to the sandbox
      if (finalConfig.opencodeConfig) {
        const configPath = path.join(workspaceRoot, "opencode.json");
        fs.writeFileSync(configPath, JSON.stringify(finalConfig.opencodeConfig, null, 2));
        console.log(`[fixture] Wrote custom opencode.json to ${configPath}`);
      }

      console.log(`[fixture] Opening webview with config:`, {
        ...finalConfig,
        opencodeConfig: finalConfig.opencodeConfig ? "custom" : "default"
      });

      // Set up route to inject config before page loads
      await page.route("**/standalone.html", async (route) => {
        const response = await route.fetch();
        let html = await response.text();

        // Replace the default config with our dynamic config and mock VS Code API
        const mockVsCodeApi = `
          (() => {
            let state = { mainFile: "", autoCompile: true };
            const fetchControllers = new Map();
            const sseSubscriptions = new Map();
            const sseAttempts = new Map();
            const syntheticReplyCount = new Map();
            const lastAssistantMessageBySession = new Map();
            const assistantUpdateCountBySession = new Map();

            const sendHostMessage = (payload) => {
              window.postMessage(payload, "*");
            };

            const closeSse = (id, reason = "manual") => {
              const eventSource = sseSubscriptions.get(id);
              if (!eventSource) return;
              try {
                eventSource.close();
              } catch {
                // ignore close errors in tests
              }
              sseSubscriptions.delete(id);
              sseAttempts.delete(id);
              sendHostMessage({ type: "sseStatus", id, status: "closed", reason });
              sendHostMessage({ type: "sseClosed", id });
            };

            const emitSyntheticAssistantReply = (sessionID) => {
              const count = (syntheticReplyCount.get(sessionID) ?? 0) + 1;
              syntheticReplyCount.set(sessionID, count);

              const suffix = String(Date.now()) + "_" + String(count);
              const messageID =
                lastAssistantMessageBySession.get(sessionID) ??
                ("msg_mock_assistant_" + suffix);
              const partID = "part_mock_assistant_" + suffix;

              // Broadcast to active SSE subscriptions so UI state can progress in tests.
              for (const subscriptionID of sseSubscriptions.keys()) {
                sendHostMessage({
                  type: "sseEvent",
                  id: subscriptionID,
                  data: JSON.stringify({
                    type: "message.part.updated",
                    properties: {
                      part: {
                        id: partID,
                        type: "text",
                        text: "[mock] assistant response",
                        messageID,
                        sessionID,
                      },
                    },
                  }),
                });
                sendHostMessage({
                  type: "sseEvent",
                  id: subscriptionID,
                  data: JSON.stringify({
                    type: "session.idle",
                    properties: { sessionID },
                  }),
                });
              }
            };

            const maybeEmitSyntheticAssistantReply = (id, rawEventData) => {
              let parsed;
              try {
                parsed = JSON.parse(rawEventData);
              } catch {
                return;
              }

              if (parsed?.type === "message.updated") {
                const info = parsed?.properties?.info;
                const sessionID = info?.sessionID;
                if (sessionID && info?.role === "assistant" && info?.id) {
                  lastAssistantMessageBySession.set(sessionID, info.id);
                  assistantUpdateCountBySession.set(
                    sessionID,
                    (assistantUpdateCountBySession.get(sessionID) ?? 0) + 1
                  );
                }
                return;
              }

              if (parsed?.type !== "session.error") return;

              const sessionID = parsed?.properties?.sessionID;
              const errorName = String(parsed?.properties?.error?.name ?? "");
              const errorCode = String(parsed?.properties?.error?.code ?? "");
              const errorMessage = String(
                parsed?.properties?.error?.data?.message ??
                parsed?.properties?.error?.message ??
                ""
              );
              const errorPayload = JSON.stringify(parsed?.properties?.error ?? {});

              if (!sessionID) return;
              const shouldEmitSyntheticReply =
                /api key is missing/i.test(errorMessage) ||
                /providermodelnotfounderror|modelnotfounderror/i.test(errorName) ||
                /providermodelnotfounderror|modelnotfounderror/i.test(errorCode) ||
                /provider.?model.?not.?found|model.?not.?found/i.test(errorMessage) ||
                /providermodelnotfounderror|modelnotfounderror/i.test(errorPayload);
              if (!shouldEmitSyntheticReply) return;
              emitSyntheticAssistantReply(sessionID);
            };

            window.acquireVsCodeApi = () => ({
              postMessage: async (message) => {
                if (!message || typeof message.type !== "string") return;
                console.log("[MockVSCode] Received:", message);

                if (message.type === "get-settings") {
                  sendHostMessage({
                    type: "settings-data",
                    settings: { ...state },
                  });
                  return;
                }

                if (message.type === "update-settings") {
                  state = { ...state, ...message.settings };
                  setTimeout(() => {
                    sendHostMessage({ type: "settings-updated" });
                    sendHostMessage({
                      type: "settings-data",
                      settings: { ...state },
                    });
                  }, 50);
                  return;
                }

                if (message.type === "proxyFetch") {
                  const id = message.id;
                  const controller = new AbortController();
                  fetchControllers.set(id, controller);
                  try {
                    const method = String(message?.init?.method ?? "GET").toUpperCase();
                    const response = await fetch(message.url, {
                      ...(message.init ?? {}),
                      signal: controller.signal,
                    });
                    const bodyText = await response.text();
                    const headers = {};
                    response.headers.forEach((value, key) => {
                      headers[key] = value;
                    });
                    sendHostMessage({
                      type: "proxyFetchResult",
                      id,
                      ok: true,
                      status: response.status,
                      statusText: response.statusText,
                      headers,
                      bodyText,
                    });

                    // Fallback: if message POST succeeds but no assistant delta arrives,
                    // synthesize one to keep E2E deterministic without real model credentials.
                    let postedSessionID = null;
                    if (method === "POST") {
                      try {
                        const parsedUrl = new URL(String(message.url), window.location.origin);
                        const segments = parsedUrl.pathname.split("/").filter(Boolean);
                        const sessionIndex = segments.indexOf("session");
                        if (
                          sessionIndex >= 0 &&
                          segments[sessionIndex + 1] &&
                          segments[sessionIndex + 2] === "message"
                        ) {
                          postedSessionID = decodeURIComponent(segments[sessionIndex + 1]);
                        }
                      } catch {
                        postedSessionID = null;
                      }
                    }
                    if (response.ok && postedSessionID) {
                      const sessionID = postedSessionID;
                      const seenAssistantCount =
                        assistantUpdateCountBySession.get(sessionID) ?? 0;
                      setTimeout(() => {
                        const currentAssistantCount =
                          assistantUpdateCountBySession.get(sessionID) ?? 0;
                        if (currentAssistantCount > seenAssistantCount) return;
                        emitSyntheticAssistantReply(sessionID);
                      }, 500);
                    }
                  } catch (error) {
                    sendHostMessage({
                      type: "proxyFetchResult",
                      id,
                      ok: false,
                      error: error instanceof Error ? error.message : String(error),
                    });
                  } finally {
                    fetchControllers.delete(id);
                  }
                  return;
                }

                if (message.type === "proxyFetchAbort") {
                  const controller = fetchControllers.get(message.id);
                  if (controller) {
                    controller.abort();
                    fetchControllers.delete(message.id);
                  }
                  return;
                }

                if (message.type === "sseSubscribe") {
                  const id = message.id;
                  closeSse(id, "manual");
                  try {
                    const eventSource = new EventSource(message.url);
                    sseSubscriptions.set(id, eventSource);
                    sseAttempts.set(id, 0);
                    sendHostMessage({ type: "sseStatus", id, status: "connecting" });
                    // Optimistically mark connected to avoid transient disabled input
                    // when EventSource onopen is delayed in local E2E environments.
                    sendHostMessage({ type: "sseStatus", id, status: "connected" });

                    eventSource.onopen = () => {
                      sseAttempts.set(id, 0);
                      sendHostMessage({ type: "sseStatus", id, status: "connected" });
                    };
                    eventSource.onmessage = (event) => {
                      sendHostMessage({ type: "sseEvent", id, data: event.data });
                      maybeEmitSyntheticAssistantReply(id, event.data);
                    };
                    eventSource.onerror = () => {
                      const attempt = (sseAttempts.get(id) ?? 0) + 1;
                      sseAttempts.set(id, attempt);
                      sendHostMessage({
                        type: "sseStatus",
                        id,
                        status: "reconnecting",
                        attempt,
                        nextRetryMs: 1000,
                      });
                    };
                  } catch (error) {
                    sendHostMessage({
                      type: "sseError",
                      id,
                      error: error instanceof Error ? error.message : String(error),
                    });
                  }
                  return;
                }

                if (message.type === "sseClose") {
                  closeSse(message.id, "manual");
                }
              },
              setState: () => {},
              getState: () => ({}),
            });
          })();
          window.OPENCODE_CONFIG = ${JSON.stringify(finalConfig)};
        `;

        html = html.replace(
          /window\.OPENCODE_CONFIG\s*=\s*\{[^}]+\}/,
          () => mockVsCodeApi
        );

        await route.fulfill({
          response,
          body: html,
          headers: {
            ...response.headers(),
            "content-type": "text/html",
          },
        });
      });

      // Navigate to the standalone HTML page
      await page.goto("/src/webview/standalone.html");

      // Wait for the app to be ready (message log container)
      await page.waitForSelector('[role="log"]', { timeout: 10000 });

      return page;
    };

    await use(openWebview);
  },

  serverLogs: async ({ opencodeServer }, use) => {
    await use(opencodeServer.logs);
  },

  getServerLogs: async ({ opencodeServer }, use) => {
    await use(opencodeServer.getLogs);
  },

  searchServerLogs: async ({ opencodeServer }, use) => {
    await use(opencodeServer.searchLogs);
  },

  getServerLogEntries: async ({ opencodeServer }, use) => {
    await use(opencodeServer.getLogEntries);
  },

  searchServerLogEntries: async ({ opencodeServer }, use) => {
    await use(opencodeServer.searchLogEntries);
  },
});

export { expect } from "@playwright/test";
export type { LogEntry };
