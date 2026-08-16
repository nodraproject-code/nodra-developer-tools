export type HumanCheckResult = 'UNDERSTOOD' | 'NEEDS_REVIEW' | 'REVISIT';

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
