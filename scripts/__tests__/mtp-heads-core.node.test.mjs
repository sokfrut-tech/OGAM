import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MTP_HEAD_CATALOG,
  mtpHeadForPrimaryFile,
  mtpHeadForModel,
} from '../../src/utils/mtpHeadsCore.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('MTP_HEAD_CATALOG exposes all 4 Gemma 4 Q8_0 heads with valid SHA-256 and HTTPS URLs', () => {
  assert.equal(Array.isArray(MTP_HEAD_CATALOG), true);
  assert.equal(MTP_HEAD_CATALOG.length, 4);

  const expected = new Map([
    ['gemma-4-e2b-it', { sizeBytes: 97817664, sha256: '9eba819938efccfd6044f8af84e3bbfddc639a2bcf32ebc36420e6a649191919' }],
    ['gemma-4-e4b-it', { sizeBytes: 98653248, sha256: 'b6a723115efa510d3b3215db1e26790dae84cd08c2134a764f3d194f1f0c3376' }],
    ['gemma-4-26b-a4b-it', { sizeBytes: 461766816, sha256: '6326fb9f5e487aa8dcdd313a091e3c67724cb2a666ec3b7d2895b5b26d93ed1b' }],
    ['gemma-4-31b-it', { sizeBytes: 514687104, sha256: '5ae8b0117bed601e8924c6305bd5b0585de361d51f0e77091bcb4252cf1f27de' }],
  ]);

  for (const entry of MTP_HEAD_CATALOG) {
    assert.match(entry.head.sha256, /^[0-9a-f]{64}$/);
    assert.ok(entry.head.sizeBytes > 0);
    assert.ok(entry.head.name.endsWith('.gguf'));
    assert.ok(entry.head.url.startsWith('https://'));

    const spec = expected.get(entry.modelKey);
    assert.ok(spec, `unexpected MTP head modelKey: ${entry.modelKey}`);
    assert.equal(entry.head.sizeBytes, spec.sizeBytes);
    assert.equal(entry.head.sha256, spec.sha256);
    expected.delete(entry.modelKey);
  }

  assert.equal(expected.size, 0);
});

test('mtpHeadForModel and mtpHeadForPrimaryFile resolve Gemma 4 targets and reject companions/non-MTP', () => {
  const e2b = mtpHeadForModel('gemma-4-e2b-it');
  assert.ok(e2b);
  assert.equal(e2b.sizeBytes, 97817664);

  const e4b = mtpHeadForPrimaryFile('google_gemma-4-E4B-it-Q4_K_M.gguf');
  assert.ok(e4b);
  assert.equal(e4b.sizeBytes, 98653248);

  const moe26b = mtpHeadForModel('unsloth/gemma-4-26B-A4B-it-GGUF');
  assert.ok(moe26b);
  assert.equal(moe26b.sizeBytes, 461766816);

  const dense31b = mtpHeadForPrimaryFile('gemma-4-31b-it-Q4_K_M.gguf');
  assert.ok(dense31b);
  assert.equal(dense31b.sizeBytes, 514687104);

  assert.equal(mtpHeadForPrimaryFile('mmproj-gemma-4-E2B-it-f16.gguf'), null);
  assert.equal(mtpHeadForPrimaryFile('mtp-gemma-4-E2B-it-Q8_0.gguf'), null);
  assert.equal(mtpHeadForModel('Qwen2.5-7B-Instruct'), null);
  assert.equal(mtpHeadForPrimaryFile('Qwen2.5-7B-Instruct-Q4_K_M.gguf'), null);
  assert.equal(mtpHeadForPrimaryFile(''), null);
});

test('Slice 9 MTP modules no longer import from @offgrid/models', () => {
  const clearedFiles = [
    'src/utils/mtpHeadsCore.ts',
    'src/services/mtpHeads.ts',
    'src/services/startModelDownload.ts',
    'src/services/modelManager/downloadHelpers.ts',
    'src/screens/ModelsScreen/utils.ts',
  ];

  for (const rel of clearedFiles) {
    const src = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    assert.doesNotMatch(src, /from\s+['"]@offgrid\/models(?:\/[^'"]*)?['"]/, `${rel} still imports @offgrid/models`);
  }
});
