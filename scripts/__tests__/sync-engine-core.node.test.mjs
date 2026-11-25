import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  LengthPrefixedFrameDecoder,
  MultiTransportBridge,
  RnTcpTransport,
  SyncEngine,
  chacha20Poly1305Open,
  chacha20Poly1305Seal,
  encodeLengthPrefixedFrame,
  generateX25519KeyPair,
  x25519,
  x25519PublicKey,
} from '../../src/utils/syncEngineCore.ts';
import { PAIRING_CODE_ALPHABET, PAIRING_CODE_LENGTH } from '../../src/utils/syncDiscoveryCore.ts';
import { buildReport } from '../audit-offgrid-imports.mjs';

function makeFakeTcp() {
  const servers = new Map();
  const capturedWireChunks = [];
  let nextPort = 41000;

  class FakeSocket {
    constructor() {
      this.peer = null;
      this.remoteAddress = '127.0.0.1';
      this.handlers = new Map();
      this.closed = false;
    }
    on(ev, cb) {
      const arr = this.handlers.get(ev) ?? [];
      arr.push(cb);
      this.handlers.set(ev, arr);
      return this;
    }
    emit(ev, ...args) {
      for (const cb of this.handlers.get(ev) ?? []) cb(...args);
    }
    write(data) {
      if (this.closed) return false;
      const b64 = Buffer.from(data).toString('base64');
      capturedWireChunks.push(Buffer.from(data));
      // Mirror Android react-native-tcp-socket base64-string data delivery
      setImmediate(() => this.peer?.emit('data', b64));
      return true;
    }
    destroy() {
      if (this.closed) return;
      this.closed = true;
      const peer = this.peer;
      setImmediate(() => this.emit('close'));
      if (peer && !peer.closed) {
        peer.closed = true;
        setImmediate(() => peer.emit('close'));
      }
    }
  }

  return {
    capturedWireChunks,
    createServer(onConnection) {
      let boundPort = 0;
      const srv = {
        on() {
          return srv;
        },
        listen(opts, cb) {
          boundPort = opts.port && opts.port > 0 ? opts.port : nextPort++;
          servers.set(boundPort, onConnection);
          cb?.();
          return srv;
        },
        address() {
          return { port: boundPort };
        },
        close() {
          servers.delete(boundPort);
        },
      };
      return srv;
    },
    createConnection(opts, cb) {
      const client = new FakeSocket();
      const server = new FakeSocket();
      client.peer = server;
      server.peer = client;
      const onConn = servers.get(opts.port);
      if (!onConn) throw new Error(`no server on port ${opts.port}`);
      setImmediate(() => {
        onConn(server);
        cb?.();
      });
      return client;
    },
  };
}

const byteCodec = {
  fromBytes: bytes => Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength),
  toBytes: data =>
    typeof data === 'string'
      ? new Uint8Array(Buffer.from(data, 'base64'))
      : data instanceof Uint8Array
        ? data
        : new Uint8Array(0),
};

const dev = (id, port = 0) => ({
  id,
  name: id,
  platform: 'android',
  version: '1',
  host: '127.0.0.1',
  port,
});

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

test('X25519 matches RFC 7748 Section 6.1 vectors and agrees across random key pairs', () => {
  const alicePriv = Buffer.from(
    '77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a',
    'hex',
  );
  const bobPriv = Buffer.from(
    '5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb',
    'hex',
  );

  assert.equal(
    Buffer.from(x25519PublicKey(alicePriv)).toString('hex'),
    '8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a',
  );
  assert.equal(
    Buffer.from(x25519PublicKey(bobPriv)).toString('hex'),
    'de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f',
  );

  const sharedAB = x25519(alicePriv, x25519PublicKey(bobPriv));
  const sharedBA = x25519(bobPriv, x25519PublicKey(alicePriv));
  assert.deepEqual(sharedAB, sharedBA);
  assert.equal(
    Buffer.from(sharedAB).toString('hex'),
    '4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742',
  );

  const kp1 = generateX25519KeyPair();
  const kp2 = generateX25519KeyPair();
  assert.deepEqual(x25519(kp1.privateKey, kp2.publicKey), x25519(kp2.privateKey, kp1.publicKey));
});

