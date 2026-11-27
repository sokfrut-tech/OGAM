/**
 * OGAM-owned pure ES2022 streaming SHA-512 transfer checksums and HKDF-SHA256 blob key material.
 *
 * Uses only portable ES2022 primitives (`Uint8Array`, `DataView`, `BigInt`, `TextEncoder`,
 * `globalThis.crypto.getRandomValues`) with zero Node-only APIs so both React Native Metro/Hermes
 * and Node 26 `--experimental-strip-types` execute identically.
 *
 * Replaces `@offgrid/sync` `CHUNK_SIZE`, `checksumFromSha512Hex`, `IncrementalChecksum`,
 * `BLOB_FRAME_BYTES`, `BLOB_TOKEN_TTL_MS`, `blobKeyBase64`, and `createBlobMaterial`.
 */

export const CHUNK_SIZE = 262_144; // 256 KiB
export const BLOB_FRAME_BYTES = 4 * 1024 * 1024; // 4 MiB framed AES-256-GCM chunks
export const BLOB_TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Upstream `off-grid-ai/shared` is unavailable (404). This HKDF domain string is OGAM-owned and
// self-consistent across all OGAM sender/receiver builds and native BlobFrameCipher adapters.
const BLOB_HKDF_SALT = 'offgrid-sync-blob-v1';
const BLOB_HKDF_INFO_PREFIX = 'offgrid-sync-blob-key-v1:';

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const HEX_DIGITS = '0123456789abcdef';
const UTF8 = new TextEncoder();
const U64_MASK = 0xffffffffffffffffn;

const SHA512_IV: readonly bigint[] = [
  0x6a09e667f3bcc908n,
  0xbb67ae8584caa73bn,
  0x3c6ef372fe94f82bn,
  0xa54ff53a5f1d36f1n,
  0x510e527fade682d1n,
  0x9b05688c2b3e6c1fn,
  0x1f83d9abfb41bd6bn,
  0x5be0cd19137e2179n,
];

const SHA512_K: readonly bigint[] = [
  0x428a2f98d728ae22n, 0x7137449123ef65cdn, 0xb5c0fbcfec4d3b2fn, 0xe9b5dba58189dbbcn,
  0x3956c25bf348b538n, 0x59f111f1b605d019n, 0x923f82a4af194f9bn, 0xab1c5ed5da6d8118n,
  0xd807aa98a3030242n, 0x12835b0145706fben, 0x243185be4ee4b28cn, 0x550c7dc3d5ffb4e2n,
  0x72be5d74f27b896fn, 0x80deb1fe3b1696b1n, 0x9bdc06a725c71235n, 0xc19bf174cf692694n,
  0xe49b69c19ef14ad2n, 0xefbe4786384f25e3n, 0x0fc19dc68b8cd5b5n, 0x240ca1cc77ac9c65n,
  0x2de92c6f592b0275n, 0x4a7484aa6ea6e483n, 0x5cb0a9dcbd41fbd4n, 0x76f988da831153b5n,
  0x983e5152ee66dfabn, 0xa831c66d2db43210n, 0xb00327c898fb213fn, 0xbf597fc7beef0ee4n,
  0xc6e00bf33da88fc2n, 0xd5a79147930aa725n, 0x06ca6351e003826fn, 0x142929670a0e6e70n,
  0x27b70a8546d22ffcn, 0x2e1b21385c26c926n, 0x4d2c6dfc5ac42aedn, 0x53380d139d95b3dfn,
  0x650a73548baf63den, 0x766a0abb3c77b2a8n, 0x81c2c92e47edaee6n, 0x92722c851482353bn,
  0xa2bfe8a14cf10364n, 0xa81a664bbc423001n, 0xc24b8b70d0f89791n, 0xc76c51a30654be30n,
  0xd192e819d6ef5218n, 0xd69906245565a910n, 0xf40e35855771202an, 0x106aa07032bbd1b8n,
  0x19a4c116b8d2d0c8n, 0x1e376c085141ab53n, 0x2748774cdf8eeb99n, 0x34b0bcb5e19b48a8n,
  0x391c0cb3c5c95a63n, 0x4ed8aa4ae3418acbn, 0x5b9cca4f7763e373n, 0x682e6ff3d6b2b8a3n,
  0x748f82ee5defb2fcn, 0x78a5636f43172f60n, 0x84c87814a1f0ab72n, 0x8cc702081a6439ecn,
  0x90befffa23631e28n, 0xa4506cebde82bde9n, 0xbef9a3f7b2c67915n, 0xc67178f2e372532bn,
  0xca273eceea26619cn, 0xd186b8c721c0c207n, 0xeada7dd6cde0eb1en, 0xf57d4f7fee6ed178n,
  0x06f067aa72176fban, 0x0a637dc5a2c898a6n, 0x113f9804bef90daen, 0x1b710b35131c471bn,
  0x28db77f523047d84n, 0x32caab7b40c72493n, 0x3c9ebe0a15c9bebcn, 0x431d67c49c100d4cn,
  0x4cc5d4becb3e42b6n, 0x597f299cfc657e2an, 0x5fcb6fab3ad6faecn, 0x6c44198c4a475817n,
];

