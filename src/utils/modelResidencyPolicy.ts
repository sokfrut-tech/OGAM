/**
 * OGAM-owned on-device model residency and eviction policy.
 *
 * Keeps generation and sidecar models bounded by RAM budgets and live
 * dirty-memory headroom without blocking audio barge-in paths.
 */

export type ResidentType =
  | 'text'
  | 'image'
  | 'video'
  | 'whisper'
  | 'tts'
  | 'classifier'
  | 'embedding';

export interface Resident {
  /** Unique model slot or instance key. */
  key: string;
  type: ResidentType;
  /** Approximate resident memory footprint in MB. */
  sizeMB: number;
  /** Pinned residents (such as classifiers or vetoed active models) are never evicted. */
  pinned?: boolean;
  /** Dirty/anonymous memory that cannot be paged freely by the OS. */
  dirtyMemory?: boolean;
  /** Epoch ms of last access for LRU ordering. */
  lastUsedAt: number;
}

export interface IncomingModel {
  key: string;
  type: ResidentType;
  sizeMB: number;
  dirtyMemory?: boolean;
}

export interface EvictionPlan {
  /** Residents to unload, ordered from first to last victim. */
  evict: Resident[];
  /** Whether the incoming model fits within `budgetMB` after planned evictions. */
  fits: boolean;
  freedMB: number;
}

export type ResidencyLoadPolicy = 'conservative' | 'balanced' | 'aggressive';

const SIDECAR_TYPES = new Set<ResidentType>(['whisper', 'tts', 'embedding']);

// Priority (higher stays warmer): text > image/video > sidecars > classifier.
const PRIORITY: Record<ResidentType, number> = {
  text: 3,
  image: 2,
  video: 2,
  whisper: 1,
  tts: 1,
  embedding: 1,
  classifier: 0,
};

const DIRTY_HEADROOM_STANDARD_MB = 1024;
const DIRTY_HEADROOM_LEAN_MB = 512;
const LARGE_ANDROID_RAM_MB = 10 * 1024;
const ROOMY_SPEECH_THRESHOLD_MB = 6 * 1024;

function selectEvictionVictim(
  current: readonly Resident[],
  incoming: IncomingModel,
  isEvicted: (resident: Resident) => boolean,
): Resident | undefined {
  const incomingIsSidecar = SIDECAR_TYPES.has(incoming.type);
  return current
    .filter(
      resident =>
        !resident.pinned &&
        resident.key !== incoming.key &&
        !isEvicted(resident) &&
        (!incomingIsSidecar || SIDECAR_TYPES.has(resident.type)),
    )
    .sort((a, b) => {
      const priorityDelta = (PRIORITY[a.type] ?? 0) - (PRIORITY[b.type] ?? 0);
      if (priorityDelta !== 0) return priorityDelta;
      return a.lastUsedAt - b.lastUsedAt;
    })[0];
}

/** Return idle unpinned sidecar models eligible for reclamation on OS memory warnings. */
export function memoryWarningVictims(residents: readonly Resident[]): Resident[] {
  return residents.filter(resident => !resident.pinned && SIDECAR_TYPES.has(resident.type));
}

/** True when either the incoming model or any current resident uses unpageable dirty RAM. */
export function hasDirtyPressure(
  residents: readonly Resident[],
  spec: { dirtyMemory?: boolean },
): boolean {
  return !!spec.dirtyMemory || residents.some(resident => !!resident.dirtyMemory);
}

/**
 * Required real free-RAM headroom (MB) before allowing dirty allocations.
 * Aggressive policy and large (>=10 GB) Android phones keep 512 MB; others keep 1024 MB.
 */
export function dirtyHeadroomMB(
  totalRamMB: number,
  policy: ResidencyLoadPolicy = 'balanced',
  platform: string = 'ios',
): number {
  if (policy === 'aggressive') return DIRTY_HEADROOM_LEAN_MB;
  if (platform === 'android' && totalRamMB >= LARGE_ANDROID_RAM_MB) {
    return DIRTY_HEADROOM_LEAN_MB;
  }
  return DIRTY_HEADROOM_STANDARD_MB;
}

