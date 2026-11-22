import assert from 'node:assert/strict';
import test from 'node:test';
import {
  projectProgress,
  sampleProgressRate,
} from '../../src/utils/progressCore.ts';

test('first byte observation is only a baseline', () => {
  assert.deepEqual(
    sampleProgressRate(undefined, { currentBytes: 100, sampledAtMs: 1000 }),
    { sample: { currentBytes: 100, sampledAtMs: 1000 } },
  );
});

test('measures a finite byte rate', () => {
  assert.deepEqual(
    sampleProgressRate(
      { currentBytes: 100, sampledAtMs: 1000 },
      { currentBytes: 600, sampledAtMs: 2000 },
    ),
    {
      sample: { currentBytes: 600, sampledAtMs: 2000 },
      bytesPerSecond: 500,
    },
  );
});

test('counter rollback resets the baseline without a negative rate', () => {
  assert.deepEqual(
    sampleProgressRate(
      { currentBytes: 600, sampledAtMs: 2000 },
      { currentBytes: 20, sampledAtMs: 3000 },
    ),
    { sample: { currentBytes: 20, sampledAtMs: 3000 } },
  );
});

test('duplicate or backwards timestamps do not produce a rate', () => {
  assert.equal(sampleProgressRate(
    { currentBytes: 100, sampledAtMs: 1000 },
    { currentBytes: 200, sampledAtMs: 1000 },
  ).bytesPerSecond, undefined);
  assert.equal(sampleProgressRate(
    { currentBytes: 100, sampledAtMs: 2000 },
    { currentBytes: 200, sampledAtMs: 1000 },
  ).bytesPerSecond, undefined);
});

test('unknown totals and non-finite values stay unknown', () => {
  assert.deepEqual(projectProgress({
    bytesDownloaded: 64,
    totalBytes: 0,
    bytesPerSecond: Number.NaN,
    progress: Number.POSITIVE_INFINITY,
    status: 'running',
  }), { currentBytes: 64, terminal: false });
});

test('completed downloads always display 100 percent', () => {
  assert.deepEqual(projectProgress({
    bytesDownloaded: 300,
    totalBytes: 1000,
    status: 'completed',
  }), {
    currentBytes: 300,
    totalBytes: 1000,
    percentage: 100,
    terminal: true,
  });
});

test('failed and cancelled downloads preserve their measured percentage', () => {
  for (const status of ['failed', 'cancelled']) {
    assert.deepEqual(projectProgress({
      bytesDownloaded: 300,
      totalBytes: 1000,
      status,
    }), {
      currentBytes: 300,
      totalBytes: 1000,
      percentage: 30,
      terminal: true,
    });
  }
});
