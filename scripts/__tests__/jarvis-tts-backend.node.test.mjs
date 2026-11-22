import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('TTS backend owns inference only and leaves playback to the Jarvis PCM player', () => {
  const backend = read('android/app/src/main/java/ai/offgridmobile/voice/JarvisTtsBackend.kt');
  const player = read('android/app/src/main/java/ai/offgridmobile/voice/JarvisPcmStreamPlayer.kt');

  assert.match(backend, /internal interface JarvisTtsBackend : AutoCloseable/);
  assert.match(backend, /fun load\(modelDirectory: File\)/);
  assert.match(backend, /fun synthesize\([\s\S]*?onPcmChunk: \(samples: FloatArray, sampleRateHz: Int\) -> Boolean/);
  assert.match(backend, /fun cancel\(requestId: Long\)/);
  assert.match(backend, /override fun close\(\) = unload\(\)/);
  assert.doesNotMatch(backend, /^import .*AudioTrack|^import .*AudioManager|RECORD_AUDIO|startListening\(/m);
  assert.match(player, /private var generation = 0L/);
  assert.match(player, /fun write\(generationToken: Long/);
  assert.match(player, /fun cancel\(generationToken: Long\? = null\)/);
});

test('backend capabilities distinguish batch, sentence-chunked and model-streaming output', () => {
  const backend = read('android/app/src/main/java/ai/offgridmobile/voice/JarvisTtsBackend.kt');

  for (const mode of ['BATCH', 'SENTENCE_CHUNKED', 'MODEL_STREAMING']) {
    assert.ok(backend.includes(mode), `Missing output mode: ${mode}`);
  }
  assert.match(backend, /supportsNativeCancellation: Boolean/);
  assert.match(backend, /supportsVoiceCloning: Boolean/);
  assert.match(backend, /supportsInstructionControl: Boolean/);
  assert.match(backend, /supportsLanguageHint: Boolean/);
  assert.match(backend, /supportedLanguageTags: Set<String>/);
});

test('incremental speech chunker handles punctuation, abbreviations, decimals, flush and reset', () => {
  const chunker = read('android/app/src/main/java/ai/offgridmobile/voice/JarvisSpeechChunker.kt');
  const tests = read('android/app/src/test/java/ai/offgridmobile/voice/JarvisSpeechChunkerTest.kt');

  assert.match(chunker, /fun append\(fragment: String\): List<String>/);
  assert.match(chunker, /fun flush\(\): List<String>/);
  assert.match(chunker, /fun reset\(\)/);
  assert.match(chunker, /isNonTerminalPeriod\(index\)/);
  assert.match(chunker, /isSpacedRussianAbbreviationPeriod\(index\)/);
  assert.match(chunker, /CLOSING_QUOTES_AND_BRACKETS/);
  assert.match(chunker, /pending\[index - 1\]\.isDigit\(\) && pending\[index \+ 1\]\.isDigit\(\)/);
  for (const abbreviation of ['"г"', '"т.д"', '"ул"', '"dr"', '"e.g"']) {
    assert.ok(chunker.includes(abbreviation), `Missing abbreviation guard: ${abbreviation}`);
  }
  for (const scenario of ['Встретимся в г.', '21.5', 'А. С. Пушкин', 'keepsSpacedRussianAbbreviationsInsideTheSameSentence', 'closesQuotedSentenceBeforeStartingTheNextSentence', 'flushEmitsAnUnterminatedFinalFragment', 'resetDiscardsStaleText']) {
    assert.ok(tests.includes(scenario), `Missing chunker regression test: ${scenario}`);
  }
});

test('Supertonic callback-stop patch honors the documented native cancellation contract', () => {
  const patch = read('patches/sherpa-onnx/v2.0.3-supertonic-callback-stop.patch');
  assert.match(patch, /callback\([\s\S]*?progress\) == 0/);
  assert.match(patch, /break;/);
  assert.match(patch, /GeneratedAudioCallback contract: 0 stops generation, 1 continues/);
});
