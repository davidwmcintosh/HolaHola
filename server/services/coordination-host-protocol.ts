/**
 * Coordinator V2 host wire contract.
 *
 * This module is intentionally transport and persistence agnostic.  A host
 * may provide evidence, but only the coordinator can create an authorizing
 * envelope.  In particular, this vocabulary contains logical operation names
 * rather than operating-system paths or process commands.
 */
import { createHash } from 'node:crypto';
import { canonicalJson } from './coordination-runtime';

export const HOST_PROTOCOL_VERSION = 1 as const;
export const HOST_ENVELOPE_MAX_BYTES = 64 * 1024;
export const HOST_MAX_DIAGNOSTIC_BYTES = 8 * 1024;
export const HOST_MAX_FUTURE_SKEW_MS = 30_000;

export type HostEnvelopeKind =
  | 'enrollment_declaration'
  | 'capability_declaration'
  | 'preflight_report'
  | 'lease_request'
  | 'lease_renewal'
  | 'work_poll'
  | 'operation_claim'
  | 'claim_renewal'
  | 'structured_result'
  | 'terminal_state'
  | 'cleanup_request'
  | 'cleanup_acknowledgement'
  | 'safe_diagnostics';

export type HostBinding = {
  policyVersionId: string;
  sessionId: string;
  attemptId?: string;
  enrolledHostId: string;
  transportLeaseId: string;
  leaseEpoch: number;
  holderInstanceId: string;
  operation: string;
  operationDigest?: string;
};

export type HostEnvelope<K extends HostEnvelopeKind = HostEnvelopeKind, P = Record<string, unknown>> = {
  protocolVersion: typeof HOST_PROTOCOL_VERSION;
  kind: K;
  requestId: string;
  correlationId: string;
  issuedAt: string;
  expiresAt: string;
  payload: P;
  digest: string;
};

export type HostProtocolErrorCode =
  | 'HOST_PROTOCOL_UNKNOWN_VERSION'
  | 'HOST_PROTOCOL_UNKNOWN_KIND'
  | 'HOST_PROTOCOL_EXTRA_FIELDS'
  | 'HOST_PROTOCOL_MISSING_FIELD'
  | 'HOST_PROTOCOL_INVALID_FIELD'
  | 'HOST_PROTOCOL_BYTES_EXCEEDED'
  | 'HOST_PROTOCOL_DIGEST_MISMATCH'
  | 'HOST_PROTOCOL_EXPIRED'
  | 'HOST_PROTOCOL_FUTURE_SKEW'
  | 'HOST_PROTOCOL_BINDING_MISMATCH'
  | 'HOST_PROTOCOL_UNSAFE_DIAGNOSTICS';

export class CoordinationHostProtocolError extends Error {
  readonly code: HostProtocolErrorCode;
  constructor(code: HostProtocolErrorCode, message = code) {
    super(message);
    this.name = 'CoordinationHostProtocolError';
    this.code = code;
  }
}

const KINDS: readonly HostEnvelopeKind[] = [
  'enrollment_declaration', 'capability_declaration', 'preflight_report',
  'lease_request', 'lease_renewal', 'work_poll', 'operation_claim',
  'claim_renewal', 'structured_result', 'terminal_state', 'cleanup_request',
  'cleanup_acknowledgement', 'safe_diagnostics',
];
const ENVELOPE_KEYS = ['correlationId', 'digest', 'expiresAt', 'issuedAt', 'kind',
  'payload', 'protocolVersion', 'requestId'] as const;
const BINDING_KEYS = ['attemptId', 'enrolledHostId', 'holderInstanceId', 'leaseEpoch',
  'operation', 'operationDigest', 'policyVersionId', 'sessionId', 'transportLeaseId'] as const;
const HEX_DIGEST = /^[0-9a-f]{64}$/;

function fail(code: HostProtocolErrorCode): never {
  throw new CoordinationHostProtocolError(code);
}

function plain(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exact(value: unknown, keys: readonly string[], required: readonly string[] = keys): asserts value is Record<string, unknown> {
  if (!plain(value)) fail('HOST_PROTOCOL_INVALID_FIELD');
  const actual = Object.keys(value).sort();
  const allowed = [...keys].sort();
  if (actual.some((key) => !allowed.includes(key))) fail('HOST_PROTOCOL_EXTRA_FIELDS');
  if (required.some((key) => !Object.prototype.hasOwnProperty.call(value, key))) {
    fail('HOST_PROTOCOL_MISSING_FIELD');
  }
}

function text(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 256 || value.trim() !== value) {
    fail('HOST_PROTOCOL_INVALID_FIELD');
  }
}

