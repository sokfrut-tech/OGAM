/**
 * Platform-neutral skill contract for Siri-like Jarvis actions.
 *
 * A model may propose an invocation; this module only validates its declared
 * contract. Android permissions, user approval and execution remain the job of
 * the native capability broker and are never inferred from model output.
 */

export type SkillRisk =
  | 'read-only'
  | 'reversible-write'
  | 'external-communication'
  | 'destructive'
  | 'financial';

export type SkillExecutionMode = 'foreground' | 'background' | 'either';

export type SkillConfirmationPolicy = 'never' | 'when-risky' | 'always';

export type SkillValueType = 'string' | 'number' | 'integer' | 'boolean';

export interface SkillPropertySchema {
  type: SkillValueType;
  description?: string;
  enum?: readonly (string | number | boolean)[];
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
}

export interface SkillInputSchema {
  type: 'object';
  properties: Record<string, SkillPropertySchema>;
  required?: readonly string[];
  additionalProperties?: boolean;
}

export interface SkillContract {
  id: string;
  version: number;
  title: string;
  description: string;
  input: SkillInputSchema;
  requiredCapabilities: readonly string[];
  risk: SkillRisk;
  requiresNetwork?: boolean;
  confirmation: SkillConfirmationPolicy;
  executionMode: SkillExecutionMode;
  timeoutMs: number;
  supportsCancellation: boolean;
  supportsUndo: boolean;
}

export interface SkillInvocationValidation {
  valid: boolean;
  errors: string[];
  requiresApproval: boolean;
}

const HIGH_RISK = new Set<SkillRisk>([
  'external-communication',
  'destructive',
  'financial',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function matchesType(value: unknown, type: SkillValueType): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return typeof value === 'number' && Number.isSafeInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
  }
}

/**
 * Approval is a hard boundary: a skill that sends data externally, destroys
 * data or moves money always requires an explicit person-in-the-loop approval,
 * even if a malformed descriptor tries to set confirmation='never'.
 */
export function skillRequiresApproval(skill: Pick<SkillContract, 'risk' | 'confirmation'>): boolean {
  return HIGH_RISK.has(skill.risk) || skill.confirmation === 'always' ||
    (skill.risk === 'reversible-write' && skill.confirmation === 'when-risky');
}

export function validateSkillInvocation(
  skill: SkillContract,
  input: unknown,
  grantedCapabilities: readonly string[],
): SkillInvocationValidation {
  const errors: string[] = [];

  if (!skill.id.trim()) errors.push('Skill id is required.');
  if (!Number.isSafeInteger(skill.version) || skill.version < 1) {
    errors.push('Skill version must be a positive integer.');
  }
  if (!Number.isSafeInteger(skill.timeoutMs) || skill.timeoutMs < 1) {
    errors.push('Skill timeout must be a positive integer.');
  }
  if (!isRecord(input)) {
    errors.push('Skill input must be an object.');
  } else {
    const schema = skill.input;
    for (const name of schema.required ?? []) {
      if (!(name in input) || input[name] === undefined || input[name] === null) {
        errors.push(`Missing required input: ${name}.`);
      }
    }

    for (const [name, value] of Object.entries(input)) {
      const property = schema.properties[name];
      if (!property) {
        if (schema.additionalProperties === false) {
          errors.push(`Unknown input: ${name}.`);
        }
        continue;
      }
      if (!matchesType(value, property.type)) {
        errors.push(`Invalid type for input: ${name}.`);
        continue;
      }
      if (property.enum && !property.enum.some(candidate => candidate === value)) {
        errors.push(`Unsupported value for input: ${name}.`);
      }
      if (typeof value === 'string') {
        if (property.minLength !== undefined && value.length < property.minLength) {
          errors.push(`Input is too short: ${name}.`);
        }
        if (property.maxLength !== undefined && value.length > property.maxLength) {
          errors.push(`Input is too long: ${name}.`);
        }
      }
      if (typeof value === 'number') {
        if (property.minimum !== undefined && value < property.minimum) {
          errors.push(`Input is below minimum: ${name}.`);
        }
        if (property.maximum !== undefined && value > property.maximum) {
          errors.push(`Input is above maximum: ${name}.`);
        }
      }
    }
  }

  const granted = new Set(grantedCapabilities);
  for (const capability of skill.requiredCapabilities) {
    if (!granted.has(capability)) {
      errors.push(`Missing capability: ${capability}.`);
    }
  }
  if (skill.requiresNetwork && !granted.has('network')) {
    errors.push('Missing capability: network.');
  }

  return {
    valid: errors.length === 0,
    errors,
    requiresApproval: skillRequiresApproval(skill),
  };
}
