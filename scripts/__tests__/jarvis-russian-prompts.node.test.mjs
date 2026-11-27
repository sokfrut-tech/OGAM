import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  hasCyrillic,
  prepareMediaPromptForEngine,
  stripRussianMediaCommand,
  translateRussianVisualPromptFallback,
} from '../../src/services/jarvisPro/russianPromptBridge.ts';
import { isVideoRequest } from '../../src/utils/videoIntent.ts';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

test('russianPromptBridge strips command prefixes and translates Russian visual prompts to English', () => {
  assert.equal(hasCyrillic('привет'), true);
  assert.equal(hasCyrillic('neon cyberpunk cat'), false);

  assert.equal(
    stripRussianMediaCommand('Нарисуй пожалуйста красивую картинку с котом в стиле киберпанк'),
    'котом в стиле киберпанк',
  );

  const catPrompt = translateRussianVisualPromptFallback(
    'Нарисуй кота в стиле киберпанк, ночной город, 8к',
  );
  assert.equal(hasCyrillic(catPrompt), false);
  assert.match(catPrompt, /cat/i);
  assert.match(catPrompt, /cyberpunk style/i);
  assert.match(catPrompt, /night city/i);
  assert.match(catPrompt, /8k/i);

  const seaPrompt = prepareMediaPromptForEngine('Сделай фото заката над морем');
  assert.equal(hasCyrillic(seaPrompt), false);
  assert.match(seaPrompt, /sunset over the sea/i);

  assert.equal(
    prepareMediaPromptForEngine('Нарисуй лису в лесу', 'fox in a misty forest'),
    'fox in a misty forest',
  );

  const fallbackOnCyrillicLlm = prepareMediaPromptForEngine(
    'Нарисуй лису в лесу',
    'нарисуй лису в лесу',
  );
  assert.equal(hasCyrillic(fallbackOnCyrillicLlm), false);
  assert.match(fallbackOnCyrillicLlm, /fox/i);
  assert.match(fallbackOnCyrillicLlm, /forest/i);
});

test('isVideoRequest recognizes Russian and English video requests while rejecting questions', () => {
  const positives = [
    'Сделай видео заката над морем',
    'Сгенерируй короткий ролик про волков в лесу',
    'Оживи фото космонавта',
    'Create a video of a lighthouse at night.',
  ];
  for (const prompt of positives) {
    assert.equal(isVideoRequest(prompt), true, `Expected true for: ${prompt}`);
  }

  const negatives = [
    'Как сделать видео из фото?',
    'Что такое видеогенерация и зачем она нужна?',
    'Нарисуй картинку кота в горах',
    'How do I make a video?',
    'explain how animation works',
  ];
  for (const prompt of negatives) {
    assert.equal(isVideoRequest(prompt), false, `Expected false for: ${prompt}`);
  }
});

test('standalone promo/upsell/rate guards and Russian classifier contracts remain wired', () => {
  const guardedComponents = [
    'src/components/SharePromptSheet.tsx',
    'src/utils/sharePrompt.ts',
    'src/services/proPrompt.ts',
    'src/components/MadeWithLove.tsx',
    'src/components/models/VideoUpsell.tsx',
    'src/components/models/VoiceModelsUpsell.tsx',
    'src/screens/SettingsCommunitySections.tsx',
    'src/screens/AboutScreen.tsx',
    'src/screens/HomeScreen/index.tsx',
    'src/components/ChatInput/index.tsx',
  ];
  for (const rel of guardedComponents) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(
      src.includes('isJarvisStandaloneRuntime'),
      `${rel} must gate standalone Jarvis Ai behavior on isJarvisStandaloneRuntime`,
    );
  }

  const shareSheetSrc = fs.readFileSync(path.join(ROOT, 'src/components/SharePromptSheet.tsx'), 'utf8');
  assert.match(shareSheetSrc, /if \(isJarvisStandaloneRuntime\)\s*\{\s*return null;/);

  const proPromptSrc = fs.readFileSync(path.join(ROOT, 'src/services/proPrompt.ts'), 'utf8');
  assert.match(proPromptSrc, /checkProPromptForText[\s\S]*if \(isJarvisStandaloneRuntime\) return;/);
  assert.match(proPromptSrc, /checkProPromptForImage[\s\S]*if \(isJarvisStandaloneRuntime\) return;/);

  const imageGenSrc = fs.readFileSync(path.join(ROOT, 'src/screens/ImageGenScreen.tsx'), 'utf8');
  assert.ok(imageGenSrc.includes('image-gen-download-model'));
  assert.ok(imageGenSrc.includes('hasCyrillic'));

  const storeSrc = fs.readFileSync(path.join(ROOT, 'src/stores/appStore.ts'), 'utf8');
  assert.ok(storeSrc.includes("modelLoadingMode: isJarvisStandaloneRuntime ? 'aggressive' : 'balanced'"));
  assert.ok(storeSrc.includes('aggressiveModelLoading: isJarvisStandaloneRuntime'));

  const classifierSrc = fs.readFileSync(path.join(ROOT, 'src/services/intentClassifier.ts'), 'utf8');
  assert.ok(classifierSrc.includes('RUSSIAN_IMAGE_PATTERNS'));
  assert.ok(classifierSrc.includes('RUSSIAN_NON_IMAGE_QUESTION_RE'));
});
