import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  GUIDE_FIRST_LOOK,
  GUIDE_FLOWS,
  GUIDE_KB_VECTOR_MODEL,
  GUIDE_LINKS,
  GUIDE_NOT_SUPPORTED,
  GUIDE_STARTERS,
  MOBILE_GUIDE_GROUPS,
  guideAnswerBlocks,
  guideAnswerLength,
  guideAnswerParts,
  guideAnswerReveal,
  guideFlowAnswer,
  guideFlowAnswerById,
  guideFlowLabels,
  guideGrounding,
  guideStarterAnswer,
  guideTopicsFor,
  guideTurnsToSend,
  guideTypingMs,
  guideWhereLabel,
} from '../../src/utils/guideCore.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SKIP = new Set(['node_modules', '__tests__', 'docs', 'e2e', 'build', 'Pods']);

function readAppTexts(dir, into) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const file = path.join(dir, name);
    if (fs.statSync(file).isDirectory()) readAppTexts(file, into);
    else if (/\.(tsx?|xml|plist)$/.test(name) && !/\.test\./.test(name)) {
      into.push(fs.readFileSync(file, 'utf8').replace(/&amp;/g, '&'));
    }
  }
}

test('Guide topics, links, starters, and progressive typing reveal preserve mobile contracts', () => {
  assert.equal(GUIDE_KB_VECTOR_MODEL, 'all-MiniLM-L6-v2');
  assert.ok(MOBILE_GUIDE_GROUPS.length >= 3);
  assert.ok(GUIDE_LINKS.desktop.startsWith('https://'));
  assert.ok(GUIDE_LINKS.extension.startsWith('https://'));
  assert.ok(GUIDE_FIRST_LOOK.mobile.length >= 3);
  assert.ok(GUIDE_STARTERS.mobile.includes('What does Pro add on my phone?'));

  const topics = guideTopicsFor('mobile');
  const vision = topics.find(t => t.id === 'phone-vision');
  assert.equal(vision?.label, 'Vision');
  assert.equal(guideWhereLabel('mobile', 'mobile'), 'On this phone');

  // Every topic returned by guideTopicsFor must have media mapped in guideTopics.ts.
  const guideTopicsSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/screens/GuideScreen/guideTopics.ts'), 'utf8');
  for (const t of topics) {
    assert.ok(
      guideTopicsSrc.includes(`'${t.id}'`) || guideTopicsSrc.includes(`${t.id}:`),
      `Missing MEDIA entry for topic ${t.id} in guideTopics.ts`,
    );
  }

  const starterAnswer = guideStarterAnswer('mobile', 'What does Pro add on my phone?', topics);
  assert.ok(starterAnswer && starterAnswer.length > 40);
  const blocks = guideAnswerBlocks(guideAnswerParts(starterAnswer, topics));
  const total = guideAnswerLength(blocks);
  assert.ok(total > 40);
  const typingMs = guideTypingMs(total);
  assert.ok(typingMs > 0 && typingMs <= 1000);

  // While typing is unfinished, no topic cards appear yet; at full length, topic cards appear.
  assert.equal(guideAnswerReveal(blocks, 0).some(b => b.kind === 'topics'), false);
  assert.equal(guideAnswerReveal(blocks, 5).some(b => b.kind === 'topics'), false);
  assert.equal(guideAnswerReveal(blocks, total).some(b => b.kind === 'topics'), true);

  const flowSteps = guideFlowAnswer('mobile', 'How do I check for new models?', topics, { platform: 'android' });
  assert.ok(flowSteps && flowSteps.includes('Check for new models'));
  assert.ok(guideFlowAnswerById('mobile', 'models-open', topics)?.includes('Models'));

  const grounding = guideGrounding('mobile', topics, [{ role: 'user', content: 'How does vision work?' }]);
  assert.ok(grounding.includes('phone-vision'));
  assert.equal(guideTurnsToSend([{ role: 'user', content: 'hi' }]).length, 1);
});

test('GUIDE_FLOWS and GUIDE_NOT_SUPPORTED cite existing files and real app UI labels (> 100 phone entries)', () => {
  const texts = [];
  for (const dir of ['src', 'android/app/src/main/res', 'ios/ImproveShare']) {
    readAppTexts(path.join(REPO_ROOT, dir), texts);
  }

  const sourceOf = src => src.replace(/^mobile\//, '').replace(/:\d+$/, '');
  const phone = [...GUIDE_FLOWS, ...GUIDE_NOT_SUPPORTED].filter(
    e => e.surface === 'mobile' || (e.surface === 'cross' && e.source.startsWith('mobile/')),
  );
  assert.ok(phone.length > 100, `Expected > 100 phone flows, got ${phone.length}`);

  for (const entry of phone) {
    const relPath = sourceOf(entry.source);
    assert.equal(fs.existsSync(path.join(REPO_ROOT, relPath)), true, `Missing source ${relPath} for ${entry.id}`);
    const labels = guideFlowLabels(entry);
    for (const label of labels) {
      assert.equal(
        texts.some(t => t.includes(label)),
        true,
        `Label "${label}" from flow ${entry.id} not found anywhere in src/`,
      );
    }
  }
});

test('Slice 10 Guide & cleared test files have 0 @offgrid/models imports', () => {
  const clearedFiles = [
    'src/utils/guideCore.ts',
    'src/screens/GuideScreen/guideTopics.ts',
    'src/screens/GuideScreen/GuideTopicScreen.tsx',
    'src/screens/GuideScreen/index.tsx',
    'src/screens/GuideScreen/useGuideAction.ts',
    'src/services/guideVector.ts',
    '__tests__/contracts/guideFlows.contract.test.ts',
    '__tests__/integration/image/imageStyles.rendered.test.tsx',
    '__tests__/pro/video/videoStyles.rendered.test.tsx',
    '__tests__/integration/memory/residencyMatrix.modes.test.ts',
  ];

  for (const rel of clearedFiles) {
    const src = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    assert.doesNotMatch(src, /from\s+['"]@offgrid\/models(?:\/[^'"]*)?['"]/, `${rel} still imports @offgrid/models`);
    assert.doesNotMatch(src, /require\(['"]@offgrid\/models['"]\)/, `${rel} still requires @offgrid/models`);
  }
});
