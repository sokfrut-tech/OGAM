import assert from 'node:assert/strict';
import test from 'node:test';

import {
  KNOWLEDGE_DOCUMENT_ENTITY,
  NOTE_FILE_ENTITY,
  OFFGRID_SYNC_PORT,
  SHARED_FILE_ENTITY,
  TASK_CONTROL_ENTITY,
  TASK_LAUNCH_ENTITY,
  TASK_RUN_ENTITY,
  WRITING_LEARNED_ENTITY,
  WRITING_PREFERENCE_ENTITY,
  WRITING_STYLE_GUIDE_ENTITY,
  createKnowledgeDocumentStateFields,
  createSharedFileStateFields,
  createWritingLearnedFields,
  ogamModelTransferBlocker,
  parseWritingLearned,
  writingLearnedEntityId,
} from '../../src/utils/syncEntityCore.ts';

test('sync entity constants and default Personal Mesh port match cross-host wire schema', () => {
  assert.equal(OFFGRID_SYNC_PORT, 37878);
  assert.equal(KNOWLEDGE_DOCUMENT_ENTITY, 'knowledge_document');
  assert.equal(SHARED_FILE_ENTITY, 'shared_file');
  assert.equal(NOTE_FILE_ENTITY, 'note_file');
  assert.equal(TASK_LAUNCH_ENTITY, 'task_launch');
  assert.equal(TASK_RUN_ENTITY, 'task_run');
  assert.equal(TASK_CONTROL_ENTITY, 'task_control');
  assert.equal(WRITING_LEARNED_ENTITY, 'writing_learned');
  assert.equal(WRITING_PREFERENCE_ENTITY, 'writing_preference');
  assert.equal(WRITING_STYLE_GUIDE_ENTITY, 'writing_style_guide');
});

test('createKnowledgeDocumentStateFields produces canonical snake_case wire record', () => {
  assert.deepEqual(
    createKnowledgeDocumentStateFields({
      syncId: 'doc-1',
      projectId: 'proj-1',
      name: 'launch-brief.txt',
      createdAt: '2026-07-28T08:00:00.000Z',
      enabled: true,
    }),
    {
      project_id: 'proj-1',
      name: 'launch-brief.txt',
      created_at: '2026-07-28T08:00:00.000Z',
      enabled: 1,
    },
  );
  assert.equal(
    createKnowledgeDocumentStateFields({
      syncId: 'doc-2',
      projectId: 'proj-1',
      name: 'disabled.txt',
      createdAt: '2026-07-28T08:00:00.000Z',
      enabled: false,
    }).enabled,
    0,
  );
});

test('createSharedFileStateFields maps snake_case fields, omits undefined optionals, and leaks no local paths', () => {
  const minimal = createSharedFileStateFields({
    syncId: 'sf-1',
    kind: 'generated_media',
    name: 'sf-1.png',
    mimeType: 'image/png',
    fileSize: 2048,
    createdAt: '2026-08-04T09:00:00.000Z',
  });
  assert.deepEqual(minimal, {
    kind: 'generated_media',
    name: 'sf-1.png',
    mime_type: 'image/png',
    file_size: 2048,
    created_at: '2026-08-04T09:00:00.000Z',
  });
  assert.equal('localPath' in minimal, false);
  assert.equal('width' in minimal, false);

  const full = createSharedFileStateFields({
    syncId: 'sf-2',
    kind: 'message_attachment',
    name: 'clip.jpg',
    mimeType: 'image/jpeg',
    fileSize: 4096,
    createdAt: '2026-08-04T09:05:00.000Z',
    width: 512,
    height: 512,
    durationSeconds: 3.5,
    conversationId: 'conv-1',
    messageId: 'msg-1',
    metadataJson: '{"prompt":"lighthouse"}',
    contentHash: 'a'.repeat(64),
  });
  assert.equal(full.width, 512);
  assert.equal(full.height, 512);
  assert.equal(full.duration_seconds, 3.5);
  assert.equal(full.conversation_id, 'conv-1');
  assert.equal(full.message_id, 'msg-1');
  assert.equal(full.metadata_json, '{"prompt":"lighthouse"}');
  assert.equal(full.content_hash, 'a'.repeat(64));
});

test('writingLearnedEntityId, createWritingLearnedFields, and parseWritingLearned normalize and round-trip', () => {
  assert.equal(
    writingLearnedEntityId({ kind: 'term', term: '  Recieve ' }),
    writingLearnedEntityId({ kind: 'term', term: 'recieve' }),
  );
  const termId = writingLearnedEntityId({ kind: 'term', term: 'Offgridly' });
  const termFields = createWritingLearnedFields({ kind: 'term', term: 'Offgridly' }, 12345);
  assert.deepEqual(termFields, { kind: 'term', term: 'offgridly', learned_at: 12345 });
  assert.deepEqual(parseWritingLearned(termId, termFields), { kind: 'term', term: 'offgridly' });

  const ruleId = writingLearnedEntityId({ kind: 'rule-muted', ruleId: 'their-there' });
  const ruleFields = createWritingLearnedFields({ kind: 'rule-muted', ruleId: 'their-there' }, 99);
  assert.deepEqual(ruleFields, { kind: 'rule-muted', rule_id: 'their-there', learned_at: 99 });
  assert.deepEqual(parseWritingLearned(ruleId, ruleFields), {
    kind: 'rule-muted',
    ruleId: 'their-there',
  });
  assert.equal(parseWritingLearned('unknown-id', {}), null);
});

