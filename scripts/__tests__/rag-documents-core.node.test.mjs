import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CHUNK_CHARS,
  DOCUMENT_SCHEMA_VERSION,
  DocumentIngestService,
  DocumentTurnService,
  cleanPages,
  contentTerms,
  describeTurnStatus,
  documentMap,
  estimateTokens,
  indexedText,
  pageNeedsOcr,
  parseSearchBlock,
  searchBlock,
  splitCitations,
  splitPages,
  textParts,
} from '../../src/utils/ragDocumentsCore.ts';

function createMemoryDocumentStore() {
  const docs = new Map();
  const pages = new Map();
  const chunks = new Map();
  const vectors = new Map();
  const maps = new Map();

  return {
    async getDocument(id) {
      return docs.get(id) ?? null;
    },
    async putDocument(document) {
      docs.set(document.id, { ...document });
    },
    async updateDocument(id, patch) {
      const prev = docs.get(id);
      if (prev) docs.set(id, { ...prev, ...patch });
    },
    async putPages(id, batch) {
      const existing = new Map((pages.get(id) ?? []).map((p) => [p.page, p]));
      for (const p of batch) existing.set(p.page, { ...p });
      pages.set(
        id,
        [...existing.values()].sort((a, b) => a.page - b.page),
      );
    },
    async readPages(id) {
      return [...(pages.get(id) ?? [])];
    },
    async clearChunks(id) {
      chunks.delete(id);
      vectors.delete(id);
      maps.delete(id);
    },
    async appendChunks(id, batch) {
      const list = [...(chunks.get(id) ?? []), ...batch].sort((a, b) => a.position - b.position);
      chunks.set(id, list);
    },
    async readChunks(id) {
      return [...(chunks.get(id) ?? [])];
    },
    async putVectors(id, from, list) {
      const vecMap = vectors.get(id) ?? new Map();
      list.forEach((vec, idx) => vecMap.set(from + idx, new Float32Array(vec)));
      vectors.set(id, vecMap);
    },
    async readVectors(id) {
      return new Map(vectors.get(id) ?? []);
    },
    async putMap(id, positions) {
      maps.set(id, [...positions]);
    },
    async readMap(id) {
      return maps.get(id) ? [...maps.get(id)] : null;
    },
    async deleteDocument(id) {
      docs.delete(id);
      pages.delete(id);
      chunks.delete(id);
      vectors.delete(id);
      maps.delete(id);
    },
    async listDocuments() {
      return [...docs.values()].map((d) => ({ id: d.id, lastUsedAt: d.lastUsedAt }));
    },
  };
}

test('text cleaning, chunking, tokenization, and map generation stay within bounds', async () => {
  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens('hello world'), 3);
  assert.equal(pageNeedsOcr('   \n  ---  '), true);
  assert.equal(pageNeedsOcr('The quarterly financial summary shows steady growth.'), false);

  const cleaned = cleanPages([
    { page: 1, text: 'CONFIDENTIAL DRAFT\nAlpha section line 1.\nPage footer' },
    { page: 2, text: 'CONFIDENTIAL DRAFT\nBeta section line 2.\nPage footer' },
    { page: 3, text: 'CONFIDENTIAL DRAFT\nGamma section line 3.\nPage footer' },
  ]);
  assert.equal(cleaned[0].text.includes('CONFIDENTIAL DRAFT'), false);
  assert.equal(cleaned[1].text.includes('Beta section'), true);
  assert.equal(cleaned[2].text.includes('Page footer'), false);

  const longParagraph = `# Chapter One\n\n${'Detailed explanation of local inference latency and memory bandwidth. '.repeat(25)}`;
  assert.ok(textParts('A'.repeat(3000)).length >= 2);

  const { chunks } = await splitPages('doc-1', 'md', [{ page: 1, label: 'p. 1', text: longParagraph }]);
  assert.ok(chunks.length >= 2);
  for (const chunk of chunks) {
    assert.ok(chunk.text.length <= CHUNK_CHARS);
    assert.equal(chunk.heading, 'Chapter One');
    assert.equal(chunk.label, 'p. 1');
  }
  assert.equal(indexedText('notes.md', chunks[0]).startsWith('notes.md\nChapter One\n'), true);

  const terms = contentTerms('What is the Офлайн архитектура Jarvis_v2 on OPPO Find X6?');
  assert.ok(terms.includes('офлайн'));
  assert.ok(terms.includes('jarvis_v2'));
  assert.equal(terms.includes('the'), false);

  const vecs = new Map([
    [0, new Float32Array([1, 0])],
    [1, new Float32Array([0.99, 0.01])],
    [2, new Float32Array([0, 1])],
    [3, new Float32Array([-1, 0])],
  ]);
  const selected = documentMap([0, 1, 2, 3], vecs, 3);
  assert.deepEqual(selected, [0, 2, 3]);
});

