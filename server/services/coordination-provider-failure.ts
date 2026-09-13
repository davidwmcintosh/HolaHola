import type { FailureClassification } from './coordination-v2-types';
import { freezeProviderValue, type ProviderSelectionPolicy } from './coordination-provider-adapters/types';

export type ProviderFailure =
  | Readonly<{ kind: 'transport_interrupted'; detail?: string }>
  | Readonly<{ kind: 'provider_outage'; detail?: string }>
  | Readonly<{ kind: 'rate_limited'; detail?: string }>
  | Readonly<{ kind: 'malformed_response'; detail?: string }>
  | Readonly<{ kind: 'malformed_function_call'; detail?: string }>
  | Readonly<{ kind: 'limit_exhausted'; detail?: string }>
  | Readonly<{ kind: 'terminal_rejection'; detail?: string }>
  | Readonly<{ kind: 'safety_blocked'; detail?: string }>
  | Readonly<{ kind: 'authentication_failed'; detail?: string }>
  | Readonly<{ kind: 'unsupported_provider_outcome'; detail?: string }>;

export type ProviderFailureEnvelope = Readonly<{
  provider: string;
  model: string;
  adapterVersion: string;
  failure: ProviderFailure;
}>;

export type FailureMapping = Readonly<{
  classification: FailureClassification;
  reason:
    | 'resume_transport'
    | 'provider_outage'
    | 'rate_limited'
    | 'malformed_response'
    | 'malformed_function_call'
    | 'limit_exhausted'
    | 'terminal_rejection'
    | 'safety_blocked'
    | 'authentication_failed'
    | 'unsupported_provider_outcome';
  fallbackEligible: boolean;
}>;

const FALLBACK_TERMINAL_REASONS = new Set<FailureMapping['reason']>([
  'malformed_response',
  'malformed_function_call',
  'terminal_rejection',
  'safety_blocked',
  'authentication_failed',
  'unsupported_provider_outcome',
]);

function policyAllowsFallback(policy: ProviderSelectionPolicy | undefined, reason: FailureMapping['reason']): boolean {
  const allowed = (policy as ProviderSelectionPolicy & {
    fallbackEligibleFailureClasses?: readonly string[];
  } | undefined)?.fallbackEligibleFailureClasses;
  return allowed?.includes(reason) ?? false;
}

/**
 * Exhaustive mapping from adapter outcomes to state-machine vocabulary.
 * No cleanup action is performed here; cleanup is a separate state-machine
 * concern.
 */
export function mapProviderFailure(
  envelope: ProviderFailureEnvelope,
  policy?: ProviderSelectionPolicy,
): FailureMapping {
  const reason = envelope.failure.kind === 'transport_interrupted'
    ? 'resume_transport'
    : envelope.failure.kind;

  if (reason === 'resume_transport') {
    return freezeProviderValue({ classification: 'resume_transport', reason, fallbackEligible: false });
  }
  if (reason === 'provider_outage' || reason === 'rate_limited') {
    return freezeProviderValue({ classification: 'fresh_attempt_same_provider', reason, fallbackEligible: false });
  }
  if (reason === 'limit_exhausted') {
    return freezeProviderValue({ classification: 'terminal_failure', reason, fallbackEligible: false });
  }
  const fallbackEligible = FALLBACK_TERMINAL_REASONS.has(reason)
    && policyAllowsFallback(policy, reason);
  return freezeProviderValue({
    classification: fallbackEligible ? 'fresh_attempt_next_provider' : 'terminal_failure',
    reason,
    fallbackEligible,
  });
}

export const classifyProviderFailure = mapProviderFailure;
export const mapCoordinatorProviderFailure = mapProviderFailure;