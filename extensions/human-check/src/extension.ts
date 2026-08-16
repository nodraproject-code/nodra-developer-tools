import * as vscode from 'vscode';
import { analyzeWorkspace } from './git';
import { openHumanSignalPanel } from './panel';

export function activate(context: vscode.ExtensionContext): void {
  const command = vscode.commands.registerCommand('nodra.humanCheckWorkspace', async () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      void vscode.window.showWarningMessage('NODRA Human Check needs an open Git workspace.');
      return;
    }

    try {
      const summary = await analyzeWorkspace(folder.uri.fsPath);
      openHumanSignalPanel(context, summary, folder.name);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      void vscode.window.showErrorMessage(`NODRA Human Check could not read local Git changes: ${detail}`);
    }
  });

  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 20);
  status.name = 'NODRA Human Check';
  status.text = '$(checklist) +NODRA Human Check';
  status.tooltip = 'Understand local changes before accepting them';
  status.command = 'nodra.humanCheckWorkspace';
  status.show();

  context.subscriptions.push(command, status);
}

export function deactivate(): void {}
