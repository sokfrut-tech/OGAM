/**
 * OGAM-owned remote model catalog fetch, cache, schema validation, and deterministic merge logic.
 * Implements the schema documented in `catalog/README.md`.
 */

import type {
  CatalogCache,
  CatalogFetch,
  MobileCatalogSections,
  MobileCoreMLCatalogRepo,
  MobileLiteRTCatalogEntry,
  MobileTextCatalogModel,
  MobileWhisperCatalogModel,
  ModelEntry,
} from '../types/modelCatalog';

export type {
  CatalogCache,
  CatalogFetch,
  MobileCatalogSections,
} from '../types/modelCatalog';

export const MOBILE_CATALOG_URL =
  'https://raw.githubusercontent.com/off-grid-ai/OGAM/main/catalog/models.json';

type SectionName = keyof MobileCatalogSections;

export interface CachedMobileCatalog {
  sections: MobileCatalogSections;
  fetchedAt: number;
}

export interface RefreshRemoteCatalogSource {
  url: string;
  fetch: CatalogFetch;
  cache: CatalogCache;
  parseSections: (raw: unknown) => MobileCatalogSections;
}

export interface RefreshRemoteCatalogResult {
  status: 'ok' | 'failed';
  catalog?: CachedMobileCatalog;
  error?: string;
}

export interface CatalogDiff<T> {
  added: T[];
  changed: T[];
  removed: T[];
}

export const mobileCatalogKey = {
  models: (entry: ModelEntry): string => entry.id,
  text: (entry: MobileTextCatalogModel): string => entry.id,
  transcription: (entry: MobileWhisperCatalogModel): string => entry.id,
  coreml: (entry: MobileCoreMLCatalogRepo): string =>
    `${entry.repo}:${entry.variant ?? 'default'}`,
  litert: (entry: MobileLiteRTCatalogEntry): string => entry.fileName,
} as const;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isHttpsUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https:\/\/\S+/i.test(value.trim());
}

function isValidModelFile(value: unknown): boolean {
  if (!isPlainRecord(value)) return false;
  if (!isNonEmptyString(value.name) || !isHttpsUrl(value.url)) return false;
  if (value.sizeBytes !== undefined && (typeof value.sizeBytes !== 'number' || value.sizeBytes < 0)) {
    return false;
  }
  return true;
}

function isValidModelEntry(value: unknown): value is ModelEntry {
  if (!isPlainRecord(value)) return false;
  if (!isNonEmptyString(value.id) || !isNonEmptyString(value.name) || !isNonEmptyString(value.kind)) {
    return false;
  }
  if (!Array.isArray(value.files) || value.files.length === 0) return false;
  return value.files.every(file => isValidModelFile(file));
}

function isValidTextEntry(value: unknown): value is MobileTextCatalogModel {
  if (!isPlainRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    typeof value.params === 'number' &&
    Number.isFinite(value.params) &&
    typeof value.description === 'string' &&
    typeof value.minRam === 'number' &&
    Number.isFinite(value.minRam) &&
    (value.type === 'text' || value.type === 'vision') &&
    isNonEmptyString(value.org)
  );
}

function isValidTranscriptionEntry(value: unknown): value is MobileWhisperCatalogModel {
  if (!isPlainRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    typeof value.size === 'number' &&
    Number.isFinite(value.size) &&
    value.size > 0 &&
    isNonEmptyString(value.lang) &&
    isHttpsUrl(value.url) &&
    typeof value.description === 'string'
  );
}

function isValidCoreMLEntry(value: unknown): value is MobileCoreMLCatalogRepo {
  if (!isPlainRecord(value)) return false;
  return (
    isNonEmptyString(value.repo) &&
    isNonEmptyString(value.name) &&
    typeof value.description === 'string' &&
    (value.variant === undefined || value.variant === 'split_einsum' || value.variant === 'original')
  );
}

function isValidLiteRTEntry(value: unknown): value is MobileLiteRTCatalogEntry {
  if (!isPlainRecord(value)) return false;
  return (
    isNonEmptyString(value.fileName) &&
    isNonEmptyString(value.hfRepoId) &&
    isNonEmptyString(value.commitHash) &&
    typeof value.sizeBytes === 'number' &&
    Number.isFinite(value.sizeBytes) &&
    value.sizeBytes > 0 &&
    isNonEmptyString(value.displayName) &&
    typeof value.highlight === 'string'
  );
}

function sanitizeArray<T>(input: unknown, guard: (item: unknown) => item is T): T[] | undefined {
  if (!Array.isArray(input)) return undefined;
  return input.filter(guard);
}

