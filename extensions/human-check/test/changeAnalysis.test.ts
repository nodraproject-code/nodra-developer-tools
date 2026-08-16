import assert from 'node:assert/strict';
import test from 'node:test';
import { detectSensitiveAreas, parseNumstat, parseUntracked, summarizeChanges } from '../src/changeAnalysis';
import { assessAttention, buildDecisionRecordMarkdown, buildUnderstandingFeedback, evaluateHumanSignal, getReviewFocusAreas, recommendCheck } from '../src/humanSignal';

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

test('adaptive guidance stays quick for routine changes and deep for high-impact changes', () => {
  const routine = summarizeChanges(parseNumstat('4\t1\tREADME.md\n'));
  assert.equal(assessAttention(routine), 'STANDARD');
  assert.equal(recommendCheck(routine), 'QUICK');

  const highImpact = summarizeChanges(parseNumstat('20\t10\tsrc/api/auth/session.ts\n12\t5\tsrc/data/users.ts\n'));
  assert.equal(assessAttention(highImpact), 'HIGH');
  assert.equal(recommendCheck(highImpact), 'DEEP');
});

test('review focus prioritizes sensitive areas and caps the interactive list', () => {
  const summary = summarizeChanges(parseNumstat(
    '1\t1\tsrc/api/auth/session.ts\n' +
    '1\t1\tsrc/data/users.ts\n' +
    '1\t1\tinfra/terraform/main.tf\n' +
    '1\t1\tpackage-lock.json\n' +
    '1\t1\tconfig/app.config.ts\n' +
    '1\t1\tsrc/components/Card.spec.tsx\n'
  ));
  const focus = getReviewFocusAreas(summary);
  assert.ok(focus.length <= 5);
  assert.equal(focus[0], 'authentication');
  assert.ok(focus.includes('data'));
  assert.ok(focus.includes('API'));
});

test('deep Human Signal remains needs-review until dynamic focus areas are confirmed', () => {
  const summary = summarizeChanges(parseNumstat('20\t10\tsrc/api/users.ts\n12\t5\tsrc/data/users.ts\n6000\t0\tinfra/terraform/main.tf\n'));
  const complete = {
    canDescribeChange: true,
    knowsArchitectureImpact: true,
    checkedSensitiveAreas: true,
    understandsWhyNeeded: true,
    understandsImpact: true
  };
  const focus = getReviewFocusAreas(summary);
  const explanation = 'I reviewed the API, data, and infrastructure changes and understand their impact and why they are needed.';

  const pending = buildUnderstandingFeedback(summary, explanation, complete, focus.slice(0, -1));
  assert.equal(pending.result, 'NEEDS_REVIEW');
  assert.ok(pending.gaps.some((gap) => gap.includes('Review focus not confirmed')));

  const confirmed = buildUnderstandingFeedback(summary, explanation, complete, focus);
  assert.equal(confirmed.result, 'UNDERSTOOD');
  assert.ok(confirmed.evidence.some((item) => item.includes('Review focus confirmed')));
});

test('understanding feedback explains missing confirmations and overlooked detected areas', () => {
  const summary = summarizeChanges(parseNumstat('20\t10\tsrc/api/users.ts\n12\t5\tsrc/data/users.ts\n6000\t0\tinfra/terraform/main.tf\n'));
  const feedback = buildUnderstandingFeedback(
    summary,
    'I reviewed the API change and understand why the endpoint contract was updated for callers.',
    {
      canDescribeChange: true,
      knowsArchitectureImpact: false,
      checkedSensitiveAreas: false,
      understandsWhyNeeded: true,
      understandsImpact: false
    },
    ['API']
  );

  assert.equal(feedback.result, 'NEEDS_REVIEW');
  assert.ok(feedback.gaps.some((gap) => gap.includes('Architecture impact')));
  assert.ok(feedback.gaps.some((gap) => gap.includes('data') || gap.includes('infrastructure')));
  assert.ok(feedback.evidence.some((item) => item.includes('developer-authored explanation')));
});

test('Decision Record uses additional context for understood decisions and carries NODRA signature', () => {
  const markdown = buildDecisionRecordMarkdown({
    timestamp: '2026-08-16T18:00:00.000Z',
    workspace: 'sample-workspace',
    filesChanged: 2,
    added: 32,
    removed: 15,
    areas: ['API', 'authentication'],
    attention: 'HIGH',
    recommendedCheck: 'DEEP',
    explanation: 'I reviewed the authentication and API impact and understand why this change is required.',
    checklist: {
      canDescribeChange: true,
      knowsArchitectureImpact: true,
      checkedSensitiveAreas: true,
      understandsWhyNeeded: true,
      understandsImpact: true
    },
    reviewedAreas: ['authentication', 'API'],
    result: 'UNDERSTOOD',
    understandingGaps: [],
    understandingEvidence: ['A developer-authored explanation was recorded.']
  });

  assert.match(markdown, /NODRA Decision Record/);
  assert.match(markdown, /Human Signal:\*\* UNDERSTOOD/);
  assert.match(markdown, /Recommended check:\*\* DEEP/);
  assert.match(markdown, /Review focus confirmations/);
  assert.match(markdown, /Reviewed authentication impact/);
  assert.match(markdown, /Additional context/);
  assert.match(markdown, /Supporting confirmations/);
  assert.match(markdown, /without including source code or diffs/);
  assert.match(markdown, /NODRA Network/);
  assert.match(markdown, /NODRA Protocol principles/);
});
