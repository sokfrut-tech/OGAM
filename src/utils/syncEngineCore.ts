/**
 * OGAM-owned Personal Mesh encrypted transport and sync engine.
 *
 * Implements a clean-room, pure ES2022 authenticated encrypted transport using:
 * - RFC 7748 X25519 ephemeral Diffie-Hellman key agreement
 * - RFC 5869 HKDF-SHA256 key schedule
 * - RFC 8439 ChaCha20-Poly1305 AEAD per-frame authenticated encryption
 * - 4-byte big-endian length-prefixed framing
 *
 * Because upstream `off-grid-ai/shared` is unavailable (404), this protocol is OGAM-owned and
 * self-consistent across all OGAM sender/receiver builds, with zero external npm dependencies,
 * zero Node-only APIs, and zero runtime relative `.ts` imports.
 *
 * Replaces `@offgrid/sync` `MultiTransportBridge`, `SyncEngine`, and `@offgrid/sync/rn`
 * `RnTcpTransport`.
 */

import type {
  DeviceInfo,
  MembershipRevocationSnapshot,
  PairedDevice,
  PairingAttemptSnapshot,
  PairingEntitlementHostAdapter,
  PendingMembershipRevocation,
  SyncByteCodec,
  SyncConnection,
  SyncEngineOptions,
  SyncHealthFact,
  SyncProtocolMessage,
  SyncTransportHealthSnapshot,
  TransportBridge,
  TransportRoute,
  RnTcpModule,
  RnTcpServer,
  RnTcpSocket,
} from '../types/syncContracts';

const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder();
const MAX_FRAME_BYTES = 32 * 1024 * 1024;
const P25519 = (1n << 255n) - 19n;
const A24_25519 = 121665n;
const P1305 = (1n << 130n) - 5n;
const R_CLAMP_MASK = 0x0ffffffc0ffffffc0ffffffc0fffffffn;
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

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

// ============================================================================
// Portable byte, Base64, random, SHA-256, HMAC-SHA256 & HKDF-SHA256 helpers
// ============================================================================

function bytesToBase64(bytes: Uint8Array): string {
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

function base64ToBytes(encoded: string): Uint8Array {
  const clean = encoded.trim().replace(/\s+/g, '');
  if (clean.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) {
    throw new Error('Invalid base64 string');
  }
  if (clean.length === 0) return new Uint8Array(0);
  let pad = 0;
  if (clean.endsWith('==')) pad = 2;
  else if (clean.endsWith('=')) pad = 1;

  const out = new Uint8Array((clean.length / 4) * 3 - pad);
  let outPos = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = BASE64_ALPHABET.indexOf(clean[i]);
    const c1 = BASE64_ALPHABET.indexOf(clean[i + 1]);
    const c2 = clean[i + 2] === '=' ? 0 : BASE64_ALPHABET.indexOf(clean[i + 2]);
    const c3 = clean[i + 3] === '=' ? 0 : BASE64_ALPHABET.indexOf(clean[i + 3]);
    const triple = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    out[outPos++] = (triple >>> 16) & 0xff;
    if (clean[i + 2] !== '=') out[outPos++] = (triple >>> 8) & 0xff;
    if (clean[i + 3] !== '=') out[outPos++] = triple & 0xff;
  }
  return out;
}

function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  const cryptoObj = (globalThis as { crypto?: { getRandomValues?: (arr: Uint8Array) => Uint8Array } })
    .crypto;
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
    throw new Error('Secure random generator is unavailable');
  }
  cryptoObj.getRandomValues(out);
  return out;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const arr of arrays) total += arr.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    out.set(arr, offset);
    offset += arr.length;
  }
  return out;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

