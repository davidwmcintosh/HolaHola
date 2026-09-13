import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createHostEnvelope,
  validateHostEnvelope,
  CoordinationHostProtocolError,
  type HostBinding,
} from '../services/coordination-host-protocol';

const binding: HostBinding = {
  policyVersionId: 'policy-1', sessionId: 'session-1', attemptId: 'attempt-1',
  enrolledHostId: 'host-1', transportLeaseId: 'lease-1', leaseEpoch: 1,
  holderInstanceId: 'holder-1', operation: 'fixed-target', operationDigest: 'a'.repeat(64),
};
const ids = {
  requestId: 'request-1', correlationId: 'correlation-1',
  issuedAt: '2026-01-01T00:00:00.000Z', expiresAt: '2026-01-01T00:01:00.000Z',
};

test('host envelopes are closed, versioned, bounded, and digest protected', () => {
  const envelope = createHostEnvelope('work_poll', { binding }, ids);
  assert.equal(validateHostEnvelope(envelope, { now: Date.parse(ids.issuedAt) + 1 }).kind, 'work_poll');
  const extra = { ...envelope, extra: true };
  assert.throws(() => validateHostEnvelope(extra), (error: unknown) =>
    (error as CoordinationHostProtocolError).code === 'HOST_PROTOCOL_EXTRA_FIELDS');
  assert.throws(() => validateHostEnvelope({ ...envelope, protocolVersion: 2 }), (error: unknown) =>
    (error as CoordinationHostProtocolError).code === 'HOST_PROTOCOL_UNKNOWN_VERSION');
  assert.throws(() => validateHostEnvelope({ ...envelope, digest: 'b'.repeat(64) }), (error: unknown) =>
    (error as CoordinationHostProtocolError).code === 'HOST_PROTOCOL_DIGEST_MISMATCH');
  assert.throws(() => validateHostEnvelope(envelope, { now: Date.parse(ids.expiresAt) }), (error: unknown) =>
    (error as CoordinationHostProtocolError).code === 'HOST_PROTOCOL_EXPIRED');
});

test('structured results and diagnostics have closed, bounded payloads', () => {
  assert.throws(() => createHostEnvelope('structured_result', {
    binding, result: { ok: true, output: 'bounded' },
    resultDigest: '0'.repeat(64),
  }, ids), (error: unknown) =>
    (error as CoordinationHostProtocolError).code === 'HOST_PROTOCOL_INVALID_FIELD');
});