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

/**
 * Collapses split GGUF shard entries (`model-00001-of-00003.gguf`, etc.) into a single logical entry
 * represented by its first shard with summed byte `size` and an ordered `parts` array.
 */
export function collapseSplitGgufParts<T extends { name: string; size: number }>(
  files: readonly T[],
): Array<T & { parts?: T[] }> {
  const shardRegex = /^(.*-)(\d{5})-of-(\d{5})(\.gguf)$/i;
  const groups = new Map<string, Array<{ part: number; item: T }>>();
  const outputOrder: Array<{ kind: 'single'; item: T } | { kind: 'group'; key: string }> = [];

  for (const item of files) {
    const match = shardRegex.exec(item.name);
    if (!match) {
      outputOrder.push({ kind: 'single', item });
      continue;
    }

    const part = Number(match[2]);
    const total = Number(match[3]);
    if (!Number.isSafeInteger(part) || !Number.isSafeInteger(total) || total <= 1 || part < 1 || part > total) {
      outputOrder.push({ kind: 'single', item });
      continue;
    }

    const key = `${match[1].toLowerCase()}::${total}::${match[4].toLowerCase()}`;
    let group = groups.get(key);
    if (!group) {
      group = [];
      groups.set(key, group);
      outputOrder.push({ kind: 'group', key });
    }
    group.push({ part, item });
  }

  return outputOrder.map(entry => {
    if (entry.kind === 'single') {
      return { ...entry.item };
    }
    const ordered = [...groups.get(entry.key)!]
      .sort((a, b) => a.part - b.part)
      .map(member => member.item);
    const totalSize = ordered.reduce((sum, part) => sum + (Number.isFinite(part.size) ? part.size : 0), 0);
    return {
      ...ordered[0],
      size: totalSize,
      parts: ordered,
    };
  });
}
