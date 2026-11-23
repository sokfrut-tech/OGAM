/**
 * OGAM-owned model quantization preference, MTP draft default, and Hugging Face card helpers.
 *
 * Replaces `@offgrid/models` exports for `modelCatalogFiles.ts`, `modelCardReasoning.ts`,
 * `SpeculativeDecodingToggle.tsx`, `llmHelpers.ts`, and `appStore.ts`.
 */

export const MOBILE_MTP_DRAFT_TOKENS = 3;

const DENIES_REASONING_PATTERN =
  /\b(?:is\s+(?:a\s+)?|are\s+)?non[- ]reasoning(?:\s+model)?\b|\bnot\s+a\s+(?:reasoning|thinking)\s+model\b|\bdoes\s+not\s+(?:support|use|have)\s+(?:reasoning|thinking)\b|\bwithout\s+(?:thinking|reasoning)\s+mode\b/i;

/**
 * Android CPU and Hexagon NPU prefer `Q4_0` first (native ARM repacking / HTP support);
 * iOS and GPU backends prefer `Q4_K_M`.
 */
export function prefersQ4_0(platform: string, backend?: string | null): boolean {
  return platform === 'android' && backend !== 'gpu';
}

/** Raw README URL for a Hugging Face repository at the pinned revision (defaults to `main`). */
export function modelCardUrl(repoId: string, revision = 'main'): string {
  const cleanRepo = repoId.trim().replace(/^\/+|\/+$/g, '');
  const cleanRevision = revision.trim() || 'main';
  return `https://huggingface.co/${cleanRepo}/raw/${encodeURIComponent(cleanRevision)}/README.md`;
}

/** Detect explicit statements in a model card README declaring that the model does not reason. */
export function modelCardDeniesReasoning(card: string): boolean {
  return DENIES_REASONING_PATTERN.test(card);
}
