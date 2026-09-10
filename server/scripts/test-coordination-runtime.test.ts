import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CoordinationRuntimeService,
  digestCanonical,
  InMemoryCoordinationRepository,
  RuntimeProtocolError,
  type Envelope,
  type Principal,
} from '../services/coordination-runtime';

const error = (fn: () => unknown, code: string) => assert.throws(fn, (value) => value instanceof RuntimeProtocolError && value.code === code);
const gemini: Principal = { actor: 'luca-gemini', runtimeRegistrationId: 'runtime-a', credentialId: 'credential-a', profileId: 'profile-a', capabilities: ['execute', 'model'], credentialExpiresAt: 10_000, runtimeEnabled: true, revoked: false };
const verifier: Principal = { actor: 'luca-replit', runtimeRegistrationId: 'verifier-runtime', credentialId: 'verifier-credential', profileId: 'verifier-profile', capabilities: ['verify'], credentialExpiresAt: 10_000, runtimeEnabled: true, revoked: false };
const envelope: Envelope = { worktreeLabel: 'gate-1', worktreePath: '/work', argv: ['true'], patchDigest: null };

function fixture() {
  const repo = new InMemoryCoordinationRepository();
  let clock = 100;
  let sequence = 0;
  const service = new CoordinationRuntimeService(repo, () => clock, () => `id-${++sequence}`);
  const second = new CoordinationRuntimeService(repo, () => clock, () => `other-${++sequence}`);
  service.addInbox({ id: 'item-1', eventId: 'event-1', threadId: 'thread-1', taskId: 'task-1', sequence: 1, payload: { content: { source: 'immutable' } } });
  const assignment = { assignmentEventId: 'event-1', assignmentAuthor: 'alden' as const, taskId: 'task-1', threadId: 'thread-1', expectedSequence: 1 };
  const item = repo.getInbox('item-1')!;
  service.addWindow({ id: 'window-1', threadId: 'thread-1', after: 1, through: 1, boundaryDigest: digestCanonical({ window: { id: 'window-1', threadId: 'thread-1', after: 1, through: 1, boundaryToken: 'stable' }, items: [{ id: item.id, digest: digestCanonical(item) }] }), boundaryToken: 'stable', orderedItemIds: ['item-1'], complete: true });
  const packet = service.createPacket(gemini, 'window-1', assignment);
  const interaction = service.recordInteraction(gemini, { packetId: packet.id, turn: 1, attempt: 1, requestDigest: 'request', responseDigest: 'response', normalizedOutcome: 'consumed', idempotencyKey: 'interaction-key' });
  const receipt = service.consume(gemini, packet.id, packet.digest, interaction.id);
  return { repo, service, second, packet, interaction, receipt, assignment, setClock: (value: number) => { clock = value; } };
}

test('success path reaches an independently authorized verification', () => {
  const f = fixture();
  const claim = f.service.claim(gemini, 'thread-1', f.packet.id, f.packet.digest, f.receipt.id, 20);
  const execution = f.service.execute(gemini, claim.id, envelope);
  const completion = f.service.complete(gemini, execution.id, digestCanonical(execution));
  assert.equal(f.service.verify(verifier, completion.id).decision, 'approved');
});

test('packet payload and returned snapshots are immutable and digest-bound', () => {
  const f = fixture();
  assert.throws(() => { (f.packet.inherited.content as Record<string, unknown>).source = 'changed'; });
  assert.equal(f.repo.getPacket(f.packet.id)!.inherited[0].content.source, 'immutable');
  error(() => f.service.claim(gemini, 'thread-1', f.packet.id, '0'.repeat(64), f.receipt.id, 10), 'packet_digest_mismatch');
});

