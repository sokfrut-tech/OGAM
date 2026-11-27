/**
 * OGAM-owned replacement for @offgrid/models formatFileSize.
 *
 * Preserve the established download/free-space copy contract: two decimal places for
 * non-zero values and a compact "0 B" for zero. Invalid and negative inputs are
 * normalized safely instead of producing NaN/undefined units.
 */
const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const;
const BASE = 1024;

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(BASE)), UNITS.length - 1);
  return `${(bytes / Math.pow(BASE, unitIndex)).toFixed(2)} ${UNITS[unitIndex]}`;
}
