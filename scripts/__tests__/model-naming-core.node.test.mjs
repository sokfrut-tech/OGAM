import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {
  baseModelKey,
  determineCredibility,
  isOffGridHfRepo,
  isRawModelName,
  modelDisplayName,
  parseMoeParams,
  splitGgufModelName,
} from '../../src/utils/modelNamingCore.ts';

test('determineCredibility and isOffGridHfRepo classify model authors consistently', () => {
  assert.equal(isOffGridHfRepo('off-grid-ai/Qwen3-4B-GGUF'), true);
  assert.equal(isOffGridHfRepo('Qwen/Qwen3-4B-GGUF'), false);
  assert.equal(determineCredibility('off-grid-ai'), 'offgrid');
  assert.equal(determineCredibility('lmstudio-community'), 'lmstudio');
  assert.equal(determineCredibility('Qwen'), 'official');
  assert.equal(determineCredibility('bartowski'), 'verified-quantizer');
  assert.equal(determineCredibility('random-user-123'), 'community');
});

test('isRawModelName, splitGgufModelName, and modelDisplayName preserve human titles and strip GGUF noise', () => {
  assert.equal(isRawModelName('K2 Horizon 3.7B'), false);
  assert.equal(isRawModelName('K2-Horizon-4B-Q4_K_M.gguf'), true);
  assert.equal(isRawModelName('K2-Horizon-4B-Q4_K_M'), true);
  assert.equal(isRawModelName('LiquidAI/LFM2.5-8B-A1B-GGUF'), true);

  assert.equal(
    splitGgufModelName('DeepSeek-R1-Q4_K_M-00001-of-00003.gguf'),
    'DeepSeek-R1-Q4_K_M.gguf',
  );
  assert.equal(modelDisplayName('K2-Horizon-4B-Q4_K_M.gguf'), 'K2 Horizon 4B');
  assert.equal(modelDisplayName('K2-Horizon-4B-Q4_K_M'), 'K2 Horizon 4B');
  assert.equal(modelDisplayName('K2 Horizon 3.7B'), undefined);
});

test('parseMoeParams and baseModelKey normalize sparse MoE and mirror repo IDs', () => {
  assert.deepEqual(parseMoeParams('Qwen3-30B-A3B-Q4_K_M.gguf'), {
    totalParams: 30,
    activeParams: 3,
  });
  assert.deepEqual(parseMoeParams('LFM2.5-8B-A1B'), {
    totalParams: 8,
    activeParams: 1,
  });
  assert.equal(parseMoeParams('Qwen3-4B-Instruct.gguf'), null);

  assert.equal(baseModelKey('unsloth/Qwen3-4B-Instruct-2507-GGUF'), 'qwen3-4b-instruct-2507');
  assert.equal(baseModelKey('Qwen/Qwen3-4B-Instruct-2507-MLX'), 'qwen3-4b-instruct-2507');
});

test('migrated model naming files no longer import the legacy models package when cleared', () => {
  const legacyImport = new RegExp(`from\\s+['"]${'@offgrid'}/models['"]`);
  for (const file of [
    'src/components/ModelCard.tsx',
    'src/screens/DownloadManagerScreen/items.tsx',
    'src/screens/ModelsScreen/ImageModelsTab.tsx',
    'src/screens/ModelsScreen/ImagePicksRow.tsx',
  ]) {
    const content = fs.readFileSync(file, 'utf8');
    assert.ok(content.includes('utils/modelNamingCore'), `${file} must import utils/modelNamingCore`);
    assert.equal(legacyImport.test(content), false, `${file} still imports legacy models package`);
  }
});