test('ChaCha20-Poly1305 matches RFC 8439 Section 2.8.2 vector, node:crypto, and rejects tampering', () => {
  const key = Buffer.from('808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f', 'hex');
  const nonce = Buffer.from('070000004041424344454647', 'hex');
  const aad = Buffer.from('50515253c0c1c2c3c4c5c6c7', 'hex');
  const plaintext = Buffer.from(
    "Ladies and Gentlemen of the class of '99: If I could offer you only one tip for the future, sunscreen would be it.",
    'utf8',
  );

  const sealed = chacha20Poly1305Seal(key, nonce, plaintext, aad);
  const cipher = crypto.createCipheriv('chacha20-poly1305', key, nonce, { authTagLength: 16 });
  cipher.setAAD(aad);
  const nodeSealed = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);

  assert.deepEqual(Buffer.from(sealed), nodeSealed);
  assert.equal(
    Buffer.from(sealed.subarray(sealed.length - 16)).toString('hex'),
    '1ae10b594f09e26a7e902ecbd0600691',
  );

  const opened = chacha20Poly1305Open(key, nonce, sealed, aad);
  assert.deepEqual(Buffer.from(opened), plaintext);

  const badCt = sealed.slice();
  badCt[0] ^= 0xff;
  assert.equal(chacha20Poly1305Open(key, nonce, badCt, aad), null);

  const badTag = sealed.slice();
  badTag[badTag.length - 1] ^= 0x01;
  assert.equal(chacha20Poly1305Open(key, nonce, badTag, aad), null);

  const badAad = aad.slice();
  badAad[0] ^= 0x01;
  assert.equal(chacha20Poly1305Open(key, nonce, sealed, badAad), null);
});

test('LengthPrefixedFrameDecoder handles split chunks and coalesced multi-frame payloads', () => {
  const f1 = encodeLengthPrefixedFrame(Buffer.from('hello'));
  const f2 = encodeLengthPrefixedFrame(Buffer.from('world!'));
  const combined = Buffer.concat([f1, f2]);

  const decoder = new LengthPrefixedFrameDecoder();
  const out = [];
  for (let i = 0; i < combined.length; i += 2) {
    out.push(...decoder.push(combined.subarray(i, i + 2)));
  }
  assert.deepEqual(
    out.map(x => Buffer.from(x).toString('utf8')),
    ['hello', 'world!'],
  );
});

