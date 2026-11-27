import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  transcriptionEngineOf,
  isTranscriptionEngineAvailableOn,
} from '../../src/utils/transcriptionEnginePolicy.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('transcriptionEngineOf detects qwen3-asr, whisper, and non-transcription models', () => {
  assert.equal(
    transcriptionEngineOf({ id: 'qwen3-asr-0.6b', kind: 'transcription', engine: 'qwen3-asr' }),
    'qwen3-asr',
  );
  assert.equal(
    transcriptionEngineOf({ id: 'whisper-base-en', kind: 'transcription' }),
    'whisper',
  );
  assert.equal(
    transcriptionEngineOf({ id: 'gemma-4-e2b-it', kind: 'text' }),
    undefined,
  );
});

test('isTranscriptionEngineAvailableOn guards platform support per engine', () => {
  assert.equal(isTranscriptionEngineAvailableOn('whisper', 'android'), true);
  assert.equal(isTranscriptionEngineAvailableOn('whisper', 'ios'), true);
  assert.equal(typeof isTranscriptionEngineAvailableOn('qwen3-asr', 'android'), 'boolean');
  assert.equal(typeof isTranscriptionEngineAvailableOn('qwen3-asr', 'ios'), 'boolean');
});

test('Slice 9 transcription modules drop @offgrid/models helper imports', () => {
  for (const rel of [
    'src/utils/transcriptionEnginePolicy.ts',
    'src/screens/ModelsScreen/TranscriptionModelsTab.tsx',
    'src/services/whisperModels.ts',
    'src/services/whisperModelDownloads.ts',
  ]) {
    const src = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    assert.doesNotMatch(src, /from\s+['"]@offgrid\/models(?:\/[^'"]*)?['"]/, `${rel} still imports @offgrid/models`);
  }

  const qwenSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/services/qwenAsrModel.ts'), 'utf8');
  assert.doesNotMatch(
    qwenSrc,
    /isTranscriptionEngineAvailableOn[^;]*from\s+['"]@offgrid\/models['"]/,
  );
});
