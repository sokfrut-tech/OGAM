/**
 * OGAM-owned markdown preprocessing and safe external link guard.
 *
 * Replaces `@offgrid/sync` `preprocessChatMarkdown` and `safeChatExternalUrl`
 * without pulling any sync or networking runtime dependencies.
 */

const ASCII_CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]/;

/**
 * Escape asterisks used as multiplication operators (`digit*digit`) so
 * markdown-it does not treat them as emphasis markers.
 * Lookahead handles chains like `5*5*5*5` in a single pass.
 */
export function preprocessChatMarkdown(text: string): string {
  return text.replace(/(\d)\*(?=\d)/g, String.raw`$1\*`);
}

/**
 * Allows only explicit HTTP(S) URLs with a non-empty host, returning the
 * trimmed input URL verbatim or `null` for unsafe schemes/malformed strings.
 */
export function safeChatExternalUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed || ASCII_CONTROL_CHARS_RE.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (!parsed.hostname) return null;
    return trimmed;
  } catch {
    return null;
  }
}
