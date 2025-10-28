import * as vscode from "vscode";
import { OpenCodeService } from "./OpenCodeService";
import { OpenCodeViewProvider } from "./OpenCodeViewProvider";

export async function activate(context: vscode.ExtensionContext) {
  console.log("OpenCode extension is now active!");

  // Create OpenCode service
  const openCodeService = new OpenCodeService();

  // Initialize OpenCode with workspace root
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  try {
    await openCodeService.initialize(workspaceRoot);
    console.log("OpenCode service initialized");
  } catch (error) {
    console.error("Failed to initialize OpenCode service:", error);
    vscode.window.showErrorMessage(
      "Failed to start OpenCode. Please check your configuration."
    );
  }

  const provider = new OpenCodeViewProvider(
    context.extensionUri,
    openCodeService
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      OpenCodeViewProvider.viewType,
      provider
    )
  );

  // Cleanup on deactivation
  context.subscriptions.push(openCodeService);

  console.log("OpenCode webview provider registered");
}

export function deactivate() {
  console.log("OpenCode extension deactivated");
}
