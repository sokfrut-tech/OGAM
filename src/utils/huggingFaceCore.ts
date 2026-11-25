/**
 * OGAM-owned Hugging Face search, grouping, file tree resolution, strict mmproj pairing, and
 * model name/quantization/type classification.
 */

import type {
  HFSearchResult,
  ModelEntry,
  ModelFileEntry,
  ModelFileVariant,
} from '../types/modelCatalog';

export type { HFSearchResult, ModelFileVariant } from '../types/modelCatalog';

export type HfSearchKind = 'text' | 'vision' | 'image' | 'transcription';
export type HfModelType =
  | 'image-gen'
  | 'vision'
  | 'code'
  | 'embedding'
  | 'transcription'
  | 'text';

const HF_API_BASE = 'https://huggingface.co/api';
const HF_WEB_BASE = 'https://huggingface.co';

const TRUST_PRIORITY: Record<string, number> = {
  'off-grid-ai': 5,
  unsloth: 4,
  'ggml-org': 4,
  bartowski: 3,
  'lmstudio-community': 3,
  'lm-kit': 3,
  'second-state': 2,
};

const KNOWN_QUANTS = [
  'Q2_K',
  'Q3_K_S',
  'Q3_K_M',
  'Q3_K_L',
  'Q3_K',
  'Q4_0',
  'Q4_K_S',
  'Q4_K_M',
  'Q5_K_S',
  'Q5_K_M',
  'Q6_K',
  'Q8_0',
  'F16',
  'BF16',
  'F32',
] as const;

const SPLIT_GGUF_SUFFIX = /-\d{5}-of-\d{5}(?=\.[^.]+$|$)/i;
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
]);

interface RawHfRepo {
  id: string;
  author?: string;
  downloads?: number;
  likes?: number;
  lastModified?: string;
  tags?: string[];
  pipeline_tag?: string;
  siblings?: Array<{ rfilename: string; size?: number; lfs?: { size?: number; oid?: string; sha256?: string } }>;
  sha?: string;
}

interface RawHfTreeFile {
  type?: string;
  path?: string;
  rfilename?: string;
  size?: number;
  lfs?: { size?: number; oid?: string; sha256?: string };
}

function resolveFetch(fetchImpl?: typeof fetch): typeof fetch {
  return fetchImpl ?? globalThis.fetch;
}

function stripDirectory(fileName: string): string {
  const parts = fileName.trim().split(/[/\\]/);
  return parts[parts.length - 1] ?? '';
}

function isCompanionArtifact(fileName: string): boolean {
  const base = stripDirectory(fileName);
  return /(?:^|[-_])(?:mtp|draft|dflash|dspark|eagle3|imatrix)(?:[-_.]|$)/i.test(base);
}

function isProjectorFilename(fileName: string): boolean {
  const lower = stripDirectory(fileName).toLowerCase();
  if (!lower.endsWith('.gguf')) return false;
  return lower.includes('mmproj') || lower.includes('projector') || lower.includes('clip');
}

function modelIdentityStem(fileName: string): string {
  const base = stripDirectory(fileName)
    .replace(/\.(?:gguf|bin|safetensors|onnx)$/i, '')
    .replace(SPLIT_GGUF_SUFFIX, '')
    .replace(/(?:^|[-_])(?:mm[-_]?proj(?:ector)?|clip[-_]?vision|vision[-_]?proj(?:ector)?)(?=$|[-_.])/gi, '-')
    .replace(/(?:^|[-_.])(?:I?Q\d+(?:_[A-Z0-9_]+)*|BF16|FP?16|FP?32|MXFP\d+|INT[48])(?=$|[-_.])/gi, '-');

  return base
    .toLowerCase()
    .split(/[-_]+/)
    .map(token => token.replace(/^\.+|\.+$/g, ''))
    .filter(token => token.length > 0 && !PROJECTOR_NOISE_TOKENS.has(token) && !QUANT_TOKEN_PATTERN.test(token))
    .join('-');
}

function pickProjectorForFile<T extends { path: string }>(
  modelFilePath: string,
  projectors: readonly T[],
): T | undefined {
  if (projectors.length === 0) return undefined;
  const stem = modelIdentityStem(modelFilePath);
  let candidates: T[] = [];
  if (stem) {
    candidates = projectors.filter(p => modelIdentityStem(p.path) === stem);
  }
  if (candidates.length === 0) {
    candidates = projectors.filter(p => modelIdentityStem(p.path) === '');
  }
  if (candidates.length === 0) return undefined;
  return (
    candidates.find(p => /(?:^|[-_.])(?:f16|fp16)(?:[-_.]|$)/i.test(stripDirectory(p.path))) ??
    candidates[0]
  );
}

