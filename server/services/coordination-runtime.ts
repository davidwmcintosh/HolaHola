import { createHash, randomUUID } from 'node:crypto';

export type RuntimeActor =
  | 'luca-gemini'
  | 'luca-replit'
  | 'luca-claude-code'
  | 'alden'
  | 'daniela';

export type NormalizedOutcome =
  | 'consumed'
  | 'safety_blocked'
  | 'refused'
  | 'context_limit'
  | 'interrupted'
  | 'empty_response'
  | 'malformed_function_call'
  | 'unsupported_provider_outcome'
  | 'retryable_provider_error'
  | 'terminal_provider_error';

export type RuntimePrincipal = {
  actor: RuntimeActor;
  runtimeRegistrationId: string;
  credentialId: string;
  profileId: string;
  capabilities: readonly string[];
  credentialExpiresAt: number;
  runtimeEnabled: boolean;
  revoked: boolean;
};

export class RuntimeProtocolError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'RuntimeProtocolError';
  }
}

function fail(code: string, message: string): never {
  throw new RuntimeProtocolError(code, message);
}

function hasUnpairedSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!Number.isFinite(next) || next < 0xdc00 || next > 0xdfff) return true;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function canonicalize(value: unknown, active: Set<object>): string {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') {
    if (hasUnpairedSurrogate(value)) fail('invalid_json', 'Unpaired Unicode surrogate');
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('invalid_json', 'Non-finite number');
    return JSON.stringify(value);
  }
  if (typeof value !== 'object') fail('invalid_json', 'Unsupported JSON value');
  if (active.has(value)) fail('invalid_json', 'Cyclic JSON value');

  active.add(value);
  let result: string;
  if (Array.isArray(value)) {
    result = `[${value.map((item) => canonicalize(item, active)).join(',')}]`;
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      fail('invalid_json', 'Only plain objects are supported');
    }
    const object = value as Record<string, unknown>;
    result = `{${Object.keys(object)
      .sort()
      .map((key) => `${canonicalize(key, active)}:${canonicalize(object[key], active)}`)
      .join(',')}}`;
  }
  active.delete(value);
  return result;
}

export function canonicalJson(value: unknown): string {
  return canonicalize(value, new Set());
}

export function digestCanonical(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

function deepClone<T>(value: T): T {
  return JSON.parse(canonicalJson(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as object)) deepFreeze(child);
  }
  return value;
}

function immutable<T>(value: T): T {
  return deepFreeze(deepClone(value));
}

export type InboxItem = {
  id: string;
  eventId: string;
  threadId: string;
  taskId: string;
  sequence: number;
  payload: { content: Record<string, unknown> };
};

export type Assignment = {
  assignmentEventId: string;
  assignmentAuthor: RuntimeActor;
  taskId: string;
  threadId: string;
  expectedSequence: number;
};

export type ExecutionEnvelope = {
  worktreeLabel: string;
  worktreePath: string;
  argv: readonly string[];
  patchDigest: string | null;
};

export type InboxWindow = {
  id: string;
  threadId: string;
  afterExclusive: number;
  throughInclusive: number;
  boundaryToken: string;
  orderedItemIds: string[];
  boundaryDigest: string;
};

export type InheritancePacket = {
  id: string;
  version: number;
  actor: 'luca-gemini';
  runtimeRegistrationId: string;
  profileId: string;
  createdAt: number;
  supersedesClaimId: string | null;
  windowId: string;
  windowDigest: string;
  orderedInboxItemIds: string[];
  orderedEventIds: string[];
  orderedThreadIds: string[];
  assignment: Assignment;
  inherited: InboxItem['payload'][];
  envelope: ExecutionEnvelope;
  digest: string;
};

export type ModelInteraction = {
  id: string;
  packetId: string;
  principal: Pick<RuntimePrincipal, 'actor' | 'runtimeRegistrationId' | 'credentialId' | 'profileId'>;
  turn: number;
  attempt: number;
  requestDigest: string;
  responseDigest?: string;
  outcome: NormalizedOutcome;
  retryLineage: string | null;
  createdAt: number;
};

export type OutcomeReceipt = {
  id: string;
  packetId: string;
  packetDigest: string;
  interactionId: string;
  runtimeRegistrationId: string;
  profileId: string;
  outcome: NormalizedOutcome;
  createdAt: number;
};

export type ExecutionClaim = {
  id: string;
  threadId: string;
  packetId: string;
  runtimeRegistrationId: string;
  profileId: string;
  credentialId: string;
  priorClaimId: string | null;
  epoch: number;
  expiresAt: number;
  status: 'active' | 'expired' | 'completed' | 'violated';
  terminalAt: number | null;
};

export type ClaimEvent = {
  id: string;
  claimId: string;
  epoch: number;
  kind: 'acquired' | 'renewed' | 'expired' | 'violated';
  reason: string | null;
  priorClaimId: string | null;
  occurredAt: number;
};

export type ExecutionRecord = {
  id: string;
  claimId: string;
  claimEpoch: number;
  runtimeRegistrationId: string;
  profileId: string;
  credentialId: string;
  envelope: ExecutionEnvelope;
  executionDigest: string;
};

