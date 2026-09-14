/**
 * Coordinator V2's host-side lifecycle loop.
 *
 * This module is deliberately boring: the coordinator owns all decisions and
 * the host only moves envelopes between an injected transport and an injected
 * operation adapter.  In particular, none of the values in HostBinding are
 * operator input.
 */
import {
  runCoordinationWindowsPreflight,
  type PreflightDependencies,
  type PreflightOptions,
  type PreflightReport,
} from "./coordination-windows-preflight";
import {
  type LocalPreparationDependencies,
  type LocalPreparationReservation,
  type LocalPreparationResult,
} from "./coordination-windows-prepare";
import { CoordinationHostFake } from "./coordination-host-fake";
import {
  assertHostBinding,
  validateHostEnvelope,
  type HostBinding,
  type HostEnvelope,
} from "../services/coordination-host-protocol";
import type { HostOperationAdapter } from "../services/coordination-host-operation-service";

export type CoordinationWindowsOperatorInput = Readonly<{
  taskRef: string;
  policySelector?: string;
}>;

export type CoordinationWindowsTerminalState =
  | "succeeded"
  | "failed"
  | "exhausted"
  | "expired"
  | "revoked"
  | "cleanup_pending"
  | "preflight_failed"
  | "host_unavailable"
  | "invalid_request";

export type CoordinationWindowsSafeStatus = Readonly<{
  state: CoordinationWindowsTerminalState;
  cleanupAcknowledged: boolean;
}>;

/** The only exit values the M9 command is allowed to expose. */
export const COORDINATION_WINDOWS_EXIT_CODES: Readonly<Record<CoordinationWindowsTerminalState, number>> = {
  succeeded: 0,
  failed: 1,
  exhausted: 1,
  expired: 1,
  revoked: 1,
  cleanup_pending: 75,
  preflight_failed: 78,
  host_unavailable: 69,
  invalid_request: 64,
};

export type CoordinationWindowsHostResult = Readonly<{
  status: CoordinationWindowsSafeStatus;
  exitCode: number;
}>;

export type CoordinationWindowsPreparationInput = {
  reservation: LocalPreparationReservation;
  root: string;
  activePointer: string;
  publicArtifacts: Record<string, Uint8Array | string>;
  secretPlaintext?: Uint8Array | string;
  dependencies: LocalPreparationDependencies;
  acknowledgementRequestKey: string;
  safePromotionEvidenceDigest: string;
};

export type CoordinationWindowsBoundState = {
  readonly sessionId: string;
  readonly reservationId: string;
  readonly generationId: string;
  readonly policyVersionId: string;
  readonly attemptId: string;
  readonly enrolledHostId: string;
  readonly leaseId: string;
  readonly leaseEpoch: number;
  readonly holderInstanceId: string;
  readonly binding: Record<string, unknown>;
  readonly sessionToken: string;
  readonly cleanupSessionToken: string;
  readonly cleanupCredentialId: string;
};
export type CoordinationWindowsAcknowledgedState = {
  readonly sessionId: string;
  readonly reservationId: string;
  readonly generationId: string;
  readonly policyVersionId: string;
  readonly attemptId: string;
  readonly enrolledHostId: string;
};
export type CoordinationWindowsLifecycleState = CoordinationWindowsBoundState | {
  /** Pre-acknowledgement opaque state; never returned by the host. */
  readonly [key: string]: unknown;
};

const ACKNOWLEDGED_STATE_KEYS = [
  "sessionId", "reservationId", "generationId", "policyVersionId", "attemptId", "enrolledHostId",
] as const;

export function validateCoordinationWindowsAcknowledgedState(
  value: unknown,
): CoordinationWindowsAcknowledgedState {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype) throw new Error("acknowledged_state_invalid");
  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate).sort();
  const expectedKeys = [...ACKNOWLEDGED_STATE_KEYS].sort();
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
    throw new Error("acknowledged_state_invalid");
  }
  for (const key of ACKNOWLEDGED_STATE_KEYS) {
    const field = candidate[key];
    if (typeof field !== "string" || field.length === 0 || field.length > 256 || field.trim() !== field) {
      throw new Error("acknowledged_state_invalid");
    }
  }
  return candidate as CoordinationWindowsAcknowledgedState;
}

