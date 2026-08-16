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

export interface UnderstandingFeedback {
  result: HumanCheckResult;
  gaps: string[];
  evidence: string[];
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
  reviewedAreas?: string[];
  result: HumanCheckResult;
  understandingGaps?: string[];
  understandingEvidence?: string[];
}

const CHECKLIST_GAPS: Array<[keyof UnderstandingChecklist, string]> = [
  ['canDescribeChange', 'You have not confirmed that you can describe what changed.'],
  ['knowsArchitectureImpact', 'Architecture impact has not been confirmed.'],
  ['checkedSensitiveAreas', 'Sensitive areas have not been confirmed as reviewed.'],
  ['understandsWhyNeeded', 'The reason this change is needed has not been confirmed.'],
  ['understandsImpact', 'Overall impact before accepting the change has not been confirmed.']
];

const AREA_PRIORITY = [
  'authentication',
  'data',
  'API',
  'infrastructure',
  'dependencies',
  'configuration',
  'tests',
  'UI'
];

const AREA_TERMS: Record<string, string[]> = {
  API: ['api', 'endpoint', 'endpoints', 'contract', 'contrato'],
  authentication: ['auth', 'authentication', 'autenticacion', 'autenticación', 'login', 'session', 'sesion', 'sesión', 'credential', 'credencial'],
  data: ['data', 'datos', 'database', 'base de datos', 'firestore', 'persistence', 'persistencia'],
  dependencies: ['dependency', 'dependencies', 'dependencia', 'dependencias', 'package', 'npm'],
  infrastructure: ['infrastructure', 'infraestructura', 'firebase', 'cloud', 'terraform', 'deployment', 'despliegue'],
  configuration: ['configuration', 'config', 'configuracion', 'configuración', 'environment', 'entorno'],
  tests: ['test', 'tests', 'prueba', 'pruebas', 'spec'],
  UI: ['ui', 'frontend', 'front-end', 'interfaz', 'interface', 'dashboard', 'view', 'vista']
};

function normalizeText(value: string): string {
  return value.toLocaleLowerCase();
}

function explanationMentionsArea(explanation: string, area: string): boolean {
  const text = normalizeText(explanation);
  return (AREA_TERMS[area] ?? [area.toLowerCase()]).some((term) => text.includes(term));
}

export function getReviewFocusAreas(summary: ChangeSummary): string[] {
  return [...summary.areas]
    .sort((a, b) => {
      const aRank = AREA_PRIORITY.indexOf(a);
      const bRank = AREA_PRIORITY.indexOf(b);
      return (aRank === -1 ? AREA_PRIORITY.length : aRank) - (bRank === -1 ? AREA_PRIORITY.length : bRank);
    })
    .slice(0, 5);
}

export function evaluateHumanSignal(explanation: string, checklist: UnderstandingChecklist): HumanCheckResult {
  const normalized = explanation.trim();
  if (normalized.length < 30) return 'REVISIT';

  const checks = Object.values(checklist);
  if (checks.every(Boolean)) return 'UNDERSTOOD';
  return 'NEEDS_REVIEW';
}

export function buildUnderstandingFeedback(
  summary: ChangeSummary,
  explanation: string,
  checklist: UnderstandingChecklist,
  reviewedAreas: string[] = []
): UnderstandingFeedback {
  let result = evaluateHumanSignal(explanation, checklist);
  const gaps: string[] = [];
  const evidence: string[] = [];
  const normalized = explanation.trim();
  const focusAreas = getReviewFocusAreas(summary);
  const reviewed = new Set(reviewedAreas.filter((area) => focusAreas.includes(area)));

  if (normalized.length < 30) {
    gaps.push('Add a short explanation of what changed, why it was needed, and what impact you expect.');
  } else {
    evidence.push('A developer-authored explanation was recorded.');
  }

  for (const [key, message] of CHECKLIST_GAPS) {
    if (!checklist[key]) gaps.push(message);
  }

  if (recommendCheck(summary) === 'DEEP') {
    const unreviewedFocusAreas = focusAreas.filter((area) => !reviewed.has(area));
    if (unreviewedFocusAreas.length > 0) {
      gaps.push(`Review focus not confirmed for: ${unreviewedFocusAreas.join(', ')}.`);
      if (result === 'UNDERSTOOD') result = 'NEEDS_REVIEW';
    }
  }

  const unmentionedAreas = summary.areas.filter((area) => !explanationMentionsArea(normalized, area));
  if (recommendCheck(summary) === 'DEEP' && normalized.length >= 30 && unmentionedAreas.length > 0) {
    const areas = unmentionedAreas.slice(0, 3).join(', ');
    gaps.push(`Your explanation does not mention detected area${unmentionedAreas.length > 1 ? 's' : ''}: ${areas}. Consider whether ${unmentionedAreas.length > 1 ? 'they affect' : 'it affects'} your decision.`);
  }

  if (reviewed.size > 0) evidence.push(`Review focus confirmed for: ${[...reviewed].join(', ')}.`);
  if (checklist.canDescribeChange) evidence.push('You confirmed that you can describe the change.');
  if (checklist.knowsArchitectureImpact) evidence.push('You confirmed the architecture impact.');
  if (checklist.checkedSensitiveAreas) evidence.push('You confirmed that sensitive areas were reviewed.');
  if (checklist.understandsWhyNeeded) evidence.push('You confirmed why the change is needed.');
  if (checklist.understandsImpact) evidence.push('You confirmed the impact before accepting the change.');

  return { result, gaps: gaps.slice(0, 6), evidence: evidence.slice(0, 7) };
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
  const gaps = record.understandingGaps?.length
    ? record.understandingGaps.map((gap) => `- ${gap}`).join('\n')
    : '- No unresolved understanding gaps recorded.';
  const evidence = record.understandingEvidence?.length
    ? record.understandingEvidence.map((item) => `- ${item}`).join('\n')
    : '- No supporting confirmations recorded.';
  const reviewedAreas = record.reviewedAreas?.length
    ? record.reviewedAreas.map((area) => `- [x] Reviewed ${area} impact`).join('\n')
    : '- No dynamic review-focus confirmations recorded.';

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
    `## Review focus confirmations\n\n${reviewedAreas}\n\n` +
    `## Understanding gaps\n\n${gaps}\n\n` +
    `## Supporting confirmations\n\n${evidence}\n\n` +
    `## Understanding checklist\n\n` +
    checklist.map(([label, value]) => `- [${value ? 'x' : ' '}] ${label}`).join('\n') +
    `\n\n---\nGenerated locally by NODRA Human Check.\n`;
}