function buildDownloadUrl(modelId: string, filePath: string, revision = 'main'): string {
  const cleanRevision = revision === 'main' ? 'main' : encodeURIComponent(revision);
  const encodedPath = filePath
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
  return `${HF_WEB_BASE}/${modelId}/resolve/${cleanRevision}/${encodedPath}`;
}

function extractSha256(lfs?: { oid?: string; sha256?: string }): string | undefined {
  if (lfs?.sha256 && /^[a-f0-9]{64}$/i.test(lfs.sha256)) return lfs.sha256.toLowerCase();
  if (lfs?.oid && /^[a-f0-9]{64}$/i.test(lfs.oid)) return lfs.oid.toLowerCase();
  return undefined;
}

/** Extracts the GGUF quantization label (e.g. `Q4_K_M`, `IQ4_XS`, `F16`) or `'Unknown'`. */
export function extractQuantization(fileName: string): string {
  const base = stripDirectory(fileName);
  const upperName = base.toUpperCase();

  for (const quant of KNOWN_QUANTS) {
    if (upperName.includes(quant.replace('_', '')) || upperName.includes(quant)) {
      return quant;
    }
  }

  const iqMatch = /IQ\d+_[A-Z0-9]+/i.exec(base);
  if (iqMatch) return iqMatch[0].toUpperCase();

  const match = /[QqFf]\d+[_]?[KkMmSs]*/.exec(base);
  if (match) return match[0].toUpperCase();

  return 'Unknown';
}

/** Formats a raw repository name or filename into a readable label without quant or GGUF suffixes. */
export function cleanModelName(nameOrPath: string): string {
  const raw = nameOrPath.includes('/') ? (nameOrPath.split('/').pop() ?? nameOrPath) : nameOrPath;
  let cleaned = raw
    .replace(/\.(?:gguf|bin|safetensors|onnx)$/i, '')
    .replace(SPLIT_GGUF_SUFFIX, '')
    .replace(/-gguf$/i, '')
    .replace(/(?:^|[-_.])(?:I?Q\d+(?:_[A-Z0-9_]+)*|BF16|FP?16|FP?32|MXFP\d+|INT[48])$/i, '');

  cleaned = cleaned.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || raw;
}

/** Classifies a Hugging Face repository or model name into its primary capability family. */
export function getModelType(nameOrId: string): HfModelType {
  const lower = nameOrId.toLowerCase();
  if (
    /(?:stable[-_]?diffusion|sdxl|sd[-_.]?1\.5|sd[-_.]?2\.1|flux[-_.]?1|flux[-_.]?2|z[-_]?image|qwen[-_]?image|realvis|dreamshaper|juggernaut|animagine|illustrious|wan[-_.]?2|lingbot|ltx[-_.]?(?:2|video)|txt2img|text[-_]?to[-_]?image)/i.test(
      lower,
    )
  ) {
    return 'image-gen';
  }
  if (/(?:whisper|qwen3?-asr|parakeet|canary|\basr\b|\bstt\b|speech[-_]?to[-_]?text)/i.test(lower)) {
    return 'transcription';
  }
  if (/(?:embed|bge[-_.]|minilm|e5[-_]|rerank|gte[-_.]|nomic-embed)/i.test(lower)) {
    return 'embedding';
  }
  if (/(?:coder|codellama|starcoder|codestral|codegemma|opencode)/i.test(lower)) {
    return 'code';
  }
  if (/(?:[-_.]vl\b|vlm|vision|llava|pixtral|moondream|internvl|minicpm[-_]?v|smolvlm|gemma-4)/i.test(lower)) {
    return 'vision';
  }
  return 'text';
}

function repoFamilyKey(id: string): string {
  const slug = (id.split('/').pop() ?? id).toLowerCase();
  return slug
    .replace(/^(?:ifm|unsloth|bartowski|ggml-org)[_-]/, '')
    .replace(/[-_.]?(?:gguf|i1|bf16|fp?16|q\d+(?:_[a-z0-9]+)*)$/i, '')
    .replace(/[^a-z0-9.]+/g, '');
}

function parseParamsFromName(name: string): { params?: number; activeParams?: number } {
  const activeMatch = /\bA(\d+(?:\.\d+)?)B\b/i.exec(name);
  const activeParams = activeMatch ? Number(activeMatch[1]) : undefined;
  const totalMatch = /(\d+(?:\.\d+)?)\s*B(?:\b|[-_])/i.exec(name);
  const params = totalMatch ? Number(totalMatch[1]) : undefined;
  return {
    ...(params && Number.isFinite(params) ? { params } : {}),
    ...(activeParams && Number.isFinite(activeParams) ? { activeParams } : {}),
  };
}

