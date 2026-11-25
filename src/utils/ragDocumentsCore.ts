/**
 * Self-contained document ingestion, chunking, hybrid retrieval, citation formatting,
 * and turn budget management core.
 *
 * Replaces `@offgrid/rag/documents` so OGAM runs completely standalone with zero
 * external workspace package dependencies while preserving identical SQLite store,
 * FTS5 keyword, vector search, and UI citation contracts.
 */

export const DOCUMENT_SCHEMA_VERSION = 1;
export const CHUNK_CHARS = 900;
export const CHUNK_OVERLAP_CHARS = 120;
const TEXT_PAGE_CHARS = 2400;
const MAX_SNIPPET_CHARS = 220;
const MIN_VECTOR_ONLY_SIMILARITY = 0.25;

export interface DocumentSource {
  id: string;
  name: string;
  kind: string;
  path?: string;
  text?: string;
}

export interface DocumentPage {
  page: number;
  label?: string;
  text: string;
  needsOcr?: boolean;
}

export interface DocumentChunk {
  documentId: string;
  position: number;
  page: number;
  label?: string;
  heading?: string;
  text: string;
  tokens: number;
}

export type StoredDocumentState = 'reading' | 'ocr' | 'indexing' | 'ready' | 'failed';

export interface StoredDocument {
  id: string;
  name: string;
  kind: string;
  state: StoredDocumentState;
  pageCount: number;
  chunkCount: number;
  embeddedCount: number;
  unreadablePages: number;
  embedder: string;
  schemaVersion: number;
  error?: string;
  createdAt: number;
  lastUsedAt: number;
}

export type DocumentProgressPhase = 'reading' | 'ocr' | 'indexing' | 'ready' | 'failed';

export interface DocumentProgress {
  id: string;
  phase: DocumentProgressPhase;
  done: number;
  total: number;
  pageCount?: number;
  error?: string;
}

export interface KeywordHit {
  documentId: string;
  position: number;
  score: number;
}

export interface FoundPassage {
  documentId: string;
  name: string;
  page: number;
  label?: string;
  position: number;
  text: string;
  heading?: string;
  score?: number;
}

export interface CitedSource {
  id: string;
  documentId: string;
  name: string;
  page: number;
  position: number;
  label?: string;
  snippet: string;
}

export interface DocumentScope {
  conversationId?: string;
  projectId?: string;
}

export type DocumentTurnStatus =
  | { phase: 'waiting'; count?: number; name?: string }
  | { phase: 'reading'; count?: number; name?: string }
  | { phase: 'searching'; count?: number; name?: string }
  | { phase: 'ranking'; count?: number; name?: string }
  | { phase: 'done' }
  | { phase: 'idle' };

export type CitationSegment =
  | { kind: 'text'; text: string }
  | { kind: 'citation'; index: number };

export interface ParsedSearchPassage {
  id: string;
  document: string;
  page?: number;
  label?: string;
  text: string;
}

export interface ExtractPort {
  extract(
    source: DocumentSource,
    options: {
      signal: AbortSignal;
      onPages: (pages: DocumentPage[]) => Promise<void> | void;
    },
  ): Promise<{ pageCount: number }>;
}

export interface EmbedPort {
  readonly embedder: string;
  embedPassages(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}

export interface KeywordSearchPort {
  search(documentIds: readonly string[], query: string, limit: number): Promise<KeywordHit[]>;
}

export interface ConversationDocumentsPort {
  list(conversationId: string): Promise<DocumentSource[]>;
  excluded(conversationId: string): Promise<Set<string>>;
}

export interface ProjectDocumentsPort {
  forProject(projectId: string): Promise<DocumentSource[]>;
  forConversation(conversationId: string): Promise<DocumentSource[]>;
}

export interface DocumentIndexStore {
  getDocument(id: string): Promise<StoredDocument | null>;
  putDocument(document: StoredDocument): Promise<void>;
  updateDocument(id: string, patch: Partial<Omit<StoredDocument, 'id'>>): Promise<void>;
  putPages(id: string, pages: DocumentPage[]): Promise<void>;
  readPages(id: string): Promise<DocumentPage[]>;
  clearChunks(id: string): Promise<void>;
  appendChunks(id: string, chunks: DocumentChunk[]): Promise<void>;
  readChunks(id: string): Promise<DocumentChunk[]>;
  putVectors(id: string, from: number, vectors: number[][]): Promise<void>;
  readVectors(id: string): Promise<Map<number, Float32Array>>;
  putMap(id: string, positions: number[]): Promise<void>;
  readMap(id: string): Promise<number[] | null>;
  deleteDocument(id: string): Promise<void>;
  listDocuments(): Promise<Array<{ id: string; lastUsedAt: number }>>;
}

export interface Scheduler {
  yieldToForeground(): Promise<void>;
}

export interface TurnBudget {
  ctx: number;
  replyReserve: number;
  systemTokens: number;
  requiredToolTokens: number;
  historyTokens: number;
  questionTokens: number;
  prefillTokensPerSecond: number;
  remote: boolean;
  scale?: number;
}

export interface PrepareTurnOptions {
  conversationId: string;
  projectId?: string;
  onStatus?: (status: DocumentTurnStatus) => void;
  projectDocuments?: 'when-needed';
  current: DocumentSource[];
  question: string;
  previousQuestions?: string[];
  previousSources?: readonly string[];
  budget: TurnBudget;
}

export interface PrepareTurnResult {
  usedKeys: string[];
  sources: CitedSource[];
  stable: string;
  turn: string;
}

export interface DocumentIngestServiceOptions {
  extract: ExtractPort;
  store: DocumentIndexStore;
  scheduler?: Scheduler;
  embed?: EmbedPort;
  onProgress?: (progress: DocumentProgress) => void;
  onWarning?: (message: string, error: unknown) => void;
}

export interface DocumentTurnServiceOptions {
  ingest: DocumentIngestService;
  store: DocumentIndexStore;
  conversations: ConversationDocumentsPort;
  projects: ProjectDocumentsPort;
  keyword: KeywordSearchPort;
  embed?: EmbedPort;
  countTokens?: (text: string) => number;
  onWarning?: (message: string, error: unknown) => void;
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'has', 'have',
  'how', 'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or', 'that', 'the', 'their', 'this',
  'to', 'was', 'were', 'what', 'when', 'where', 'which', 'who', 'why', 'will', 'with',
  'в', 'во', 'и', 'или', 'к', 'ко', 'на', 'не', 'но', 'о', 'об', 'от', 'по', 'под', 'при',
  'про', 'с', 'со', 'то', 'у', 'что', 'это', 'как', 'где', 'для', 'из', 'за', 'над',
]);