test('incomplete, omitted, changed-boundary, and stale windows fail', () => {
  const f = fixture();
  f.service.addWindow({ id: 'window', threadId: 'thread-1', after: 1, through: 2, boundaryDigest: digestCanonical({ after: 1, through: 2, orderedItemIds: ['item-1', 'item-2'] }), boundaryToken: 'stable', orderedItemIds: ['item-1', 'item-2'], complete: false });
  error(() => f.service.createPacket(gemini, 'window', f.assignment, 1, 2), 'inbox_window_incomplete');
  f.service.addWindow({ id: 'window', threadId: 'thread-1', after: 1, through: 1, boundaryDigest: 'wrong', boundaryToken: 'stable', orderedItemIds: ['item-1'], complete: true });
  error(() => f.service.createPacket(gemini, 'window', f.assignment, 1, 1), 'inbox_window_boundary_mismatch');
  f.repo.putThread('thread-1', 2);
  error(() => f.service.claim(gemini, 'thread-1', f.packet.id, f.packet.digest, f.receipt.id, 10), 'claim_epoch_stale');
});

test('every normalized outcome persists, while only consumed authorizes a claim', () => {
  const f = fixture();
  const outcomes = ['safety_blocked', 'refused', 'context_limit', 'interrupted', 'empty_response', 'malformed_function_call', 'unsupported_provider_outcome'] as const;
  outcomes.forEach((outcome, index) => {
    const turn = index === 0 ? 1 : Math.floor((index + 1) / 2) + 1;
    const attempt = index === 0 ? 2 : (index - 1) % 2 + 1;
    const retryLineage = attempt === 2 ? f.repo.snapshotInteractions().find((item) => item.packetId === f.packet.id && item.turn === turn && item.attempt === 1)?.id : undefined;
    f.service.recordInteraction(gemini, { packetId: f.packet.id, turn, attempt, requestDigest: `r-${index}`, normalizedOutcome: outcome, idempotencyKey: `outcome-${index}`, ...(retryLineage ? { retryLineage } : {}) });
  });
  assert.equal(f.repo.snapshotInteractions().length, 8);
  error(() => f.service.consume(gemini, f.packet.id, f.packet.digest, f.repo.snapshotInteractions()[1].id), 'consumption_not_authorized');
});

test('unknown and cross-runtime interactions and response-less consumption fail', () => {
  const f = fixture();
  error(() => f.service.recordInteraction({ ...gemini, runtimeRegistrationId: 'other' }, { packetId: f.packet.id, turn: 2, attempt: 1, requestDigest: 'x', normalizedOutcome: 'consumed', idempotencyKey: 'other-key' }), 'packet_assignment_mismatch');
  error(() => f.service.consume(gemini, f.packet.id, f.packet.digest, 'missing'), 'consumption_not_authorized');
  error(() => f.service.recordInteraction(gemini, { packetId: f.packet.id, turn: 2, attempt: 1, requestDigest: 'x', normalizedOutcome: 'consumed', idempotencyKey: 'no-response' }), 'response_required');
});

test('one active claim wins, expired takeover increments epoch, and TTL is strict', () => {
  const f = fixture();
  const claim = f.service.claim(gemini, 'thread-1', f.packet.id, f.packet.digest, f.receipt.id, 5);
  error(() => f.second.claim(gemini, 'thread-1', f.packet.id, f.packet.digest, f.receipt.id, 5), 'claim_active_conflict');
  f.setClock(106);
  const takeover = f.second.claim(gemini, 'thread-1', f.packet.id, f.packet.digest, f.receipt.id, 6);
  assert.equal(takeover.epoch, claim.epoch + 1);
  for (const ttl of [0, NaN, Infinity]) error(() => f.service.claim(gemini, 'thread-1', f.packet.id, f.packet.digest, f.receipt.id, ttl), 'claim_expired');
});

test('renewal rejects stale epochs, wrong identity, and expired principals', () => {
  const f = fixture();
  const claim = f.service.claim(gemini, 'thread-1', f.packet.id, f.packet.digest, f.receipt.id, 20);
  error(() => f.service.renew(gemini, claim.id, claim.epoch - 1, 10), 'claim_epoch_stale');
  error(() => f.service.renew({ ...gemini, profileId: 'wrong' }, claim.id, claim.epoch, 10), 'claim_epoch_stale');
  error(() => f.service.renew({ ...gemini, revoked: true }, claim.id, claim.epoch, 10), 'principal_denied');
});

