import * as vscode from 'vscode';
import { analyzeWorkspace, isGitWorkspace, resolveRepositoryIdentity } from './git';
import { compareLocalSnapshots, createLocalSnapshot, LocalSnapshot, resolveLocalFolderIdentity } from './localFolder';
import { openHumanSignalPanel } from './panel';

const LOCAL_BASELINE_PREFIX = 'nodra.humanCheck.localBaseline.v0.1.';

export function activate(context: vscode.ExtensionContext): void {
  const command = vscode.commands.registerCommand('nodra.humanCheckWorkspace', async () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      void vscode.window.showWarningMessage('NODRA Human Check needs an open project folder.');
      return;
    }

    const cwd = folder.uri.fsPath;

    try {
      if (await isGitWorkspace(cwd)) {
        const [summary, repository] = await Promise.all([
          analyzeWorkspace(cwd),
          resolveRepositoryIdentity(cwd, folder.name)
        ]);
        openHumanSignalPanel(context, summary, repository);
        return;
      }

      const repository = await resolveLocalFolderIdentity(cwd, folder.name);
      const baselineKey = `${LOCAL_BASELINE_PREFIX}${repository.key}`;
      const current = await createLocalSnapshot(cwd);
      const baseline = context.globalState.get<LocalSnapshot>(baselineKey);

      if (!baseline) {
        await context.globalState.update(baselineKey, current);
        repository.label = `${repository.label} · baseline created locally; compare changes from the next run`;
        openHumanSignalPanel(context, compareLocalSnapshots(current, current).summary, repository);
        void vscode.window.showInformationMessage('NODRA Human Check: Local folder mode baseline created locally. No project files were changed. Run Human Check again after changes to compare against this baseline.');
        return;
      }

      const analysis = compareLocalSnapshots(baseline, current);
      openHumanSignalPanel(context, analysis.summary, repository);
      void vscode.window.showInformationMessage(
        `NODRA Human Check · Local folder mode: ${analysis.counts.new} new · ${analysis.counts.modified} modified · ${analysis.counts.deleted} deleted.`
      );
    } catch {
      void vscode.window.showErrorMessage('NODRA Human Check could not inspect this local project. Your files were not modified or uploaded.');
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
