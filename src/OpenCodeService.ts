import { createOpencode, createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk/v2";
import type { Message } from "@opencode-ai/sdk/v2/client";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { getLogger } from "./extension";

const SERVER_PORT = 40960;

interface OpencodeInstance {
  client: OpencodeClient;
  server: {
    url: string;
    close(): void;
  };
  isReused?: boolean;
}

export class OpenCodeService {
  private opencode: OpencodeInstance | null = null;
  private currentSessionId: string | null = null;
  private currentSessionTitle: string = "New Session";
  private initializationPromise: Promise<void> | null = null;
  private workspaceDir?: string;

  async initialize(workspaceRoot?: string): Promise<void> {
    // 如果已经初始化完成，直接返回
    if (this.opencode) {
      return;
    }

    // 如果正在初始化中，等待已有的 Promise 完成
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // 开始新的初始化
    this.initializationPromise = this._doInitialize(workspaceRoot);
    try {
      await this.initializationPromise;
    } finally {
      this.initializationPromise = null;
    }
  }

  private async _doInitialize(workspaceRoot?: string): Promise<void> {
    const logger = getLogger();
    const maxRetries = 10;

    const prevCwd = process.cwd();
    const shouldChdir =
      Boolean(workspaceRoot) && fs.existsSync(workspaceRoot as string);

    if (shouldChdir) {
      this.workspaceDir = workspaceRoot as string;
    }

    try {
      // 1. 尝试复用已存在的服务器 (扫描端口范围)
      if (workspaceRoot) {
        const reuseResult = await this._tryReuseExistingServer(workspaceRoot, maxRetries);
        if (reuseResult) {
          const { client, port } = reuseResult;
          this.opencode = {
            client,
            server: {
              url: `http://127.0.0.1:${port}`,
              close: () => { }, // 复用的服务器不由插件负责关闭
            },
            isReused: true,
          };
          logger.info(`✓ Reusing existing OpenCode server at http://127.0.0.1:${port}`);
          return;
        }
      }

      // 2. 如果无法复用，则启动新服务器 (尝试端口范围)
      if (shouldChdir) {
        process.chdir(workspaceRoot as string);
      }

      logger.info("Starting a new OpenCode server...");

      let started = false;
      let lastError: any;

      for (let i = 0; i <= maxRetries; i++) {
        const port = SERVER_PORT + i;
        try {
          logger.info(`Attempting to start OpenCode server on port ${port}...`);
          this.opencode = await createOpencode({
            hostname: "127.0.0.1",
            port: port,
            timeout: 15000,
          });
          logger.info(`New OpenCode server started at ${this.opencode.server.url}`);
          started = true;
          break;
        } catch (error) {
          logger.warn(`Failed to start on port ${port}: ${(error as Error).message}`);
          lastError = error;
        }
      }

      if (!started) {
        throw lastError || new Error("Failed to find an available port for OpenCode server");
      }

    } catch (error) {
      logger.error("Failed to initialize OpenCode:", error);
      vscode.window.showErrorMessage(
        `Failed to start PaperStack Service: ${(error as Error).message}`,
      );
      throw error;
    } finally {
      if (shouldChdir) {
        try {
          process.chdir(prevCwd);
        } catch (e) {
          console.warn("Failed to restore working directory:", e);
        }
      }
    }
  }

  /**
   * 探测并尝试复用已在运行的服务器 (全局复用)
   */
  private async _tryReuseExistingServer(workspaceRoot: string, maxRetries: number): Promise<{ client: OpencodeClient, port: number } | null> {
    for (let i = 0; i <= maxRetries; i++) {
      const port = SERVER_PORT + i;
      const defaultUrl = `http://127.0.0.1:${port}`;
      const tempClient = createOpencodeClient({ baseUrl: defaultUrl });

      try {
        // 只要服务器能正常返回配置，就说明它是存活的 OpenCode 服务
        const configRes = await Promise.race([
          tempClient.config.get(),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error("timeout")), 200)) // 缩短超时以加快扫描
        ]);

        if (configRes && !configRes.error) {
          return { client: tempClient, port };
        }
      } catch {
        // 连接失败或超时，尝试下一个端口
      }
    }
    return null;
  }

  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  getCurrentSessionTitle(): string {
    return this.currentSessionTitle;
  }

  async getMessages(
    sessionId: string,
  ): Promise<Message[]> {
    if (!this.opencode) {
      throw new Error("OpenCode not initialized");
    }

    const result = await this.opencode.client.session.messages({
      sessionID: sessionId,
    });

    if (result.error) {
      throw new Error(
        `Failed to get messages: ${JSON.stringify(result.error)}`,
      );
    }

    return result.data || [];
  }

  dispose(): void {
    if (this.opencode) {
      // 仅当服务器不是复用的时候才尝试关闭它
      if (!this.opencode.isReused) {
        this.opencode.server.close();
      }
      this.opencode = null;
      this.currentSessionId = null;
    }
  }

  isReady(): boolean {
    return this.opencode !== null && this.initializationPromise === null;
  }

  getWorkspaceRoot(): string | undefined {
    return this.workspaceDir;
  }

  getServerUrl(): string | undefined {
    return this.opencode?.server.url;
  }
}