test('cross-runtime execution, forged IDs, and terminal claim states fail', () => {
  const f = fixture();
  const claim = f.service.claim(gemini, 'thread-1', f.packet.id, f.packet.digest, f.receipt.id, 20);
  error(() => f.service.execute({ ...gemini, runtimeRegistrationId: 'other' }, claim.id, envelope), 'claim_unavailable');
  error(() => f.service.complete(gemini, 'forged', 'evidence'), 'completion_forbidden');
  const execution = f.service.execute(gemini, claim.id, envelope);
  f.service.complete(gemini, execution.id, digestCanonical(execution));
  error(() => f.service.execute(gemini, claim.id, envelope), 'claim_unavailable');
});

test('exact envelope mismatch marks the claim violated', () => {
  const f = fixture();
  const claim = f.service.claim(gemini, 'thread-1', f.packet.id, f.packet.digest, f.receipt.id, 20);
  error(() => f.service.execute(gemini, claim.id, { ...envelope, worktreePath: '/forged' }), 'execution_envelope_mismatch');
  assert.equal(f.repo.getClaim(claim.id)!.status, 'violated');
});

test('turn and attempt uniqueness, retry order, and the eight-call limit are enforced', () => {
  const f = fixture();
  error(() => f.service.recordInteraction(gemini, { packetId: f.packet.id, turn: 2, attempt: 2, requestDigest: 'retry', normalizedOutcome: 'refused', idempotencyKey: 'retry-first' }), 'retry_order_invalid');
  for (let turn = 1; turn <= 4; turn++) for (let attempt = 1; attempt <= 2; attempt++) if (!(turn === 1 && attempt === 1)) {
    const lineage = attempt === 2 ? f.repo.snapshotInteractions().find((item) => item.packetId === f.packet.id && item.turn === turn && item.attempt === 1)?.id : undefined;
    f.service.recordInteraction(gemini, { packetId: f.packet.id, turn, attempt, requestDigest: `${turn}-${attempt}`, normalizedOutcome: 'refused', idempotencyKey: `call-${turn}-${attempt}`, ...(lineage ? { retryLineage: lineage } : {}) });
  }
  error(() => f.service.recordInteraction(gemini, { packetId: f.packet.id, turn: 1, attempt: 1, requestDigest: 'duplicate', normalizedOutcome: 'refused', idempotencyKey: 'duplicate' }), 'duplicate_model_attempt');
});

test('verifier restrictions and evidence mismatch are enforced', () => {
  const f = fixture();
  const claim = f.service.claim(gemini, 'thread-1', f.packet.id, f.packet.digest, f.receipt.id, 20);
  const execution = f.service.execute(gemini, claim.id, envelope);
  const completion = f.service.complete(gemini, execution.id, digestCanonical(execution));
  error(() => f.service.verify({ ...verifier, actor: 'alden', capabilities: ['verify'] }, completion.id), 'verifier_not_allowed');
  error(() => f.service.verify({ ...verifier, runtimeRegistrationId: gemini.runtimeRegistrationId }, completion.id), 'self_verification_denied');
  error(() => f.service.verify(verifier, completion.id, null, 'wrong'), 'verification_digest_mismatch');
});

test('all mutation families replay exactly and reject changed payloads', () => {
  const f = fixture();
  const interaction = f.service.recordInteraction(gemini, { packetId: f.packet.id, turn: 1, attempt: 1, requestDigest: 'request', responseDigest: 'response', normalizedOutcome: 'consumed', idempotencyKey: 'interaction-key' });
  assert.deepEqual(f.service.recordInteraction(gemini, { packetId: f.packet.id, turn: 1, attempt: 1, requestDigest: 'request', responseDigest: 'response', normalizedOutcome: 'consumed', idempotencyKey: 'interaction-key' }), interaction);
  error(() => f.service.recordInteraction(gemini, { packetId: f.packet.id, turn: 1, attempt: 1, requestDigest: 'changed', responseDigest: 'response', normalizedOutcome: 'consumed', idempotencyKey: 'interaction-key' }), 'idempotency_payload_mismatch');
});

test('repository snapshots and nested returned records are frozen', () => {
  const f = fixture();
  assert(Object.isFrozen(f.repo.snapshots()));
  assert(Object.isFrozen(f.repo.getPacket(f.packet.id)));
  assert(Object.isFrozen(f.repo.getPacket(f.packet.id)!.assignment));
});