function digest(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

function validateBinding(value: unknown, requiredAttempt = false): asserts value is HostBinding {
  exact(value, BINDING_KEYS, requiredAttempt ? BINDING_KEYS : BINDING_KEYS.filter((key) => key !== 'attemptId' && key !== 'operationDigest'));
  for (const key of ['policyVersionId', 'sessionId', 'enrolledHostId', 'transportLeaseId', 'holderInstanceId', 'operation']) {
    text(value[key]);
  }
  if (value.attemptId !== undefined) text(value.attemptId);
  if (value.operationDigest !== undefined && (typeof value.operationDigest !== 'string' || !HEX_DIGEST.test(value.operationDigest))) {
    fail('HOST_PROTOCOL_INVALID_FIELD');
  }
  if (!Number.isSafeInteger(value.leaseEpoch) || (value.leaseEpoch as number) <= 0) fail('HOST_PROTOCOL_INVALID_FIELD');
}

/**
 * Validate a payload's closed shape.  Payload extension is deliberately not
 * supported: adding a field is a protocol revision, not a harmless rollout.
 */
function validatePayload(kind: HostEnvelopeKind, payload: unknown): void {
  if (kind === 'enrollment_declaration') {
    exact(payload, ['hostId', 'declarationDigest', 'capabilities', 'protocolVersion']);
    text(payload.hostId); text(payload.declarationDigest);
    if (!HEX_DIGEST.test(payload.declarationDigest as string) || payload.protocolVersion !== 1 ||
        !Array.isArray(payload.capabilities) || payload.capabilities.some((v) => typeof v !== 'string')) fail('HOST_PROTOCOL_INVALID_FIELD');
  } else if (kind === 'capability_declaration') {
    exact(payload, ['binding', 'capabilities']);
    validateBinding(payload.binding); if (!Array.isArray(payload.capabilities) || payload.capabilities.some((v) => typeof v !== 'string')) fail('HOST_PROTOCOL_INVALID_FIELD');
  } else if (kind === 'preflight_report') {
    exact(payload, ['binding', 'accepted', 'reportDigest']);
    validateBinding(payload.binding, true); if (typeof payload.accepted !== 'boolean' || typeof payload.reportDigest !== 'string' || !HEX_DIGEST.test(payload.reportDigest)) fail('HOST_PROTOCOL_INVALID_FIELD');
  } else if (kind === 'lease_request') {
    exact(payload, ['sessionId', 'holderInstanceId', 'durationMs']);
    text(payload.sessionId); text(payload.holderInstanceId);
    if (!Number.isSafeInteger(payload.durationMs) || (payload.durationMs as number) <= 0 || (payload.durationMs as number) > 86_400_000) fail('HOST_PROTOCOL_INVALID_FIELD');
  } else if (kind === 'lease_renewal') {
    exact(payload, ['binding', 'durationMs']); validateBinding(payload.binding);
    if (!Number.isSafeInteger(payload.durationMs) || (payload.durationMs as number) <= 0 || (payload.durationMs as number) > 86_400_000) fail('HOST_PROTOCOL_INVALID_FIELD');
  } else if (kind === 'work_poll') {
    exact(payload, ['binding']); validateBinding(payload.binding);
  } else if (kind === 'operation_claim') {
    exact(payload, ['binding']); validateBinding(payload.binding, true);
  } else if (kind === 'claim_renewal') {
    exact(payload, ['binding']); validateBinding(payload.binding, true);
  } else if (kind === 'structured_result') {
    exact(payload, ['binding', 'result', 'resultDigest']); validateBinding(payload.binding, true);
    if (!plain(payload.result) || typeof payload.resultDigest !== 'string' || !HEX_DIGEST.test(payload.resultDigest) ||
        digest(payload.result) !== payload.resultDigest || Buffer.byteLength(canonicalJson(payload.result), 'utf8') > 32_768) fail('HOST_PROTOCOL_INVALID_FIELD');
  } else if (kind === 'terminal_state') {
    exact(payload, ['binding', 'state', 'reason']); validateBinding(payload.binding, true);
    if (typeof payload.state !== 'string' || typeof payload.reason !== 'string' || payload.reason.length > 1024) fail('HOST_PROTOCOL_INVALID_FIELD');
  } else if (kind === 'cleanup_request') {
    exact(payload, ['binding', 'obligationId']); validateBinding(payload.binding); text(payload.obligationId);
  } else if (kind === 'cleanup_acknowledgement') {
    exact(payload, ['binding', 'obligationId', 'evidence', 'evidenceDigest']); validateBinding(payload.binding);
    text(payload.obligationId);
    if (!plain(payload.evidence) || typeof payload.evidenceDigest !== 'string' || !HEX_DIGEST.test(payload.evidenceDigest) ||
        digest(payload.evidence) !== payload.evidenceDigest || Buffer.byteLength(canonicalJson(payload.evidence), 'utf8') > HOST_MAX_DIAGNOSTIC_BYTES) fail('HOST_PROTOCOL_INVALID_FIELD');
  } else if (kind === 'safe_diagnostics') {
    exact(payload, ['binding', 'entries']); validateBinding(payload.binding);
    if (!Array.isArray(payload.entries) || payload.entries.length > 32 || payload.entries.some((entry) =>
      !plain(entry) || Object.keys(entry).sort().join(',') !== 'code,message' ||
      typeof entry.code !== 'string' || typeof entry.message !== 'string' ||
      entry.code.length > 128 || entry.message.length > 512 ||
      /(?:bearer\s+\S+|(?:cb|ct)_[A-Za-z0-9_-]{8,})/i.test(`${entry.code} ${entry.message}`))) {
      fail('HOST_PROTOCOL_UNSAFE_DIAGNOSTICS');
    }
    if (Buffer.byteLength(canonicalJson(payload), 'utf8') > HOST_MAX_DIAGNOSTIC_BYTES) fail('HOST_PROTOCOL_BYTES_EXCEEDED');
  }
}

export function envelopeDigest(envelope: Omit<HostEnvelope, 'digest'> | Record<string, unknown>): string {
  return digest(envelope);
}

export function createHostEnvelope<K extends HostEnvelopeKind, P>(
  kind: K,
  payload: P,
  ids: { requestId: string; correlationId: string; issuedAt: string; expiresAt: string },
): HostEnvelope<K, P> {
  if (!KINDS.includes(kind)) fail('HOST_PROTOCOL_UNKNOWN_KIND');
  text(ids.requestId); text(ids.correlationId); text(ids.issuedAt); text(ids.expiresAt);
  const issued = Date.parse(ids.issuedAt); const expires = Date.parse(ids.expiresAt);
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || expires <= issued) fail('HOST_PROTOCOL_INVALID_FIELD');
  validatePayload(kind, payload);
  const base = { protocolVersion: HOST_PROTOCOL_VERSION, kind, requestId: ids.requestId,
    correlationId: ids.correlationId, issuedAt: ids.issuedAt, expiresAt: ids.expiresAt, payload };
  const envelope = { ...base, digest: envelopeDigest(base as Record<string, unknown>) } as HostEnvelope<K, P>;
  if (Buffer.byteLength(canonicalJson(envelope), 'utf8') > HOST_ENVELOPE_MAX_BYTES) fail('HOST_PROTOCOL_BYTES_EXCEEDED');
  return envelope;
}