/** Compute the effective load budget (MB) from physical caps and live dirty-RAM headroom. */
export function admissionBudgetMB(args: {
  physicalCapMB: number;
  floorMB: number;
  dirtyPressure: boolean;
  residentMB: number;
  availableMB: number;
  headroomMB: number;
}): number {
  const {
    physicalCapMB,
    floorMB,
    dirtyPressure,
    residentMB,
    availableMB,
    headroomMB,
  } = args;
  if (!dirtyPressure) {
    return Math.round(Math.max(floorMB, physicalCapMB));
  }
  const dynamicMB = availableMB + residentMB - headroomMB;
  return Math.round(Math.max(0, Math.min(physicalCapMB, dynamicMB)));
}

/** True when `spec` fits inside `budgetMB` without evicting any other current resident. */
export function fitsWithoutEviction(
  residents: readonly Pick<Resident, 'key' | 'sizeMB'>[],
  spec: { key: string; sizeMB: number },
  budgetMB: number,
): boolean {
  const usedMB = residents
    .filter(resident => resident.key !== spec.key)
    .reduce((sum, resident) => sum + resident.sizeMB, 0);
  return usedMB + spec.sizeMB <= budgetMB;
}

/**
 * Second-gate physical dirty ceiling: excludes a same-key resident being replaced and any
 * dirty residents already scheduled for eviction so reloads are never double-counted.
 */
export function exceedsDirtyCeiling(
  residents: readonly Resident[],
  spec: { key: string; sizeMB: number; dirtyMemory?: boolean },
  plan: EvictionPlan,
  dirtyCeilingMB: number,
): boolean {
  if (!spec.dirtyMemory) return false;
  const evictedKeys = new Set(plan.evict.map(victim => victim.key));
  const keptDirtyMB = residents
    .filter(
      resident =>
        resident.dirtyMemory &&
        resident.key !== spec.key &&
        !evictedKeys.has(resident.key),
    )
    .reduce((sum, resident) => sum + resident.sizeMB, 0);
  return spec.sizeMB + keptDirtyMB > dirtyCeilingMB;
}

/** Reclaim idle speech sidecars before heavy generation turns on <=6 GB devices. */
export function freesIdleSpeechForGeneration(totalRamMB: number): boolean {
  return totalRamMB <= ROOMY_SPEECH_THRESHOLD_MB;
}

/** Plan eviction victims in priority + LRU order to admit `incoming` under `budgetMB`. */
export function planEviction(
  current: readonly Resident[],
  incoming: IncomingModel,
  budgetMB: number,
  opts?: { singleModel?: boolean },
): EvictionPlan {
  const evict: Resident[] = [];
  const evictedKeys = new Set<string>();
  const isEvicted = (resident: Resident) => evictedKeys.has(resident.key);

  const usedMB = () =>
    current
      .filter(resident => resident.key !== incoming.key && !isEvicted(resident))
      .reduce((sum, resident) => sum + resident.sizeMB, 0);
  const incomingCostMB = incoming.sizeMB;

  if (opts?.singleModel) {
    for (
      let victim = selectEvictionVictim(current, incoming, isEvicted);
      victim;
      victim = selectEvictionVictim(current, incoming, isEvicted)
    ) {
      evict.push(victim);
      evictedKeys.add(victim.key);
    }
    return {
      evict,
      fits: usedMB() + incomingCostMB <= budgetMB,
      freedMB: evict.reduce((sum, victim) => sum + victim.sizeMB, 0),
    };
  }

  while (usedMB() + incomingCostMB > budgetMB) {
    const victim = selectEvictionVictim(current, incoming, isEvicted);
    if (!victim) break;
    evict.push(victim);
    evictedKeys.add(victim.key);
  }

  return {
    evict,
    fits: usedMB() + incomingCostMB <= budgetMB,
    freedMB: evict.reduce((sum, victim) => sum + victim.sizeMB, 0),
  };
}
