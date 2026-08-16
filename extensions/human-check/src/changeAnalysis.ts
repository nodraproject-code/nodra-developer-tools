export type SensitiveArea =
  | 'API'
  | 'authentication'
  | 'data'
  | 'dependencies'
  | 'infrastructure'
  | 'configuration'
  | 'tests'
  | 'UI';

export interface ChangedFile {
  path: string;
  added: number;
  removed: number;
  untracked?: boolean;
  areas: SensitiveArea[];
}

export interface ChangeSummary {
  files: ChangedFile[];
  added: number;
  removed: number;
  areas: SensitiveArea[];
}

const rules: ReadonlyArray<{ area: SensitiveArea; patterns: RegExp[] }> = [
  { area: 'API', patterns: [/(^|\/)(api|apis|routes?|controllers?|endpoints?)(\/|$)/i, /openapi|swagger/i] },
  { area: 'authentication', patterns: [/(^|\/)(auth|authentication|authorization|identity|oauth|session)(\/|$)/i, /jwt|permission|rbac/i] },
  { area: 'data', patterns: [/(^|\/)(data|db|database|models?|schemas?|migrations?|repositories)(\/|$)/i, /prisma|firestore|sql/i] },
  { area: 'dependencies', patterns: [/(^|\/)(package(-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|requirements\.txt|poetry\.lock|go\.mod|cargo\.toml)$/i] },
  { area: 'infrastructure', patterns: [/(^|\/)(infra|infrastructure|terraform|k8s|kubernetes|helm|docker)(\/|$)/i, /dockerfile|\.tf$/i] },
  { area: 'configuration', patterns: [/(^|\/)(config|configuration|settings)(\/|$)/i, /(^|\/)\.env(\.|$)|\.ya?ml$|\.toml$|\.ini$/i] },
  { area: 'tests', patterns: [/(^|\/)(__tests__|tests?|specs?)(\/|$)/i, /\.(test|spec)\.[^/]+$/i] },
  { area: 'UI', patterns: [/(^|\/)(ui|views?|components?|pages?|styles?|frontend|client)(\/|$)/i, /\.(css|scss|sass|less|html|vue|svelte)$/i] }
];

export function detectSensitiveAreas(path: string): SensitiveArea[] {
  return rules.filter(({ patterns }) => patterns.some((pattern) => pattern.test(path))).map(({ area }) => area);
}

export function parseNumstat(output: string): ChangedFile[] {
  if (!output.trim()) return [];

  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [addedRaw, removedRaw, ...pathParts] = line.split('\t');
      const path = pathParts.join('\t');
      const added = addedRaw === '-' ? 0 : Number.parseInt(addedRaw, 10) || 0;
      const removed = removedRaw === '-' ? 0 : Number.parseInt(removedRaw, 10) || 0;
      return { path, added, removed, areas: detectSensitiveAreas(path) };
    });
}

export function parseUntracked(output: string, existingPaths: ReadonlySet<string> = new Set()): ChangedFile[] {
  if (!output.trim()) return [];

  return output
    .split(/\r?\n/)
    .filter((line) => line.startsWith('?? '))
    .map((line) => line.slice(3))
    .filter((path) => !existingPaths.has(path))
    .map((path) => ({ path, added: 0, removed: 0, untracked: true, areas: detectSensitiveAreas(path) }));
}

export function summarizeChanges(files: ChangedFile[]): ChangeSummary {
  const areas = Array.from(new Set(files.flatMap((file) => file.areas)));
  return {
    files,
    added: files.reduce((sum, file) => sum + file.added, 0),
    removed: files.reduce((sum, file) => sum + file.removed, 0),
    areas
  };
}
