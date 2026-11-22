import assert from 'node:assert/strict';
import test from 'node:test';
import { searchRemoteComputer, withoutChatsOnDevice } from '../../src/utils/remoteComputerSearch.ts';

test('searchRemoteComputer short-circuits blank queries and trims trailing slashes on POST /v1/search', async () => {
  let called = 0;
  const blankOutcome = await searchRemoteComputer({
    endpoint: 'http://192.168.1.20:8080/',
    query: '   ',
    fetch: async () => {
      called++;
      return new Response('{}', { status: 200 });
    },
  });
  assert.deepEqual(blankOutcome, { status: 'ok', results: [] });
  assert.equal(called, 0);

  let capturedUrl = '';
  let capturedAuth = '';
  let capturedBody = '';
  const okOutcome = await searchRemoteComputer({
    endpoint: 'http://192.168.1.20:8080///',
    query: 'jarvis breeno',
    limit: 5,
    headers: { Authorization: 'Bearer secret-key' },
    fetch: async (url, init) => {
      capturedUrl = String(url);
      capturedAuth = String(init?.headers?.Authorization ?? '');
      capturedBody = String(init?.body ?? '');
      return new Response(
        JSON.stringify({
          object: 'list',
          data: [
            {
              id: 'r1',
              title: 'Meeting Notes',
              snippet: 'Discussed Breeno integration',
              kind: 'chat',
              source: 'Desktop',
              timestamp: '2026-11-22T12:00:00.000Z',
              deepLinkId: 'chat-42',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    },
  });

  assert.equal(capturedUrl, 'http://192.168.1.20:8080/v1/search');
  assert.equal(capturedAuth, 'Bearer secret-key');
  assert.deepEqual(JSON.parse(capturedBody), { query: 'jarvis breeno', limit: 5 });
  assert.equal(okOutcome.status, 'ok');
  if (okOutcome.status === 'ok') {
    assert.equal(okOutcome.results.length, 1);
    assert.equal(okOutcome.results[0].deepLinkId, 'chat-42');
  }
});

test('searchRemoteComputer maps HTTP status and network failures accurately', async () => {
  const cases = [
    [401, 'unauthorized'],
    [403, 'unauthorized'],
    [402, 'pro-required'],
    [404, 'unsupported'],
    [501, 'unsupported'],
  ];

  for (const [status, expected] of cases) {
    const outcome = await searchRemoteComputer({
      endpoint: 'http://desktop.local:8080',
      query: 'notes',
      fetch: async () => new Response('err', { status }),
    });
    assert.equal(outcome.status, expected);
  }

  const serverError = await searchRemoteComputer({
    endpoint: 'http://desktop.local:8080',
    query: 'notes',
    fetch: async () => new Response(JSON.stringify({ error: { message: 'Index busy' } }), { status: 503 }),
  });
  assert.deepEqual(serverError, { status: 'failed', message: 'Index busy' });

  const unreachable = await searchRemoteComputer({
    endpoint: 'http://desktop.local:8080',
    query: 'notes',
    fetch: async () => {
      throw new TypeError('Network request failed');
    },
  });
  assert.deepEqual(unreachable, { status: 'unreachable' });
});

test('searchRemoteComputer rethrows AbortError when canceled', async () => {
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    () =>
      searchRemoteComputer({
        endpoint: 'http://desktop.local:8080',
        query: 'notes',
        signal: controller.signal,
      }),
    (error) => error?.name === 'AbortError',
  );
});

test('withoutChatsOnDevice filters only chat matches already listed on device', () => {
  const remote = [
    {
      id: '1',
      title: 'Already Shown Chat',
      snippet: 'text',
      kind: 'chat',
      source: 'Mac',
      timestamp: '2026-11-22T00:00:00Z',
      deepLinkId: 'chat-1',
    },
    {
      id: '2',
      title: 'Note With Same ID',
      snippet: 'doc text',
      kind: 'document',
      source: 'Mac',
      timestamp: '2026-11-22T00:00:00Z',
      deepLinkId: 'chat-1',
    },
    {
      id: '3',
      title: 'Desktop Only Chat',
      snippet: 'other text',
      kind: 'chat',
      source: 'Mac',
      timestamp: '2026-11-22T00:00:00Z',
      deepLinkId: 'chat-2',
    },
  ];

  const filtered = withoutChatsOnDevice(remote, new Set(['chat-1']));
  assert.deepEqual(
    filtered.map((item) => item.id),
    ['2', '3'],
  );
});
