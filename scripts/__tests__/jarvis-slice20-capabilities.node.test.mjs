import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

function readRel(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

test('Android manifest and MainApplication wire SpeechRecognizer and PhoneActions cleanly', () => {
  const manifest = readRel('android/app/src/main/AndroidManifest.xml');
  assert.match(manifest, /android\.speech\.RecognitionService/);
  assert.match(manifest, /com\.android\.alarm\.permission\.SET_ALARM/);

  const mainApp = readRel('android/app/src/main/java/ai/offgridmobile/MainApplication.kt');
  assert.match(mainApp, /JarvisAndroidSttPackage/);
  assert.match(mainApp, /JarvisPhoneActionsPackage/);
});

test('Native Kotlin modules satisfy Slice 20 safety and lifecycle contracts', () => {
  const stt = readRel('android/app/src/main/java/ai/offgridmobile/voice/JarvisAndroidSttModule.kt');
  assert.match(stt, /SpeechRecognizer\.createSpeechRecognizer/);
  assert.match(stt, /putString\("state", "processing"\)/);
  assert.match(stt, /canRetryOnline/);

  const tts = readRel('android/app/src/main/java/ai/offgridmobile/voice/JarvisAndroidTtsModule.kt');
  assert.match(tts, /fun speakQueued/);
  assert.match(tts, /TextToSpeech\.QUEUE_ADD/);

  const actions = readRel('android/app/src/main/java/ai/offgridmobile/actions/JarvisPhoneActionsModule.kt');
  assert.match(actions, /AlarmClock\.EXTRA_SKIP_UI, false/);
  assert.match(actions, /scheme != "http" && scheme != "https"/);
  assert.match(actions, /setTorchMode/);
});

test('Standalone VoiceRecordButton defaults fallback Whisper model to multilingual base', () => {
  const voiceBtn = readRel('src/components/VoiceRecordButton/index.tsx');
  assert.match(voiceBtn, /const modelIdToDownload = isJarvisStandaloneRuntime \? 'base' : DOWNLOAD_MODEL_ID/);
});

test('activateJarvisOpenCapabilities registers all 16 open-source slots and PhoneActions extension', () => {
  const activate = readRel('src/bootstrap/activateJarvisOpenCapabilities.ts');
  const expectedSlots = [
    'SLOTS.messageSpeakButton',
    'SLOTS.chatInputModeToggle',
    'SLOTS.quickSettingsAudioRow',
    'SLOTS.chatEmptyAudio',
    'SLOTS.chatInputAudioMode',
    'SLOTS.messageAudioMode',
    'SLOTS.generationSettingsTts',
    'SLOTS.generationSettingsTtsSummary',
    'SLOTS.generationSettingsVideo',
    'SLOTS.modelsScreenVoiceTab',
    'SLOTS.modelsScreenVideoTab',
    'SLOTS.modelSelectorVideoTab',
    'SLOTS.videoStatus',
    'SLOTS.imageAnimateAction',
    'SLOTS.messageVideoActions',
    'SLOTS.galleryVideoSection',
  ];
  for (const slot of expectedSlots) {
    assert.ok(activate.includes(slot), `Missing ${slot} in activateJarvisOpenCapabilities.ts`);
  }
  assert.match(activate, /HOOKS\.audioOnStreamingToken/);
  assert.match(activate, /HOOKS\.audioAugmentPrompt/);
  assert.match(activate, /HOOKS\.audioOnAppBackground/);
  assert.match(activate, /registerJarvisPhoneActionsExtension/);
});
