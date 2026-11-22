import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('voice interaction components are protected by BIND_VOICE_INTERACTION', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  assert.match(manifest, /name="ai\.offgridmobile\.voice\.JarvisVoiceInteractionService"[\s\S]*?permission="android\.permission\.BIND_VOICE_INTERACTION"/);
  assert.match(manifest, /name="ai\.offgridmobile\.voice\.JarvisVoiceInteractionSessionService"[\s\S]*?permission="android\.permission\.BIND_VOICE_INTERACTION"/);
  assert.match(manifest, /android:process=":jarvis_voice"/);
  assert.match(manifest, /android:name="android\.service\.voice\.VoiceInteractionService"/);
  assert.match(manifest, /android:name="android\.voice_interaction"/);
});

test('system assistant is enabled only from Android 12 (API 31)', () => {
  const base = read('android/app/src/main/res/values/bools.xml');
  const api31 = read('android/app/src/main/res/values-v31/bools.xml');
  assert.match(base, /jarvis_voice_interaction_enabled">false/);
  assert.match(api31, /jarvis_voice_interaction_enabled">true/);
});

test('the assistant session launches Chat through the documented URI without requesting screen context', () => {
  const session = read('android/app/src/main/java/ai/offgridmobile/voice/JarvisVoiceInteractionSession.kt');
  const metadata = read('android/app/src/main/res/xml/jarvis_voice_interaction.xml');
  assert.match(session, /offgrid:\/\/assistant\/voice\?startVoice=1/);
  assert.match(session, /startAssistantActivity\(launchIntent\)/);
  assert.match(session, /startVoiceActivity\(launchIntent\)/);
  assert.match(metadata, /android:supportsAssist="true"/);
  // The session does not request screen data. Comments may name the forbidden flags,
  // so check for actual show/showSession calls rather than searching raw source text.
  assert.doesNotMatch(session, /(?:showSession|\.show)\([^)]*SHOW_WITH_(?:ASSIST|SCREENSHOT)/);
  const service = read('android/app/src/main/java/ai/offgridmobile/voice/JarvisVoiceInteractionService.kt');
  assert.ok(service.includes('setDisabledShowContext('));
  assert.ok(service.includes('VoiceInteractionSession.SHOW_WITH_ASSIST'));
  assert.ok(service.includes('VoiceInteractionSession.SHOW_WITH_SCREENSHOT'));
  const app = read('App.tsx');
  assert.ok(app.includes('linking={jarvisVoiceLinking}'));
});

test('Android exposes an explicit RoleManager request and reports actual active-service state', () => {
  const module = read('android/app/src/main/java/ai/offgridmobile/voice/JarvisAssistantRoleModule.kt');
  const app = read('android/app/src/main/java/ai/offgridmobile/MainApplication.kt');
  const settings = read('src/screens/SettingsScreen.tsx');
  const wrapper = read('src/services/jarvisAssistantRole.ts');
  assert.ok(module.includes('RoleManager.ROLE_ASSISTANT'));
  assert.ok(module.includes('createRequestRoleIntent'));
  assert.ok(module.includes('VoiceInteractionService.isActiveService'));
  assert.ok(module.includes('startActivityForResult'));
  assert.ok(module.includes('pendingPromise'));
  assert.ok(app.includes('add(JarvisAssistantRolePackage())'));
  assert.ok(settings.includes('set-jarvis-system-assistant'));
  assert.ok(settings.includes('requestJarvisAssistantRole'));
  assert.ok(wrapper.includes('getStatus()'));
  assert.ok(wrapper.includes('requestAssistantRole()'));
});

test('system assistant invokes the shared recorder only when a voice backend exists', () => {
  const screen = read('src/screens/ChatScreen/index.tsx');
  const controller = read('src/services/recordingController.ts');
  const voice = read('src/components/ChatInput/Voice.ts');
  assert.match(screen, /route\.params\?\.startVoice/);
  assert.match(screen, /recordingController\.start\(\)/);
  assert.match(controller, /this\.handlers\.canStart && !this\.handlers\.canStart\(options\)/);
  assert.match(screen, /recordingController\.start\(\{ requiresTranscript: true \}\)/);
  assert.match(voice, /options\?\.requiresTranscript[\\s\\S]*?!!downloadedModelId \\|\\| remoteTranscriptionAvailable/);
  assert.match(voice, /canStart: \(\) => voiceAvailableRef\.current/);
  assert.match(screen, /result === 'unavailable' \|\| result === 'no-recorder'/);
  assert.match(screen, /Open speech models/);
  assert.match(screen, /initialTab: 'transcription'/);
});