export function validateHostEnvelope(
  value: unknown,
  options: { now?: number | Date; maxFutureSkewMs?: number } = {},
): HostEnvelope {
  exact(value, ENVELOPE_KEYS);
  if (value.protocolVersion !== HOST_PROTOCOL_VERSION) fail('HOST_PROTOCOL_UNKNOWN_VERSION');
  if (typeof value.kind !== 'string' || !KINDS.includes(value.kind as HostEnvelopeKind)) fail('HOST_PROTOCOL_UNKNOWN_KIND');
  text(value.requestId); text(value.correlationId); text(value.issuedAt); text(value.expiresAt);
  if (typeof value.digest !== 'string' || !HEX_DIGEST.test(value.digest)) fail('HOST_PROTOCOL_INVALID_FIELD');
  const issued = Date.parse(value.issuedAt as string); const expires = Date.parse(value.expiresAt as string);
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || expires <= issued) fail('HOST_PROTOCOL_INVALID_FIELD');
  if (Buffer.byteLength(canonicalJson(value), 'utf8') > HOST_ENVELOPE_MAX_BYTES) fail('HOST_PROTOCOL_BYTES_EXCEEDED');
  const { digest: _digest, ...base } = value;
  if (envelopeDigest(base as Omit<HostEnvelope, 'digest'>) !== value.digest) fail('HOST_PROTOCOL_DIGEST_MISMATCH');
  validatePayload(value.kind as HostEnvelopeKind, value.payload);
  if (options.now !== undefined) {
    const now = options.now instanceof Date ? options.now.getTime() : options.now;
    const skew = options.maxFutureSkewMs ?? HOST_MAX_FUTURE_SKEW_MS;
    if (issued > now + skew) fail('HOST_PROTOCOL_FUTURE_SKEW');
    if (expires <= now) fail('HOST_PROTOCOL_EXPIRED');
  }
  return value as HostEnvelope;
}

export function assertHostBinding(actual: HostBinding, expected: Partial<HostBinding>): void {
  for (const key of Object.keys(expected) as Array<keyof HostBinding>) {
    if (actual[key] !== expected[key]) fail('HOST_PROTOCOL_BINDING_MISMATCH');
  }
}

export function safeDiagnostics(
  binding: HostBinding,
  entries: Array<{ code: string; message: string }>,
  now = Date.now(),
): HostEnvelope<'safe_diagnostics'> {
  return createHostEnvelope('safe_diagnostics', { binding, entries }, {
    requestId: `diagnostic-${binding.sessionId}`,
    correlationId: binding.sessionId,
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 30_000).toISOString(),
  });
}