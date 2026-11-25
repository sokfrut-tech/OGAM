/**
 * OGAM-owned video model architecture, pack validation, platform availability, and sync rules.
 */

import type { ModelFileEntry, VideoGenerationRequestContract } from '../types/modelCatalog';

export type { VideoGenerationRequestContract } from '../types/modelCatalog';

export const VIDEO_SETTING_KEYS = [
  'videoParams',
  'videoSeed',
  'videoNegative',
  'enhanceVideoPrompts',
] as const;

export type VideoSettingKey = (typeof VIDEO_SETTING_KEYS)[number];

export type VideoArchitecture = 'wan21' | 'wan22' | 'lingbot' | 'ltx' | 'unknown';

export interface VideoModelDefaults {
  width: number;
  height: number;
  steps: number;
  frames: number;
  fps: number;
  guidance: number;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFinitePositive(value: unknown, max: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= max;
}

function acceptsVideoModelParamsPatch(patch: unknown): boolean {
  if (!isPlainRecord(patch)) return false;
  for (const [field, val] of Object.entries(patch)) {
    if (val === undefined) continue;
    if (field === 'width' || field === 'height') {
      if (!isFinitePositive(val, 4096) || !Number.isInteger(val)) return false;
    } else if (field === 'steps' || field === 'frames') {
      if (!isFinitePositive(val, 500) || !Number.isInteger(val)) return false;
    } else if (field === 'fps') {
      if (!isFinitePositive(val, 120)) return false;
    } else if (field === 'guidanceScale' || field === 'flowShift') {
      if (typeof val !== 'number' || !Number.isFinite(val) || val < 0 || val > 50) return false;
    } else if (field === 'seed') {
      if (!Number.isInteger(val) || (val as number) < -1) return false;
    } else if (field === 'negativePrompt' || field === 'prompt') {
      if (typeof val !== 'string') return false;
    }
  }
  return true;
}

/** Validates portable desktop/mobile video settings before applying a sync mutation. */
export function acceptsVideoSetting(key: string, value: unknown): boolean {
  switch (key) {
    case 'videoParams':
      if (!isPlainRecord(value)) return false;
      return Object.values(value).every(entry => acceptsVideoModelParamsPatch(entry));
    case 'videoSeed':
      return Number.isInteger(value) && (value as number) >= -1;
    case 'videoNegative':
      return typeof value === 'string';
    case 'enhanceVideoPrompts':
      return typeof value === 'boolean';
    default:
      return false;
  }
}

/** Classifies a video primary weight filename into its diffusion architecture family. */
export function videoArchitecture(weight: string): VideoArchitecture {
  const lower = weight.toLowerCase();
  if (lower.includes('lingbot')) return 'lingbot';
  if (/wan[-_.]?2[._]?2/.test(lower)) return 'wan22';
  if (/wan[-_.]?2[._]?1|\bwan\b/.test(lower)) return 'wan21';
  if (lower.includes('ltx')) return 'ltx';
  return 'unknown';
}

/** True when the weight supports image-conditioned start-frame video generation (TI2V / I2V). */
export function videoTakesStartImage(weight: string): boolean {
  return /(?:ti2v|i2v|start[-_.]?image)/i.test(weight);
}

/** Trained resolution and sampling defaults for a video weight family. */
export function videoModelDefaults(weight: string): VideoModelDefaults {
  const arch = videoArchitecture(weight);
  const isTurbo = /turbo/i.test(weight);
  if (arch === 'wan22') {
    return {
      width: 1280,
      height: 704,
      steps: isTurbo ? 4 : 20,
      frames: 49,
      fps: 24,
      guidance: 5,
    };
  }
  return {
    width: 832,
    height: 480,
    steps: isTurbo ? 4 : 20,
    frames: 33,
    fps: 16,
    guidance: 5,
  };
}

/** Validates that a video pack declares exactly one valid primary weight and non-empty file sizes. */
export function videoPackError(files: readonly ModelFileEntry[]): string | null {
  if (!Array.isArray(files) || files.length === 0) {
    return 'Video model pack has no files.';
  }
  const primaries = files.filter(file => file.role === 'primary');
  if (primaries.length !== 1) {
    return 'Video model pack must declare exactly one primary weight.';
  }
  for (const file of files) {
    if (!file.name?.trim() || !file.url?.trim() || !file.sizeBytes || file.sizeBytes <= 0) {
      return `Video model pack file "${file.name || 'unknown'}" is missing required download metadata.`;
    }
  }
  return null;
}

const SUPPORTED_VIDEO_PLATFORMS = new Set(['ios', 'android', 'macos', 'windows', 'linux']);
const SUPPORTED_VIDEO_WEIGHT_EXT = /\.(?:gguf|safetensors|bin)$/i;

/** Returns whether the given video primary weight format can run on `os`. */
export function isVideoWeightAvailableOn(weight: string, os: string): boolean {
  const trimmed = weight.trim();
  if (!trimmed || !SUPPORTED_VIDEO_PLATFORMS.has(os)) return false;
  if (!SUPPORTED_VIDEO_WEIGHT_EXT.test(trimmed)) return false;
  if (/[-_.]ios(?:[-_.]|$)/i.test(trimmed) && os !== 'ios') return false;
  if (/[-_.]android(?:[-_.]|$)/i.test(trimmed) && os !== 'android') return false;
  return true;
}
