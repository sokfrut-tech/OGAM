/**
 * OGAM-owned synced message context serialization and cross-host message turn projection.
 *
 * Replaces `@offgrid/sync` `serializeSyncedMessageContext` and `projectSyncedMessageTurn`.
 */

import type {
  SyncedAssistantTimelineEntry,
  SyncedMessageContextInput,
  SyncedMessageMetrics,
  SyncedMessageToolMetadata,
  SyncedMessageTurnInput,
  SyncedMessageTurnProjection,
  SyncedRetrievalSource,
  SyncedToolArtifact,
  SyncedTurnStatus,
} from '../types/syncContracts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanMetrics(raw: unknown): SyncedMessageMetrics | undefined {
  if (!isRecord(raw)) return undefined;
  const result: SyncedMessageMetrics = {};
  if (typeof raw.modelName === 'string' && raw.modelName.length > 0) {
    result.modelName = raw.modelName;
  }
  const numericKeys = [
    'totalSeconds',
    'timeToFirstTokenSeconds',
    'decodeTokensPerSecond',
    'prefillTokensPerSecond',
    'completionTokens',
    'contextWindowTokens',
    'promptTokens',
    'estimatedPromptTokens',
  ] as const;
  for (const key of numericKeys) {
    const val = raw[key];
    if (typeof val === 'number' && Number.isFinite(val)) {
      result[key] = val;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function cleanTimeline(raw: unknown): SyncedAssistantTimelineEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const entries: SyncedAssistantTimelineEntry[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    if (item.kind === 'thinking' && typeof item.text === 'string' && item.text.length > 0) {
      entries.push({ kind: 'thinking', text: item.text });
    } else if (
      item.kind === 'tool' &&
      typeof item.toolIndex === 'number' &&
      Number.isInteger(item.toolIndex) &&
      item.toolIndex >= 0
    ) {
      entries.push({ kind: 'tool', toolIndex: item.toolIndex });
    }
  }
  return entries.length > 0 ? entries : undefined;
}

function cleanToolArtifacts(raw: unknown): SyncedToolArtifact[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const artifacts: SyncedToolArtifact[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    if (typeof item.name !== 'string' || !item.name.trim()) continue;
    const artifact: SyncedToolArtifact = {
      name: item.name,
      result: typeof item.result === 'string' ? item.result : '',
    };
    if (typeof item.id === 'string' && item.id.length > 0) artifact.id = item.id;
    if (typeof item.arguments === 'string') artifact.arguments = item.arguments;
    if (item.status === 'running' || item.status === 'completed' || item.status === 'failed') {
      artifact.status = item.status;
    }
    if (typeof item.durationMs === 'number' && Number.isFinite(item.durationMs) && item.durationMs >= 0) {
      artifact.durationMs = item.durationMs;
    }
    artifacts.push(artifact);
  }
  return artifacts.length > 0 ? artifacts : undefined;
}

function cleanRetrievalSources(raw: unknown): SyncedRetrievalSource[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const sources: SyncedRetrievalSource[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    if (
      typeof item.name !== 'string' ||
      !item.name.trim() ||
      typeof item.score !== 'number' ||
      !Number.isFinite(item.score)
    ) {
      continue;
    }
    const source: SyncedRetrievalSource = {
      name: item.name,
      score: item.score,
    };
    if (typeof item.documentId === 'string' && item.documentId.length > 0) {
      source.documentId = item.documentId;
    }
    if (typeof item.chunkId === 'string' && item.chunkId.length > 0) {
      source.chunkId = item.chunkId;
    }
    if (typeof item.snippet === 'string' && item.snippet.length > 0) {
      source.snippet = item.snippet;
    }
    sources.push(source);
  }
  return sources.length > 0 ? sources : undefined;
}

function cleanToolMetadata(raw: unknown): SyncedMessageToolMetadata | undefined {
  if (!isRecord(raw)) return undefined;
  const meta: SyncedMessageToolMetadata = {};
  if (typeof raw.callId === 'string' && raw.callId.length > 0) meta.callId = raw.callId;
  if (typeof raw.name === 'string' && raw.name.length > 0) meta.name = raw.name;
  if (raw.status === 'running' || raw.status === 'completed' || raw.status === 'failed') {
    meta.status = raw.status;
  }
  if (typeof raw.durationMs === 'number' && Number.isFinite(raw.durationMs) && raw.durationMs >= 0) {
    meta.durationMs = raw.durationMs;
  }
  return Object.keys(meta).length > 0 ? meta : undefined;
}

function cleanToolsOffered(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const filtered = raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return filtered.length > 0 ? filtered : undefined;
}

function cleanTurnKind(raw: unknown): 'text' | 'image' | 'video' | undefined {
  return raw === 'text' || raw === 'image' || raw === 'video' ? raw : undefined;
}

function cleanTurnStatus(raw: unknown): SyncedTurnStatus | undefined {
  return raw === 'completed' || raw === 'cancelled' || raw === 'failed' ? raw : undefined;
}

/**
 * Serializes peer-safe metadata of a chat message turn into JSON for the `context` wire column,
 * returning `null` when only empty or default fields are present.
 */
export function serializeSyncedMessageContext(
  input: SyncedMessageContextInput,
): string | null {
  const payload: Record<string, unknown> = {};

  if (typeof input.videoStoryId === 'string' && input.videoStoryId.length > 0) {
    payload.videoStoryId = input.videoStoryId;
  }
  if (typeof input.parent === 'string' && input.parent.length > 0) {
    payload.parent = input.parent;
  }
  if (typeof input.selectedAt === 'number' && Number.isFinite(input.selectedAt)) {
    payload.selectedAt = input.selectedAt;
  }
  if (typeof input.reasoning === 'string' && input.reasoning.length > 0) {
    payload.reasoning = input.reasoning;
  }
  const timeline = cleanTimeline(input.timeline);
  if (timeline) payload.timeline = timeline;

  if (input.notice === true) {
    payload.notice = true;
  }
  const toolsOffered = cleanToolsOffered(input.toolsOffered);
  if (toolsOffered) payload.toolsOffered = toolsOffered;

  const metrics = cleanMetrics(input.metrics);
  if (metrics) payload.metrics = metrics;

  const toolCalls = cleanToolArtifacts(input.toolCalls);
  if (toolCalls) payload.toolCalls = toolCalls;

  const retrievalSources = cleanRetrievalSources(input.retrievalSources);
  if (retrievalSources) payload.retrievalSources = retrievalSources;

  const tool = cleanToolMetadata(input.tool);
  if (tool) payload.tool = tool;

  if (typeof input.durationMs === 'number' && Number.isFinite(input.durationMs) && input.durationMs >= 0) {
    payload.durationMs = input.durationMs;
  }
  const turnKind = cleanTurnKind(input.turnKind);
  if (turnKind) payload.turnKind = turnKind;

  if (input.status === 'cancelled' || input.status === 'failed') {
    payload.status = input.status;
  }

  return Object.keys(payload).length > 0 ? JSON.stringify(payload) : null;
}

function normalizeMessageContent(content: SyncedMessageTurnInput['content']): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter(
      (part): part is { type: 'text'; text: string } =>
        isRecord(part) && part.type === 'text' && typeof part.text === 'string',
    )
    .map(part => part.text)
    .join('\n');
}