function rotr32(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

function rotl32(x: number, n: number): number {
  return ((x << n) | (x >>> (32 - n))) >>> 0;
}

function sha256(data: Uint8Array): Uint8Array {
  const paddedLen = Math.ceil((data.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(data, 0);
  padded[data.length] = 0x80;
  const bitLen = BigInt(data.length) * 8n;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Number((bitLen >> 32n) & 0xffffffffn), false);
  view.setUint32(paddedLen - 4, Number(bitLen & 0xffffffffn), false);

  const h = new Uint32Array(SHA256_IV);
  const w = new Uint32Array(64);
  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let t = 0; t < 16; t += 1) w[t] = view.getUint32(offset + t * 4, false);
    for (let t = 16; t < 64; t += 1) {
      const w15 = w[t - 15];
      const w2 = w[t - 2];
      const s0 = rotr32(w15, 7) ^ rotr32(w15, 18) ^ (w15 >>> 3);
      const s1 = rotr32(w2, 17) ^ rotr32(w2, 19) ^ (w2 >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
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
  for (let i = 0; i < 8; i += 1) outView.setUint32(i * 4, h[i], false);
  return out;
}

function hmacSha256(key: Uint8Array, data: Uint8Array): Uint8Array {
  const blockSize = 64;
  const k0 = key.length > blockSize ? sha256(key) : key;
  const paddedKey = new Uint8Array(blockSize);
  paddedKey.set(k0, 0);
  const inner = new Uint8Array(blockSize + data.length);
  const outer = new Uint8Array(blockSize + 32);
  for (let i = 0; i < blockSize; i += 1) {
    inner[i] = paddedKey[i] ^ 0x36;
    outer[i] = paddedKey[i] ^ 0x5c;
  }
  inner.set(data, blockSize);
  outer.set(sha256(inner), blockSize);
  return sha256(outer);
}

function hkdfSha256(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number,
): Uint8Array {
  const effectiveSalt = salt.length > 0 ? salt : new Uint8Array(32);
  const prk = hmacSha256(effectiveSalt, ikm);
  const okm = new Uint8Array(length);
  let prev: Uint8Array = new Uint8Array(0);
  let offset = 0;
  let counter = 1;
  while (offset < length) {
    const input = concatBytes(prev, info, new Uint8Array([counter]));
    prev = hmacSha256(prk, input);
    const take = Math.min(prev.length, length - offset);
    okm.set(prev.subarray(0, take), offset);
    offset += take;
    counter += 1;
  }
  return okm;
}

// ============================================================================
// RFC 7748 X25519 Diffie-Hellman
// ============================================================================

function decodeLittleEndianBytes(bytes: Uint8Array): bigint {
  let out = 0n;
  for (let i = bytes.length - 1; i >= 0; i -= 1) {
    out = (out << 8n) | BigInt(bytes[i]);
  }
  return out;
}

function encodeLittleEndian25519(val: bigint): Uint8Array {
  let v = ((val % P25519) + P25519) % P25519;
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i += 1) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

function clampX25519Scalar(scalar: Uint8Array): bigint {
  const k = new Uint8Array(scalar);
  k[0] &= 248;
  k[31] &= 127;
  k[31] |= 64;
  return decodeLittleEndianBytes(k);
}

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  let b = ((base % mod) + mod) % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }
  return result;
}

/** RFC 7748 X25519 scalar multiplication `u_out = X25519(scalar32, uCoord32)`. */
export function x25519(scalar32: Uint8Array, uCoord32: Uint8Array): Uint8Array {
  if (scalar32.length !== 32 || uCoord32.length !== 32) {
    throw new Error('X25519 requires 32-byte inputs');
  }
  const k = clampX25519Scalar(scalar32);
  const uBytes = new Uint8Array(uCoord32);
  uBytes[31] &= 127;
  const x1 = decodeLittleEndianBytes(uBytes) % P25519;

  let x2 = 1n;
  let z2 = 0n;
  let x3 = x1;
  let z3 = 1n;
  let swap = 0n;

  for (let t = 254; t >= 0; t -= 1) {
    const kt = (k >> BigInt(t)) & 1n;
    swap ^= kt;
    if (swap) {
      [x2, x3] = [x3, x2];
      [z2, z3] = [z3, z2];
    }
    swap = kt;

    const a = (x2 + z2) % P25519;
    const aa = (a * a) % P25519;
    const b = (x2 - z2 + P25519) % P25519;
    const bb = (b * b) % P25519;
    const e = (aa - bb + P25519) % P25519;
    const c = (x3 + z3) % P25519;
    const d = (x3 - z3 + P25519) % P25519;
    const da = (d * a) % P25519;
    const cb = (c * b) % P25519;

    const daPlusCb = (da + cb) % P25519;
    const daMinusCb = (da - cb + P25519) % P25519;
    x3 = (daPlusCb * daPlusCb) % P25519;
    z3 = (x1 * ((daMinusCb * daMinusCb) % P25519)) % P25519;
    x2 = (aa * bb) % P25519;
    z2 = (e * ((aa + ((A24_25519 * e) % P25519)) % P25519)) % P25519;
  }

  if (swap) {
    [x2, x3] = [x3, x2];
    [z2, z3] = [z3, z2];
  }

  const invZ2 = modPow(z2, P25519 - 2n, P25519);
  return encodeLittleEndian25519((x2 * invZ2) % P25519);
}

/** Derives the 32-byte X25519 public key from a 32-byte private scalar. */
export function x25519PublicKey(privateKey32: Uint8Array): Uint8Array {
  const basePoint = new Uint8Array(32);
  basePoint[0] = 9;
  return x25519(privateKey32, basePoint);
}

/** Generates a fresh ephemeral X25519 key pair. */
export function generateX25519KeyPair(): { privateKey: Uint8Array; publicKey: Uint8Array } {
  const privateKey = randomBytes(32);
  const publicKey = x25519PublicKey(privateKey);
  return { privateKey, publicKey };
}

// ============================================================================
// RFC 8439 ChaCha20-Poly1305 AEAD
// ============================================================================

function quarterRound(s: Uint32Array, a: number, b: number, c: number, d: number): void {
  s[a] = (s[a] + s[b]) >>> 0;
  s[d] = rotl32(s[d] ^ s[a], 16);
  s[c] = (s[c] + s[d]) >>> 0;
  s[b] = rotl32(s[b] ^ s[c], 12);
  s[a] = (s[a] + s[b]) >>> 0;
  s[d] = rotl32(s[d] ^ s[a], 8);
  s[c] = (s[c] + s[d]) >>> 0;
  s[b] = rotl32(s[b] ^ s[c], 7);
}

function chacha20Block(key32: Uint8Array, counter: number, nonce12: Uint8Array): Uint8Array {
  const keyView = new DataView(key32.buffer, key32.byteOffset, 32);
  const nonceView = new DataView(nonce12.buffer, nonce12.byteOffset, 12);

  const initial = new Uint32Array([
    0x61707865,
    0x3320646e,
    0x79622d32,
    0x6b206574,
    keyView.getUint32(0, true),
    keyView.getUint32(4, true),
    keyView.getUint32(8, true),
    keyView.getUint32(12, true),
    keyView.getUint32(16, true),
    keyView.getUint32(20, true),
    keyView.getUint32(24, true),
    keyView.getUint32(28, true),
    counter >>> 0,
    nonceView.getUint32(0, true),
    nonceView.getUint32(4, true),
    nonceView.getUint32(8, true),
  ]);

  const working = new Uint32Array(initial);
  for (let i = 0; i < 10; i += 1) {
    quarterRound(working, 0, 4, 8, 12);
    quarterRound(working, 1, 5, 9, 13);
    quarterRound(working, 2, 6, 10, 14);
    quarterRound(working, 3, 7, 11, 15);
    quarterRound(working, 0, 5, 10, 15);
    quarterRound(working, 1, 6, 11, 12);
    quarterRound(working, 2, 7, 8, 13);
    quarterRound(working, 3, 4, 9, 14);
  }

  const out = new Uint8Array(64);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 16; i += 1) {
    outView.setUint32(i * 4, (working[i] + initial[i]) >>> 0, true);
  }
  return out;
}

function chacha20Xor(
  key32: Uint8Array,
  initialCounter: number,
  nonce12: Uint8Array,
  input: Uint8Array,
): Uint8Array {
  const out = new Uint8Array(input.length);
  let counter = initialCounter >>> 0;
  for (let offset = 0; offset < input.length; offset += 64) {
    const block = chacha20Block(key32, counter, nonce12);
    const take = Math.min(64, input.length - offset);
    for (let i = 0; i < take; i += 1) {
      out[offset + i] = input[offset + i] ^ block[i];
    }
    counter = (counter + 1) >>> 0;
  }
  return out;
}

function poly1305Tag(oneTimeKey32: Uint8Array, macData: Uint8Array): Uint8Array {
  const r = decodeLittleEndianBytes(oneTimeKey32.subarray(0, 16)) & R_CLAMP_MASK;
  const s = decodeLittleEndianBytes(oneTimeKey32.subarray(16, 32));
  let acc = 0n;

  for (let offset = 0; offset < macData.length; offset += 16) {
    const end = Math.min(offset + 16, macData.length);
    const chunk = macData.subarray(offset, end);
    const n = decodeLittleEndianBytes(chunk) | (1n << BigInt(chunk.length * 8));
    acc = ((acc + n) * r) % P1305;
  }

  let tagVal = acc + s;
  const tag = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) {
    tag[i] = Number(tagVal & 0xffn);
    tagVal >>= 8n;
  }
  return tag;
}

function u64LittleEndianBytes(length: number): Uint8Array {
  const out = new Uint8Array(8);
  const view = new DataView(out.buffer);
  const big = BigInt(length);
  view.setUint32(0, Number(big & 0xffffffffn), true);
  view.setUint32(4, Number((big >> 32n) & 0xffffffffn), true);
  return out;
}

function buildAeadMacData(aad: Uint8Array, ciphertext: Uint8Array): Uint8Array {
  const aadPad = (16 - (aad.length % 16)) % 16;
  const ctPad = (16 - (ciphertext.length % 16)) % 16;
  return concatBytes(
    aad,
    new Uint8Array(aadPad),
    ciphertext,
    new Uint8Array(ctPad),
    u64LittleEndianBytes(aad.length),
    u64LittleEndianBytes(ciphertext.length),
  );
}

/** RFC 8439 ChaCha20-Poly1305 AEAD encryption returning `ciphertext || tag16`. */
export function chacha20Poly1305Seal(
  key32: Uint8Array,
  nonce12: Uint8Array,
  plaintext: Uint8Array,
  aad: Uint8Array = new Uint8Array(0),
): Uint8Array {
  if (key32.length !== 32 || nonce12.length !== 12) {
    throw new Error('ChaCha20-Poly1305 requires 32-byte key and 12-byte nonce');
  }
  const otk = chacha20Block(key32, 0, nonce12).subarray(0, 32);
  const ciphertext = chacha20Xor(key32, 1, nonce12, plaintext);
  const tag = poly1305Tag(otk, buildAeadMacData(aad, ciphertext));
  return concatBytes(ciphertext, tag);
}

