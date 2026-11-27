/**
 * OGAM-owned Stable Diffusion checkpoint header verification, diffusion-transformer pack
 * companion rules, platform availability, and default sampler/scheduler policy.
 */

export const QWEN_IMAGE_21_WEIGHT = /^qwen[-_.]?image[-_.]?2\.1-.*\.gguf$/i;
export const SD_CHECKPOINT_HEADER_BYTES = 1024 * 1024;

export type SdImagePackFamily = 'qwen-image-2.1' | 'flux2-klein' | 'z-image';

export interface SdImagePackSpec {
  family: SdImagePackFamily;
  vae: RegExp;
  llm: RegExp;
}

export interface ImageEngineDefaults {
  sampler: string;
  scheduler: string;
}

const FLUX2_KLEIN_WEIGHT = /^flux[-_]?2[-_]?klein.*\.gguf$/i;
const Z_IMAGE_WEIGHT = /^z[-_.]?image.*\.gguf$/i;
const SUPPORTED_IMAGE_PLATFORMS = new Set(['ios', 'android', 'macos', 'windows', 'linux']);
const SUPPORTED_IMAGE_EXT = /\.(?:gguf|safetensors|zip)$/i;

/** Returns companion requirements for multi-file DiT image packs, or null for single-file SD checkpoints. */
export function sdImagePackFor(weight: string): SdImagePackSpec | null {
  const base = weight.replace(/\\/g, '/').split('/').pop()?.trim() ?? '';
  if (!base) return null;
  if (QWEN_IMAGE_21_WEIGHT.test(base)) {
    return {
      family: 'qwen-image-2.1',
      vae: /vae.*\.safetensors$/i,
      llm: /^Qwen3VL-.*\.gguf$/i,
    };
  }
  if (FLUX2_KLEIN_WEIGHT.test(base)) {
    return {
      family: 'flux2-klein',
      vae: /flux2[-_]?vae\.safetensors$/i,
      llm: /^qwen3[-_]?4b.*\.gguf$/i,
    };
  }
  if (Z_IMAGE_WEIGHT.test(base)) {
    return {
      family: 'z-image',
      vae: /^(?:ae|z[-_]?image[-_]?vae)\.safetensors$/i,
      llm: /^qwen3[-_]?4b.*\.gguf$/i,
    };
  }
  return null;
}

/** Filename heuristic for runnable sd.cpp checkpoints and DiT image weights (rejects companions/LoRAs/split parts). */
export function isSDImageWeight(name: string): boolean {
  if (sdImagePackFor(name) !== null) return true;
  return (
    /\.(?:gguf|safetensors)$/i.test(name) &&
    !/[/\\]|(?:vae|clip|t5|encoder|mmproj|lora|adapter|qwen|flux|wan|hunyuan|ltx|z_image|sd3|\d{5}-of-\d{5})/i.test(name)
  );
}

/** Returns whether an image model primary file is eligible to run on `os`. */
export function isImageWeightAvailableOn(weight: string, os: string): boolean {
  const trimmed = weight.trim();
  if (!trimmed || !SUPPORTED_IMAGE_PLATFORMS.has(os)) return false;
  if (!SUPPORTED_IMAGE_EXT.test(trimmed)) return false;
  if (/[-_.]ios(?:[-_.]|$)/i.test(trimmed) && os !== 'ios') return false;
  if (/[-_.]android(?:[-_.]|$)/i.test(trimmed) && os !== 'android') return false;
  return true;
}

/** Sampler and scheduler defaults tuned per sd.cpp image architecture family. */
export function imageEngineSettings(weight: string): ImageEngineDefaults {
  if (sdImagePackFor(weight) !== null) {
    return { sampler: 'euler', scheduler: 'discrete' };
  }
  if (/(?:lightning|turbo|lcm|hyper|schnell)/i.test(weight)) {
    return { sampler: 'euler', scheduler: 'sgm_uniform' };
  }
  return { sampler: 'euler_a', scheduler: 'karras' };
}

function hasCompleteCheckpointTensors(names: readonly string[]): boolean {
  return (
    names.some(name => /^model\.diffusion_model\.input_blocks\./.test(name)) &&
    names.some(name => /^first_stage_model\.decoder\./.test(name)) &&
    names.some(name => /^(?:cond_stage_model\.|conditioner\.embedders\.)/.test(name))
  );
}

/**
 * Validates bounded header bytes (GGUF v2/v3 or safetensors JSON header) for complete UNet + VAE +
 * CLIP SD checkpoints. Fails closed on truncated, malformed, or non-checkpoint payloads.
 */
export function isCompleteSDCheckpointHeader(bytes: Uint8Array): boolean {
  try {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength < 8) return false;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const decoder = new TextDecoder();
    let offset = 0;

    const take = (size: number): number => {
      if (!Number.isSafeInteger(size) || size < 0 || offset + size > bytes.byteLength) {
        throw new Error('Incomplete header');
      }
      const start = offset;
      offset += size;
      return start;
    };
    const u32 = (): number => view.getUint32(take(4), true);
    const u64 = (): number => {
      const pos = take(8);
      return view.getUint32(pos, true) + view.getUint32(pos + 4, true) * 4294967296;
    };
    const readString = (): string => {
      const length = u64();
      const start = take(length);
      return decoder.decode(bytes.subarray(start, offset));
    };

    const isGguf =
      bytes[0] === 0x47 &&
      bytes[1] === 0x47 &&
      bytes[2] === 0x55 &&
      bytes[3] === 0x46;

    let names: string[];
    if (isGguf) {
      take(4);
      const version = u32();
      if (version !== 2 && version !== 3) return false;
      const tensors = u64();
      const metadata = u64();
      if (tensors > 20000 || metadata > 10000) return false;

      const skipValue = (type: number, depth = 0): void => {
        if (depth > 1) throw new Error('Invalid metadata depth');
        const scalarSizes: Record<number, number> = {
          0: 1,
          1: 1,
          2: 2,
          3: 2,
          4: 4,
          5: 4,
          6: 4,
          7: 1,
          10: 8,
          11: 8,
          12: 8,
        };
        if (type === 8) {
          readString();
          return;
        }
        if (type === 9) {
          const subtype = u32();
          const count = u64();
          if (count > SD_CHECKPOINT_HEADER_BYTES) throw new Error('Oversized metadata array');
          for (let i = 0; i < count; i++) {
            skipValue(subtype, depth + 1);
          }
          return;
        }
        const scalarSize = scalarSizes[type];
        if (!scalarSize) throw new Error('Unknown metadata type');
        take(scalarSize);
      };

      for (let i = 0; i < metadata; i++) {
        readString();
        skipValue(u32());
      }

      names = [];
      for (let i = 0; i < tensors; i++) {
        names.push(readString());
        const dimensions = u32();
        if (dimensions > 4) return false;
        take(dimensions * 8 + 4 + 8);
      }
    } else {
      const length = u64();
      if (length <= 0 || length > SD_CHECKPOINT_HEADER_BYTES) return false;
      const start = take(length);
      const parsed = JSON.parse(decoder.decode(bytes.subarray(start, offset))) as unknown;
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return false;
      }
      names = Object.keys(parsed);
    }

    return hasCompleteCheckpointTensors(names);
  } catch {
    return false;
  }
}
