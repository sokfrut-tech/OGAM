import test from 'node:test';
import assert from 'node:assert/strict';
import { isCompanionFile, isDraftModelFile, isImatrixFile, isMtpHeadFile } from '../../src/utils/modelCompanionFiles.ts';

test('recognizes MTP, draft and imatrix companion artifacts', () => {
  for (const name of [
    '/models/Qwen3.5-9B-MTP-ONLY-Q4_K_M.gguf',
    '/models/MTP/mtp-gemma-4-E4B-it-Q8_0.gguf',
    '/models/mtp-Qwen3.8-27B-Q4_0.gguf',
    '/models/Qwen3.5-9B-DFlash-Q4_0.gguf',
    '/models/Spark-X2.6-4B-imatrix.gguf',
  ]) assert.equal(isCompanionFile(name), true, name);
});

test('keeps ordinary model files eligible as primary weights', () => {
  for (const name of ['Qwen3.5-9B-Q4_K_M.gguf','gemma-4-E4B-it-Q8_0.gguf']) {
    assert.equal(isCompanionFile(name), false, name);
  }
});

test('exposes specific MTP, draft and imatrix classifications', () => {
  assert.equal(isMtpHeadFile('mtp-Qwen3.8-27B-Q4_0.gguf'), true);
  assert.equal(isDraftModelFile('Qwen3.5-9B-DFlash-Q4_0.gguf'), true);
  assert.equal(isImatrixFile('Spark-X2.6-4B-imatrix.gguf'), true);
});
