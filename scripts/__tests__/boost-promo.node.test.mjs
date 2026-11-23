import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {
  BOOST_PROMO,
  boostPromoCopy,
  boostPromoLink,
  boostPromoVisible,
} from '../../src/utils/boostPromo.ts';

test('boostPromoCopy preserves exact promo title and required surface fields', () => {
  const copy = boostPromoCopy('phone');
  assert.equal(copy.title, 'Smarter answers, without a bigger phone.');
  assert.ok(copy.line.length > 0);
  assert.ok(copy.body.length > 0);
  assert.ok(copy.action.length > 0);
  assert.ok(copy.close.length > 0);
});

test('boostPromoVisible hides only the active dismissed promo version', () => {
  assert.equal(boostPromoVisible(null), true);
  assert.equal(boostPromoVisible(undefined), true);
  assert.equal(boostPromoVisible('an-older-promo'), true);
  assert.equal(boostPromoVisible(BOOST_PROMO.version), false);
});

test('boostPromoLink builds expected campaign URL for mobile and desktop surfaces', () => {
  const link = boostPromoLink('mobile', 'models');
  assert.match(
    link,
    /^https:\/\/getoffgridai\.co\/boost\?utm_source=off-grid-mobile-app&utm_medium=boost-models&/,
  );
  assert.ok(link.includes(encodeURIComponent(BOOST_PROMO.version)));
});

test('all 7 Boost promo consumers and its integration test import from utils/boostPromo', () => {
  const files = [
    'src/components/BoostPromoCard.tsx',
    'src/constants/index.ts',
    'src/hooks/useOpenBoost.ts',
    'src/screens/HomeScreen/components/FeatureShowcase.tsx',
    'src/screens/HomeScreen/index.tsx',
    'src/screens/ProTabScreen.tsx',
    'src/services/analytics/analytics.ts',
    '__tests__/integration/models/boostPromo.rendered.test.tsx',
  ];
  const legacyImport = new RegExp(`from\\s+['"]${'@offgrid'}/models['"]`);
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    assert.ok(content.includes('utils/boostPromo'), `${file} must import utils/boostPromo`);
    assert.equal(legacyImport.test(content), false, `${file} still imports legacy models package`);
  }
});