function boundState(value: unknown): CoordinationWindowsBoundState {
  if (!value || typeof value !== "object") throw new Error("bound_state_missing");
  const candidate = value as Record<string, unknown>;
  const strings = ["sessionId", "reservationId", "generationId", "policyVersionId", "attemptId",
    "enrolledHostId", "leaseId", "holderInstanceId", "sessionToken", "cleanupSessionToken", "cleanupCredentialId"];
  if (strings.some((key) => typeof candidate[key] !== "string" || !(candidate[key] as string))) throw new Error("bound_state_invalid");
  if (!Number.isSafeInteger(candidate.leaseEpoch) || (candidate.leaseEpoch as number) < 0
    || !candidate.binding || typeof candidate.binding !== "object") throw new Error("bound_state_invalid");
  return candidate as unknown as CoordinationWindowsBoundState;
}

function stateUpdate(current: CoordinationWindowsLifecycleState, update: unknown): CoordinationWindowsLifecycleState {
  if (update === undefined) return current;
  return boundState({ ...current, ...(update as Record<string, unknown>) });
}

export type CoordinationWindowsExecutionJournal = {
  /**
   * Atomically records that this validated claim has started, or returns the
   * exact result of a claim completed by an earlier process.
   */
  begin: (
    claimIdentity: string,
    claim: HostEnvelope<"operation_claim">,
  ) => Promise<{ state: "started"; fresh: boolean } | {
    state: "completed";
    result: HostEnvelope<"structured_result">;
  }> | { state: "started"; fresh: boolean } | {
    state: "completed";
    result: HostEnvelope<"structured_result">;
  };
  /** Atomically records the exact structured_result envelope. */
  complete: (
    claimIdentity: string,
    result: HostEnvelope<"structured_result">,
  ) => Promise<void> | void;
  /**
   * Reconciles a started claim with an authoritative host/adapter record.
   * Returning undefined means that execution cannot be proven to have
   * completed and the host must fail closed rather than execute again.
   */
  reconcile?: (
    input: {
      claimIdentity: string;
      operationDigest: string;
      claim: HostEnvelope<"operation_claim">;
    },
  ) => Promise<HostEnvelope<"structured_result"> | undefined>
    | HostEnvelope<"structured_result"> | undefined;
};

export type CoordinationWindowsLifecycleTransport = {
  start(input: CoordinationWindowsOperatorInput): Promise<{
    state?: CoordinationWindowsLifecycleState;
    preparation?: CoordinationWindowsPreparationInput;
    terminalState?: string;
    /** Server-proven preparation state. It is mutually exclusive with payload. */
    alreadyAcknowledged?: boolean;
  }>;
  acquireLease(input: { state: CoordinationWindowsLifecycleState }): Promise<{
    state?: CoordinationWindowsLifecycleState;
    terminalState?: string;
  }>;
  poll(input: { state: CoordinationWindowsLifecycleState; requestKey: string }): Promise<{
    state?: CoordinationWindowsLifecycleState;
    action: "operation_available" | "renew";
    offer?: unknown;
    terminalState?: string;
  }>;
  /** Mandatory server fence. Poll only returns an opaque offer. */
  claim(input: {
    state: CoordinationWindowsLifecycleState;
    requestKey: string;
    offer: unknown;
  }): Promise<{
    state?: CoordinationWindowsLifecycleState;
    claim?: unknown;
    terminalState?: string;
  }>;
  renew?(input: { state: CoordinationWindowsLifecycleState; requestKey: string }): Promise<{
    state?: CoordinationWindowsLifecycleState;
    terminalState?: string;
  }>;
  result(input: {
    state: CoordinationWindowsLifecycleState;
    requestKey: string;
    result: HostEnvelope<"structured_result">;
  }): Promise<{ state?: CoordinationWindowsLifecycleState; terminalState?: string }>;
  cleanup(input: {
    state: CoordinationWindowsLifecycleState;
    requestKey: string;
  }): Promise<{ state?: CoordinationWindowsLifecycleState; acknowledged?: boolean; terminalState?: string }>;
  /** Optional bounded retry hook for a transport implementation. */
  maxRetries?: number;
};

export type CoordinationWindowsHostDependencies = {
  transport: CoordinationWindowsLifecycleTransport;
  preflight: {
    options: PreflightOptions;
    dependencies: PreflightDependencies;
  } | ((input: CoordinationWindowsOperatorInput) => Promise<PreflightReport>);
  prepare?: (input: CoordinationWindowsPreparationInput) => Promise<LocalPreparationResult>;
  host?: Pick<CoordinationHostFake, "execute">;
  operationAdapter?: HostOperationAdapter;
  executionJournal: CoordinationWindowsExecutionJournal;
  reconcileExecution?: CoordinationWindowsExecutionJournal["reconcile"];
  now?: () => number;
  maxPolls?: number;
};

