import test from 'node:test';
import assert from 'node:assert/strict';
import { formatFileSize } from '../../src/utils/formatFileSize.ts';

test('preserves the established two-decimal size display contract', () => {
  assert.equal(formatFileSize(0), '0 B');
  assert.equal(formatFileSize(500), '500.00 B');
  assert.equal(formatFileSize(1024), '1.00 KB');
  assert.equal(formatFileSize(2.5 * 1024 ** 2), '2.50 MB');
  assert.equal(formatFileSize(4.2 * 1024 ** 3), '4.20 GB');
  assert.equal(formatFileSize(1024 ** 4), '1.00 TB');
});
test('normalizes negative and non-finite sizes', () => {
  for (const value of [-1, NaN, Infinity, -Infinity]) assert.equal(formatFileSize(value), '0 B');
});
