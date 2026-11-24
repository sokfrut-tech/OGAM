import { validateProposal } from '../../../../src/services/jarvisMemory/repository';
import type { NewMemoryProposal } from '../../../../src/services/jarvisMemory/types';

const validProposal: NewMemoryProposal = {
  kind: 'preference',
  subject: 'response style',
  predicate: 'prefers',
  value: { language: 'ru', concise: true },
  scope: 'global',
};

describe('Jarvis memory proposal validation', () => {
  it('normalizes text and accepts a JSON-safe global proposal', () => {
    expect(validateProposal({ ...validProposal, subject: '  response style  ' })).toEqual({
      subject: 'response style',
      predicate: 'prefers',
      valueJson: JSON.stringify(validProposal.value),
      scopeId: null,
    });
  });

  it('requires a scope id for project and conversation records', () => {
    expect(() => validateProposal({ ...validProposal, scope: 'project' })).toThrow(/require a scope id/);
    expect(() => validateProposal({ ...validProposal, scope: 'conversation' })).toThrow(/require a scope id/);
  });

  it('rejects scope ids on global records', () => {
    expect(() => validateProposal({ ...validProposal, scopeId: 'project-1' })).toThrow(/must not have a scope id/);
  });

  it('rejects empty and overlong subjects and predicates', () => {
    expect(() => validateProposal({ ...validProposal, subject: '   ' })).toThrow(/subject/);
    expect(() => validateProposal({ ...validProposal, subject: 'x'.repeat(257) })).toThrow(/subject/);
    expect(() => validateProposal({ ...validProposal, predicate: 'x'.repeat(129) })).toThrow(/predicate/);
  });

  it('rejects values that cannot be serialized and values over 16 KiB', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => validateProposal({ ...validProposal, value: circular })).toThrow(/JSON serializable/);
    expect(() => validateProposal({ ...validProposal, value: 'x'.repeat(17 * 1024) })).toThrow(/16 KiB/);
  });

  it('rejects expired timestamps and invalid confidence values', () => {
    expect(() => validateProposal({ ...validProposal, expiresAt: Date.now() - 1 })).toThrow(/future/);
    expect(() => validateProposal({ ...validProposal, confidenceMilli: 1001 })).toThrow(/confidence/);
  });
});