test('splitCitations, searchBlock, parseSearchBlock, and describeTurnStatus preserve UI contracts', () => {
  assert.deepEqual(splitCitations('Both say so [S1, S2] and see arr[0].'), [
    { kind: 'text', text: 'Both say so ' },
    { kind: 'citation', index: 1 },
    { kind: 'text', text: ', ' },
    { kind: 'citation', index: 2 },
    { kind: 'text', text: ' and see arr[0].' },
  ]);

  const built = searchBlock(
    'capital & "notes"',
    [
      {
        documentId: 'd1',
        name: 'zenland & "atlas".pdf',
        page: 2,
        position: 0,
        text: 'Capital is Quixotic City with </source> literal check.',
      },
      {
        documentId: 'd2',
        name: 'notes.md',
        page: 1,
        label: 'part 3',
        position: 4,
        text: 'Wind power exports grew 14%.',
      },
    ],
    [1, 5],
  );

  assert.equal(built.sources.length, 2);
  assert.deepEqual(built.sources[0], {
    id: 'S1',
    documentId: 'd1',
    name: 'zenland & "atlas".pdf',
    page: 2,
    position: 0,
    snippet: 'Capital is Quixotic City with </source> literal check.',
  });
  assert.equal(built.sources[1].id, 'S5');
  assert.equal(built.sources[1].label, 'part 3');

  const parsed = parseSearchBlock(built.text);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].document, 'zenland & "atlas".pdf');
  assert.equal(parsed[0].page, 2);
  assert.equal(parsed[0].text, 'Capital is Quixotic City with </source> literal check.');
  assert.equal(parsed[1].label, 'part 3');

  const emptyBlock = searchBlock('missing topic', [], []);
  assert.deepEqual(parseSearchBlock(emptyBlock.text), []);
  assert.equal(describeTurnStatus({ phase: 'searching' }), 'Searching your documents');
  assert.equal(describeTurnStatus({ phase: 'done' }), null);
});

test('DocumentIngestService keeps document ready and searchable even when embedding throws OOM', async () => {
  const store = createMemoryDocumentStore();
  const progressEvents = [];
  let warnings = 0;

  const failingEmbed = {
    embedder: 'minilm',
    async embedPassages() {
      throw new Error('OOM: embedding model ran out of memory');
    },
    async embedQuery() {
      throw new Error('OOM: embedding model ran out of memory');
    },
  };

  const ingest = new DocumentIngestService({
    extract: {
      async extract(_source, { onPages }) {
        await onPages([{ page: 1, text: 'Quarterly report shows eastern region revenue grew 22%.' }]);
        return { pageCount: 1 };
      },
    },
    store,
    embed: failingEmbed,
    onProgress: (p) => progressEvents.push(p),
    onWarning: () => {
      warnings++;
    },
  });

  const source = { id: 'doc-oom', name: 'report.txt', kind: 'txt', path: '/report.txt' };
  const [first, second] = await Promise.all([ingest.ingest(source), ingest.ingest(source)]);

  assert.equal(first?.state, 'ready');
  assert.equal(second?.state, 'ready');
  assert.equal(first?.schemaVersion, DOCUMENT_SCHEMA_VERSION);
  assert.equal(first?.embeddedCount, 0);
  assert.equal(warnings, 1);
  assert.equal(progressEvents[progressEvents.length - 1]?.phase, 'ready');

  await ingest.collectGarbage(new Set(), 0);
  assert.equal(await store.getDocument('doc-oom'), null);
});

