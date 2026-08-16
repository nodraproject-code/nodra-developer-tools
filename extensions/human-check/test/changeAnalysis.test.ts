import assert from 'node:assert/strict';
import test from 'node:test';
import { detectSensitiveAreas, parseNumstat, parseUntracked, summarizeChanges } from '../src/changeAnalysis';
import { evaluateHumanSignal } from '../src/humanSignal';

test('detects sensitive areas from paths without reading file content', () => {
  assert.deepEqual(detectSensitiveAreas('src/api/auth/session.ts'), ['API', 'authentication']);
  assert.deepEqual(detectSensitiveAreas('infra/terraform/main.tf'), ['infrastructure']);
  assert.deepEqual(detectSensitiveAreas('src/components/Login.spec.tsx'), ['tests', 'UI']);
  assert.deepEqual(detectSensitiveAreas('package-lock.json'), ['dependencies']);
});

test('parses git numstat and summarizes line counts', () => {
  const files = parseNumstat('12\t3\tsrc/api/users.ts\n5\t0\tsrc/components/Card.tsx\n-\t-\tmedia/icon.png\n');
  const summary = summarizeChanges(files);
  assert.equal(summary.files.length, 3);
  assert.equal(summary.added, 17);
  assert.equal(summary.removed, 3);
  assert.ok(summary.areas.includes('API'));
  assert.ok(summary.areas.includes('UI'));
});

test('adds untracked paths without duplicating tracked paths', () => {
  const files = parseUntracked('?? src/api/new.ts\n?? README.md\n', new Set(['README.md']));
  assert.equal(files.length, 1);
  assert.equal(files[0]?.path, 'src/api/new.ts');
  assert.equal(files[0]?.untracked, true);
  assert.deepEqual(files[0]?.areas, ['API']);
});

test('Human Signal result requires explanation and complete understanding', () => {
  const complete = {
    canDescribeChange: true,
    knowsArchitectureImpact: true,
    checkedSensitiveAreas: true,
    understandsWhyNeeded: true,
    understandsImpact: true
  };
  assert.equal(evaluateHumanSignal('Short', complete), 'REVISIT');
  assert.equal(evaluateHumanSignal('I understand this change updates the API contract and why the caller needs it.', complete), 'UNDERSTOOD');
  assert.equal(evaluateHumanSignal('I understand this change updates the API contract and why the caller needs it.', { ...complete, understandsImpact: false }), 'NEEDS_REVIEW');
});