/** Fast character-based token estimate compatible with llama/OpenAI rough prompting budgets. */
export function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.ceil(trimmed.length / 4));
}

/** Split plain text documents into reader-friendly pseudo-pages of ~2400 characters. */
export function textParts(text: string): DocumentPage[] {
  const normalized = text.replace(/\r\n?/g, '\n');
  if (!normalized.trim()) return [];
  if (normalized.length <= TEXT_PAGE_CHARS) {
    return [{ page: 1, label: 'Part 1', text: normalized }];
  }

  const rawParts: string[] = [];
  let cursor = 0;
  while (cursor < normalized.length) {
    let end = Math.min(normalized.length, cursor + TEXT_PAGE_CHARS);
    if (end < normalized.length) {
      const paraBreak = normalized.lastIndexOf('\n\n', end);
      const lineBreak = normalized.lastIndexOf('\n', end);
      const minAcceptable = cursor + Math.floor(TEXT_PAGE_CHARS * 0.5);
      if (paraBreak > minAcceptable) {
        end = paraBreak + 2;
      } else if (lineBreak > minAcceptable) {
        end = lineBreak + 1;
      }
    }
    const slice = normalized.slice(cursor, end);
    if (slice.trim()) rawParts.push(slice);
    cursor = end;
  }
  const parts = rawParts.length ? rawParts : [normalized];
  return parts.map((partText, idx) => ({
    page: idx + 1,
    label: `Part ${idx + 1}`,
    text: partText,
  }));
}

/** Return true when extracted page text contains too little readable text and needs OCR. */
export function pageNeedsOcr(text: string): boolean {
  const compact = text.replace(/\s+/g, '');
  if (!compact) return true;
  const readable = compact.match(/[\p{L}\p{N}]/gu) ?? [];
  return readable.length < 12 && compact.length < 25;
}

/** Normalize page whitespace and strip repetitive running headers/footers in multi-page documents. */
export function cleanPages(pages: readonly DocumentPage[]): DocumentPage[] {
  const normalized = pages.map((page) => ({
    ...page,
    text: page.text
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) => line.replace(/[ \t]+$/g, ''))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  }));

  let headerCandidate: string | null = null;
  let footerCandidate: string | null = null;
  if (normalized.length >= 3) {
    const firstCounts = new Map<string, number>();
    const lastCounts = new Map<string, number>();
    for (const p of normalized) {
      const lines = p.text.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) continue;
      if (lines[0]!.length <= 80) {
        firstCounts.set(lines[0]!, (firstCounts.get(lines[0]!) ?? 0) + 1);
      }
      const last = lines[lines.length - 1]!;
      if (last.length <= 80) {
        lastCounts.set(last, (lastCounts.get(last) ?? 0) + 1);
      }
    }
    const threshold = Math.ceil(normalized.length * 0.6);
    for (const [line, count] of firstCounts) {
      if (count >= threshold) {
        headerCandidate = line;
        break;
      }
    }
    for (const [line, count] of lastCounts) {
      if (count >= threshold && line !== headerCandidate) {
        footerCandidate = line;
        break;
      }
    }
  }

  return normalized.map((p) => {
    let text = p.text;
    if (headerCandidate || footerCandidate) {
      const lines = text.split('\n');
      if (headerCandidate && lines[0]?.trim() === headerCandidate) lines.shift();
      if (footerCandidate && lines[lines.length - 1]?.trim() === footerCandidate) lines.pop();
      text = lines.join('\n').trim();
    }
    const needsOcr = p.needsOcr || pageNeedsOcr(text);
    return {
      page: p.page,
      ...(p.label ? { label: p.label } : {}),
      text,
      ...(needsOcr ? { needsOcr: true } : {}),
    };
  });
}

