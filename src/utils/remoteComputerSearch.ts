/**
 * Self-contained paired-computer remote search client and result filter.
 *
 * Replaces `@offgrid/rag` root exports so OGAM has no external shared workspace dependency
 * while keeping full protocol parity with desktop `/v1/search`.
 */

export interface RemoteSearchResult {
  id: string;
  title: string;
  snippet: string;
  kind: string;
  source: string;
  timestamp: string;
  deepLinkId: string;
}

export type RemoteSearchOutcome =
  | { status: 'ok'; results: RemoteSearchResult[] }
  | { status: 'unreachable' }
  | { status: 'unauthorized' }
  | { status: 'pro-required' }
  | { status: 'unsupported' }
  | { status: 'failed'; message: string };

export interface SearchRemoteComputerOptions {
  endpoint: string;
  query: string;
  limit?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  fetch?: typeof globalThis.fetch;
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return (error as { name?: unknown }).name === 'AbortError';
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, '');
}

function toSearchResult(item: unknown, index: number): RemoteSearchResult | null {
  if (!item || typeof item !== 'object') return null;
  const record = item as Record<string, unknown>;
  const id = typeof record.id === 'string' && record.id ? record.id : `remote-${index}`;
  const title = typeof record.title === 'string' ? record.title : '';
  const snippet = typeof record.snippet === 'string' ? record.snippet : '';
  const kind = typeof record.kind === 'string' ? record.kind : 'document';
  const source = typeof record.source === 'string' ? record.source : '';
  const timestamp =
    typeof record.timestamp === 'string' || typeof record.timestamp === 'number'
      ? String(record.timestamp)
      : '';
  const deepLinkId = typeof record.deepLinkId === 'string' ? record.deepLinkId : '';
  if (!title && !snippet) return null;
  return {
    id,
    title,
    snippet,
    kind,
    source,
    timestamp,
    deepLinkId,
  };
}

/**
 * Filter out computer chat matches that are already displayed in the phone's own search results.
 */
export function withoutChatsOnDevice(
  results: readonly RemoteSearchResult[],
  chatsListed: Iterable<string> | ReadonlySet<string>,
): RemoteSearchResult[] {
  const listed = chatsListed instanceof Set ? chatsListed : new Set(chatsListed);
  return results.filter((result) => !(result.kind === 'chat' && result.deepLinkId && listed.has(result.deepLinkId)));
}

/**
 * Query a paired desktop's `/v1/search` endpoint and classify network, auth, Pro, or API states.
 * Rethrows `AbortError` when canceled by a newer search.
 */
export async function searchRemoteComputer(
  options: SearchRemoteComputerOptions,
): Promise<RemoteSearchOutcome> {
  const query = options.query.trim();
  if (!query) return { status: 'ok', results: [] };
  if (options.signal?.aborted) {
    const abortError = new Error('The operation was aborted.');
    abortError.name = 'AbortError';
    throw abortError;
  }

  const baseUrl = normalizeEndpoint(options.endpoint);
  if (!baseUrl) {
    return { status: 'unreachable' };
  }

  const fetchImpl = options.fetch ?? globalThis.fetch;
  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}/v1/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
      body: JSON.stringify({
        query,
        limit: options.limit ?? 20,
      }),
      signal: options.signal,
    });
  } catch (error) {
    if (options.signal?.aborted || isAbortError(error)) {
      throw error;
    }
    return { status: 'unreachable' };
  }

  if (response.status === 401 || response.status === 403) {
    return { status: 'unauthorized' };
  }
  if (response.status === 402) {
    return { status: 'pro-required' };
  }
  if (response.status === 404 || response.status === 405 || response.status === 501) {
    return { status: 'unsupported' };
  }
  if (!response.ok) {
    let message = `Remote search failed (HTTP ${response.status})`;
    try {
      const payload = (await response.json()) as { error?: { message?: unknown } | unknown; message?: unknown };
      if (payload?.error && typeof payload.error === 'object' && typeof (payload.error as { message?: unknown }).message === 'string') {
        message = (payload.error as { message: string }).message;
      } else if (typeof payload?.error === 'string' && payload.error) {
        message = payload.error;
      } else if (typeof payload?.message === 'string' && payload.message) {
        message = payload.message;
      }
    } catch {
      /* keep HTTP fallback message */
    }
    return { status: 'failed', message };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    return {
      status: 'failed',
      message: error instanceof Error ? error.message : 'Invalid JSON response from paired computer',
    };
  }

  const rawItems =
    payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)
      ? (payload as { data: unknown[] }).data
      : payload && typeof payload === 'object' && Array.isArray((payload as { results?: unknown }).results)
        ? (payload as { results: unknown[] }).results
        : [];

  const results: RemoteSearchResult[] = [];
  rawItems.forEach((item, index) => {
    const normalized = toSearchResult(item, index);
    if (normalized) results.push(normalized);
  });
  return { status: 'ok', results };
}
