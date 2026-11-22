/**
 * OGAM-owned pure chat-stream preview, inline reasoning, and tool-timeline helpers.
 *
 * Replaces `@offgrid/sync`'s stream/context formatting exports without importing
 * any mesh transport or encryption primitives.
 */

export interface ChatStreamTool {
  readonly name: string;
  readonly status: 'running' | 'completed';
  readonly result?: string;
}

export interface ChatStreamProgress {
  readonly current: number;
  readonly total: number;
}

export type ChatStreamPhase =
  | 'waiting'
  | 'loading_model'
  | 'thinking'
  | 'answering'
  | 'loading_image_model'
  | 'generating_image'
  | 'generating_video'
  | 'enhancing_prompt'
  | 'done'
  | (string & {});

export interface ChatStreamPreview {
  readonly id?: string;
  readonly conversationId: string;
  readonly messageId: string;
  readonly deviceId: string;
  readonly content: string;
  readonly reasoning?: string;
  readonly phase?: ChatStreamPhase;
  readonly progress?: ChatStreamProgress;
  readonly tools?: readonly ChatStreamTool[];
  readonly startedAt?: number;
  readonly updatedAt?: number;
  readonly completed?: boolean;
}

export interface ChatStreamPreviewRow {
  readonly id: string;
  readonly messageId: string;
  readonly deviceId: string;
  readonly content: string;
  readonly reasoning?: string;
  readonly phase?: ChatStreamPhase;
  readonly progress?: ChatStreamProgress;
  readonly tools?: readonly ChatStreamTool[];
}

export interface InlineReasoningSplit {
  readonly reasoning: string | null;
  readonly answer: string;
  readonly reasoningLabel?: string;
}

const GEMMA_OPEN_RE = /<\|channel>thought\n?/i;
const GEMMA_CLOSE_RE = /<channel\|>/i;
const QWEN_ANALYSIS_RE = /<\|channel\|>analysis<\|message\|>/i;
const QWEN_FINAL_RE = /<\|channel\|>final<\|message\|>/i;
const THINK_OPEN_RE = /<think>/i;
const THINK_CLOSE_RE = /<\/think>/i;
const REASONING_LABEL_RE = /^__LABEL:(.+?)__\n*/;

const STATUS_PHASES = new Set<string>([
  'loading_model',
  'loading_image_model',
  'generating_image',
  'generating_video',
  'enhancing_prompt',
]);

/** Appends a running tool entry to an immutable chat-stream tool timeline. */
export function startChatStreamTool(
  tools: readonly ChatStreamTool[],
  name: string,
): ChatStreamTool[] {
  return [...tools, { name, status: 'running' }];
}

/** Completes the first matching running tool entry (or appends a completed entry). */
export function completeChatStreamTool(
  tools: readonly ChatStreamTool[],
  name: string,
  result: string,
): ChatStreamTool[] {
  const index = tools.findIndex((tool) => tool.status === 'running' && tool.name === name);
  if (index < 0) {
    return [...tools, { name, status: 'completed', result }];
  }
  return tools.map((tool, i) =>
    i === index ? { name: tool.name, status: 'completed', result } : tool,
  );
}

/** Splits Gemma/Qwen/<think> inline reasoning blocks and optional `__LABEL:...__` header from `content`. */
export function splitInlineReasoning(content: string): InlineReasoningSplit {
  if (!content) return { reasoning: null, answer: '' };

  const gemmaOpen = GEMMA_OPEN_RE.exec(content);
  if (gemmaOpen) {
    const start = gemmaOpen.index + gemmaOpen[0].length;
    const gemmaClose = GEMMA_CLOSE_RE.exec(content);
    if (gemmaClose && gemmaClose.index >= start) {
      return {
        reasoning: content.slice(start, gemmaClose.index).trim(),
        answer: content.slice(gemmaClose.index + gemmaClose[0].length).trim(),
      };
    }
    return { reasoning: content.slice(start).trim(), answer: '' };
  }

  const qwenAnalysis = QWEN_ANALYSIS_RE.exec(content);
  if (qwenAnalysis) {
    const start = qwenAnalysis.index + qwenAnalysis[0].length;
    const qwenFinal = QWEN_FINAL_RE.exec(content);
    if (!qwenFinal || qwenFinal.index < start) {
      return { reasoning: content.slice(start).trim(), answer: '' };
    }
    return {
      reasoning: content.slice(start, qwenFinal.index).trim(),
      answer: content.slice(qwenFinal.index + qwenFinal[0].length).trim(),
    };
  }

  const thinkOpen = THINK_OPEN_RE.exec(content);
  const thinkClose = THINK_CLOSE_RE.exec(content);
  if (!thinkOpen) {
    if (thinkClose) {
      const candidate = content.slice(0, thinkClose.index).trim();
      if (candidate) {
        return {
          reasoning: candidate,
          answer: content.slice(thinkClose.index + thinkClose[0].length).trim(),
        };
      }
    }
    return { reasoning: null, answer: content };
  }

  const thinkStart = thinkOpen.index + thinkOpen[0].length;
  const rawThinking = thinkClose
    ? content.slice(thinkStart, thinkClose.index).trim()
    : content.slice(thinkStart).trim();
  const answer = thinkClose
    ? content.slice(thinkClose.index + thinkClose[0].length).trim()
    : '';

  const labelMatch = REASONING_LABEL_RE.exec(rawThinking);
  if (labelMatch) {
    return {
      reasoning: rawThinking.slice(labelMatch[0].length).trim(),
      answer,
      reasoningLabel: labelMatch[1],
    };
  }
  return { reasoning: rawThinking, answer };
}