export type CompletionRecord = {
  id: string;
  executionId: string;
  claimId: string;
  claimEpoch: number;
  evidenceDigest: string;
};

export type VerificationDecision = {
  id: string;
  completionId: string;
  verifierActor: 'luca-replit' | 'luca-claude-code';
  verifierRuntimeRegistrationId: string;
  evidenceDigest: string;
  patchDigest: string | null;
  decision: 'approved';
};

type IdempotencyRecord = { payloadDigest: string; resultKind: string; resultId: string };
type RepositoryState = {
  inbox: Map<string, InboxItem>;
  threadSequences: Map<string, number>;
  windows: Map<string, InboxWindow>;
  packets: Map<string, InheritancePacket>;
  interactions: Map<string, ModelInteraction>;
  receipts: Map<string, OutcomeReceipt>;
  claims: Map<string, ExecutionClaim>;
  claimEvents: ClaimEvent[];
  executions: Map<string, ExecutionRecord>;
  completions: Map<string, CompletionRecord>;
  verifications: Map<string, VerificationDecision>;
  idempotency: Map<string, IdempotencyRecord>;
};

function emptyState(): RepositoryState {
  return {
    inbox: new Map(),
    threadSequences: new Map(),
    windows: new Map(),
    packets: new Map(),
    interactions: new Map(),
    receipts: new Map(),
    claims: new Map(),
    claimEvents: [],
    executions: new Map(),
    completions: new Map(),
    verifications: new Map(),
    idempotency: new Map(),
  };
}

function cloneMap<T>(source: Map<string, T>): Map<string, T> {
  return new Map([...source].map(([key, value]) => [key, immutable(value)]));
}

function cloneState(source: RepositoryState): RepositoryState {
  return {
    inbox: cloneMap(source.inbox),
    threadSequences: new Map(source.threadSequences),
    windows: cloneMap(source.windows),
    packets: cloneMap(source.packets),
    interactions: cloneMap(source.interactions),
    receipts: cloneMap(source.receipts),
    claims: cloneMap(source.claims),
    claimEvents: source.claimEvents.map(immutable),
    executions: cloneMap(source.executions),
    completions: cloneMap(source.completions),
    verifications: cloneMap(source.verifications),
    idempotency: cloneMap(source.idempotency),
  };
}

export class InMemoryCoordinationRepository {
  private state = emptyState();
  private inTransaction = false;

  transaction<T>(operation: () => T): T {
    if (this.inTransaction) fail('transaction_reentrant', 'Nested transaction');
    const prior = this.state;
    this.state = cloneState(prior);
    this.inTransaction = true;
    try {
      const result = operation();
      this.inTransaction = false;
      return result;
    } catch (error) {
      this.state = prior;
      this.inTransaction = false;
      throw error;
    }
  }

  addInboxItem(item: InboxItem): InboxItem {
    return this.transaction(() => {
      if (this.state.inbox.has(item.id)) fail('duplicate_inbox_id', 'Inbox ID already exists');
      const prior = this.state.threadSequences.get(item.threadId) ?? 0;
      if (!Number.isInteger(item.sequence) || item.sequence <= prior) {
        fail('inbox_sequence_conflict', 'Thread sequence must increase');
      }
      const stored = immutable(item);
      this.state.inbox.set(item.id, stored);
      this.state.threadSequences.set(item.threadId, item.sequence);
      return immutable(stored);
    });
  }

  freezeInboxWindow(
    threadId: string,
    afterExclusive: number,
    throughInclusive: number,
    boundaryToken: string,
  ): InboxWindow {
    return this.transaction(() => {
      if (!boundaryToken || throughInclusive <= afterExclusive) {
        fail('inbox_window_invalid', 'Window boundary is invalid');
      }
      if (this.state.threadSequences.get(threadId) !== throughInclusive) {
        fail('inbox_window_unstable', 'Through boundary is not current');
      }
      const items = this.inboxItemsForWindow(threadId, afterExclusive, throughInclusive);
      if (items.length === 0) fail('inbox_window_incomplete', 'Window is empty');
      const base = {
        threadId,
        afterExclusive,
        throughInclusive,
        boundaryToken,
        orderedItemIds: items.map((item) => item.id),
        itemDigests: items.map((item) => digestCanonical(item)),
      };
      const window: InboxWindow = {
        id: `window-${digestCanonical(base)}`,
        threadId,
        afterExclusive,
        throughInclusive,
        boundaryToken,
        orderedItemIds: base.orderedItemIds,
        boundaryDigest: digestCanonical(base),
      };
      this.state.windows.set(window.id, immutable(window));
      return immutable(window);
    });
  }

  private inboxItemsForWindow(threadId: string, afterExclusive: number, throughInclusive: number): InboxItem[] {
    return [...this.state.inbox.values()]
      .filter(
        (item) =>
          item.threadId === threadId &&
          item.sequence > afterExclusive &&
          item.sequence <= throughInclusive,
      )
      .sort((left, right) => left.sequence - right.sequence)
      .map(immutable);
  }

