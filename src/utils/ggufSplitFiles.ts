/**
 * Return the complete, ordered filename set for a standard llama.cpp split GGUF.
 *
 * GGUF shard names use a five-digit, one-based index:
 *   model-00001-of-00003.gguf
 *   model-00002-of-00003.gguf
 *   model-00003-of-00003.gguf
 *
 * A single-file or non-standard filename is returned unchanged. Invalid shard
 * indices are not expanded: callers must not infer sibling files from malformed
 * names. This helper only interprets names; GGUF metadata and file integrity
 * remain the native loader's responsibility.
 */
export function splitGgufPartNames(fileName: string): string[] {
  const match = /^(.*-)(\d{5})-of-(\d{5})(\.gguf)$/i.exec(fileName);
  if (!match) return [fileName];

  const [, prefix, partText, totalText, extension] = match;
  const part = Number(partText);
  const total = Number(totalText);
  if (!Number.isSafeInteger(part) || !Number.isSafeInteger(total)) return [fileName];
  if (total <= 1 || part < 1 || part > total) return [fileName];

  return Array.from({ length: total }, (_, index) =>
    `${prefix}${String(index + 1).padStart(5, '0')}-of-${totalText}${extension}`,
  );
}