function sliceTextIntoChunks(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= CHUNK_CHARS) return [trimmed];

  const out: string[] = [];
  let start = 0;
  while (start < trimmed.length) {
    let end = Math.min(trimmed.length, start + CHUNK_CHARS);
    if (end < trimmed.length) {
      const minCut = start + Math.floor(CHUNK_CHARS * 0.55);
      const para = trimmed.lastIndexOf('\n\n', end);
      const line = trimmed.lastIndexOf('\n', end);
      const sentence = Math.max(trimmed.lastIndexOf('. ', end), trimmed.lastIndexOf('! ', end), trimmed.lastIndexOf('? ', end));
      const space = trimmed.lastIndexOf(' ', end);
      if (para > minCut) end = para;
      else if (sentence > minCut) end = sentence + 1;
      else if (line > minCut) end = line;
      else if (space > minCut) end = space;
    }
    const segment = trimmed.slice(start, end).trim();
    if (segment) out.push(segment);
    if (end >= trimmed.length) break;
    const nextStart = Math.max(start + 1, end - CHUNK_OVERLAP_CHARS);
    const spaceAfterOverlap = trimmed.indexOf(' ', nextStart);
    start = spaceAfterOverlap !== -1 && spaceAfterOverlap < end - 20 ? spaceAfterOverlap + 1 : nextStart;
  }
  return out;
}

/** Split cleaned pages into overlapping chunks sized cleanly for on-device embedding contexts. */
export async function splitPages(
  documentId: string,
  _kind: string,
  pages: readonly DocumentPage[],
): Promise<{ chunks: DocumentChunk[] }> {
  const chunks: DocumentChunk[] = [];
  let position = 0;
  let activeHeading: string | undefined;

  for (const page of pages) {
    if (page.needsOcr) continue;
    const trimmedPage = page.text.trim();
    if (!trimmedPage) continue;

    for (const line of trimmedPage.split('\n')) {
      const mdHeading = /^#{1,3}\s+(.{2,100})$/.exec(line.trim());
      if (mdHeading) {
        activeHeading = mdHeading[1]!.trim();
        break;
      }
    }

    const pieces = sliceTextIntoChunks(trimmedPage);
    for (const piece of pieces) {
      const headingInPiece = /^#{1,3}\s+(.{2,100})$/m.exec(piece);
      if (headingInPiece) {
        activeHeading = headingInPiece[1]!.trim();
      }
      chunks.push({
        documentId,
        position: position++,
        page: page.page,
        ...(page.label ? { label: page.label } : {}),
        ...(activeHeading ? { heading: activeHeading } : {}),
        text: piece,
        tokens: estimateTokens(piece),
      });
    }
  }
  return { chunks };
}

/** Format a chunk for both FTS5 indexing and embedding input. */
export function indexedText(
  documentName: string,
  chunk: Pick<DocumentChunk, 'heading' | 'text'>,
): string {
  return [documentName.trim(), chunk.heading?.trim(), chunk.text].filter(Boolean).join('\n');
}

/** Extract safe FTS5-compatible lowercase search terms supporting Latin, Cyrillic, and numbers. */
export function contentTerms(text: string): string[] {
  const tokens = text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [];
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const token of tokens) {
    if (token.length < 2 || STOP_WORDS.has(token) || seen.has(token)) continue;
    seen.add(token);
    terms.push(token);
  }
  return terms;
}

function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    const va = a[i]!;
    const vb = b[i]!;
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  if (normA <= 0 || normB <= 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Select up to `maxEntries` representative chunk positions covering a document evenly / diversely. */
export function documentMap(
  positions: readonly number[],
  vectors: ReadonlyMap<number, Float32Array>,
  maxEntries = 12,
): number[] {
  const sorted = [...new Set(positions)].sort((a, b) => a - b);
  if (sorted.length <= maxEntries || maxEntries <= 0) return sorted;

  const hasVectors = sorted.some((pos) => vectors.has(pos));
  if (!hasVectors) {
    const picked: number[] = [];
    for (let i = 0; i < maxEntries; i++) {
      const idx = Math.round((i * (sorted.length - 1)) / (maxEntries - 1));
      picked.push(sorted[idx]!);
    }
    return [...new Set(picked)].sort((a, b) => a - b);
  }

  const chosen = [sorted[0]!];
  const chosenSet = new Set(chosen);
  while (chosen.length < maxEntries) {
    let bestPos: number | null = null;
    let bestScore = -Infinity;
    for (const candidate of sorted) {
      if (chosenSet.has(candidate)) continue;
      const candVec = vectors.get(candidate);
      let minDist = Infinity;
      for (const prev of chosen) {
        const prevVec = vectors.get(prev);
        const dist =
          candVec && prevVec
            ? 1 - cosineSimilarity(candVec, prevVec)
            : Math.abs(candidate - prev) / Math.max(1, sorted.length);
        if (dist < minDist) minDist = dist;
      }
      if (minDist > bestScore) {
        bestScore = minDist;
        bestPos = candidate;
      }
    }
    if (bestPos === null) break;
    chosen.push(bestPos);
    chosenSet.add(bestPos);
  }
  return chosen.sort((a, b) => a - b);
}

/** Split assistant answer text into plain text segments and individual `[S#]` citation tokens. */
export function splitCitations(text: string): CitationSegment[] {
  const segments: CitationSegment[] = [];
  const pattern = /\[(S[1-9]\d*(?:\s*[,;]\s*S[1-9]\d*)*)\]/g;
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({ kind: 'text', text: text.slice(lastIndex, start) });
    }
    const inner = match[1]!;
    const refs = inner.split(/\s*[,;]\s*/);
    refs.forEach((ref, idx) => {
      if (idx > 0) {
        segments.push({ kind: 'text', text: ', ' });
      }
      segments.push({ kind: 'citation', index: Number(ref.slice(1)) });
    });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ kind: 'text', text: text.slice(lastIndex) });
  }
  return segments;
}

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function unescapeXmlAttr(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function makeSnippet(text: string): string {
  const singleLine = text.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= MAX_SNIPPET_CHARS) return singleLine;
  return `${singleLine.slice(0, MAX_SNIPPET_CHARS - 1).trimEnd()}…`;
}

