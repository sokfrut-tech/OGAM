import {
  skillRequiresApproval,
  validateSkillInvocation,
  type SkillContract,
} from '../../../../src/services/skills/contract';

const baseSkill: SkillContract = {
  id: 'calendar.create',
  version: 1,
  title: 'Create calendar event',
  description: 'Create a calendar event after review.',
  input: {
    type: 'object',
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 120 },
      startTime: { type: 'string' },
      attendees: { type: 'integer', minimum: 0, maximum: 50 },
    },
    required: ['title', 'startTime'],
    additionalProperties: false,
  },
  requiredCapabilities: ['calendar.write'],
  risk: 'reversible-write',
  confirmation: 'always',
  executionMode: 'foreground',
  timeoutMs: 10_000,
  supportsCancellation: true,
  supportsUndo: true,
};

describe('Jarvis skill contract', () => {
  it('accepts a valid invocation only when declared capabilities are granted', () => {
    expect(
      validateSkillInvocation(
        baseSkill,
        { title: 'Team sync', startTime: '2026-11-23T10:00:00', attendees: 4 },
        ['calendar.write'],
      ),
    ).toEqual({ valid: true, errors: [], requiresApproval: true });
  });

  it('rejects missing inputs, invalid types and unknown fields', () => {
    const result = validateSkillInvocation(
      baseSkill,
      { title: '', attendees: 1.5, unexpected: true },
      [],
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Missing required input: startTime.',
        'Input is too short: title.',
        'Invalid type for input: attendees.',
        'Unknown input: unexpected.',
        'Missing capability: calendar.write.',
      ]),
    );
  });

  it('requires approval for external and destructive actions even if descriptor says never', () => {
    expect(skillRequiresApproval({ risk: 'external-communication', confirmation: 'never' })).toBe(true);
    expect(skillRequiresApproval({ risk: 'destructive', confirmation: 'never' })).toBe(true);
    expect(skillRequiresApproval({ risk: 'financial', confirmation: 'never' })).toBe(true);
  });

  it('allows read-only actions without approval when explicitly configured', () => {
    expect(skillRequiresApproval({ risk: 'read-only', confirmation: 'never' })).toBe(false);
  });

  it('requires network capability when the skill declares network access', () => {
    const result = validateSkillInvocation(
      { ...baseSkill, requiredCapabilities: [], requiresNetwork: true },
      { title: 'Research', startTime: 'now' },
      [],
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing capability: network.');
  });

  it('rejects invalid descriptor timeouts and versions', () => {
    const result = validateSkillInvocation(
      { ...baseSkill, version: 0, timeoutMs: 0 },
      { title: 'Research', startTime: 'now' },
      ['calendar.write'],
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Skill version must be a positive integer.',
        'Skill timeout must be a positive integer.',
      ]),
    );
  });
});
