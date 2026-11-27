import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const readRel = relPath => fs.readFileSync(path.join(ROOT, relPath), 'utf8');

test('Android STT module prefers Google recognition service and requests explicit language extras', () => {
  const sttKt = readRel('android/app/src/main/java/ai/offgridmobile/voice/JarvisAndroidSttModule.kt');
  assert.match(sttKt, /com\.google\.android\.tts/);
  assert.match(sttKt, /RecognizerIntent\.EXTRA_CALLING_PACKAGE/);
  assert.match(sttKt, /RecognizerIntent\.EXTRA_LANGUAGE_PREFERENCE/);
  assert.match(sttKt, /RecognizerIntent\.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE/);
  assert.match(sttKt, /RecognizerIntent\.EXTRA_MAX_RESULTS,\s*3/);
  assert.match(sttKt, /pickBestMatch/);
  assert.match(sttKt, /fun getEngineInfo/);
});

test('JS STT service avoids forced EN offline packs and blocks wrong-language results for ru-RU', () => {
  const sttSvc = readRel('src/services/jarvisPro/jarvisSttService.ts');
  assert.match(sttSvc, /opts\.preferOffline \?\? false/);
  assert.match(sttSvc, /export function isLikelyWrongLanguageForRussian/);
  assert.match(sttSvc, /Whisper Small \(RU\)/);

  const voiceBtn = readRel('src/components/VoiceRecordButton/index.tsx');
  assert.match(voiceBtn, /isJarvisStandaloneRuntime \? 'small' : DOWNLOAD_MODEL_ID/);
});

test('Whisper store migrates persisted English default to Russian once under standalone runtime', () => {
  const store = readRel('src/stores/whisperStore.ts');
  assert.match(store, /ruDefaultMigrated/);
  assert.match(store, /isJarvisStandaloneRuntime &&/);
  assert.match(store, /saved\.transcriptionLanguage === 'en'/);

  const whisperSvc = readRel('src/services/whisperService.ts');
  assert.match(whisperSvc, /isJarvisStandaloneRuntime \? 'ru' : 'en'/);
});

test('ChatMessageArea uses generationService diagnostics abstraction without direct services/llm import', () => {
  const area = readRel('src/screens/ChatScreen/ChatMessageArea.tsx');
  assert.match(area, /subscribeNativeGenerationDiagnostics/);
  assert.doesNotMatch(area, /from ['"][^'"]*\/services\/llm['"]/);
  assert.ok(fs.existsSync(path.join(ROOT, 'docs/jarvis/NATIVE_GENERATION_WATCHDOG.md')));
});
