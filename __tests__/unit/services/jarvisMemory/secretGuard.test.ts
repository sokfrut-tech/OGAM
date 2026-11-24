import {
  SecretMemoryBlockedError,
  assessSecretRisk,
  assertNoSecretRisk,
} from '../../../../src/services/jarvisMemory/secretGuard';

describe('Jarvis memory M2 secret guard (MEM-014)', () => {
  it('allows safe personal facts and technical project notes', () => {
    const assessment = assessSecretRisk({
      subject: 'OPPO Find X6 Pro PGEM10',
      predicate: 'uses_architecture',
      value: { soc: 'Snapdragon 8 Gen 2', abi: 'arm64-v8a', pageSizeKb: 16 },
    });
    expect(assessment.blocked).toBe(false);
    expect(assessment.findings).toEqual([]);
    expect(assessment.warningMessage).toBeNull();
  });

  it('blocks PEM private keys, API tokens, JWTs, and URI credentials without leaking raw secrets', () => {
    const fakeGithub = 'ghp_1234567890abcdefghij1234567890abcdef';
    const fakeOpenAi = 'sk-proj-1234567890abcdefghijklmnop';
    const fakeJwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMTIzIn0.signaturevalue1234';
    const fakePem = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA\n-----END RSA PRIVATE KEY-----';
    const fakeUri = 'https://alice:SuperSecretPass99@example.com/api';

    for (const secret of [fakeGithub, fakeOpenAi, fakeJwt, fakePem, fakeUri]) {
      let thrown: unknown;
      try {
        assertNoSecretRisk({
          subject: 'service config',
          predicate: 'endpoint_note',
          value: { raw: secret },
        });
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(SecretMemoryBlockedError);
      const err = thrown as SecretMemoryBlockedError;
      expect(err.message).not.toContain(secret);
      expect(JSON.stringify(err.findings)).not.toContain(secret);
    }
  });

  it('blocks explicit English and Russian credential field names when populated', () => {
    const res1 = assessSecretRisk({
      subject: 'work wifi',
      predicate: 'config',
      value: { password: 'my-network-password' },
    });
    expect(res1.blocked).toBe(true);
    expect(res1.findings[0]?.category).toBe('secret_field_name');

    const res2 = assessSecretRisk({
      subject: 'банковский вход',
      predicate: 'пароль',
      value: 'secret-value-1',
    });
    expect(res2.blocked).toBe(true);
    expect(res2.warningMessage).toContain('Запрещено сохранять');
  });

  it('blocks Luhn-valid payment card numbers while ignoring ordinary invalid-Luhn numbers', () => {
    const luhnValid = assessSecretRisk({
      subject: 'карточка',
      predicate: 'номер',
      value: '4111 1111 1111 1111',
    });
    expect(luhnValid.blocked).toBe(true);
    expect(luhnValid.findings.some(f => f.category === 'payment_card')).toBe(true);

    const nonCardNumber = assessSecretRisk({
      subject: 'commit',
      predicate: 'build_timestamp',
      value: '17639900001234',
    });
    expect(nonCardNumber.blocked).toBe(false);
  });

  it('blocks 12-word seed phrases only with wallet/seed context and ignores normal 12-word notes', () => {
    const seed = assessSecretRisk({
      subject: 'crypto wallet backup',
      predicate: 'seed_phrase',
      value: 'abandon ability able about above absent absorb abstract absurd abuse access accident',
    });
    expect(seed.blocked).toBe(true);

    const benign = assessSecretRisk({
      subject: 'meeting schedule',
      predicate: 'summary',
      value: 'today team reviewed local model startup timing budget memory layout and tests',
    });
    expect(benign.blocked).toBe(false);
  });
});