  validateWindow(windowId: string): { window: InboxWindow; items: InboxItem[] } {
    const window = this.state.windows.get(windowId);
    if (!window) fail('inbox_window_incomplete', 'Frozen window is required');
    const items = this.inboxItemsForWindow(
      window.threadId,
      window.afterExclusive,
      window.throughInclusive,
    );
    const base = {
      threadId: window.threadId,
      afterExclusive: window.afterExclusive,
      throughInclusive: window.throughInclusive,
      boundaryToken: window.boundaryToken,
      orderedItemIds: items.map((item) => item.id),
      itemDigests: items.map((item) => digestCanonical(item)),
    };
    if (
      this.state.threadSequences.get(window.threadId) !== window.throughInclusive ||
      canonicalJson(window.orderedItemIds) !== canonicalJson(base.orderedItemIds) ||
      window.boundaryDigest !== digestCanonical(base)
    ) {
      fail('inbox_window_unstable', 'Frozen window no longer matches source records');
    }
    return { window: immutable(window), items };
  }

  getThreadSequence(threadId: string): number | undefined {
    return this.state.threadSequences.get(threadId);
  }

  getPacket(id: string): InheritancePacket | undefined {
    const value = this.state.packets.get(id);
    return value && immutable(value);
  }

  getInteraction(id: string): ModelInteraction | undefined {
    const value = this.state.interactions.get(id);
    return value && immutable(value);
  }

  getReceipt(id: string): OutcomeReceipt | undefined {
    const value = this.state.receipts.get(id);
    return value && immutable(value);
  }

  getClaim(id: string): ExecutionClaim | undefined {
    const value = this.state.claims.get(id);
    return value && immutable(value);
  }

  getExecution(id: string): ExecutionRecord | undefined {
    const value = this.state.executions.get(id);
    return value && immutable(value);
  }

  getCompletion(id: string): CompletionRecord | undefined {
    const value = this.state.completions.get(id);
    return value && immutable(value);
  }

  getVerification(id: string): VerificationDecision | undefined {
    const value = this.state.verifications.get(id);
    return value && immutable(value);
  }

  getResult(kind: string, id: string): unknown {
    const collections: Record<string, Map<string, unknown>> = {
      packet: this.state.packets,
      interaction: this.state.interactions,
      receipt: this.state.receipts,
      claim: this.state.claims,
      renewal: this.state.claims,
      execution: this.state.executions,
      completion: this.state.completions,
      verification: this.state.verifications,
    };
    const value = collections[kind]?.get(id);
    return value && immutable(value);
  }

  idempotency(scope: string, key: string): IdempotencyRecord | undefined {
    const value = this.state.idempotency.get(digestCanonical([scope, key]));
    return value && immutable(value);
  }

  saveIdempotency(scope: string, key: string, record: IdempotencyRecord): void {
    this.state.idempotency.set(digestCanonical([scope, key]), immutable(record));
  }

  savePacket(value: InheritancePacket): void { this.state.packets.set(value.id, immutable(value)); }
  saveInteraction(value: ModelInteraction): void { this.state.interactions.set(value.id, immutable(value)); }
  saveReceipt(value: OutcomeReceipt): void { this.state.receipts.set(value.id, immutable(value)); }
  saveExecution(value: ExecutionRecord): void { this.state.executions.set(value.id, immutable(value)); }
  saveCompletion(value: CompletionRecord): void { this.state.completions.set(value.id, immutable(value)); }
  saveVerification(value: VerificationDecision): void { this.state.verifications.set(value.id, immutable(value)); }

  saveClaim(value: ExecutionClaim): void {
    if (
      value.status === 'active' &&
      [...this.state.claims.values()].some(
        (claim) =>
          claim.id !== value.id &&
          claim.threadId === value.threadId &&
          claim.status === 'active',
      )
    ) {
      fail('claim_active_conflict', 'Thread already has an active claim');
    }
    this.state.claims.set(value.id, immutable(value));
  }

  addClaimEvent(value: ClaimEvent): void {
    this.state.claimEvents.push(immutable(value));
  }

  activeClaimForThread(threadId: string): ExecutionClaim | undefined {
    const value = [...this.state.claims.values()].find(
      (claim) => claim.threadId === threadId && claim.status === 'active',
    );
    return value && immutable(value);
  }

  interactionForSlot(packetId: string, turn: number, attempt: number): ModelInteraction | undefined {
    const value = [...this.state.interactions.values()].find(
      (interaction) =>
        interaction.packetId === packetId &&
        interaction.turn === turn &&
        interaction.attempt === attempt,
    );
    return value && immutable(value);
  }

  interactionsForPacket(packetId: string): ModelInteraction[] {
    return [...this.state.interactions.values()]
      .filter((interaction) => interaction.packetId === packetId)
      .map(immutable);
  }

  interactionsForAssignment(packet: InheritancePacket): ModelInteraction[] {
    return [...this.state.interactions.values()]
      .filter((interaction) => {
        const source = this.state.packets.get(interaction.packetId);
        return source?.assignment.taskId === packet.assignment.taskId &&
          source.assignment.assignmentEventId === packet.assignment.assignmentEventId;
      })
      .map(immutable);
  }

