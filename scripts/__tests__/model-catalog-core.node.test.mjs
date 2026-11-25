import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CATALOG, pickModelsForDevice } from '../../src/utils/modelCatalogCore.ts';
import { templateStoryboard, videoModelInfo } from '../../src/utils/videoPackPolicy.ts';
import { buildReport } from '../audit-offgrid-imports.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('CATALOG preserves required chat, vision, ASR, image (incl. catalog/models.json), and Wan video entries', () => {
  const byId = new Map(CATALOG.map(entry => [entry.id, entry]));

  // Required chat & vision models referenced across integration tests
  for (const id of [
    'openbmb/MiniCPM5-2B-GGUF',
    'unsloth/Qwen3.5-4B-GGUF',
    'LiquidAI/LFM2.5-8B-A1B-GGUF',
    'unsloth/Qwen3.5-9B-GGUF',
    'unsloth/gemma-4-E4B-it-GGUF',
    'unsloth/gemma-4-E2B-it-GGUF',
    'unsloth/Qwen3.5-2B-GGUF',
    'unsloth/Qwen3.5-0.8B-GGUF',
    'ggml-org/SmolLM3-3B-GGUF',
    'IFM/K2-Horizon-3.7B-GGUF',
    'IFM/K2-Horizon-7B-GGUF',
    'Qwen/Qwen3-VL-2B-Instruct-GGUF',
  ]) {
    assert.ok(byId.has(id), `Missing chat/vision model ${id}`);
  }

  assert.ok(byId.get('Qwen/Qwen3-VL-2B-Instruct-GGUF')?.supersededBy);
  assert.ok((byId.get('IFM/K2-Horizon-3.7B-GGUF')?.minLlamaBuild ?? 0) >= 12000);
  assert.ok((byId.get('IFM/K2-Horizon-7B-GGUF')?.minLlamaBuild ?? 0) >= 12000);

  // Qwen3-ASR 0.6B with verified weights + projector
  const asr = byId.get('ggml-org/Qwen3-ASR-0.6B-GGUF');
  assert.equal(asr?.kind, 'transcription');
  assert.equal(asr?.engine, 'qwen3-asr');
  assert.equal(asr?.minRamGb, 3);
  assert.ok(asr?.files.some(f => f.role === 'primary' && f.sha256));
  assert.ok(asr?.files.some(f => f.role === 'mmproj' && f.sha256));

  // Video packs including Comfy-Org (no published per-file sha256) and Turbo (24 GB minRamGb)
  const comfy = byId.get('Comfy-Org/Wan_2.1_ComfyUI_repackaged');
  assert.equal(comfy?.kind, 'video');
  assert.equal(comfy?.files.length, 3);
  assert.equal(comfy?.files.every(f => f.sha256 === undefined), true);

  const turbo = byId.get('hum-ma/Wan2.2-TI2V-5B-Turbo-GGUF');
  assert.equal(turbo?.name, 'Wan 2.2 (5B), Turbo');
  assert.equal(turbo?.minRamGb, 24);

  // Every image/video entry from catalog/models.json is synced in CATALOG
  const rawJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'catalog/models.json'), 'utf8'));
  for (const model of rawJson.sections.models) {
    assert.ok(byId.has(model.id), `Missing catalog/models.json model ${model.id} in CATALOG`);
  }
  assert.ok(byId.has('leejet/Qwen-Image-2.1-GGUF'));
});

test('pickModelsForDevice computes deterministic Fast, Balanced, and Best picks per RAM budget', () => {
  const budget = { soft: 0.52, hard: 0.62 };
  const candidates = CATALOG.filter(
    e => (e.kind === 'text' || e.kind === 'vision') && !e.grounder && !e.quantOf,
  ).map(entry => ({
    id: entry.id,
    sizeBytes: entry.files
      .filter(f => f.role !== 'aux')
      .reduce((sum, f) => sum + (f.sizeBytes ?? 0), 0),
    params: entry.params,
    org: entry.org,
    quality: entry.quality,
    activeParams: entry.activeParams,
    supersededBy: entry.supersededBy,
    nonCommercial: entry.nonCommercial,
    minLlamaBuild: entry.minLlamaBuild,
  }));

  const picks12 = pickModelsForDevice(candidates, 12, budget, 'runsWell', 11000);
  assert.deepEqual(picks12, {
    fast: 'LiquidAI/LFM2.5-8B-A1B-GGUF',
    balanced: 'unsloth/Qwen3.5-4B-GGUF',
    best: 'openbmb/MiniCPM5-2B-GGUF',
  });

  const picks4 = pickModelsForDevice(candidates, 4, budget, 'runsWell', 11000);
  assert.deepEqual(picks4, {
    fast: 'unsloth/Qwen3.5-0.8B-GGUF',
    balanced: 'unsloth/Qwen3.5-2B-GGUF',
    best: 'openbmb/MiniCPM5-2B-GGUF',
  });

  const speechCandidates = [
    { id: 'tiny', sizeBytes: 75e6 },
    { id: 'base', sizeBytes: 147e6 },
    { id: 'small', sizeBytes: 488e6 },
    { id: 'medium', sizeBytes: 1.5e9 },
    { id: 'large-v3', sizeBytes: 3.1e9 },
  ];
  assert.deepEqual(pickModelsForDevice(speechCandidates, 12, budget, 'runsWell', 0), {
    fast: 'tiny',
    balanced: 'small',
    best: 'large-v3',
  });
});

test('templateStoryboard and videoModelInfo generate valid Desktop harness structures', () => {
  const sb = templateStoryboard('A fox jumps over a quiet snowy brook.');
  assert.ok(sb.title.length > 0);
  assert.equal(sb.shots.length, 3);
  assert.ok(sb.shots.every(s => s.durationSeconds > 0 && s.prompt.length > 0));

  const wan21 = videoModelInfo('wan2.1-1.3b');
  assert.equal(wan21.width, 832);
  assert.equal(wan21.fps, 16);
  const wan22 = videoModelInfo('wan2.2-ti2v-5b');
  assert.deepEqual(wan22.supported_frame_images, ['first_frame']);
});

test('Repository has 0 @offgrid/models imports in src/ and build-config (outside scanner test fixture)', () => {
  const report = buildReport(REPO_ROOT);
  assert.equal(report.packageImportCountsByScope.source['@offgrid/models'], 0);
  assert.equal(report.packageImportCountsByScope['build-config']['@offgrid/models'], 0);
  assert.equal(
    report.localFileDependencies.some(dep => dep.name === '@offgrid/models'),
    false,
  );

  const pkg = fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8');
  assert.doesNotMatch(pkg, /@offgrid\/models/);
  const metro = fs.readFileSync(path.join(REPO_ROOT, 'metro.config.js'), 'utf8');
  assert.doesNotMatch(metro, /@offgrid\/models|modelsPackagePath/);
});