function toCitedSource(passage: FoundPassage, number: number): CitedSource {
  return {
    id: `S${number}`,
    documentId: passage.documentId,
    name: passage.name,
    page: passage.page,
    position: passage.position,
    ...(passage.label ? { label: passage.label } : {}),
    snippet: makeSnippet(passage.text),
  };
}

function formatSourceBlock(passage: FoundPassage, number: number): string {
  const attrs = [
    `id="S${number}"`,
    `document="${escapeXmlAttr(passage.name)}"`,
    `page="${passage.page}"`,
    ...(passage.label ? [`label="${escapeXmlAttr(passage.label)}"`] : []),
  ].join(' ');
  const safeBody = passage.text.replace(/<\/source>/gi, '&lt;/source&gt;');
  return `<source ${attrs}>\n${safeBody}\n</source>`;
}

/** Render matched passages and their citation numbers into `<source>` blocks plus `CitedSource[]`. */
export function searchBlock(
  query: string,
  passages: readonly FoundPassage[],
  numbers: readonly number[],
): { text: string; sources: CitedSource[] } {
  if (!passages.length) {
    return {
      text: `No passages in the knowledge base match "${query}".`,
      sources: [],
    };
  }
  const blocks: string[] = [];
  const sources: CitedSource[] = [];
  passages.forEach((passage, idx) => {
    const number = numbers[idx] ?? idx + 1;
    blocks.push(formatSourceBlock(passage, number));
    sources.push(toCitedSource(passage, number));
  });
  return {
    text: blocks.join('\n\n'),
    sources,
  };
}

/** Parse `<source ...>...</source>` blocks produced by `searchBlock` back into passage records. */
export function parseSearchBlock(content: string): ParsedSearchPassage[] {
  if (!content) return [];
  const passages: ParsedSearchPassage[] = [];
  const blockPattern = /<source\b([^>]*)>([\s\S]*?)<\/source>/g;
  const attrPattern = /([a-zA-Z0-9_-]+)="([^"]*)"/g;

  for (const match of content.matchAll(blockPattern)) {
    const rawAttrs = match[1] ?? '';
    const attrs: Record<string, string> = {};
    for (const attrMatch of rawAttrs.matchAll(attrPattern)) {
      attrs[attrMatch[1]!] = unescapeXmlAttr(attrMatch[2]!);
    }
    const pageNum = attrs.page !== undefined ? Number(attrs.page) : undefined;
    passages.push({
      id: attrs.id ?? '',
      document: attrs.document ?? '',
      ...(pageNum !== undefined && Number.isFinite(pageNum) ? { page: pageNum } : {}),
      ...(attrs.label ? { label: attrs.label } : {}),
      text: (match[2] ?? '').replace(/&lt;\/source&gt;/gi, '</source>').trim(),
    });
  }
  return passages;
}

/** Format a live document turn status into a short UI line, or null when idle/done. */
export function describeTurnStatus(status: DocumentTurnStatus): string | null {
  switch (status.phase) {
    case 'waiting':
      return status.name ? `Waiting for ${status.name}` : 'Waiting for documents';
    case 'reading':
      return status.name ? `Reading ${status.name}` : 'Reading documents';
    case 'searching':
      return 'Searching your documents';
    case 'ranking':
      return 'Picking the best passages';
    case 'done':
    case 'idle':
      return null;
  }
}

export class DocumentIngestService {
  private readonly extract: ExtractPort;
  private readonly store: DocumentIndexStore;
  private readonly scheduler?: Scheduler;
  private readonly embed?: EmbedPort;
  private readonly onProgress?: (progress: DocumentProgress) => void;
  private readonly onWarning?: (message: string, error: unknown) => void;
  private readonly inFlight = new Map<string, Promise<StoredDocument | null>>();

