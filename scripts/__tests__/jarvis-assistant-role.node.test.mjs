import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');

test('system-assistant role UI is Android-only, refreshes on resume, and never silently claims activation', () => {
  const settings = read('src/screens/SettingsScreen.tsx');
  assert.match(settings, /Platform\.OS === 'android'/);
  assert.match(settings, /AppState\.addEventListener\('change'/);
  assert.match(settings, /requestJarvisAssistantRole\(\)/);
  assert.match(settings, /status\.ready/);
  assert.match(settings, /This Android\/ColorOS build does not currently expose/);
});

test('RoleManager request is guarded for Android 12+ and verifies both role and active service', () => {
  const source = read('android/app/src/main/java/ai/offgridmobile/voice/JarvisAssistantRoleModule.kt');
  assert.match(source, /Build\.VERSION\.SDK_INT < Build\.VERSION_CODES\.S/);
  assert.match(source, /createRequestRoleIntent\(ROLE_ASSISTANT\)/);
  assert.match(source, /isRoleHeld\(ROLE_ASSISTANT\)/);
  assert.match(source, /VoiceInteractionService\.isActiveService/);
  assert.match(source, /resultCode/);
  assert.match(source, /pendingPromise/);
});

