/**
 * Coordinator V2's in-memory protocol vocabulary.
 *
 * This module deliberately contains no persistence, transport, or clock code.
 * Callers provide all identifiers and the measured time used by a transition.
 */

export type FailureClassification =
  | 'resume_transport'
  | 'fresh_attempt_same_provider'
  | 'fresh_attempt_next_provider'
  | 'terminal_failure'
  | 'cleanup_repair';

/** Completion is an outcome, not a failure classification. */
export type CompletionResultCode = string;

export type TransitionRejectionCode =
  | 'invalid_command'
  | 'invalid_state'
  | 'policy_not_approvable'
  | 'policy_already_approved'
  | 'policy_terminal'
  | 'session_terminal'
  | 'session_expired'
  | 'session_revoked'
  | 'session_exhausted'
  | 'attempt_budget_exhausted'
  | 'provider_budget_exhausted'
  | 'provider_not_in_policy_order'
  | 'provider_fallback_not_allowed'
  | 'provider_order_regression'
  | 'completion_already_accepted'
  | 'attempt_terminal'
  | 'attempt_expired'
  | 'lease_terminal'
  | 'lease_holder_conflict'
  | 'lease_epoch_stale'
  | 'lease_expired'
  | 'cleanup_terminal'
  | 'cleanup_already_acknowledged';

export type TransitionFailure = {
  readonly ok: false;
  readonly code: TransitionRejectionCode;
};

export type TransitionEvent = {
  readonly eventId: string;
  readonly requestId: string;
  readonly occurredAt: number;
  readonly kind: string;
  readonly from: string;
  readonly to: string;
  readonly classification?: FailureClassification;
  readonly resultCode?: CompletionResultCode;
  readonly data?: Readonly<Record<string, unknown>>;
};

export type TransitionSuccess<State> = {
  readonly ok: true;
  readonly state: State;
  readonly event: TransitionEvent;
};

export type TransitionResult<State> = TransitionSuccess<State> | TransitionFailure;

export type TransitionCommandBase = {
  readonly requestId: string;
  readonly eventId: string;
  readonly now: number;
};

export type PolicyDefinition = {
  readonly policyVersionId: string;
  readonly digest: string;
  readonly providerOrder: readonly string[];
  readonly totalAttemptBudget: number;
  readonly providerAttemptBudgets: Readonly<Record<string, number>>;
  readonly sessionDurationMs: number;
};

export type PolicyDraftState = PolicyDefinition & {
  readonly state: 'draft';
};
export type PolicyApprovedState = PolicyDefinition & {
  readonly state: 'approved';
  readonly approvedAt: number;
};
export type PolicyRevokedState = PolicyDefinition & {
  readonly state: 'revoked';
  readonly approvedAt: number | null;
  readonly revokedAt: number;
};
export type PolicyState = PolicyDraftState | PolicyApprovedState | PolicyRevokedState;

export type SessionStatus =
  | 'preparing'
  | 'ready'
  | 'running'
  | 'waiting_for_host'
  | 'verifying'
  | 'succeeded'
  | 'failed'
  | 'exhausted'
  | 'expired'
  | 'revoked';

export type SessionTerminalStatus = Extract<
  SessionStatus,
  'succeeded' | 'failed' | 'exhausted' | 'expired' | 'revoked'
>;
export type SessionNonTerminalStatus = Exclude<SessionStatus, SessionTerminalStatus>;

export type SessionStateShared = {
  readonly sessionId: string;
  readonly policyVersionId: string;
  readonly providerOrder: readonly string[];
  readonly totalAttemptBudget: number;
  readonly providerAttemptBudgets: Readonly<Record<string, number>>;
  readonly expiresAt: number;
  readonly attemptCount: number;
  readonly attemptsByProvider: Readonly<Record<string, number>>;
  readonly currentProvider: string | null;
  readonly completionAccepted: boolean;
};

export type SessionState =
  | (SessionStateShared & { readonly state: 'preparing' | 'ready' | 'running' | 'waiting_for_host' | 'verifying'; readonly terminalAt: null; readonly terminalReason: null })
  | (SessionStateShared & { readonly state: 'succeeded' | 'failed' | 'exhausted' | 'expired' | 'revoked'; readonly terminalAt: number; readonly terminalReason: string });

export type AttemptStatus =
  | 'created'
  | 'provider_active'
  | 'intent_ready'
  | 'waiting_for_host'
  | 'host_active'
  | 'result_ready'
  | 'provider_continuation'
  | 'completed'
  | 'retryable_failed'
  | 'terminal_failed'
  | 'cancelled';

export type AttemptTerminalStatus = Extract<
  AttemptStatus,
  'completed' | 'retryable_failed' | 'terminal_failed' | 'cancelled'
>;

export type AttemptStateShared = {
  readonly attemptId: string;
  readonly sessionId: string;
  readonly provider: string;
  readonly model: string;
  readonly adapterVersion: string;
  readonly ordinal: number;
  readonly providerOrdinal: number;
  readonly createdAt: number;
  readonly deadline: number;
  readonly failureClassification: FailureClassification | null;
};