test('SyncEngine + MultiTransportBridge + RnTcpTransport pair with X25519, send encrypted frames, reconnect, and forget', async () => {
  const tcp = makeFakeTcp();
  const code = PAIRING_CODE_ALPHABET.slice(0, PAIRING_CODE_LENGTH);
  const wrongCode = PAIRING_CODE_ALPHABET.slice(-PAIRING_CODE_LENGTH);

  let aPaired = null;
  let bPaired = null;
  const receivedApps = [];
  const secretsOnA = new Map();
  let aRevoked = false;

  const makeLicensedAdapter = initiallyLicensed => {
    let licensed = initiallyLicensed;
    return {
      async inspect() {
        return licensed
          ? { status: 'licensed', entitlementId: 'lic-1' }
          : { status: 'unlicensed' };
      },
      async prepareExport() {
        return {
          id: 'exp-1',
          credential: {
            version: 1,
            entitlementId: 'lic-1',
            secret: 's',
            expiresAt: null,
            maxDevices: 5,
            verifiedAt: 0,
          },
        };
      },
      async commitExport() {},
      async rollbackExport() {},
      async finalizeExport() {},
      async prepareImport() {
        return { id: 'imp-1' };
      },
      async commitImport() {
        licensed = true;
      },
      async rollbackImport() {},
      async finalizeImport() {},
    };
  };

  const bridgeA = new MultiTransportBridge({
    routes: [
      { id: 'lan', bridge: new RnTcpTransport(tcp, byteCodec), required: true },
    ],
  });
  const engineA = new SyncEngine({
    localDevice: dev('dev-a'),
    transport: bridgeA,
    getPassphrase: () => code,
    getSharedSecret: id => secretsOnA.get(id),
    pairingEntitlement: makeLicensedAdapter(true),
    onPaired: d => {
      aPaired = d;
      secretsOnA.set(d.id, d.sharedSecret);
    },
    onAppMessage: (id, channel, data) => receivedApps.push({ id, channel, data }),
    onMembershipRevoked: () => {
      aRevoked = true;
    },
  });

  const bridgeB = new MultiTransportBridge({
    routes: [
      { id: 'lan', bridge: new RnTcpTransport(tcp, byteCodec), required: true },
    ],
  });
  const engineB = new SyncEngine({
    localDevice: dev('dev-b'),
    transport: bridgeB,
    pairingEntitlement: makeLicensedAdapter(false),
    onPaired: d => {
      bPaired = d;
    },
  });

  await Promise.all([engineA.start(0), engineB.start(0)]);
  const portA = bridgeA.boundPort;
  assert.ok(portA > 0);

  // Wrong code must fail cleanly without pairing
  await assert.rejects(() => engineB.pair(dev('dev-a', portA), wrongCode), /invalid_pairing_code/);
  assert.equal(engineA.isPaired('dev-b'), false);
  assert.equal(engineB.isPaired('dev-a'), false);

  // Valid code completes X25519 + ChaCha20-Poly1305 pairing
  const pairedOnB = await engineB.pair(dev('dev-a', portA), code);
  await delay(50);

  assert.equal(aPaired?.id, 'dev-b');
  assert.equal(bPaired?.id, 'dev-a');
  assert.equal(pairedOnB.id, 'dev-a');
  assert.equal(aPaired.sharedSecret, bPaired.sharedSecret);

  const wireCountBeforeSend = tcp.capturedWireChunks.length;
  assert.equal(engineB.sendApp('dev-a', 'state', { hello: 'world', n: 42 }), true);
  await delay(50);

  assert.deepEqual(receivedApps, [
    { id: 'dev-b', channel: 'state', data: { hello: 'world', n: 42 } },
  ]);
  const postSendWire = Buffer.concat(tcp.capturedWireChunks.slice(wireCountBeforeSend)).toString('utf8');
  assert.equal(postSendWire.includes('world'), false, 'Application payload must not appear in plaintext on wire');

  // Disconnect then reconnect with derived sharedSecret
  assert.equal(engineB.disconnect('dev-a'), true);
  await delay(30);
  assert.equal(engineB.isPaired('dev-a'), false);

  await engineB.reconnect(dev('dev-a', portA), bPaired.sharedSecret);
  assert.equal(engineB.sendApp('dev-a', 'state', { resumed: true }), true);
  await delay(50);
  assert.equal(receivedApps.length, 2);
  assert.deepEqual(receivedApps[1].data, { resumed: true });

  // Forget revokes session
  const snap = await engineB.forget('dev-a', bPaired.membershipId);
  assert.equal(snap?.state, 'completed');
  await delay(40);
  assert.equal(aRevoked, true);
  assert.equal(engineB.isPaired('dev-a'), false);

  await Promise.all([engineA.stop(), engineB.stop()]);

  // Unlicensed mutual pairing must fail with entitlement_unavailable
  const unlicA = new SyncEngine({
    localDevice: dev('u-a'),
    transport: new RnTcpTransport(tcp, byteCodec),
    getPassphrase: () => code,
    pairingEntitlement: makeLicensedAdapter(false),
  });
  const unlicBridgeB = new RnTcpTransport(tcp, byteCodec);
  const unlicB = new SyncEngine({
    localDevice: dev('u-b'),
    transport: unlicBridgeB,
    pairingEntitlement: makeLicensedAdapter(false),
  });
  await Promise.all([unlicA.start(0), unlicB.start(0)]);
  const uPort = unlicA['options'].transport.boundPort;
  await assert.rejects(() => unlicB.pair(dev('u-a', uPort), code), /entitlement_unavailable/);
  await Promise.all([unlicA.stop(), unlicB.stop()]);
});

test('Slice 13 audit confirms zero localFileDependencies, zero @offgrid/* in source, and zero ../shared in Metro/Jest', () => {
  const report = buildReport();
  assert.equal(report.localFileDependencies.length, 0);

  const sharedPkgs = [
    '@offgrid/design',
    '@offgrid/models',
    '@offgrid/notes',
    '@offgrid/notes-editor',
    '@offgrid/rag',
    '@offgrid/speech',
    '@offgrid/sync',
    '@offgrid/ui',
    '@offgrid/writing',
    '@offgrid/automation',
  ];
  for (const pkg of sharedPkgs) {
    assert.equal(
      report.packageImportCountsByScope?.source?.[pkg] ?? 0,
      0,
      `Expected 0 source hits for ${pkg}`,
    );
  }

  const root = path.resolve(import.meta.dirname, '..', '..');
  const metro = fs.readFileSync(path.join(root, 'metro.config.js'), 'utf8');
  const jestCfg = fs.readFileSync(path.join(root, 'jest.config.js'), 'utf8');
  assert.equal(metro.includes('../shared'), false, 'metro.config.js still references ../shared');
  assert.equal(jestCfg.includes('../shared'), false, 'jest.config.js still references ../shared');
});