const terminalStates = new Set<CoordinationWindowsTerminalState>([
  "succeeded", "failed", "exhausted", "expired", "revoked", "cleanup_pending",
  "preflight_failed", "host_unavailable", "invalid_request",
]);

function safeTerminal(value: unknown): CoordinationWindowsTerminalState {
  if (typeof value === "string" && terminalStates.has(value as CoordinationWindowsTerminalState)) {
    return value as CoordinationWindowsTerminalState;
  }
  if (value === "completed" || value === "success") return "succeeded";
  return "failed";
}

function validateOperatorInput(input: CoordinationWindowsOperatorInput): void {
  if (!input || typeof input !== "object"
    || typeof input.taskRef !== "string" || !/^[1-9][0-9]*$/.test(input.taskRef)
    || Object.keys(input).some((key) => key !== "taskRef" && key !== "policySelector")
    || (input.policySelector !== undefined
      && (typeof input.policySelector !== "string" || input.policySelector.length === 0
        || input.policySelector.length > 128 || input.policySelector.trim() !== input.policySelector))) {
    throw new Error("invalid_request");
  }
}

function result(status: CoordinationWindowsSafeStatus): CoordinationWindowsHostResult {
  const safeStatus = status.state === "succeeded" && !status.cleanupAcknowledged
    ? { ...status, state: "cleanup_pending" as const }
    : status;
  return Object.freeze({
    status: Object.freeze(safeStatus),
    exitCode: COORDINATION_WINDOWS_EXIT_CODES[safeStatus.state],
  });
}

function validateStructuredResult(
  value: unknown,
  claim: HostEnvelope<"operation_claim">,
): HostEnvelope<"structured_result"> {
  const parsed = validateHostEnvelope(value);
  if (parsed.kind !== "structured_result") throw new Error("invalid_structured_result");
  const resultBinding = (parsed.payload as Record<string, unknown>).binding as HostBinding;
  const claimBinding = (claim.payload as Record<string, unknown>).binding as HostBinding;
  // Operation is intentionally per-envelope: a result cannot reuse the
  // claim's operation/digest, while the authority lineage must remain exact.
  assertHostBinding(resultBinding, {
    policyVersionId: claimBinding.policyVersionId,
    sessionId: claimBinding.sessionId,
    attemptId: claimBinding.attemptId,
    enrolledHostId: claimBinding.enrolledHostId,
    transportLeaseId: claimBinding.transportLeaseId,
    leaseEpoch: claimBinding.leaseEpoch,
    holderInstanceId: claimBinding.holderInstanceId,
  });
  if (!resultBinding.operation || !resultBinding.operationDigest) {
    throw new Error("invalid_result_operation_binding");
  }
  return parsed as HostEnvelope<"structured_result">;
}

/**
 * Run one host command.  `retry` is intentionally used around the complete
 * request, not around individual mutations: a lost acknowledgement therefore
 * repeats the exact same request key and envelope.
 */
async function retry<T>(operation: () => Promise<T>, attempts: number): Promise<T> {
  let lastError: unknown;
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("transport_unavailable");
}

