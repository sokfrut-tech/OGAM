/**
 * OGAM-owned per-model image generation parameter defaults and override helpers.
 *
 * Replaces `@offgrid/models` image-parameter helpers with zero external dependencies while
 * honoring `imageParameterPolicy.ts` and `imageParameterPolicy.test.ts` invariants.
 */

export interface ImageParameterValues {
  steps: number;
  cfgScale: number;
  size: number;
}

export type ImageParameterOverride = Partial<ImageParameterValues>;
export type ImageParameterStore = Record<string, ImageParameterOverride>;

export interface ImageModelDefaults {
  fewStep: boolean;
  defaultSteps: number;
  defaultCfg: number;
  defaultSize: number;
}

const FEW_STEP_PATTERN = /\b(?:lightning|turbo|lcm|hyper|schnell)\b/i;
const ZERO_CFG_PATTERN = /\b(?:flux|schnell|qwen)\b/i;
const XL_CLASS_PATTERN = /(?:sdxl|xl\b|flux|qwen)/i;

function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** Derive default steps, CFG scale, and resolution class from an image model name or ID. */
export function standardImageModelDefaults(nameOrId: string): ImageModelDefaults {
  const fewStep = FEW_STEP_PATTERN.test(nameOrId);
  const defaultSteps = fewStep ? 4 : 20;
  const defaultCfg = ZERO_CFG_PATTERN.test(nameOrId)
    ? 1.0
    : fewStep
      ? 2.0
      : 7.0;
  const defaultSize = XL_CLASS_PATTERN.test(nameOrId) ? 768 : 512;
  return {
    fewStep,
    defaultSteps,
    defaultCfg,
    defaultSize,
  };
}

/** Prefer a positive finite override parameter, otherwise fall back cleanly. */
export function effectiveImageParameter(
  override: number | undefined,
  fallback: number,
): number {
  return isPositiveFinite(override) ? override : fallback;
}

/** Resolve active parameters for an `sd.cpp` model using stored per-model overrides. */
export function resolveImageParameters(
  model: { id: string; name?: string },
  overrides?: ImageParameterStore | null,
): ImageParameterValues {
  const defaults = standardImageModelDefaults(model.name || model.id);
  const stored = overrides?.[model.id];
  return {
    steps: effectiveImageParameter(stored?.steps, defaults.defaultSteps),
    cfgScale: effectiveImageParameter(stored?.cfgScale, defaults.defaultCfg),
    size: effectiveImageParameter(stored?.size, defaults.defaultSize),
  };
}

/** Immutably update one parameter key (`steps`, `cfgScale`, or `size`) for a single model ID. */
export function setImageParameterOverride(
  store: ImageParameterStore | null | undefined,
  modelId: string,
  key: keyof ImageParameterValues,
  value: number,
): ImageParameterStore {
  return {
    ...(store ?? {}),
    [modelId]: {
      ...(store?.[modelId] ?? {}),
      [key]: value,
    },
  };
}
