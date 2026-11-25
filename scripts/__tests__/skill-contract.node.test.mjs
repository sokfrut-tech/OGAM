import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSkillInvocation, skillRequiresApproval } from '../../src/services/skills/contract.ts';

const skill = {
  id: 'calendar.create',
  version: 1,
  title: 'Create calendar event',
  description: 'Create an event after review.',
  input: {
    type: 'object',
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 80 },
      start: { type: 'string' },
    },
    required: ['title', 'start'],
    additionalProperties: false,
  },
  requiredCapabilities: ['calendar.write'],
  risk: 'reversible-write',
  confirmation: 'always',
  executionMode: 'foreground',
  timeoutMs: 10000,
  supportsCancellation: true,
  supportsUndo: true,
};

test('skill invocation accepts valid inputs with granted capability', () => {
  assert.deepEqual(
    validateSkillInvocation(skill, { title: 'Meeting', start: '2026-11-23T10:00' }, ['calendar.write']),
    { valid: true, errors: [], requiresApproval: true },
  );
});

test('skill invocation rejects unknown fields and missing capabilities', () => {
  const result = validateSkillInvocation(
    skill,
    { title: 'Meeting', start: 'tomorrow', hidden: true },
    [],
  );
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('Unknown input: hidden.'));
  assert.ok(result.errors.includes('Missing capability: calendar.write.'));
});

test('external communication, destructive and financial skills always require approval', () => {
  for (const risk of ['external-communication', 'destructive', 'financial']) {
    assert.equal(skillRequiresApproval({ risk, confirmation: 'never' }), true);
  }
});

test('read-only skills can run without approval when configured', () => {
  assert.equal(skillRequiresApproval({ risk: 'read-only', confirmation: 'never' }), false);
});
