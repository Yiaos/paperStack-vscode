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
  logger = vscode.window.createOutputChannel("OpenCode", { log: true });
  context.subscriptions.push(logger);

  logger.info("OpenCode extension activated", {
    timestamp: new Date().toISOString(),
    workspaceFolder: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
    extensionPath: context.extensionPath,
  });

  // Create OpenCode service
  const openCodeService = new OpenCodeService();

  // Initialize OpenCode with workspace root - non-blocking background task
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  openCodeService.initialize(workspaceRoot).then(() => {
    logger.info("OpenCode service initialized successfully");
  }).catch((error) => {
    logger.error("Failed to initialize OpenCode service", error);
    vscode.window.showErrorMessage(
      `Failed to start PaperStack AI service: ${error.message}`
    );
  });

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

  const addSelectionDisposable = vscode.commands.registerCommand(
    "opencode.addSelectionToPrompt",
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
