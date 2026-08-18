import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import test from 'node:test';
import { compareLocalSnapshots, createLocalSnapshot, isIgnoredDirectory } from '../src/localFolder';

test('local snapshot stores hashes and metadata without source content', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'nodra-human-check-'));
  try {
    await writeFile(path.join(root, 'app.ts'), 'const secret = "local only";\n', 'utf8');
    const snapshot = await createLocalSnapshot(root);
    assert.deepEqual(Object.keys(snapshot), ['app.ts']);
    assert.equal(typeof snapshot['app.ts'].hash, 'string');
    assert.equal(snapshot['app.ts'].hash.length, 64);
    assert.equal(snapshot['app.ts'].size > 0, true);
    assert.equal('content' in snapshot['app.ts'], false);
    assert.equal(JSON.stringify(snapshot).includes('local only'), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('local snapshot excludes generated and heavy directories', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'nodra-human-check-'));
  try {
    await mkdir(path.join(root, 'src'), { recursive: true });
    await mkdir(path.join(root, 'node_modules', 'pkg'), { recursive: true });
    await mkdir(path.join(root, 'dist'), { recursive: true });
    await writeFile(path.join(root, 'src', 'app.ts'), 'export const app = true;\n', 'utf8');
    await writeFile(path.join(root, 'node_modules', 'pkg', 'index.js'), 'generated', 'utf8');
    await writeFile(path.join(root, 'dist', 'bundle.js'), 'generated', 'utf8');
    const snapshot = await createLocalSnapshot(root);
    assert.deepEqual(Object.keys(snapshot), ['src/app.ts']);
    assert.equal(isIgnoredDirectory('.next'), true);
    assert.equal(isIgnoredDirectory('coverage'), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('local comparison detects new, modified and deleted files against baseline', () => {
  const baseline = {
    'src/keep.ts': { hash: 'same', size: 10 },
    'src/change.ts': { hash: 'before', size: 20 },
    'src/delete.ts': { hash: 'delete', size: 30 }
  };
  const current = {
    'src/keep.ts': { hash: 'same', size: 10 },
    'src/change.ts': { hash: 'after', size: 21 },
    'src/new.ts': { hash: 'new', size: 5 }
  };

  const analysis = compareLocalSnapshots(baseline, current);
  assert.deepEqual(analysis.counts, { new: 1, modified: 1, deleted: 1 });
  assert.deepEqual(
    analysis.summary.files.map((file) => file.path),
    ['src/change.ts [modified]', 'src/delete.ts [deleted]', 'src/new.ts [new]']
  );
});
