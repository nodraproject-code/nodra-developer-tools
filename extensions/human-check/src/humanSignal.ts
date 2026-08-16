import { ChangeSummary } from './changeAnalysis';

export type HumanCheckResult = 'UNDERSTOOD' | 'NEEDS_REVIEW' | 'REVISIT';
export type AttentionLevel = 'STANDARD' | 'ELEVATED' | 'HIGH';
export type RecommendedCheck = 'QUICK' | 'DEEP';

export interface UnderstandingChecklist {
  canDescribeChange: boolean;
  knowsArchitectureImpact: boolean;
  checkedSensitiveAreas: boolean;
  understandsWhyNeeded: boolean;
  understandsImpact: boolean;
}

export interface HumanSignalRecord {
  timestamp: string;
  workspace: string;
  filesChanged: number;
  added: number;
  removed: number;
  areas: string[];
  attention: AttentionLevel;
  recommendedCheck: RecommendedCheck;
  explanation: string;
  checklist: UnderstandingChecklist;
  result: HumanCheckResult;
}

export function evaluateHumanSignal(explanation: string, checklist: UnderstandingChecklist): HumanCheckResult {
  const normalized = explanation.trim();
  if (normalized.length < 30) return 'REVISIT';

  const checks = Object.values(checklist);
  if (checks.every(Boolean)) return 'UNDERSTOOD';
  return 'NEEDS_REVIEW';
}

export function assessAttention(summary: ChangeSummary): AttentionLevel {
  const areas = new Set(summary.areas);
  const changedLines = summary.added + summary.removed;
  const highImpactCombination =
    (areas.has('authentication') && (areas.has('API') || areas.has('data'))) ||
    (areas.has('infrastructure') && (areas.has('dependencies') || areas.has('configuration')));

  if (highImpactCombination || summary.files.length >= 100 || changedLines >= 5000) return 'HIGH';
  if (
    areas.has('authentication') ||
    areas.has('data') ||
    areas.has('infrastructure') ||
    areas.has('dependencies') ||
    summary.files.length >= 20 ||
    changedLines >= 500
  ) return 'ELEVATED';
  return 'STANDARD';
}

export function recommendCheck(summary: ChangeSummary): RecommendedCheck {
  return assessAttention(summary) === 'STANDARD' ? 'QUICK' : 'DEEP';
}

export function buildDecisionRecordMarkdown(record: HumanSignalRecord): string {
  const areas = record.areas.length ? record.areas.join(', ') : 'None detected by path rules';
  const checklist = [
    ['Can describe what changed', record.checklist.canDescribeChange],
    ['Knows architecture impact', record.checklist.knowsArchitectureImpact],
    ['Checked sensitive areas', record.checklist.checkedSensitiveAreas],
    ['Can explain why the change is needed', record.checklist.understandsWhyNeeded],
    ['Understands impact before accepting', record.checklist.understandsImpact]
  ] as const;

  return `# NODRA Decision Record\n\n` +
    `> Human-authored decision context. Generated locally by NODRA Human Check. No source code or diff is included.\n\n` +
    `- **Workspace:** ${record.workspace}\n` +
    `- **Timestamp:** ${record.timestamp}\n` +
    `- **Human Signal:** ${record.result}\n` +
    `- **Recommended check:** ${record.recommendedCheck}\n` +
    `- **Attention:** ${record.attention}\n` +
    `- **Changed files:** ${record.filesChanged}\n` +
    `- **Lines:** +${record.added} / -${record.removed}\n` +
    `- **Sensitive areas:** ${areas}\n\n` +
    `## Developer explanation\n\n${record.explanation || '_No explanation recorded._'}\n\n` +
    `## Understanding checklist\n\n` +
    checklist.map(([label, value]) => `- [${value ? 'x' : ' '}] ${label}`).join('\n') +
    `\n\n---\nGenerated locally by NODRA Human Check.\n`;
}
