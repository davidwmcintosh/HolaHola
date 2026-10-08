/**
 * Local Read-only Worker v1 — claim, fencing, watchdog and outbox decisions
 * (design §5.3, §5.4, §5.6, §5.7, §5.9). Pure functions over snapshots; the
 * supervisor performs the I/O and applies the returned decision.
 */
import { sha256Hex, canonicalJson } from '../../../shared/worker-contracts';

// ---------------------------------------------------------------------------
// §5.3 Claim outcome
// ---------------------------------------------------------------------------

export type LedgerAppendResult =
  | { ok: true; deduplicated: boolean; event: { eventType: string; payload: Record<string, unknown> } }
  | { ok: false; errorCode: string; httpStatus?: number };

export type ClaimDecision =
  | { action: 'launch' }
  | { action: 'already_launched' }
  | { action: 'skip'; reason: 'lost_race' | 'not_claimable' }
  | { action: 'reconcile'; reason: 'ambiguous_send' }
  | { action: 'halt'; reason: 'idempotency_conflict' | 'unexpected_error' };

const LOST_RACE_CODES = new Set(['sequence_conflict', 'invalid_transition']);
const NOT_CLAIMABLE_CODES = new Set(['not_participant', 'thread_not_found']);
const AMBIGUOUS_CODES = new Set(['timeout', 'network_error', 'transport_error']);

export function decideClaimOutcome(input: {
  attemptKey: string;
  result: LedgerAppendResult;
  alreadyLaunchedKeys: ReadonlySet<string>;
}): ClaimDecision {
  const r = input.result;
  if (!r.ok) {
    if (LOST_RACE_CODES.has(r.errorCode)) return { action: 'skip', reason: 'lost_race' };
    if (NOT_CLAIMABLE_CODES.has(r.errorCode) || r.httpStatus === 403 || r.httpStatus === 404) return { action: 'skip', reason: 'not_claimable' };
    if (AMBIGUOUS_CODES.has(r.errorCode) || (r.httpStatus !== undefined && r.httpStatus >= 500)) return { action: 'reconcile', reason: 'ambiguous_send' };
    return { action: 'halt', reason: 'unexpected_error' };
  }
  if (r.event.eventType !== 'accepted' || r.event.payload?.claimKey !== input.attemptKey) {
    // A key match returning a different operation means our key space is corrupted.
    return { action: 'halt', reason: 'idempotency_conflict' };
  }
  // Same attempt key: fresh, or a replay of THIS attempt (e.g. after an ambiguous send).
  if (input.alreadyLaunchedKeys.has(input.attemptKey)) return { action: 'already_launched' };
  return { action: 'launch' };
}

// ---------------------------------------------------------------------------
// §5.4 Fencing before every later write
// ---------------------------------------------------------------------------

export type FenceSnapshot = {
  currentOwner: string | null;
  state: string;
  latestAcceptedClaimKey: string | null;
};

