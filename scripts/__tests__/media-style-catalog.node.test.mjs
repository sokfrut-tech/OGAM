import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  IMAGE_STYLES,
  VIDEO_STYLES,
  mediaStyle,
} from '../../src/constants/mediaStyles.ts';

test('keeps all persisted image and video style IDs unique and non-empty', () => {
  for (const styles of [IMAGE_STYLES, VIDEO_STYLES]) {
    const ids = styles.map(style => style.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.every(id => id.trim().length > 0));
    assert.ok(styles.every(style => style.name.trim().length > 0 && style.words.trim().length > 0));
  }
});

test('preserves the image style IDs used by saved conversations and preview assets', () => {
  assert.deepEqual(
    IMAGE_STYLES.map(style => style.id),
    [
      'photoreal', 'cinematic', 'anime', 'sketch', 'watercolor', 'oil-painting',
      'monochrome', 'neon', '3d-render', 'steampunk', 'surreal', 'vintage-film',
      'minimal', 'risograph', 'fantasy-art', 'studio-portrait',
    ],
  );
});

test('preserves the video style IDs used by saved conversations and preview assets', () => {
  assert.deepEqual(
    VIDEO_STYLES.map(style => style.id),
    ['talking-head', 'cinematic', 'product', 'nature', 'animation', 'vintage'],
  );
});

test('resolves prompt words by media kind and style ID without changing the user prompt', () => {
  assert.equal(mediaStyle('image', 'watercolor')?.words,
    'Traditional watercolor painting, translucent pigment washes, soft edges and textured cold-press paper.');
  assert.equal(mediaStyle('video', 'talking-head')?.words,
    'A natural talking-head shot, stable framing, realistic facial motion and subtle gestures.');
  assert.equal(mediaStyle('image', 'talking-head'), undefined);
  assert.equal(mediaStyle('video', null), undefined);
});

test('every image and video style has its local preview asset', () => {
  for (const [kind, styles] of [['image', IMAGE_STYLES], ['video', VIDEO_STYLES]]) {
    for (const style of styles) {
      const asset = join(process.cwd(), 'src', 'assets', 'styles', kind, `${style.id}.jpg`);
      assert.equal(existsSync(asset), true, `Missing ${kind} preview for ${style.id}`);
    }
  }
});