  constructor(options: DocumentIngestServiceOptions) {
    this.extract = options.extract;
    this.store = options.store;
    this.scheduler = options.scheduler;
    this.embed = options.embed;
    this.onProgress = options.onProgress;
    this.onWarning = options.onWarning;
  }

  isRunning(documentId: string): boolean {
    return this.inFlight.has(documentId);
  }

  ingest(source: DocumentSource): Promise<StoredDocument | null> {
    const active = this.inFlight.get(source.id);
    if (active) return active;

    const job = this.runIngest(source).finally(() => {
      this.inFlight.delete(source.id);
    });
    this.inFlight.set(source.id, job);
    return job;
  }

  private async runIngest(source: DocumentSource): Promise<StoredDocument | null> {
    const existing = await this.store.getDocument(source.id);
    const now = Date.now();
    if (existing && existing.state === 'ready' && existing.schemaVersion === DOCUMENT_SCHEMA_VERSION) {
      await this.store.updateDocument(source.id, { lastUsedAt: now });
      if (this.embed && existing.chunkCount > 0 && (existing.embeddedCount < existing.chunkCount || existing.embedder !== this.embed.embedder)) {
        const chunks = await this.store.readChunks(source.id);
        await this.embedChunksSafely(source, chunks, existing.pageCount);
      }
      return this.store.getDocument(source.id);
    }

    const createdAt = existing?.createdAt ?? now;
    await this.store.putDocument({
      id: source.id,
      name: source.name,
      kind: source.kind,
      state: 'reading',
      pageCount: 0,
      chunkCount: 0,
      embeddedCount: 0,
      unreadablePages: 0,
      embedder: '',
      schemaVersion: DOCUMENT_SCHEMA_VERSION,
      createdAt,
      lastUsedAt: now,
    });
    this.onProgress?.({ id: source.id, phase: 'reading', done: 0, total: 0 });

    const controller = new AbortController();
    let extractedPageCount = 0;
    try {
      const result = await this.extract.extract(source, {
        signal: controller.signal,
        onPages: async (batch) => {
          if (!batch.length) return;
          await this.store.putPages(source.id, batch);
          extractedPageCount += batch.length;
          this.onProgress?.({
            id: source.id,
            phase: 'reading',
            done: extractedPageCount,
            total: Math.max(extractedPageCount, resultPageHint(batch, extractedPageCount)),
          });
        },
      });
      extractedPageCount = Math.max(extractedPageCount, result.pageCount);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.store.updateDocument(source.id, {
        state: 'failed',
        error: message,
        lastUsedAt: Date.now(),
      });
      this.onProgress?.({ id: source.id, phase: 'failed', done: 0, total: 0, error: message });
      this.onWarning?.(`Reading ${source.name} failed`, error);
      return this.store.getDocument(source.id);
    }

    const rawPages = await this.store.readPages(source.id);
    const cleaned = cleanPages(rawPages);
    if (cleaned.length) {
      await this.store.putPages(source.id, cleaned);
    }
    const pageCount = Math.max(extractedPageCount, cleaned.length);
    const unreadablePages = cleaned.filter((p) => p.needsOcr).length;

    const { chunks } = await splitPages(source.id, source.kind, cleaned);
    await this.store.clearChunks(source.id);
    this.onProgress?.({
      id: source.id,
      phase: 'indexing',
      done: 0,
      total: Math.max(1, chunks.length),
      pageCount,
    });

    const CHUNK_BATCH = 64;
    for (let i = 0; i < chunks.length; i += CHUNK_BATCH) {
      if (this.scheduler) await this.scheduler.yieldToForeground();
      await this.store.appendChunks(source.id, chunks.slice(i, i + CHUNK_BATCH));
      this.onProgress?.({
        id: source.id,
        phase: 'indexing',
        done: Math.min(chunks.length, i + CHUNK_BATCH),
        total: Math.max(1, chunks.length),
        pageCount,
      });
    }

    // Store document as 'ready' immediately after pages & chunks (FTS5 keyword search works now).
    // Vector embedding is best-effort: an OOM/load failure must never discard a readable file.
    await this.store.updateDocument(source.id, {
      state: 'ready',
      pageCount,
      chunkCount: chunks.length,
      embeddedCount: 0,
      unreadablePages,
      embedder: this.embed?.embedder ?? '',
      schemaVersion: DOCUMENT_SCHEMA_VERSION,
      error: undefined,
      lastUsedAt: Date.now(),
    });
    this.onProgress?.({
      id: source.id,
      phase: 'ready',
      done: pageCount,
      total: pageCount,
      pageCount,
    });

    await this.store.putMap(
      source.id,
      documentMap(chunks.map((c) => c.position), new Map()),
    );

    if (this.embed && chunks.length > 0) {
      await this.embedChunksSafely(source, chunks, pageCount);
    }
    return this.store.getDocument(source.id);
  }

