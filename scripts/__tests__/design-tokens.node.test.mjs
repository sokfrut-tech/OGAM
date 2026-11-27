import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALIVE,
  COLORS_DARK,
  COLORS_LIGHT,
  FONTS,
  LIVING_FIELD,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
} from '../../src/theme/designTokens.ts';

test('COLORS_LIGHT and COLORS_DARK expose matching keys and valid color strings', () => {
  const lightKeys = Object.keys(COLORS_LIGHT).sort();
  const darkKeys = Object.keys(COLORS_DARK).sort();
  assert.deepEqual(lightKeys, darkKeys);
  assert.ok(lightKeys.length >= 20);
  for (const key of lightKeys) {
    assert.equal(typeof COLORS_LIGHT[key], 'string');
    assert.equal(typeof COLORS_DARK[key], 'string');
    assert.ok(COLORS_LIGHT[key].length > 0);
    assert.ok(COLORS_DARK[key].length > 0);
  }
});

test('FONTS, TYPOGRAPHY, SPACING, and RADIUS preserve OGAM design scale contracts', () => {
  assert.deepEqual(FONTS, { sans: 'Geist', mono: 'Geist Mono' });
  assert.deepEqual(RADIUS, { sm: 2, md: 8 });
  assert.deepEqual(SPACING, { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 });
  assert.equal(TYPOGRAPHY.body.fontFamily, 'Geist');
  assert.equal(TYPOGRAPHY.meta.fontFamily, 'Geist Mono');
});

test('LIVING_FIELD matches LivingField.test.tsx exact geometry and breathing cadence', () => {
  assert.deepEqual(LIVING_FIELD, {
    spacing: 26,
    dotRadius: 1.25,
    dotAlphaDark: 0.11,
    dotAlphaLight: 0.16,
    breathMs: 3500,
  });
});

test('ALIVE provides all motion tokens consumed by AliveProvider and LivingField', () => {
  const expectedKeys = [
    'holdAfterCancelMs',
    'lightInMs',
    'litAlphaDark',
    'litAlphaLight',
    'ringReach',
    'scrollDrift',
    'trailMs',
    'waveSpeed',
  ];
  assert.deepEqual(Object.keys(ALIVE).sort(), expectedKeys);
  for (const key of expectedKeys) {
    assert.equal(typeof ALIVE[key], 'number');
    assert.ok(Number.isFinite(ALIVE[key]) && ALIVE[key] > 0, `${key} must be finite and positive`);
  }
  assert.equal(ALIVE.ringReach, 520);
  assert.equal(ALIVE.waveSpeed, 1.1);
  assert.ok(Number.isFinite(ALIVE.ringReach / ALIVE.waveSpeed));
});