/**
 * Projects a raw synced message row (`role`, `content`, `context`) into a validated cross-host
 * message turn, returning `null` for unsupported roles or invalid inputs.
 */
export function projectSyncedMessageTurn(
  input: SyncedMessageTurnInput,
): SyncedMessageTurnProjection | null {
  if (!input || typeof input !== 'object') return null;
  if (
    input.role !== 'user' &&
    input.role !== 'assistant' &&
    input.role !== 'system' &&
    input.role !== 'tool'
  ) {
    return null;
  }

  let parsedContext: Record<string, unknown> = {};
  if (typeof input.context === 'string' && input.context.trim().length > 0) {
    try {
      const candidate = JSON.parse(input.context) as unknown;
      if (isRecord(candidate)) parsedContext = candidate;
    } catch {
      parsedContext = {};
    }
  }

  const projection: SyncedMessageTurnProjection = {
    role: input.role,
    content: normalizeMessageContent(input.content),
    status: cleanTurnStatus(parsedContext.status) ?? 'completed',
  };

  if (typeof parsedContext.reasoning === 'string' && parsedContext.reasoning.length > 0) {
    projection.reasoning = parsedContext.reasoning;
  }
  const timeline = cleanTimeline(parsedContext.timeline);
  if (timeline) projection.timeline = timeline;

  const toolArtifacts = cleanToolArtifacts(parsedContext.toolCalls ?? parsedContext.toolArtifacts);
  if (toolArtifacts) projection.toolArtifacts = toolArtifacts;

  const retrievalSources = cleanRetrievalSources(parsedContext.retrievalSources);
  if (retrievalSources) projection.retrievalSources = retrievalSources;

  const metrics = cleanMetrics(parsedContext.metrics);
  if (metrics) projection.metrics = metrics;

  if (parsedContext.notice === true) projection.notice = true;

  const toolsOffered = cleanToolsOffered(parsedContext.toolsOffered);
  if (toolsOffered) projection.toolsOffered = toolsOffered;

  const tool = cleanToolMetadata(parsedContext.tool);
  if (tool) projection.tool = tool;

  if (
    typeof parsedContext.durationMs === 'number' &&
    Number.isFinite(parsedContext.durationMs) &&
    parsedContext.durationMs >= 0
  ) {
    projection.durationMs = parsedContext.durationMs;
  }
  const turnKind = cleanTurnKind(parsedContext.turnKind);
  if (turnKind) projection.turnKind = turnKind;

  if (typeof parsedContext.parent === 'string' && parsedContext.parent.length > 0) {
    projection.parent = parsedContext.parent;
  }
  if (typeof parsedContext.selectedAt === 'number' && Number.isFinite(parsedContext.selectedAt)) {
    projection.selectedAt = parsedContext.selectedAt;
  }
  if (typeof parsedContext.videoStoryId === 'string' && parsedContext.videoStoryId.length > 0) {
    projection.videoStoryId = parsedContext.videoStoryId;
  }

  return projection;
}
