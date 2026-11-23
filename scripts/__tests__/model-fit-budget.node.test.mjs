import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  PHONE_FIT_BUDGET,
  phoneFitBudget,
  fitTier,
  isLoadableOnDevice,
  fitLabel,
} from '../../src/utils/modelFitBudget.ts';
import { reasoningBudgetPayload } from '../../src/utils/reasoningBudget.ts';

const LEGACY_MODELS_PKG = `${'@offgrid'}/models`;

test('fitTier, PHONE_FIT_BUDGET, and phoneFitBudget enforce exact >= ceiling and platform budgets', () => {
  assert.deepEqual(PHONE_FIT_BUDGET, { comfortable: 0.45, tight: 0.62, ceil: 0.62 });
  assert.deepEqual(phoneFitBudget('android'), PHONE_FIT_BUDGET);
  assert.deepEqual(phoneFitBudget('ios'), { comfortable: 0.5, tight: 0.7, ceil: 0.7 });

  const ramGB = 4;
  const exactCeilingGB = ramGB * PHONE_FIT_BUDGET.ceil;
  assert.equal(fitTier(exactCeilingGB, ramGB), 'wontFit');
  assert.equal(isLoadableOnDevice(exactCeilingGB, ramGB), false);
  assert.equal(fitTier(exactCeilingGB - 0.0001, ramGB), 'tight');
  assert.equal(isLoadableOnDevice(exactCeilingGB - 0.0001, ramGB), true);
  assert.equal(fitTier(1.0, ramGB), 'runsWell');

  // 7.3 GB GGUF chat model fits a 11.2 GB iPhone (0.70 ceil = 7.84 GB) but not strict 0.62 budget (6.944 GB).
  assert.equal(isLoadableOnDevice(7.3, 11.2, phoneFitBudget('ios')), true);
  assert.equal(isLoadableOnDevice(7.3, 11.2, PHONE_FIT_BUDGET), false);

  assert.equal(fitLabel('runsWell'), 'Runs well');
  assert.equal(fitLabel('tight'), 'Tight');
  assert.equal(fitLabel('wontFit'), 'Too big');
});

test('reasoningBudgetPayload formats explicit remote-vision thinking token budgets', () => {
  assert.deepEqual(reasoningBudgetPayload(false, 2048), {});
  assert.deepEqual(reasoningBudgetPayload(true, 0), {});
  assert.deepEqual(reasoningBudgetPayload(true, -1), {});
  assert.deepEqual(reasoningBudgetPayload(true, 4096.8), { reasoning_budget_tokens: 4096 });
});

test('migrated fit budget and reasoning payload files drop legacy models imports', () => {
  const importPattern = new RegExp(`(?:from\\s*|require\\(\\s*)['"]${LEGACY_MODELS_PKG}`);
  for (const rel of [
    'src/services/memoryBudget.ts',
    'src/services/llmSafetyChecks.ts',
    'src/services/providers/openAICompatibleProvider.ts',
    '__tests__/integration/models/detailFilesFitHintUsesOwnedBudget.rendered.test.tsx',
  ]) {
    const src = fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
    assert.equal(importPattern.test(src), false, `${rel} should not import ${LEGACY_MODELS_PKG}`);
  }
  for (const rel of [
    'src/screens/ModelsScreen/TextModelsTab.tsx',
    'src/services/devicePicks.ts',
  ]) {
    const src = fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
    assert.equal(src.includes('utils/modelFitBudget'), true, `${rel} should import utils/modelFitBudget`);
  }
});