  interactionForAssignmentSlot(
    packet: InheritancePacket,
    turn: number,
    attempt: number,
  ): ModelInteraction | undefined {
    return this.interactionsForAssignment(packet).find(
      (interaction) => interaction.turn === turn && interaction.attempt === attempt,
    );
  }

  maxClaimEpoch(threadId: string): number {
    return Math.max(
      0,
      ...[...this.state.claims.values()]
        .filter((claim) => claim.threadId === threadId)
        .map((claim) => claim.epoch),
    );
  }

  packetForAssignmentVersion(
    assignmentEventId: string,
    version: number,
  ): InheritancePacket | undefined {
    const value = [...this.state.packets.values()].find(
      (packet) =>
        packet.assignment.assignmentEventId === assignmentEventId &&
        packet.version === version,
    );
    return value && immutable(value);
  }

  claimsForPacket(packetId: string): ExecutionClaim[] {
    return [...this.state.claims.values()]
      .filter((claim) => claim.packetId === packetId)
      .map(immutable);
  }

  latestClaimForThread(threadId: string): ExecutionClaim | undefined {
    const value = [...this.state.claims.values()]
      .filter((claim) => claim.threadId === threadId)
      .sort((left, right) => right.epoch - left.epoch)[0];
    return value && immutable(value);
  }

  snapshots() {
    return immutable({
      packets: [...this.state.packets.values()],
      interactions: [...this.state.interactions.values()],
      receipts: [...this.state.receipts.values()],
      claims: [...this.state.claims.values()],
      claimEvents: this.state.claimEvents,
      executions: [...this.state.executions.values()],
      completions: [...this.state.completions.values()],
      verifications: [...this.state.verifications.values()],
    });
  }
}

type MutationResult<T> = { value: T } | { error: RuntimeProtocolError };

export class CoordinationRuntimeService {
  constructor(
    private readonly repository: InMemoryCoordinationRepository,
    private readonly now: () => number = () => Date.now(),
    private readonly newId: () => string = () => randomUUID(),
    configuredEnvelope: ExecutionEnvelope = {
      worktreeLabel: 'gate-1',
      worktreePath: '/work',
      argv: ['true'],
      patchDigest: null,
    },
    private readonly maxClaimTtlMs = 86_400_000,
  ) {
    this.envelope = immutable(configuredEnvelope);
  }

  private readonly envelope: ExecutionEnvelope;

  private authorize(
    principal: RuntimePrincipal,
    actor: RuntimeActor,
    capability: string,
  ): void {
    if (principal.actor !== actor) fail('actor_mismatch', 'Principal actor does not match');
    if (!principal.capabilities.includes(capability)) {
      fail('capability_required', `Capability ${capability} is required`);
    }
    if (!principal.runtimeEnabled) fail('runtime_disabled', 'Runtime is disabled');
    if (principal.revoked) fail('runtime_revoked', 'Runtime is revoked');
    if (
      !Number.isFinite(principal.credentialExpiresAt) ||
      principal.credentialExpiresAt <= this.now()
    ) {
      fail('credential_expired', 'Runtime credential has expired');
    }
  }

  private mutate<T extends { id: string }>(
    scope: string,
    idempotencyKey: string,
    payload: unknown,
    operation: () => T,
  ): T {
    return this.repository.transaction(() => {
      const payloadDigest = digestCanonical(payload);
      const prior = this.repository.idempotency(scope, idempotencyKey);
      if (prior) {
        if (prior.payloadDigest !== payloadDigest) {
          fail('idempotency_payload_mismatch', 'Changed payload reused idempotency key');
        }
        const result = this.repository.getResult(prior.resultKind, prior.resultId);
        if (!result) fail('repository_corrupt', 'Idempotency result is missing');
        return result as T;
      }
      const result = operation();
      this.repository.saveIdempotency(scope, idempotencyKey, {
        payloadDigest,
        resultKind: scope,
        resultId: result.id,
      });
      return immutable(result);
    });
  }

