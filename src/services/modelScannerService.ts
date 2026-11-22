import type { DownloadedModel } from '../types';
import { nativeDirectorySourceBoundary } from './sync/nativeDirectorySource';
import type { NativeDirectoryCandidate } from './sync/nativeDirectorySource';
import { isMMProjFile } from './modelManager/scan';
import { splitGgufPartNames } from '@offgrid/models';
import { modelManager } from './modelManager';
import { listDownloadedModels as listWhisperModels } from './whisperModelFiles';
import { readModelHeader } from './modelHeader';
import { estimateTextModelMemoryMB } from './activeModelService/memory';

export type ModelArtifactKind =
  | 'gguf'
  | 'mmproj'
  | 'whisper'
  | 'qnn-model'
  | 'qnn-runtime'
  | 'mnn-model'
  | 'lora'
  | 'safetensors'
  | 'manifest'
  | 'unknown';

export interface ScannedModelArtifact extends NativeDirectoryCandidate {
  kind: ModelArtifactKind;
  installable: boolean;
  /** A file selected through SAF remains a content-provider item until the user imports it. */
  source: 'selected-folder';
}

export interface InspectedTextModel {
  model: DownloadedModel;
  estimatedRamBytes: number;
  ggufArchitecture?: string;
  ggufFileType?: number;
}

export interface LocalModelInventory {
  textModels: InspectedTextModel[];
  imageModels: Awaited<ReturnType<typeof modelManager.getDownloadedImageModels>>;
  whisperModels: Awaited<ReturnType<typeof listWhisperModels>>;
}

const KNOWN_QNN_MODEL_FILES = new Set([
  'unet.bin',
  'text_encoder.bin',
  'vae_decoder.bin',
  'vae_encoder.bin',
  'controlnet.bin',
]);

/**
 * Classify by artifact signature in the filename, not by a directory name supplied by a provider.
 * This is inventory metadata only: an artifact is not declared runnable until the relevant runtime
 * validates its complete model pack and matching manifest.
 */
export function classifyModelArtifact(fileName: string): {
  kind: ModelArtifactKind;
  installable: boolean;
} {
  const name = fileName.trim();
  const lower = name.toLowerCase();
  if (!name || name.startsWith('.')) return { kind: 'unknown', installable: false };
  if (lower === 'manifest.json') return { kind: 'manifest', installable: false };
  if (isMMProjFile(lower)) return { kind: 'mmproj', installable: false };
  if (lower.endsWith('.gguf')) {
    const firstPart = splitGgufPartNames(name)[0] === name;
    return { kind: 'gguf', installable: firstPart };
  }
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

/**
 * Scan a user-selected SAF tree without copying model weights into cache or app storage.
 * The native bridge enumerates document metadata only; large files stay in their original
 * document provider until the user explicitly imports them.
 */
export async function scanSelectedModelDirectory(grant: string): Promise<ScannedModelArtifact[]> {
  if (!grant.trim()) throw new Error('A selected folder grant is required.');
  const entries = await nativeDirectorySourceBoundary.enumerate(grant);
  return entries
    .filter(entry => entry.fileSize >= 0)
    .map(entry => ({
      ...entry,
      ...classifyModelArtifact(entry.name),
      source: 'selected-folder' as const,
    }))
    .filter(entry => entry.kind !== 'unknown')
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Refresh the registries OGAM already owns, then inspect GGUF headers through llama.rn's
 * metadata-only reader and use the same RAM estimator that gates actual model loading.
 * This deliberately does not load any model into RAM.
 */
export async function scanAppModelInventory(): Promise<LocalModelInventory> {
  await modelManager.refreshModelLists();
  const [models, imageModels, whisperModels] = await Promise.all([
    modelManager.getDownloadedModels(),
    modelManager.getDownloadedImageModels(),
    listWhisperModels(),
  ]);
  const textModels = await Promise.all(models.map(async model => {
    const header = model.engine === 'llama' ? await readModelHeader(model.filePath) : null;
    const estimatedRamMB = await estimateTextModelMemoryMB(model);
    const architecture = header?.['general.architecture'];
    const fileType = header?.['general.file_type'];
    return {
      model,
      estimatedRamBytes: estimatedRamMB * 1024 * 1024,
      ...(typeof architecture === 'string' ? { ggufArchitecture: architecture } : {}),
      ...(typeof fileType === 'number' ? { ggufFileType: fileType } : {}),
    };
  }));
  return { textModels, imageModels, whisperModels };
}
