/**
 * OGAM-owned device model-fit tier and budget rules.
 */

export type FitTier = 'runsWell' | 'tight' | 'wontFit';

export interface FitBudget {
  comfortable: number;
  tight: number;
  ceil: number;
}

/** Standard phone budget for copied/unmapped allocations and non-iOS devices. */
export const PHONE_FIT_BUDGET: FitBudget = {
  comfortable: 0.45,
  tight: 0.62,
  ceil: 0.62,
};

/** iOS GGUF chat weights are mmap-backed and page cleanly up to 70% of RAM. */
export const IPHONE_MAPPED_FIT_BUDGET: FitBudget = {
  comfortable: 0.5,
  tight: 0.7,
  ceil: 0.7,
};

/** Platform-specific fit budget for GGUF chat models. */
export function phoneFitBudget(platform: 'ios' | 'android'): FitBudget {
  return platform === 'ios' ? IPHONE_MAPPED_FIT_BUDGET : PHONE_FIT_BUDGET;
}

/**
 * Classify a model footprint (`sizeGB`) against device RAM (`ramGB`) using exact `>=`
 * ceiling boundaries (`at budget` = `'wontFit'`, strictly below = `'tight'`/`'runsWell'`).
 */
export function fitTier(
  sizeGB: number,
  ramGB: number,
  budget: FitBudget = PHONE_FIT_BUDGET,
): FitTier {
  if (!Number.isFinite(sizeGB) || !Number.isFinite(ramGB) || ramGB <= 0 || sizeGB < 0) {
    return 'wontFit';
  }
  if (sizeGB >= ramGB * budget.ceil) return 'wontFit';
  if (sizeGB >= ramGB * budget.comfortable) return 'tight';
  return 'runsWell';
}

/** True when the model fits strictly below `budget.ceil * ramGB`. */
export function isLoadableOnDevice(
  sizeGB: number,
  ramGB: number,
  budget: FitBudget = PHONE_FIT_BUDGET,
): boolean {
  return fitTier(sizeGB, ramGB, budget) !== 'wontFit';
}

const FIT_LABELS: Record<FitTier, string> = {
  runsWell: 'Runs well',
  tight: 'Tight',
  wontFit: 'Too big',
};

/** Human-readable badge/status copy for a computed fit tier. */
export function fitLabel(tier: FitTier): string {
  return FIT_LABELS[tier];
}
