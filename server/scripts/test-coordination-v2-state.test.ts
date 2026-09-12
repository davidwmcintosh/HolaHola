import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAttemptState,
  createCleanupState,
  createPolicyDraft,
  createSessionState,
  createTransportLeaseState,
  type TransitionResult,
} from '../services/coordination-v2-types';
import { transitionPolicy } from '../services/coordination-policy-state';
import { transitionSession } from '../services/coordination-session-state';
import { transitionAttempt } from '../services/coordination-attempt-state';
import { transitionTransportLease } from '../services/coordination-transport-lease-state';
import { transitionCleanup } from '../services/coordination-cleanup-state';

const base = { now: 10, requestId: 'request-1', eventId: 'event-1' } as const;
const policy = createPolicyDraft({
  policyVersionId: 'policy-1',
  digest: 'digest-1',
  providerOrder: ['alpha', 'beta'],
  totalAttemptBudget: 3,
  providerAttemptBudgets: { alpha: 2, beta: 2 },
  sessionDurationMs: 100,
});

function next<State>(result: TransitionResult<State>): State {
  assert.equal(result.ok, true);
  return result.state;
}

test('policy approval and revocation are explicit immutable transitions', () => {
  const approved = transitionPolicy(policy, { ...base, type: 'approve' });
  assert.equal(approved.ok, true);
  assert.equal(approved.state.state, 'approved');
  assert(Object.isFrozen(approved.state));
  assert(Object.isFrozen(approved.event));
  const revoked = transitionPolicy(approved.state, {
    ...base,
    requestId: 'request-2',
    eventId: 'event-2',
    now: 11,
    type: 'revoke',
    reason: 'operator request',
  });
  assert.equal(revoked.ok, true);
  assert.equal(revoked.state.state, 'revoked');
  assert.equal(transitionPolicy(revoked.state, { ...base, type: 'approve' }).code, 'policy_terminal');
});

test('session table covers preparation, host wait, verification, and one completion', () => {
  let state = createSessionState({
    sessionId: 'session-1',
    policyVersionId: 'policy-1',
    providerOrder: ['alpha', 'beta'],
    totalAttemptBudget: 3,
    providerAttemptBudgets: { alpha: 2, beta: 2 },
    expiresAt: 100,
  });
  state = next(transitionSession(state, { ...base, type: 'preparation_ready' }));
  assert.equal(state.terminalAt, null);
  assert.equal(state.terminalReason, null);
  state = next(transitionSession(state, { ...base, eventId: 'event-2', type: 'start_attempt', provider: 'alpha' }));
  assert.equal(state.attemptCount, 1);
  state = next(transitionSession(state, { ...base, eventId: 'event-3', type: 'host_wait' }));
  state = next(transitionSession(state, { ...base, eventId: 'event-4', type: 'transport_recovered' }));
  state = next(transitionSession(state, { ...base, eventId: 'event-5', type: 'begin_verification' }));
  state = next(transitionSession(state, {
    ...base,
    eventId: 'event-6',
    type: 'accept_completion',
    evidenceDigest: 'evidence-1',
  }));
  assert.equal(state.state, 'succeeded');
  assert.equal(state.completionAccepted, true);
  assert.equal(state.terminalAt, 10);
  assert.equal(state.terminalReason, 'evidence-1');
  assert.equal(transitionSession(state, { ...base, eventId: 'event-7', type: 'revoke', reason: 'late' }).code, 'session_terminal');
});

test('logical retries are fresh attempts and fallback follows order and budgets', () => {
  let state = createSessionState({
    sessionId: 'session-2',
    policyVersionId: 'policy-1',
    providerOrder: ['alpha', 'beta'],
    totalAttemptBudget: 2,
    providerAttemptBudgets: { alpha: 1, beta: 1 },
    expiresAt: 100,
    state: 'ready',
  });
  state = next(transitionSession(state, { ...base, type: 'start_attempt', provider: 'alpha' }));
  const same = transitionSession(state, {
    ...base,
    eventId: 'event-2',
    type: 'retry',
    classification: 'fresh_attempt_same_provider',
    provider: 'alpha',
  });
  assert.equal(same.ok, false);
  assert.equal(same.code, 'provider_budget_exhausted');
  const fallback = transitionSession(state, {
    ...base,
    eventId: 'event-3',
    type: 'retry',
    classification: 'fresh_attempt_next_provider',
    provider: 'beta',
  });
  assert.equal(fallback.ok, true);
  assert.equal(fallback.state.currentProvider, 'beta');
  assert.equal(fallback.state.attemptCount, 2);
  assert.equal(transitionSession(state, {
    ...base,
    eventId: 'event-4',
    type: 'retry',
    classification: 'fresh_attempt_next_provider',
    provider: 'alpha',
  }).code, 'provider_order_regression');
});

test('session expiry, revocation, exhaustion, and terminal success reject authority', () => {
  const ready = createSessionState({
    sessionId: 'session-3',
    policyVersionId: 'policy-1',
    providerOrder: ['alpha'],
    totalAttemptBudget: 1,
    expiresAt: 20,
    state: 'ready',
  });
  assert.equal(transitionSession(ready, { ...base, now: 20, type: 'start_attempt', provider: 'alpha' }).code, 'session_expired');
  const expired = next(transitionSession(ready, { ...base, now: 20, eventId: 'expire', type: 'expire' }));
  assert.equal(expired.state, 'expired');
  assert.equal(transitionSession(expired, { ...base, type: 'revoke', reason: 'late' }).code, 'session_terminal');
  const exhausted = next(transitionSession(ready, { ...base, type: 'exhaust' }));
  assert.equal(exhausted.state, 'exhausted');
});

