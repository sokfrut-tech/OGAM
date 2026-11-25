import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { COLORS_DARK, COLORS_LIGHT } from '../../src/theme/designTokens.ts';
import { IPHONE_MAPPED_FIT_BUDGET, PHONE_FIT_BUDGET } from '../../src/utils/modelFitBudget.ts';
import { pickModelsForDevice } from '../../src/utils/modelCatalogCore.ts';
import { guideTopicsFor, guideWhereLabel } from '../../src/utils/guideCore.ts';
import { boostPromoLink } from '../../src/utils/boostPromo.ts';
import { DocumentIngestService, textParts } from '../../src/utils/ragDocumentsCore.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('package.json and package-lock.json have zero @offgrid/* or ../shared dependencies and match 1:1', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package-lock.json'), 'utf8'));

  for (const [k, v] of Object.entries(lock.packages ?? {})) {
    assert.equal(k.includes('@offgrid'), false, `Unexpected @offgrid key in package-lock.json: ${k}`);
    assert.equal(k.includes('../shared'), false, `Unexpected ../shared key in package-lock.json: ${k}`);
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      const map = v?.[field] ?? {};
      for (const [dep, spec] of Object.entries(map)) {
        assert.equal(dep.includes('@offgrid'), false, `Unexpected ${dep} in ${k}.${field}`);
        assert.equal(String(spec).includes('../shared'), false, `Unexpected ../shared spec for ${dep} in ${k}.${field}`);
      }
    }
  }

  const lockRoot = lock.packages?.[''] ?? {};
  for (const sec of ['dependencies', 'devDependencies']) {
    const pkgMap = pkg[sec] ?? {};
    const lockMap = lockRoot[sec] ?? {};
    assert.deepEqual(
      Object.entries(lockMap).sort(),
      Object.entries(pkgMap).sort(),
      `package-lock.json root ${sec} must match package.json 1:1`,
    );
  }
});

test('build-android-apk.yml and setup-mobile allow standalone open-core builds without PRO_SUBMODULE_PAT', () => {
  const apkWorkflow = fs.readFileSync(
    path.join(REPO_ROOT, '.github/workflows/build-android-apk.yml'),
    'utf8',
  );
  assert.equal(apkWorkflow.includes('Require private workspace access'), false);
  assert.equal(/shared:\s*['"]false['"]/.test(apkWorkflow), true);

  const setupMobile = fs.readFileSync(
    path.join(REPO_ROOT, '.github/actions/setup-mobile/action.yml'),
    'utf8',
  );
  assert.match(setupMobile, /shared:[\s\S]*?default:\s*'false'/);
});

test('Slice 14 runtime contracts: selectedFill, fit budget + device picks, guide phone filter, boost pro_tab, textParts, ingest isRunning', async () => {
  assert.equal(typeof COLORS_LIGHT.selectedFill, 'string');
  assert.equal(typeof COLORS_DARK.selectedFill, 'string');
  assert.equal(PHONE_FIT_BUDGET.comfortable, 0.45);
  assert.equal(PHONE_FIT_BUDGET.ceil, 0.62);
  assert.equal(IPHONE_MAPPED_FIT_BUDGET.comfortable, 0.5);
  assert.equal(IPHONE_MAPPED_FIT_BUDGET.ceil, 0.7);
  assert.equal(
    pickModelsForDevice([{ id: 'm1', sizeBytes: 1e9 }], 4, PHONE_FIT_BUDGET).best,
    'm1',
  );

  assert.equal(guideWhereLabel('mobile', 'phone'), 'On this phone');
  assert.equal(
    guideTopicsFor('mobile').some(topic => topic.pro && topic.where === 'phone'),
    true,
  );
  assert.match(boostPromoLink('mobile', 'pro_tab'), /boost-pro_tab/);

  const pages = textParts('Hello world\n\nSecond paragraph.');
  assert.equal(pages.length, 1);
  assert.deepEqual(pages[0], {
    page: 1,
    label: 'Part 1',
    text: 'Hello world\n\nSecond paragraph.',
  });

  let releaseExtract;
  let markStarted;
  const started = new Promise(resolve => {
    markStarted = resolve;
  });
  const ingest = new DocumentIngestService({
    extract: {
      async extract() {
        markStarted();
        await new Promise(done => {
          releaseExtract = done;
        });
        return { pageCount: 1 };
      },
    },
    store: {
      async getDocument() { return null; },
      async putDocument() {},
      async updateDocument() {},
      async putPages() {},
      async readPages() { return []; },
      async clearChunks() {},
      async appendChunks() {},
      async readChunks() { return []; },
      async putVectors() {},
      async readVectors() { return new Map(); },
      async putMap() {},
      async readMap() { return null; },
      async deleteDocument() {},
      async listDocuments() { return []; },
    },
  });
  assert.equal(ingest.isRunning('doc-1'), false);
  const pending = ingest.ingest({ id: 'doc-1', name: 'note.txt', kind: 'text', text: 'hi' });
  assert.equal(ingest.isRunning('doc-1'), true);
  await started;
  assert.equal(ingest.isRunning('doc-1'), true);
  releaseExtract();
  await pending;
  assert.equal(ingest.isRunning('doc-1'), false);
});
