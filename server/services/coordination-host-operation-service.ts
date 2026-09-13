/**
 * Host protocol composition layer.  Durable authority remains in the
 * transport lease service; this module only translates closed envelopes to
 * that existing service and checks host-provided values as evidence.
 */
import { createHostEnvelope, validateHostEnvelope, assertHostBinding,
  type HostBinding, type HostEnvelope } from './coordination-host-protocol';
import { digestCanonical } from './coordination-runtime';
import {
  pollCoordinationTransportWork,
  claimCoordinationTransportWork,
  resultCoordinationTransportWork,
  acknowledgeCoordinationCleanup,
  validateCurrentCoordinationTransportLease,
  type LeaseFenceInput,
} from './coordination-transport-lease-service';

export type ServerAuthorizedOperation = {
  policyVersionId: string;
  sessionId: string;
  attemptId: string;
  enrolledHostId: string;
  transportLeaseId: string;
  leaseEpoch: number;
  holderInstanceId: string;
  operation: string;
  operationDigest?: string;
};

export type HostOperationAdapter = {
  execute(request: { operation: string; operationDigest: string; input: Record<string, unknown> }):
    Promise<Record<string, unknown>>;
};

export class CoordinationHostOperationError extends Error {
  constructor(readonly code: 'HOST_OPERATION_INVALID_ENVELOPE' | 'HOST_OPERATION_BINDING_MISMATCH' | 'HOST_OPERATION_NOT_AUTHORIZED') {
    super(code);
    this.name = 'CoordinationHostOperationError';
  }
}

function bindingOf(operation: ServerAuthorizedOperation): HostBinding {
  return {
    policyVersionId: operation.policyVersionId,
    sessionId: operation.sessionId,
    attemptId: operation.attemptId,
    enrolledHostId: operation.enrolledHostId,
    transportLeaseId: operation.transportLeaseId,
    leaseEpoch: operation.leaseEpoch,
    holderInstanceId: operation.holderInstanceId,
    operation: operation.operation,
    operationDigest: operation.operationDigest ?? deriveServerOperationDigest(operation),
  };
}

/** Digest only coordinator-owned logical operation identity; no host evidence. */
export function deriveServerOperationDigest(operation: Pick<ServerAuthorizedOperation,
  'policyVersionId' | 'sessionId' | 'attemptId' | 'operation'>): string {
  return digestCanonical({
    policyVersionId: operation.policyVersionId,
    sessionId: operation.sessionId,
    attemptId: operation.attemptId,
    operation: operation.operation,
  });
}

export function createServerOperationEnvelope(
  kind: 'operation_claim' | 'claim_renewal' | 'work_poll' | 'terminal_state' | 'cleanup_request',
  operation: ServerAuthorizedOperation,
  ids: { requestId: string; correlationId: string; issuedAt: string; expiresAt: string },
  extra: Record<string, unknown> = {},
): HostEnvelope {
  const binding = bindingOf(operation);
  if (kind === 'terminal_state') return createHostEnvelope(kind, { binding, state: extra.state ?? 'completed', reason: extra.reason ?? 'server_authorized' }, ids);
  if (kind === 'cleanup_request') return createHostEnvelope(kind, { binding, obligationId: extra.obligationId }, ids);
  return createHostEnvelope(kind, { binding }, ids);
}

export const createServerWorkEnvelope = createServerOperationEnvelope;

export function validateIncomingHostEnvelope(
  envelope: unknown,
  expected: ServerAuthorizedOperation,
  now?: number | Date,
): HostEnvelope {
  try {
    const value = validateHostEnvelope(envelope, now === undefined ? {} : { now });
    const payload = value.payload as Record<string, unknown>;
    if (!payload.binding || typeof payload.binding !== 'object') throw new CoordinationHostOperationError('HOST_OPERATION_INVALID_ENVELOPE');
    assertHostBinding(payload.binding as HostBinding, bindingOf(expected));
    return value;
  } catch (error) {
    if (error instanceof CoordinationHostOperationError) throw error;
    throw new CoordinationHostOperationError(
      (error as { code?: string }).code === 'HOST_PROTOCOL_BINDING_MISMATCH'
        ? 'HOST_OPERATION_BINDING_MISMATCH' : 'HOST_OPERATION_INVALID_ENVELOPE',
    );
  }
}