test('ogamModelTransferBlocker admits valid mobile packages and rejects unsafe or desktop-only manifests', () => {
  assert.equal(
    ogamModelTransferBlocker({
      id: 'off-grid/mobile-text',
      name: 'Mobile Text',
      kind: 'text',
      source: 'downloaded',
      files: [{ name: 'mobile-text-Q4_K_M.gguf', sizeBytes: 1024, role: 'primary' }],
    }),
    null,
  );
  assert.equal(
    ogamModelTransferBlocker({
      id: 'off-grid/mobile-vision',
      name: 'Mobile Vision',
      kind: 'vision',
      source: 'downloaded',
      files: [
        { name: 'mobile-vision-Q4_K_M.gguf', sizeBytes: 2048, role: 'primary' },
        { name: 'mmproj-F16.gguf', sizeBytes: 1024, role: 'projector' },
      ],
    }),
    null,
  );
  assert.equal(
    ogamModelTransferBlocker({
      id: 'ggerganov/whisper.cpp/base.en',
      name: 'Whisper Base',
      kind: 'transcription',
      source: 'downloaded',
      files: [{ name: 'ggml-base.en.bin', sizeBytes: 10_485_760, role: 'primary' }],
    }),
    null,
  );
  assert.equal(
    ogamModelTransferBlocker({
      id: 'sd-turbo',
      name: 'SD Turbo',
      kind: 'image',
      source: 'downloaded',
      engine: 'mobile-sd-gguf',
      platform: 'android',
      files: [{ name: 'sd-turbo.offgrid-image.zip', sizeBytes: 5000, role: 'primary' }],
    }),
    null,
  );

  // Rejections pinned against __tests__/unit/sync/modelPackageSink.test.ts
  assert.equal(
    ogamModelTransferBlocker({
      id: 'ggerganov/whisper.cpp/base.en',
      name: 'Whisper Base',
      kind: 'transcription',
      source: 'downloaded',
      files: [{ name: 'ggml-small.en.bin', sizeBytes: 1024, role: 'primary' }],
    }),
    'a Whisper transfer is one ggml bin named after the model',
  );
  assert.ok(
    ogamModelTransferBlocker({
      id: 'ggerganov/whisper.cpp/../base.en',
      name: 'Whisper Base',
      kind: 'transcription',
      source: 'downloaded',
      files: [{ name: 'ggml-base.en.bin', sizeBytes: 1024, role: 'primary' }],
    }),
  );
  assert.equal(
    ogamModelTransferBlocker({
      id: 'ggerganov/whisper.cpp/',
      name: 'Whisper Base',
      kind: 'transcription',
      source: 'downloaded',
      files: [{ name: 'ggml-.bin', sizeBytes: 1024, role: 'primary' }],
    }),
    'not a Whisper package',
  );
  assert.equal(
    ogamModelTransferBlocker({
      id: 'someone-else/base.en',
      name: 'Parakeet',
      kind: 'transcription',
      source: 'downloaded',
      files: [{ name: 'ggml-base.en.bin', sizeBytes: 1024, role: 'primary' }],
    }),
    'this model only transfers between two devices of the same kind',
  );
  assert.equal(
    ogamModelTransferBlocker({
      id: 'off-grid/mobile-image',
      name: 'Desktop Image',
      kind: 'image',
      source: 'downloaded',
      files: [{ name: 'mobile-image.safetensors', sizeBytes: 1024, role: 'primary' }],
    }),
    'this model only transfers between two devices of the same kind',
  );
  assert.ok(
    ogamModelTransferBlocker({
      id: 'off-grid/mobile-text',
      name: 'Two Primaries',
      kind: 'text',
      source: 'downloaded',
      files: [
        { name: 'one-Q4_K_M.gguf', sizeBytes: 1024, role: 'primary' },
        { name: 'two-Q4_K_M.gguf', sizeBytes: 1024, role: 'primary' },
      ],
    }),
  );
  assert.ok(
    ogamModelTransferBlocker({
      id: 'off-grid/mobile-text',
      name: 'Text With Projector',
      kind: 'text',
      source: 'downloaded',
      files: [
        { name: 'mobile-text-Q4_K_M.gguf', sizeBytes: 1024, role: 'primary' },
        { name: 'mmproj-F16.gguf', sizeBytes: 1024, role: 'projector' },
      ],
    }),
  );
});
