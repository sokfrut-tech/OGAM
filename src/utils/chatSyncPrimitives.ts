/**
 * OGAM-owned pure chat preview, runtime-notice, and LAN gateway identity helpers.
 *
 * Replaces `@offgrid/sync` `chatListPreviewLine`, `isRuntimeOnlyMessage`,
 * `PROMPT_ENHANCEMENT_*`, and `readGatewayComputerId` without importing any
 * mesh sync, crypto, or networking code.
 */

export const PROMPT_ENHANCEMENT_REASONING_LABEL = 'Enhanced prompt';
export const PROMPT_ENHANCEMENT_STATUS = 'Enhancing your prompt...';

export interface RuntimeMessageCandidate {
  readonly role?: string;
  readonly content?: string | null;
  readonly notice?: boolean;
}

const ENHANCING_PROMPT_RE = /^Enhancing (?:your )?prompt(?:\s+with AI)?(?:\.\.\.|…)?$/i;
const PROMPT_SKIPPED_RE = /^Prompt enhancement skipped:/i;
const MODEL_LIFECYCLE_RE = /^(?:Model loaded|Unloaded model|Loading (?:image |text )?model):?/i;
const CONTEXT_COMPACTION_RE = /^(?:Context compacted|Compacting context)\b/i;
const IMAGE_STATUS_RE = /^Image generation (?:started|cancelled|failed)\b/i;

/** Returns true for ephemeral UI/runtime status notices that must never enter model prompts or sync state. */
export function isRuntimeOnlyMessage(input: RuntimeMessageCandidate): boolean {
  if (input.notice === true) return true;
  const trimmed = (input.content ?? '').trim();
  if (!trimmed) return false;
  return (
    trimmed === PROMPT_ENHANCEMENT_STATUS ||
    ENHANCING_PROMPT_RE.test(trimmed) ||
    PROMPT_SKIPPED_RE.test(trimmed) ||
    MODEL_LIFECYCLE_RE.test(trimmed) ||
    CONTEXT_COMPACTION_RE.test(trimmed) ||
    IMAGE_STATUS_RE.test(trimmed)
  );
}

/**
 * Formats a single-line conversation list preview with `You: ` prefix for user messages,
 * stripped reasoning/control markers, collapsed whitespace, and ellipsis truncation.
 */
export function chatListPreviewLine(
  role?: string,
  content?: string | null,
  maxLength = 120,
): string {
  if (!content) return '';

  const stripped = content
    .replace(/<\|channel>thought[\s\S]*?<channel\|>/gi, ' ')
    .replace(/<\|channel\|>analysis<\|message\|>[\s\S]*?<\|channel\|>final<\|message\|>/gi, ' ')
    .replace(/<think>[\s\S]*?<\/think>/gi, ' ')
    .replace(/<\/?think>/gi, ' ')
    .replace(/<\|im_start\|>\s*(?:system|assistant|user|tool)?/gi, ' ')
    .replace(/<\|(?:im_end|end|eot_id)\|>|<\/s>/gi, ' ')
    .replace(/```[a-z0-9_-]*\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!stripped) return '';
  const line = role === 'user' ? `You: ${stripped}` : stripped;
  if (maxLength <= 0 || line.length <= maxLength) return line;
  return `${line.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

/** Reads the desktop Sync device ID (`computer_id` / `computerId`) from a gateway `/health` payload. */
export function readGatewayComputerId(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const record = body as Record<string, unknown>;
  const raw = record.computer_id ?? record.computerId;
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
