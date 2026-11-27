import {
  getToolSkillContract,
  getAvailableToolSkillContracts,
  validateBuiltInToolInvocation,
} from '../../../../src/services/skills/toolContracts';

describe('OGAM built-in tools as Jarvis skills', () => {
  it('derives strict schemas from the existing tool registry', () => {
    const skill = getToolSkillContract('calculator');
    expect(skill?.id).toBe('tool.calculator');
    expect(skill?.input.required).toContain('expression');
    expect(skill?.input.additionalProperties).toBe(false);
  });

  it('rejects calls to tools that the person has not enabled', () => {
    const result = validateBuiltInToolInvocation(
      'calculator',
      { expression: '2 + 2' },
      [],
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing capability: tool:calculator.');
  });

  it('accepts valid calls to enabled local tools', () => {
    const result = validateBuiltInToolInvocation(
      'calculator',
      { expression: '2 + 2' },
      ['calculator'],
    );
    expect(result.valid).toBe(true);
  });

  it('requires network capability only when an enabled network tool declares it', () => {
    const result = validateBuiltInToolInvocation(
      'web_search',
      { query: 'open source local assistant' },
      [],
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Missing capability: tool:web_search.',
        'Missing capability: network.',
      ]),
    );
  });

  it('discovers only enabled, currently offered skills without granting new permissions', () => {
    const contracts = getAvailableToolSkillContracts(['calculator', 'web_search', 'not_real']);
    expect(contracts.map(skill => skill.id)).toEqual([
      'tool.web_search',
      'tool.calculator',
    ]);
    expect(contracts.every(skill => skill.requiredCapabilities.length > 0)).toBe(true);
  });

  it('rejects unknown arguments rather than silently ignoring model output', () => {
    const result = validateBuiltInToolInvocation(
      'get_device_info',
      { info_type: 'battery', reveal_private_data: true },
      ['get_device_info'],
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Unknown input: reveal_private_data.');
  });

  it('does not create contracts for unknown or unclassified tools', () => {
    expect(getToolSkillContract('not_a_real_tool')).toBeNull();
  });
});
