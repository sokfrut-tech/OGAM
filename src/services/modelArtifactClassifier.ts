import { splitGgufPartNames } from '@offgrid/models';
import { isMMProjFile } from './mmproj';

export type ModelArtifactKind =
  | 'gguf'
  | 'litert'
  | 'mmproj'
  | 'whisper'
  | 'qnn-model'
  | 'qnn-runtime'
  | 'mnn-model'
  | 'lora'
  | 'safetensors'
  | 'manifest'
  | 'unknown';

const KNOWN_QNN_MODEL_FILES = new Set([
  'unet.bin',
  'text_encoder.bin',
  'vae_decoder.bin',
  'vae_encoder.bin',
  'controlnet.bin',
]);

/** Filename-only classification. A complete pack must still pass runtime-specific validation. */
export function classifyModelArtifact(fileName: string): {
  kind: ModelArtifactKind;
  installable: boolean;
} {
  const name = fileName.trim();
  const lower = name.toLowerCase();
  if (!name || name.startsWith('.') || name.includes('\0') || name !== name.split(/[\\/]/).pop()) {
    return { kind: 'unknown', installable: false };
  }
  if (lower === 'manifest.json') return { kind: 'manifest', installable: false };
  if (isMMProjFile(lower)) return { kind: 'mmproj', installable: false };
  if (lower.endsWith('.gguf')) {
    const firstPart = splitGgufPartNames(name)[0] === name;
    return { kind: 'gguf', installable: firstPart };
  }
  if (lower.endsWith('.litertlm')) return { kind: 'litert', installable: true };
  if (/^ggml-.+\.bin$/i.test(name)) return { kind: 'whisper', installable: true };
  if (lower.endsWith('.mnn')) return { kind: 'mnn-model', installable: false };
  if (lower.endsWith('.so') && /^libqnn/i.test(name)) {
    return { kind: 'qnn-runtime', installable: false };
  }
  if (lower.endsWith('.bin') && KNOWN_QNN_MODEL_FILES.has(lower)) {
    return { kind: 'qnn-model', installable: false };
  }
  if (lower.endsWith('.safetensors')) {
    return lower.includes('lora')
      ? { kind: 'lora', installable: false }
      : { kind: 'safetensors', installable: false };
  }
  return { kind: 'unknown', installable: false };
}
