import assert from 'node:assert/strict';
import test from 'node:test';

import {
  hasProAccess,
  projectPersonalMeshActivationFailure,
} from '../../src/utils/proEntitlementCore.ts';

test('hasProAccess evaluates all 6 credential × admission combinations', () => {
  assert.equal(hasProAccess({ hasCredential: true, admission: 'unknown' }), true);
  assert.equal(hasProAccess({ hasCredential: true, admission: 'active' }), true);
  assert.equal(hasProAccess({ hasCredential: true, admission: 'inactive' }), false);

  assert.equal(hasProAccess({ hasCredential: false, admission: 'unknown' }), false);
  assert.equal(hasProAccess({ hasCredential: false, admission: 'active' }), false);
  assert.equal(hasProAccess({ hasCredential: false, admission: 'inactive' }), false);
});

test('projectPersonalMeshActivationFailure returns exact ProDetailScreen copy for invalid/revoked keys', () => {
  for (const reason of ['invalid_key', 'license_invalid', 'license_revoked', 'invalid', 'revoked']) {
    const projected = projectPersonalMeshActivationFailure(reason);
    assert.equal(projected.reason, reason);
    assert.equal(projected.title, 'License not accepted');
    assert.equal(projected.description, 'That license key is invalid or revoked.');
    assert.equal(projected.retryable, false);
  }
});

test('projectPersonalMeshActivationFailure projects replacement, expiry, connectivity, and fallback reasons', () => {
  const replacement = projectPersonalMeshActivationFailure('replacement_failed');
  assert.equal(replacement.reason, 'replacement_failed');
  assert.equal(replacement.title, 'Could not free a device seat');
  assert.match(replacement.description, /seat/i);
  assert.equal(replacement.retryable, true);

  const expired = projectPersonalMeshActivationFailure('license_expired');
  assert.equal(expired.title, 'License expired');
  assert.equal(expired.retryable, false);

  const offline = projectPersonalMeshActivationFailure('offline');
  assert.equal(offline.title, "You're offline");
  assert.equal(offline.retryable, true);

  const cap = projectPersonalMeshActivationFailure('seat_limit_reached');
  assert.equal(cap.title, 'Device limit reached');
  assert.equal(cap.retryable, true);

  const neither = projectPersonalMeshActivationFailure('neither_licensed');
  assert.equal(neither.title, 'License required');
  assert.equal(neither.retryable, false);

  const mapping = projectPersonalMeshActivationFailure('mapping_required');
  assert.equal(mapping.title, 'Device seat unavailable');
  assert.equal(mapping.retryable, true);

  for (const fallback of ['registration_failed', 'unexpected_reason', '', undefined, null]) {
    const projected = projectPersonalMeshActivationFailure(fallback);
    assert.equal(
      projected.reason,
      typeof fallback === 'string' && fallback.length > 0 ? fallback : 'registration_failed',
    );
    assert.equal(projected.title, 'Activation failed');
    assert.equal(projected.retryable, true);
  }
});
