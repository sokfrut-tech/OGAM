/**
 * OGAM-owned multimodal projector (`mmproj`) identity stemmer and download candidate selector.
 *
 * Replaces `@offgrid/models` `modelIdentityStem` and `projectorsFor` so vision models never pair
 * with a mismatched architecture projector (e.g., E2B vs E4B) while still matching same-model
 * projectors across quantizations or generic repo-level `mmproj-F16.gguf` files.
 */

const SPLIT_GGUF_SUFFIX = /-\d{5}-of-\d{5}(?=[-_.]|$)/gi;
const QUANT_TOKEN_PATTERN =
  /^(?:i?q\d+(?:_[a-z0-9]+)*|iq\d+[a-z]*|bf16|fp?(?:16|32)|mxfp\d+|int[48])$/i;
const PROJECTOR_NOISE_TOKENS = new Set([
  'mmproj',
  'mmprojector',
  'projector',
  'clip',
  'vision',
  'visual',
  'model',
  'ud',
  'qad',
]);

function stripDirectory(fileName: string): string {
  const parts = fileName.trim().split(/[/\\]/);
  return parts[parts.length - 1] ?? '';
}

function isProjectorFilename(fileName: string): boolean {
  const lower = stripDirectory(fileName).toLowerCase();
  if (!lower.endsWith('.gguf')) return false;
  return lower.includes('mmproj') || lower.includes('projector') || lower.includes('clip');
}

/**
 * Normalize a model or `mmproj` filename to its quantization-independent identity stem.
 * A generic projector filename such as `mmproj-F16.gguf` yields `""` (empty stem).
 */
export function modelIdentityStem(fileName: string): string {
  const base = stripDirectory(fileName)
    .replace(/\.(?:gguf|bin|safetensors|onnx)$/i, '')
    .replace(SPLIT_GGUF_SUFFIX, '')
    .replace(/-text-model(?=[-_.]|$)/gi, '')
    .replace(/(?:^|[-_])(?:mm[-_]?proj(?:ector)?|clip[-_]?vision|vision[-_]?proj(?:ector)?)(?=$|[-_.])/gi, '-')
    .replace(/(?:^|[-_.])(?:I?Q\d+(?:_[A-Z0-9_]+)*|BF16|FP?16|FP?32|MXFP\d+|INT[48])(?=$|[-_.])/gi, '-');

  const tokens = base
    .toLowerCase()
    .split(/[-_]+/)
    .map((token) => token.replace(/^\.+|\.+$/g, ''))
    .filter((token) => token.length > 0 && !PROJECTOR_NOISE_TOKENS.has(token) && !QUANT_TOKEN_PATTERN.test(token));

  return tokens.join('-');
}

/**
 * Select matching projector candidates from a repository listing for `modelFileName`.
 * Prefers exact `modelIdentityStem` matches; falls back ONLY to generic (empty-stem) projectors,
 * never to another model's projector.
 */
export function projectorsFor<T extends { rfilename: string }>(
  modelFileName: string,
  candidates: readonly T[],
): T[] {
  const projectors = candidates.filter((candidate) => isProjectorFilename(candidate.rfilename));
  if (!projectors.length) return [];

  const modelStem = modelIdentityStem(modelFileName);
  if (modelStem) {
    const exact = projectors.filter((candidate) => modelIdentityStem(candidate.rfilename) === modelStem);
    if (exact.length > 0) return exact;
  }

  return projectors.filter((candidate) => modelIdentityStem(candidate.rfilename) === '');
}
