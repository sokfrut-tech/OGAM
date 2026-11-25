/**
 * Pure RIFF/WAVE PCM silence-trim planner (`@offgrid/speech` clean-room replacement).
 *
 * Scans chunk headers inside the leading bytes of a WAV recording, validates linear PCM
 * metadata, aligns frame boundaries, and produces a canonical 44-byte RIFF/WAVE header plus
 * byte copy range for the trimmed audio payload.
 */

export const WAV_HEADER_BYTES = 44;
export const WAV_HEADER_SCAN_BYTES = 4096;

export interface WavTrimPlan {
  /** Canonical 44-byte RIFF/WAVE linear-PCM header sized for `copyBytes`. */
  header: Uint8Array;
  /** Byte offset in the original WAV file where kept PCM audio begins. */
  copyFrom: number;
  /** Number of PCM payload bytes to copy into the trimmed file. */
  copyBytes: number;
  /** Total duration removed across front and tail, in seconds. */
  droppedSeconds: number;
}

const PCM_FORMAT = 1;
const FMT_CHUNK_BYTES = 16;

function readFourCc(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

function writeFourCc(view: DataView, offset: number, code: string): void {
  view.setUint8(offset, code.charCodeAt(0));
  view.setUint8(offset + 1, code.charCodeAt(1));
  view.setUint8(offset + 2, code.charCodeAt(2));
  view.setUint8(offset + 3, code.charCodeAt(3));
}

interface ParsedWavHeader {
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  blockAlign: number;
  dataOffset: number;
  dataSize: number;
}

function parsePcmWavHeader(head: Uint8Array): ParsedWavHeader | null {
  if (head.byteLength < 36) return null;
  const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
  if (readFourCc(view, 0) !== 'RIFF' || readFourCc(view, 8) !== 'WAVE') {
    return null;
  }

  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let blockAlign = 0;
  let hasFmt = false;
  let dataOffset = -1;
  let dataSize = 0;

  let cursor = 12;
  while (cursor + 8 <= head.byteLength) {
    const chunkId = readFourCc(view, cursor);
    const chunkSize = view.getUint32(cursor + 4, true);
    const payloadOffset = cursor + 8;

    if (chunkId === 'fmt ') {
      if (chunkSize < FMT_CHUNK_BYTES || payloadOffset + FMT_CHUNK_BYTES > head.byteLength) {
        return null;
      }
      const audioFormat = view.getUint16(payloadOffset, true);
      if (audioFormat !== PCM_FORMAT) return null;

      channels = view.getUint16(payloadOffset + 2, true);
      sampleRate = view.getUint32(payloadOffset + 4, true);
      blockAlign = view.getUint16(payloadOffset + 12, true);
      bitsPerSample = view.getUint16(payloadOffset + 14, true);
      const expectedAlign = channels * (bitsPerSample / 8);
      if (
        channels < 1 ||
        sampleRate < 1 ||
        bitsPerSample < 8 ||
        bitsPerSample % 8 !== 0 ||
        blockAlign !== expectedAlign
      ) {
        return null;
      }
      hasFmt = true;
    } else if (chunkId === 'data') {
      dataOffset = payloadOffset;
      dataSize = chunkSize;
      break;
    }

    const paddedSize = chunkSize + (chunkSize & 1);
    const nextCursor = payloadOffset + paddedSize;
    if (nextCursor <= cursor) break;
    cursor = nextCursor;
  }

  if (!hasFmt || dataOffset < 0) return null;
  return { channels, sampleRate, bitsPerSample, blockAlign, dataOffset, dataSize };
}

function buildPcmHeader(parsed: ParsedWavHeader, copyBytes: number): Uint8Array {
  const header = new Uint8Array(WAV_HEADER_BYTES);
  const view = new DataView(header.buffer);
  const byteRate = parsed.sampleRate * parsed.blockAlign;

  writeFourCc(view, 0, 'RIFF');
  view.setUint32(4, 36 + copyBytes, true);
  writeFourCc(view, 8, 'WAVE');
  writeFourCc(view, 12, 'fmt ');
  view.setUint32(16, FMT_CHUNK_BYTES, true);
  view.setUint16(20, PCM_FORMAT, true);
  view.setUint16(22, parsed.channels, true);
  view.setUint32(24, parsed.sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, parsed.blockAlign, true);
  view.setUint16(34, parsed.bitsPerSample, true);
  writeFourCc(view, 36, 'data');
  view.setUint32(40, copyBytes, true);
  return header;
}

export function planWavTrim(
  head: Uint8Array,
  dropFrontSeconds: number,
  fileBytes: number,
  dropTailSeconds: number = 0,
): WavTrimPlan | null {
  if (!Number.isFinite(fileBytes) || fileBytes <= WAV_HEADER_BYTES) return null;
  const parsed = parsePcmWavHeader(head);
  if (!parsed) return null;

  const frontSec = Number.isFinite(dropFrontSeconds) ? Math.max(0, dropFrontSeconds) : 0;
  const tailSec = Number.isFinite(dropTailSeconds) ? Math.max(0, dropTailSeconds) : 0;
  if (frontSec === 0 && tailSec === 0) return null;

  const filePayloadCapacity = Math.max(0, Math.floor(fileBytes) - parsed.dataOffset);
  const totalBytesRaw = Math.min(parsed.dataSize, filePayloadCapacity);
  const totalFrames = Math.floor(totalBytesRaw / parsed.blockAlign);
  if (totalFrames <= 0) return null;

  const frontFrames = Math.floor(frontSec * parsed.sampleRate);
  const tailFrames = Math.floor(tailSec * parsed.sampleRate);
  const droppedFrames = frontFrames + tailFrames;
  if (droppedFrames <= 0 || droppedFrames >= totalFrames) return null;

  const keptFrames = totalFrames - droppedFrames;
  const copyFrom = parsed.dataOffset + frontFrames * parsed.blockAlign;
  const copyBytes = keptFrames * parsed.blockAlign;
  const droppedSeconds = droppedFrames / parsed.sampleRate;

  return {
    header: buildPcmHeader(parsed, copyBytes),
    copyFrom,
    copyBytes,
    droppedSeconds,
  };
}