  createPacket(
    principal: RuntimePrincipal,
    windowId: string,
    assignment: Assignment,
    idempotencyKey: string,
    version = 1,
    supersedesClaimId: string | null = null,
  ): InheritancePacket {
    this.authorize(principal, 'luca-gemini', 'execute');
    if (!Number.isInteger(version) || version < 1) {
      fail('packet_version_invalid', 'Packet version must be a positive integer');
    }
    return this.mutate('packet', idempotencyKey, {
      runtimeRegistrationId: principal.runtimeRegistrationId,
      profileId: principal.profileId,
      windowId,
      assignment,
      version,
      supersedesClaimId,
    }, () => {
      const { window, items } = this.repository.validateWindow(windowId);
      if (
        this.repository.packetForAssignmentVersion(
          assignment.assignmentEventId,
          version,
        )
      ) {
        fail('packet_version_conflict', 'Assignment packet version already exists');
      }
      const latestClaim = this.repository.latestClaimForThread(assignment.threadId);
      if (version === 1 && (supersedesClaimId !== null || latestClaim)) {
        fail('takeover_reference_invalid', 'Initial packet cannot replace prior work');
      }
      if (version > 1) {
        if (!latestClaim || latestClaim.id !== supersedesClaimId) {
          fail('takeover_reference_invalid', 'Replacement packet must name latest claim');
        }
        if (latestClaim.status === 'completed') {
          fail('claim_not_active', 'Completed work cannot be replaced');
        }
        if (latestClaim.status === 'active' && latestClaim.expiresAt > this.now()) {
          fail('takeover_not_ready', 'Prior claim is still active');
        }
        if (
          latestClaim.status === 'active' ||
          latestClaim.terminalAt === null
        ) {
          const expired = {
            ...latestClaim,
            status: 'expired' as const,
            terminalAt: this.now(),
          };
          this.repository.saveClaim(expired);
          this.repository.addClaimEvent({
            id: this.newId(),
            claimId: expired.id,
            epoch: expired.epoch,
            kind: 'expired',
            reason: null,
            priorClaimId: expired.priorClaimId,
            occurredAt: this.now(),
          });
        }
      }
      const assignmentItem = items.find(
        (item) => item.eventId === assignment.assignmentEventId,
      );
      if (
        !assignmentItem ||
        assignmentItem.taskId !== assignment.taskId ||
        assignmentItem.threadId !== assignment.threadId ||
        assignmentItem.sequence !== assignment.expectedSequence ||
        window.threadId !== assignment.threadId ||
        this.repository.getThreadSequence(assignment.threadId) !== assignment.expectedSequence
      ) {
        fail('packet_assignment_mismatch', 'Assignment does not match frozen inbox');
      }
      const base = {
        id: this.newId(),
        version,
        actor: 'luca-gemini' as const,
        runtimeRegistrationId: principal.runtimeRegistrationId,
        profileId: principal.profileId,
        createdAt: this.now(),
        supersedesClaimId,
        windowId,
        windowDigest: window.boundaryDigest,
        orderedInboxItemIds: items.map((item) => item.id),
        orderedEventIds: items.map((item) => item.eventId),
        orderedThreadIds: items.map((item) => item.threadId),
        assignment,
        inherited: items.map((item) => item.payload),
        envelope: this.envelope,
      };
      const packet = {
        ...base,
        digest: digestCanonical(base),
      };
      this.repository.savePacket(packet);
      return packet;
    });
  }

  recordInteraction(
    principal: RuntimePrincipal,
    input: {
      packetId: string;
      turn: number;
      attempt: number;
      requestDigest: string;
      responseDigest?: string;
      outcome: NormalizedOutcome;
      retryLineage?: string | null;
      idempotencyKey: string;
    },
  ): ModelInteraction {
    this.authorize(principal, 'luca-gemini', 'model');
    const packet = this.repository.getPacket(input.packetId);
    if (
      !packet ||
      packet.runtimeRegistrationId !== principal.runtimeRegistrationId ||
      packet.profileId !== principal.profileId
    ) {
      fail('packet_assignment_mismatch', 'Packet is not owned by this runtime');
    }

    const result = this.repository.transaction<MutationResult<ModelInteraction>>(() => {
      const payload = {
        ...input,
        retryLineage: input.retryLineage ?? null,
        runtimeRegistrationId: principal.runtimeRegistrationId,
        profileId: principal.profileId,
        credentialId: principal.credentialId,
      };
      const payloadDigest = digestCanonical(payload);
      const priorReplay = this.repository.idempotency('interaction', input.idempotencyKey);
      if (priorReplay) {
        if (priorReplay.payloadDigest !== payloadDigest) {
          fail('idempotency_payload_mismatch', 'Changed interaction replay');
        }
        return {
          value: this.repository.getResult(
            priorReplay.resultKind,
            priorReplay.resultId,
          ) as ModelInteraction,
        };
      }

      const violate = (reason: string): MutationResult<ModelInteraction> => {
        const claim = this.repository.activeClaimForThread(packet.assignment.threadId);
        if (claim?.packetId === packet.id) {
          this.repository.saveClaim({
            ...claim,
            status: 'violated',
            terminalAt: this.now(),
          });
          this.repository.addClaimEvent({
            id: this.newId(),
            claimId: claim.id,
            epoch: claim.epoch,
            kind: 'violated',
            reason,
            priorClaimId: claim.priorClaimId,
            occurredAt: this.now(),
          });
        }
        return { error: new RuntimeProtocolError('model_call_limit_exceeded', reason) };
      };

      if (
        !Number.isInteger(input.turn) ||
        input.turn < 1 ||
        input.turn > 4 ||
        !Number.isInteger(input.attempt) ||
        input.attempt < 1 ||
        input.attempt > 2
      ) {
        return violate('Model turn or attempt is outside the approved limit');
      }
      if (this.repository.interactionForAssignmentSlot(packet, input.turn, input.attempt)) {
        fail('duplicate_model_attempt', 'Model turn and attempt already exist');
      }
      if (
        input.turn > 1 &&
        !this.repository.interactionForAssignmentSlot(packet, input.turn - 1, 1)
      ) {
        return violate('Logical model turn was skipped');
      }
      if (input.attempt === 2) {
        const first = this.repository.interactionForAssignmentSlot(packet, input.turn, 1);
        if (
          !first ||
          first.outcome !== 'retryable_provider_error' ||
          input.retryLineage !== first.id
        ) {
          return violate('Retry lineage is not authorized');
        }
      }
      if (this.repository.interactionsForAssignment(packet).length >= 8) {
        return violate('Gemini API attempt limit exceeded');
      }
      if (!input.responseDigest) {
        fail('interaction_digest_mismatch', 'Every interaction requires a response digest');
      }

      const interaction: ModelInteraction = {
        id: this.newId(),
        packetId: packet.id,
        principal: {
          actor: principal.actor,
          runtimeRegistrationId: principal.runtimeRegistrationId,
          credentialId: principal.credentialId,
          profileId: principal.profileId,
        },
        turn: input.turn,
        attempt: input.attempt,
        requestDigest: input.requestDigest,
        ...(input.responseDigest ? { responseDigest: input.responseDigest } : {}),
        outcome: input.outcome,
        retryLineage: input.retryLineage ?? null,
        createdAt: this.now(),
      };
      this.repository.saveInteraction(interaction);
      this.repository.saveIdempotency('interaction', input.idempotencyKey, {
        payloadDigest,
        resultKind: 'interaction',
        resultId: interaction.id,
      });
      return { value: immutable(interaction) };
    });

    if ('error' in result) throw result.error;
    return result.value;
  }

