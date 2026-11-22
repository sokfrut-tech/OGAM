import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultTranscriptionLanguage } from '../../src/utils/defaultTranscriptionLanguage.ts';

test('fresh Russian app installs default speech recognition to Russian', () => {
  assert.equal(defaultTranscriptionLanguage('ru'), 'ru');
});

test('English and unsupported app locales use English as the supported fallback', () => {
  assert.equal(defaultTranscriptionLanguage('en'), 'en');
  assert.equal(defaultTranscriptionLanguage('de'), 'en');
});