/** True when a row carries labelled supporting context (such as an Enhanced prompt card) and no answer text. */
export function isSupportingChatContext(input: {
  readonly answer?: string | null;
  readonly reasoning?: string | null;
  readonly reasoningLabel?: string | null;
}): boolean {
  return (
    Boolean(input.reasoningLabel?.trim()) &&
    Boolean(input.reasoning?.trim()) &&
    !(input.answer ?? '').trim()
  );
}

/** Returns true when `phase` represents an active model/media status step rather than message body. */
export function chatStreamPhaseIsStatus(phase?: ChatStreamPhase): boolean {
  return typeof phase === 'string' && STATUS_PHASES.has(phase);
}

/** Formats the user-visible status label for a remote chat stream phase and optional progress counter. */
export function chatStreamPhaseLabel(
  phase?: ChatStreamPhase,
  progress?: ChatStreamProgress,
): string | undefined {
  switch (phase) {
    case 'loading_model':
      return 'Loading model...';
    case 'loading_image_model':
      return 'Loading image model...';
    case 'generating_image':
      return progress && progress.total > 0
        ? `Generating image... ${progress.current}/${progress.total}`
        : 'Generating image...';
    case 'generating_video':
      return progress && progress.total > 0
        ? `Generating video... ${progress.current}/${progress.total}`
        : 'Generating video...';
    case 'enhancing_prompt':
      return 'Enhancing your prompt...';
    case 'waiting':
      return 'Preparing reply...';
    case 'thinking':
      return 'Thinking...';
    default:
      return undefined;
  }
}

/** Returns true when a remote stream preview carries substantive answer text (ignoring punctuation placeholders like `' - '`). */
export function chatStreamPreviewHasMessageBody(
  preview: Pick<ChatStreamPreviewRow, 'content'>,
): boolean {
  const trimmed = (preview.content ?? '').trim();
  return trimmed.length > 0 && !/^[-–—·•.]+$/.test(trimmed);
}

/** Projects active remote previews for `conversationId` in stable display order. */
export function chatStreamPreviewRows(
  previews: readonly ChatStreamPreview[],
  conversationId: string | null | undefined,
): ChatStreamPreviewRow[] {
  if (!conversationId || previews.length === 0) return [];
  return previews
    .filter(
      (preview) =>
        preview.conversationId === conversationId &&
        !preview.completed &&
        preview.phase !== 'done',
    )
    .slice()
    .sort((a, b) => {
      const aTime = a.startedAt ?? a.updatedAt ?? 0;
      const bTime = b.startedAt ?? b.updatedAt ?? 0;
      if (aTime !== bTime) return aTime - bTime;
      return a.messageId.localeCompare(b.messageId);
    })
    .map((preview) => ({
      id: preview.id ?? `remote-stream:${preview.messageId}`,
      messageId: preview.messageId,
      deviceId: preview.deviceId,
      content: preview.content,
      ...(preview.reasoning !== undefined ? { reasoning: preview.reasoning } : {}),
      ...(preview.phase !== undefined ? { phase: preview.phase } : {}),
      ...(preview.progress !== undefined ? { progress: preview.progress } : {}),
      ...(preview.tools !== undefined ? { tools: preview.tools } : {}),
    }));
}
