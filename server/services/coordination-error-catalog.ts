/**
 * Coordinator V2's stable, operator-safe diagnostics vocabulary.
 *
 * Error classes intentionally keep their historical public codes.  This
 * catalog is an additive projection: routes may continue returning `{ code }`
 * while trusted diagnostics can attach a phase, retry decision, evidence
 * pointer kind, and a small amount of non-secret provenance.
 */

export type CoordinationDiagnosticPhase =
  | 'authorization'
  | 'cleanup'
  | 'host_enrollment'
  | 'host_operation'
  | 'host_protocol'
  | 'lifecycle'
  | 'policy'
  | 'preparation'
  | 'provider'
  | 'session'
  | 'attempt'
  | 'transport';

export type CoordinationRetryClassification =
  | 'do_not_retry'
  | 'retry_with_backoff'
  | 'retry_after_reconciliation'
  | 'operator_action_required'
  | 'repair_required';

export type CoordinationEvidenceReferenceType =
  | 'none'
  | 'session_event'
  | 'attempt_event'
  | 'cleanup_obligation'
  | 'transport_lease'
  | 'host_envelope'
  | 'policy_record'
  | 'preparation_record'
  | 'provider_record'
  | 'diagnostic_digest';

const SESSION_CODES = [
  'SESSION_INVALID_REQUEST', 'SESSION_NOT_FOUND', 'SESSION_CONFLICT',
  'SESSION_POLICY_NOT_APPROVED', 'SESSION_POLICY_REVOKED',
  'SESSION_GRANT_NOT_FOUND', 'SESSION_GRANT_INVALID', 'SESSION_HOST_NOT_FOUND',
  'SESSION_HOST_INACTIVE', 'SESSION_PROVIDER_NOT_ALLOWED', 'SESSION_DATABASE_UNAVAILABLE',
  'SESSION_TRANSITION_REJECTED', 'SESSION_REQUEST_REPLAY_CONFLICT',
  'SESSION_RETRYABLE_DATABASE_CONFLICT',
] as const;
const ATTEMPT_CODES = [
  'ATTEMPT_INVALID_REQUEST', 'ATTEMPT_NOT_FOUND', 'ATTEMPT_SESSION_NOT_FOUND',
  'ATTEMPT_SESSION_TERMINAL', 'ATTEMPT_PROVIDER_NOT_ALLOWED', 'ATTEMPT_BUDGET_EXHAUSTED',
  'ATTEMPT_PREVIOUS_INVALID', 'ATTEMPT_TRANSITION_REJECTED', 'ATTEMPT_REQUEST_REPLAY_CONFLICT',
  'ATTEMPT_DATABASE_UNAVAILABLE', 'ATTEMPT_RETRYABLE_DATABASE_CONFLICT',
] as const;
const CLEANUP_CODES = [
  'CLEANUP_INVALID_REQUEST', 'CLEANUP_NOT_FOUND', 'CLEANUP_SESSION_NOT_FOUND',
  'CLEANUP_REPLAY_CONFLICT', 'CLEANUP_TRANSITION_REJECTED', 'CLEANUP_RECEIPTS_EXHAUSTED',
  'CLEANUP_DATABASE_UNAVAILABLE',
] as const;
const LIFECYCLE_CODES = [
  'LIFECYCLE_INVALID_REQUEST', 'LIFECYCLE_TASK_UNSUPPORTED',
  'LIFECYCLE_POLICY_UNAVAILABLE', 'LIFECYCLE_HOST_UNAVAILABLE',
  'LIFECYCLE_PROVIDER_UNAVAILABLE', 'LIFECYCLE_DATABASE_UNAVAILABLE',
  'LIFECYCLE_TRANSITION_REJECTED',
] as const;
const STATUS_CODES = [
  'STATUS_INVALID_REQUEST', 'STATUS_NOT_FOUND', 'STATUS_NOT_AUTHORIZED',
  'STATUS_DATABASE_UNAVAILABLE',
] as const;
const AUTHORIZATION_CODES = [
  'LIFECYCLE_SESSION_NOT_FOUND', 'LIFECYCLE_ACTOR_MISMATCH',
  'LIFECYCLE_GRANT_INVALID', 'LIFECYCLE_POLICY_INVALID',
  'LIFECYCLE_HOST_INVALID', 'LIFECYCLE_SESSION_EXPIRED',
  'LIFECYCLE_ACTION_DENIED',
] as const;
const LEASE_CODES = [
  'LEASE_INVALID_REQUEST', 'LEASE_NOT_FOUND', 'LEASE_CONFLICT',
  'LEASE_STALE_EPOCH', 'LEASE_EXPIRED', 'LEASE_HOST_MISMATCH',
  'LEASE_HOLDER_MISMATCH', 'LEASE_AUTHORIZATION_DENIED',
  'LEASE_SESSION_TERMINAL', 'LEASE_REPLAY_CONFLICT',
  'LEASE_RECONCILIATION_LIMIT', 'LEASE_DATABASE_UNAVAILABLE',
] as const;
const HOST_PROTOCOL_CODES = [
  'HOST_PROTOCOL_UNKNOWN_VERSION', 'HOST_PROTOCOL_UNKNOWN_KIND',
  'HOST_PROTOCOL_EXTRA_FIELDS', 'HOST_PROTOCOL_MISSING_FIELD',
  'HOST_PROTOCOL_INVALID_FIELD', 'HOST_PROTOCOL_BYTES_EXCEEDED',
  'HOST_PROTOCOL_DIGEST_MISMATCH', 'HOST_PROTOCOL_EXPIRED',
  'HOST_PROTOCOL_FUTURE_SKEW', 'HOST_PROTOCOL_BINDING_MISMATCH',
  'HOST_PROTOCOL_UNSAFE_DIAGNOSTICS',
] as const;
const HOST_CODES = [
  'HOST_ENROLLMENT_INVALID_DECLARATION', 'HOST_ENROLLMENT_INCOMPATIBLE',
  'HOST_OPERATION_INVALID_ENVELOPE', 'HOST_OPERATION_BINDING_MISMATCH',
  'HOST_OPERATION_NOT_AUTHORIZED',
] as const;
const PREPARATION_CODES = [
  'PREPARATION_INVALID_REQUEST', 'PREPARATION_NOT_FOUND',
  'PREPARATION_CONFLICT', 'PREPARATION_REPLAY_CONFLICT',
  'PREPARATION_AUTHORIZATION_DENIED', 'PREPARATION_EXPIRED',
  'PREPARATION_INVALID_TRANSITION', 'PREPARATION_DATABASE_UNAVAILABLE',
] as const;
const POLICY_CODES = [
  'POLICY_INVALID', 'POLICY_NOT_FOUND', 'POLICY_VERSION_NOT_FOUND',
  'POLICY_IDENTITY_REVOKED', 'POLICY_ALREADY_APPROVED',
  'POLICY_ALREADY_REJECTED', 'POLICY_ALREADY_REVOKED', 'POLICY_NOT_DRAFT',
  'POLICY_NOT_APPROVED', 'FOUNDER_REQUIRED', 'FOUNDER_DECISION_REQUIRED',
  'IDEMPOTENCY_CONFLICT', 'OPERATOR_REQUIRED', 'OPERATOR_GRANT_NOT_FOUND',
  'OPERATOR_GRANT_EXPIRED', 'OPERATOR_GRANT_REVOKED', 'OPERATOR_GRANT_SCOPE_DENIED',
  'OPERATOR_GRANT_ACTION_DENIED', 'OPERATOR_GRANT_POLICY_DENIED',
  'OPERATOR_GRANT_ALREADY_REVOKED', 'OPERATOR_GRANT_INVALID',
  'POLICY_DATABASE_UNAVAILABLE',
] as const;
const TASK_CODES = ['TASK_METADATA_INVALID_REQUEST', 'TASK_METADATA_UNSUPPORTED'] as const;
const PROVIDER_CODES = [
  'duplicate_registration', 'invalid_descriptor', 'unknown_descriptor',
  'policy_disallowed_provider', 'policy_disallowed_model',
  'policy_disallowed_adapter_version',
] as const;
const POLICY_VALIDATION_CODES = [
  'policy_not_object', 'policy_unknown_field', 'policy_secret_field',
  'policy_invalid_string', 'policy_invalid_array', 'policy_invalid_map',
  'policy_invalid_provider_order', 'policy_invalid_tool', 'policy_invalid_path',
  'policy_invalid_command', 'policy_invalid_duration', 'policy_invalid_budget',
  'policy_provider_budget_mismatch',
] as const;
const EXTRA_CODES = [
  // Existing route-level public codes, and the two Milestone 10 stable codes.
  'COORDINATION_INVALID_COMMAND', 'COORDINATION_DATABASE_UNAVAILABLE',
  'host_child_unclassified_exit', 'cleanup_required',
] as const;

