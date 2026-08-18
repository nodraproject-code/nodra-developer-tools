import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { ChangeSummary, parseNumstat, parseUntracked, summarizeChanges } from './changeAnalysis';

const execFileAsync = promisify(execFile);

export interface RepositoryIdentity {
  key: string;
  label: string;
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 2 * 1024 * 1024
  });
  return stdout;
}

function repositoryKey(value: string): string {
  return createHash('sha256').update(value.trim()).digest('hex').slice(0, 24);
}

export async function isGitWorkspace(cwd: string): Promise<boolean> {
  try {
    return (await git(cwd, ['rev-parse', '--is-inside-work-tree'])).trim() === 'true';
  } catch {
    return false;
  }
}

export async function resolveRepositoryIdentity(cwd: string, workspaceName: string): Promise<RepositoryIdentity> {
  const root = (await git(cwd, ['rev-parse', '--show-toplevel'])).trim();
  let source = root;

  try {
    const origin = (await git(cwd, ['remote', 'get-url', 'origin'])).trim();
    if (origin) source = origin;
  } catch {
    // Repositories without an origin remote are identified by their local Git root.
  }

  return {
    key: repositoryKey(source),
    label: `${workspaceName} · Git mode`
  };
}

export async function analyzeWorkspace(cwd: string): Promise<ChangeSummary> {
  const [numstat, status] = await Promise.all([
    git(cwd, ['diff', '--numstat', 'HEAD', '--']),
    git(cwd, ['status', '--porcelain=v1', '--untracked-files=all'])
  ]);

  const tracked = parseNumstat(numstat);
  const untracked = parseUntracked(status, new Set(tracked.map((file) => file.path)));
  return summarizeChanges([...tracked, ...untracked]);
}
