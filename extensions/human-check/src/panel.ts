import * as vscode from 'vscode';
import { ChangeSummary, ChangedFile } from './changeAnalysis';
import { RepositoryIdentity } from './git';
import {
  assessAttention,
  buildDecisionRecordMarkdown,
  buildUnderstandingFeedback,
  getReviewFocusAreas,
  HumanSignalRecord,
  recommendCheck,
  UnderstandingChecklist
} from './humanSignal';

const HISTORY_PREFIX = 'nodra.humanCheck.history.repo.v0.2.';
const MAX_VISIBLE_FILES = 10;
const MAX_HISTORY_RECORDS = 100;
const MAX_HISTORY_VISIBLE = 25;

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] ?? char);
}

function nonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function historyKey(repository: RepositoryIdentity): string {
  return `${HISTORY_PREFIX}${repository.key}`;
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

export function openHumanSignalPanel(context: vscode.ExtensionContext, summary: ChangeSummary, repository: RepositoryIdentity): void {
  const panel = vscode.window.createWebviewPanel(
    'nodraHumanSignal',
    '+NODRA Human Signal',
    vscode.ViewColumn.Active,
    { enableScripts: true, retainContextWhenHidden: false }
  );

  panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'icon.png');

  const scriptNonce = nonce();
  panel.webview.html = render(summary, repository, scriptNonce);
  let latestRecord: HumanSignalRecord | undefined;
  const validFocusAreas = new Set(getReviewFocusAreas(summary));
  const repositoryHistoryKey = historyKey(repository);

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
      const reviewedAreas = Array.isArray(value.reviewedAreas)
        ? value.reviewedAreas.filter((area): area is string => typeof area === 'string' && validFocusAreas.has(area))
        : [];
      const feedback = buildUnderstandingFeedback(summary, explanation, checklist, reviewedAreas);
      const record: HumanSignalRecord = {
        timestamp: new Date().toISOString(),
        workspace: repository.label,
        filesChanged: summary.files.length,
        added: summary.added,
        removed: summary.removed,
        areas: summary.areas,
        attention: assessAttention(summary),
        recommendedCheck: recommendCheck(summary),
        explanation: explanation.trim(),
        checklist,
        reviewedAreas,
        result: feedback.result,
        understandingGaps: feedback.gaps,
        understandingEvidence: feedback.evidence
      };

      latestRecord = record;
      const history = context.globalState.get<HumanSignalRecord[]>(repositoryHistoryKey, []);
      await context.globalState.update(repositoryHistoryKey, [record, ...history].slice(0, MAX_HISTORY_RECORDS));
      await panel.webview.postMessage({ type: 'saved', feedback });
      void vscode.window.showInformationMessage(`NODRA Human Check: ${feedback.result}`);
      return;
    }

    if (value.type === 'viewHistory') {
      const history = context.globalState.get<HumanSignalRecord[]>(repositoryHistoryKey, []);
      await panel.webview.postMessage({
        type: 'history',
        repository: repository.label,
        records: history.slice(0, MAX_HISTORY_VISIBLE)
      });
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

function render(summary: ChangeSummary, repository: RepositoryIdentity, scriptNonce: string): string {
  const visibleFiles = selectFilesForDisplay(summary.files);
  const hiddenCount = Math.max(0, summary.files.length - visibleFiles.length);
  const attention = assessAttention(summary);
  const recommendedCheck = recommendCheck(summary);
  const focusAreas = getReviewFocusAreas(summary);
  const files = visibleFiles
    .map((file) => `<li><code>${escapeHtml(file.path)}</code> <span class="muted">${file.untracked ? 'untracked' : `+${file.added} / -${file.removed}`}</span>${file.areas.length ? `<div class="tags">${file.areas.map((area) => `<span>${escapeHtml(area)}</span>`).join('')}</div>` : ''}</li>`)
    .join('');
  const overflowNotice = hiddenCount > 0
    ? `<div class="overflow"><strong>Focused view:</strong> ${hiddenCount} additional changed files are included in the totals but hidden here. NODRA is showing the ${visibleFiles.length} files that deserve attention first.</div>`
    : '';
  const focusChecks = focusAreas.length
    ? focusAreas.map((area, index) => `<label class="check focus-check"><input type="checkbox" class="area-review" id="areaReview${index}" data-area="${escapeHtml(area)}"> I reviewed the <strong>${escapeHtml(area)}</strong> impact for this change.</label>`).join('')
    : '<p class="muted">No sensitive review-focus areas were detected from file paths.</p>';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${scriptNonce}'; script-src 'nonce-${scriptNonce}';">
<title>+NODRA Human Signal</title>
<style nonce="${scriptNonce}">
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 22px; max-width: 880px; margin: 0 auto; }
  h1 { font-size: 22px; margin-bottom: 4px; } h2 { margin-top: 24px; font-size: 16px; } h3 { font-size:14px; }
  .tagline,.muted { color: var(--vscode-descriptionForeground); }
  .privacy { border-left: 3px solid var(--vscode-textLink-foreground); padding: 10px 12px; background: var(--vscode-textBlockQuote-background); margin: 18px 0 10px; }
  .purpose { margin: 10px 0 18px; padding: 12px 14px; border: 1px solid var(--vscode-panel-border); background: var(--vscode-editorWidget-background); line-height: 1.45; }
  .purpose strong { display:block; margin-bottom:5px; }
  .repository-context { margin: 10px 0 18px; color: var(--vscode-descriptionForeground); font-size: 12px; }
  .guidance { display:flex; gap:10px; flex-wrap:wrap; margin:14px 0; }
  .guidance div,.summary div { border:1px solid var(--vscode-panel-border); padding:10px 12px; min-width:120px; }
  .summary { display:flex; gap:12px; flex-wrap:wrap; }
  .overflow,.feedback,.review-focus,.history { margin: 14px 0; padding: 10px 12px; border: 1px solid var(--vscode-panel-border); background: var(--vscode-editorWidget-background); }
  .review-focus h3 { margin: 0 0 4px; }
  .review-focus p { margin: 4px 0 10px; }
  .nonblocking { color: var(--vscode-descriptionForeground); font-size: 12px; margin-top: 8px; }
  ul { padding-left: 20px; } li { margin: 8px 0 12px; }
  code { overflow-wrap:anywhere; }
  .tags span { display:inline-block; margin:5px 5px 0 0; padding:2px 7px; border:1px solid var(--vscode-panel-border); border-radius:10px; font-size:11px; }
  textarea { box-sizing:border-box; width:100%; min-height:120px; padding:10px; color:var(--vscode-input-foreground); background:var(--vscode-input-background); border:1px solid var(--vscode-input-border); }
  label.check { display:block; margin:10px 0; }
  .focus-check { padding: 3px 0; }
  button { margin:18px 8px 0 0; padding:8px 14px; color:var(--vscode-button-foreground); background:var(--vscode-button-background); border:0; cursor:pointer; }
  button.secondary { color:var(--vscode-button-secondaryForeground); background:var(--vscode-button-secondaryBackground); }
  #export { display:none; }
  #result { margin-top:18px; font-weight:600; }
  #feedback,#history { display:none; }
  #feedback h3,.history h3 { margin: 8px 0; font-size:14px; }
  #feedback ul { margin-top:4px; }
  .history-card { border-top:1px solid var(--vscode-panel-border); padding:12px 0; }
  .history-card:first-of-type { border-top:0; }
  .history-meta { display:flex; gap:8px; flex-wrap:wrap; color:var(--vscode-descriptionForeground); font-size:11px; margin:4px 0 7px; }
  .history-explanation { white-space:pre-wrap; line-height:1.4; }
  footer { margin: 32px 0 6px; padding-top: 16px; border-top: 1px solid var(--vscode-panel-border); color: var(--vscode-descriptionForeground); font-size: 12px; line-height: 1.45; text-align:center; }
  footer strong { color: var(--vscode-foreground); font-weight: 600; }
</style>
</head>
<body>
  <h1>+NODRA Human Signal</h1>
  <div class="tagline">Stay in the loop while AI codes with you.</div>
  <div class="privacy"><strong>Local-only V0.1:</strong> source code stays local · no telemetry · no account · no NODRA backend connection.</div>
  <div class="purpose">
    <strong>Why Human Check exists</strong>
    AI can accelerate how software is built. Using it does not make a developer less valuable, and using it does not remove responsibility for what gets accepted. NODRA helps you understand what changed, notice what deserves attention, and preserve the reasoning behind your decision — without judging how the code was produced or slowing your workflow.
  </div>
  <div class="repository-context"><strong>Repository:</strong> ${escapeHtml(repository.label)} · Human Signal history is kept separate for this Git repository.</div>

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

  <div class="review-focus">
    <h3>Review focus for this change</h3>
    <p class="muted">Generated from local Git file paths. Check only the areas you actually reviewed.</p>
    ${focusChecks}
  </div>

  <h3>General understanding</h3>
  <label class="check"><input type="checkbox" id="canDescribeChange"> I can describe what changed.</label>
  <label class="check"><input type="checkbox" id="knowsArchitectureImpact"> I know which parts of the architecture were affected.</label>
  <label class="check"><input type="checkbox" id="checkedSensitiveAreas"> I checked whether authentication, APIs, data, dependencies, infrastructure, configuration, tests, or UI were affected.</label>
  <label class="check"><input type="checkbox" id="understandsWhyNeeded"> I can explain why the change is needed.</label>
  <label class="check"><input type="checkbox" id="understandsImpact"> I understand the impact before accepting the change.</label>
  <button id="save">Record Human Signal locally</button>
  <button id="export" class="secondary">Export Decision Record (.md)</button>
  <button id="viewHistory" class="secondary">View history for this repository</button>
  <div id="result" role="status"></div>
  <div id="feedback" class="feedback" role="status"></div>
  <div id="history" class="history" role="region" aria-label="Human Signal history"></div>

  <footer><strong>Built by NODRA Network</strong> · Human Signal for the AI Era · Guided by NODRA Protocol</footer>
<script nonce="${scriptNonce}">
  const vscode = acquireVsCodeApi();
  const ids = ['canDescribeChange','knowsArchitectureImpact','checkedSensitiveAreas','understandsWhyNeeded','understandsImpact'];
  let historyOpen = false;
  const escape = (value) => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  document.getElementById('save').addEventListener('click', () => {
    const checklist = Object.fromEntries(ids.map(id => [id, document.getElementById(id).checked]));
    const reviewedAreas = Array.from(document.querySelectorAll('.area-review:checked')).map(input => input.dataset.area).filter(Boolean);
    vscode.postMessage({ type: 'save', explanation: document.getElementById('explanation').value, checklist, reviewedAreas });
  });
  document.getElementById('export').addEventListener('click', () => {
    vscode.postMessage({ type: 'exportDecisionRecord' });
  });
  document.getElementById('viewHistory').addEventListener('click', () => {
    historyOpen = true;
    vscode.postMessage({ type: 'viewHistory' });
  });
  window.addEventListener('message', event => {
    if (event.data?.type === 'saved') {
      const feedback = event.data.feedback;
      document.getElementById('result').textContent = 'Human Signal: ' + feedback.result + ' · stored locally';
      document.getElementById('export').style.display = 'inline-block';
      const box = document.getElementById('feedback');
      const gaps = Array.isArray(feedback.gaps) ? feedback.gaps : [];
      const evidence = Array.isArray(feedback.evidence) ? feedback.evidence : [];
      const contextHeading = feedback.result === 'UNDERSTOOD' ? 'Points worth noting' : 'Understanding gaps';
      const gapHtml = gaps.length
        ? '<h3>' + contextHeading + '</h3><ul>' + gaps.map(item => '<li>' + escape(item) + '</li>').join('') + '</ul>'
        : '<h3>' + (feedback.result === 'UNDERSTOOD' ? 'Additional context' : 'Understanding gaps') + '</h3><p>No unresolved points were identified from this local check.</p>';
      const evidenceHtml = evidence.length
        ? '<h3>What supports this result</h3><ul>' + evidence.map(item => '<li>' + escape(item) + '</li>').join('') + '</ul>'
        : '';
      box.innerHTML = gapHtml + evidenceHtml;
      box.style.display = 'block';
      if (historyOpen) {
        vscode.postMessage({ type: 'viewHistory' });
      }
    }

    if (event.data?.type === 'history') {
      historyOpen = true;
      const records = Array.isArray(event.data.records) ? event.data.records : [];
      const box = document.getElementById('history');
      const repository = escape(event.data.repository || 'current repository');
      if (!records.length) {
        box.innerHTML = '<h3>Human Signal history · ' + repository + '</h3><p>No recorded Human Signals for this repository yet.</p>';
      } else {
        const cards = records.map(record => {
          const date = record.timestamp ? new Date(record.timestamp).toLocaleString() : 'Unknown date';
          const areas = Array.isArray(record.areas) && record.areas.length ? record.areas.join(', ') : 'No sensitive areas detected';
          const reviewed = Array.isArray(record.reviewedAreas) && record.reviewedAreas.length ? record.reviewedAreas.join(', ') : 'None recorded';
          return '<div class="history-card">' +
            '<strong>' + escape(record.result || 'UNKNOWN') + '</strong>' +
            '<div class="history-meta"><span>' + escape(date) + '</span><span>' + escape(record.recommendedCheck || '') + '</span><span>' + escape(record.attention || '') + '</span><span>' + escape(String(record.filesChanged ?? 0)) + ' files</span></div>' +
            '<div><strong>Detected:</strong> ' + escape(areas) + '</div>' +
            '<div><strong>Reviewed:</strong> ' + escape(reviewed) + '</div>' +
            '<p class="history-explanation">' + escape(record.explanation || 'No explanation recorded.') + '</p>' +
          '</div>';
        }).join('');
        box.innerHTML = '<h3>Human Signal history · ' + repository + '</h3><p class="muted">Showing the latest ' + records.length + ' recorded decision' + (records.length === 1 ? '' : 's') + ' for this Git repository.</p>' + cards;
      }
      box.style.display = 'block';
      box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
</script>
</body>
</html>`;
}
