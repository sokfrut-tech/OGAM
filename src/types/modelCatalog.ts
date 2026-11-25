/**
 * OGAM-owned model catalog, variant, search, MTP sidecar, video, and remote catalog contracts.
 * Mirrors the public metadata shapes in `catalog/models.json` and `catalog/README.md` with zero
 * private workspace dependencies.
 */

export type ModelKind =
  | 'text'
  | 'vision'
  | 'image'
  | 'video'
  | 'transcription'
  | 'embedding'
  | 'reranker'
  | 'tts';

export type ModelFileRole = 'primary' | 'mmproj' | 'aux';

export interface ModelFileEntry {
  name: string;
  url: string;
  sizeBytes?: number;
  sha256?: string;
  role?: ModelFileRole;
}

export interface ModelEntry {
  id: string;
  name: string;
  kind: ModelKind;
  org?: string;
  sourceModelId?: string;
  description?: string;
  params?: number;
  activeParams?: number;
  quality?: number;
  minRamGb?: number;
  quant?: string;
  quantOf?: string;
  quantLabel?: string;
  supersededBy?: string;
  availability?: 'available' | 'coming_soon';
  grounder?: boolean;
  isNew?: boolean;
  nonCommercial?: boolean;
  minLlamaBuild?: number;
  releaseDate?: string;
  engine?: string;
  videoModes?: string[];
  imageModes?: string[];
  tags?: string[];
  files: ModelFileEntry[];
}

export interface MobileTextCatalogModel {
  id: string;
  name: string;
  params: number;
  description: string;
  minRam: number;
  maxRam?: number;
  type: 'text' | 'vision';
  org: string;
  isNew?: boolean;
  activeParams?: number;
  nonCommercial?: boolean;
}

export interface MobileWhisperCatalogModel {
  id: string;
  name: string;
  size: number;
  lang: string;
  url: string;
  description: string;
}

export interface MobileCoreMLCatalogRepo {
  repo: string;
  name: string;
  description: string;
  variant?: 'split_einsum' | 'original';
}

export interface MobileLiteRTCatalogEntry {
  fileName: string;
  hfRepoId: string;
  commitHash: string;
  sizeBytes: number;
  displayName: string;
  highlight: string;
  liteRTVision?: boolean;
  liteRTAudio?: boolean;
  maxContextTokens?: number;
  confirmDownload?: {
    title: string;
    message: string;
  };
}

export interface MtpHeadFile {
  name: string;
  url: string;
  sizeBytes: number;
  sha256: string;
}

export interface ModelFileVariant {
  fileName: string;
  sizeBytes: number;
  quant: string;
  downloadUrl: string;
  sha256?: string;
  mmproj?: {
    fileName: string;
    url: string;
    sizeBytes?: number;
  };
}

export interface HFSearchResult {
  id: string;
  name: string;
  org?: string;
  downloads?: number;
  likes?: number;
  lastModified?: string;
  readsImages?: boolean;
  params?: number;
  activeParams?: number;
  hasMtp?: boolean;
  newer?: string;
  variants?: Array<{
    id: string;
    author: string;
    downloads: number;
  }>;
}

export interface PickCandidate {
  id: string;
  sizeBytes: number;
  params?: number;
  org?: string;
  quality?: number;
  activeParams?: number;
  supersededBy?: string;
  nonCommercial?: boolean;
  minLlamaBuild?: number;
}

export interface VideoGenerationRequestContract {
  prompt?: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  frames?: number;
  fps?: number;
  steps?: number;
  guidanceScale?: number;
  flowShift?: number;
  seed?: number;
}

export interface MobileCatalogSections {
  models?: ModelEntry[];
  text?: MobileTextCatalogModel[];
  transcription?: MobileWhisperCatalogModel[];
  coreml?: MobileCoreMLCatalogRepo[];
  litert?: MobileLiteRTCatalogEntry[];
}

export interface CatalogCache {
  read: () => Promise<string | null>;
  write: (raw: string) => Promise<void>;
}

export type CatalogFetch = (
  input: string,
  init?: RequestInit,
) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
}>;