export const COORDINATION_SERVICE_ERROR_CODES = Object.freeze([
  ...SESSION_CODES, ...ATTEMPT_CODES, ...CLEANUP_CODES, ...LIFECYCLE_CODES,
  ...AUTHORIZATION_CODES, ...STATUS_CODES, ...LEASE_CODES, ...HOST_PROTOCOL_CODES, ...HOST_CODES,
  ...PREPARATION_CODES, ...POLICY_CODES, ...TASK_CODES, ...PROVIDER_CODES,
  ...POLICY_VALIDATION_CODES, ...EXTRA_CODES,
] as const);

export type CoordinationCatalogCode = typeof COORDINATION_SERVICE_ERROR_CODES[number];

export type CoordinationErrorCatalogEntry = Readonly<{
  code: CoordinationCatalogCode;
  phase: CoordinationDiagnosticPhase;
  retryClassification: CoordinationRetryClassification;
  /** Compatibility spelling for integrations that use the shorter field. */
  retryClass: CoordinationRetryClassification;
  safeMessage: string;
  evidenceReferenceType: CoordinationEvidenceReferenceType;
  /** Compatibility spelling for the evidence-reference field. */
  evidenceRefType: CoordinationEvidenceReferenceType;
}>;

const SAFE_MESSAGES: Record<CoordinationDiagnosticPhase, string> = {
  authorization: 'Coordination authorization could not be established.',
  cleanup: 'Coordination cleanup requires attention before this session is complete.',
  host_enrollment: 'The enrolled host did not satisfy the coordinator contract.',
  host_operation: 'The host operation was not accepted by the coordinator.',
  host_protocol: 'The host message did not satisfy the coordinator protocol.',
  lifecycle: 'The coordination lifecycle could not advance safely.',
  policy: 'The coordination policy could not be applied.',
  preparation: 'Host preparation could not be completed safely.',
  provider: 'The selected provider is not available for this operation.',
  session: 'The coordination session could not be changed safely.',
  attempt: 'The coordination attempt could not be changed safely.',
  transport: 'The host transport lease could not be changed safely.',
};

