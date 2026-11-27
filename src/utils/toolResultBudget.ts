/**
 * Bounds a tool's model-facing text so one large result cannot consume the whole context.
 *
 * The retained head is useful for common overview-first tools. The suffix is deliberately
 * outside the retained-character budget: it reports the exact original length so the model
 * knows the result was incomplete and must not claim to have seen the entire source.
 */
export const MAX_TOOL_RESULT_CHARS = 24_000;

export function boundToolResult(
  toolName: string,
  content: string,
  maxChars = MAX_TOOL_RESULT_CHARS,
): string {
  const limit = Number.isFinite(maxChars)
    ? Math.max(0, Math.floor(maxChars))
    : MAX_TOOL_RESULT_CHARS;

  if (content.length <= limit) return content;

  const notice =
    `\n\n[Tool "${toolName}" result truncated; showing the first ${limit} of ${content.length} characters.]`;

  return content.slice(0, limit) + notice;
}