  private async embedChunksSafely(
    source: DocumentSource,
    chunks: readonly DocumentChunk[],
    pageCount: number,
  ): Promise<void> {
    if (!this.embed || chunks.length === 0) return;
    const activeEmbedder = this.embed.embedder;
    const EMBED_BATCH = 8;
    const collectedVectors = new Map<number, Float32Array>();
    let embeddedCount = 0;

    try {
      for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
        if (this.scheduler) await this.scheduler.yieldToForeground();
        const batch = chunks.slice(i, i + EMBED_BATCH);
        const texts = batch.map((chunk) => indexedText(source.name, chunk));
        const vectors = await this.embed.embedPassages(texts);
        await this.store.putVectors(source.id, batch[0]!.position, vectors);
        batch.forEach((chunk, idx) => {
          const vec = vectors[idx];
          if (vec) collectedVectors.set(chunk.position, new Float32Array(vec));
        });
        embeddedCount += vectors.length;
      }

      await this.store.updateDocument(source.id, {
        embeddedCount,
        embedder: activeEmbedder,
        lastUsedAt: Date.now(),
      });
      await this.store.putMap(
        source.id,
        documentMap(chunks.map((c) => c.position), collectedVectors),
      );
    } catch (error) {
      // Keep the document ready and keyword-searchable on embedding OOM/timeout.
      this.onWarning?.(`Embedding ${source.name} failed (keyword search stays active)`, error);
      this.onProgress?.({
        id: source.id,
        phase: 'ready',
        done: pageCount,
        total: pageCount,
        pageCount,
      });
    }
  }

  async collectGarbage(referencedIds: Iterable<string>, graceMs = 0): Promise<void> {
    const keep = referencedIds instanceof Set ? referencedIds : new Set(referencedIds);
    const now = Date.now();
    const docs = await this.store.listDocuments();
    for (const doc of docs) {
      if (!keep.has(doc.id) && now - doc.lastUsedAt >= graceMs) {
        await this.store.deleteDocument(doc.id);
      }
    }
  }
}

function resultPageHint(batch: readonly DocumentPage[], soFar: number): number {
  let maxPage = soFar;
  for (const page of batch) {
    if (page.page > maxPage) maxPage = page.page;
  }
  return maxPage;
}

function dedupeSources(sources: readonly DocumentSource[]): DocumentSource[] {
  const seen = new Set<string>();
  const out: DocumentSource[] = [];
  for (const src of sources) {
    if (!seen.has(src.id)) {
      seen.add(src.id);
      out.push(src);
    }
  }
  return out;
}

function lexicalOverlapScore(queryTerms: readonly string[], candidateText: string): number {
  if (!queryTerms.length) return 0;
  const candidateSet = new Set(contentTerms(candidateText));
  if (!candidateSet.size) return 0;
  let hits = 0;
  for (const term of queryTerms) {
    if (candidateSet.has(term)) hits++;
  }
  return hits / queryTerms.length;
}

export class DocumentTurnService {
  private readonly ingest: DocumentIngestService;
  private readonly store: DocumentIndexStore;
  private readonly conversations: ConversationDocumentsPort;
  private readonly projects: ProjectDocumentsPort;
  private readonly keyword: KeywordSearchPort;
  private readonly embed?: EmbedPort;
  private readonly countTokens: (text: string) => number;
  private readonly onWarning?: (message: string, error: unknown) => void;

  constructor(options: DocumentTurnServiceOptions) {
    this.ingest = options.ingest;
    this.store = options.store;
    this.conversations = options.conversations;
    this.projects = options.projects;
    this.keyword = options.keyword;
    this.embed = options.embed;
    this.countTokens = options.countTokens ?? estimateTokens;
    this.onWarning = options.onWarning;
  }

  private async ensureReady(
    docs: readonly DocumentSource[],
    onStatus?: (status: DocumentTurnStatus) => void,
  ): Promise<void> {
    for (const doc of docs) {
      const stored = await this.store.getDocument(doc.id);
      if (!stored || stored.state !== 'ready' || stored.schemaVersion !== DOCUMENT_SCHEMA_VERSION) {
        onStatus?.({ phase: 'reading', name: doc.name });
        await this.ingest.ingest(doc);
      } else {
        await this.store.updateDocument(doc.id, { lastUsedAt: Date.now() });
      }
    }
  }

  private computePromptBudget(budget: TurnBudget): number {
    const rawHeadroom =
      budget.ctx -
      budget.replyReserve -
      budget.systemTokens -
      budget.requiredToolTokens -
      budget.historyTokens -
      budget.questionTokens;
    const scaled = Math.floor(Math.max(0, rawHeadroom) * (budget.scale ?? 1));
    if (!budget.remote && budget.prefillTokensPerSecond > 0) {
      // Keep on-device prompt prefill responsive under ~12 seconds while allowing generous attachments.
      const prefillCap = Math.max(512, Math.floor(budget.prefillTokensPerSecond * 12));
      return Math.min(scaled, prefillCap);
    }
    return scaled;
  }

