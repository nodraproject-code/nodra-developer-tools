import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, realpath, stat } from 'node:fs/promises';
import * as path from 'node:path';
import { ChangeSummary, ChangedFile, detectSensitiveAreas, summarizeChanges } from './changeAnalysis';
import { RepositoryIdentity } from './git';

export interface LocalSnapshotEntry {
  hash: string;
  size: number;
}

export type LocalSnapshot = Record<string, LocalSnapshotEntry>;
export type LocalChangeKind = 'new' | 'modified' | 'deleted';

export interface LocalFolderAnalysis {
  summary: ChangeSummary;
  counts: Record<LocalChangeKind, number>;
}

const IGNORED_DIRECTORIES = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.angular', '.next', 'coverage',
  '.nuxt', '.svelte-kit', '.cache', '.parcel-cache', '.turbo', '.vite', 'target', 'bin', 'obj'
]);

function normalizeRelativePath(value: string): string {
  return value.split(path.sep).join('/');
}

function folderKey(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 24);
}

async function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function scanDirectory(root: string, current: string, snapshot: LocalSnapshot): Promise<void> {
  const entries = await readdir(current, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const absolutePath = path.join(current, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name.toLowerCase())) continue;
      await scanDirectory(root, absolutePath, snapshot);
      continue;
    }

    if (!entry.isFile()) continue;
    const fileStat = await stat(absolutePath);
    const relativePath = normalizeRelativePath(path.relative(root, absolutePath));
    snapshot[relativePath] = { hash: await hashFile(absolutePath), size: fileStat.size };
  }
}

export async function createLocalSnapshot(root: string): Promise<LocalSnapshot> {
  const snapshot: LocalSnapshot = {};
  await scanDirectory(root, root, snapshot);
  return snapshot;
}

export async function resolveLocalFolderIdentity(cwd: string, workspaceName: string): Promise<RepositoryIdentity> {
  let canonicalPath = path.resolve(cwd);
  try {
    canonicalPath = await realpath(cwd);
  } catch {
    // The resolved workspace path is stable enough if realpath is unavailable.
  }
  return { key: folderKey(canonicalPath), label: `${workspaceName} · Local folder mode` };
}

export function compareLocalSnapshots(baseline: LocalSnapshot, current: LocalSnapshot): LocalFolderAnalysis {
  const counts: Record<LocalChangeKind, number> = { new: 0, modified: 0, deleted: 0 };
  const files: ChangedFile[] = [];
  const allPaths = new Set([...Object.keys(baseline), ...Object.keys(current)]);

  for (const filePath of [...allPaths].sort()) {
    const before = baseline[filePath];
    const after = current[filePath];
    let kind: LocalChangeKind | undefined;
    if (!before && after) kind = 'new';
    else if (before && !after) kind = 'deleted';
    else if (before && after && (before.hash !== after.hash || before.size !== after.size)) kind = 'modified';
    if (!kind) continue;

    counts[kind] += 1;
    files.push({
      path: `${filePath} [${kind}]`,
      added: 0,
      removed: 0,
      untracked: kind === 'new',
      areas: detectSensitiveAreas(filePath)
    });
  }

  return { summary: summarizeChanges(files), counts };
}

export function isIgnoredDirectory(name: string): boolean {
  return IGNORED_DIRECTORIES.has(name.toLowerCase());
}
