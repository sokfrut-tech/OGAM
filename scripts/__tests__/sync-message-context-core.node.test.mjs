import assert from 'node:assert/strict';
import test from 'node:test';

import {
  projectSyncedMessageTurn,
  serializeSyncedMessageContext,
} from '../../src/utils/syncMessageContextCore.ts';

test('serializeSyncedMessageContext and projectSyncedMessageTurn round-trip rich assistant turns', () => {
  const wire = serializeSyncedMessageContext({
    reasoning: 'I should confirm the notes before answering.',
    timeline: [
      { kind: 'thinking', text: 'I should confirm the notes before searching.' },
      { kind: 'tool', toolIndex: 0 },
      { kind: 'thinking', text: 'The search result is enough to answer.' },
    ],
    toolCalls: [
      {
        name: 'web_search',
        result: 'The field notes were found.',
        status: 'completed',
      },
    ],
    metrics: {
      modelName: 'Field Model',
      decodeTokensPerSecond: 42.5,
      completionTokens: 128,
      timeToFirstTokenSeconds: undefined,
    },
    toolsOffered: ['web_search', 'contacts_search'],
    parent: 'msg-parent-1',
    selectedAt: 1_700_000_000_000,
    turnKind: 'text',
    videoStoryId: 'story-7',
    status: 'completed',
  });

  assert.ok(wire);
  const parsedWire = JSON.parse(wire);
  assert.equal('status' in parsedWire, false);
  assert.equal('timeToFirstTokenSeconds' in parsedWire.metrics, false);

  const projected = projectSyncedMessageTurn({
    role: 'assistant',
    content: 'The field notes are ready.',
    context: wire,
  });
  assert.deepEqual(projected, {
    role: 'assistant',
    content: 'The field notes are ready.',
    reasoning: 'I should confirm the notes before answering.',
    timeline: [
      { kind: 'thinking', text: 'I should confirm the notes before searching.' },
      { kind: 'tool', toolIndex: 0 },
      { kind: 'thinking', text: 'The search result is enough to answer.' },
    ],
    toolArtifacts: [
      {
        name: 'web_search',
        result: 'The field notes were found.',
        status: 'completed',
      },
    ],
    metrics: {
      modelName: 'Field Model',
      decodeTokensPerSecond: 42.5,
      completionTokens: 128,
    },
    toolsOffered: ['web_search', 'contacts_search'],
    parent: 'msg-parent-1',
    selectedAt: 1_700_000_000_000,
    turnKind: 'text',
    videoStoryId: 'story-7',
    status: 'completed',
  });
});

test('serializeSyncedMessageContext omits empty/default payloads and preserves notice/cancelled/failed states', () => {
  assert.equal(serializeSyncedMessageContext({}), null);
  assert.equal(
    serializeSyncedMessageContext({
      status: 'completed',
      metrics: { modelName: undefined },
      timeline: [],
      toolCalls: [],
      toolsOffered: [],
    }),
    null,
  );

  const cancelledWire = serializeSyncedMessageContext({
    notice: true,
    status: 'cancelled',
    tool: { callId: 'c-1', name: 'fetch', status: 'failed', durationMs: 25 },
    durationMs: 25,
  });
  assert.ok(cancelledWire);
  const projected = projectSyncedMessageTurn({
    role: 'tool',
    content: [
      { type: 'text', text: 'Line 1' },
      { type: 'image', url: 'file:///ignored.png' },
      { type: 'text', text: 'Line 2' },
    ],
    context: cancelledWire,
  });
  assert.deepEqual(projected, {
    role: 'tool',
    content: 'Line 1\nLine 2',
    notice: true,
    status: 'cancelled',
    tool: { callId: 'c-1', name: 'fetch', status: 'failed', durationMs: 25 },
    durationMs: 25,
  });
});

test('projectSyncedMessageTurn handles invalid roles and malformed JSON context safely', () => {
  assert.equal(projectSyncedMessageTurn({ role: 'unknown', content: 'hi' }), null);
  assert.deepEqual(
    projectSyncedMessageTurn({
      role: 'user',
      content: 'hello',
      context: '{not valid json',
    }),
    {
      role: 'user',
      content: 'hello',
      status: 'completed',
    },
  );
});