  async prepare(options: PrepareTurnOptions): Promise<PrepareTurnResult | null> {
    const excluded = await this.conversations.excluded(options.conversationId);
    const conversationDocs = await this.conversations.list(options.conversationId);
    const projectDocs =
      options.projectId && options.projectDocuments !== 'when-needed'
        ? await this.projects.forProject(options.projectId)
        : [];

    const candidateDocs = dedupeSources([
      ...options.current,
      ...conversationDocs,
      ...projectDocs,
    ]).filter((doc) => !excluded.has(doc.id));

    if (!candidateDocs.length) {
      options.onStatus?.({ phase: 'idle' });
      return null;
    }

    await this.ensureReady(candidateDocs, options.onStatus);

    const budgetTokens = this.computePromptBudget(options.budget);
    if (budgetTokens <= 0) {
      options.onStatus?.({ phase: 'done' });
      return null;
    }

    const sortedDocs = [...candidateDocs].sort((a, b) => a.id.localeCompare(b.id));
    const docChunks = new Map<string, DocumentChunk[]>();
    let totalTokens = 0;

    for (const doc of sortedDocs) {
      const stored = await this.store.getDocument(doc.id);
      if (!stored || stored.state !== 'ready') continue;
      const chunks = await this.store.readChunks(doc.id);
      if (!chunks.length) continue;
      docChunks.set(doc.id, chunks);
      for (const c of chunks) totalTokens += c.tokens || this.countTokens(c.text);
    }

    if (!docChunks.size) {
      options.onStatus?.({ phase: 'done' });
      return null;
    }

    const fullFitBudget = Math.floor(budgetTokens * 0.85);
    const usedKeys: string[] = [];
    const sources: CitedSource[] = [];
    let nextCitation = 1;

    // Small attachments fit completely inside `stable` (question-independent, KV-cache friendly).
    if (totalTokens <= fullFitBudget) {
      const stableBlocks: string[] = [];
      for (const doc of sortedDocs) {
        const chunks = docChunks.get(doc.id) ?? [];
        for (const chunk of chunks) {
          const num = nextCitation++;
          const passage: FoundPassage = {
            documentId: doc.id,
            name: doc.name,
            page: chunk.page,
            ...(chunk.label ? { label: chunk.label } : {}),
            position: chunk.position,
            text: chunk.text,
            ...(chunk.heading ? { heading: chunk.heading } : {}),
          };
          stableBlocks.push(formatSourceBlock(passage, num));
          sources.push(toCitedSource(passage, num));
          usedKeys.push(`${passage.documentId}:${passage.page}:${passage.position}`);
        }
      }
      options.onStatus?.({ phase: 'done' });
      return {
        usedKeys,
        sources,
        stable: stableBlocks.length ? `Attached documents:\n\n${stableBlocks.join('\n\n')}` : '',
        turn: '',
      };
    }

    // Large documents: place representative map chunks in `stable` (never depends on `question`),
    // and place query-ranked passages in `turn`.
    const stableBudget = Math.floor(budgetTokens * 0.25);
    const stableBlocks: string[] = [];
    const includedKeys = new Set<string>();
    let usedTokens = 0;

    for (const doc of sortedDocs) {
      const chunks = docChunks.get(doc.id) ?? [];
      const mapPositions = (await this.store.readMap(doc.id)) ?? chunks.slice(0, 3).map((c) => c.position);
      const posSet = new Set(mapPositions);
      for (const chunk of chunks) {
        if (!posSet.has(chunk.position)) continue;
        const chunkTokens = (chunk.tokens || this.countTokens(chunk.text)) + 20;
        if (usedTokens + chunkTokens > stableBudget && stableBlocks.length > 0) break;
        const num = nextCitation++;
        const passage: FoundPassage = {
          documentId: doc.id,
          name: doc.name,
          page: chunk.page,
          ...(chunk.label ? { label: chunk.label } : {}),
          position: chunk.position,
          text: chunk.text,
          ...(chunk.heading ? { heading: chunk.heading } : {}),
        };
        stableBlocks.push(formatSourceBlock(passage, num));
        sources.push(toCitedSource(passage, num));
        const key = `${passage.documentId}:${passage.page}:${passage.position}`;
        includedKeys.add(key);
        usedKeys.push(key);
        usedTokens += chunkTokens;
      }
    }

    options.onStatus?.({ phase: 'searching' });
    const searchQuery = [options.question, ...(options.previousQuestions ?? []).slice(-1)]
      .filter((s) => s.trim())
      .join(' ');
    const ranked = await this.findPassages(sortedDocs, searchQuery, 24, { allowBroadFallback: true });
    options.onStatus?.({ phase: 'ranking' });

    const turnBlocks: string[] = [];
    for (const passage of ranked) {
      const key = `${passage.documentId}:${passage.page}:${passage.position}`;
      if (includedKeys.has(key)) continue;
      const passageTokens = this.countTokens(passage.text) + 20;
      if (usedTokens + passageTokens > budgetTokens && turnBlocks.length > 0) break;
      const num = nextCitation++;
      turnBlocks.push(formatSourceBlock(passage, num));
      sources.push(toCitedSource(passage, num));
      includedKeys.add(key);
      usedKeys.push(key);
      usedTokens += passageTokens;
    }

    options.onStatus?.({ phase: 'done' });
    if (!stableBlocks.length && !turnBlocks.length) return null;
    return {
      usedKeys,
      sources,
      stable: stableBlocks.length ? `Document overview:\n\n${stableBlocks.join('\n\n')}` : '',
      turn: turnBlocks.length ? `Relevant passages:\n\n${turnBlocks.join('\n\n')}` : '',
    };
  }

