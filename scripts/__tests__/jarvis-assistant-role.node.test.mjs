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


test('native assistant status snapshot has platform and state-combination unit tests', () => {
  const snapshot = read('android/app/src/main/java/ai/offgridmobile/voice/JarvisAssistantRoleSnapshot.kt');
  const unit = read('android/app/src/test/java/ai/offgridmobile/voice/JarvisAssistantRoleSnapshotTest.kt');
  const module = read('android/app/src/main/java/ai/offgridmobile/voice/JarvisAssistantRoleModule.kt');
  assert.ok(snapshot.includes('androidApi >= 31'));
  assert.ok(snapshot.includes('roleHeld && activeService'));
  assert.ok(module.includes('JarvisAssistantRoleSnapshot.from('));
  assert.equal((unit.match(/@Test/g) ?? []).length, 5);
  assert.ok(unit.includes('grantedRoleIsNotTheSameAsAnActiveVoiceInteractionService'));
  assert.ok(unit.includes('onlyRoleHolderWithActiveServiceIsReady'));
});
