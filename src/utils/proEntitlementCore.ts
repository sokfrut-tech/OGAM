/**
 * OGAM-owned Pro entitlement and activation failure projection rules.
 *
 * Replaces `@offgrid/sync` `hasProAccess` and `projectPersonalMeshActivationFailure`.
 */

import type {
  PersonalMeshActivationFailureProjection,
  ProDeviceAdmission,
} from '../types/syncContracts';

export interface ProAccessInput {
  hasCredential: boolean;
  admission: ProDeviceAdmission;
}

/**
 * Evaluates whether this installation currently holds Pro access.
 *
 * `unknown` admission keeps offline/cold-start access intact when a valid credential is held;
 * `inactive` revokes access immediately once the device roster reports deactivation.
 */
export function hasProAccess(input: ProAccessInput): boolean {
  return Boolean(input.hasCredential) && input.admission !== 'inactive';
}

/**
 * Projects a personal-mesh / license activation failure reason code into user-facing copy.
 */
export function projectPersonalMeshActivationFailure(
  reason?: string | null,
): PersonalMeshActivationFailureProjection {
  const normalized = typeof reason === 'string' && reason.trim() ? reason.trim() : 'registration_failed';
  switch (normalized) {
    case 'invalid_key':
    case 'license_invalid':
    case 'license_revoked':
    case 'invalid':
    case 'revoked':
      return {
        reason: normalized,
        title: 'License not accepted',
        description: 'That license key is invalid or revoked.',
        retryable: false,
      };
    case 'replacement_failed':
      return {
        reason: normalized,
        title: 'Could not free a device seat',
        description:
          'Every seat on this license is taken and an existing device could not be deactivated. Free a seat from another device and try again.',
        retryable: true,
      };
    case 'license_expired':
    case 'expired':
      return {
        reason: normalized,
        title: 'License expired',
        description: 'This license key has expired. Renew Pro to activate this device.',
        retryable: false,
      };
    case 'seat_limit_reached':
    case 'device_cap_reached':
      return {
        reason: normalized,
        title: 'Device limit reached',
        description: 'All seats on this license are currently in use. Remove another device and try again.',
        retryable: true,
      };
    case 'offline':
    case 'network_error':
      return {
        reason: normalized,
        title: "You're offline",
        description: 'Connect to the internet to activate your license key.',
        retryable: true,
      };
    case 'neither_licensed':
      return {
        reason: normalized,
        title: 'License required',
        description: 'Neither device holds an active Pro license.',
        retryable: false,
      };
    case 'mapping_required':
      return {
        reason: normalized,
        title: 'Device seat unavailable',
        description: 'This device seat could not be located on the license. Try activating again.',
        retryable: true,
      };
    default:
      return {
        reason: normalized,
        title: 'Activation failed',
        description: 'Could not activate this device on the license right now. Please try again.',
        retryable: true,
      };
  }
}
