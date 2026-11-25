import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MOBILE_CATALOG_URL,
  mobileCatalogKey,
  parseMobileCatalogSections,
  mergeCatalogEntries,
  diffMergedCatalog,
  loadCachedCatalog,
  refreshRemoteCatalog,
} from '../../src/utils/remoteCatalogCore.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('MOBILE_CATALOG_URL points to expected HTTPS catalog URL and parses repo catalog/models.json', () => {
  assert.equal(
    MOBILE_CATALOG_URL,
    'https://raw.githubusercontent.com/off-grid-ai/OGAM/main/catalog/models.json',
  );

  const rawCatalog = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'catalog/models.json'), 'utf8'),
  );
  const parsed = parseMobileCatalogSections(rawCatalog);
  assert.ok(parsed);
  assert.ok(Array.isArray(parsed.models) && parsed.models.length > 0);
  assert.ok(Array.isArray(parsed.text));
  assert.ok(Array.isArray(parsed.transcription));

  const unsafe = parseMobileCatalogSections({
    schemaVersion: 1,
    sections: {
      models: [
        {
          id: 'bad-http',
          name: 'Bad HTTP Model',
          kind: 'text',
          files: [{ name: 'bad.gguf', url: 'http://insecure.example.com/bad.gguf', sizeBytes: 100 }],
        },
      ],
    },
  });
  assert.equal(unsafe.models?.length ?? 0, 0);
});

test('mergeCatalogEntries, diffMergedCatalog, loadCachedCatalog, and refreshRemoteCatalog work deterministically', async () => {
  const validFile = (name) => ({
    name,
    url: `https://example.com/${name}`,
    sizeBytes: 1024,
  });

  const bundled = [
    { id: 'model-a', name: 'Model A', kind: 'text', files: [validFile('a.gguf')] },
  ];
  const remote = [
    { id: 'model-a', name: 'Model A Updated', kind: 'text', files: [validFile('a.gguf')] },
    { id: 'model-b', name: 'Model B', kind: 'text', files: [validFile('b.gguf')] },
  ];

  const merged = mergeCatalogEntries(bundled, remote, mobileCatalogKey.models);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].name, 'Model A Updated');

  const diff = diffMergedCatalog(bundled, merged, mobileCatalogKey.models);
  assert.equal(diff.added.length, 1);
  assert.equal(diff.added[0].id, 'model-b');
  assert.equal(diff.changed.length, 1);
  assert.equal(diff.changed[0].id, 'model-a');
  assert.equal(diff.removed.length, 0);

  let stored = null;
  const cache = {
    read: async () => stored,
    write: async (val) => {
      stored = val;
    },
  };

  assert.equal(
    await loadCachedCatalog({ cache, parseSections: parseMobileCatalogSections }),
    null,
  );

  const refreshed = await refreshRemoteCatalog({
    url: MOBILE_CATALOG_URL,
    cache,
    parseSections: parseMobileCatalogSections,
    fetch: async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          schemaVersion: 1,
          updatedAt: '2026-11-25T00:00:00Z',
          sections: {
            models: remote,
            text: [],
            transcription: [],
            coreml: [],
            litert: [],
          },
        }),
    }),
  });

  assert.equal(refreshed.status, 'ok');
  assert.equal(refreshed.catalog?.sections.models?.length, 2);

  const cached = await loadCachedCatalog({ cache, parseSections: parseMobileCatalogSections });
  assert.ok(cached);
  assert.equal(cached.sections.models?.length, 2);
});

test('Slice 9 catalog store and type-only callers drop @offgrid/models imports', () => {
  const clearedFiles = [
    'src/utils/remoteCatalogCore.ts',
    'src/stores/modelCatalogStore.ts',
    'src/screens/ModelsScreen/index.tsx',
    'src/services/autoSetupPlan.ts',
    'src/services/coreMLModelBrowser.ts',
    'src/services/curatedLiteRTRegistry.ts',
    'src/services/llamaEngineSupport.ts',
    'src/services/modelDownloadService/types.ts',
    'src/utils/recommendedModels.ts',
    'src/stores/appStore.ts',
  ];

  for (const rel of clearedFiles) {
    const src = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    assert.doesNotMatch(src, /from\s+['"]@offgrid\/models(?:\/[^'"]*)?['"]/, `${rel} still imports @offgrid/models`);
  }
});