export async function runCoordinationWindowsHost(
  input: CoordinationWindowsOperatorInput,
  dependencies: CoordinationWindowsHostDependencies,
): Promise<CoordinationWindowsHostResult> {
  try {
    validateOperatorInput(input);
  } catch {
    return result({ state: "invalid_request", cleanupAcknowledged: false });
  }

  const attempts = Math.max(1, Math.min(5, dependencies.transport.maxRetries ?? 2));
  try {
    const report = typeof dependencies.preflight === "function"
      ? await dependencies.preflight(input)
      : await runCoordinationWindowsPreflight(
        dependencies.preflight.options,
        dependencies.preflight.dependencies,
      );
    if (report.accepted !== true) return result({ state: "preflight_failed", cleanupAcknowledged: false });

    const started = await retry(() => dependencies.transport.start(input), attempts);
    if (started.terminalState) {
      const terminal = safeTerminal(started.terminalState);
      return finalizeTerminal(terminal, started.state ?? {}, dependencies, attempts);
    }
    if (started.preparation === null) return result({ state: "host_unavailable", cleanupAcknowledged: false });
    const hasPreparation = started.preparation !== undefined;
    if (hasPreparation && started.alreadyAcknowledged === true) {
      return result({ state: "host_unavailable", cleanupAcknowledged: false });
    }
    if (hasPreparation) {
      if (!dependencies.prepare) return result({ state: "host_unavailable", cleanupAcknowledged: false });
      const prepare = dependencies.prepare;
      let prepared = await retry(() => prepare(started.preparation!), attempts);
      // A promotion may be durable while its acknowledgement is lost. Retry
      // the exact generation/acknowledgement request rather than minting or
      // selecting another generation.
      if (prepared.state === "promoted" && prepared.recoverable) {
        prepared = await retry(() => prepare(started.preparation!), attempts);
      }
      if (prepared.state !== "acknowledged") {
        return result({ state: "failed", cleanupAcknowledged: false });
      }
    }
    // Preparation acknowledgement and an unacknowledged lifecycle response
    // never carry session authority. Re-read the lifecycle authority before
    // leasing, rather than trusting any initial state-shaped value.
    let acknowledgedState: unknown;
    if (hasPreparation || started.alreadyAcknowledged !== true) {
      const acknowledged = await retry(() => dependencies.transport.start(input), attempts);
      if (acknowledged.alreadyAcknowledged !== true
        || acknowledged.preparation !== undefined
        || !acknowledged.state) {
        return result({ state: "host_unavailable", cleanupAcknowledged: false });
      }
      acknowledgedState = acknowledged.state;
    } else {
      acknowledgedState = started.state;
    }
    let validatedState: CoordinationWindowsAcknowledgedState;
    try {
      validatedState = validateCoordinationWindowsAcknowledgedState(acknowledgedState);
    } catch {
      return result({ state: "host_unavailable", cleanupAcknowledged: false });
    }

    const leased = await retry(() => dependencies.transport.acquireLease({ state: validatedState }), attempts);
    let state: CoordinationWindowsLifecycleState;
    try { state = boundState(leased.state); } catch { return result({ state: "host_unavailable", cleanupAcknowledged: false }); }
    if (leased.terminalState) {
      const terminal = safeTerminal(leased.terminalState);
      return finalizeTerminal(terminal, state, dependencies, attempts);
    }

    const operationHost = dependencies.host
      ?? (dependencies.operationAdapter
        ? new CoordinationHostFake({ adapter: dependencies.operationAdapter, now: dependencies.now })
        : undefined);
    if (!operationHost) return result({ state: "host_unavailable", cleanupAcknowledged: false });

    const executionJournal = dependencies.executionJournal;
    if (!executionJournal) return result({ state: "host_unavailable", cleanupAcknowledged: false });
    const maxPolls = dependencies.maxPolls ?? 256;
    for (let pollIndex = 0; pollIndex < maxPolls; pollIndex += 1) {
      const pollKey = `poll:${pollIndex}`;
      const polled = await retry(
        () => dependencies.transport.poll({ state, requestKey: pollKey }),
        attempts,
      );
      try { state = stateUpdate(state, polled.state); } catch { return result({ state: "host_unavailable", cleanupAcknowledged: false }); }
      if (polled.terminalState) {
        const terminal = safeTerminal(polled.terminalState);
        return finalizeTerminal(terminal, state, dependencies, attempts);
      }
      if (polled.action === "renew") {
        if (!dependencies.transport.renew) return result({ state: "host_unavailable", cleanupAcknowledged: false });
        const renewed = await retry(
          () => dependencies.transport.renew!({ state, requestKey: `renew:${pollIndex}` }),
          attempts,
        );
        try { state = stateUpdate(state, renewed.state); } catch { return result({ state: "host_unavailable", cleanupAcknowledged: false }); }
        if (renewed.terminalState) {
          const terminal = safeTerminal(renewed.terminalState);
          return finalizeTerminal(terminal, state, dependencies, attempts);
        }
        continue;
      }
      if (polled.action !== "operation_available") continue;
      if (polled.offer === undefined) return result({ state: "host_unavailable", cleanupAcknowledged: false });

      // Poll is only an opaque offer. Execution is impossible until the
      // current server session/attempt/lease/holder fence returns its claim.
      const claimed = await retry(
        () => dependencies.transport.claim({
          state,
          requestKey: `claim:${pollIndex}`,
          offer: polled.offer!,
        }),
        attempts,
      );
      try { state = stateUpdate(state, claimed.state); } catch { return result({ state: "host_unavailable", cleanupAcknowledged: false }); }
      if (claimed.terminalState) {
        const terminal = safeTerminal(claimed.terminalState);
        return finalizeTerminal(terminal, state, dependencies, attempts);
      }
      if (claimed.claim === undefined) return result({ state: "host_unavailable", cleanupAcknowledged: false });
      const claim = claimed.claim;
      let validatedClaim: HostEnvelope<"operation_claim">;
      try {
        const envelope = validateHostEnvelope(claim, { now: dependencies.now?.() ?? Date.now() });
        if (envelope.kind !== "operation_claim") return result({ state: "host_unavailable", cleanupAcknowledged: false });
        validatedClaim = envelope as HostEnvelope<"operation_claim">;
      } catch {
        return result({ state: "host_unavailable", cleanupAcknowledged: false });
      }
      const claimKey = validatedClaim.digest;
      let operationResult: HostEnvelope<"structured_result">;
      let journalState: Awaited<ReturnType<CoordinationWindowsExecutionJournal["begin"]>>;
      try {
        journalState = await executionJournal.begin(claimKey, validatedClaim);
      } catch {
        return result({ state: "host_unavailable", cleanupAcknowledged: false });
      }
      if (journalState.state === "completed") {
        operationResult = journalState.result;
      } else if (journalState.fresh === false) {
        // A started journal entry is an execution uncertainty boundary. It is
        // never legal to call execute again after a restart.
        const reconcile = dependencies.reconcileExecution
          ?? executionJournal.reconcile
          ?? (dependencies.operationAdapter?.reconcile
            ? async (reconciliationInput) => dependencies.operationAdapter!.reconcile!(reconciliationInput)
            : undefined);
        if (!reconcile) return result({ state: "host_unavailable", cleanupAcknowledged: false });
        try {
          const reconciled = await reconcile({
            claimIdentity: claimKey,
            operationDigest: (validatedClaim.payload as { binding: HostBinding }).binding.operationDigest!,
            claim: validatedClaim,
          });
          if (!reconciled) return result({ state: "host_unavailable", cleanupAcknowledged: false });
          operationResult = validateStructuredResult(reconciled, validatedClaim);
        } catch {
          return result({ state: "host_unavailable", cleanupAcknowledged: false });
        }
        try {
          await executionJournal.complete(claimKey, operationResult);
        } catch {
          return result({ state: "host_unavailable", cleanupAcknowledged: false });
        }
      } else if (journalState.fresh === true) {
        // This process atomically claimed the journal entry before execution.
        // A later process receives fresh=false and must reconcile instead.
        try {
          operationResult = validateStructuredResult(
            await operationHost.execute(validatedClaim),
            validatedClaim,
          );
          await executionJournal.complete(claimKey, operationResult);
        } catch {
          return result({ state: "host_unavailable", cleanupAcknowledged: false });
        }
      } else {
        return result({ state: "host_unavailable", cleanupAcknowledged: false });
      }
      try {
        operationResult = validateStructuredResult(operationResult, validatedClaim);
      } catch {
        return result({ state: "host_unavailable", cleanupAcknowledged: false });
      }
      const submitted = await retry(
        () => dependencies.transport.result({
          state,
          requestKey: `result:${claimKey}`,
          result: operationResult!,
        }),
        attempts,
      );
      try { state = stateUpdate(state, submitted.state); } catch { return result({ state: "host_unavailable", cleanupAcknowledged: false }); }
      if (submitted.terminalState) {
        const terminal = safeTerminal(submitted.terminalState);
        return finalizeTerminal(terminal, state, dependencies, attempts);
      }
    }
    return finalizeTerminal("exhausted", state, dependencies, attempts);
  } catch {
    // Never leak provider/native/transport errors through the operator path.
    return result({ state: "host_unavailable", cleanupAcknowledged: false });
  }
}

