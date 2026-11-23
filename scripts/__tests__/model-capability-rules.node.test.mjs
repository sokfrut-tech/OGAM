import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {
  MOBILE_MTP_DRAFT_TOKENS,
  modelCardDeniesReasoning,
  modelCardUrl,
  prefersQ4_0,
} from '../../src/utils/modelCapabilityRules.ts';

test('prefersQ4_0 selects Q4_0 on Android CPU/NPU and Q4_K_M on GPU or iOS', () => {
  assert.equal(prefersQ4_0('android', 'cpu'), true);
  assert.equal(prefersQ4_0('android', 'npu'), true);
  assert.equal(prefersQ4_0('android', undefined), true);
  assert.equal(prefersQ4_0('android', 'gpu'), false);
  assert.equal(prefersQ4_0('ios', 'gpu'), false);
  assert.equal(prefersQ4_0('ios', 'cpu'), false);
});

test('modelCardUrl builds encoded Hugging Face raw README URLs', () => {
  assert.equal(
    modelCardUrl('LiquidAI/LFM3-Omni-2B'),
    'https://huggingface.co/LiquidAI/LFM3-Omni-2B/raw/main/README.md',
  );
  assert.equal(
    modelCardUrl('org/model', 'rev/a b'),
    'https://huggingface.co/org/model/raw/rev%2Fa%20b/README.md',
  );
});

test('modelCardDeniesReasoning detects explicit non-reasoning model cards without false positives', () => {
  assert.equal(modelCardDeniesReasoning('This is a non-reasoning model tuned for fast chat.'), true);
  assert.equal(modelCardDeniesReasoning('Does not support reasoning mode.'), true);
  assert.equal(modelCardDeniesReasoning('Supports <think> reasoning tags and tool calls.'), false);
  assert.equal(MOBILE_MTP_DRAFT_TOKENS, 3);
});

test('migrated model capability consumers no longer import those symbols from @offgrid/models', () => {
  const legacyImport = new RegExp(`from\\s+['"]${'@offgrid'}/models['"]`);
  for (const file of [
    'src/services/modelCardReasoning.ts',
    'src/services/modelCatalogFiles.ts',
    'src/components/settings/SpeculativeDecodingToggle.tsx',
  ]) {
    const content = fs.readFileSync(file, 'utf8');
    assert.ok(content.includes('utils/modelCapabilityRules'), `${file} must import utils/modelCapabilityRules`);
    assert.equal(legacyImport.test(content), false, `${file} still imports legacy models package`);
  }
});
