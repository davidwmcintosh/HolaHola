import { createHash, randomUUID } from 'node:crypto';

export type Actor = 'luca-gemini' | 'luca-replit' | 'luca-claude-code' | 'alden' | 'daniela';
export type Outcome = 'consumed' | 'safety_blocked' | 'refused' | 'context_limit' | 'interrupted' | 'empty_response' | 'malformed_function_call' | 'unsupported_provider_outcome' | 'retryable_provider_error' | 'terminal_provider_error';
export type Principal = {
  actor: Actor; runtimeRegistrationId: string; credentialId: string; profileId: string;
  capabilities: readonly string[]; credentialExpiresAt: number; runtimeEnabled: boolean; revoked: boolean;
};
export class RuntimeProtocolError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = 'RuntimeProtocolError'; }
}
function fail(code: string, message: string): never { throw new RuntimeProtocolError(code, message); }

function canonical(value: unknown, seen = new Set<unknown>()): string {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') {
    if (/[\uD800-\uDFFF]/u.test(value)) fail('invalid_json', 'Lone surrogate is not supported');
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('invalid_json', 'Non-finite number is not supported');
    return JSON.stringify(value);
  }
  if (typeof value !== 'object' || value === undefined || typeof value === 'function' || typeof value === 'bigint') {
    fail('invalid_json', 'Unsupported JSON value');
  }
  if (seen.has(value)) fail('invalid_json', 'Cyclic value is not supported');
  seen.add(value);
  let result: string;
  if (Array.isArray(value)) result = `[${value.map((item) => canonical(item, seen)).join(',')}]`;
  else {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) fail('invalid_json', 'Only plain objects are supported');
    const object = value as Record<string, unknown>;
    result = `{${Object.keys(object).sort().map((key) => `${canonical(key)}:${canonical(object[key], seen)}`).join(',')}}`;
  }
  seen.delete(value);
  return result;
}
export function canonicalJson(value: unknown): string { return canonical(value); }
export function digestCanonical(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}
function clone<T>(value: T): T {
  const text = canonicalJson(value);
  return JSON.parse(text) as T;
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as object)) freeze(child);
  }
  return value;
}
function stored<T>(value: T): T { return freeze(clone(value)); }
function tuple(...parts: unknown[]): string { return digestCanonical(parts); }

export type InboxItem = { id: string; eventId: string; threadId: string; taskId: string; sequence: number; payload: { content: Record<string, unknown> } };
export type Assignment = { assignmentEventId: string; assignmentAuthor: Actor; taskId: string; threadId: string; expectedSequence: number };
export type Envelope = { worktreeLabel: string; worktreePath: string; argv: readonly string[]; patchDigest: string | null };
export type InboxWindow = { id: string; threadId: string; after: number; through: number; boundaryDigest: string; boundaryToken: string; orderedItemIds: string[]; complete: boolean };
export type Packet = { id: string; version: 1; actor: 'luca-gemini'; runtimeRegistrationId: string; profileId: string; credentialId: string; orderedInboxItemIds: string[]; orderedEventIds: string[]; threadId: string; assignment: Assignment; after: number; through: number; inherited: InboxItem['payload'][]; envelope: Envelope; digest: string };
export type Interaction = { id: string; packetId: string; principal: Pick<Principal, 'actor' | 'runtimeRegistrationId' | 'credentialId' | 'profileId'>; turn: number; attempt: number; requestDigest: string; responseDigest?: string; normalizedOutcome: Outcome; retryLineage?: string | null; idempotencyKey: string };
export type Receipt = { id: string; packetId: string; packetDigest: string; interactionId: string; outcome: Outcome; assignment: Assignment };
export type Claim = { id: string; threadId: string; packetId: string; actor: 'luca-gemini'; runtimeRegistrationId: string; profileId: string; credentialId: string; epoch: number; expiresAt: number; status: 'active' | 'released' | 'expired' | 'completed' | 'violated' };
export type ClaimEvent = { id: string; claimId: string; kind: string; epoch: number };
export type Execution = { id: string; claimId: string; claimEpoch: number; principal: Pick<Principal, 'actor' | 'runtimeRegistrationId' | 'credentialId' | 'profileId'>; envelope: Envelope; executionDigest: string };
export type Completion = { id: string; executionId: string; claimId: string; evidenceDigest: string };
export type VerificationDecision = { id: string; completionId: string; actor: Actor; decision: 'approved' | 'rejected'; patchDigest: string | null; evidenceDigest: string };

