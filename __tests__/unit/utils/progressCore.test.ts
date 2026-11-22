import {
  projectProgress,
  sampleProgressRate,
} from '../../../src/utils/progressCore';

describe('sampleProgressRate', () => {
  it('uses the first observation as a baseline without inventing a rate', () => {
    expect(sampleProgressRate(undefined, { currentBytes: 100, sampledAtMs: 1000 })).toEqual({
      sample: { currentBytes: 100, sampledAtMs: 1000 },
    });
  });

  it('measures bytes per second from monotonic observations', () => {
    expect(sampleProgressRate(
      { currentBytes: 100, sampledAtMs: 1000 },
      { currentBytes: 600, sampledAtMs: 2000 },
    )).toEqual({
      sample: { currentBytes: 600, sampledAtMs: 2000 },
      bytesPerSecond: 500,
    });
  });

  it('resets its baseline without emitting a negative rate after counter rollback', () => {
    expect(sampleProgressRate(
      { currentBytes: 600, sampledAtMs: 2000 },
      { currentBytes: 20, sampledAtMs: 3000 },
    )).toEqual({ sample: { currentBytes: 20, sampledAtMs: 3000 } });
  });

  it('does not emit a rate for duplicate or backwards timestamps', () => {
    expect(sampleProgressRate(
      { currentBytes: 100, sampledAtMs: 1000 },
      { currentBytes: 200, sampledAtMs: 1000 },
    ).bytesPerSecond).toBeUndefined();
    expect(sampleProgressRate(
      { currentBytes: 100, sampledAtMs: 2000 },
      { currentBytes: 200, sampledAtMs: 1000 },
    ).bytesPerSecond).toBeUndefined();
  });

  it('sanitizes invalid observations', () => {
    expect(sampleProgressRate(undefined, {
      currentBytes: Number.NaN,
      sampledAtMs: Number.POSITIVE_INFINITY,
    })).toEqual({ sample: { currentBytes: 0, sampledAtMs: 0 } });
  });
});

describe('projectProgress', () => {
  it('projects finite byte totals, percentage and rate', () => {
    expect(projectProgress({
      bytesDownloaded: 5 * 1024 * 1024,
      totalBytes: 20 * 1024 * 1024,
      bytesPerSecond: 2.5 * 1024 * 1024,
      status: 'running',
    })).toEqual({
      currentBytes: 5 * 1024 * 1024,
      totalBytes: 20 * 1024 * 1024,
      percentage: 25,
      bytesPerSecond: 2.5 * 1024 * 1024,
      terminal: false,
    });
  });

  it('keeps unknown totals and invalid percentages/rates unknown', () => {
    expect(projectProgress({
      bytesDownloaded: 64,
      totalBytes: 0,
      bytesPerSecond: Number.NaN,
      progress: Number.POSITIVE_INFINITY,
      status: 'running',
    })).toEqual({ currentBytes: 64, terminal: false });
  });

  it('clamps supplied fractional progress when a total is unknown', () => {
    expect(projectProgress({ progress: 1.5 })).toEqual({
      currentBytes: 0,
      percentage: 100,
      terminal: false,
    });
  });

  it('forces completed progress to 100 percent', () => {
    expect(projectProgress({
      bytesDownloaded: 300,
      totalBytes: 1000,
      status: 'completed',
    })).toEqual({
      currentBytes: 300,
      totalBytes: 1000,
      percentage: 100,
      terminal: true,
    });
  });

  it.each(['failed', 'cancelled'])('preserves measured progress for terminal %s status', status => {
    expect(projectProgress({
      bytesDownloaded: 300,
      totalBytes: 1000,
      status,
    })).toEqual({
      currentBytes: 300,
      totalBytes: 1000,
      percentage: 30,
      terminal: true,
    });
  });

  it('does not leak negative or non-finite values into presentation', () => {
    expect(projectProgress({
      bytesDownloaded: -5,
      totalBytes: Number.POSITIVE_INFINITY,
      bytesPerSecond: -1,
      progress: -1,
    })).toEqual({ currentBytes: 0, terminal: false });
  });
});
