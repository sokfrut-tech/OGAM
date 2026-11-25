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

export interface TemplateStoryboardShot {
  id: string;
  index: number;
  title: string;
  prompt: string;
  durationSeconds: number;
}

export interface TemplateStoryboard {
  title: string;
  summary: string;
  shots: TemplateStoryboardShot[];
}

/** Deterministic fallback storyboard produced when no local text model is loaded. */
export function templateStoryboard(sentence: string): TemplateStoryboard {
  const clean = sentence.trim() || 'A quiet scene in motion';
  return {
    title: clean.length > 48 ? `${clean.slice(0, 45).trimEnd()}...` : clean,
    summary: `Three-shot visual progression for: ${clean}`,
    shots: [
      {
        id: 'shot-1',
        index: 0,
        title: 'Establishing shot',
        prompt: `Wide opening shot establishing the scene: ${clean}`,
        durationSeconds: 3,
      },
      {
        id: 'shot-2',
        index: 1,
        title: 'Action focus',
        prompt: `Medium moving shot highlighting the central subject: ${clean}`,
        durationSeconds: 3,
      },
      {
        id: 'shot-3',
        index: 2,
        title: 'Closing detail',
        prompt: `Close atmospheric final shot resolving: ${clean}`,
        durationSeconds: 3,
      },
    ],
  };
}

export interface DesktopVideoModelInfo {
  id: string;
  name: string;
  supported_durations: number[];
  supported_aspect_ratios: string[];
  supported_resolutions: string[];
  supported_frame_images: string[];
  max_seconds: number;
  width: number;
  height: number;
  fps: number;
}

/** OpenAI/Desktop-compatible capability descriptor for a server-hosted video model. */
export function videoModelInfo(modelId: string): DesktopVideoModelInfo {
  const arch = videoArchitecture(modelId);
  const defaults = videoModelDefaults(modelId);
  const takesStartImage = videoTakesStartImage(modelId) || arch === 'wan22';
  return {
    id: modelId,
    name: modelId,
    supported_durations: [3, 5],
    supported_aspect_ratios: ['16:9', '9:16', '1:1'],
    supported_resolutions: [`${defaults.width}x${defaults.height}`],
    supported_frame_images: takesStartImage ? ['first_frame'] : [],
    max_seconds: 5,
    width: defaults.width,
    height: defaults.height,
    fps: defaults.fps,
  };
}
