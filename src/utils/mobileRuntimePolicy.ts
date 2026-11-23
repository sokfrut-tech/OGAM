/**
 * OGAM-owned mobile runtime, CPU threading, mmap, and backend selection policy.
 *
 * Self-contained leaf module (shared cleanly between RN app/Metro and Node test runs).
 */

/** Optimal performance-core thread count pinned for iPhone Silicon. */
export const IPHONE_INFERENCE_THREADS = 4;

const DEFAULT_MOBILE_MTP_DRAFT_TOKENS = 3;
const ANDROID_MMAP_MIN_RAM_GB = 6;
const STATE_CACHE_MAX_MB = 256;
const STATE_CACHE_RAM_SHARE = 0.05;
const FAST_CORE_THRESHOLD = 0.75;

/** GGUF general.file_type values repacked by llama.cpp for ARM CPU execution. */
const REPACKED_ARM_FILE_TYPES = new Set<number>([2, 7, 14, 15, 25]);

export type MobileBackend = 'cpu' | 'opencl' | 'metal' | 'htp';

export interface MobileBackendRow {
  batch: number;
  quantizedKv: boolean;
  sessionSave: boolean;
  flashAttn: boolean;
}

export const MOBILE_BACKEND_ROWS: Record<MobileBackend, MobileBackendRow> = {
  cpu: { batch: 512, quantizedKv: true, sessionSave: true, flashAttn: true },
  metal: { batch: 512, quantizedKv: true, sessionSave: true, flashAttn: true },
  opencl: { batch: 512, quantizedKv: false, sessionSave: false, flashAttn: false },
  htp: { batch: 128, quantizedKv: false, sessionSave: true, flashAttn: false },
};

export type MobileDeviceClass =
  | 'ios'
  | 'android-low-ram'
  | 'android-npu'
  | 'android-adreno'
  | 'android-cpu';

export interface MobileDevice {
  platform: 'ios' | 'android';
  totalRamGb: number;
  hasNpu: boolean;
  hasAdreno: boolean;
}

export interface MobileDeviceRow {
  defaultBackend: MobileBackend;
  benchBackends: readonly MobileBackend[];
}

export const MOBILE_DEVICE_ROWS: Record<MobileDeviceClass, MobileDeviceRow> = {
  ios: { defaultBackend: 'metal', benchBackends: ['metal'] },
  'android-low-ram': { defaultBackend: 'cpu', benchBackends: ['cpu'] },
  'android-npu': { defaultBackend: 'cpu', benchBackends: ['cpu', 'htp', 'opencl'] },
  'android-adreno': { defaultBackend: 'cpu', benchBackends: ['cpu', 'opencl'] },
  'android-cpu': { defaultBackend: 'cpu', benchBackends: ['cpu'] },
};

export interface BackendBenchResult {
  backend: MobileBackend;
  tokensPerSecond: number | null;
}

export interface MobileFastestSettingsPlan {
  backend: MobileBackend;
  threads: number;
  batch: number;
  useMmap: boolean;
  flashAttn: boolean;
  kvCacheType: 'q8_0' | 'f16';
  mtp: boolean;
  mtpDraftTokens: number;
}

export interface ModalityPlacement {
  modality: string;
  place: 'npu' | 'gpu' | 'cpu';
  engine: string;
  reason?: string;
}

/**
 * Thread every fast non-efficiency core while excluding a lone prime core that shares
 * thermal/cache headroom with the performance cluster.
 */
export function androidInferenceThreads(coreValues: readonly number[]): number {
  const usable = coreValues.filter(value => Number.isFinite(value) && value > 0);
  if (usable.length === 0) return 0;
  const fastest = Math.max(...usable);
  const fast = usable.filter(value => value >= fastest * FAST_CORE_THRESHOLD);
  const primeCount = fast.filter(value => value === fastest).length;
  return primeCount === 1 && fast.length > 1 ? fast.length - 1 : fast.length;
}

/**
 * Disable mmap on >=6 GB Android devices for GGUF quants repacked by llama.cpp for ARM,
 * keeping mmap enabled on iOS, sub-6 GB Android devices, and unknown/unrepacked headers.
 */
export function mobileUseMmap(
  platform: 'ios' | 'android' | string,
  fileType: number | null,
  totalRamGb?: number,
): boolean {
  if (platform !== 'android') return true;
  if (
    totalRamGb !== undefined &&
    Number.isFinite(totalRamGb) &&
    totalRamGb < ANDROID_MMAP_MIN_RAM_GB
  ) {
    return true;
  }
  if (fileType === null || !Number.isFinite(fileType)) return true;
  return !REPACKED_ARM_FILE_TYPES.has(fileType);
}

/** Cap KV session save state buffer to 5% of free RAM, up to 256 MB. */
export function stateCacheBudgetMb(freeRamMb: number): number {
  if (!Number.isFinite(freeRamMb) || freeRamMb <= 0) return 0;
  return Math.min(STATE_CACHE_MAX_MB, Math.floor(freeRamMb * STATE_CACHE_RAM_SHARE));
}

/** Classify a mobile device into its runtime capability tier. */
export function classifyMobileDevice(device: MobileDevice): MobileDeviceClass {
  if (device.platform === 'ios') return 'ios';
  if (device.totalRamGb < ANDROID_MMAP_MIN_RAM_GB) return 'android-low-ram';
  if (device.hasNpu) return 'android-npu';
  if (device.hasAdreno) return 'android-adreno';
  return 'android-cpu';
}

/** Pick the fastest measured backend with positive throughput, or fall back cleanly. */
export function fastestBenchedBackend(
  results: readonly BackendBenchResult[],
  fallback: MobileBackend,
): MobileBackend {
  let bestBackend: MobileBackend | null = null;
  let bestSpeed = 0;
  for (const result of results) {
    if (
      typeof result.tokensPerSecond === 'number' &&
      Number.isFinite(result.tokensPerSecond) &&
      result.tokensPerSecond > bestSpeed
    ) {
      bestSpeed = result.tokensPerSecond;
      bestBackend = result.backend;
    }
  }
  return bestBackend ?? fallback;
}

/** Derive cohesive fastest runtime defaults for a device and optional benchmark winner. */
export function planMobileFastestSettings(args: {
  device: MobileDevice;
  coreValues: readonly number[];
  freeRamMb: number;
  modelFileType: number | null;
  benchedBackend: MobileBackend | null;
}): MobileFastestSettingsPlan {
  const deviceRow = MOBILE_DEVICE_ROWS[classifyMobileDevice(args.device)];
  const backend =
    args.benchedBackend && deviceRow.benchBackends.includes(args.benchedBackend)
      ? args.benchedBackend
      : deviceRow.defaultBackend;
  const backendRow = MOBILE_BACKEND_ROWS[backend];
  const threads =
    args.device.platform === 'ios'
      ? IPHONE_INFERENCE_THREADS
      : androidInferenceThreads(args.coreValues);
  return {
    backend,
    threads,
    batch: backendRow.batch,
    useMmap: mobileUseMmap(args.device.platform, args.modelFileType, args.device.totalRamGb),
    flashAttn: backendRow.flashAttn,
    kvCacheType: backendRow.quantizedKv ? 'q8_0' : 'f16',
    mtp: false,
    mtpDraftTokens: DEFAULT_MOBILE_MTP_DRAFT_TOKENS,
  };
}
