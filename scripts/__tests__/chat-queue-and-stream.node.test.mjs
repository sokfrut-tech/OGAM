import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  chatQueueHeld,
  chatQueueHoldAfter,
  markQueuedSendNow,
  takeNextQueued,
} from '../../src/utils/chatQueue.ts';
import {
  chatStreamPhaseIsStatus,
  chatStreamPhaseLabel,
  chatStreamPreviewHasMessageBody,
  chatStreamPreviewRows,
  completeChatStreamTool,
  isSupportingChatContext,
  splitInlineReasoning,
  startChatStreamTool,
} from '../../src/utils/chatStreamHelpers.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

test('chatQueue holds after stop/failure, releases on done/resume, and prioritizes send-now items', () => {
  assert.equal(chatQueueHoldAfter('stop'), 'stop');
  assert.equal(chatQueueHoldAfter('failure'), 'failure');
  assert.equal(chatQueueHoldAfter('done'), undefined);
  assert.equal(chatQueueHoldAfter('resume'), undefined);

  const initial = [
    { id: 'q1', conversationId: 'c1', text: 'title' },
    { id: 'q2', conversationId: 'c1', text: 'moral' },
    { id: 'q3', conversationId: 'c2', text: 'other chat' },
  ];
  assert.equal(chatQueueHeld('stop', initial), true);
  assert.equal(chatQueueHeld(undefined, initial), false);

  const promoted = markQueuedSendNow(initial, 'q2');
  assert.equal(chatQueueHeld('stop', promoted), false);

  const firstTurn = takeNextQueued(promoted);
  assert.deepEqual(firstTurn.batch.map((m) => m.id), ['q2']);
  assert.deepEqual(firstTurn.rest.map((m) => m.id), ['q1', 'q3']);

  const secondTurn = takeNextQueued(firstTurn.rest);
  assert.deepEqual(secondTurn.batch.map((m) => m.id), ['q1']);
  assert.deepEqual(secondTurn.rest.map((m) => m.id), ['q3']);
});

test('chatStream tool timeline transitions running -> completed without mutating inputs', () => {
  const running = startChatStreamTool([], 'generate_image');
  assert.deepEqual(running, [{ name: 'generate_image', status: 'running' }]);

  const completed = completeChatStreamTool(running, 'generate_image', 'Image generation started');
  assert.deepEqual(completed, [
    { name: 'generate_image', status: 'completed', result: 'Image generation started' },
  ]);
  assert.deepEqual(running, [{ name: 'generate_image', status: 'running' }]);
});

test('splitInlineReasoning and isSupportingChatContext identify labelled supporting blocks', () => {
  const split = splitInlineReasoning('<think>__LABEL:Enhanced prompt__\nA lighthouse in winter.</think>');
  assert.deepEqual(split, {
    reasoning: 'A lighthouse in winter.',
    answer: '',
    reasoningLabel: 'Enhanced prompt',
  });
  assert.equal(
    isSupportingChatContext({
      answer: split.answer,
      reasoning: split.reasoning,
      reasoningLabel: split.reasoningLabel,
    }),
    true,
  );
  assert.equal(
    isSupportingChatContext({
      answer: 'Generated image for: lighthouse',
      reasoning: split.reasoning,
      reasoningLabel: split.reasoningLabel,
    }),
    false,
  );
});

test('chatStream phase labels, status detection, body detection, and preview projection match ChatScreen contracts', () => {
  assert.equal(chatStreamPhaseIsStatus('loading_model'), true);
  assert.equal(chatStreamPhaseIsStatus('loading_image_model'), true);
  assert.equal(chatStreamPhaseIsStatus('generating_image'), true);
  assert.equal(chatStreamPhaseIsStatus('answering'), false);
  assert.equal(chatStreamPhaseIsStatus('waiting'), false);
  assert.equal(chatStreamPhaseIsStatus('thinking'), false);

  assert.equal(chatStreamPhaseLabel('loading_model'), 'Loading model...');
  assert.equal(chatStreamPhaseLabel('loading_image_model'), 'Loading image model...');
  assert.equal(
    chatStreamPhaseLabel('generating_image', { current: 3, total: 8 }),
    'Generating image... 3/8',
  );
  assert.equal(chatStreamPhaseLabel('waiting'), 'Preparing reply...');

  assert.equal(chatStreamPreviewHasMessageBody({ content: ' - ' }), false);
  assert.equal(chatStreamPreviewHasMessageBody({ content: '' }), false);
  assert.equal(chatStreamPreviewHasMessageBody({ content: 'I will make that image.' }), true);

  const rows = chatStreamPreviewRows(
    [
      {
        conversationId: 'other',
        messageId: 'm0',
        deviceId: 'mac',
        content: 'ignore',
        phase: 'answering',
      },
      {
        conversationId: 'conv-1',
        messageId: 'm2',
        deviceId: 'mac',
        content: 'second',
        phase: 'answering',
        startedAt: 20,
      },
      {
        conversationId: 'conv-1',
        messageId: 'm1',
        deviceId: 'phone',
        content: '',
        phase: 'loading_model',
        startedAt: 10,
      },
      {
        conversationId: 'conv-1',
        messageId: 'm3',
        deviceId: 'mac',
        content: 'done',
        phase: 'done',
        completed: true,
        startedAt: 5,
      },
    ],
    'conv-1',
  );

  assert.deepEqual(
    rows.map((r) => [r.id, r.messageId]),
    [
      ['remote-stream:m1', 'm1'],
      ['remote-stream:m2', 'm2'],
    ],
  );
});

test('all 7 queue/stream consumer files no longer import @offgrid/sync', () => {
  const files = [
    'src/services/generationService.ts',
    'src/components/ChatInput/Toolbar.tsx',
    'src/services/sync/chatStreamTools.ts',
    'src/components/ChatMessage/index.tsx',
    'src/screens/ChatScreen/types.ts',
    'src/screens/ChatScreen/useRemoteChatStreamPreviews.ts',
    'src/stores/remoteChatStreamStore.ts',
  ];
  for (const rel of files) {
    const content = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    assert.equal(content.includes('@offgrid/sync'), false, `${rel} still references @offgrid/sync`);
  }
});