function phaseFor(code: string): CoordinationDiagnosticPhase {
  if (code.startsWith('SESSION_')) return 'session';
  if (code.startsWith('ATTEMPT_')) return 'attempt';
  if (code.startsWith('CLEANUP_') || code === 'cleanup_required') return 'cleanup';
  if (code.startsWith('LIFECYCLE_')) {
    return ['LIFECYCLE_SESSION_NOT_FOUND', 'LIFECYCLE_ACTOR_MISMATCH',
      'LIFECYCLE_GRANT_INVALID', 'LIFECYCLE_POLICY_INVALID',
      'LIFECYCLE_HOST_INVALID', 'LIFECYCLE_SESSION_EXPIRED',
      'LIFECYCLE_ACTION_DENIED'].includes(code) ? 'authorization' : 'lifecycle';
  }
  if (code === 'STATUS_NOT_AUTHORIZED') return 'authorization';
  if (code.startsWith('STATUS_')) return 'lifecycle';
  if (code.startsWith('LEASE_')) return 'transport';
  if (code.startsWith('HOST_PROTOCOL_')) return 'host_protocol';
  if (code.startsWith('HOST_ENROLLMENT_')) return 'host_enrollment';
  if (code.startsWith('HOST_OPERATION_')) return 'host_operation';
  if (code.startsWith('PREPARATION_') || code.startsWith('TASK_METADATA_')) return 'preparation';
  if (code.startsWith('POLICY_') || code.startsWith('OPERATOR_')
    || code.startsWith('FOUNDER_') || code.startsWith('IDEMPOTENCY')
    || code.startsWith('policy_')) return 'policy';
  if (code === 'COORDINATION_INVALID_COMMAND' || code === 'COORDINATION_DATABASE_UNAVAILABLE') return 'lifecycle';
  if (code === 'host_child_unclassified_exit') return 'host_operation';
  return 'provider';
}

function evidenceFor(phase: CoordinationDiagnosticPhase): CoordinationEvidenceReferenceType {
  const references: Record<CoordinationDiagnosticPhase, CoordinationEvidenceReferenceType> = {
    authorization: 'policy_record',
    cleanup: 'cleanup_obligation',
    host_enrollment: 'host_envelope',
    host_operation: 'host_envelope',
    host_protocol: 'host_envelope',
    lifecycle: 'session_event',
    policy: 'policy_record',
    preparation: 'preparation_record',
    provider: 'provider_record',
    session: 'session_event',
    attempt: 'attempt_event',
    transport: 'transport_lease',
  };
  return references[phase];
}

function retryFor(code: string, phase: CoordinationDiagnosticPhase): CoordinationRetryClassification {
  if (code === 'cleanup_required') return 'repair_required';
  if (code === 'host_child_unclassified_exit') return 'retry_after_reconciliation';
  if (code.includes('DATABASE_UNAVAILABLE') || code.includes('RETRYABLE_DATABASE_CONFLICT')) {
    return 'retry_with_backoff';
  }
  if (code.includes('RECONCILIATION_LIMIT')) return 'retry_after_reconciliation';
  if (code.includes('TRANSITION_REJECTED') || code.includes('INVALID_TRANSITION')
    || code.includes('TERMINAL') || code.includes('EXPIRED')) return 'operator_action_required';
  // Provider transport and replay conflicts are safe to retry only with the
  // same idempotency key; all other validation/authority failures are final.
  if (code.includes('REPLAY_CONFLICT') || code.includes('CONFLICT')) return 'retry_with_backoff';
  return phase === 'cleanup' ? 'operator_action_required' : 'do_not_retry';
}

