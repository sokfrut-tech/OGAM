import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WAV_HEADER_BYTES,
  WAV_HEADER_SCAN_BYTES,
  planWavTrim,
} from '../../src/utils/wavTrimPlan.ts';

function buildTestWav({
  audioFormat = 1,
  channels = 1,
  sampleRate = 16000,
  bitsPerSample = 16,
  dataBytes = 16000 * 2 * 5,
  extraChunks = [],
  declaredDataBytes,
} = {}) {
  const blockAlign = channels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;

  const extraSize = extraChunks.reduce((sum, chunk) => {
    const padded = chunk.payload.length + (chunk.payload.length & 1);
    return sum + 8 + padded;
  }, 0);

  const head = new Uint8Array(12 + 24 + extraSize + 8);
  const view = new DataView(head.buffer);
  const writeFourCc = (offset, code) => {
    for (let i = 0; i < 4; i += 1) view.setUint8(offset + i, code.charCodeAt(i));
  };

  writeFourCc(0, 'RIFF');
  view.setUint32(4, head.byteLength - 8 + dataBytes, true);
  writeFourCc(8, 'WAVE');

  writeFourCc(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, audioFormat, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  let cursor = 36;
  for (const chunk of extraChunks) {
    writeFourCc(cursor, chunk.id);
    view.setUint32(cursor + 4, chunk.payload.length, true);
    head.set(chunk.payload, cursor + 8);
    cursor += 8 + chunk.payload.length + (chunk.payload.length & 1);
  }

  writeFourCc(cursor, 'data');
  view.setUint32(cursor + 4, declaredDataBytes ?? dataBytes, true);
  const fileBytes = head.byteLength + dataBytes;
  return { head, fileBytes, dataOffset: head.byteLength, blockAlign };
}

test('exposes canonical WAV header constants', () => {
  assert.equal(WAV_HEADER_BYTES, 44);
  assert.equal(WAV_HEADER_SCAN_BYTES, 4096);
});

test('plans front and tail trims on 16kHz mono PCM WAV and writes valid 44B header', () => {
  const { head, fileBytes, dataOffset } = buildTestWav({
    channels: 1,
    sampleRate: 16000,
    bitsPerSample: 16,
    dataBytes: 16000 * 2 * 5,
  });
  const plan = planWavTrim(head, 1.0, fileBytes, 1.5);
  assert.ok(plan);
  assert.equal(plan.header.byteLength, 44);
  assert.equal(plan.copyFrom, dataOffset + 16000 * 2);
  assert.equal(plan.copyBytes, 16000 * 2 * 2.5);
  assert.equal(plan.droppedSeconds, 2.5);

  const view = new DataView(plan.header.buffer);
  assert.equal(String.fromCharCode(...plan.header.slice(0, 4)), 'RIFF');
  assert.equal(view.getUint32(4, true), 36 + plan.copyBytes);
  assert.equal(String.fromCharCode(...plan.header.slice(8, 12)), 'WAVE');
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), 16000);
  assert.equal(String.fromCharCode(...plan.header.slice(36, 40)), 'data');
  assert.equal(view.getUint32(40, true), plan.copyBytes);
});

test('scans past extra odd-sized chunks before data and maintains stereo frame alignment', () => {
  const { head, fileBytes, dataOffset, blockAlign } = buildTestWav({
    channels: 2,
    sampleRate: 44100,
    bitsPerSample: 16,
    dataBytes: 44100 * 4 * 4,
    extraChunks: [{ id: 'JUNK', payload: new Uint8Array([1, 2, 3, 4, 5]) }],
  });
  const plan = planWavTrim(head, 0.3333, fileBytes, 0.25);
  assert.ok(plan);
  assert.equal((plan.copyFrom - dataOffset) % blockAlign, 0);
  assert.equal(plan.copyBytes % blockAlign, 0);
  assert.ok(plan.copyFrom > dataOffset);
});

test('clamps to truncated file size and rejects invalid headers or excessive trims', () => {
  const floatWav = buildTestWav({ audioFormat: 3, dataBytes: 32000 });
  assert.equal(planWavTrim(floatWav.head, 0.5, floatWav.fileBytes, 0), null);

  const mono = buildTestWav({ dataBytes: 16000 * 2 * 2 });
  assert.equal(planWavTrim(mono.head, 0, mono.fileBytes, 0), null);
  assert.equal(planWavTrim(mono.head, 1.5, mono.fileBytes, 0.6), null);
  assert.equal(planWavTrim(new Uint8Array([1, 2, 3]), 1, 1000), null);

  // Declared 10s, actual file only has 2s after header: tail trim still computes against 2s.
  const truncated = buildTestWav({
    dataBytes: 16000 * 2 * 2,
    declaredDataBytes: 16000 * 2 * 10,
  });
  const plan = planWavTrim(truncated.head, 0.5, truncated.fileBytes, 0.5);
  assert.ok(plan);
  assert.equal(plan.copyBytes, 16000 * 2);
});
