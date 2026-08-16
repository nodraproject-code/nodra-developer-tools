import * as vscode from 'vscode';
import { ChangeSummary, ChangedFile } from './changeAnalysis';
import {
  assessAttention,
  buildDecisionRecordMarkdown,
  evaluateHumanSignal,
  HumanSignalRecord,
  recommendCheck,
  UnderstandingChecklist
} from './humanSignal';

const HISTORY_KEY = 'nodra.humanCheck.history.v0.1';
const MAX_VISIBLE_FILES = 10;

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] ?? char);
}

function nonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function selectFilesForDisplay(files: ChangedFile[]): ChangedFile[] {
  return [...files]
    .sort((a, b) => {
      const areaDelta = b.areas.length - a.areas.length;
      if (areaDelta !== 0) return areaDelta;
      const changeDelta = (b.added + b.removed) - (a.added + a.removed);
      if (changeDelta !== 0) return changeDelta;
      if (a.untracked !== b.untracked) return a.untracked ? -1 : 1;
      return a.path.localeCompare(b.path);
    })
    .slice(0, MAX_VISIBLE_FILES);
}

function areaCounts(summary: ChangeSummary): string {
  if (!summary.areas.length) return 'No sensitive area detected by path rules';
  return summary.areas
    .map((area) => `${area} ${summary.files.filter((file) => file.areas.includes(area)).length}`)
    .join(' · ');
}

export function openHumanSignalPanel(context: vscode.ExtensionContext, summary: ChangeSummary, workspaceName: string): void {
  const panel = vscode.window.createWebviewPanel(
    'nodraHumanSignal',
    '+NODRA Human Signal',
    vscode.ViewColumn.Active,
    { enableScripts: true, retainContextWhenHidden: false }
  );

  const scriptNonce = nonce();
  panel.webview.html = render(summary, scriptNonce);
  let latestRecord: HumanSignalRecord | undefined;

  panel.webview.onDidReceiveMessage(async (message: unknown) => {
    if (!message || typeof message !== 'object') return;
    const value = message as Record<string, unknown>;

    if (value.type === 'save') {
      const explanation = typeof value.explanation === 'string' ? value.explanation : '';
      const rawChecklist = (value.checklist ?? {}) as Record<string, unknown>;
      const checklist: UnderstandingChecklist = {
        canDescribeChange: rawChecklist.canDescribeChange === true,
        knowsArchitectureImpact: rawChecklist.knowsArchitectureImpact === true,
        checkedSensitiveAreas: rawChecklist.checkedSensitiveAreas === true,
        understandsWhyNeeded: rawChecklist.understandsWhyNeeded === true,
        understandsImpact: rawChecklist.understandsImpact === true
      };
      const result = evaluateHumanSignal(explanation, checklist);
      const record: HumanSignalRecord = {
        timestamp: new Date().toISOString(),
        workspace: workspaceName,
        filesChanged: summary.files.length,
        added: summary.added,
        removed: summary.removed,
        areas: summary.areas,
        attention: assessAttention(summary),
        recommendedCheck: recommendCheck(summary),
        explanation: explanation.trim(),
        checklist,
        result
      };

      latestRecord = record;
      const history = context.globalState.get<HumanSignalRecord[]>(HISTORY_KEY, []);
      await context.globalState.update(HISTORY_KEY, [record, ...history].slice(0, 100));
      await panel.webview.postMessage({ type: 'saved', result });
      void vscode.window.showInformationMessage(`NODRA Human Check: ${result}`);
      return;
    }

    if (value.type === 'exportDecisionRecord') {
      if (!latestRecord) {
        void vscode.window.showInformationMessage('Record the Human Signal first, then export the Decision Record.');
        return;
      }
      const destination = await vscode.window.showSaveDialog({
        title: 'Save NODRA Decision Record',
        defaultUri: vscode.Uri.file(`nodra-decision-record-${new Date().toISOString().replace(/[:.]/g, '-')}.md`),
        filters: { Markdown: ['md'] },
        saveLabel: 'Save Decision Record'
      });
      if (!destination) return;

      await vscode.workspace.fs.writeFile(destination, Buffer.from(buildDecisionRecordMarkdown(latestRecord), 'utf8'));
      void vscode.window.showInformationMessage('NODRA Decision Record saved locally.');
    }
  });
}

