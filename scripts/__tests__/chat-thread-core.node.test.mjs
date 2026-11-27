import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  CHAT_THREAD_ROOT,
  appendPlace,
  chatThread,
  neighbourVersion,
  parentOfVersion,
} from '../../src/utils/chatThreadCore.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

const row = (uuid, content, opts = {}) => ({
  uuid,
  message: { uuid, content },
  ...(opts.parent !== undefined ? { parent: opts.parent } : {}),
  ...(opts.selectedAt !== undefined ? { selectedAt: opts.selectedAt } : {}),
});

test('linear conversation without parent keeps order and appendPlace returns {}', () => {
  const rows = [
    row('u1', 'tell me a fact'),
    row('a1', 'Honey never spoils.'),
    row('u2', 'another one'),
    row('a2', 'Bananas are berries.'),
  ];

  const thread = chatThread(rows);
  assert.deepEqual(
    thread.messages.map((m) => m.uuid),
    ['u1', 'a1', 'u2', 'a2'],
  );
  assert.equal(thread.versions.size, 0);
  assert.deepEqual(appendPlace(rows), {});
});

test('retrying an answer creates version 2/2, hides later branch turns, and Stepping back restores original turn', () => {
  const initial = [
    row('u1', 'tell me a fact'),
    row('a1', 'Honey never spoils.'),
    row('u2', 'another one'),
    row('a2', 'Bananas are berries.'),
  ];

  const retryParent = parentOfVersion(initial, 'a1');
  assert.equal(retryParent, 'u1');

  const withRetry = [
    ...initial,
    row('a1b', 'Octopuses have three hearts.', { parent: retryParent, selectedAt: 200 }),
  ];

  const retriedThread = chatThread(withRetry);
  assert.deepEqual(
    retriedThread.messages.map((m) => m.uuid),
    ['u1', 'a1b'],
  );
  assert.deepEqual(retriedThread.versions.get('a1b'), { index: 1, count: 2 });
  assert.equal(neighbourVersion(withRetry, 'a1b', -1), 'a1');
  assert.equal(neighbourVersion(withRetry, 'a1b', 1), undefined);

  // Switching back to original a1 brings back u2 -> a2
  const selectedOriginal = withRetry.map((entry) =>
    entry.uuid === 'a1' ? { ...entry, selectedAt: 300 } : entry,
  );
  const restored = chatThread(selectedOriginal);
  assert.deepEqual(
    restored.messages.map((m) => m.uuid),
    ['u1', 'a1', 'u2', 'a2'],
  );
  assert.deepEqual(restored.versions.get('a1'), { index: 0, count: 2 });
});

test('editing a root question uses truthy root sentinel and supports nested answer resend versions', () => {
  const initial = [
    row('u1', 'tell me a fact'),
    row('a1', 'Honey never spoils.'),
    row('u2', 'another one'),
    row('a2', 'Bananas are berries.'),
  ];

  const rootParent = parentOfVersion(initial, 'u1');
  assert.equal(rootParent, CHAT_THREAD_ROOT);
  assert.ok(Boolean(rootParent), 'root sentinel must be truthy for chatStore conditional');

  const afterEdit = [
    ...initial,
    row('u1b', 'tell me a sea fact', { parent: rootParent, selectedAt: 200 }),
  ];
  assert.deepEqual(appendPlace(afterEdit), { parent: 'u1b' });

  const afterEditedAnswer = [
    ...afterEdit,
    row('a1b', 'Octopuses have three hearts.', { parent: 'u1b', selectedAt: 210 }),
    row('u3', 'and a land one', { parent: 'a1b' }),
    row('a3', 'Cows have best friends.', { parent: 'u3' }),
  ];

  const afterResend = [
    ...afterEditedAnswer,
    row('a1c', 'Sharks predate trees.', { parent: 'u1b', selectedAt: 300 }),
  ];
  const finalThread = chatThread(afterResend);
  assert.deepEqual(
    finalThread.messages.map((m) => m.uuid),
    ['u1b', 'a1c'],
  );
  assert.deepEqual(finalThread.versions.get('u1b'), { index: 1, count: 2 });
  assert.deepEqual(finalThread.versions.get('a1c'), { index: 1, count: 2 });

  assert.equal(neighbourVersion(afterResend, 'u1b', -1), 'u1');
  assert.equal(neighbourVersion(afterResend, 'a1c', -1), 'a1b');
});

test('src/utils/chatThread.ts no longer imports @offgrid/sync', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'src/utils/chatThread.ts'), 'utf8');
  assert.equal(src.includes('@offgrid/sync'), false);
  assert.match(src, /from ['"]\.\/chatThreadCore['"]/);
});
