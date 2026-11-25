import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CompositeDiscoveryService,
  DiscoveryOrchestrator,
  PAIRING_CODE_ALPHABET,
  PAIRING_CODE_LENGTH,
  RnDiscovery,
  createTxtRecord,
  isDialableAddress,
  normalizePairingCode,
  parseTxtRecord,
} from '../../src/utils/syncDiscoveryCore.ts';

function makeFakeZeroconf() {
  const listeners = new Map();
  return {
    published: undefined,
    scans: 0,
    stops: 0,
    on(event, listener) {
      listeners.set(event, listener);
    },
    scan() {
      this.scans += 1;
    },
    stop() {
      this.stops += 1;
    },
    removeDeviceListeners() {
      listeners.clear();
    },
    publishService(type, protocol, domain, name, port, txt) {
      this.published = { type, protocol, domain, name, port, txt };
    },
    unpublishService() {
      this.published = undefined;
    },
    emitResolved(svc) {
      listeners.get('resolved')?.(svc);
    },
    emitRemove(name) {
      listeners.get('remove')?.(name);
    },
  };
}

const local = {
  id: 'local-phone',
  name: 'Phone',
  platform: 'android',
  version: '1',
  host: '',
  port: 0,
};

const remote = {
  id: 'remote-laptop',
  name: 'Laptop',
  platform: 'macos',
  version: '1',
  host: '192.168.1.5',
  port: 7777,
};

function resolvedSvc(overrides = {}) {
  return {
    txt: createTxtRecord(remote),
    addresses: ['192.168.1.5'],
    host: 'laptop.local',
    port: 7777,
    name: `OffGrid-${remote.id}`,
    ...overrides,
  };
}

const flush = () => new Promise(resolve => setImmediate(resolve));

test('pairing code alphabet, length, normalization, and dialable address rules', () => {
  assert.equal(PAIRING_CODE_LENGTH, 8);
  assert.ok(PAIRING_CODE_ALPHABET.length >= 24);
  const code = PAIRING_CODE_ALPHABET.slice(0, PAIRING_CODE_LENGTH);
  const grouped = `${code.slice(0, 4)}-${code.slice(4)}`.toLowerCase();
  assert.equal(normalizePairingCode(grouped), code);
  assert.equal(normalizePairingCode('bad!'), null);
  assert.equal(normalizePairingCode('blue-otter-42'), null);

  assert.equal(isDialableAddress('192.168.1.50'), true);
  assert.equal(isDialableAddress('10.0.0.4'), true);
  assert.equal(isDialableAddress('100.84.2.9'), true);
  assert.equal(isDialableAddress('apples-macbook-pro-2'), true);

  assert.equal(isDialableAddress(''), false);
  assert.equal(isDialableAddress('localhost'), false);
  assert.equal(isDialableAddress('127.0.0.1'), false);
  assert.equal(isDialableAddress('0.0.0.0'), false);
  assert.equal(isDialableAddress('169.254.1.2'), false);
  assert.equal(isDialableAddress('224.0.0.1'), false);
  assert.equal(isDialableAddress('::1'), false);

  const txt = createTxtRecord(remote);
  assert.deepEqual(parseTxtRecord(txt), {
    id: 'remote-laptop',
    name: 'Laptop',
    platform: 'macos',
    version: '1',
    host: '192.168.1.5',
    port: 7777,
  });
});