/** Validates and extracts catalog sections from either a v1 envelope or raw sections object. */
export function parseMobileCatalogSections(raw: unknown): MobileCatalogSections {
  let payload: unknown = raw;
  if (typeof raw === 'string') {
    try {
      payload = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!isPlainRecord(payload)) return {};

  let sourceSections: Record<string, unknown> = payload;
  if ('sections' in payload) {
    if (payload.schemaVersion !== undefined && payload.schemaVersion !== 1) {
      return {};
    }
    if (!isPlainRecord(payload.sections)) {
      return {};
    }
    sourceSections = payload.sections;
  }

  const out: MobileCatalogSections = {};
  const models = sanitizeArray(sourceSections.models, isValidModelEntry);
  if (models) out.models = models;
  const text = sanitizeArray(sourceSections.text, isValidTextEntry);
  if (text) out.text = text;
  const transcription = sanitizeArray(sourceSections.transcription, isValidTranscriptionEntry);
  if (transcription) out.transcription = transcription;
  const coreml = sanitizeArray(sourceSections.coreml, isValidCoreMLEntry);
  if (coreml) out.coreml = coreml;
  const litert = sanitizeArray(sourceSections.litert, isValidLiteRTEntry);
  if (litert) out.litert = litert;
  return out;
}

/**
 * Merges a bundled list with remote/added entries: matching keys are replaced in place while
 * keeping bundled order, and unseen keys are appended. Never removes bundled entries.
 */
export function mergeCatalogEntries<T>(
  bundled: readonly T[],
  remote: readonly T[] | undefined,
  keyFn: (entry: T) => string,
): T[] {
  if (!remote || remote.length === 0) {
    return [...bundled];
  }

  const remoteByKey = new Map<string, T>();
  for (const item of remote) {
    remoteByKey.set(keyFn(item), item);
  }

  const merged: T[] = [];
  const seenKeys = new Set<string>();

  for (const item of bundled) {
    const key = keyFn(item);
    seenKeys.add(key);
    merged.push(remoteByKey.has(key) ? remoteByKey.get(key)! : item);
  }

  for (const item of remote) {
    const key = keyFn(item);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      merged.push(item);
    }
  }

  return merged;
}

function stableEntryString(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(v => stableEntryString(v)).join(',')}]`;
  }
  if (isPlainRecord(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map(k => `${JSON.stringify(k)}:${stableEntryString(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** Computes added, changed, and removed entries between two merged catalog snapshots. */
export function diffMergedCatalog<T>(
  before: readonly T[],
  after: readonly T[],
  keyFn: (entry: T) => string,
): CatalogDiff<T> {
  const beforeMap = new Map<string, T>();
  for (const item of before) {
    beforeMap.set(keyFn(item), item);
  }
  const afterMap = new Map<string, T>();
  for (const item of after) {
    afterMap.set(keyFn(item), item);
  }

  const added: T[] = [];
  const changed: T[] = [];
  const removed: T[] = [];

  for (const [key, item] of afterMap) {
    const prev = beforeMap.get(key);
    if (!prev) {
      added.push(item);
    } else if (stableEntryString(prev) !== stableEntryString(item)) {
      changed.push(item);
    }
  }

  for (const [key, item] of beforeMap) {
    if (!afterMap.has(key)) {
      removed.push(item);
    }
  }

  return { added, changed, removed };
}

/** Reads and validates a previously cached remote catalog from storage; returns null if empty or invalid. */
export async function loadCachedCatalog(
  source: Pick<RefreshRemoteCatalogSource, 'cache' | 'parseSections'>,
): Promise<CachedMobileCatalog | null> {
  try {
    const raw = await source.cache.read();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isPlainRecord(parsed)) return null;
    const sections = source.parseSections(parsed);
    const hasAnySection = (Object.keys(sections) as SectionName[]).some(k => sections[k] !== undefined);
    if (!hasAnySection && !isPlainRecord(parsed.sections)) return null;
    const fetchedAt =
      typeof parsed.fetchedAt === 'number' && Number.isFinite(parsed.fetchedAt)
        ? parsed.fetchedAt
        : 0;
    return { sections, fetchedAt };
  } catch {
    return null;
  }
}

/** Fetches, validates, and caches the remote model catalog without throwing on network errors. */
export async function refreshRemoteCatalog(
  source: RefreshRemoteCatalogSource,
): Promise<RefreshRemoteCatalogResult> {
  try {
    const response = await source.fetch(source.url, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      return {
        status: 'failed',
        error: `Catalog fetch failed with HTTP ${response.status}`,
      };
    }

    const rawText = await response.text();
    const parsedJson = JSON.parse(rawText) as unknown;
    if (!isPlainRecord(parsedJson) || parsedJson.schemaVersion !== 1 || !isPlainRecord(parsedJson.sections)) {
      return {
        status: 'failed',
        error: 'Remote catalog payload does not match schemaVersion 1.',
      };
    }

    const sections = source.parseSections(parsedJson);
    const fetchedAt = Date.now();
    await source.cache.write(
      JSON.stringify({
        schemaVersion: 1,
        updatedAt: typeof parsedJson.updatedAt === 'string' ? parsedJson.updatedAt : undefined,
        fetchedAt,
        sections,
      }),
    );

    return {
      status: 'ok',
      catalog: { sections, fetchedAt },
    };
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
