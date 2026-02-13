import * as vscode from "vscode";
import { OpenCodeService } from "./OpenCodeService";
import { OpenCodeViewProvider } from "./OpenCodeViewProvider";
import type { HostMessage } from "./shared/messages";

let logger: vscode.LogOutputChannel;

export function getLogger(): vscode.LogOutputChannel {
  return logger;
}

export async function activate(context: vscode.ExtensionContext) {
  // Create log channel - VSCode manages file location and timestamps automatically
  logger = vscode.window.createOutputChannel("PaperStack AI", { log: true });
  context.subscriptions.push(logger);

  logger.info("PaperStack AI extension activated", {
    timestamp: new Date().toISOString(),
    workspaceFolder: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
    extensionPath: context.extensionPath,
  });

  // Create OpenCode service
  const openCodeService = new OpenCodeService();
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  let initErrorMessage: string | null = null;

  // 首次打开视图时先等待服务初始化完成，避免用户进入后立即看到“断开连接/重连”提示
  try {
    await openCodeService.initialize(workspaceRoot);
    logger.info("OpenCode service initialized successfully");
  } catch (error) {
    logger.error("Failed to initialize OpenCode service", error);
    initErrorMessage = `Failed to start PaperStack AI service: ${(error as Error).message}`;
    vscode.window.showErrorMessage(initErrorMessage);
  }

  const provider = new OpenCodeViewProvider(
    context.extensionUri,
    openCodeService,
    context.globalState
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      OpenCodeViewProvider.viewType,
      provider
    )
  );

  if (initErrorMessage) {
    provider.sendHostMessage({ type: "error", message: initErrorMessage });
  }

  const addSelectionDisposable = vscode.commands.registerCommand(
    "paperstack.ai.addSelectionToPrompt",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage("OpenCode: No active editor selection.");
        return;
      }

      const document = editor.document;
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
      const filePath = workspaceFolder
        ? vscode.workspace.asRelativePath(document.uri)
        : document.uri.fsPath;
      const fileUrl = document.uri.toString();

      const selection = editor.selection;
      const message: HostMessage = {
        type: "editor-selection",
        filePath,
        fileUrl,
        selection: selection.isEmpty
          ? undefined
          : {
            startLine: selection.start.line + 1,
            endLine: selection.end.line + 1,
          },
      };

      await vscode.commands.executeCommand("workbench.view.extension.paperstack-ai");
      provider.sendHostMessage(message);
    }
  );

  context.subscriptions.push(addSelectionDisposable);

  // Cleanup on deactivation
  context.subscriptions.push(openCodeService);

  logger.info("PaperStack AI webview provider registered");
}

export function deactivate() {
  logger?.info("PaperStack AI extension deactivated");
}
