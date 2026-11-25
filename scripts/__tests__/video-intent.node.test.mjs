import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { isVideoRequest } from '../../src/utils/videoIntent.ts';

test('isVideoRequest recognizes video creation prompts and rejects questions or mentions', () => {
  const positives = [
    'Create a video of a lighthouse at night.',
    'make a short clip of waves',
    'Can you generate a video showing a fox',
    'animate a paper boat drifting',
    'please render an animation of rain',
    'a video of a cat on a sofa',
  ];
  for (const ask of positives) {
    assert.equal(isVideoRequest(ask), true, `Expected true for: ${ask}`);
  }

  const negatives = [
    'How do I make a video?',
    'summarize this video',
    'what is a good video editor',
    'I made a video yesterday',
    'draw a lighthouse',
    'explain how animation works',
    '   ',
  ];
  for (const ask of negatives) {
    assert.equal(isVideoRequest(ask), false, `Expected false for: ${ask}`);
  }
});

test('intentClassifier.ts no longer imports @offgrid/models', () => {
  const content = fs.readFileSync('src/services/intentClassifier.ts', 'utf8');
  const legacyImport = new RegExp(`['"]${'@offgrid'}/models['"]`);
  assert.ok(content.includes('utils/videoIntent'));
  assert.equal(legacyImport.test(content), false);
});
