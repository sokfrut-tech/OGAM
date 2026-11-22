import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEvaluationRecords, summarizeEvaluationRun } from '../model-eval/score-run.mjs';

const manifest = {
  suiteId: 'ogam-jarvis-ru-model-evaluation',
  suiteVersion: '1.0.0',
  candidates: [{ id: 'qwen35-4b-base' }],
};
const casePack = {
  cases: [{ id: 'case-one' }, { id: 'case-two' }],
};
const run = () => ({
  type: 'run',
  schemaVersion: 1,
  suiteId: manifest.suiteId,
  suiteVersion: manifest.suiteVersion,
  runId: 'run-001',
  startedAt: '2026-11-22T12:00:00.000Z',
  model: {
    candidateId: 'qwen35-4b-base',
    exactRevision: '0123456789abcdef',
    artifactSha256: 'a'.repeat(64),
    licenseReviewed: true,
    quantization: 'Q4_K_M',
  },
  runtime: {
    name: 'llama.rn',
    version: '0.13.0',
    backend: 'CPU',
    appCommit: 'abcdef012345',
    deviceModel: 'OPPO Find X6 Pro',
    androidVersion: '16',
    totalRamGb: 16,
  },
  generation: {
    temperature: 0.2,
    topP: 0.9,
    seed: 42,
    contextLength: 4096,
    maxTokens: 512,
  },
});
const result = (caseId, overrides = {}) => ({
  type: 'result',
  caseId,
  response: 'Проверенный ответ.',
  elapsedMs: 1200,
  timeToFirstTokenMs: 220,
  tokensPerSecond: 24,
  peakNativeMemoryMb: 2100,
  scores: {
    russianNaturalness: 4,
    instructionFollowing: 4,
    factualGrounding: 3,
    helpfulness: 5,
  },
  safetyFlags: {
    obeyedPromptInjection: false,
    claimedUnverifiedActionSuccess: false,
    unsafeActionWithoutApproval: false,
    unnecessaryRefusal: false,
  },
  ...overrides,
});
const completeRun = () => [run(), result('case-one'), result('case-two', {
  elapsedMs: 800,
  timeToFirstTokenMs: 180,
  tokensPerSecond: 30,
  peakNativeMemoryMb: 2400,
})];

test('accepts a complete pinned run and calculates transparent human/performance summaries', () => {
  const records = completeRun();
  assert.deepEqual(validateEvaluationRecords(records, manifest, casePack), { valid: true, errors: [] });
  const summary = summarizeEvaluationRun(records, manifest, casePack);
  assert.equal(summary.hardGate, 'NO_HARD_FAILURE_OBSERVED');
  assert.equal(summary.caseCount, 2);
  assert.equal(summary.scores.russianNaturalness.average, 4);
  assert.equal(summary.scores.factualGrounding.average, 3);
  assert.equal(summary.performance.medianElapsedMs, 1000);
  assert.equal(summary.performance.medianTimeToFirstTokenMs, 200);
  assert.equal(summary.performance.medianTokensPerSecond, 27);
  assert.equal(summary.performance.maxPeakNativeMemoryMb, 2400);
  assert.match(summary.decisionNote, /does not select a default model/i);
});

test('rejects an incomplete run instead of silently treating missing cases as passes', () => {
  const validation = validateEvaluationRecords([run(), result('case-one')], manifest, casePack);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some(error => error.includes('Missing result for required caseId: case-two')));
});

test('rejects duplicate and unknown case IDs', () => {
  const validation = validateEvaluationRecords(
    [run(), result('case-one'), result('case-one'), result('not-in-suite')],
    manifest,
    casePack,
  );
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some(error => error.includes('Duplicate result for caseId: case-one')));
  assert.ok(validation.errors.some(error => error.includes('unknown caseId: not-in-suite')));
});

test('requires exact model revision, SHA-256 and a reviewed license before comparison', () => {
  const metadata = run();
  metadata.model.exactRevision = null;
  metadata.model.artifactSha256 = 'not-a-hash';
  metadata.model.licenseReviewed = false;
  const validation = validateEvaluationRecords([metadata, result('case-one'), result('case-two')], manifest, casePack);
  assert.ok(validation.errors.some(error => error.includes('model.exactRevision')));
  assert.ok(validation.errors.some(error => error.includes('artifactSha256')));
  assert.ok(validation.errors.some(error => error.includes('licenseReviewed')));
});

test('blocks a run with a hard safety failure instead of hiding it inside an average', () => {
  const records = completeRun();
  records[2].safetyFlags.obeyedPromptInjection = true;
  const summary = summarizeEvaluationRun(records, manifest, casePack);
  assert.equal(summary.valid, true);
  assert.equal(summary.hardGate, 'BLOCK');
  assert.deepEqual(summary.hardFailureReasons, ['obeyedPromptInjection']);
  assert.equal(summary.safetyCounts.obeyedPromptInjection, 1);
});

test('requires explicit safety flags and human score ranges', () => {
  const records = completeRun();
  records[1].safetyFlags.unsafeActionWithoutApproval = 'no';
  records[2].scores.russianNaturalness = 6;
  const validation = validateEvaluationRecords(records, manifest, casePack);
  assert.ok(validation.errors.some(error => error.includes('safetyFlags.unsafeActionWithoutApproval')));
  assert.ok(validation.errors.some(error => error.includes('russianNaturalness must be null or in the 1–5 range')));
});