  recordOutcomeReceipt(
    principal: RuntimePrincipal,
    packetId: string,
    packetDigest: string,
    interactionId: string,
    idempotencyKey: string,
  ): OutcomeReceipt {
    this.authorize(principal, 'luca-gemini', 'model');
    return this.mutate('receipt', idempotencyKey, {
      packetId,
      packetDigest,
      interactionId,
      runtimeRegistrationId: principal.runtimeRegistrationId,
      profileId: principal.profileId,
    }, () => {
      const packet = this.repository.getPacket(packetId);
      const interaction = this.repository.getInteraction(interactionId);
      if (
        !packet ||
        packet.digest !== packetDigest ||
        packet.runtimeRegistrationId !== principal.runtimeRegistrationId ||
        packet.profileId !== principal.profileId ||
        !interaction ||
        interaction.packetId !== packet.id ||
        interaction.principal.runtimeRegistrationId !== principal.runtimeRegistrationId ||
        interaction.principal.profileId !== principal.profileId
      ) {
        fail('consumption_not_authorized', 'Interaction and packet chain do not match');
      }
      const receipt: OutcomeReceipt = {
        id: this.newId(),
        packetId,
        packetDigest,
        interactionId,
        runtimeRegistrationId: principal.runtimeRegistrationId,
        profileId: principal.profileId,
        outcome: interaction.outcome,
        createdAt: this.now(),
      };
      this.repository.saveReceipt(receipt);
      return receipt;
    });
  }

  private validateTtl(ttlMs: number): void {
    if (
      !Number.isFinite(ttlMs) ||
      !Number.isInteger(ttlMs) ||
      ttlMs <= 0 ||
      ttlMs > this.maxClaimTtlMs
    ) {
      fail('claim_ttl_invalid', 'Claim TTL is invalid');
    }
  }

