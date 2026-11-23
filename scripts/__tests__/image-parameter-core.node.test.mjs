import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {
  effectiveImageParameter,
  resolveImageParameters,
  setImageParameterOverride,
  standardImageModelDefaults,
} from '../../src/utils/imageParameterCore.ts';

test('standardImageModelDefaults classifies few-step lightning/turbo models below 50 steps', () => {
  const lightning = standardImageModelDefaults('RealVisXL v5.0 Lightning (Light)');
  assert.equal(lightning.fewStep, true);
  assert.ok(lightning.defaultSteps < 50);
  assert.ok(lightning.defaultSize >= 512);

  const sd15 = standardImageModelDefaults('DreamShaper 8');
  assert.equal(sd15.fewStep, false);
  assert.equal(sd15.defaultSteps, 20);
  assert.equal(sd15.defaultSize, 512);
});

test('effectiveImageParameter and resolveImageParameters fall back from invalid overrides', () => {
  assert.equal(effectiveImageParameter(12, 20), 12);
  assert.equal(effectiveImageParameter(0, 20), 20);
  assert.equal(effectiveImageParameter(Number.NaN, 20), 20);
  assert.equal(effectiveImageParameter(undefined, 7.5), 7.5);

  const defaults = resolveImageParameters({ id: 'realvisxl-lightning', name: 'RealVisXL v5.0 Lightning (Light)' });
  assert.deepEqual(defaults, {
    steps: 4,
    cfgScale: 2.0,
    size: 768,
  });

  const withOverride = resolveImageParameters(
    { id: 'realvisxl-lightning', name: 'RealVisXL v5.0 Lightning (Light)' },
    { 'realvisxl-lightning': { steps: 6, cfgScale: 3, size: 512 } },
  );
  assert.deepEqual(withOverride, { steps: 6, cfgScale: 3, size: 512 });
});

test('setImageParameterOverride updates one field immutably per model ID', () => {
  const initial = { other: { steps: 30 } };
  const next = setImageParameterOverride(initial, 'm1', 'steps', 8);
  const updated = setImageParameterOverride(next, 'm1', 'cfgScale', 3.5);

  assert.deepEqual(initial, { other: { steps: 30 } });
  assert.deepEqual(updated, {
    other: { steps: 30 },
    m1: { steps: 8, cfgScale: 3.5 },
  });
});

test('image parameter policy consumers import utils/imageParameterCore', () => {
  for (const file of [
    'src/services/imageParameterPolicy.ts',
    'src/hooks/useImageGenerationSettings.ts',
    '__tests__/integration/image/imageParameterPolicy.test.ts',
  ]) {
    const content = fs.readFileSync(file, 'utf8');
    assert.ok(content.includes('utils/imageParameterCore'), `${file} must import utils/imageParameterCore`);
  }
});