export type AttemptState =
  | (AttemptStateShared & { readonly state: 'created' | 'provider_active' | 'intent_ready' | 'waiting_for_host' | 'host_active' | 'result_ready' | 'provider_continuation'; readonly terminalAt: null; readonly resultCode: null })
  | (AttemptStateShared & { readonly state: 'completed' | 'retryable_failed' | 'terminal_failed' | 'cancelled'; readonly terminalAt: number; readonly resultCode: string });

export type TransportLeaseStatus = 'unheld' | 'active' | 'released' | 'expired' | 'superseded';
export type TransportLeaseStateBase = {
  readonly leaseId: string;
  readonly sessionId: string;
  readonly enrolledHostId: string;
  readonly holderInstanceId: string | null;
  readonly epoch: number;
  readonly issuedAt: number | null;
  readonly expiresAt: number | null;
  readonly endedAt: number | null;
  readonly predecessorLeaseId: string | null;
};
export type TransportLeaseState =
  | (TransportLeaseStateBase & { readonly state: 'unheld' })
  | (TransportLeaseStateBase & { readonly state: 'active' })
  | (TransportLeaseStateBase & { readonly state: 'expired' })
  | (TransportLeaseStateBase & { readonly state: 'released' })
  | (TransportLeaseStateBase & { readonly state: 'superseded' });

export type CleanupStatus = 'pending' | 'in_progress' | 'acknowledged' | 'repair_required';
export type CleanupStateBase = {
  readonly sessionId: string;
  readonly terminalOutcome: SessionTerminalStatus;
  readonly terminalReason: string;
  readonly requestedAt: number;
  readonly acknowledgedAt: number | null;
  readonly lastFailureCode: string | null;
};
export type CleanupState =
  | (CleanupStateBase & { readonly status: 'pending' })
  | (CleanupStateBase & { readonly status: 'in_progress' })
  | (CleanupStateBase & { readonly status: 'acknowledged' })
  | (CleanupStateBase & { readonly status: 'repair_required' });

export function freezeV2<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as object)) freezeV2(child);
  }
  return value;
}

export function success<State>(
  state: State,
  event: TransitionEvent,
): TransitionSuccess<State> {
  return freezeV2({ ok: true as const, state, event });
}

export function failure(code: TransitionRejectionCode): TransitionFailure {
  return freezeV2({ ok: false as const, code });
}

export function isTerminalSession(state: SessionState): boolean {
  return state.state === 'succeeded'
    || state.state === 'failed'
    || state.state === 'exhausted'
    || state.state === 'expired'
    || state.state === 'revoked';
}

export function isTerminalAttempt(state: AttemptState): boolean {
  return state.state === 'completed'
    || state.state === 'retryable_failed'
    || state.state === 'terminal_failed'
    || state.state === 'cancelled';
}

export function createPolicyDraft(
  definition: PolicyDefinition,
): PolicyDraftState {
  return freezeV2({ ...definition, state: 'draft' as const });
}

export function createSessionState(input: {
  readonly sessionId: string;
  readonly policyVersionId: string;
  readonly providerOrder: readonly string[];
  readonly totalAttemptBudget: number;
  readonly providerAttemptBudgets?: Readonly<Record<string, number>>;
  readonly expiresAt: number;
  readonly state?: SessionNonTerminalStatus;
}): SessionState {
  return freezeV2({
    sessionId: input.sessionId,
    policyVersionId: input.policyVersionId,
    providerOrder: [...input.providerOrder],
    totalAttemptBudget: input.totalAttemptBudget,
    providerAttemptBudgets: { ...(input.providerAttemptBudgets ?? {}) },
    expiresAt: input.expiresAt,
    state: input.state ?? 'preparing',
    attemptCount: 0,
    attemptsByProvider: {},
    currentProvider: null,
    completionAccepted: false,
    terminalAt: null,
    terminalReason: null,
  }) as SessionState;
}

export function createAttemptState(input: {
  readonly attemptId: string;
  readonly sessionId: string;
  readonly provider: string;
  readonly model: string;
  readonly adapterVersion: string;
  readonly ordinal: number;
  readonly providerOrdinal: number;
  readonly createdAt: number;
  readonly deadline: number;
}): AttemptState {
  return freezeV2({
    ...input,
    state: 'created' as const,
    failureClassification: null,
    terminalAt: null,
    resultCode: null,
  });
}

export function createTransportLeaseState(input: {
  readonly leaseId: string;
  readonly sessionId: string;
  readonly enrolledHostId: string;
}): TransportLeaseState {
  return freezeV2({
    ...input,
    state: 'unheld' as const,
    holderInstanceId: null,
    epoch: 0,
    issuedAt: null,
    expiresAt: null,
    endedAt: null,
    predecessorLeaseId: null,
  });
}

export function createCleanupState(input: {
  readonly sessionId: string;
  readonly terminalOutcome: SessionTerminalStatus;
  readonly terminalReason: string;
  readonly requestedAt: number;
}): CleanupState {
  return freezeV2({ ...input, status: 'pending' as const, acknowledgedAt: null, lastFailureCode: null });
}