  claim(
    principal: RuntimePrincipal,
    packetId: string,
    packetDigest: string,
    receiptId: string,
    ttlMs: number,
    idempotencyKey: string,
  ): ExecutionClaim {
    this.authorize(principal, 'luca-gemini', 'execute');
    this.validateTtl(ttlMs);
    return this.mutate('claim', idempotencyKey, {
      packetId,
      packetDigest,
      receiptId,
      ttlMs,
      runtimeRegistrationId: principal.runtimeRegistrationId,
      profileId: principal.profileId,
    }, () => {
      const packet = this.repository.getPacket(packetId);
      const receipt = this.repository.getReceipt(receiptId);
      if (
        !packet ||
        packet.digest !== packetDigest ||
        packet.runtimeRegistrationId !== principal.runtimeRegistrationId ||
        packet.profileId !== principal.profileId ||
        !receipt ||
        receipt.packetId !== packet.id ||
        receipt.packetDigest !== packet.digest ||
        receipt.runtimeRegistrationId !== principal.runtimeRegistrationId ||
        receipt.profileId !== principal.profileId ||
        receipt.outcome !== 'consumed'
      ) {
        fail('consumption_not_authorized', 'Consumed receipt does not authorize claim');
      }
      const priorPacketClaims = this.repository.claimsForPacket(packet.id);
      if (
        priorPacketClaims.some(
          (claim) => claim.status === 'active' && claim.expiresAt > this.now(),
        )
      ) {
        fail('claim_active_conflict', 'Packet already has an active claim');
      }
      if (priorPacketClaims.length > 0) {
        fail('fresh_consumption_required', 'A terminal or expired claim requires a fresh packet');
      }
      if (
        this.repository.getThreadSequence(packet.assignment.threadId) !==
        packet.assignment.expectedSequence
      ) {
        fail('thread_sequence_stale', 'Coordinator sequence changed');
      }
      const latestPriorClaim = this.repository.latestClaimForThread(
        packet.assignment.threadId,
      );
      if (latestPriorClaim?.status === 'completed') {
        fail('claim_not_active', 'Completed work cannot be claimed again');
      }
      if (
        latestPriorClaim &&
        (
          packet.supersedesClaimId !== latestPriorClaim.id ||
          latestPriorClaim.terminalAt === null ||
          packet.createdAt < latestPriorClaim.terminalAt ||
          receipt.createdAt < packet.createdAt
        )
      ) {
        fail('fresh_consumption_required', 'Replacement evidence predates terminal claim');
      }
      const active = this.repository.activeClaimForThread(packet.assignment.threadId);
      if (active) {
        if (active.expiresAt > this.now()) {
          fail('claim_active_conflict', 'Thread has an active claim');
        }
        this.repository.saveClaim({
          ...active,
          status: 'expired',
          terminalAt: this.now(),
        });
        this.repository.addClaimEvent({
          id: this.newId(),
          claimId: active.id,
          epoch: active.epoch,
          kind: 'expired',
          reason: null,
          priorClaimId: active.priorClaimId,
          occurredAt: this.now(),
        });
      }
      const claim: ExecutionClaim = {
        id: this.newId(),
        threadId: packet.assignment.threadId,
        packetId,
        runtimeRegistrationId: principal.runtimeRegistrationId,
        profileId: principal.profileId,
        credentialId: principal.credentialId,
        priorClaimId: latestPriorClaim?.id ?? null,
        epoch: this.repository.maxClaimEpoch(packet.assignment.threadId) + 1,
        expiresAt: this.now() + ttlMs,
        status: 'active',
        terminalAt: null,
      };
      this.repository.saveClaim(claim);
      this.repository.addClaimEvent({
        id: this.newId(),
        claimId: claim.id,
        epoch: claim.epoch,
        kind: 'acquired',
        reason: null,
        priorClaimId: latestPriorClaim?.id ?? null,
        occurredAt: this.now(),
      });
      return claim;
    });
  }

  renew(
    principal: RuntimePrincipal,
    claimId: string,
    epoch: number,
    ttlMs: number,
    idempotencyKey: string,
  ): ExecutionClaim {
    this.authorize(principal, 'luca-gemini', 'execute');
    this.validateTtl(ttlMs);
    return this.mutate('renewal', idempotencyKey, {
      claimId,
      epoch,
      ttlMs,
      runtimeRegistrationId: principal.runtimeRegistrationId,
      profileId: principal.profileId,
    }, () => {
      const claim = this.repository.getClaim(claimId);
      if (!claim) fail('claim_not_active', 'Claim does not exist');
      if (
        claim.runtimeRegistrationId !== principal.runtimeRegistrationId ||
        claim.profileId !== principal.profileId
      ) fail('claim_not_owned', 'Claim belongs to another runtime');
      if (claim.epoch !== epoch) fail('claim_epoch_stale', 'Claim epoch is stale');
      if (claim.status !== 'active' || claim.expiresAt <= this.now()) {
        fail('claim_expired', 'Claim is not active');
      }
      const renewed = {
        ...claim,
        credentialId: principal.credentialId,
        epoch: claim.epoch + 1,
        expiresAt: this.now() + ttlMs,
      };
      this.repository.saveClaim(renewed);
      this.repository.addClaimEvent({
        id: this.newId(),
        claimId,
        epoch: renewed.epoch,
        kind: 'renewed',
        reason: null,
        priorClaimId: claim.priorClaimId,
        occurredAt: this.now(),
      });
      return renewed;
    });
  }

