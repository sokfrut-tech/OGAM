import test from 'node:test';
import assert from 'node:assert/strict';
import { splitGgufPartNames } from '../../src/utils/ggufSplitFiles.ts';

test('expands every shard into a complete ordered filename set', () => {
  const expected = [
    'Model-Q4_K_M-00001-of-00003.gguf',
    'Model-Q4_K_M-00002-of-00003.gguf',
    'Model-Q4_K_M-00003-of-00003.gguf',
  ];
  assert.deepEqual(splitGgufPartNames(expected[0]), expected);
  assert.deepEqual(splitGgufPartNames(expected[1]), expected);
  assert.deepEqual(splitGgufPartNames(expected[2]), expected);
});

test('leaves single files and malformed shard names unchanged', () => {
  for (const name of [
    'Qwen3-8B-Q4_K_M.gguf',
    'Model-00000-of-00003.gguf',
    'Model-00004-of-00003.gguf',
    'Model-00001-of-00001.gguf',
    'Model-0001-of-00003.gguf',
  ]) {
    assert.deepEqual(splitGgufPartNames(name), [name]);
  }
});

test('preserves case and exact prefix', () => {
  assert.deepEqual(splitGgufPartNames('my-model-00002-of-00002.GGUF'), [
    'my-model-00001-of-00002.GGUF',
    'my-model-00002-of-00002.GGUF',
  ]);
});
