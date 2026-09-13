import { createHash } from 'node:crypto';
import type { CoordinationV2HostEnrollment } from '@shared/schema';
import { canonicalJson } from './coordination-runtime';
import {
  HOST_PROTOCOL_VERSION,
  type HostEnvelope,
  type HostBinding,
  validateHostEnvelope,
  CoordinationHostProtocolError,
} from './coordination-host-protocol';

export type ExistingHostEnrollment = Pick<CoordinationV2HostEnrollment,
  'id' | 'hostType' | 'protocolVersion' | 'capabilities' | 'enrollmentDigest' | 'status'> & {
  id: string;
};

export type HostCompatibility = {
  compatible: boolean;
  hostId: string;
  protocolVersion: number;
  missingCapabilities: string[];
  unsupportedCapabilities: string[];
  reason: 'compatible' | 'revoked' | 'protocol_version' | 'capabilities' | 'declaration_digest';
};

export class CoordinationHostEnrollmentError extends Error {
  constructor(readonly code: 'HOST_ENROLLMENT_INVALID_DECLARATION' | 'HOST_ENROLLMENT_INCOMPATIBLE') {
    super(code);
    this.name = 'CoordinationHostEnrollmentError';
  }
}

function digest(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

/** Pure validation only.  This service deliberately has no database writes. */
export function validateHostEnrollmentDeclaration(
  envelope: unknown,
  options: { now?: number | Date } = {},
): { hostId: string; capabilities: string[]; declarationDigest: string } {
  try {
    const value = validateHostEnvelope(envelope, options);
    if (value.kind !== 'enrollment_declaration') throw new CoordinationHostProtocolError('HOST_PROTOCOL_INVALID_FIELD');
    const payload = value.payload as Record<string, unknown>;
    const capabilities = [...(payload.capabilities as string[])].sort();
    const expected = digest({ hostId: payload.hostId, capabilities, protocolVersion: HOST_PROTOCOL_VERSION });
    if (payload.declarationDigest !== expected) throw new CoordinationHostProtocolError('HOST_PROTOCOL_DIGEST_MISMATCH');
    return { hostId: payload.hostId as string, capabilities, declarationDigest: payload.declarationDigest as string };
  } catch (error) {
    if (error instanceof CoordinationHostProtocolError) {
      throw new CoordinationHostEnrollmentError('HOST_ENROLLMENT_INVALID_DECLARATION');
    }
    throw error;
  }
}

export function evaluateHostCompatibility(
  enrollment: ExistingHostEnrollment,
  declaration: { hostId: string; capabilities: readonly string[]; declarationDigest: string },
  requiredCapabilities: readonly string[] = [],
): HostCompatibility {
  const missingCapabilities = requiredCapabilities.filter((capability) => !declaration.capabilities.includes(capability));
  const unsupportedCapabilities = declaration.capabilities.filter((capability) => !enrollment.capabilities.includes(capability));
  const declarationDigest = digest({
    hostId: declaration.hostId,
    capabilities: [...declaration.capabilities].sort(),
    protocolVersion: HOST_PROTOCOL_VERSION,
  });
  let reason: HostCompatibility['reason'] = 'compatible';
  if (enrollment.status !== 'active') reason = 'revoked';
  else if (enrollment.protocolVersion !== HOST_PROTOCOL_VERSION) reason = 'protocol_version';
  else if (enrollment.enrollmentDigest !== declaration.declarationDigest || declarationDigest !== declaration.declarationDigest) reason = 'declaration_digest';
  else if (missingCapabilities.length || unsupportedCapabilities.length) reason = 'capabilities';
  return {
    compatible: reason === 'compatible',
    hostId: enrollment.id,
    protocolVersion: enrollment.protocolVersion,
    missingCapabilities,
    unsupportedCapabilities,
    reason,
  };
}

export function assertHostCompatibility(value: HostCompatibility): asserts value is HostCompatibility & { compatible: true } {
  if (!value.compatible) throw new CoordinationHostEnrollmentError('HOST_ENROLLMENT_INCOMPATIBLE');
}

// Kept as a named type export for callers constructing comparison evidence.
export type HostEnrollmentBinding = Pick<HostBinding, 'enrolledHostId' | 'holderInstanceId'>;