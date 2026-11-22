/**
 * OGAM-owned pure branched conversation thread & version tree helpers.
 *
 * Replaces `@offgrid/sync` `chatThread`, `appendPlace`, `neighbourVersion`, and
 * `parentOfVersion` for `src/utils/chatThread.ts` and `src/stores/chatStore.ts`.
 */

/** Sentinel parent assigned to root turns once a conversation starts branching. */
export const CHAT_THREAD_ROOT = '__root__';

export interface ChatThreadRow<T = unknown> {
  readonly uuid: string;
  readonly parent?: string;
  readonly selectedAt?: number;
  readonly message: T;
}

export interface ChatThreadVersionInfo {
  readonly index: number;
  readonly count: number;
}

export interface ChatThreadResult<T = unknown> {
  readonly messages: ChatThreadRow<T>[];
  readonly versions: Map<string, ChatThreadVersionInfo>;
}

interface ThreadIndex<T> {
  readonly parentByUuid: Map<string, string>;
  readonly childrenByParent: Map<string, ChatThreadRow<T>[]>;
}

function buildThreadIndex<T>(rows: readonly ChatThreadRow<T>[]): ThreadIndex<T> {
  const parentByUuid = new Map<string, string>();
  const childrenByParent = new Map<string, ChatThreadRow<T>[]>();
  let prevLinearUuid: string | null = null;

  for (const row of rows) {
    const effectiveParent = row.parent ?? prevLinearUuid ?? CHAT_THREAD_ROOT;
    if (row.parent === undefined) {
      prevLinearUuid = row.uuid;
    }
    parentByUuid.set(row.uuid, effectiveParent);
    const siblings = childrenByParent.get(effectiveParent);
    if (siblings) siblings.push(row);
    else childrenByParent.set(effectiveParent, [row]);
  }

  return { parentByUuid, childrenByParent };
}

function pickSelectedSibling<T>(siblings: readonly ChatThreadRow<T>[]): number {
  if (siblings.length <= 1) return 0;
  let bestIndex = -1;
  let bestSelectedAt = -Infinity;
  for (let i = 0; i < siblings.length; i += 1) {
    const selectedAt = siblings[i].selectedAt;
    if (selectedAt !== undefined && selectedAt >= bestSelectedAt) {
      bestSelectedAt = selectedAt;
      bestIndex = i;
    }
  }
  return bestIndex >= 0 ? bestIndex : siblings.length - 1;
}

/**
 * Walks the active chosen path through the conversation tree starting from root,
 * recording 0-based version info whenever a step has multiple sibling versions.
 */
export function chatThread<T>(rows: readonly ChatThreadRow<T>[]): ChatThreadResult<T> {
  const { childrenByParent } = buildThreadIndex(rows);
  const messages: ChatThreadRow<T>[] = [];
  const versions = new Map<string, ChatThreadVersionInfo>();
  const visited = new Set<string>();

  let currentParent = CHAT_THREAD_ROOT;
  while (true) {
    const siblings = childrenByParent.get(currentParent);
    if (!siblings || siblings.length === 0) break;

    const chosenIndex = pickSelectedSibling(siblings);
    const chosen = siblings[chosenIndex];
    if (visited.has(chosen.uuid)) break;
    visited.add(chosen.uuid);

    if (siblings.length > 1) {
      versions.set(chosen.uuid, { index: chosenIndex, count: siblings.length });
    }
    messages.push(chosen);
    currentParent = chosen.uuid;
  }

  return { messages, versions };
}

/**
 * Returns `{}` for linear (unbranched) chats, or `{ parent }` pointing at the tail
 * of the currently active branch once the conversation has branched.
 */
export function appendPlace<T>(rows: readonly ChatThreadRow<T>[]): { parent?: string } {
  if (rows.length === 0 || !rows.some((row) => row.parent !== undefined)) {
    return {};
  }
  const thread = chatThread(rows);
  const tail = thread.messages[thread.messages.length - 1];
  return tail ? { parent: tail.uuid } : { parent: CHAT_THREAD_ROOT };
}

/** Returns the effective parent identifier for `uuid` (truthy `CHAT_THREAD_ROOT` for roots). */
export function parentOfVersion<T>(
  rows: readonly ChatThreadRow<T>[],
  uuid: string,
): string | undefined {
  return buildThreadIndex(rows).parentByUuid.get(uuid);
}

/** Returns the sibling version `direction` steps away from `uuid` under the same parent. */
export function neighbourVersion<T>(
  rows: readonly ChatThreadRow<T>[],
  uuid: string,
  direction: number,
): string | undefined {
  const index = buildThreadIndex(rows);
  const parent = index.parentByUuid.get(uuid);
  if (parent === undefined) return undefined;
  const siblings = index.childrenByParent.get(parent);
  if (!siblings) return undefined;
  const pos = siblings.findIndex((row) => row.uuid === uuid);
  if (pos < 0) return undefined;
  return siblings[pos + direction]?.uuid;
}