test('DiscoveryOrchestrator surfaces new peers, auto-reconnects saved peers, and fires onLost', async () => {
  const z = makeFakeZeroconf();
  let surfaced = null;
  let lostId = null;

  const orch = new DiscoveryOrchestrator({
    discovery: new CompositeDiscoveryService({
      sources: [{ id: 'lan', service: new RnDiscovery(z), required: true }],
    }),
    localDevice: { ...local, port: 5555 },
    engine: { isPaired: () => false, reconnect: async () => {} },
    getSharedSecret: () => undefined,
    onDiscovered: d => {
      surfaced = d;
    },
    onLost: id => {
      lostId = id;
    },
  });

  await orch.start();
  assert.equal(z.published?.port, 5555);
  z.emitResolved(resolvedSvc());
  await flush();
  assert.equal(surfaced?.id, 'remote-laptop');
  assert.equal(surfaced?.host, '192.168.1.5');

  z.emitRemove(`OffGrid-${remote.id}._offgrid._tcp.local.`);
  await flush();
  assert.equal(lostId, 'remote-laptop');

  // Known device stays surfaced while reconnect runs
  const z2 = makeFakeZeroconf();
  let reconnected = null;
  let knownSurfaced = false;
  const orchKnown = new DiscoveryOrchestrator({
    discovery: new RnDiscovery(z2),
    localDevice: local,
    engine: {
      isPaired: () => false,
      reconnect: async (device, secret) => {
        reconnected = { device, secret };
      },
    },
    getSharedSecret: id => (id === 'remote-laptop' ? 'stored-secret' : undefined),
    onDiscovered: () => {
      knownSurfaced = true;
    },
  });
  await orchKnown.start();
  z2.emitResolved(resolvedSvc());
  await flush();
  assert.equal(knownSurfaced, true);
  assert.equal(reconnected?.device.id, 'remote-laptop');
  assert.equal(reconnected?.secret, 'stored-secret');
});

test('DiscoveryOrchestrator re-resolves before reporting reconnect failure and enforces Android dialability', async () => {
  const z = makeFakeZeroconf();
  const failures = [];
  const logs = [];
  const orch = new DiscoveryOrchestrator({
    discovery: new RnDiscovery(z, {
      allowHostname: false,
      log: msg => logs.push(msg),
    }),
    localDevice: local,
    engine: {
      isPaired: () => false,
      reconnect: async () => {
        throw new Error('connect ECONNREFUSED');
      },
    },
    getSharedSecret: () => 'stored-secret',
    onReconnectFailed: (device, err) => {
      failures.push({ name: device.name, message: err.message });
    },
  });

  await orch.start();
  z.emitResolved(resolvedSvc());
  await flush();
  assert.equal(failures.length, 0);

  z.emitResolved(resolvedSvc());
  await flush();
  assert.deepEqual(failures, [{ name: 'Laptop', message: 'connect ECONNREFUSED' }]);

  // Android must reject peers with no dialable IPv4 address (even with .local hostname)
  const surfaced = [];
  const zAndroid = makeFakeZeroconf();
  const androidLogs = [];
  const orchAndroid = new DiscoveryOrchestrator({
    discovery: new RnDiscovery(zAndroid, {
      allowHostname: false,
      log: msg => androidLogs.push(msg),
    }),
    localDevice: local,
    engine: { isPaired: () => false, reconnect: async () => {} },
    onDiscovered: d => surfaced.push(d.id),
  });
  await orchAndroid.start();
  zAndroid.emitResolved({
    ...resolvedSvc(),
    txt: createTxtRecord({ ...remote, host: '' }),
    addresses: [],
    host: 'laptop.local',
  });
  await flush();
  assert.deepEqual(surfaced, []);
  assert.ok(androidLogs.some(line => line.includes('no dialable address')));
});

test('CompositeDiscoveryService tolerates optional source failures when secondary source is active', async () => {
  const nearbyEvents = [];
  const sourceErrors = [];
  const composite = new CompositeDiscoveryService({
    sources: [
      {
        id: 'lan',
        required: false,
        service: {
          start: async () => {
            throw new Error('multicast blocked');
          },
          onDeviceFound: () => {},
          onDeviceLost: () => {},
          stop: async () => {},
          rescan: async () => {
            throw new Error('multicast blocked');
          },
        },
      },
      {
        id: 'proximity',
        required: false,
        service: {
          start: async () => {
            nearbyEvents.push('started');
          },
          onDeviceFound: () => {},
          onDeviceLost: () => {},
          stop: async () => {},
          rescan: async () => {
            nearbyEvents.push('rescanned');
          },
        },
      },
    ],
    onSourceError: (id, err) => sourceErrors.push({ id, msg: err.message }),
  });

  await composite.start();
  await composite.rescan();
  assert.deepEqual(nearbyEvents, ['started', 'rescanned']);
  assert.equal(sourceErrors.length, 2);
});
