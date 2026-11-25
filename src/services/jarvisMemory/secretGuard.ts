import type {
  SecretRiskAssessment,
  SecretRiskCategory,
  SecretRiskFinding,
} from './types';

type PatternRule = {
  category: SecretRiskCategory;
  label: string;
  pattern: RegExp;
};

const VALUE_PATTERN_RULES: readonly PatternRule[] = [
  {
    category: 'private_key',
    label: 'PEM private key header',
    pattern: /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/,
  },
  {
    category: 'api_token',
    label: 'GitHub token prefix',
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/,
  },
  {
    category: 'api_token',
    label: 'OpenAI-style API key prefix',
    pattern: /\bsk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{20,}\b/,
  },
  {
    category: 'api_token',
    label: 'Google API key prefix',
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/,
  },
  {
    category: 'api_token',
    label: 'AWS access key identifier',
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/,
  },
  {
    category: 'api_token',
    label: 'Slack/GitLab/HuggingFace token prefix',
    pattern: /\b(?:xox[baprs]-[A-Za-z0-9-]{10,}|glpat-[A-Za-z0-9_-]{20,}|hf_[A-Za-z0-9]{20,})\b/,
  },
  {
    category: 'jwt',
    label: 'JSON Web Token',
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
  },
  {
    category: 'auth_header_or_uri_secret',
    label: 'Authorization Bearer or Basic credential',
    pattern: /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}/i,
  },
  {
    category: 'auth_header_or_uri_secret',
    label: 'Embedded URI userinfo password',
    pattern: /[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s@]+@[^\s/]+/i,
  },
];

const SECRET_KEY_NAMES = new Set([
  'password',
  'passwd',
  'passphrase',
  'api_key',
  'apikey',
  'secret',
  'secret_key',
  'access_token',
  'refresh_token',
  'id_token',
  'private_key',
  'seed_phrase',
  'mnemonic',
  'recovery_code',
  'recovery_codes',
  'pin_code',
  'cvv',
  'cvc',
  'пароль',
  'пинкод',
  'пин_код',
  'сидфраза',
  'сид_фраза',
  'секретныйключ',
  'секретный_ключ',
  'токендоступа',
  'токен_доступа',
  'приватныйключ',
  'приватный_ключ',
]);

const SECRET_KEY_RE =
  /^(?:password|passwd|passphrase|api[_-]?key|secret(?:[_-]?key)?|(?:access|refresh|id)[_-]?token|private[_-]?key|seed[_-]?phrase|mnemonic|recovery[_-]?codes?|pin[_-]?code|cvv|cvc|пароль|пин[-_]?код|сид[-_]?фраза|секретный[-_\s]?ключ|токен[-_\s]?доступа|приватный[-_\s]?ключ)$/i;

const SEED_CONTEXT_RE = /\b(?:seed|mnemonic|wallet|bip39|кошел[её]к|сид|мнемоник)\b/i;

const CARD_CANDIDATE_RE = /\b(?:\d[ -]*?){13,19}\b/g;

function passesLuhn(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19 || /^0+$/.test(digits)) {
    return false;
  }
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = digits.charCodeAt(i) - 48;
    if (digit < 0 || digit > 9) return false;
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

function containsLuhnCard(text: string): boolean {
  CARD_CANDIDATE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CARD_CANDIDATE_RE.exec(text)) !== null) {
    const digits = match[0].replace(/[^0-9]/g, '');
    if (digits.length >= 13 && digits.length <= 19 && passesLuhn(digits)) {
      return true;
    }
  }
  return false;
}

function isLikelySeedPhrase(text: string, contextHint: string): boolean {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length !== 12 && words.length !== 24) return false;
  if (!words.every(word => /^[a-z]{2,12}$/.test(word))) return false;
  return SEED_CONTEXT_RE.test(contextHint) || SEED_CONTEXT_RE.test(text);
}

export const SECRET_SCAN_MAX_DEPTH = 8;
export const SECRET_SCAN_MAX_NODES = 500;

