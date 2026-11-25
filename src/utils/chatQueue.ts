/**
 * OGAM-owned pure message queue state helpers for `generationService` and `Toolbar`.
 *
 * Replaces `@offgrid/sync`'s queue hold and batch-selection exports without any
 * networking or synchronization runtime dependency.
 */

export type ChatQueueHold = 'stop' | 'failure' | undefined;
export type ChatQueueSignal = 'done' | 'stop' | 'failure' | 'resume';

export interface ChatQueueEntry {
  readonly id: string;
  readonly conversationId: string;
  readonly now?: boolean;
}

/** Computes the next queue hold state after a turn completes, stops, fails, or resumes. */
export function chatQueueHoldAfter(signal: ChatQueueSignal): ChatQueueHold {
  if (signal === 'stop') return 'stop';
  if (signal === 'failure') return 'failure';
  return undefined;
}

/**
 * Returns true when queue draining is paused, unless an explicit `send now`
 * item preempts the hold to run immediately.
 */
export function chatQueueHeld(
  hold: ChatQueueHold,
  queue: readonly { readonly now?: boolean }[],
): boolean {
  return Boolean(hold) && !queue.some((item) => Boolean(item.now));
}

/** Returns a new queue with item `id` flagged to bypass holds and send immediately. */
export function markQueuedSendNow<T extends { readonly id: string; readonly now?: boolean }>(
  queue: readonly T[],
  id: string,
): T[] {
  return queue.map((item) => (item.id === id ? { ...item, now: true } : item));
}

/**
 * Selects the next turn batch from the queue:
 * - Any item marked `now` runs first on its own.
 * - Otherwise consecutive/matching entries for the head item's conversation batch together.
 */
export function takeNextQueued<T extends ChatQueueEntry>(
  queue: readonly T[],
): { batch: T[]; rest: T[] } {
  if (queue.length === 0) return { batch: [], rest: [] };

  const nowItem = queue.find((item) => Boolean(item.now));
  if (nowItem) {
    return {
      batch: [nowItem],
      rest: queue.filter((item) => item !== nowItem),
    };
  }

  const headConversationId = queue[0].conversationId;
  const batch: T[] = [];
  const rest: T[] = [];
  for (const item of queue) {
    if (item.conversationId === headConversationId) batch.push(item);
    else rest.push(item);
  }
  return { batch, rest };
}