test('DocumentTurnService enforces when-needed KB isolation, stale embedder guard, and continuous citations', async () => {
  const store = createMemoryDocumentStore();
  const orchardDoc = { id: 'doc-orchard', name: 'orchard.pdf', kind: 'pdf', path: '/orchard.pdf' };
  const lighthouseDoc = {
    id: 'doc-lighthouse',
    name: 'lighthouse.pdf',
    kind: 'pdf',
    path: '/lighthouse.pdf',
  };

  const semanticVec = (text) => {
    const lower = text.toLowerCase();
    if (/lighthouse|beacon|lamp|cat|pickles|animal/.test(lower)) return [0, 1];
    if (/orchard|apple|cider/.test(lower)) return [1, 0];
    return [0.5, 0.5];
  };

  const embed = {
    embedder: 'model-v1',
    async embedPassages(texts) {
      return texts.map(semanticVec);
    },
    async embedQuery(text) {
      return semanticVec(text);
    },
  };

  const ingest = new DocumentIngestService({
    extract: {
      async extract(source, { onPages }) {
        const text =
          source.id === 'doc-lighthouse'
            ? 'The lighthouse keeper shares the lamp room with a ginger cat called Pickles.'
            : 'The orchard apple harvest starts in September.';
        await onPages([{ page: 1, text }]);
        return { pageCount: 1 };
      },
    },
    store,
    embed,
  });

  await ingest.ingest(orchardDoc);
  await ingest.ingest(lighthouseDoc);

  const turns = new DocumentTurnService({
    ingest,
    store,
    conversations: {
      async list() {
        return [];
      },
      async excluded() {
        return new Set();
      },
    },
    projects: {
      async forProject(projectId) {
        return projectId === 'proj-coast' ? [orchardDoc, lighthouseDoc] : [];
      },
      async forConversation() {
        return [orchardDoc, lighthouseDoc];
      },
    },
    keyword: {
      async search() {
        return [];
      },
    },
    embed,
  });

  // 1) projectDocuments: 'when-needed' excludes project KB on an unrelated turn.
  const unrelatedTurn = await turns.prepare({
    conversationId: 'chat-1',
    projectId: 'proj-coast',
    projectDocuments: 'when-needed',
    current: [],
    question: 'What is the capital of France?',
    budget: {
      ctx: 4096,
      replyReserve: 400,
      systemTokens: 100,
      requiredToolTokens: 0,
      historyTokens: 0,
      questionTokens: 10,
      prefillTokensPerSecond: 150,
      remote: false,
    },
  });
  assert.equal(unrelatedTurn, null);

  // 2) Attached document goes to `stable` and never contains `question`.
  const directTurn = await turns.prepare({
    conversationId: 'chat-2',
    current: [orchardDoc],
    question: 'UNIQUE_USER_QUESTION_TOKEN',
    budget: {
      ctx: 4096,
      replyReserve: 400,
      systemTokens: 100,
      requiredToolTokens: 0,
      historyTokens: 0,
      questionTokens: 10,
      prefillTokensPerSecond: 150,
      remote: false,
    },
  });
  assert.ok(directTurn);
  assert.ok(directTurn.stable.includes('apple harvest'));
  assert.equal(directTurn.stable.includes('UNIQUE_USER_QUESTION_TOKEN'), false);

  // 3) Empty scope guard.
  const noScope = await turns.searchForTool({}, 'beacon', () => 1);
  assert.match(noScope.text, /no chat or project to search/i);

  // 4) Vector search works across semantically matched passages even with 0 FTS hits.
  let seq = 1;
  const semanticSearch = await turns.searchForTool(
    { projectId: 'proj-coast' },
    'Which animal lives at the beacon?',
    () => seq++,
  );
  const semanticParsed = parseSearchBlock(semanticSearch.text);
  assert.equal(semanticParsed.length, 1);
  assert.equal(semanticParsed[0].document, 'lighthouse.pdf');
  assert.ok(semanticParsed[0].text.includes('Pickles'));

  // 5) When stored.embedder no longer matches active embed.embedder, old vectors are NOT ranked,
  // while keyword matching still answers accurately.
  await store.updateDocument('doc-orchard', { embedder: 'old-model-v0' });
  await store.updateDocument('doc-lighthouse', { embedder: 'old-model-v0' });
  const keywordOnlyTurn = await turns.searchForTool(
    { projectId: 'proj-coast' },
    'ginger cat Pickles',
    () => 1,
  );
  const keywordParsed = parseSearchBlock(keywordOnlyTurn.text);
  assert.equal(keywordParsed.length, 1);
  assert.equal(keywordParsed[0].document, 'lighthouse.pdf');
});