const SHA256_IV = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** Encodes raw bytes into standard RFC 4648 Base64 without depending on `Buffer` or `btoa`. */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const has1 = i + 1 < bytes.length;
    const has2 = i + 2 < bytes.length;
    const b1 = has1 ? bytes[i + 1] : 0;
    const b2 = has2 ? bytes[i + 2] : 0;
    const triple = (b0 << 16) | (b1 << 8) | b2;
    out += BASE64_ALPHABET[(triple >>> 18) & 0x3f];
    out += BASE64_ALPHABET[(triple >>> 12) & 0x3f];
    out += has1 ? BASE64_ALPHABET[(triple >>> 6) & 0x3f] : '=';
    out += has2 ? BASE64_ALPHABET[triple & 0x3f] : '=';
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i];
    out += HEX_DIGITS[(byte >>> 4) & 0x0f] + HEX_DIGITS[byte & 0x0f];
  }
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  if (clean.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(clean)) {
    throw new Error('Invalid hex digest');
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Formats the wire transfer checksum from a full SHA-512 hex digest:
 * Base64 of the first 16 digest bytes (`/^[A-Za-z0-9+/]{22}==$/`).
 */
export function checksumFromSha512Hex(hex: string): string {
  const clean = hex.trim();
  if (clean.length < 32 || !/^[0-9a-fA-F]+$/.test(clean)) {
    throw new Error('Expected a valid SHA-512 hex digest');
  }
  const first16 = hexToBytes(clean.slice(0, 32));
  return bytesToBase64(first16);
}

function rotr64(x: bigint, n: number): bigint {
  const shift = BigInt(n);
  return ((x >> shift) | (x << (64n - shift))) & U64_MASK;
}

function compressSha512Block(state: bigint[], block: Uint8Array, offset: number): void {
  const w = new Array<bigint>(80);
  const view = new DataView(block.buffer, block.byteOffset + offset, 128);
  for (let t = 0; t < 16; t += 1) {
    w[t] = view.getBigUint64(t * 8, false);
  }
  for (let t = 16; t < 80; t += 1) {
    const w15 = w[t - 15];
    const w2 = w[t - 2];
    const s0 = rotr64(w15, 1) ^ rotr64(w15, 8) ^ (w15 >> 7n);
    const s1 = rotr64(w2, 19) ^ rotr64(w2, 61) ^ (w2 >> 6n);
    w[t] = (w[t - 16] + s0 + w[t - 7] + s1) & U64_MASK;
  }

  let [a, b, c, d, e, f, g, h] = state;
  for (let t = 0; t < 80; t += 1) {
    const S1 = rotr64(e, 14) ^ rotr64(e, 18) ^ rotr64(e, 41);
    const ch = (e & f) ^ ((~e & U64_MASK) & g);
    const temp1 = (h + S1 + ch + SHA512_K[t] + w[t]) & U64_MASK;
    const S0 = rotr64(a, 28) ^ rotr64(a, 34) ^ rotr64(a, 39);
    const maj = (a & b) ^ (a & c) ^ (b & c);
    const temp2 = (S0 + maj) & U64_MASK;

    h = g;
    g = f;
    f = e;
    e = (d + temp1) & U64_MASK;
    d = c;
    c = b;
    b = a;
    a = (temp1 + temp2) & U64_MASK;
  }

  state[0] = (state[0] + a) & U64_MASK;
  state[1] = (state[1] + b) & U64_MASK;
  state[2] = (state[2] + c) & U64_MASK;
  state[3] = (state[3] + d) & U64_MASK;
  state[4] = (state[4] + e) & U64_MASK;
  state[5] = (state[5] + f) & U64_MASK;
  state[6] = (state[6] + g) & U64_MASK;
  state[7] = (state[7] + h) & U64_MASK;
}

/**
 * Portable streaming SHA-512 hasher producing the 16-byte Base64 transfer checksum format without
 * relying on `node:crypto` or reading an entire multi-gigabyte file into RAM at once.
 */
export class IncrementalChecksum {
  private readonly state: bigint[] = [...SHA512_IV];
  private readonly buffer = new Uint8Array(128);
  private bufferLength = 0;
  private totalBytes = 0n;

  update(chunk: Uint8Array): this {
    if (chunk.length === 0) return this;
    this.totalBytes += BigInt(chunk.length);
    let offset = 0;

    if (this.bufferLength > 0) {
      const needed = 128 - this.bufferLength;
      const take = Math.min(needed, chunk.length);
      this.buffer.set(chunk.subarray(0, take), this.bufferLength);
      this.bufferLength += take;
      offset += take;
      if (this.bufferLength === 128) {
        compressSha512Block(this.state, this.buffer, 0);
        this.bufferLength = 0;
      }
    }

    while (offset + 128 <= chunk.length) {
      compressSha512Block(this.state, chunk, offset);
      offset += 128;
    }

    if (offset < chunk.length) {
      const remainder = chunk.subarray(offset);
      this.buffer.set(remainder, 0);
      this.bufferLength = remainder.length;
    }

    return this;
  }

  /** Returns the full 128-character lowercase SHA-512 hex digest without mutating hasher state. */
  digestHex(): string {
    const state = [...this.state];
    const block = new Uint8Array(128);
    block.set(this.buffer.subarray(0, this.bufferLength), 0);
    let pos = this.bufferLength;

    block[pos++] = 0x80;
    if (pos > 112) {
      block.fill(0, pos);
      compressSha512Block(state, block, 0);
      block.fill(0);
      pos = 0;
    } else {
      block.fill(0, pos, 112);
    }

    const totalBits = this.totalBytes * 8n;
    const highBits = (totalBits >> 64n) & U64_MASK;
    const lowBits = totalBits & U64_MASK;
    const lenView = new DataView(block.buffer);
    lenView.setBigUint64(112, highBits, false);
    lenView.setBigUint64(120, lowBits, false);
    compressSha512Block(state, block, 0);

    const digestBytes = new Uint8Array(64);
    const outView = new DataView(digestBytes.buffer);
    for (let i = 0; i < 8; i += 1) {
      outView.setBigUint64(i * 8, state[i], false);
    }
    return bytesToHex(digestBytes);
  }

  /** Returns the Base64-encoded first 16 bytes of the SHA-512 digest. */
  digest(): string {
    return checksumFromSha512Hex(this.digestHex());
  }
}

function rotr32(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

/** Pure portable FIPS 180-4 SHA-256 digest. */
export function sha256Bytes(data: Uint8Array): Uint8Array {
  const paddedLength = Math.ceil((data.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(data, 0);
  padded[data.length] = 0x80;

  const bitLen = BigInt(data.length) * 8n;
  const lenView = new DataView(padded.buffer);
  lenView.setUint32(paddedLength - 8, Number((bitLen >> 32n) & 0xffffffffn), false);
  lenView.setUint32(paddedLength - 4, Number(bitLen & 0xffffffffn), false);

  const h = new Uint32Array(SHA256_IV);
  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let t = 0; t < 16; t += 1) {
      w[t] = lenView.getUint32(offset + t * 4, false);
    }
    for (let t = 16; t < 64; t += 1) {
      const w15 = w[t - 15];
      const w2 = w[t - 2];
      const s0 = rotr32(w15, 7) ^ rotr32(w15, 18) ^ (w15 >>> 3);
      const s1 = rotr32(w2, 17) ^ rotr32(w2, 19) ^ (w2 >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }

    let a = h[0];
    let b = h[1];
    let c = h[2];
    let d = h[3];
    let e = h[4];
    let f = h[5];
    let g = h[6];
    let hh = h[7];

    for (let t = 0; t < 64; t += 1) {
      const S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + S1 + ch + SHA256_K[t] + w[t]) >>> 0;
      const S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i += 1) {
    outView.setUint32(i * 4, h[i], false);
  }
  return out;
}

/** Pure portable RFC 2104 HMAC-SHA256. */
export function hmacSha256(key: Uint8Array, data: Uint8Array): Uint8Array {
  const blockSize = 64;
  const k0 = key.length > blockSize ? sha256Bytes(key) : key;
  const paddedKey = new Uint8Array(blockSize);
  paddedKey.set(k0, 0);

  const inner = new Uint8Array(blockSize + data.length);
  const outer = new Uint8Array(blockSize + 32);
  for (let i = 0; i < blockSize; i += 1) {
    inner[i] = paddedKey[i] ^ 0x36;
    outer[i] = paddedKey[i] ^ 0x5c;
  }
  inner.set(data, blockSize);
  outer.set(sha256Bytes(inner), blockSize);
  return sha256Bytes(outer);
}

/** Pure portable RFC 5869 HKDF-SHA256 key derivation. */
export function hkdfSha256(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number,
): Uint8Array {
  if (!Number.isInteger(length) || length < 0 || length > 255 * 32) {
    throw new Error('Invalid HKDF output length');
  }
  if (length === 0) return new Uint8Array(0);
  const effectiveSalt = salt.length > 0 ? salt : new Uint8Array(32);
  const prk = hmacSha256(effectiveSalt, ikm);

  const okm = new Uint8Array(length);
  let prev = new Uint8Array(0);
  let offset = 0;
  let counter = 1;

  while (offset < length) {
    const input = new Uint8Array(prev.length + info.length + 1);
    input.set(prev, 0);
    input.set(info, prev.length);
    input[prev.length + info.length] = counter;
    prev = new Uint8Array(hmacSha256(prk, input));
    const take = Math.min(prev.length, length - offset);
    okm.set(prev.subarray(0, take), offset);
    offset += take;
    counter += 1;
  }

  return okm;
}

/**
 * Derives the per-transfer 256-bit AES-GCM Base64 key from a pairing shared secret and `requestId`.
 */
export function blobKeyBase64(secret: string, requestId: string): string {
  const keyBytes = hkdfSha256(
    UTF8.encode(secret),
    UTF8.encode(BLOB_HKDF_SALT),
    UTF8.encode(`${BLOB_HKDF_INFO_PREFIX}${requestId}`),
    32,
  );
  return bytesToBase64(keyBytes);
}

export interface BlobMaterial {
  token: string;
  keyBase64: string;
  nonceBase64: string;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const cryptoObj = (globalThis as { crypto?: { getRandomValues?: (arr: Uint8Array) => Uint8Array } })
    .crypto;
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
    throw new Error('Secure random generator is unavailable');
  }
  cryptoObj.getRandomValues(bytes);
  return bytes;
}

/**
 * Mints fresh single-transfer bearer token, derived AES-256-GCM key, and 12-byte GCM nonce.
 */
export function createBlobMaterial(secret: string, requestId: string): BlobMaterial {
  const token = bytesToHex(randomBytes(32));
  const nonceBase64 = bytesToBase64(randomBytes(12));
  return {
    token,
    keyBase64: blobKeyBase64(secret, requestId),
    nonceBase64,
  };
}