export class InMemoryCoordinationRepository {
  private readonly data = {
    inbox: new Map<string, InboxItem>(), windows: new Map<string, InboxWindow>(), threads: new Map<string, number>(),
    packets: new Map<string, Packet>(), interactions: new Map<string, Interaction>(), receipts: new Map<string, Receipt>(),
    claims: new Map<string, Claim>(), claimEvents: [] as ClaimEvent[], executions: new Map<string, Execution>(),
    completions: new Map<string, Completion>(), verifications: new Map<string, VerificationDecision>(), idem: new Map<string, { digest: string; id: string }>(),
  };
  private atomicDepth = 0;
  transaction<T>(fn: () => T): T { this.atomicDepth++; try { return fn(); } finally { this.atomicDepth--; } }
  putInbox(item: InboxItem): void {
    const old = this.data.threads.get(item.threadId);
    this.data.inbox.set(item.id, stored(item));
    this.data.threads.set(item.threadId, Math.max(old ?? 0, item.sequence));
  }
  putThread(threadId: string, currentSequence: number): void { this.data.threads.set(threadId, currentSequence); }
  putWindow(window: InboxWindow): void { this.data.windows.set(window.id, stored(window)); }
  getInbox(id: string): InboxItem | undefined { const v = this.data.inbox.get(id); return v && stored(v); }
  listInbox(): InboxItem[] { return stored([...this.data.inbox.values()]); }
  getWindow(id: string): InboxWindow | undefined { const v = this.data.windows.get(id); return v && stored(v); }
  getThreadSequence(id: string): number | undefined { return this.data.threads.get(id); }
  getPacket(id: string): Packet | undefined { const v = this.data.packets.get(id); return v && stored(v); }
  getInteraction(id: string): Interaction | undefined { const v = this.data.interactions.get(id); return v && stored(v); }
  getReceipt(id: string): Receipt | undefined { const v = this.data.receipts.get(id); return v && stored(v); }
  getClaim(id: string): Claim | undefined { const v = this.data.claims.get(id); return v && stored(v); }
  getExecution(id: string): Execution | undefined { const v = this.data.executions.get(id); return v && stored(v); }
  getCompletion(id: string): Completion | undefined { const v = this.data.completions.get(id); return v && stored(v); }
  findCompletion(executionId: string): Completion | undefined {
    const value = [...this.data.completions.values()].find((item) => item.executionId === executionId);
    return value && stored(value);
  }
  findExecution(claimId: string): Execution | undefined {
    const value = [...this.data.executions.values()].find((item) => item.claimId === claimId);
    return value && stored(value);
  }
  getVerification(id: string): VerificationDecision | undefined { const v = this.data.verifications.get(id); return v && stored(v); }
  getById(id: string): unknown {
    for (const collection of [this.data.packets, this.data.interactions, this.data.receipts, this.data.claims, this.data.executions, this.data.completions, this.data.verifications]) {
      const value = collection.get(id);
      if (value) return stored(value);
    }
    return undefined;
  }
  snapshots() { return stored({ packets: [...this.data.packets.values()], interactions: [...this.data.interactions.values()], claims: [...this.data.claims.values()], claimEvents: this.data.claimEvents, executions: [...this.data.executions.values()], completions: [...this.data.completions.values()], verifications: [...this.data.verifications.values()] }); }
  snapshotClaims(): Claim[] { return stored([...this.data.claims.values()]); }
  snapshotInteractions(): Interaction[] { return stored([...this.data.interactions.values()]); }
  snapshotPackets(): Packet[] { return stored([...this.data.packets.values()]); }
  // These methods are repository operations, rather than exposed mutable state.
  savePacket(v: Packet): void { this.data.packets.set(v.id, stored(v)); }
  saveInteraction(v: Interaction): void { this.data.interactions.set(v.id, stored(v)); }
  saveReceipt(v: Receipt): void { this.data.receipts.set(v.id, stored(v)); }
  saveClaim(v: Claim): void {
    if (v.status === 'active') {
      const conflict = [...this.data.claims.values()].find((old) => old.threadId === v.threadId && old.status === 'active' && old.id !== v.id);
      if (conflict) fail('claim_active_conflict', 'Active claim exists');
    }
    this.data.claims.set(v.id, stored(v));
  }
  saveExecution(v: Execution): void { this.data.executions.set(v.id, stored(v)); }
  saveCompletion(v: Completion): void { this.data.completions.set(v.id, stored(v)); }
  saveVerification(v: VerificationDecision): void { this.data.verifications.set(v.id, stored(v)); }
  addClaimEvent(v: ClaimEvent): void { this.data.claimEvents.push(stored(v)); }
  findActiveClaim(threadId: string): Claim | undefined {
    const found = [...this.data.claims.values()].find((claim) => claim.threadId === threadId && claim.status === 'active');
    return found && stored(found);
  }
  findInteraction(packetId: string, turn: number, attempt: number): Interaction | undefined {
    const found = [...this.data.interactions.values()].find((v) => v.packetId === packetId && v.turn === turn && v.attempt === attempt);
    return found && stored(found);
  }
  idemGet(scope: string, key: string): { digest: string; id: string } | undefined { return this.data.idem.get(tuple(scope, key)); }
  idemPut(scope: string, key: string, digest: string, id: string): void { this.data.idem.set(tuple(scope, key), { digest, id }); }
}