test('attempt state machine permits transport resume only without reopening terminal attempts', () => {
  let state = createAttemptState({
    attemptId: 'attempt-1',
    sessionId: 'session-1',
    provider: 'alpha',
    model: 'model',
    adapterVersion: 'adapter-1',
    ordinal: 1,
    providerOrdinal: 1,
    createdAt: 10,
    deadline: 100,
  });
  state = next(transitionAttempt(state, { ...base, type: 'provider_started' }));
  state = next(transitionAttempt(state, { ...base, eventId: 'event-2', type: 'intent_ready' }));
  state = next(transitionAttempt(state, { ...base, eventId: 'event-3', type: 'host_wait' }));
  const resumed = transitionAttempt(state, { ...base, eventId: 'event-4', type: 'transport_recovered' });
  assert.equal(resumed.ok, true);
  assert.equal(resumed.state.attemptId, 'attempt-1');
  assert.equal(resumed.state.ordinal, 1);
  assert.equal(resumed.state.providerOrdinal, 1);
  assert.equal(resumed.state.state, 'waiting_for_host');
  assert.equal(resumed.state.terminalAt, null);
  assert.equal(resumed.state.resultCode, null);
  state = next(transitionAttempt(resumed.state, { ...base, eventId: 'event-5', type: 'host_started' }));
  state = next(transitionAttempt(state, { ...base, eventId: 'event-6', type: 'result_ready' }));
  assert.equal(state.terminalAt, null);
  assert.equal(state.resultCode, null);
  state = next(transitionAttempt(state, { ...base, eventId: 'event-7', type: 'complete', resultCode: 'ok' }));
  assert.equal(state.terminalAt, 10);
  assert.equal(state.resultCode, 'ok');
  assert.equal(state.failureClassification, null);
  assert.equal(transitionAttempt(state, { ...base, eventId: 'event-8', type: 'transport_recovered' }).code, 'attempt_terminal');
  const cancelled = next(transitionAttempt(createAttemptState({
    attemptId: 'attempt-2',
    sessionId: 'session-1',
    provider: 'alpha',
    model: 'model',
    adapterVersion: 'adapter-1',
    ordinal: 2,
    providerOrdinal: 2,
    createdAt: 10,
    deadline: 100,
  }), { ...base, eventId: 'event-9', type: 'cancel', reason: 'operator' }));
  assert.equal(cancelled.state, 'cancelled');
  assert.equal(cancelled.terminalAt, 10);
  assert.equal(cancelled.resultCode, 'cancelled');
  assert.equal(transitionAttempt(cancelled, { ...base, eventId: 'event-10', type: 'provider_started' }).code, 'attempt_terminal');
});

test('transport lease epochs prevent stale renewal and allow only expired takeover', () => {
  let lease = createTransportLeaseState({ leaseId: 'lease-1', sessionId: 'session-1', enrolledHostId: 'host-1' });
  assert.equal(lease.state, 'unheld');
  let active = next(transitionTransportLease(lease, { ...base, type: 'acquire', holderInstanceId: 'host-instance-1', duration: 10 }));
  assert.equal(active.state, 'active');
  lease = active;
  assert.equal(lease.epoch, 1);
  assert.equal(transitionTransportLease(lease, {
    ...base,
    eventId: 'stale',
    type: 'renew',
    holderInstanceId: 'host-instance-1',
    epoch: 0,
    duration: 10,
  }).code, 'lease_epoch_stale');
  lease = next(transitionTransportLease(lease, { ...base, now: 20, eventId: 'expired', type: 'expire' }));
  assert.equal(lease.state, 'expired');
  lease = next(transitionTransportLease(lease, { ...base, now: 21, eventId: 'takeover', type: 'takeover', holderInstanceId: 'host-instance-2', duration: 10 }));
  assert.equal(lease.state, 'active');
  assert.equal(lease.epoch, 2);
  assert.equal(lease.predecessorLeaseId, 'lease-1');
  lease = next(transitionTransportLease(lease, { ...base, now: 22, eventId: 'release', type: 'release', holderInstanceId: 'host-instance-2', epoch: 2 }));
  assert.equal(lease.state, 'released');
  assert.equal(transitionTransportLease(lease, { ...base, eventId: 'late-renew', type: 'renew', holderInstanceId: 'host-instance-2', epoch: 2, duration: 10 }).code, 'lease_terminal');
});

test('cleanup repair never rewrites the terminal session outcome', () => {
  let cleanup = createCleanupState({
    sessionId: 'session-1',
    terminalOutcome: 'succeeded',
    terminalReason: 'evidence-1',
    requestedAt: 10,
  });
  cleanup = next(transitionCleanup(cleanup, { ...base, type: 'failed', code: 'host_cleanup_failed' }));
  assert.equal(cleanup.status, 'repair_required');
  assert.equal(cleanup.terminalOutcome, 'succeeded');
  assert.equal(next(transitionCleanup(cleanup, { ...base, eventId: 'event-2', type: 'retry' })).status, 'pending');
  cleanup = next(transitionCleanup(cleanup, { ...base, eventId: 'event-3', type: 'acknowledge' }));
  assert.equal(cleanup.status, 'acknowledged');
  assert.equal(cleanup.terminalOutcome, 'succeeded');
  assert.equal(transitionCleanup(cleanup, { ...base, eventId: 'event-4', type: 'failed', code: 'again' }).code, 'cleanup_terminal');
});