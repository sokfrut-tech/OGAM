import assert from 'node:assert/strict';
import test from 'node:test';
import { scanFileContent } from '../audit-offgrid-imports.mjs';

test('finds scoped package imports and package subpaths with exact line numbers', () => {
  const source = [
    "import { CATALOG } from '@offgrid/models';",
    "import type { SyncEngine } from '@offgrid/sync/portable';",
    "const speech = require('@offgrid/speech');",
  ].join('\n');
  const hits = scanFileContent('src/example.ts', source);
  assert.deepEqual(hits.map(hit => [hit.package, hit.specifier, hit.line]), [
    ['@offgrid/models', '@offgrid/models', 1],
    ['@offgrid/sync', '@offgrid/sync/portable', 2],
    ['@offgrid/speech', '@offgrid/speech', 3],
  ]);
});

test('finds workspace paths and private Pro checkout gates', () => {
  const source = [
    '"@offgrid/models": "file:../shared/packages/models",',
    "const shared = path.resolve(__dirname, '../shared');",
    'url: https://github.com/off-grid-ai/mobile-pro.git',
    'if (!process.env.PRO_SUBMODULE_PAT) throw new Error("missing token");',
  ].join('\n');
  const hits = scanFileContent('package.json', source);
  assert.equal(hits.filter(hit => hit.kind === 'shared-workspace-path').length, 2);
  assert.equal(hits.filter(hit => hit.kind === 'pro-or-private-checkout-reference').length, 2);
});

test('does not report unrelated third-party imports as Off Grid package dependencies', () => {
  const hits = scanFileContent('src/example.ts', "import React from 'react';\nimport llama from 'llama.rn';");
  assert.equal(hits.length, 0);
});
