/**
 * OGAM-owned speech transcription engine classification and OS availability rules.
 */

import type { ModelEntry } from '../types/modelCatalog';

export type TranscriptionEngine = 'whisper' | 'qwen3-asr';

const SUPPORTED_TRANSCRIPTION_PLATFORMS = new Set([
  'ios',
  'android',
  'macos',
  'windows',
  'linux',
]);

/** Identifies the runtime engine required by a catalog transcription entry. */
export function transcriptionEngineOf(
  entry: Pick<ModelEntry, 'id' | 'kind' | 'engine'>,
): TranscriptionEngine | undefined {
  if (entry.kind !== 'transcription') {
    return undefined;
  }
  if (entry.engine === 'qwen3-asr' || /qwen3?-?asr/i.test(entry.id)) {
    return 'qwen3-asr';
  }
  return 'whisper';
}

/** True when the given transcription backend is supported on `os`. */
export function isTranscriptionEngineAvailableOn(
  engine: TranscriptionEngine,
  os: string,
): boolean {
  if (engine !== 'whisper' && engine !== 'qwen3-asr') {
    return false;
  }
  return SUPPORTED_TRANSCRIPTION_PLATFORMS.has(os);
}
