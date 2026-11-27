import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import {
  BLOB_FRAME_BYTES,
  BLOB_TOKEN_TTL_MS,
  CHUNK_SIZE,
  IncrementalChecksum,
  blobKeyBase64,
  checksumFromSha512Hex,
  createBlobMaterial,
  hkdfSha256,
} from '../../src/utils/syncChecksumCore.ts';
import { buildReport } from '../audit-offgrid-imports.mjs';

function nativeTransferChecksum(bytes) {
  const hex = crypto.createHash('sha512').update(bytes).digest('hex');
  return checksumFromSha512Hex(hex);
}

test('transfer chunk size, blob frame size, and TTL match mobile/native wire constants', () => {
  assert.equal(CHUNK_SIZE, 262_144);
  assert.equal(BLOB_FRAME_BYTES, 4 * 1024 * 1024);
  assert.equal(BLOB_TOKEN_TTL_MS, 5 * 60 * 1000);
});

test('IncrementalChecksum matches node:crypto SHA-512 on FIPS 180-4 vectors and block boundaries', () => {
  const emptyHasher = new IncrementalChecksum();
  const expectedEmptyHex = crypto.createHash('sha512').digest('hex');
  assert.equal(emptyHasher.digestHex(), expectedEmptyHex);
  assert.equal(emptyHasher.digest(), checksumFromSha512Hex(expectedEmptyHex));
  // Calling digest() twice must remain idempotent
  assert.equal(emptyHasher.digest(), checksumFromSha512Hex(expectedEmptyHex));

  const abcHasher = new IncrementalChecksum();
  abcHasher.update(Buffer.from('abc', 'utf8'));
  assert.equal(
    abcHasher.digestHex(),
    'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
  );

  const nist112 =
    'abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu';
  const nistHasher = new IncrementalChecksum();
  nistHasher.update(Buffer.from(nist112, 'utf8'));
  assert.equal(
    nistHasher.digestHex(),
    '8e959b75dae313da8cf4f72814fc143f8f7779c6eb9f7fa17299aeadb6889018501d289e4900f7e4331b99dec4b5433ac7d329eeb6dd26545e96e55b874be909',
  );

  for (const len of [111, 112, 113, 127, 128, 129, 255, 256, 257]) {
    const sample = Uint8Array.from({ length: len }, (_, i) => (i * 17 + 3) & 0xff);
    const hasher = new IncrementalChecksum();
    // Feed in uneven pieces across block boundaries
    hasher.update(sample.subarray(0, 17));
    hasher.update(sample.subarray(17));
    const expected = crypto.createHash('sha512').update(sample).digest('hex');
    assert.equal(hasher.digestHex(), expected, `length=${len}`);
  }
});

test('IncrementalChecksum matches native SHA-512 across multi-chunk transfer sizes and detects chunk-2 flips', () => {
  for (const size of [64, CHUNK_SIZE - 1, CHUNK_SIZE, CHUNK_SIZE + 1, CHUNK_SIZE * 2 + 7]) {
    const buf = Uint8Array.from({ length: size }, (_, i) => (i * 31 + 7) & 0xff);
    const hasher = new IncrementalChecksum();
    for (let offset = 0; offset < buf.length; offset += CHUNK_SIZE) {
      hasher.update(buf.subarray(offset, offset + CHUNK_SIZE));
    }
    const actual = hasher.digest();
    const expected = nativeTransferChecksum(buf);
    assert.equal(actual, expected, `size=${size}`);
    assert.match(actual, /^[A-Za-z0-9+/]{22}==$/);
  }

  const first = new Uint8Array(CHUNK_SIZE + 10).fill(5);
  const second = first.slice();
  second[CHUNK_SIZE + 4] = 6;
  const h1 = new IncrementalChecksum().update(first).digest();
  const h2 = new IncrementalChecksum().update(second).digest();
  assert.notEqual(h1, h2);
});

test('hkdfSha256 matches RFC 5869 Test Case 1 and node:crypto hkdfSync', () => {
  const ikm = Uint8Array.from({ length: 22 }, () => 0x0b);
  const salt = Uint8Array.from({ length: 13 }, (_, i) => i);
  const info = Uint8Array.from({ length: 10 }, (_, i) => 0xf0 + i);
  const actual = hkdfSha256(ikm, salt, info, 42);
  const expected = new Uint8Array(crypto.hkdfSync('sha256', ikm, salt, info, 42));
  assert.deepEqual(actual, expected);
  assert.equal(
    Buffer.from(actual).toString('hex'),
    '3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865',
  );
});

test('blobKeyBase64 and createBlobMaterial produce valid 32-byte AES-GCM keys and fresh 12-byte nonces', () => {
  const k1 = blobKeyBase64('the-pairing-secret', 'transfer-1');
  const k1Repeat = blobKeyBase64('the-pairing-secret', 'transfer-1');
  const k2 = blobKeyBase64('the-pairing-secret', 'transfer-2');
  const k3 = blobKeyBase64('other-secret', 'transfer-1');

  assert.equal(k1, k1Repeat);
  assert.notEqual(k1, k2);
  assert.notEqual(k1, k3);
  assert.equal(Buffer.from(k1, 'base64').length, 32);

  const m1 = createBlobMaterial('the-pairing-secret', 'transfer-1');
  const m2 = createBlobMaterial('the-pairing-secret', 'transfer-1');
  assert.equal(m1.keyBase64, k1);
  assert.equal(Buffer.from(m1.keyBase64, 'base64').length, 32);
  assert.equal(Buffer.from(m1.nonceBase64, 'base64').length, 12);
  assert.ok(m1.token.length >= 32);
  assert.notEqual(m1.token, m2.token);
  assert.notEqual(m1.nonceBase64, m2.nonceBase64);
});

test('Slice 12 audit leaves @offgrid/sync source hits <= 9 (discovery, engine, bundle script only)', () => {
  const report = buildReport();
  const sourceCount = report.packageImportCountsByScope?.source?.['@offgrid/sync'] ?? -1;
  assert.ok(
    sourceCount >= 0 && sourceCount <= 9,
    `Expected 0..9 @offgrid/sync source hits after Slice 12, got ${sourceCount}`,
  );
  const syncSourceHits = (report.hits ?? []).filter(
    hit => hit.scope === 'source' && hit.package === '@offgrid/sync',
  );
  assert.equal(syncSourceHits.length, sourceCount);
  const allowedRemainingFiles = new Set([
    'src/services/sync/discovery.ts',
    'src/services/sync/engine.ts',
    'scripts/blob-e2e/bundle-desktop-host.sh',
  ]);
  for (const hit of syncSourceHits) {
    assert.ok(
      allowedRemainingFiles.has(hit.file),
      `Unexpected remaining @offgrid/sync source hit in ${hit.file}:${hit.line}`,
    );
  }
});
