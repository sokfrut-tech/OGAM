/**
 * OGAM-owned Personal Mesh entity constants, wire-field builders, and model-transfer admission rules.
 *
 * Replaces `@offgrid/sync` entity constants, state field builders, `writingLearnedEntityId`,
 * `parseWritingLearned`, and `ogamModelTransferBlocker`.
 */

import type {
  KnowledgeDocumentDescriptor,
  SharedFileDescriptor,
  TransferredModelManifest,
  WritingLearned,
} from '../types/syncContracts';

export const OFFGRID_SYNC_PORT = 37878;

export const KNOWLEDGE_DOCUMENT_ENTITY = 'knowledge_document';
export const SHARED_FILE_ENTITY = 'shared_file';
export const NOTE_FILE_ENTITY = 'note_file';
export const TASK_LAUNCH_ENTITY = 'task_launch';
export const TASK_RUN_ENTITY = 'task_run';
export const TASK_CONTROL_ENTITY = 'task_control';
export const WRITING_LEARNED_ENTITY = 'writing_learned';
export const WRITING_PREFERENCE_ENTITY = 'writing_preference';
export const WRITING_STYLE_GUIDE_ENTITY = 'writing_style_guide';

const WHISPER_PREFIX = 'ggerganov/whisper.cpp/';
const IMAGE_TRANSFER_ARCHIVE_SUFFIX = '.offgrid-image.zip';

/** Serializes a knowledge-document descriptor into its canonical snake_case sync record fields. */
export function createKnowledgeDocumentStateFields(
  document: KnowledgeDocumentDescriptor,
): Record<string, unknown> {
  return {
    project_id: document.projectId,
    name: document.name,
    created_at: document.createdAt,
    enabled: document.enabled ? 1 : 0,
  };
}

/**
 * Serializes a shared-file descriptor into its canonical snake_case wire record without exposing
 * device-local filesystem paths.
 */
export function createSharedFileStateFields(
  file: SharedFileDescriptor,
): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    kind: file.kind,
    name: file.name,
    mime_type: file.mimeType,
    file_size: file.fileSize,
    created_at: file.createdAt,
  };
  if (file.width !== undefined) fields.width = file.width;
  if (file.height !== undefined) fields.height = file.height;
  if (file.durationSeconds !== undefined) fields.duration_seconds = file.durationSeconds;
  if (file.conversationId !== undefined) fields.conversation_id = file.conversationId;
  if (file.messageId !== undefined) fields.message_id = file.messageId;
  if (file.metadataJson !== undefined) fields.metadata_json = file.metadataJson;
  if (file.contentHash !== undefined) fields.content_hash = file.contentHash;
  return fields;
}

/** Computes a normalized cross-device entity ID for a Scribe learned term or muted rule. */
export function writingLearnedEntityId(item: WritingLearned): string {
  if (item.kind === 'term') {
    return `term:${item.term.trim().toLowerCase()}`;
  }
  return `rule-muted:${item.ruleId.trim()}`;
}

/** Builds canonical wire fields for a Scribe learned term or muted rule record. */
export function createWritingLearnedFields(
  item: WritingLearned,
  learnedAt = Date.now(),
): Record<string, unknown> {
  if (item.kind === 'term') {
    return {
      kind: 'term',
      term: item.term.trim().toLowerCase(),
      learned_at: learnedAt,
    };
  }
  return {
    kind: 'rule-muted',
    rule_id: item.ruleId.trim(),
    learned_at: learnedAt,
  };
}

/** Parses a materialized Scribe learned record back into a typed `WritingLearned` item. */
export function parseWritingLearned(
  entityId: string,
  fields: Record<string, unknown>,
): WritingLearned | null {
  const rawKind = fields.kind;
  if (rawKind === 'term' || (!rawKind && entityId.startsWith('term:'))) {
    const rawTerm =
      typeof fields.term === 'string'
        ? fields.term
        : entityId.startsWith('term:')
          ? entityId.slice('term:'.length)
          : '';
    const term = rawTerm.trim().toLowerCase();
    return term ? { kind: 'term', term } : null;
  }
  if (rawKind === 'rule-muted' || (!rawKind && entityId.startsWith('rule-muted:'))) {
    const rawRuleId =
      typeof fields.rule_id === 'string'
        ? fields.rule_id
        : typeof fields.ruleId === 'string'
          ? fields.ruleId
          : entityId.startsWith('rule-muted:')
            ? entityId.slice('rule-muted:'.length)
            : '';
    const ruleId = rawRuleId.trim();
    return ruleId ? { kind: 'rule-muted', ruleId } : null;
  }
  return null;
}

