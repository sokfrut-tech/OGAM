import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { collapseSplitGgufParts } from '../../src/utils/ggufSplitFiles.ts';
import {
  cleanModelName,
  extractQuantization,
  getModelFiles,
  getModelType,
  resolveHuggingFaceModel,
  searchHuggingFace,
} from '../../src/utils/huggingFaceCore.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('collapseSplitGgufParts merges shard entries into sorted parts with summed byte size', () => {
  const merged = collapseSplitGgufParts([
    { name: 'Big-Q4_K_M-00002-of-00003.gguf', size: 200 },
    { name: 'single-Q8_0.gguf', size: 500 },
    { name: 'Big-Q4_K_M-00001-of-00003.gguf', size: 100 },
    { name: 'Big-Q4_K_M-00003-of-00003.gguf', size: 300 },
  ]);

  assert.equal(merged.length, 2);
  assert.equal(merged[0].name, 'Big-Q4_K_M-00001-of-00003.gguf');
  assert.equal(merged[0].size, 600);
  assert.equal(merged[0].parts?.length, 3);
  assert.deepEqual(
    merged[0].parts?.map(p => p.name),
    [
      'Big-Q4_K_M-00001-of-00003.gguf',
      'Big-Q4_K_M-00002-of-00003.gguf',
      'Big-Q4_K_M-00003-of-00003.gguf',
    ],
  );
  assert.equal(merged[1].name, 'single-Q8_0.gguf');
  assert.equal(merged[1].parts, undefined);
});

test('extractQuantization, cleanModelName, and getModelType classify models reliably', () => {
  assert.equal(extractQuantization('Qwen3-4B-Q4_K_M.gguf'), 'Q4_K_M');
  assert.equal(extractQuantization('modelQ80.gguf'), 'Q8_0');
  assert.equal(extractQuantization('plain.gguf'), 'Unknown');

  assert.equal(cleanModelName('org/Qwen3-4B-Instruct-GGUF'), 'Qwen3 4B Instruct');
  assert.equal(cleanModelName('all-MiniLM-L12-v2.Q8_0.gguf'), 'all MiniLM L12 v2');

  assert.equal(getModelType('leejet/FLUX.2-klein-4B-GGUF'), 'image-gen');
  assert.equal(getModelType('ggerganov/whisper.cpp'), 'transcription');
  assert.equal(getModelType('BAAI/bge-small-en-v1.5-gguf'), 'embedding');
  assert.equal(getModelType('Qwen/Qwen2.5-Coder-7B-Instruct-GGUF'), 'code');
  assert.equal(getModelType('unsloth/gemma-4-E2B-it-GGUF'), 'vision');
  assert.equal(getModelType('someone/Demo-Chat-8B-GGUF'), 'text');
});

test('searchHuggingFace groups uploads by model family and leaves out speech/embedding repos for text', async () => {
  const results = await searchHuggingFace('gemma-4', {
    kind: 'text',
    fetchImpl: async () =>
      ({
        ok: true,
        status: 200,
        json: async () => [
          { id: 'someone/gemma-4-E2B-it-GGUF', author: 'someone', downloads: 999999, tags: ['gguf', 'image-text-to-text'] },
          { id: 'unsloth/gemma-4-E2B-it-GGUF', author: 'unsloth', downloads: 5000, tags: ['gguf', 'image-text-to-text'] },
          { id: 'ggerganov/whisper-large-v3', author: 'ggerganov', downloads: 10000, tags: ['automatic-speech-recognition'] },
          { id: 'someone/bge-small-embed-GGUF', author: 'someone', downloads: 10000, tags: ['feature-extraction'] },
        ],
      }),
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].id, 'unsloth/gemma-4-E2B-it-GGUF');
  assert.equal(results[0].readsImages, true);
  assert.equal(results[0].hasMtp, true);
  assert.equal(results[0].variants?.length, 1);
  assert.equal(results[0].variants?.[0].id, 'someone/gemma-4-E2B-it-GGUF');
});

test('getModelFiles filters companions and strictly pairs architecture-matching mmproj', async () => {
  const oid = 'a'.repeat(64);
  const files = await getModelFiles('unsloth/gemma-4-E2B-it-GGUF', {
    fetchImpl: async () =>
      ({
        ok: true,
        status: 200,
        json: async () => [
          { type: 'file', path: 'Q4_K_M/gemma-4-E2B-it-Q4_K_M.gguf', lfs: { size: 2_000_000, oid } },
          { type: 'file', path: 'MTP/mtp-gemma-4-E2B-it-Q8_0.gguf', lfs: { size: 97_000_000 } },
          { type: 'file', path: 'imatrix.gguf', lfs: { size: 100_000 } },
          { type: 'file', path: 'gemma-4-E4B-it-mmproj-F16.gguf', lfs: { size: 900_000 } },
          { type: 'file', path: 'gemma-4-E2B-it-mmproj-F16.gguf', lfs: { size: 800_000 } },
        ],
      }),
  });

  assert.equal(files.length, 1);
  assert.equal(files[0].fileName, 'gemma-4-E2B-it-Q4_K_M.gguf');
  assert.equal(files[0].sha256, oid);
  assert.equal(files[0].mmproj?.fileName, 'gemma-4-E2B-it-mmproj-F16.gguf');
  assert.match(files[0].downloadUrl, /\/resolve\/main\/Q4_K_M\/gemma-4-E2B-it-Q4_K_M\.gguf$/);
});

test('resolveHuggingFaceModel resolves whisper transcription weights from blobs metadata', async () => {
  const entry = await resolveHuggingFaceModel('ggerganov/whisper.cpp', {
    kind: 'transcription',
    fetchImpl: async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'ggerganov/whisper.cpp',
          sha: '1234567890abcdef1234567890abcdef12345678',
          siblings: [
            { rfilename: 'README.md', size: 100 },
            { rfilename: 'ggml-base.bin', lfs: { size: 147_000_000 } },
          ],
        }),
      }),
  });

  assert.ok(entry);
  assert.equal(entry.kind, 'transcription');
  assert.equal(entry.files[0].name, 'ggml-base.bin');
  assert.equal(entry.files[0].sizeBytes, 147_000_000);
});

test('searchHuggingFace reports Hugging Face HTTP error status cleanly', async () => {
  await assert.rejects(
    () =>
      searchHuggingFace('flux', {
        kind: 'image',
        fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }),
      }),
    /Hugging Face search failed: HTTP 500/,
  );
});

test('src/services/huggingface.ts has 0 imports from @offgrid/models', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'src/services/huggingface.ts'), 'utf8');
  assert.doesNotMatch(src, /from\s+['"]@offgrid\/models(?:\/[^'"]*)?['"]/);
});
