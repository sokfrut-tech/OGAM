/**
 * OGAM-owned model naming, credibility classification, MoE param extraction, and repo keys.
 *
 * Replaces `@offgrid/models` naming/credibility exports across ModelCard, DownloadManagerScreen,
 * DevicePicksRow, ImageModelsTab, ImagePicksRow, TextModelsTab, useDownloadedSpeedBadges, and
 * llamaEngineSupport.
 */

export type ModelCredibilitySource =
  | 'offgrid'
  | 'official'
  | 'lmstudio'
  | 'verified-quantizer'
  | 'community';

export interface MoeParamCounts {
  totalParams: number;
  activeParams: number;
}

const OFFICIAL_AUTHORS = new Set([
  'alibaba-pai',
  'allenai',
  'black-forest-labs',
  'bytedance',
  'cohereforai',
  'deepseek-ai',
  'facebook',
  'google',
  'google-bert',
  'huggingfacetb',
  'ibm-granite',
  'lightricks',
  'liquidai',
  'meta-llama',
  'microsoft',
  'minimaxai',
  'mistralai',
  'nousresearch',
  'nvidia',
  'openbmb',
  'openai',
  'qwen',
  'rhymes-ai',
  'smolvlm',
  'stabilityai',
  'tencent',
  'thudm',
  'wan-ai',
  'zai-org',
]);

const VERIFIED_QUANTIZERS = new Set([
  'bartowski',
  'bullerwins',
  'calcuis',
  'city96',
  'ggml-org',
  'litert-community',
  'maziyarpanahi',
  'mradermacher',
  'quantstack',
  'second-state',
  'thebloke',
  'unsloth',
]);

const LMSTUDIO_AUTHORS = new Set(['lmstudio-community', 'lm-kit']);

const SPLIT_PART_PATTERN = /-\d{5}-of-\d{5}(?=\.(?:gguf|bin|safetensors)$|$)/i;
const RAW_EXTENSION_PATTERN = /\.(?:gguf|bin|onnx|safetensors|litertlm|pte|task)$/i;
const TRAILING_QUANT_PATTERN =
  /(?:^|[-_.])(?:I?Q\d+(?:_[A-Z0-9_]+)*|BF16|FP?16|FP?32|MXFP\d+|INT[48])$/i;
const REPO_FORMAT_SUFFIX = /-(?:gguf|mlx|awq|gptq|exl2|litert|onnx|fp16|bf16|int[48])$/i;

/** True when a model ID belongs to Off Grid AI's own Hugging Face organization. */
export function isOffGridHfRepo(repoOrId: string): boolean {
  return /^off-grid-ai\//i.test(repoOrId.trim());
}

/** Classify a Hugging Face author string into a trust/origin badge tier. */
export function determineCredibility(author: string): ModelCredibilitySource {
  const lower = author.trim().toLowerCase();
  if (!lower) return 'community';
  if (lower === 'off-grid-ai') return 'offgrid';
  if (LMSTUDIO_AUTHORS.has(lower)) return 'lmstudio';
  if (OFFICIAL_AUTHORS.has(lower)) return 'official';
  if (VERIFIED_QUANTIZERS.has(lower)) return 'verified-quantizer';
  return 'community';
}

/** Strip multipart shard indices (`-00001-of-00003`) while keeping base filename and extension. */
export function splitGgufModelName(fileName: string): string {
  const parts = fileName.trim().split(/[/\\]/);
  const base = parts[parts.length - 1] ?? '';
  return base.replace(SPLIT_PART_PATTERN, '');
}

/** Return true if a string looks like a file path, Hugging Face repo slug, raw archive, or raw quant slug. */
export function isRawModelName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (trimmed.includes('/') || trimmed.includes('\\')) return true;
  if (RAW_EXTENSION_PATTERN.test(trimmed)) return true;
  if (SPLIT_PART_PATTERN.test(trimmed) || /-gguf$/i.test(trimmed)) return true;
  if (!trimmed.includes(' ') && TRAILING_QUANT_PATTERN.test(trimmed)) return true;
  return false;
}

/** Convert a raw filename or Hugging Face repo slug into a clean human-readable display label. */
export function modelDisplayName(rawName: string): string | undefined {
  const trimmed = rawName.trim();
  if (!trimmed || !isRawModelName(trimmed)) return undefined;

  let base = splitGgufModelName(trimmed);
  base = base.replace(/\.(?:gguf|bin|onnx|safetensors)$/i, '');
  base = base.replace(/-gguf$/i, '');

  // Strip up to two trailing quantization/format tags (e.g. `-Instruct-Q4_K_M`, `-Q4_K_M`).
  while (TRAILING_QUANT_PATTERN.test(base)) {
    const stripped = base.replace(TRAILING_QUANT_PATTERN, '');
    if (!stripped || stripped === base) break;
    base = stripped;
  }

  const cleaned = base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || undefined;
}

/** Parse sparse Mixture-of-Experts parameter counts (e.g. `Qwen3-30B-A3B` or `Mixtral-8x7B`). */
export function parseMoeParams(nameOrFile: string): MoeParamCounts | null {
  const totalActive = /(\d+(?:\.\d+)?)\s*B[-_\s]+A(\d+(?:\.\d+)?)\s*B\b/i.exec(nameOrFile);
  if (totalActive) {
    const totalParams = Number(totalActive[1]);
    const activeParams = Number(totalActive[2]);
    if (Number.isFinite(totalParams) && Number.isFinite(activeParams) && activeParams > 0) {
      return { totalParams, activeParams };
    }
  }

  const nxB = /(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*B\b/i.exec(nameOrFile);
  if (nxB) {
    const experts = Number(nxB[1]);
    const perExpert = Number(nxB[2]);
    if (Number.isFinite(experts) && Number.isFinite(perExpert) && experts >= 2) {
      return { totalParams: experts * perExpert, activeParams: perExpert * 2 };
    }
  }

  return null;
}

/** Normalize a catalog ID or third-party uploader repo ID into its canonical base-model key. */
export function baseModelKey(repoOrId: string): string {
  const segments = repoOrId.trim().split(/[/\\]/);
  let repo = (segments[segments.length - 1] ?? '').toLowerCase();
  repo = repo.replace(/\.(?:gguf|bin|litertlm)$/i, '');
  repo = repo.replace(SPLIT_PART_PATTERN, '');
  while (REPO_FORMAT_SUFFIX.test(repo)) {
    repo = repo.replace(REPO_FORMAT_SUFFIX, '');
  }
  return repo.replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '');
}