function makeEntry(code: CoordinationCatalogCode): CoordinationErrorCatalogEntry {
  const phase = phaseFor(code);
  return Object.freeze({
    code, phase, retryClassification: retryFor(code, phase),
    retryClass: retryFor(code, phase),
    safeMessage: SAFE_MESSAGES[phase],
    evidenceReferenceType: evidenceFor(phase),
    evidenceRefType: evidenceFor(phase),
  });
}

export const COORDINATION_ERROR_CATALOG: Readonly<Record<CoordinationCatalogCode, CoordinationErrorCatalogEntry>> =
  Object.freeze(Object.fromEntries(
    COORDINATION_SERVICE_ERROR_CODES.map((code) => [code, makeEntry(code)]),
  )) as Readonly<Record<CoordinationCatalogCode, CoordinationErrorCatalogEntry>>;

// Short aliases make the catalog convenient for route and host integrations.
export const coordinationErrorCatalog = COORDINATION_ERROR_CATALOG;
export const COORDINATION_ERROR_CODES = COORDINATION_SERVICE_ERROR_CODES;

export function getCoordinationErrorCatalogEntry(
  code: CoordinationCatalogCode,
): CoordinationErrorCatalogEntry {
  const entry = COORDINATION_ERROR_CATALOG[code];
  if (!entry) throw new Error(`Unknown coordination diagnostic code: ${String(code)}`);
  return entry;
}

/**
 * Only these fields can be provenance.  In particular, stderr, exception
 * messages, credentials, paths, commands, and provider-native payloads have
 * no representable field here.
 */
const PROVENANCE_KEYS = new Set([
  'service', 'operation', 'requestId', 'policyVersionId', 'sessionId',
  'attemptId', 'hostId', 'hostType', 'runtimeId', 'leaseId', 'obligationId',
  'provider', 'model', 'adapterVersion', 'executableRole', 'exitStatus',
  'evidenceCount', 'retryCount',
]);
const SECRET_SHAPED = /secret|password|token|credential|ciphertext|plaintext|bearer|api[_-]?key|private[_-]?key|authorization|stderr|sentinel/i;
const SAFE_KEY = /^[a-z][a-zA-Z0-9]{0,31}$/;

export type CoordinationProvenance = Readonly<Record<string, string | number | boolean>>;

export function sanitizeCoordinationProvenance(value: unknown): CoordinationProvenance {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return Object.freeze({});
  const result: Record<string, string | number | boolean> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (Object.keys(result).length >= 16 || !PROVENANCE_KEYS.has(key)
      || !SAFE_KEY.test(key) || SECRET_SHAPED.test(key)) continue;
    if (typeof raw === 'string') {
      if (raw.length === 0 || raw.length > 128 || raw.trim() !== raw
        || /[\u0000-\u001f\u007f]/.test(raw) || SECRET_SHAPED.test(raw)) continue;
      result[key] = raw;
    } else if (typeof raw === 'number' && Number.isSafeInteger(raw)
      && (key === 'exitStatus'
        ? raw >= -2_147_483_648 && raw <= 2_147_483_647
        : Math.abs(raw) <= 1_000_000_000)) {
      result[key] = raw;
    } else if (typeof raw === 'boolean') {
      result[key] = raw;
    }
  }
  return Object.freeze(result);
}

export type CoordinationDiagnostic = Readonly<CoordinationErrorCatalogEntry & {
  provenance: CoordinationProvenance;
}>;

export function createCoordinationDiagnostic(
  code: CoordinationCatalogCode,
  provenance?: unknown,
): CoordinationDiagnostic {
  const entry = COORDINATION_ERROR_CATALOG[code];
  if (!entry) throw new Error(`Unknown coordination diagnostic code: ${String(code)}`);
  return Object.freeze({ ...entry, provenance: sanitizeCoordinationProvenance(provenance) });
}

export function diagnosticForCoordinationError(
  error: unknown,
  provenance?: unknown,
): CoordinationDiagnostic | undefined {
  const code = error && typeof error === 'object' && 'code' in error
    ? (error as { code?: unknown }).code : undefined;
  return typeof code === 'string' && code in COORDINATION_ERROR_CATALOG
    ? createCoordinationDiagnostic(code as CoordinationCatalogCode, provenance)
    : undefined;
}

export const buildCoordinationDiagnostic = createCoordinationDiagnostic;