function hasUnsafePathSegments(value: string): boolean {
  if (!value || value.includes('\\')) return true;
  const parts = value.split('/');
  return parts.some(part => part === '.' || part === '..');
}

function isSafeFileName(name: string): boolean {
  return (
    name.length > 0 &&
    name !== '.' &&
    name !== '..' &&
    !name.includes('/') &&
    !name.includes('\\')
  );
}

/**
 * Evaluates whether a peer-offered model transfer manifest can be admitted by OGAM mobile.
 * Returns a human-readable blocker reason when rejected, or `null` when admissible.
 */
export function ogamModelTransferBlocker(
  manifest: TransferredModelManifest,
): string | null {
  if (!manifest || typeof manifest !== 'object') {
    return 'Transferred model manifest is invalid';
  }
  if (typeof manifest.id !== 'string' || hasUnsafePathSegments(manifest.id.trim())) {
    return 'Transferred model identity is not safe';
  }
  if (typeof manifest.name !== 'string' || !manifest.name.trim()) {
    return 'Transferred model name is missing';
  }
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    return 'Transferred model manifest has no files';
  }

  for (const file of manifest.files) {
    if (
      !file ||
      typeof file.name !== 'string' ||
      !isSafeFileName(file.name) ||
      !Number.isSafeInteger(file.sizeBytes) ||
      file.sizeBytes <= 0
    ) {
      return 'Transferred model file descriptor is invalid';
    }
  }

  switch (manifest.kind) {
    case 'text': {
      const primaries = manifest.files.filter(file => file.role === 'primary');
      const projectors = manifest.files.filter(file => file.role === 'projector');
      if (
        manifest.files.length !== 1 ||
        primaries.length !== 1 ||
        projectors.length !== 0 ||
        !primaries[0].name.toLowerCase().endsWith('.gguf')
      ) {
        return 'a text model transfer requires a single GGUF file';
      }
      return null;
    }

    case 'vision': {
      const primaries = manifest.files.filter(file => file.role === 'primary');
      const projectors = manifest.files.filter(file => file.role === 'projector');
      if (
        primaries.length !== 1 ||
        projectors.length > 1 ||
        manifest.files.length !== primaries.length + projectors.length ||
        !primaries[0].name.toLowerCase().endsWith('.gguf') ||
        (projectors[0] && !projectors[0].name.toLowerCase().endsWith('.gguf'))
      ) {
        return 'a vision model transfer requires one primary GGUF file and at most one GGUF projector';
      }
      return null;
    }

    case 'transcription': {
      if (!manifest.id.startsWith(WHISPER_PREFIX)) {
        return 'this model only transfers between two devices of the same kind';
      }
      const slug = manifest.id.slice(WHISPER_PREFIX.length);
      if (!slug) {
        return 'not a Whisper package';
      }
      if (
        slug === '.' ||
        slug === '..' ||
        slug.includes('/') ||
        slug.includes('\\') ||
        manifest.files.length !== 1 ||
        manifest.files[0].role !== 'primary' ||
        manifest.files[0].name !== `ggml-${slug}.bin`
      ) {
        return 'a Whisper transfer is one ggml bin named after the model';
      }
      return null;
    }

    case 'image': {
      const validMobileEngine =
        manifest.engine === 'coreml' ||
        manifest.engine === 'localdream-mnn' ||
        manifest.engine === 'mobile-sd-gguf';
      if (
        !validMobileEngine ||
        manifest.files.length !== 1 ||
        manifest.files[0].role !== 'primary' ||
        !manifest.files[0].name.endsWith(IMAGE_TRANSFER_ARCHIVE_SUFFIX)
      ) {
        return 'this model only transfers between two devices of the same kind';
      }
      return null;
    }

    default:
      return 'this model only transfers between two devices of the same kind';
  }
}