  async searchForTool(
    scope: DocumentScope,
    query: string,
    citationId: (passage: FoundPassage) => number,
    options?: { onStatus?: (status: DocumentTurnStatus) => void },
  ): Promise<{ text: string; sources: CitedSource[] }> {
    if (!scope.conversationId && !scope.projectId) {
      return {
        text: 'There is no chat or project to search.',
        sources: [],
      };
    }

    const excluded = scope.conversationId
      ? await this.conversations.excluded(scope.conversationId)
      : new Set<string>();
    const conversationDocs = scope.conversationId
      ? await this.conversations.list(scope.conversationId)
      : [];
    const projectDocs = scope.projectId
      ? await this.projects.forProject(scope.projectId)
      : scope.conversationId
        ? await this.projects.forConversation(scope.conversationId)
        : [];

    const scopedDocs = dedupeSources([...conversationDocs, ...projectDocs]).filter(
      (doc) => !excluded.has(doc.id),
    );
    if (!scopedDocs.length) {
      return searchBlock(query, [], []);
    }

    await this.ensureReady(scopedDocs, options?.onStatus);
    options?.onStatus?.({ phase: 'searching' });
    const passages = await this.findPassages(scopedDocs, query, 8, { allowBroadFallback: false });
    options?.onStatus?.({ phase: 'ranking' });

    if (!passages.length) {
      options?.onStatus?.({ phase: 'done' });
      return searchBlock(query, [], []);
    }

    const numbers = passages.map((passage) => citationId(passage));
    const result = searchBlock(query, passages, numbers);
    options?.onStatus?.({ phase: 'done' });
    return result;
  }

  private async findPassages(
    docs: readonly DocumentSource[],
    query: string,
    limit: number,
    options: { allowBroadFallback: boolean },
  ): Promise<FoundPassage[]> {
    const docIds = docs.map((d) => d.id);
    const docById = new Map(docs.map((d) => [d.id, d]));
    const queryTerms = contentTerms(query);

    let keywordHits: KeywordHit[] = [];
    try {
      keywordHits = await this.keyword.search(docIds, query, limit * 3);
    } catch (error) {
      this.onWarning?.('Keyword search failed, continuing with lexical/vector search', error);
    }

    const keywordMap = new Map<string, number>();
    for (const hit of keywordHits) {
      keywordMap.set(`${hit.documentId}:${hit.position}`, hit.score);
    }

    let queryVec: number[] | null = null;
    if (this.embed && query.trim()) {
      try {
        queryVec = await this.embed.embedQuery(query);
      } catch (error) {
        this.onWarning?.('Query embedding failed, falling back to keyword search', error);
      }
    }

    const scored: Array<{ passage: FoundPassage; score: number }> = [];
    const fallbackAll: FoundPassage[] = [];

    for (const doc of docs) {
      const stored = await this.store.getDocument(doc.id);
      if (!stored || stored.state !== 'ready') continue;
      const chunks = await this.store.readChunks(doc.id);
      if (!chunks.length) continue;

      const vectorsCompatible =
        Boolean(queryVec && this.embed && stored.embedder === this.embed.embedder);
      const vectors = vectorsCompatible ? await this.store.readVectors(doc.id) : new Map<number, Float32Array>();

      for (const chunk of chunks) {
        const key = `${doc.id}:${chunk.position}`;
        const ftsScore = keywordMap.get(key) ?? 0;
        const lexical = lexicalOverlapScore(queryTerms, indexedText(doc.name, chunk));
        const vec = vectors.get(chunk.position);
        const vecSim = queryVec && vec ? Math.max(0, cosineSimilarity(queryVec, vec)) : 0;

        const passage: FoundPassage = {
          documentId: doc.id,
          name: docById.get(doc.id)?.name ?? doc.name,
          page: chunk.page,
          ...(chunk.label ? { label: chunk.label } : {}),
          position: chunk.position,
          text: chunk.text,
          ...(chunk.heading ? { heading: chunk.heading } : {}),
        };
        fallbackAll.push(passage);

        const matchedByKeyword = ftsScore > 0 || lexical > 0;
        const matchedByMeaning = vecSim >= MIN_VECTOR_ONLY_SIMILARITY;
        if (!matchedByKeyword && !matchedByMeaning) continue;

        const combined =
          (ftsScore > 0 ? 1.5 + Math.log1p(ftsScore) : 0) +
          lexical * 2.0 +
          vecSim * 2.5;
        passage.score = combined;
        scored.push({ passage, score: combined });
      }
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const docCmp = a.passage.documentId.localeCompare(b.passage.documentId);
      return docCmp !== 0 ? docCmp : a.passage.position - b.passage.position;
    });

    if (scored.length > 0) {
      return scored.slice(0, limit).map((entry) => entry.passage);
    }
    return options.allowBroadFallback ? fallbackAll.slice(0, limit) : [];
  }
}