function render(summary: ChangeSummary, scriptNonce: string): string {
  const visibleFiles = selectFilesForDisplay(summary.files);
  const hiddenCount = Math.max(0, summary.files.length - visibleFiles.length);
  const attention = assessAttention(summary);
  const recommendedCheck = recommendCheck(summary);
  const files = visibleFiles
    .map((file) => `<li><code>${escapeHtml(file.path)}</code> <span class="muted">${file.untracked ? 'untracked' : `+${file.added} / -${file.removed}`}</span>${file.areas.length ? `<div class="tags">${file.areas.map((area) => `<span>${escapeHtml(area)}</span>`).join('')}</div>` : ''}</li>`)
    .join('');
  const overflowNotice = hiddenCount > 0
    ? `<div class="overflow"><strong>Focused view:</strong> ${hiddenCount} additional changed files are included in the totals but hidden here. NODRA is showing the ${visibleFiles.length} files that deserve attention first.</div>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${scriptNonce}'; script-src 'nonce-${scriptNonce}';">
<title>+NODRA Human Signal</title>
<style nonce="${scriptNonce}">
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 22px; max-width: 880px; margin: 0 auto; }
  h1 { font-size: 22px; margin-bottom: 4px; } h2 { margin-top: 24px; font-size: 16px; }
  .tagline,.muted { color: var(--vscode-descriptionForeground); }
  .privacy { border-left: 3px solid var(--vscode-textLink-foreground); padding: 10px 12px; background: var(--vscode-textBlockQuote-background); margin: 18px 0; }
  .guidance { display:flex; gap:10px; flex-wrap:wrap; margin:14px 0; }
  .guidance div,.summary div { border:1px solid var(--vscode-panel-border); padding:10px 12px; min-width:120px; }
  .summary { display:flex; gap:12px; flex-wrap:wrap; }
  .overflow { margin: 14px 0; padding: 10px 12px; border: 1px solid var(--vscode-panel-border); background: var(--vscode-editorWidget-background); color: var(--vscode-descriptionForeground); }
  .nonblocking { color: var(--vscode-descriptionForeground); font-size: 12px; margin-top: 8px; }
  ul { padding-left: 20px; } li { margin: 8px 0 12px; }
  code { overflow-wrap:anywhere; }
  .tags span { display:inline-block; margin:5px 5px 0 0; padding:2px 7px; border:1px solid var(--vscode-panel-border); border-radius:10px; font-size:11px; }
  textarea { box-sizing:border-box; width:100%; min-height:120px; padding:10px; color:var(--vscode-input-foreground); background:var(--vscode-input-background); border:1px solid var(--vscode-input-border); }
  label.check { display:block; margin:10px 0; }
  button { margin:18px 8px 0 0; padding:8px 14px; color:var(--vscode-button-foreground); background:var(--vscode-button-background); border:0; cursor:pointer; }
  button.secondary { color:var(--vscode-button-secondaryForeground); background:var(--vscode-button-secondaryBackground); display:none; }
  #result { margin-top:18px; font-weight:600; }
</style>
</head>
<body>
  <h1>+NODRA Human Signal</h1>
  <div class="tagline">Stay in the loop while AI codes with you.</div>
  <div class="privacy"><strong>Local-only V0.1:</strong> source code stays local · no telemetry · no account · no NODRA backend connection.</div>

  <div class="guidance">
    <div><strong>${recommendedCheck}</strong><br>recommended check</div>
    <div><strong>${attention}</strong><br>attention level</div>
  </div>
  <div class="nonblocking">Guidance only. NODRA does not block your workflow or modify your project.</div>

  <h2>What changed locally?</h2>
  <div class="summary"><div><strong>${summary.files.length}</strong><br>files</div><div><strong>+${summary.added}</strong><br>lines added</div><div><strong>-${summary.removed}</strong><br>lines removed</div></div>
  <p><strong>Sensitive areas:</strong> ${escapeHtml(areaCounts(summary))}</p>
  ${overflowNotice}
  <ul>${files || '<li>No tracked or untracked changes detected.</li>'}</ul>

  <h2>What do you understand?</h2>
  <p>Explain in your own words what changed and why it is needed. The goal is to help you keep control and preserve your decision context, not to slow you down.</p>
  <textarea id="explanation" placeholder="What changed? Why is it needed? What impact does it have?"></textarea>
  <label class="check"><input type="checkbox" id="canDescribeChange"> I can describe what changed.</label>
  <label class="check"><input type="checkbox" id="knowsArchitectureImpact"> I know which parts of the architecture were affected.</label>
  <label class="check"><input type="checkbox" id="checkedSensitiveAreas"> I checked whether authentication, APIs, data, dependencies, infrastructure, configuration, tests, or UI were affected.</label>
  <label class="check"><input type="checkbox" id="understandsWhyNeeded"> I can explain why the change is needed.</label>
  <label class="check"><input type="checkbox" id="understandsImpact"> I understand the impact before accepting the change.</label>
  <button id="save">Record Human Signal locally</button>
  <button id="export" class="secondary">Export Decision Record (.md)</button>
  <div id="result" role="status"></div>
<script nonce="${scriptNonce}">
  const vscode = acquireVsCodeApi();
  const ids = ['canDescribeChange','knowsArchitectureImpact','checkedSensitiveAreas','understandsWhyNeeded','understandsImpact'];
  document.getElementById('save').addEventListener('click', () => {
    const checklist = Object.fromEntries(ids.map(id => [id, document.getElementById(id).checked]));
    vscode.postMessage({ type: 'save', explanation: document.getElementById('explanation').value, checklist });
  });
  document.getElementById('export').addEventListener('click', () => {
    vscode.postMessage({ type: 'exportDecisionRecord' });
  });
  window.addEventListener('message', event => {
    if (event.data?.type === 'saved') {
      document.getElementById('result').textContent = 'Human Signal: ' + event.data.result + ' · stored locally';
      document.getElementById('export').style.display = 'inline-block';
    }
  });
</script>
</body>
</html>`;
}
