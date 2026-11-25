import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  VIDEO_SETTING_KEYS,
  acceptsVideoSetting,
  videoArchitecture,
  videoTakesStartImage,
  videoModelDefaults,
  videoPackError,
  isVideoWeightAvailableOn,
} from '../../src/utils/videoPackPolicy.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('VIDEO_SETTING_KEYS and acceptsVideoSetting validate syncable video settings', () => {
  assert.deepEqual(VIDEO_SETTING_KEYS, [
    'videoParams',
    'videoSeed',
    'videoNegative',
    'enhanceVideoPrompts',
  ]);

  assert.equal(acceptsVideoSetting('videoSeed', 42), true);
  assert.equal(acceptsVideoSetting('videoNegative', 'blurry'), true);
  assert.equal(acceptsVideoSetting('enhanceVideoPrompts', true), true);
  assert.equal(
    acceptsVideoSetting('videoParams', {
      'wan2.1-t2v-1.3b': { width: 480, height: 832, steps: 20, fps: 16 },
    }),
    true,
  );

  assert.equal(acceptsVideoSetting('videoParams', { 'wan2.1': { width: -1 } }), false);
  assert.equal(acceptsVideoSetting('videoSeed', 'not-a-number'), false);
  assert.equal(acceptsVideoSetting('enhanceVideoPrompts', 'yes'), false);
  assert.equal(acceptsVideoSetting('unknownKey', 1), false);
});

test('video architecture, start-image support, defaults, and availability follow Wan pack policy', () => {
  const wan21 = 'Wan2.1-T2V-1.3B-Q4_K_M.gguf';
  const wan22 = 'Wan2.2-TI2V-5B-Turbo-Q4_K_M.gguf';

  assert.equal(videoArchitecture(wan21), 'wan21');
  assert.equal(videoArchitecture(wan22), 'wan22');
  assert.equal(videoTakesStartImage(wan21), false);
  assert.equal(videoTakesStartImage(wan22), true);

  const defaults21 = videoModelDefaults(wan21);
  const defaults22 = videoModelDefaults(wan22);
  assert.equal(defaults21.width, 832);
  assert.equal(defaults21.height, 480);
  assert.equal(defaults22.width, 1280);
  assert.equal(defaults22.height, 704);
  assert.equal(defaults22.steps, 4);

  assert.equal(isVideoWeightAvailableOn(wan21, 'android'), true);
  assert.equal(isVideoWeightAvailableOn('wan21-ios.safetensors', 'android'), false);
  assert.equal(isVideoWeightAvailableOn(wan22, 'ios'), true);
});

test('videoPackError reports problems on incomplete pack and clears when required files exist', () => {
  assert.ok(videoPackError([]));
  assert.equal(
    videoPackError([
      {
        name: 'wan21-t2v-1.3b.gguf',
        url: 'https://example.com/wan21.gguf',
        sizeBytes: 1024,
        role: 'primary',
      },
    ]),
    null,
  );
});

test('Slice 9 video policy callers drop @offgrid/models video helper imports', () => {
  for (const rel of [
    'src/utils/videoPackPolicy.ts',
    'src/services/sync/mutation.ts',
    'src/services/videoModelFiles.ts',
  ]) {
    const src = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    assert.doesNotMatch(src, /from\s+['"]@offgrid\/models(?:\/[^'"]*)?['"]/, `${rel} still imports @offgrid/models`);
  }

  const packsSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/services/phoneVideoPacks.ts'), 'utf8');
  assert.doesNotMatch(
    packsSrc,
    /(videoArchitecture|videoTakesStartImage|videoModelDefaults|videoPackError|isVideoWeightAvailableOn)[^;]*from\s+['"]@offgrid\/models['"]/,
  );
});