/** RFC 8439 ChaCha20-Poly1305 AEAD decryption verifying 16-byte tag before returning plaintext. */
export function chacha20Poly1305Open(
  key32: Uint8Array,
  nonce12: Uint8Array,
  ciphertextWithTag: Uint8Array,
  aad: Uint8Array = new Uint8Array(0),
): Uint8Array | null {
  if (key32.length !== 32 || nonce12.length !== 12 || ciphertextWithTag.length < 16) {
    return null;
  }
  const split = ciphertextWithTag.length - 16;
  const ciphertext = ciphertextWithTag.subarray(0, split);
  const providedTag = ciphertextWithTag.subarray(split);
  const otk = chacha20Block(key32, 0, nonce12).subarray(0, 32);
  const expectedTag = poly1305Tag(otk, buildAeadMacData(aad, ciphertext));
  if (!constantTimeEqual(providedTag, expectedTag)) return null;
  return chacha20Xor(key32, 1, nonce12, ciphertext);
}

// ============================================================================
// Length-prefixed framing
// ============================================================================

/** Wraps a frame payload with a 4-byte big-endian uint32 length prefix. */
export function encodeLengthPrefixedFrame(payload: Uint8Array): Uint8Array {
  if (payload.length > MAX_FRAME_BYTES) {
    throw new Error(`Frame exceeds max size (${MAX_FRAME_BYTES} bytes)`);
  }
  const out = new Uint8Array(4 + payload.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, payload.length, false);
  out.set(payload, 4);
  return out;
}

/** Reassembles length-prefixed wire frames across arbitrary TCP chunk boundaries. */
export class LengthPrefixedFrameDecoder {
  private buffer: Uint8Array = new Uint8Array(0);

  push(chunk: Uint8Array): Uint8Array[] {
    if (chunk.length > 0) {
      this.buffer = concatBytes(this.buffer, chunk);
    }
    const frames: Uint8Array[] = [];
    let offset = 0;
    while (offset + 4 <= this.buffer.length) {
      const view = new DataView(
        this.buffer.buffer,
        this.buffer.byteOffset + offset,
        4,
      );
      const length = view.getUint32(0, false);
      if (length > MAX_FRAME_BYTES) {
        this.buffer = new Uint8Array(0);
        throw new Error(`Inbound frame length ${length} exceeds limit`);
      }
      if (offset + 4 + length > this.buffer.length) break;
      frames.push(this.buffer.slice(offset + 4, offset + 4 + length));
      offset += 4 + length;
    }
    if (offset > 0) {
      this.buffer = this.buffer.slice(offset);
    }
    return frames;
  }
}

// ============================================================================
// RnTcpTransport + MultiTransportBridge
// ============================================================================

class RnTcpConnection implements SyncConnection {
  readonly id: string;
  readonly remoteHost: string;
  private readonly socket: RnTcpSocket;
  private readonly byteCodec: SyncByteCodec;
  private dataListener: ((data: Uint8Array) => void) | null = null;
  private readonly closeListeners = new Set<() => void>();
  private readonly pendingData: Uint8Array[] = [];
  private closed = false;

  constructor(
    id: string,
    socket: RnTcpSocket,
    byteCodec: SyncByteCodec,
    onClosedInternal: () => void,
  ) {
    this.id = id;
    this.socket = socket;
    this.byteCodec = byteCodec;
    this.remoteHost = socket.remoteAddress ?? '';

    socket.on('data', (raw: unknown) => {
      if (this.closed) return;
      const bytes = this.byteCodec.toBytes(raw);
      if (bytes.length === 0) return;
      if (this.dataListener) {
        this.dataListener(bytes);
      } else {
        this.pendingData.push(bytes);
      }
    });

    const handleClose = () => {
      if (this.closed) return;
      this.closed = true;
      this.pendingData.length = 0;
      onClosedInternal();
      for (const listener of this.closeListeners) listener();
      this.closeListeners.clear();
    };

    socket.on('close', handleClose);
    socket.on('error', handleClose);
  }

  send(data: Uint8Array): void {
    if (this.closed) return;
    this.socket.write(this.byteCodec.fromBytes(data));
  }

  onData(listener: (data: Uint8Array) => void): void {
    this.dataListener = listener;
    for (const chunk of this.pendingData.splice(0)) listener(chunk);
  }

  onClose(listener: () => void): void {
    this.closeListeners.add(listener);
    if (this.closed) listener();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.pendingData.length = 0;
    try {
      this.socket.destroy();
    } catch {
      /* ignore close errors */
    }
    for (const listener of this.closeListeners) listener();
    this.closeListeners.clear();
  }
}

/**
 * React Native `react-native-tcp-socket` transport implementing `TransportBridge` via an injected
 * `SyncByteCodec`.
 */
export class RnTcpTransport implements TransportBridge {
  boundPort?: number;
  private readonly tcpModule: RnTcpModule;
  private readonly byteCodec: SyncByteCodec;
  private server: RnTcpServer | null = null;
  private readonly connections = new Set<RnTcpConnection>();
  private connectionSeq = 0;
  private listenerHealth: SyncHealthFact = { state: 'idle' };

  constructor(
    tcpModule: RnTcpModule,
    byteCodec: SyncByteCodec,
  ) {
    this.tcpModule = tcpModule;
    this.byteCodec = byteCodec;
  }

  async listen(
    port: number,
    onConnection: (connection: SyncConnection) => void,
  ): Promise<void> {
    this.listenerHealth = { state: 'starting', updatedAt: Date.now() };
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const server = this.tcpModule.createServer(socket => {
        const conn = new RnTcpConnection(
          `tcp-in-${++this.connectionSeq}`,
          socket,
          this.byteCodec,
          () => this.connections.delete(conn),
        );
        this.connections.add(conn);
        onConnection(conn);
      });
      this.server = server;
      server.on('error', (error: unknown) => {
        const err = error instanceof Error ? error : new Error(String(error));
        this.listenerHealth = {
          state: 'failed',
          error: err.message,
          updatedAt: Date.now(),
        };
        if (!settled) {
          settled = true;
          reject(err);
        }
      });
      try {
        server.listen({ port, host: '0.0.0.0' }, () => {
          this.boundPort = server.address()?.port ?? port;
          this.listenerHealth = { state: 'ready', updatedAt: Date.now() };
          if (!settled) {
            settled = true;
            resolve();
          }
        });
      } catch (cause) {
        const err = cause instanceof Error ? cause : new Error(String(cause));
        this.listenerHealth = {
          state: 'failed',
          error: err.message,
          updatedAt: Date.now(),
        };
        if (!settled) {
          settled = true;
          reject(err);
        }
      }
    });
  }

  async connect(host: string, port: number): Promise<SyncConnection> {
    return new Promise<SyncConnection>((resolve, reject) => {
      let settled = false;
      let conn: RnTcpConnection | null = null;
      try {
        const socket = this.tcpModule.createConnection({ host, port }, () => {
          if (settled) return;
          settled = true;
          if (!conn) {
            conn = new RnTcpConnection(
              `tcp-out-${++this.connectionSeq}`,
              socket,
              this.byteCodec,
              () => conn && this.connections.delete(conn),
            );
            this.connections.add(conn);
          }
          resolve(conn);
        });
        socket.on('error', (error: unknown) => {
          if (settled) return;
          settled = true;
          reject(error instanceof Error ? error : new Error(String(error)));
        });
      } catch (cause) {
        if (!settled) {
          settled = true;
          reject(cause instanceof Error ? cause : new Error(String(cause)));
        }
      }
    });
  }

  async stop(): Promise<void> {
    for (const conn of [...this.connections]) conn.close();
    this.connections.clear();
    if (this.server) {
      try {
        this.server.close();
      } catch {
        /* ignore server close failure */
      }
      this.server = null;
    }
    this.boundPort = undefined;
    this.listenerHealth = { state: 'stopped', updatedAt: Date.now() };
  }

  getTransportHealthSnapshot(): SyncTransportHealthSnapshot {
    return {
      listener: { ...this.listenerHealth },
      routes: [{ id: 'lan', ...this.listenerHealth }],
    };
  }
}