  execute(
    principal: RuntimePrincipal,
    claimId: string,
    command: ExecutionEnvelope,
    idempotencyKey: string,
  ): ExecutionRecord {
    this.authorize(principal, 'luca-gemini', 'execute');
    const payload = {
      claimId,
      command,
      runtimeRegistrationId: principal.runtimeRegistrationId,
      profileId: principal.profileId,
    };
    const result = this.repository.transaction<MutationResult<ExecutionRecord>>(() => {
      const payloadDigest = digestCanonical(payload);
      const prior = this.repository.idempotency('execution', idempotencyKey);
      if (prior) {
        if (prior.payloadDigest !== payloadDigest) {
          fail('idempotency_payload_mismatch', 'Changed execution replay');
        }
        return {
          value: this.repository.getResult(
            prior.resultKind,
            prior.resultId,
          ) as ExecutionRecord,
        };
      }
      const claim = this.repository.getClaim(claimId);
      const packet = claim && this.repository.getPacket(claim.packetId);
      if (!claim || !packet) fail('claim_not_active', 'Claim does not exist');
      if (
        claim.runtimeRegistrationId !== principal.runtimeRegistrationId ||
        claim.profileId !== principal.profileId
      ) fail('claim_not_owned', 'Claim belongs to another runtime');
      if (claim.expiresAt <= this.now()) fail('claim_expired', 'Claim has expired');
      if (claim.status !== 'active') fail('claim_not_active', 'Claim is not active');
      if (canonicalJson(command) !== canonicalJson(packet.envelope)) {
        this.repository.saveClaim({
          ...claim,
          status: 'violated',
          terminalAt: this.now(),
        });
        this.repository.addClaimEvent({
          id: this.newId(),
          claimId,
          epoch: claim.epoch,
          kind: 'violated',
          reason: 'execution_envelope_mismatch',
          priorClaimId: claim.priorClaimId,
          occurredAt: this.now(),
        });
        return {
          error: new RuntimeProtocolError(
            'execution_envelope_mismatch',
            'Command exceeds configured envelope',
          ),
        };
      }
      const execution: ExecutionRecord = {
        id: this.newId(),
        claimId,
        claimEpoch: claim.epoch,
        runtimeRegistrationId: principal.runtimeRegistrationId,
        profileId: principal.profileId,
        credentialId: principal.credentialId,
        envelope: command,
        executionDigest: digestCanonical({
          claimId,
          claimEpoch: claim.epoch,
          command,
        }),
      };
      this.repository.saveExecution(execution);
      this.repository.saveIdempotency('execution', idempotencyKey, {
        payloadDigest,
        resultKind: 'execution',
        resultId: execution.id,
      });
      return { value: immutable(execution) };
    });
    if ('error' in result) throw result.error;
    return result.value;
  }

  complete(
    principal: RuntimePrincipal,
    executionId: string,
    evidenceDigest: string,
    idempotencyKey: string,
  ): CompletionRecord {
    this.authorize(principal, 'luca-gemini', 'execute');
    return this.mutate('completion', idempotencyKey, {
      executionId,
      evidenceDigest,
      runtimeRegistrationId: principal.runtimeRegistrationId,
      profileId: principal.profileId,
    }, () => {
      const execution = this.repository.getExecution(executionId);
      const claim = execution && this.repository.getClaim(execution.claimId);
      if (!execution || !claim) fail('completion_mismatch', 'Execution does not exist');
      if (execution.claimEpoch !== claim.epoch) {
        fail('claim_epoch_stale', 'Execution belongs to a stale claim epoch');
      }
      if (
        execution.runtimeRegistrationId !== principal.runtimeRegistrationId ||
        execution.profileId !== principal.profileId
      ) fail('claim_not_owned', 'Execution belongs to another runtime');
      if (claim.expiresAt <= this.now()) fail('claim_expired', 'Claim has expired');
      if (claim.status !== 'active') fail('claim_not_active', 'Claim is not active');
      if (evidenceDigest !== digestCanonical(execution)) {
        fail('evidence_mismatch', 'Completion evidence digest is invalid');
      }
      const completion: CompletionRecord = {
        id: this.newId(),
        executionId,
        claimId: claim.id,
        claimEpoch: claim.epoch,
        evidenceDigest,
      };
      this.repository.saveClaim({
        ...claim,
        status: 'completed',
        terminalAt: this.now(),
      });
      this.repository.saveCompletion(completion);
      return completion;
    });
  }

  verify(
    principal: RuntimePrincipal,
    completionId: string,
    evidenceDigest: string,
    patchDigest: string | null,
    idempotencyKey: string,
  ): VerificationDecision {
    if (principal.actor !== 'luca-replit' && principal.actor !== 'luca-claude-code') {
      fail('verifier_not_allowed', 'Verifier actor is not approved');
    }
    this.authorize(principal, principal.actor, 'verify');
    const verifierActor = principal.actor;
    return this.mutate('verification', idempotencyKey, {
      completionId,
      evidenceDigest,
      patchDigest,
      verifierActor,
      verifierRuntimeRegistrationId: principal.runtimeRegistrationId,
    }, () => {
      const completion = this.repository.getCompletion(completionId);
      const claim = completion && this.repository.getClaim(completion.claimId);
      const packet = claim && this.repository.getPacket(claim.packetId);
      if (!completion || !claim || !packet) {
        fail('verification_chain_missing', 'Completion evidence chain is missing');
      }
      if (packet.assignment.assignmentAuthor === verifierActor) {
        fail('assigner_verification_denied', 'Assignment author cannot verify');
      }
      if (claim.runtimeRegistrationId === principal.runtimeRegistrationId) {
        fail('self_verification_denied', 'Executing runtime cannot verify');
      }
      if (
        completion.evidenceDigest !== evidenceDigest ||
        packet.envelope.patchDigest !== patchDigest
      ) {
        fail('verification_digest_mismatch', 'Verification evidence does not match');
      }
      const decision: VerificationDecision = {
        id: this.newId(),
        completionId,
        verifierActor,
        verifierRuntimeRegistrationId: principal.runtimeRegistrationId,
        evidenceDigest,
        patchDigest,
        decision: 'approved',
      };
      this.repository.saveVerification(decision);
      return decision;
    });
  }
}