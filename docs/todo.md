sessions列表，打开空白页时，能自动关闭
启动时不创建，首次输入时才新建
后端断开后，自动重连， 或给用户操作按钮


设置功能未完全实现
表现：虽然 UI 上可以设置 "Main File" 和 "Auto Compile"，并且状态会被保存，但代码中未发现实际使用这些设置的逻辑。
影响：用户勾选 "自动编译" 后，保存 LaTeX 文件可能不会触发编译，功能无效。
建议：需要在 extension.ts 中添加文件监听器 (vscode.workspace.onDidSaveTextDocument)，并在 OpenCodeService 中按需调用编译命令。