async function finalizeTerminal(
  terminal: CoordinationWindowsTerminalState,
  state: CoordinationWindowsLifecycleState,
  dependencies: CoordinationWindowsHostDependencies,
  attempts: number,
): Promise<CoordinationWindowsHostResult> {
  try {
    const cleanup = await retry(
      () => dependencies.transport.cleanup({ state, requestKey: "cleanup:acknowledge" }),
      attempts,
    );
    if (cleanup.acknowledged === true) {
      return result({ state: terminal, cleanupAcknowledged: true });
    }
  } catch {
    // Cleanup failure never changes the server's original terminal outcome.
  }
  return result({
    state: terminal === "succeeded" ? "cleanup_pending" : terminal,
    cleanupAcknowledged: false,
  });
}

export const runCoordinationWindowsLifecycle = runCoordinationWindowsHost;

export class CoordinationWindowsHost {
  constructor(private readonly dependencies: CoordinationWindowsHostDependencies) {}

  run(input: CoordinationWindowsOperatorInput): Promise<CoordinationWindowsHostResult> {
    return runCoordinationWindowsHost(input, this.dependencies);
  }
}

export function createCoordinationWindowsHost(
  dependencies: CoordinationWindowsHostDependencies,
): CoordinationWindowsHost {
  return new CoordinationWindowsHost(dependencies);
}