export function checkFence(s: FenceSnapshot, workerActor: string, claimKey: string): { ok: true } | { ok: false; reason: string } {
  if (s.currentOwner !== workerActor) return { ok: false, reason: 'not_owner' };
  if (s.latestAcceptedClaimKey !== claimKey) return { ok: false, reason: 'claim_superseded' };
  if (!['accepted', 'in_progress'].includes(s.state)) return { ok: false, reason: 'state_not_active' };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// §5.6 Watchdog: remote read classification + local deadlines
// ---------------------------------------------------------------------------

export type RemoteRead<T> = { ok: true; value: T } | { ok: false; error: 'timeout' | 'network' | 'http_5xx' | 'not_participant' | 'http_4xx' };

export type WatchdogInput = {
  nowMs: number;
  runDeadlineMs: number;      // start + maxRuntimeSec
  windowEndMs: number;
  jobDeadlineMs: number;
  charterRead: RemoteRead<{ approvalState: 'draft' | 'approved' | 'revoked' }> | null; // null = no read this tick
  threadRead: RemoteRead<FenceSnapshot> | null;
  consecutiveUnknown: number;
  workerActor: string;
  claimKey: string;
};

export type WatchdogDecision =
  | { action: 'continue'; consecutiveUnknown: number }
  | { action: 'stop'; failureClass: 'timeout' | 'window_closed' | 'charter_revoked' | 'authority_lost' | 'authority_unknown'; ownerWritable: boolean };

/** Local deadlines never wait on the network; two consecutive unknown checks (30 s at 15 s ticks) stop the run. */
export function decideWatchdog(i: WatchdogInput): WatchdogDecision {
  if (i.nowMs >= i.runDeadlineMs || i.nowMs >= i.jobDeadlineMs) return { action: 'stop', failureClass: 'timeout', ownerWritable: true };
  if (i.nowMs >= i.windowEndMs) return { action: 'stop', failureClass: 'window_closed', ownerWritable: true };
  if (i.charterRead === null && i.threadRead === null) return { action: 'continue', consecutiveUnknown: i.consecutiveUnknown };

  if (i.threadRead && !i.threadRead.ok && i.threadRead.error === 'not_participant') {
    return { action: 'stop', failureClass: 'authority_lost', ownerWritable: false };
  }
  if (i.threadRead?.ok) {
    const fence = checkFence(i.threadRead.value, i.workerActor, i.claimKey);
    if (!fence.ok) return { action: 'stop', failureClass: 'authority_lost', ownerWritable: false };
  }
  if (i.charterRead?.ok && i.charterRead.value.approvalState !== 'approved') {
    return { action: 'stop', failureClass: 'charter_revoked', ownerWritable: true };
  }
  const unknown = (i.charterRead !== null && !i.charterRead.ok) || (i.threadRead !== null && !i.threadRead.ok);
  if (!unknown) return { action: 'continue', consecutiveUnknown: 0 };
  const next = i.consecutiveUnknown + 1;
  if (next >= 2) return { action: 'stop', failureClass: 'authority_unknown', ownerWritable: false };
  return { action: 'continue', consecutiveUnknown: next };
}

// ---------------------------------------------------------------------------
// §5.7 Outbox reconciliation
// ---------------------------------------------------------------------------

export type OutboxEntry = {
  key: string;
  eventType: string;
  payload: unknown;
  evidence: unknown[];
  payloadSha256: string;
  evidenceSha256: string;
  state: 'pending' | 'sent' | 'send_ambiguous' | 'abandoned_authority_lost' | 'idempotency_conflict';
  attempts: number;
};

export function freezeOutboxEntry(key: string, eventType: string, payload: unknown, evidence: unknown[] = []): OutboxEntry {
  return {
    key, eventType, payload, evidence,
    payloadSha256: sha256Hex(canonicalJson(payload)),
    evidenceSha256: sha256Hex(canonicalJson(evidence)),
    state: 'pending', attempts: 0,
  };
}

export type ThreadEventLite = { idempotencyKey: string; eventType: string; payload: unknown; evidence: unknown[] };

/** Matches by key AND operation AND content digests; a key match with other content is a conflict. */
export function reconcileOutboxEntry(entry: OutboxEntry, events: readonly ThreadEventLite[]): 'sent' | 'absent' | 'idempotency_conflict' {
  const hit = events.find((e) => e.idempotencyKey === entry.key);
  if (!hit) return 'absent';
  const same = hit.eventType === entry.eventType
    && sha256Hex(canonicalJson(hit.payload)) === entry.payloadSha256
    && sha256Hex(canonicalJson(hit.evidence ?? [])) === entry.evidenceSha256;
  return same ? 'sent' : 'idempotency_conflict';
}

export type ResendDecision = { action: 'resend'; refreshSequence: boolean } | { action: 'give_up'; state: 'send_ambiguous' };

/** Bounded resend after an ambiguous or conflicting send, only once the write is proven absent. */
export function decideResend(failureCode: string, attempts: number): ResendDecision {
  if (failureCode === 'sequence_conflict') return attempts < 5 ? { action: 'resend', refreshSequence: true } : { action: 'give_up', state: 'send_ambiguous' };
  return attempts < 3 ? { action: 'resend', refreshSequence: false } : { action: 'give_up', state: 'send_ambiguous' };
}

/** Entries that block new claims: anything unresolved except authority-lost abandonment. */
export function outboxBlocksClaims(entries: readonly OutboxEntry[]): boolean {
  return entries.some((e) => e.state === 'pending' || e.state === 'send_ambiguous' || e.state === 'idempotency_conflict');
}

// ---------------------------------------------------------------------------
// §5.9 Restart recovery selection
// ---------------------------------------------------------------------------

export type RecoveryCandidate = {
  threadId: string;
  state: string;
  currentOwner: string | null;
  latestAcceptedPayload: Record<string, unknown> | null;
};

/** Only threads this worker still owns AND whose latest acceptance carries THIS instanceId. */
export function selectOwnRecoveries(threads: readonly RecoveryCandidate[], workerActor: string, instanceId: string): string[] {
  return threads
    .filter((t) => t.currentOwner === workerActor
      && ['accepted', 'in_progress'].includes(t.state)
      && t.latestAcceptedPayload?.instanceId === instanceId)
    .map((t) => t.threadId);
}
