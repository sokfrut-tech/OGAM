/**
 * Filename-level classification for GGUF companion artifacts.
 *
 * These files are auxiliary weights or quantization calibration data, not standalone
 * models. Patterns follow the public GGUF sidecar naming convention and llama.cpp's
 * documented MTP/NextN and imatrix workflows. This deliberately does not inspect
 * GGUF metadata; the native loader remains the authority for file contents.
 */
function basename(value: string): string {
  return value.replace(/\\/g, '/').split('/').pop() ?? value;
}

function hasToken(name: string, token: string): boolean {
  return new RegExp(`(?:^|[-_])${token}(?:[-_.]|$)`, 'i').test(name);
}

/** Separate MTP head sidecars (including MTP-only/draft naming) are not primary weights. */
export function isMtpHeadFile(value: string): boolean {
  const name = basename(value.trim());
  return hasToken(name, 'mtp');
}

/** Speculative decoding draft sidecars are loaded alongside a primary model. */
export function isDraftModelFile(value: string): boolean {
  const name = basename(value.trim());
  return ['draft', 'dflash', 'dspark', 'eagle3'].some(token => hasToken(name, token));
}

/** Importance matrices are quantization calibration data, not inference weights. */
export function isImatrixFile(value: string): boolean {
  const name = basename(value.trim());
  return hasToken(name, 'imatrix');
}

/** Any recognized auxiliary GGUF artifact that must not be adopted as a primary model. */
export function isCompanionFile(value: string): boolean {
  return isMtpHeadFile(value) || isDraftModelFile(value) || isImatrixFile(value);
}