function trustScore(repo: RawHfRepo): number {
  const org = (repo.author ?? repo.id.split('/')[0] ?? '').toLowerCase();
  return TRUST_PRIORITY[org] ?? 0;
}

/** Searches public Hugging Face repositories, filtering non-chat kinds and grouping duplicate uploads. */
export async function searchHuggingFace(
  query: string,
  options: {
    limit?: number;
    sort?: string;
    kind?: HfSearchKind;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<HFSearchResult[]> {
  const fetchFn = resolveFetch(options.fetchImpl);
  const kind = options.kind ?? 'text';
  const limit = options.limit ?? 30;
  const sort = options.sort ?? 'downloads';

  const params = new URLSearchParams({
    sort,
    direction: '-1',
    limit: String(limit),
  });
  if (kind === 'transcription') {
    params.set('pipeline_tag', 'automatic-speech-recognition');
  } else {
    params.set('filter', 'gguf');
    if (kind === 'vision') {
      params.set('pipeline_tag', 'image-text-to-text');
    } else if (kind === 'image') {
      params.set('pipeline_tag', 'text-to-image');
    }
  }
  if (query.trim()) {
    params.set('search', query.trim());
  }

  const response = await fetchFn(`${HF_API_BASE}/models?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  const repos = (await response.json()) as RawHfRepo[];
  if (!Array.isArray(repos)) return [];

  const filtered = repos.filter(repo => {
    if (!repo?.id) return false;
    if (kind === 'text' || kind === 'vision') {
      const detected = getModelType(repo.id);
      if (detected === 'transcription' || detected === 'embedding') return false;
      const tags = (repo.tags ?? []).map(t => t.toLowerCase());
      if (
        tags.some(t =>
          t.includes('automatic-speech-recognition') ||
          t.includes('sentence-similarity') ||
          t.includes('feature-extraction') ||
          t.includes('text-to-speech'),
        )
      ) {
        return false;
      }
    }
    return true;
  });

  const groups = new Map<string, RawHfRepo[]>();
  for (const repo of filtered) {
    const key = repoFamilyKey(repo.id);
    const list = groups.get(key) ?? [];
    list.push(repo);
    groups.set(key, list);
  }

  const results: HFSearchResult[] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => {
      const scoreDiff = trustScore(b) - trustScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      return (b.downloads ?? 0) - (a.downloads ?? 0);
    });
    const lead = sorted[0];
    const org = lead.author ?? lead.id.split('/')[0] ?? '';
    const name = lead.id.split('/').pop() || lead.id;
    const tags = (lead.tags ?? []).map(t => t.toLowerCase());
    const readsImages =
      tags.includes('image-text-to-text') ||
      tags.includes('vision') ||
      getModelType(lead.id) === 'vision';
    const hasMtp = /gemma[-_]?4[-_]?(?:e2b|e4b|26b[-_]?a4b|31b)/i.test(lead.id);
    const { params: parsedParams, activeParams } = parseParamsFromName(name);

    results.push({
      id: lead.id,
      name,
      org,
      downloads: lead.downloads ?? 0,
      likes: lead.likes ?? 0,
      lastModified: lead.lastModified ?? '',
      readsImages,
      ...(parsedParams !== undefined ? { params: parsedParams } : {}),
      ...(activeParams !== undefined ? { activeParams } : {}),
      ...(hasMtp ? { hasMtp: true } : {}),
      ...(sorted.length > 1
        ? {
            variants: sorted.slice(1).map(alt => ({
              id: alt.id,
              author: alt.author ?? alt.id.split('/')[0] ?? '',
              downloads: alt.downloads ?? 0,
            })),
          }
        : {}),
    });
  }

  return results;
}

async function fetchRepoFileList(
  modelId: string,
  revision: string,
  fetchFn: typeof fetch,
): Promise<Array<{ path: string; sizeBytes: number; sha256?: string }>> {
  const encodedRev = encodeURIComponent(revision);
  try {
    const treeRes = await fetchFn(
      `${HF_API_BASE}/models/${modelId}/tree/${encodedRev}?recursive=true`,
      { headers: { Accept: 'application/json' } },
    );
    if (treeRes.ok) {
      const entries = (await treeRes.json()) as RawHfTreeFile[];
      if (Array.isArray(entries)) {
        return entries
          .filter(e => (e.type === undefined || e.type === 'file') && typeof e.path === 'string')
          .map(e => ({
            path: e.path!,
            sizeBytes: e.lfs?.size ?? e.size ?? 0,
            sha256: extractSha256(e.lfs),
          }));
      }
    }
  } catch {
    // Fall through to ?blobs=true listing.
  }

  const revSuffix = revision === 'main' ? '' : `/revision/${encodedRev}`;
  const modelRes = await fetchFn(`${HF_API_BASE}/models/${modelId}${revSuffix}?blobs=true`, {
    headers: { Accept: 'application/json' },
  });
  if (!modelRes.ok) {
    throw new Error(`API error: ${modelRes.status}`);
  }
  const data = (await modelRes.json()) as RawHfRepo;
  return (data.siblings ?? []).map(s => ({
    path: s.rfilename,
    sizeBytes: s.lfs?.size ?? s.size ?? 0,
    sha256: extractSha256(s.lfs),
  }));
}

/**
 * Lists downloadable GGUF files in a Hugging Face repo with companion/imatrix filtering and
 * strict architecture-matched `mmproj` pairing.
 */
export async function getModelFiles(
  modelId: string,
  options: { revision?: string; fetchImpl?: typeof fetch } = {},
): Promise<ModelFileVariant[]> {
  const revision = options.revision ?? 'main';
  const fetchFn = resolveFetch(options.fetchImpl);
  const allFiles = await fetchRepoFileList(modelId, revision, fetchFn);

  const ggufFiles = allFiles.filter(
    file => file.path.toLowerCase().endsWith('.gguf') && !isCompanionArtifact(file.path),
  );
  const projectors = ggufFiles.filter(file => isProjectorFilename(file.path));
  const primaryFiles = ggufFiles.filter(file => !isProjectorFilename(file.path));

  return primaryFiles
    .map(file => {
      const matchedProj = pickProjectorForFile(file.path, projectors);
      const variant: ModelFileVariant = {
        fileName: stripDirectory(file.path),
        sizeBytes: file.sizeBytes,
        quant: extractQuantization(file.path),
        downloadUrl: buildDownloadUrl(modelId, file.path, revision),
        ...(file.sha256 ? { sha256: file.sha256 } : {}),
        ...(matchedProj
          ? {
              mmproj: {
                fileName: stripDirectory(matchedProj.path),
                url: buildDownloadUrl(modelId, matchedProj.path, revision),
                sizeBytes: matchedProj.sizeBytes,
              },
            }
          : {}),
      };
      return variant;
    })
    .sort((a, b) => a.sizeBytes - b.sizeBytes);
}

/** Fetches `?blobs=true` metadata for a Hugging Face repository and resolves its downloadable entry. */
export async function resolveHuggingFaceModel(
  repoId: string,
  options: { kind?: 'transcription' | 'text' | 'image'; fetchImpl?: typeof fetch } = {},
): Promise<ModelEntry | null> {
  const fetchFn = resolveFetch(options.fetchImpl);
  const kind = options.kind ?? 'text';
  const res = await fetchFn(`${HF_API_BASE}/models/${repoId}?blobs=true`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const repo = (await res.json()) as RawHfRepo;
  const siblings = repo.siblings ?? [];
  const rev = repo.sha && /^[a-f0-9]{40}$/i.test(repo.sha) ? repo.sha : 'main';

  let files: ModelFileEntry[] = [];
  if (kind === 'transcription') {
    const bins = siblings.filter(s => /\.bin$/i.test(s.rfilename) && (s.lfs?.size ?? s.size ?? 0) > 0);
    const ggmlPreferred = bins.filter(s => /(?:^|\/)ggml-/i.test(s.rfilename));
    const chosen = ggmlPreferred[0] ?? bins[0];
    if (chosen) {
      files = [
        {
          name: stripDirectory(chosen.rfilename),
          url: buildDownloadUrl(repoId, chosen.rfilename, rev),
          sizeBytes: chosen.lfs?.size ?? chosen.size ?? 0,
          ...(extractSha256(chosen.lfs) ? { sha256: extractSha256(chosen.lfs) } : {}),
          role: 'primary',
        },
      ];
    }
  } else {
    files = siblings
      .filter(s => /\.gguf$/i.test(s.rfilename) && !isCompanionArtifact(s.rfilename) && (s.lfs?.size ?? s.size ?? 0) > 0)
      .slice(0, 8)
      .map(s => ({
        name: stripDirectory(s.rfilename),
        url: buildDownloadUrl(repoId, s.rfilename, rev),
        sizeBytes: s.lfs?.size ?? s.size ?? 0,
        ...(extractSha256(s.lfs) ? { sha256: extractSha256(s.lfs) } : {}),
        role: isProjectorFilename(s.rfilename) ? 'mmproj' : 'primary',
      }));
  }

  if (files.length === 0) return null;
  return {
    id: repoId,
    name: cleanModelName(repoId),
    kind,
    org: repo.author ?? repoId.split('/')[0],
    files,
  };
}