const ZERO_WIDTH_OR_BIDI_RE = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g;
const LATIN_CHAR_RE = /[A-Za-z]/;
const CYRILLIC_CHAR_RE = /[\u0400-\u04FF]/;

const CONFUSABLE_CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a',
  е: 'e',
  ё: 'e',
  о: 'o',
  р: 'p',
  с: 'c',
  х: 'x',
  у: 'y',
  к: 'k',
  т: 't',
  м: 'm',
  н: 'h',
  в: 'b',
  і: 'i',
  ј: 'j',
};

function stripInvisibleChars(raw: string): string {
  return raw.replace(ZERO_WIDTH_OR_BIDI_RE, '');
}

function foldMixedScriptConfusables(text: string): string {
  if (!LATIN_CHAR_RE.test(text) || !CYRILLIC_CHAR_RE.test(text)) {
    return text;
  }
  return Array.from(text)
    .map(ch => CONFUSABLE_CYRILLIC_TO_LATIN[ch] ?? ch)
    .join('');
}

function normalizeKey(rawKey: string): string {
  return stripInvisibleChars(rawKey)
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function isSensitiveKeyName(rawKey: string): boolean {
  const cleaned = stripInvisibleChars(rawKey).normalize('NFKC').trim();
  const normalized = cleaned.toLowerCase().replace(/[\s-]+/g, '_');
  if (SECRET_KEY_NAMES.has(normalized) || SECRET_KEY_RE.test(cleaned)) {
    return true;
  }
  const foldedClean = foldMixedScriptConfusables(cleaned.toLowerCase());
  const foldedNormalized = foldedClean.replace(/[\s-]+/g, '_');
  return SECRET_KEY_NAMES.has(foldedNormalized) || SECRET_KEY_RE.test(foldedClean);
}

function hasNonEmptySecretValue(val: unknown): boolean {
  if (val == null) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  if (typeof val === 'number') return Number.isFinite(val);
  if (typeof val === 'object') return Object.keys(val as Record<string, unknown>).length > 0;
  return false;
}

function scanString(
  field: string,
  text: string,
  contextHint: string,
  findings: SecretRiskFinding[],
): void {
  const normalizedText = stripInvisibleChars(text).normalize('NFKC');
  for (const rule of VALUE_PATTERN_RULES) {
    if (rule.pattern.test(text) || rule.pattern.test(normalizedText)) {
      findings.push({ category: rule.category, field, label: rule.label });
    }
  }
  if (containsLuhnCard(normalizedText)) {
    findings.push({
      category: 'payment_card',
      field,
      label: 'Luhn-valid payment card number',
    });
  }
  if (isLikelySeedPhrase(normalizedText, contextHint)) {
    findings.push({
      category: 'seed_phrase',
      field,
      label: 'Wallet recovery seed phrase candidate',
    });
  }
}

type TraversalFrame = {
  value: unknown;
  fieldPath: string;
  contextHint: string;
  depth: number;
  ancestors: Set<object>;
};

/**
 * Fail-closed bounded iterative traversal: rejects circular objects, nesting deeper than
 * SECRET_SCAN_MAX_DEPTH, or structures exceeding SECRET_SCAN_MAX_NODES instead of skipping checks.
 */
function scanValueBounded(
  rootValue: unknown,
  rootPath: string,
  rootContextHint: string,
  findings: SecretRiskFinding[],
): void {
  const stack: TraversalFrame[] = [
    {
      value: rootValue,
      fieldPath: rootPath,
      contextHint: rootContextHint,
      depth: 0,
      ancestors: new Set<object>(),
    },
  ];
  let visitedNodes = 0;

  while (stack.length > 0) {
    const frame = stack.pop()!;
    const { value, fieldPath, contextHint, depth, ancestors } = frame;
    if (value == null) continue;

    if (depth > SECRET_SCAN_MAX_DEPTH) {
      findings.push({
        category: 'uninspectable_structure',
        field: fieldPath,
        label: 'Value nesting depth exceeds secret-inspection limit (fail-closed)',
      });
      continue;
    }

    visitedNodes += 1;
    if (visitedNodes > SECRET_SCAN_MAX_NODES) {
      findings.push({
        category: 'uninspectable_structure',
        field: fieldPath,
        label: 'Value node budget exceeded during secret inspection (fail-closed)',
      });
      break;
    }

    if (typeof value === 'string') {
      scanString(fieldPath, value, contextHint, findings);
      continue;
    }

    if (typeof value === 'object') {
      const objRef = value as object;
      if (ancestors.has(objRef)) {
        findings.push({
          category: 'uninspectable_structure',
          field: fieldPath,
          label: 'Circular value reference cannot be safely inspected (fail-closed)',
        });
        continue;
      }

      const nextAncestors = new Set(ancestors);
      nextAncestors.add(objRef);

      if (Array.isArray(value)) {
        for (let i = value.length - 1; i >= 0; i -= 1) {
          stack.push({
            value: value[i],
            fieldPath: `${fieldPath}[${i}]`,
            contextHint,
            depth: depth + 1,
            ancestors: nextAncestors,
          });
        }
        continue;
      }

      const entries = Object.entries(value as Record<string, unknown>);
      for (const [key, entryValue] of entries) {
        if (isSensitiveKeyName(key) && hasNonEmptySecretValue(entryValue)) {
          findings.push({
            category: 'secret_field_name',
            field: `${fieldPath}.${key}`,
            label: 'Sensitive credential field name',
          });
        }
      }
      for (let i = entries.length - 1; i >= 0; i -= 1) {
        const [key, entryValue] = entries[i]!;
        stack.push({
          value: entryValue,
          fieldPath: `${fieldPath}.${key}`,
          contextHint: `${contextHint} ${key}`,
          depth: depth + 1,
          ancestors: nextAncestors,
        });
      }
    }
  }
}

/** Error raised when a memory proposal or edit contains likely credential or secret material. */
export class SecretMemoryBlockedError extends Error {
  readonly findings: readonly SecretRiskFinding[];

  constructor(findings: SecretRiskFinding[]) {
    const labels = Array.from(new Set(findings.map(item => item.label))).join('; ');
    super(`Jarvis memory refuses to store sensitive secrets or credentials (${labels}).`);
    this.name = 'SecretMemoryBlockedError';
    this.findings = findings;
  }
}

/**
 * Inspects a candidate memory entry for passwords, API tokens, private keys, payment cards,
 * recovery phrases, or uninspectable deep/circular payloads without copying raw secrets.
 */
export function assessSecretRisk(input: {
  subject: string;
  predicate: string;
  value: unknown;
}): SecretRiskAssessment {
  const findings: SecretRiskFinding[] = [];
  const contextHint = `${input.subject} ${input.predicate}`;

  scanString('subject', input.subject, contextHint, findings);
  scanString('predicate', input.predicate, contextHint, findings);
  if (isSensitiveKeyName(input.predicate) && hasNonEmptySecretValue(input.value)) {
    findings.push({
      category: 'secret_field_name',
      field: 'predicate',
      label: 'Sensitive credential predicate',
    });
  }
  scanValueBounded(input.value, 'value', contextHint, findings);

  const deduped: SecretRiskFinding[] = [];
  const seen = new Set<string>();
  for (const item of findings) {
    const key = `${item.category}:${item.field}:${item.label}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(item);
    }
  }

  if (deduped.length === 0) {
    return { blocked: false, findings: [], warningMessage: null };
  }

  return {
    blocked: true,
    findings: deduped,
    warningMessage:
      'Запрещено сохранять пароли, токены, приватные ключи, номера карт и коды восстановления в долговременную память.',
  };
}

/** Throws SecretMemoryBlockedError if the entry looks like a credential or secret. */
export function assertNoSecretRisk(input: {
  subject: string;
  predicate: string;
  value: unknown;
}): SecretRiskAssessment {
  const assessment = assessSecretRisk(input);
  if (assessment.blocked) {
    throw new SecretMemoryBlockedError(assessment.findings);
  }
  return assessment;
}