export class CoordinationRuntimeService {
  constructor(private readonly repo: InMemoryCoordinationRepository, private readonly now = () => Date.now(), private readonly newId = () => randomUUID(), private readonly configuredEnvelope: Envelope = { worktreeLabel: 'gate-1', worktreePath: '/work', argv: ['true'], patchDigest: null }, private readonly maxTtl = 86_400_000) {}
  private auth(p: Principal, actor: Actor, capability: string): void {
    if (p.actor !== actor || !p.capabilities.includes(capability) || !p.runtimeEnabled || p.revoked || !Number.isFinite(p.credentialExpiresAt) || p.credentialExpiresAt <= this.now()) fail('principal_denied', 'Principal is not active');
  }
  private violatePacket(packet: Packet, kind: string): void {
    const claim = this.repo.findActiveClaim(packet.threadId);
    if (claim) {
      this.repo.saveClaim({ ...claim, status: 'violated' });
      this.repo.addClaimEvent({ id: this.newId(), claimId: claim.id, kind, epoch: claim.epoch });
    }
  }
  addInbox(item: InboxItem): void { this.repo.putInbox(item); }
  addWindow(window: InboxWindow): void { this.repo.putWindow(window); }
  addInboxWindow(window: InboxWindow): void { this.addWindow(window); }
  private idempotent<T>(scope: string, key: unknown, payload: unknown, action: () => T): T {
    const k = canonicalJson(key); const d = digestCanonical(payload); const old = this.repo.idemGet(scope, k);
    if (old) {
      if (old.digest !== d) fail('idempotency_payload_mismatch', 'Changed idempotency payload');
      const replay = this.repo.getById(old.id);
      if (replay === undefined) fail('repository_corrupt', 'Idempotency record points to a missing mutation');
      return replay as T;
    }
    const result = this.repo.transaction(action); const id = (result as { id?: string }).id;
    if (id) this.repo.idemPut(scope, k, d, id);
    return result;
  }
  createPacket(p: Principal, windowId: string, assignment: Assignment, after?: number, through?: number): Packet {
    this.auth(p, 'luca-gemini', 'execute');
    const window = this.repo.getWindow(windowId);
    if (!window || !window.complete || !window.boundaryToken) fail('inbox_window_incomplete', 'Complete stable window is required');
    const actualAfter = after ?? window.after; const actualThrough = through ?? window.through;
    const candidates = this.repo.listInbox();
    const authoritative = candidates.filter((item) => item.threadId === window.threadId && item.sequence >= actualAfter && item.sequence <= actualThrough).sort((a, b) => a.sequence - b.sequence);
    const ids = authoritative.map((item) => item.id);
    const boundary = digestCanonical({ window: { id: window.id, threadId: window.threadId, after: window.after, through: window.through, boundaryToken: window.boundaryToken }, items: authoritative.map((item) => ({ id: item.id, digest: digestCanonical(item) })) });
    if (window.threadId !== assignment.threadId || window.after !== actualAfter || window.through !== actualThrough || window.boundaryDigest !== boundary || canonicalJson(ids) !== canonicalJson(window.orderedItemIds) || !authoritative.length) fail('inbox_window_boundary_mismatch', 'Authoritative window changed');
    const item = authoritative[0];
    if (item.taskId !== assignment.taskId || item.eventId !== assignment.assignmentEventId || item.sequence !== assignment.expectedSequence) fail('packet_assignment_mismatch', 'Inbox assignment mismatch');
    const base = { version: 1 as const, actor: 'luca-gemini' as const, runtimeRegistrationId: p.runtimeRegistrationId, profileId: p.profileId, credentialId: p.credentialId, orderedInboxItemIds: ids, orderedEventIds: authoritative.map((v) => v.eventId), threadId: assignment.threadId, assignment, after: actualAfter, through: actualThrough, inherited: authoritative.map((v) => v.payload), envelope: this.configuredEnvelope };
    return this.idempotent('packet', [p.runtimeRegistrationId, windowId], base, () => { const packet = { ...base, id: this.newId(), digest: digestCanonical(base) }; this.repo.savePacket(packet); return stored(packet); });
  }
  recordInteraction(p: Principal, input: Omit<Interaction, 'id' | 'principal'>): Interaction {
    this.auth(p, 'luca-gemini', 'model'); const packet = this.repo.getPacket(input.packetId);
    if (!packet || packet.runtimeRegistrationId !== p.runtimeRegistrationId || packet.profileId !== p.profileId) fail('packet_assignment_mismatch', 'Packet is not owned by principal');
    if (!Number.isInteger(input.turn) || input.turn < 1 || input.turn > 4 || !Number.isInteger(input.attempt) || input.attempt < 1 || input.attempt > 2) { this.violatePacket(packet, 'model_call_limit_exceeded'); fail('model_call_limit_exceeded', 'Invalid model turn or attempt'); }
    if (input.normalizedOutcome === 'consumed' && !input.responseDigest) fail('response_required', 'Consumed interaction needs a response digest');
    const request = { ...input, principal: { actor: p.actor, runtimeRegistrationId: p.runtimeRegistrationId, credentialId: p.credentialId, profileId: p.profileId } };
    return this.idempotent('interaction', [p.runtimeRegistrationId, input.idempotencyKey], request, () => {
      if (this.repo.findInteraction(input.packetId, input.turn, input.attempt)) fail('duplicate_model_attempt', 'Packet turn and attempt already exist');
      const first = this.repo.findInteraction(input.packetId, input.turn, 1);
      const prior = input.attempt === 2 && !first;
      if (prior) { this.violatePacket(packet!, 'retry_order_invalid'); fail('retry_order_invalid', 'Retry requires the first attempt'); }
      if (input.attempt === 2 && input.retryLineage !== first!.id) { this.violatePacket(packet!, 'retry_lineage_invalid'); fail('retry_lineage_invalid', 'Retry lineage must identify attempt one'); }
      const priorTurns = this.repo.snapshotInteractions().filter((v) => v.packetId === input.packetId).map((v) => v.turn);
      if (input.turn > Math.max(1, ...priorTurns) + 1) { this.violatePacket(packet!, 'logical_turn_skipped'); fail('model_call_limit_exceeded', 'Logical turn was skipped'); }
      const count = this.repo.snapshotInteractions().filter((v) => v.packetId === input.packetId).length;
      if (count >= 8) { this.violatePacket(packet!, 'model_call_limit_exceeded'); fail('model_call_limit_exceeded', 'Model call limit'); }
      const value = { ...input, id: this.newId(), principal: request.principal }; this.repo.saveInteraction(value); return stored(value);
    });
  }
  consume(p: Principal, packetId: string, packetDigest: string, interactionId: string): Receipt {
    this.auth(p, 'luca-gemini', 'model'); const packet = this.repo.getPacket(packetId); const interaction = this.repo.getInteraction(interactionId);
    if (!packet || packet.digest !== packetDigest || packet.runtimeRegistrationId !== p.runtimeRegistrationId || packet.profileId !== p.profileId) fail('packet_digest_mismatch', 'Authoritative packet mismatch');
    if (!interaction || interaction.packetId !== packetId || interaction.principal.actor !== p.actor || interaction.principal.runtimeRegistrationId !== p.runtimeRegistrationId || interaction.principal.profileId !== p.profileId || interaction.principal.credentialId !== p.credentialId || interaction.normalizedOutcome !== 'consumed' || !interaction.responseDigest) fail('consumption_not_authorized', 'Interaction cannot be consumed');
    return this.idempotent('consumption', [p.runtimeRegistrationId, interactionId], { packetId, packetDigest, interactionId }, () => { const value = { id: this.newId(), packetId, packetDigest, interactionId, outcome: interaction.normalizedOutcome, assignment: packet.assignment }; this.repo.saveReceipt(value); return stored(value); });
  }
  private ttl(ttl: number): void { if (!Number.isFinite(ttl) || !Number.isInteger(ttl) || ttl <= 0 || ttl > this.maxTtl) fail('claim_expired', 'Invalid TTL'); }
  claim(p: Principal, threadId: string, packetId: string, packetDigest: string, receiptId: string, ttl: number): Claim {
    this.auth(p, 'luca-gemini', 'execute'); this.ttl(ttl); const packet = this.repo.getPacket(packetId); const receipt = this.repo.getReceipt(receiptId);
    if (!packet || packet.digest !== packetDigest || packet.threadId !== threadId || packet.runtimeRegistrationId !== p.runtimeRegistrationId || packet.profileId !== p.profileId || packet.credentialId !== p.credentialId) fail('packet_digest_mismatch', 'Packet mismatch');
    if (!receipt || receipt.packetId !== packetId || receipt.packetDigest !== packetDigest || receipt.outcome !== 'consumed') fail('consumption_not_authorized', 'Consumption required');
    if (this.repo.getThreadSequence(threadId) !== packet.assignment.expectedSequence) fail('claim_epoch_stale', 'Thread sequence stale');
    const old = this.repo.findActiveClaim(threadId); if (old) { if (old.expiresAt > this.now()) fail('claim_active_conflict', 'Active claim exists'); this.repo.saveClaim({ ...old, status: 'expired' }); this.repo.addClaimEvent({ id: this.newId(), claimId: old.id, kind: 'expired', epoch: old.epoch }); }
    return this.idempotent('claim', [threadId, p.runtimeRegistrationId, ttl], { packetId, packetDigest, receiptId, ttl }, () => { const previous = this.repo.snapshotClaims().filter((v) => v.threadId === threadId); const value = { id: this.newId(), threadId, packetId, actor: 'luca-gemini' as const, runtimeRegistrationId: p.runtimeRegistrationId, profileId: p.profileId, credentialId: p.credentialId, epoch: (previous.reduce((n, v) => Math.max(n, v.epoch), 0) + 1), expiresAt: this.now() + ttl, status: 'active' as const }; this.repo.saveClaim(value); this.repo.addClaimEvent({ id: this.newId(), claimId: value.id, kind: 'acquired', epoch: value.epoch }); return stored(value); });
  }
  renew(p: Principal, claimId: string, epoch: number, ttl: number): Claim {
    this.auth(p, 'luca-gemini', 'execute'); this.ttl(ttl); const c = this.repo.getClaim(claimId);
    if (!c || c.runtimeRegistrationId !== p.runtimeRegistrationId || c.profileId !== p.profileId || c.credentialId !== p.credentialId || c.epoch !== epoch) fail('claim_epoch_stale', 'Stale claim epoch');
    if (c.status !== 'active' || c.expiresAt <= this.now()) fail('claim_expired', 'Claim expired');
    return this.idempotent('renewal', [claimId, epoch], { ttl }, () => { const next = { ...c, epoch: c.epoch + 1, expiresAt: this.now() + ttl }; this.repo.saveClaim(next); this.repo.addClaimEvent({ id: this.newId(), claimId, kind: 'renewed', epoch: next.epoch }); return stored(next); });
  }
  execute(p: Principal, claimId: string, envelope: Envelope): Execution {
    this.auth(p, 'luca-gemini', 'execute'); const claim = this.repo.getClaim(claimId); const packet = claim && this.repo.getPacket(claim.packetId);
    if (!claim || !packet || claim.runtimeRegistrationId !== p.runtimeRegistrationId || claim.profileId !== p.profileId || claim.credentialId !== p.credentialId || claim.status !== 'active' || claim.expiresAt <= this.now()) fail('claim_unavailable', 'Claim unavailable');
    const replay = this.repo.findExecution(claimId);
    if (replay && canonicalJson(envelope) === canonicalJson(replay.envelope)) return replay;
    if (canonicalJson(envelope) !== canonicalJson(packet.envelope)) { this.repo.saveClaim({ ...claim, status: 'violated' }); this.repo.addClaimEvent({ id: this.newId(), claimId, kind: 'envelope_mismatch', epoch: claim.epoch }); fail('execution_envelope_mismatch', 'Envelope mismatch'); }
    return this.idempotent('execution', [claimId, claim.epoch], { envelope, principal: { actor: p.actor, runtimeRegistrationId: p.runtimeRegistrationId, credentialId: p.credentialId, profileId: p.profileId } }, () => { const value = { id: this.newId(), claimId, claimEpoch: claim.epoch, principal: { actor: p.actor, runtimeRegistrationId: p.runtimeRegistrationId, credentialId: p.credentialId, profileId: p.profileId }, envelope, executionDigest: digestCanonical({ claimId, claimEpoch: claim.epoch, envelope }) }; this.repo.saveExecution(value); return stored(value); });
  }
  complete(p: Principal, executionId: string, evidenceDigest: string): Completion {
    this.auth(p, 'luca-gemini', 'execute'); const execution = this.repo.getExecution(executionId); const claim = execution && this.repo.getClaim(execution.claimId);
    const replay = this.repo.findCompletion(executionId);
    if (replay) {
      if (replay.evidenceDigest !== evidenceDigest) fail('idempotency_payload_mismatch', 'Changed completion payload');
      return replay;
    }
    if (!execution || !claim || execution.claimEpoch !== claim.epoch || execution.principal.runtimeRegistrationId !== p.runtimeRegistrationId || execution.principal.profileId !== p.profileId || execution.principal.credentialId !== p.credentialId || claim.runtimeRegistrationId !== p.runtimeRegistrationId || claim.profileId !== p.profileId || claim.status !== 'active' || claim.expiresAt <= this.now()) fail('completion_forbidden', 'Execution claim unavailable');
    if (evidenceDigest !== digestCanonical(execution)) { this.repo.saveClaim({ ...claim, status: 'violated' }); fail('evidence_mismatch', 'Evidence digest mismatch'); }
    return this.idempotent('completion', [executionId], { evidenceDigest }, () => { const old = this.repo.snapshotClaims().find((v) => v.id === claim.id); if (old?.status === 'completed') return this.repo.getCompletion(executionId)!; const value = { id: this.newId(), executionId, claimId: claim.id, evidenceDigest }; this.repo.saveClaim({ ...claim, status: 'completed' }); this.repo.saveCompletion(value); return stored(value); });
  }
  verify(p: Principal, completionId: string, patchDigest?: string | null, evidenceDigest?: string): VerificationDecision {
    if (!['luca-replit', 'luca-claude-code'].includes(p.actor)) fail('verifier_not_allowed', 'Verifier actor is not approved');
    this.auth(p, p.actor, 'verify'); const completion = this.repo.getCompletion(completionId); const claim = completion && this.repo.getClaim(completion.claimId); const packet = claim && this.repo.getPacket(claim.packetId);
    if (!completion || !claim || !packet) fail('verification_chain_missing', 'Completion chain is missing');
    if (packet.assignment.assignmentAuthor === p.actor || claim.runtimeRegistrationId === p.runtimeRegistrationId) fail('self_verification_denied', 'Verifier is not independent');
    const evidence = evidenceDigest ?? completion.evidenceDigest; if (evidence !== completion.evidenceDigest || (patchDigest ?? packet.envelope.patchDigest) !== packet.envelope.patchDigest) fail('verification_digest_mismatch', 'Verification digest mismatch');
    return this.idempotent('verification', [completionId, p.actor], { patchDigest: patchDigest ?? packet.envelope.patchDigest, evidenceDigest: evidence }, () => { const value = { id: this.newId(), completionId, actor: p.actor, decision: 'approved' as const, patchDigest: packet.envelope.patchDigest, evidenceDigest: evidence }; this.repo.saveVerification(value); return stored(value); });
  }
}