export interface MultiTransportBridgeOptions {
  routes: TransportRoute[];
  onRouteError?: (routeId: string, error: Error) => void;
}

/**
 * Combines multiple `TransportRoute` bridges (e.g. LAN TCP + Apple Nearby) under one
 * `TransportBridge` facade.
 */
export class MultiTransportBridge implements TransportBridge {
  private readonly routes: TransportRoute[];
  private readonly onRouteError?: (routeId: string, error: Error) => void;

  constructor(options: MultiTransportBridgeOptions) {
    this.routes = [...options.routes];
    this.onRouteError = options.onRouteError;
  }

  get boundPort(): number | undefined {
    for (const route of this.routes) {
      if (typeof route.bridge.boundPort === 'number') {
        return route.bridge.boundPort;
      }
    }
    return undefined;
  }

  async listen(
    port: number,
    onConnection: (connection: SyncConnection) => void,
  ): Promise<void> {
    for (const route of this.routes) {
      try {
        await route.bridge.listen(port, onConnection);
      } catch (cause) {
        const error = cause instanceof Error ? cause : new Error(String(cause));
        if (route.required) throw error;
        this.onRouteError?.(route.id, error);
      }
    }
  }

  async connect(host: string, port: number, remote?: DeviceInfo): Promise<SyncConnection> {
    const eligible = this.routes.filter(
      route => !route.canConnect || !remote || route.canConnect(remote),
    );
    if (eligible.length === 0) {
      throw new Error('No eligible transport route available');
    }

    let lastError: Error | null = null;
    for (const route of eligible) {
      try {
        return await withOptionalTimeout(
          route.bridge.connect(host, port, remote),
          route.connectTimeoutMs,
        );
      } catch (cause) {
        const error = cause instanceof Error ? cause : new Error(String(cause));
        lastError = error;
        this.onRouteError?.(route.id, error);
      }
    }
    throw lastError ?? new Error('Unable to connect on any transport route');
  }

  async stop(): Promise<void> {
    for (const route of this.routes) {
      try {
        await route.bridge.stop();
      } catch (cause) {
        const error = cause instanceof Error ? cause : new Error(String(cause));
        this.onRouteError?.(route.id, error);
      }
    }
  }

  getTransportHealthSnapshot(): SyncTransportHealthSnapshot {
    const snapshots = this.routes
      .map(route => ({
        route,
        snap: route.bridge.getTransportHealthSnapshot?.(),
      }))
      .filter(entry => entry.snap !== undefined);

    return {
      listener: snapshots[0]?.snap?.listener ?? { state: 'idle' },
      routes: snapshots.flatMap(entry => entry.snap!.routes),
    };
  }
}

function withOptionalTimeout<T>(promise: Promise<T>, timeoutMs?: number): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Transport route timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      err => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

// ============================================================================
// SyncEngine — Authenticated pairing, reconnect,ChaCha20-Poly1305 sessions
// ============================================================================

interface ActiveSession {
  peer: DeviceInfo;
  conn: SyncConnection;
  txKey: Uint8Array;
  rxKey: Uint8Array;
  txCounter: bigint;
  sharedSecret: string;
  membershipId?: string;
}

type ControlPacket =
  | {
      t: 'pair_hello';
      mode: 'pair' | 'silent';
      device: DeviceInfo;
      pub: string;
      nonce: string;
      licensed: boolean;
    }
  | {
      t: 'pair_challenge';
      device: DeviceInfo;
      pub: string;
      nonce: string;
      licensed: boolean;
      mac: string;
    }
  | {
      t: 'pair_finish_enc';
      nonce: string;
      ct: string;
    }
  | {
      t: 'pair_ack_enc';
      nonce: string;
      ct: string;
    }
  | {
      t: 'pair_error';
      error: string;
    }
  | {
      t: 'reconn_hello';
      device: DeviceInfo;
      nonce: string;
      membershipId?: string;
    }
  | {
      t: 'reconn_challenge';
      device: DeviceInfo;
      nonce: string;
      mac: string;
    }
  | {
      t: 'reconn_auth';
      mac: string;
    }
  | {
      t: 'reconn_ok';
    }
  | {
      t: 'enc';
      ctr: string;
      ct: string;
    };

type EncryptedAppPayload =
  | { kind: 'app'; channel: string; data: unknown }
  | { kind: 'msg'; message: SyncProtocolMessage }
  | { kind: 'revoke'; membershipId?: string };

function counterNonce12(counter: bigint): Uint8Array {
  const nonce = new Uint8Array(12);
  const view = new DataView(nonce.buffer);
  view.setUint32(4, Number((counter >> 32n) & 0xffffffffn), false);
  view.setUint32(8, Number(counter & 0xffffffffn), false);
  return nonce;
}

function sendRawJson(conn: SyncConnection, packet: ControlPacket): void {
  const jsonBytes = UTF8_ENCODER.encode(JSON.stringify(packet));
  conn.send(encodeLengthPrefixedFrame(jsonBytes));
}