export function operationInputFromEnvelope(
  envelope: unknown,
  expected: ServerAuthorizedOperation,
  now?: number | Date,
): Record<string, unknown> {
  const value = validateIncomingHostEnvelope(envelope, expected, now);
  const payload = value.payload as Record<string, unknown>;
  // Host result/evidence is never copied into the authority binding.
  return payload;
}

function transportInput(operation: ServerAuthorizedOperation, envelope: HostEnvelope, actorId: string): LeaseFenceInput {
  const payload = envelope.payload as Record<string, unknown>;
  const binding = payload.binding as HostBinding;
  const value: Record<string, unknown> = {
    sessionId: operation.sessionId,
    enrolledHostId: operation.enrolledHostId,
    holderInstanceId: operation.holderInstanceId,
    actorId,
    requestKey: envelope.requestId,
    leaseId: operation.transportLeaseId,
    epoch: binding.leaseEpoch,
    attemptId: operation.attemptId,
    protocolBinding: binding,
    authorizedOperation: operation.operation,
    operation: envelope.kind === 'work_poll' ? 'poll' : envelope.kind === 'operation_claim' ? 'claim' : 'result',
    ...(envelope.kind === 'structured_result' && payload.result && typeof payload.result === 'object'
      ? { result: payload.result as Record<string, unknown> } : {}),
  };
  return value as unknown as LeaseFenceInput;
}

export async function pollHostWork(
  envelope: unknown,
  operation: ServerAuthorizedOperation,
  actorId: string,
): Promise<Record<string, unknown>> {
  const parsed = validateIncomingHostEnvelope(envelope, operation);
  if (parsed.kind !== 'work_poll') throw new CoordinationHostOperationError('HOST_OPERATION_INVALID_ENVELOPE');
  return pollCoordinationTransportWork(transportInput(operation, parsed, actorId));
}

export async function claimHostOperation(
  envelope: unknown,
  operation: ServerAuthorizedOperation,
  actorId: string,
): Promise<Record<string, unknown>> {
  const parsed = validateIncomingHostEnvelope(envelope, operation);
  if (parsed.kind !== 'operation_claim') throw new CoordinationHostOperationError('HOST_OPERATION_INVALID_ENVELOPE');
  return claimCoordinationTransportWork(transportInput(operation, parsed, actorId));
}

export async function renewHostOperation(
  envelope: unknown,
  operation: ServerAuthorizedOperation,
  actorId: string,
): Promise<Record<string, unknown>> {
  const parsed = validateIncomingHostEnvelope(envelope, operation);
  if (parsed.kind !== 'claim_renewal') throw new CoordinationHostOperationError('HOST_OPERATION_INVALID_ENVELOPE');
  const input = transportInput(operation, parsed, actorId);
  return validateCurrentCoordinationTransportLease({ ...input, operation: 'claim' });
}

export const renewHostClaim = renewHostOperation;

export async function submitHostStructuredResult(
  envelope: unknown,
  operation: ServerAuthorizedOperation,
  actorId: string,
): Promise<Record<string, unknown>> {
  const parsed = validateIncomingHostEnvelope(envelope, operation);
  if (parsed.kind !== 'structured_result') throw new CoordinationHostOperationError('HOST_OPERATION_INVALID_ENVELOPE');
  return resultCoordinationTransportWork(transportInput(operation, parsed, actorId));
}

export async function acknowledgeHostCleanup(
  envelope: unknown,
  operation: ServerAuthorizedOperation,
  actorId: string,
): Promise<Record<string, unknown>> {
  const parsed = validateIncomingHostEnvelope(envelope, operation);
  if (parsed.kind !== 'cleanup_acknowledgement') throw new CoordinationHostOperationError('HOST_OPERATION_INVALID_ENVELOPE');
  const payload = parsed.payload as Record<string, unknown>;
  return acknowledgeCoordinationCleanup({
    ...transportInput(operation, parsed, actorId),
    obligationId: payload.obligationId as string,
    evidence: payload.evidence as Record<string, unknown>,
  });
}