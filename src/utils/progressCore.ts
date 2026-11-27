/**
 * OGAM-owned progress contract.
 *
 * This module replaces the small, pure @offgrid/ui progress surface used by Mobile.
 * It deliberately owns only byte-rate sampling and safe progress projection; native
 * download lifecycle and persistence remain in the existing download store/adapters.
 */

export interface ProgressRateSample {
  currentBytes: number;
  sampledAtMs: number;
}

export interface ProgressRateInput {
  currentBytes: number;
  sampledAtMs: number;
}

export interface ProgressRateResult {
  sample: ProgressRateSample;
  bytesPerSecond?: number;
}

export interface ProgressLike {
  bytesDownloaded?: number;
  totalBytes?: number;
  bytesPerSecond?: number;
  progress?: number;
  status?: string;
}

export interface ProgressPresentation {
  currentBytes: number;
  totalBytes?: number;
  percentage?: number;
  bytesPerSecond?: number;
  terminal: boolean;
}

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);

function finiteNonNegative(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

/**
 * Measure a finite byte rate from two monotonic observations.
 * The newest observation always becomes the next baseline, including after a reset.
 * A first sample, counter rollback, or non-positive time interval has no rate.
 */
export function sampleProgressRate(
  previous: ProgressRateSample | undefined,
  input: ProgressRateInput,
): ProgressRateResult {
  const currentBytes = finiteNonNegative(input.currentBytes) ?? 0;
  const sampledAtMs = finiteNonNegative(input.sampledAtMs) ?? 0;
  const sample = { currentBytes, sampledAtMs };

  if (!previous) return { sample };

  const previousBytes = finiteNonNegative(previous.currentBytes);
  const previousTime = finiteNonNegative(previous.sampledAtMs);
  if (previousBytes === undefined || previousTime === undefined) return { sample };

  const elapsedMs = sampledAtMs - previousTime;
  const deltaBytes = currentBytes - previousBytes;
  if (elapsedMs <= 0 || deltaBytes < 0) return { sample };

  const bytesPerSecond = (deltaBytes * 1000) / elapsedMs;
  return Number.isFinite(bytesPerSecond)
    ? { sample, bytesPerSecond }
    : { sample };
}

/**
 * Project download facts into one safe presentation shape.
 * Unknown totals remain unknown; percentages are clamped and terminal completion is 100%.
 */
export function projectProgress(input: ProgressLike): ProgressPresentation {
  const currentBytes = finiteNonNegative(input.bytesDownloaded) ?? 0;
  const knownTotal = finiteNonNegative(input.totalBytes);
  const totalBytes = knownTotal !== undefined && knownTotal > 0 ? knownTotal : undefined;
  const suppliedProgress = finiteNonNegative(input.progress);
  const bytesPerSecond = finiteNonNegative(input.bytesPerSecond);
  const terminal = TERMINAL_STATUSES.has(input.status ?? '');

  let percentage: number | undefined;
  if (input.status === 'completed') {
    percentage = 100;
  } else if (totalBytes !== undefined) {
    percentage = Math.min(100, Math.max(0, (currentBytes / totalBytes) * 100));
  } else if (suppliedProgress !== undefined) {
    percentage = Math.min(100, Math.max(0, suppliedProgress * 100));
  }

  return {
    currentBytes,
    ...(totalBytes === undefined ? {} : { totalBytes }),
    ...(percentage === undefined ? {} : { percentage }),
    ...(bytesPerSecond === undefined ? {} : { bytesPerSecond }),
    terminal,
  };
}