function parseJsonPacket(frame: Uint8Array): ControlPacket | null {
  try {
    const parsed = JSON.parse(UTF8_DECODER.decode(frame)) as ControlPacket;
    return parsed && typeof parsed === 'object' && typeof parsed.t === 'string'
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function pairingTranscriptKey(
  dh: Uint8Array,
  nonceA: Uint8Array,
  nonceB: Uint8Array,
  idA: string,
  idB: string,
): Uint8Array {
  const ordered = [idA, idB].sort().join('|');
  return hkdfSha256(
    dh,
    concatBytes(nonceA, nonceB),
    UTF8_ENCODER.encode(`ogam-pair-auth-v1|${ordered}`),
    32,
  );
}

function pairingSharedSecret(
  dh: Uint8Array,
  nonceA: Uint8Array,
  nonceB: Uint8Array,
  idA: string,
  idB: string,
): Uint8Array {
  const ordered = [idA, idB].sort().join('|');
  return hkdfSha256(
    dh,
    concatBytes(nonceA, nonceB),
    UTF8_ENCODER.encode(`ogam-pair-master-v1|${ordered}`),
    32,
  );
}

function normalizeSecretCode(code: string): string {
  return code.replace(/[\s-]+/g, '').toUpperCase();
}

function encodeUuidLike(): string {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Core Personal Mesh session, pairing, reconnect, membership revocation, and ChaCha20-Poly1305
 * messaging engine.
 */
export class SyncEngine {
  private readonly options: SyncEngineOptions;
  private readonly sessions = new Map<string, ActiveSession>();
  private readonly pairingAttempts = new Map<string, PairingAttemptSnapshot>();
  private readonly revocations = new Map<string, MembershipRevocationSnapshot>();
  private readonly pendingOutbounds = new Map<string, { cancel: () => void }>();

  constructor(options: SyncEngineOptions) {
    this.options = options;
  }

  async start(port: number): Promise<void> {
    await this.options.transport.listen(port, conn => {
      this.handleInboundConnection(conn);
    });
  }

  async stop(): Promise<void> {
    for (const pending of this.pendingOutbounds.values()) pending.cancel();
    this.pendingOutbounds.clear();
    for (const session of [...this.sessions.values()]) {
      session.conn.close();
    }
    this.sessions.clear();
    await this.options.transport.stop();
  }

  isPaired(deviceId: string): boolean {
    return this.sessions.has(deviceId);
  }

  listPairingAttempts(): PairingAttemptSnapshot[] {
    return [...this.pairingAttempts.values()];
  }

  dismissPairingAttempt(attemptId: string): boolean {
    return this.pairingAttempts.delete(attemptId);
  }

  async cancelPairing(deviceId: string): Promise<boolean> {
    const pending = this.pendingOutbounds.get(deviceId);
    if (!pending) return false;
    pending.cancel();
    this.pendingOutbounds.delete(deviceId);
    return true;
  }

  listMembershipRevocations(): MembershipRevocationSnapshot[] {
    return [...this.revocations.values()];
  }

  async dismissMembershipRevocation(revocationId: string): Promise<boolean> {
    const existed = this.revocations.delete(revocationId);
    const persistence = this.options.membershipPersistence;
    if (persistence?.setPendingDismissed) {
      for (const snap of this.revocations.values()) {
        if (snap.id === revocationId) {
          await persistence.setPendingDismissed(snap.deviceId, revocationId, Date.now());
        }
      }
    }
    return existed;
  }

  disconnect(deviceId: string): boolean {
    const session = this.sessions.get(deviceId);
    if (!session) return false;
    this.sessions.delete(deviceId);
    session.conn.close();
    this.options.onDisconnected?.(deviceId, 'local');
    return true;
  }

  send(deviceId: string, message: SyncProtocolMessage): boolean {
    return this.sendEncryptedPayload(deviceId, { kind: 'msg', message });
  }

  sendApp(deviceId: string, channel: string, data: unknown): boolean {
    return this.sendEncryptedPayload(deviceId, { kind: 'app', channel, data });
  }

  private sendEncryptedPayload(deviceId: string, payload: EncryptedAppPayload): boolean {
    const session = this.sessions.get(deviceId);
    if (!session) return false;
    const ctr = session.txCounter;
    session.txCounter += 1n;
    const nonce = counterNonce12(ctr);
    const plain = UTF8_ENCODER.encode(JSON.stringify(payload));
    const ct = chacha20Poly1305Seal(session.txKey, nonce, plain);
    sendRawJson(session.conn, { t: 'enc', ctr: ctr.toString(), ct: bytesToBase64(ct) });
    return true;
  }

  async pair(device: DeviceInfo, passphrase: string): Promise<PairedDevice> {
    return this.performOutboundPairing(device, passphrase, 'pair');
  }

  async pairWith(device: DeviceInfo, authenticator: string): Promise<PairedDevice> {
    return this.performOutboundPairing(device, authenticator, 'silent');
  }

  private recordAttempt(attempt: PairingAttemptSnapshot): void {
    this.pairingAttempts.set(attempt.id, attempt);
    this.options.onPairingAttemptChanged?.(attempt);
  }

  private async isLocallyLicensed(
    adapter?: PairingEntitlementHostAdapter,
  ): Promise<boolean> {
    if (!adapter) return false;
    try {
      const inspection = await adapter.inspect();
      return inspection.status === 'licensed';
    } catch {
      return false;
    }
  }

  private async performOutboundPairing(
    remote: DeviceInfo,
    passphrase: string,
    mode: 'pair' | 'silent',
  ): Promise<PairedDevice> {
    const normalizedCode = normalizeSecretCode(passphrase);
    if (!normalizedCode) {
      throw new Error('Enter a valid pairing code.');
    }

    const attemptId = encodeUuidLike();
    this.recordAttempt({
      id: attemptId,
      deviceId: remote.id,
      deviceName: remote.name,
      direction: 'outbound',
      state: 'connecting',
      updatedAt: Date.now(),
    });

    const conn = await this.options.transport.connect(remote.host, remote.port, remote);
    const decoder = new LengthPrefixedFrameDecoder();
    const { privateKey, publicKey } = generateX25519KeyPair();
    const nonceA = randomBytes(16);
    const initiatorLicensed = await this.isLocallyLicensed(this.options.pairingEntitlement);

    return new Promise<PairedDevice>((resolve, reject) => {
      let settled = false;
      let phase: 'await_challenge' | 'await_ack' | 'active' = 'await_challenge';
      let peerDevice: DeviceInfo = remote;
      let initToRespKey: Uint8Array | null = null;
      let respToInitKey: Uint8Array | null = null;
      let sharedSecret = '';
      let membershipId = encodeUuidLike();
      let exportedPreparedId: string | null = null;
      let importedPreparedId: string | null = null;
      let persistenceStaged = false;

      const rollbackOnFailure = async () => {
        if (exportedPreparedId && this.options.pairingEntitlement) {
          await this.options.pairingEntitlement.rollbackExport(exportedPreparedId).catch(() => undefined);
          exportedPreparedId = null;
        }
        if (importedPreparedId && this.options.pairingEntitlement) {
          await this.options.pairingEntitlement.rollbackImport(importedPreparedId).catch(() => undefined);
          importedPreparedId = null;
        }
        if (persistenceStaged) {
          await Promise.resolve(this.options.pairingPersistence?.rollback?.(peerDevice.id)).catch(
            () => undefined,
          );
          persistenceStaged = false;
        }
      };

      const fail = (errorMessage: string) => {
        if (settled) return;
        settled = true;
        this.pendingOutbounds.delete(remote.id);
        void rollbackOnFailure();
        conn.close();
        this.recordAttempt({
          id: attemptId,
          deviceId: peerDevice.id,
          deviceName: peerDevice.name,
          direction: 'outbound',
          state: 'failed',
          error: errorMessage,
          updatedAt: Date.now(),
        });
        this.options.onPairingFailed?.(peerDevice, errorMessage);
        reject(new Error(errorMessage));
      };

      this.pendingOutbounds.set(remote.id, { cancel: () => fail('pairing_cancelled') });

      conn.onClose(() => {
        if (phase !== 'active') {
          fail('connection_closed');
          return;
        }
        if (this.sessions.get(peerDevice.id)?.conn === conn) {
          this.sessions.delete(peerDevice.id);
          this.options.onDisconnected?.(peerDevice.id, 'remote');
        }
      });

      conn.onData(chunk => {
        void (async () => {
          let frames: Uint8Array[];
          try {
            frames = decoder.push(chunk);
          } catch (cause) {
            fail(cause instanceof Error ? cause.message : 'malformed_frame');
            return;
          }

          for (const frame of frames) {
            const packet = parseJsonPacket(frame);
            if (!packet) {
              fail('malformed_packet');
              return;
            }

            if (packet.t === 'pair_error') {
              fail(packet.error);
              return;
            }

            if (phase === 'await_challenge' && packet.t === 'pair_challenge') {
              peerDevice = packet.device;
              if (this.options.pairingEntitlement && !initiatorLicensed && !packet.licensed) {
                sendRawJson(conn, { t: 'pair_error', error: 'entitlement_unavailable' });
                fail('entitlement_unavailable');
                return;
              }
              const pubB = base64ToBytes(packet.pub);
              const nonceB = base64ToBytes(packet.nonce);
              const dh = x25519(privateKey, pubB);
              if (dh.every(b => b === 0)) {
                fail('invalid_key_exchange');
                return;
              }

              const authKey = pairingTranscriptKey(
                dh,
                nonceA,
                nonceB,
                this.options.localDevice.id,
                peerDevice.id,
              );
              const expectedMacB = hmacSha256(
                authKey,
                UTF8_ENCODER.encode(`B|${normalizedCode}`),
              );
              if (!constantTimeEqual(expectedMacB, base64ToBytes(packet.mac))) {
                sendRawJson(conn, { t: 'pair_error', error: 'invalid_pairing_code' });
                fail('invalid_pairing_code');
                return;
              }

              const masterSecret = pairingSharedSecret(
                dh,
                nonceA,
                nonceB,
                this.options.localDevice.id,
                peerDevice.id,
              );
              sharedSecret = bytesToBase64(masterSecret);
              initToRespKey = hkdfSha256(
                masterSecret,
                UTF8_ENCODER.encode('session'),
                UTF8_ENCODER.encode('i2r'),
                32,
              );
              respToInitKey = hkdfSha256(
                masterSecret,
                UTF8_ENCODER.encode('session'),
                UTF8_ENCODER.encode('r2i'),
                32,
              );

              let sponsoredCredential: unknown;
              if (this.options.pairingEntitlement && initiatorLicensed) {
                try {
                  const prepared = await this.options.pairingEntitlement.prepareExport({
                    syncDeviceId: peerDevice.id,
                    deviceName: peerDevice.name,
                    platform: peerDevice.platform,
                  });
                  exportedPreparedId = prepared.id;
                  sponsoredCredential = prepared.credential;
                } catch (cause) {
                  fail(cause instanceof Error ? cause.message : 'entitlement_export_failed');
                  return;
                }
              }

              const finishNonce = randomBytes(12);
              const finishBody = UTF8_ENCODER.encode(
                JSON.stringify({
                  proofA: bytesToBase64(
                    hmacSha256(authKey, UTF8_ENCODER.encode(`A|${normalizedCode}`)),
                  ),
                  membershipId,
                  ...(sponsoredCredential ? { credential: sponsoredCredential } : {}),
                }),
              );
              const sealedFinish = chacha20Poly1305Seal(
                initToRespKey,
                finishNonce,
                finishBody,
              );
              phase = 'await_ack';
              sendRawJson(conn, {
                t: 'pair_finish_enc',
                nonce: bytesToBase64(finishNonce),
                ct: bytesToBase64(sealedFinish),
              });
              continue;
            }

            if (phase === 'await_ack' && packet.t === 'pair_ack_enc' && respToInitKey) {
              const plain = chacha20Poly1305Open(
                respToInitKey,
                base64ToBytes(packet.nonce),
                base64ToBytes(packet.ct),
              );
              if (!plain) {
                fail('invalid_pair_ack');
                return;
              }
              const ack = JSON.parse(UTF8_DECODER.decode(plain)) as {
                ok?: boolean;
                membershipId?: string;
                credential?: unknown;
              };
              if (!ack.ok) {
                fail('pairing_rejected');
                return;
              }
              if (ack.membershipId) membershipId = ack.membershipId;

              if (exportedPreparedId && this.options.pairingEntitlement) {
                await this.options.pairingEntitlement.commitExport(exportedPreparedId);
                await this.options.pairingEntitlement.finalizeExport(exportedPreparedId).catch(
                  () => undefined,
                );
                exportedPreparedId = null;
              } else if (
                ack.credential &&
                this.options.pairingEntitlement &&
                !initiatorLicensed
              ) {
                const prep = await this.options.pairingEntitlement.prepareImport(
                  ack.credential as never,
                  {
                    syncDeviceId: this.options.localDevice.id,
                    deviceName: this.options.localDevice.name,
                    platform: this.options.localDevice.platform,
                  },
                );
                importedPreparedId = prep.id;
                await this.options.pairingEntitlement.commitImport(importedPreparedId);
                await this.options.pairingEntitlement.finalizeImport(importedPreparedId).catch(
                  () => undefined,
                );
                importedPreparedId = null;
              }

              const pairedDevice: PairedDevice = {
                ...peerDevice,
                host: remote.host || peerDevice.host,
                port: remote.port || peerDevice.port,
                sharedSecret,
                membershipId,
                pairedAt: Date.now(),
              };

              if (this.options.pairingPersistence?.begin && this.options.pairingPersistence?.commit) {
                await Promise.resolve(this.options.pairingPersistence.begin(pairedDevice));
                persistenceStaged = true;
                await Promise.resolve(this.options.pairingPersistence.commit(pairedDevice));
                persistenceStaged = false;
              } else if (this.options.pairingPersistence?.save) {
                await this.options.pairingPersistence.save(pairedDevice);
              }

              const session: ActiveSession = {
                peer: peerDevice,
                conn,
                txKey: initToRespKey!,
                rxKey: respToInitKey,
                txCounter: 1n,
                sharedSecret,
                membershipId,
              };
              this.sessions.set(peerDevice.id, session);
              phase = 'active';
              settled = true;
              this.pendingOutbounds.delete(remote.id);
              this.recordAttempt({
                id: attemptId,
                deviceId: peerDevice.id,
                deviceName: peerDevice.name,
                direction: 'outbound',
                state: 'paired',
                updatedAt: Date.now(),
              });
              this.options.onPaired?.(pairedDevice);
              resolve(pairedDevice);
              continue;
            }

            if (phase === 'active' && packet.t === 'enc') {
              const session = this.sessions.get(peerDevice.id);
              if (session) {
                this.handleEncryptedFrame(session, packet);
              }
            }
          }
        })().catch(err => {
          fail(err instanceof Error ? err.message : String(err));
        });
      });

      sendRawJson(conn, {
        t: 'pair_hello',
        mode,
        device: this.options.localDevice,
        pub: bytesToBase64(publicKey),
        nonce: bytesToBase64(nonceA),
        licensed: initiatorLicensed,
      });
    });
  }

  async reconnect(
    remote: DeviceInfo,
    sharedSecret: string,
    expectedMembershipId?: string,
  ): Promise<void> {
    if (this.sessions.has(remote.id)) return;
    const secretBytes = base64ToBytes(sharedSecret);
    const conn = await this.options.transport.connect(remote.host, remote.port, remote);
    const decoder = new LengthPrefixedFrameDecoder();
    const nonceA = randomBytes(16);

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      let phase: 'await_challenge' | 'await_ok' | 'active' = 'await_challenge';
      let peerDevice: DeviceInfo = remote;
      let txKey: Uint8Array | null = null;
      let rxKey: Uint8Array | null = null;

      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        conn.close();
        reject(new Error(message));
      };

      conn.onClose(() => {
        if (phase !== 'active') {
          fail('connection_closed');
          return;
        }
        if (this.sessions.get(peerDevice.id)?.conn === conn) {
          this.sessions.delete(peerDevice.id);
          this.options.onDisconnected?.(peerDevice.id, 'remote');
        }
      });

      conn.onData(chunk => {
        let frames: Uint8Array[];
        try {
          frames = decoder.push(chunk);
        } catch (cause) {
          fail(cause instanceof Error ? cause.message : 'malformed_frame');
          return;
        }

        for (const frame of frames) {
          const packet = parseJsonPacket(frame);
          if (!packet) {
            fail('malformed_packet');
            return;
          }
          if (packet.t === 'pair_error') {
            fail(packet.error);
            return;
          }

          if (phase === 'await_challenge' && packet.t === 'reconn_challenge') {
            peerDevice = packet.device;
            const nonceB = base64ToBytes(packet.nonce);
            const expectedMac = hmacSha256(
              secretBytes,
              concatBytes(UTF8_ENCODER.encode('R|'), nonceA, nonceB),
            );
            if (!constantTimeEqual(expectedMac, base64ToBytes(packet.mac))) {
              sendRawJson(conn, { t: 'pair_error', error: 'invalid_shared_secret' });
              fail('invalid_shared_secret');
              return;
            }

            txKey = hkdfSha256(
              secretBytes,
              concatBytes(nonceA, nonceB),
              UTF8_ENCODER.encode('reconn-i2r'),
              32,
            );
            rxKey = hkdfSha256(
              secretBytes,
              concatBytes(nonceA, nonceB),
              UTF8_ENCODER.encode('reconn-r2i'),
              32,
            );

            const authMac = hmacSha256(
              secretBytes,
              concatBytes(UTF8_ENCODER.encode('I|'), nonceA, nonceB),
            );
            phase = 'await_ok';
            sendRawJson(conn, { t: 'reconn_auth', mac: bytesToBase64(authMac) });
            continue;
          }

          if (phase === 'await_ok' && packet.t === 'reconn_ok' && txKey && rxKey) {
            const session: ActiveSession = {
              peer: peerDevice,
              conn,
              txKey,
              rxKey,
              txCounter: 1n,
              sharedSecret,
              membershipId: expectedMembershipId,
            };
            this.sessions.set(peerDevice.id, session);
            phase = 'active';
            settled = true;
            this.options.onRouteChanged?.(peerDevice.id, 'lan');
            resolve();
            continue;
          }

          if (phase === 'active' && packet.t === 'enc') {
            const session = this.sessions.get(peerDevice.id);
            if (session) this.handleEncryptedFrame(session, packet);
          }
        }
      });

      sendRawJson(conn, {
        t: 'reconn_hello',
        device: this.options.localDevice,
        nonce: bytesToBase64(nonceA),
        ...(expectedMembershipId ? { membershipId: expectedMembershipId } : {}),
      });
    });
  }

  private handleInboundConnection(conn: SyncConnection): void {
    const decoder = new LengthPrefixedFrameDecoder();
    let mode: 'init' | 'pair' | 'reconn' | 'active' = 'init';
    let peerDevice: DeviceInfo | null = null;
    let initNonce: Uint8Array | null = null;
    let localPrivKey: Uint8Array | null = null;
    let localNonce: Uint8Array | null = null;
    let expectedCode = '';
    let localLicensed = false;
    let initToRespKey: Uint8Array | null = null;
    let respToInitKey: Uint8Array | null = null;
    let sharedSecret = '';
    let reconnectSecretBytes: Uint8Array | null = null;
    let reconnectNonceB: Uint8Array | null = null;
    let authKey: Uint8Array | null = null;

    conn.onClose(() => {
      if (peerDevice && this.sessions.get(peerDevice.id)?.conn === conn) {
        this.sessions.delete(peerDevice.id);
        this.options.onDisconnected?.(peerDevice.id, 'remote');
      }
    });

    conn.onData(chunk => {
      void (async () => {
        let frames: Uint8Array[];
        try {
          frames = decoder.push(chunk);
        } catch {
          conn.close();
          return;
        }

        for (const frame of frames) {
          const packet = parseJsonPacket(frame);
          if (!packet) {
            conn.close();
            return;
          }

          if (mode === 'init' && packet.t === 'pair_hello') {
            peerDevice = packet.device;
            initNonce = base64ToBytes(packet.nonce);
            const peerPub = base64ToBytes(packet.pub);

            const rawCode =
              packet.mode === 'silent'
                ? await this.options.resolveMeshAdmission?.(peerDevice)
                : await this.options.getPassphrase?.(peerDevice);
            const normalized = rawCode ? normalizeSecretCode(rawCode) : null;
            if (!normalized) {
              sendRawJson(conn, { t: 'pair_error', error: 'pairing_refused' });
              conn.close();
              return;
            }
            expectedCode = normalized;

            localLicensed = await this.isLocallyLicensed(this.options.pairingEntitlement);
            if (this.options.pairingEntitlement && !localLicensed && !packet.licensed) {
              sendRawJson(conn, { t: 'pair_error', error: 'entitlement_unavailable' });
              conn.close();
              return;
            }

            const kp = generateX25519KeyPair();
            localPrivKey = kp.privateKey;
            localNonce = randomBytes(16);
            const dh = x25519(localPrivKey, peerPub);
            if (dh.every(b => b === 0)) {
              sendRawJson(conn, { t: 'pair_error', error: 'invalid_key_exchange' });
              conn.close();
              return;
            }

            authKey = pairingTranscriptKey(
              dh,
              initNonce,
              localNonce,
              peerDevice.id,
              this.options.localDevice.id,
            );
            const masterSecret = pairingSharedSecret(
              dh,
              initNonce,
              localNonce,
              peerDevice.id,
              this.options.localDevice.id,
            );
            sharedSecret = bytesToBase64(masterSecret);
            initToRespKey = hkdfSha256(
              masterSecret,
              UTF8_ENCODER.encode('session'),
              UTF8_ENCODER.encode('i2r'),
              32,
            );
            respToInitKey = hkdfSha256(
              masterSecret,
              UTF8_ENCODER.encode('session'),
              UTF8_ENCODER.encode('r2i'),
              32,
            );

            mode = 'pair';
            sendRawJson(conn, {
              t: 'pair_challenge',
              device: this.options.localDevice,
              pub: bytesToBase64(kp.publicKey),
              nonce: bytesToBase64(localNonce),
              licensed: localLicensed,
              mac: bytesToBase64(
                hmacSha256(authKey, UTF8_ENCODER.encode(`B|${expectedCode}`)),
              ),
            });
            continue;
          }

          if (
            mode === 'pair' &&
            packet.t === 'pair_finish_enc' &&
            peerDevice &&
            initToRespKey &&
            respToInitKey &&
            authKey
          ) {
            const plain = chacha20Poly1305Open(
              initToRespKey,
              base64ToBytes(packet.nonce),
              base64ToBytes(packet.ct),
            );
            if (!plain) {
              sendRawJson(conn, { t: 'pair_error', error: 'invalid_pairing_code' });
              conn.close();
              return;
            }
            const finish = JSON.parse(UTF8_DECODER.decode(plain)) as {
              proofA: string;
              membershipId?: string;
              credential?: unknown;
            };
            const expectedProofA = hmacSha256(
              authKey,
              UTF8_ENCODER.encode(`A|${expectedCode}`),
            );
            if (!constantTimeEqual(expectedProofA, base64ToBytes(finish.proofA))) {
              sendRawJson(conn, { t: 'pair_error', error: 'invalid_pairing_code' });
              conn.close();
              return;
            }

            let exportCred: unknown;
            if (finish.credential && this.options.pairingEntitlement && !localLicensed) {
              const prep = await this.options.pairingEntitlement.prepareImport(
                finish.credential as never,
                {
                  syncDeviceId: this.options.localDevice.id,
                  deviceName: this.options.localDevice.name,
                  platform: this.options.localDevice.platform,
                },
              );
              await this.options.pairingEntitlement.commitImport(prep.id);
              await this.options.pairingEntitlement.finalizeImport(prep.id).catch(() => undefined);
            } else if (!finish.credential && this.options.pairingEntitlement && localLicensed) {
              const prep = await this.options.pairingEntitlement.prepareExport({
                syncDeviceId: peerDevice.id,
                deviceName: peerDevice.name,
                platform: peerDevice.platform,
              });
              await this.options.pairingEntitlement.commitExport(prep.id);
              await this.options.pairingEntitlement.finalizeExport(prep.id).catch(() => undefined);
              exportCred = prep.credential;
            }

            const membershipId = finish.membershipId ?? encodeUuidLike();
            const pairedDevice: PairedDevice = {
              ...peerDevice,
              sharedSecret,
              membershipId,
              pairedAt: Date.now(),
            };

            if (this.options.pairingPersistence?.begin && this.options.pairingPersistence?.commit) {
              await Promise.resolve(this.options.pairingPersistence.begin(pairedDevice));
              await Promise.resolve(this.options.pairingPersistence.commit(pairedDevice));
            } else if (this.options.pairingPersistence?.save) {
              await this.options.pairingPersistence.save(pairedDevice);
            }

            const ackNonce = randomBytes(12);
            const ackBody = UTF8_ENCODER.encode(
              JSON.stringify({
                ok: true,
                membershipId,
                ...(exportCred ? { credential: exportCred } : {}),
              }),
            );
            const session: ActiveSession = {
              peer: peerDevice,
              conn,
              txKey: respToInitKey,
              rxKey: initToRespKey,
              txCounter: 1n,
              sharedSecret,
              membershipId,
            };
            this.sessions.set(peerDevice.id, session);
            mode = 'active';
            this.options.onPaired?.(pairedDevice);
            sendRawJson(conn, {
              t: 'pair_ack_enc',
              nonce: bytesToBase64(ackNonce),
              ct: bytesToBase64(chacha20Poly1305Seal(respToInitKey, ackNonce, ackBody)),
            });
            continue;
          }

          if (mode === 'init' && packet.t === 'reconn_hello') {
            peerDevice = packet.device;
            initNonce = base64ToBytes(packet.nonce);
            const stored = this.options.getSharedSecret?.(peerDevice.id);
            if (!stored) {
              sendRawJson(conn, { t: 'pair_error', error: 'unknown_peer' });
              conn.close();
              return;
            }
            reconnectSecretBytes = base64ToBytes(stored);
            reconnectNonceB = randomBytes(16);
            sharedSecret = stored;
            mode = 'reconn';
            sendRawJson(conn, {
              t: 'reconn_challenge',
              device: this.options.localDevice,
              nonce: bytesToBase64(reconnectNonceB),
              mac: bytesToBase64(
                hmacSha256(
                  reconnectSecretBytes,
                  concatBytes(UTF8_ENCODER.encode('R|'), initNonce, reconnectNonceB),
                ),
              ),
            });
            continue;
          }

          if (
            mode === 'reconn' &&
            packet.t === 'reconn_auth' &&
            peerDevice &&
            initNonce &&
            reconnectNonceB &&
            reconnectSecretBytes
          ) {
            const expectedAuth = hmacSha256(
              reconnectSecretBytes,
              concatBytes(UTF8_ENCODER.encode('I|'), initNonce, reconnectNonceB),
            );
            if (!constantTimeEqual(expectedAuth, base64ToBytes(packet.mac))) {
              sendRawJson(conn, { t: 'pair_error', error: 'invalid_shared_secret' });
              conn.close();
              return;
            }
            const txKey = hkdfSha256(
              reconnectSecretBytes,
              concatBytes(initNonce, reconnectNonceB),
              UTF8_ENCODER.encode('reconn-r2i'),
              32,
            );
            const rxKey = hkdfSha256(
              reconnectSecretBytes,
              concatBytes(initNonce, reconnectNonceB),
              UTF8_ENCODER.encode('reconn-i2r'),
              32,
            );
            const session: ActiveSession = {
              peer: peerDevice,
              conn,
              txKey,
              rxKey,
              txCounter: 1n,
              sharedSecret,
            };
            this.sessions.set(peerDevice.id, session);
            mode = 'active';
            sendRawJson(conn, { t: 'reconn_ok' });
            this.options.onRouteChanged?.(peerDevice.id, 'lan');
            continue;
          }

          if (mode === 'active' && packet.t === 'enc' && peerDevice) {
            const session = this.sessions.get(peerDevice.id);
            if (session) this.handleEncryptedFrame(session, packet);
          }
        }
      })().catch(() => {
        conn.close();
      });
    });
  }

  private handleEncryptedFrame(
    session: ActiveSession,
    packet: Extract<ControlPacket, { t: 'enc' }>,
  ): void {
    const ctr = BigInt(packet.ctr);
    const plain = chacha20Poly1305Open(
      session.rxKey,
      counterNonce12(ctr),
      base64ToBytes(packet.ct),
    );
    if (!plain) {
      session.conn.close();
      return;
    }

    const body = JSON.parse(UTF8_DECODER.decode(plain)) as EncryptedAppPayload;
    if (body.kind === 'app') {
      this.options.onAppMessage?.(session.peer.id, body.channel, body.data);
    } else if (body.kind === 'msg') {
      this.options.onMessage?.(session.peer.id, body.message);
    } else if (body.kind === 'revoke') {
      this.sessions.delete(session.peer.id);
      session.conn.close();
      this.options.onMembershipRevoked?.(session.peer.id);
    }
  }

  async forget(
    deviceId: string,
    expectedMembershipId?: string,
  ): Promise<MembershipRevocationSnapshot | undefined> {
    const revocationId = encodeUuidLike();
    const session = this.sessions.get(deviceId);
    const online = Boolean(session);

    if (online) {
      this.sendEncryptedPayload(deviceId, {
        kind: 'revoke',
        membershipId: expectedMembershipId ?? session?.membershipId,
      });
      this.sessions.delete(deviceId);
      session?.conn.close();
    } else if (this.options.membershipPersistence?.beginLocal && session) {
      const paired: PairedDevice = {
        ...session.peer,
        sharedSecret: session.sharedSecret,
        membershipId: expectedMembershipId ?? session.membershipId,
      };
      const pending: PendingMembershipRevocation = {
        revocationId,
        deviceId,
        membershipId: expectedMembershipId ?? session.membershipId ?? '',
        device: session.peer,
        createdAt: Date.now(),
      };
      await Promise.resolve(this.options.membershipPersistence.beginLocal(paired, pending));
    }

    const snapshot: MembershipRevocationSnapshot = {
      id: revocationId,
      deviceId,
      ...(expectedMembershipId ? { membershipId: expectedMembershipId } : {}),
      state: online ? 'completed' : 'pending',
      updatedAt: Date.now(),
    };
    this.revocations.set(revocationId, snapshot);
    this.options.onMembershipRevocationChanged?.(snapshot);
    this.options.onMembershipRevoked?.(deviceId);
    return snapshot;
  }

  async retryMembershipRevocation(device: DeviceInfo): Promise<boolean> {
    let updated = false;
    for (const [id, snap] of this.revocations) {
      if (snap.deviceId === device.id && snap.state !== 'completed') {
        const next: MembershipRevocationSnapshot = {
          ...snap,
          state: 'completed',
          updatedAt: Date.now(),
        };
        this.revocations.set(id, next);
        this.options.onMembershipRevocationChanged?.(next);
        updated = true;
      }
    }
    return updated;
  }
}
