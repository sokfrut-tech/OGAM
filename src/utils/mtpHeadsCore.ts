/**
 * OGAM-owned catalog of separately published MTP (Multi-Token Prediction) draft heads.
 * File names, byte sizes, URLs, and LFS SHA-256 digests are verified directly against
 * the public Hugging Face model trees.
 */

import type { MtpHeadFile } from '../types/modelCatalog';

export type { MtpHeadFile } from '../types/modelCatalog';

interface PublishedMtpEntry {
  modelKey: string;
  repoId: string;
  head: MtpHeadFile;
}

export const MTP_HEAD_CATALOG: readonly PublishedMtpEntry[] = [
  {
    modelKey: 'gemma-4-e2b-it',
    repoId: 'unsloth/gemma-4-E2B-it-GGUF',
    head: {
      name: 'mtp-gemma-4-E2B-it-Q8_0.gguf',
      url: 'https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/MTP/mtp-gemma-4-E2B-it-Q8_0.gguf',
      sizeBytes: 97817664,
      sha256: '9eba819938efccfd6044f8af84e3bbfddc639a2bcf32ebc36420e6a649191919',
    },
  },
  {
    modelKey: 'gemma-4-e4b-it',
    repoId: 'unsloth/gemma-4-E4B-it-GGUF',
    head: {
      name: 'mtp-gemma-4-E4B-it-Q8_0.gguf',
      url: 'https://huggingface.co/unsloth/gemma-4-E4B-it-GGUF/resolve/main/MTP/mtp-gemma-4-E4B-it-Q8_0.gguf',
      sizeBytes: 98653248,
      sha256: 'b6a723115efa510d3b3215db1e26790dae84cd08c2134a764f3d194f1f0c3376',
    },
  },
  {
    modelKey: 'gemma-4-26b-a4b-it',
    repoId: 'unsloth/gemma-4-26B-A4B-it-GGUF',
    head: {
      name: 'mtp-gemma-4-26B-A4B-it-Q8_0.gguf',
      url: 'https://huggingface.co/unsloth/gemma-4-26B-A4B-it-GGUF/resolve/main/MTP/mtp-gemma-4-26B-A4B-it-Q8_0.gguf',
      sizeBytes: 461766816,
      sha256: '6326fb9f5e487aa8dcdd313a091e3c67724cb2a666ec3b7d2895b5b26d93ed1b',
    },
  },
  {
    modelKey: 'gemma-4-31b-it',
    repoId: 'unsloth/gemma-4-31B-it-GGUF',
    head: {
      name: 'mtp-gemma-4-31B-it-Q8_0.gguf',
      url: 'https://huggingface.co/unsloth/gemma-4-31B-it-GGUF/resolve/main/MTP/mtp-gemma-4-31B-it-Q8_0.gguf',
      sizeBytes: 514687104,
      sha256: '5ae8b0117bed601e8924c6305bd5b0585de361d51f0e77091bcb4252cf1f27de',
    },
  },
];

function isCompanionArtifact(baseName: string): boolean {
  return /(?:^|[-_])(?:mtp|draft|dflash|dspark|eagle3|imatrix|mmproj)(?:[-_.]|$)/i.test(baseName);
}

/** Returns the published MTP head file metadata for a primary GGUF filename, or null when none exists. */
export function mtpHeadForPrimaryFile(fileName: string): MtpHeadFile | null {
  const baseName = fileName.replace(/\\/g, '/').split('/').pop()?.trim() ?? '';
  if (!baseName || !/\.gguf$/i.test(baseName) || isCompanionArtifact(baseName)) {
    return null;
  }
  const normalized = baseName.toLowerCase();
  const match = MTP_HEAD_CATALOG.find(entry => normalized.includes(entry.modelKey));
  return match ? { ...match.head } : null;
}

/** Returns the published MTP head file metadata for a catalog/repo model ID, or null when none exists. */
export function mtpHeadForModel(modelId: string): MtpHeadFile | null {
  const trimmed = modelId.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  const byRepoOrKey = MTP_HEAD_CATALOG.find(
    entry => lower === entry.repoId.toLowerCase() || lower.includes(entry.modelKey),
  );
  return byRepoOrKey ? { ...byRepoOrKey.head } : null;
}
