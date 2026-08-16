import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ChangeSummary, parseNumstat, parseUntracked, summarizeChanges } from './changeAnalysis';

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 2 * 1024 * 1024
  });
  return stdout;
}

export async function analyzeWorkspace(cwd: string): Promise<ChangeSummary> {
  await git(cwd, ['rev-parse', '--is-inside-work-tree']);

  const [numstat, status] = await Promise.all([
    git(cwd, ['diff', '--numstat', 'HEAD', '--']),
    git(cwd, ['status', '--porcelain=v1', '--untracked-files=all'])
  ]);

  const tracked = parseNumstat(numstat);
  const untracked = parseUntracked(status, new Set(tracked.map((file) => file.path)));
  return summarizeChanges([...tracked, ...untracked]);
}
