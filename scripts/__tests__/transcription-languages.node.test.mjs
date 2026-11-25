import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  isEnglishOnlyWhisperModel,
  transcriptionLanguages,
} from '../../src/utils/transcriptionLanguages.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

test('Qwen3-ASR catalog exposes auto plus all 30 named languages needed by prompt prefill', () => {
  const list = transcriptionLanguages('qwen3-asr', 'qwen3-asr-0.6b-q8');
  assert.equal(list.length, 31);
  assert.deepEqual(list[0], { code: 'auto', label: 'Auto-detect' });

  const byCode = new Map(list.map((entry) => [entry.code, entry.label]));
  assert.equal(byCode.size, list.length, 'Qwen3-ASR language codes must be unique');
  assert.equal(byCode.get('yue'), 'Cantonese');
  assert.equal(byCode.get('fil'), 'Filipino');
  assert.equal(byCode.get('ru'), 'Russian');
  assert.equal(byCode.get('en'), 'English');

  for (const { code, label } of list) {
    assert.ok(code.length > 0 && label.length > 0);
    if (code !== 'auto') {
      assert.ok(!/\s/.test(label), `Qwen3-ASR prefill expects single-word language name, got "${label}"`);
    }
  }
});

test('English-only Whisper checkpoints return only English', () => {
  for (const modelId of ['tiny.en', 'base.en', 'small.en', 'medium.en', 'whisper-small.en', 'ggml-base.en.bin']) {
    assert.equal(isEnglishOnlyWhisperModel(modelId), true, modelId);
    assert.deepEqual(transcriptionLanguages('whisper', modelId), [{ code: 'en', label: 'English' }]);
  }
});

test('Multilingual Whisper catalog includes auto, en, ru, fr, hi and excludes Qwen3-ASR-only codes', () => {
  for (const modelId of ['tiny', 'base', 'small', 'large-v3-turbo', 'open-whisper', null, undefined]) {
    assert.equal(isEnglishOnlyWhisperModel(modelId), false, String(modelId));
    const list = transcriptionLanguages('whisper', modelId);
    const byCode = new Map(list.map((entry) => [entry.code, entry.label]));

    assert.equal(byCode.size, list.length, 'Whisper language codes must be unique');
    assert.equal(byCode.get('auto'), 'Auto-detect');
    assert.equal(byCode.get('en'), 'English');
    assert.equal(byCode.get('ru'), 'Russian');
    assert.equal(byCode.get('fr'), 'French');
    assert.equal(byCode.get('hi'), 'Hindi');
    assert.equal(byCode.has('fil'), false, 'fil is Qwen3-ASR-only in UI tests');
    assert.equal(byCode.has('yue'), false, 'yue is Qwen3-ASR-only in UI tests');
  }
});

test('TranscriptionLanguageSelect and QwenAsrEngine no longer import @offgrid/speech', () => {
  const picker = fs.readFileSync(path.join(REPO_ROOT, 'src/components/TranscriptionLanguageSelect.tsx'), 'utf8');
  const engine = fs.readFileSync(path.join(REPO_ROOT, 'src/services/qwenAsrEngine.ts'), 'utf8');

  assert.equal(picker.includes('@offgrid/speech'), false);
  assert.equal(engine.includes('@offgrid/speech'), false);
  assert.match(picker, /from ['"]\.\.\/utils\/transcriptionLanguages['"]/);
  assert.match(engine, /from ['"]\.\.\/utils\/transcriptionLanguages['"]/);
});
