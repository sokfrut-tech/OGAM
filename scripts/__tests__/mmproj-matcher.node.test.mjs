import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { modelIdentityStem, projectorsFor } from '../../src/utils/mmprojMatcher.ts';

const E2B = 'gemma-4-E2B-it-Q4_K_M.gguf';
const E2B_MMPROJ = 'gemma-4-E2B-it-Q4_K_M-mmproj.gguf';
const E4B_MMPROJ = 'gemma-4-E4B-it-Q4_K_M-mmproj.gguf';

test('modelIdentityStem strips quantizations and mmproj markers while preserving E2B vs E4B variants', () => {
  assert.equal(modelIdentityStem(E2B), 'gemma-4-e2b-it');
  assert.equal(modelIdentityStem(E2B_MMPROJ), 'gemma-4-e2b-it');
  assert.equal(modelIdentityStem('gemma-4-E2B-it-Q8_0-mmproj.gguf'), 'gemma-4-e2b-it');
  assert.equal(modelIdentityStem(E4B_MMPROJ), 'gemma-4-e4b-it');
  assert.equal(modelIdentityStem('mmproj-F16.gguf'), '');
});

test('projectorsFor matches exact variant across quants, rejects foreign variants, and falls back to generic projectors', () => {
  const mixed = [
    { rfilename: E4B_MMPROJ },
    { rfilename: 'gemma-4-E2B-it-Q8_0-mmproj.gguf' },
  ];
  assert.deepEqual(
    projectorsFor(E2B, mixed).map((c) => c.rfilename),
    ['gemma-4-E2B-it-Q8_0-mmproj.gguf'],
  );

  // Never mispair E2B with E4B when E2B projector is missing.
  assert.deepEqual(projectorsFor(E2B, [{ rfilename: E4B_MMPROJ }]), []);
  assert.deepEqual(
    projectorsFor(E2B, [
      { rfilename: 'Qwen3.5-0.8B-Q4_K_M-mmproj.gguf' },
      { rfilename: 'SmolVLM2-2.2B-Instruct-Q4_K_M-mmproj.gguf' },
      { rfilename: E4B_MMPROJ },
    ]),
    [],
  );

  // Generic repo-level projector is accepted only when stemless.
  assert.deepEqual(
    projectorsFor('Qwen3-VL-2B-Instruct-Q4_K_M.gguf', [
      { rfilename: 'Qwen3-VL-2B-Instruct-Q4_K_M.gguf' },
      { rfilename: 'mmproj-F16.gguf' },
    ]).map((c) => c.rfilename),
    ['mmproj-F16.gguf'],
  );

  // Strip packaging tokens (UD, QAD) and moondream `-text-model` suffix.
  assert.equal(modelIdentityStem('Mistral-Small-3.1-24B-Instruct-2503-UD-IQ2_M.gguf'), 'mistral-small-3.1-24b-instruct-2503');
  assert.equal(modelIdentityStem('moondream2-text-model-f16.gguf'), 'moondream2');
  assert.equal(modelIdentityStem('LFM3-VL-2B-QAD-Q4_K_M.gguf'), 'lfm3-vl-2b');
});

test('mmproj.ts imports utilities from utils/mmprojMatcher', () => {
  const content = fs.readFileSync('src/services/mmproj.ts', 'utf8');
  const legacyImport = new RegExp(`from\\s+['"]${'@offgrid'}/models['"]`);
  assert.ok(content.includes('utils/mmprojMatcher'));
  assert.equal(legacyImport.test(content), false);
});
