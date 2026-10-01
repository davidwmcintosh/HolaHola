import type {
  CoordinationActorId,
  CoordinationCredentialCapability,
  RuntimeOnboardingClientType,
  RuntimeOnboardingState,
} from './schema';

export const RUNTIME_ONBOARDING_SIGNATURE_VERSION = 1 as const;
export const RUNTIME_ONBOARDING_SIGNATURE_DOMAIN = 'holahola-coordination-runtime-onboarding' as const;

export type RuntimeOnboardingInvitationInput = {
  actor: CoordinationActorId;
  runtimeId: string;
  displayName: string;
  capabilities?: CoordinationCredentialCapability[];
  provider?: string;
  model?: string;
  clientType?: RuntimeOnboardingClientType;
};

export type RuntimeOnboardingInvitationView = {
  id: string;
  actor: CoordinationActorId;
  runtimeId: string;
  displayName: string;
  capabilities: CoordinationCredentialCapability[];
  expiresAt: string;
  state: RuntimeOnboardingState;
  clientType: RuntimeOnboardingClientType;
};

export type RuntimeOnboardingRequestView = {
  id: string;
  actor: CoordinationActorId;
  runtimeId: string;
  displayName: string;
  verificationCode: string;
  fingerprint: string;
  approvalPath: string;
  state: RuntimeOnboardingState;
  expiresAt: string;
  capabilities: CoordinationCredentialCapability[];
  provider?: string | null;
  model?: string | null;
};

export type RuntimeOnboardingChallengePurpose = 'enroll' | 'recover';

export type RuntimeOnboardingSignedPayload = {
  version: typeof RUNTIME_ONBOARDING_SIGNATURE_VERSION;
  domain: typeof RUNTIME_ONBOARDING_SIGNATURE_DOMAIN;
  endpoint: string;
  invitationId: string;
  requestId: string;
  actor: CoordinationActorId;
  runtimeId: string;
  fingerprint: string;
  purpose: RuntimeOnboardingChallengePurpose;
  nonce: string;
};

/**
 * Produces the sole byte representation both the helper and server sign/verify.
 * Property order is part of version 1; do not replace with a generic serializer.
 */
export function canonicalRuntimeOnboardingPayload(
  payload: RuntimeOnboardingSignedPayload,
): string {
  return JSON.stringify({
    version: payload.version,
    domain: payload.domain,
    endpoint: payload.endpoint,
    invitationId: payload.invitationId,
    requestId: payload.requestId,
    actor: payload.actor,
    runtimeId: payload.runtimeId,
    fingerprint: payload.fingerprint,
    purpose: payload.purpose,
    nonce: payload.nonce,
  });
}

export function buildRuntimeOnboardingSignedPayload(input: Omit<
  RuntimeOnboardingSignedPayload,
  'version' | 'domain'
>): RuntimeOnboardingSignedPayload {
  return {
    version: RUNTIME_ONBOARDING_SIGNATURE_VERSION,
    domain: RUNTIME_ONBOARDING_SIGNATURE_DOMAIN,
    ...input,
  };
}

export function runtimeOnboardingApprovalPath(requestId: string): string {
  return `/admin/runtime-onboarding?request=${encodeURIComponent(requestId)}`;
}