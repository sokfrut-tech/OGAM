import type { DownloadedModel } from '../types';
import { nativeDirectorySourceBoundary } from './sync/nativeDirectorySource';
import type { NativeDirectoryCandidate } from './sync/nativeDirectorySource';
import { classifyModelArtifact, type ModelArtifactKind } from './modelArtifactClassifier';
export { classifyModelArtifact } from './modelArtifactClassifier';
export type { ModelArtifactKind } from './modelArtifactClassifier';
import { splitGgufPartNames } from '@offgrid/models';
import { modelManager } from './modelManager';
import { listDownloadedModels as listWhisperModels } from './whisperModelFiles';
import { readModelHeader } from './modelHeader';
import { estimateTextModelMemoryMB } from './activeModelService/memory';

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



/**
 * Scan a user-selected SAF tree without copying model weights into cache or app storage.
 * The native bridge enumerates document metadata only; large files stay in their original
 * document provider until the user explicitly imports them.
 */
export async function scanSelectedModelDirectory(grant: string): Promise<ScannedModelArtifact[]> {
  if (!grant.trim()) throw new Error('A selected folder grant is required.');
  const entries = await nativeDirectorySourceBoundary.enumerate(grant);
  const names = new Set(entries.map(entry => entry.name));
  return entries
    .filter(entry => entry.fileSize >= 0 && !entry.name.includes('\0') && entry.name === entry.name.split(/[\\/]/).pop())
    .map(entry => {
      const classification = classifyModelArtifact(entry.name);
      // A split GGUF is importable only when every numbered part is present in the selected tree.
      const splitParts = classification.kind === 'gguf' ? splitGgufPartNames(entry.name) : [entry.name];
      const completeSplit = splitParts.length === 1 && splitParts.every(part => names.has(part));
      return {
        ...entry,
        ...classification,
        installable: classification.installable && completeSplit,
        source: 'selected-folder' as const,
      };
    })
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
  const textModels: InspectedTextModel[] = [];
  // Inspect one native GGUF header at a time: several multi-GB model metadata reads in parallel
  // can contend for file descriptors and the phone's memory even though no weights are loaded.
  for (const model of models) {
    const header = model.engine === 'llama' ? await readModelHeader(model.filePath) : null;
    const estimatedRamMB = await estimateTextModelMemoryMB(model);
    const architecture = header?.['general.architecture'];
    const fileType = header?.['general.file_type'];
    textModels.push({
      model,
      estimatedRamBytes: estimatedRamMB * 1024 * 1024,
      ...(typeof architecture === 'string' ? { ggufArchitecture: architecture } : {}),
      ...(typeof fileType === 'number' ? { ggufFileType: fileType } : {}),
    });
  }
  return { textModels, imageModels, whisperModels };
}
