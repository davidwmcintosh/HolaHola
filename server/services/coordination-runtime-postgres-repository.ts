import { and, desc, eq, gt, inArray, lte, sql } from 'drizzle-orm';
import { AsyncLocalStorage } from 'node:async_hooks';
import {
  coordinationRuntimeClaims,
  coordinationRuntimeClaimEvents,
  coordinationRuntimeCompletions,
  coordinationRuntimeExecutions,
  coordinationRuntimeIdempotency,
  coordinationRuntimeInboxWindowItems,
  coordinationRuntimeInboxWindows,
  coordinationRuntimeInteractions,
  coordinationRuntimePackets,
  coordinationRuntimeProfiles,
  coordinationRuntimeReceipts,
  coordinationRuntimeVerifications,
  coordinationRuntimeToolResults,
} from '@shared/schema';
import type {
  ClaimEvent,
  CoordinationRuntimeRepository,
  ExecutionClaim,
  ExecutionRecord,
  CompletionRecord,
  InheritancePacket,
  InboxItem,
  InboxWindow,
  ModelInteraction,
  OutcomeReceipt,
  VerificationDecision,
  IdempotencyRecord,
  CodingRuntimeProfile,
  ToolResultRecord,
} from './coordination-runtime';
import { digestCanonical, RuntimeProtocolError } from './coordination-runtime';

type Executor = any;

const protocolFailure = (code: string, message: string): never => {
  throw new RuntimeProtocolError(code, message);
};

/**
 * PostgreSQL persistence adapter.  A transaction-scoped adapter is created
 * for every call to transaction; callers must not retain it across calls.
 * No in-memory fallback is intentionally provided.
 */
export class PostgresCoordinationRuntimeRepository implements CoordinationRuntimeRepository {
  private readonly transactionContext = new AsyncLocalStorage<Executor>();
  constructor(private readonly db: Executor) {}

  async transaction<T>(operation: () => Promise<T>): Promise<T> {
    return this.withTransactionExecutor(() => operation());
  }
  async withTransactionExecutor<T>(operation: (tx: Executor) => Promise<T>): Promise<T> {
    const current = this.transactionContext.getStore();
    if (current) return operation(current);
    return this.db.transaction((tx: Executor) => this.transactionContext.run(tx, () => operation(tx)));
  }
  async withAttemptLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
    return this.transaction(async () => {
      await this.tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
      return operation();
    });
  }
  private get tx(): Executor { return this.transactionContext.getStore() ?? this.db; }
  /** Authority provisioning is intentionally separate from evidence writes. */
  async provisionProfile(input: {
    id: string;
    runtimeRegistrationId: string;
    actor: string;
    capabilities: string[];
    provider: string;
    model: string;
    adapterVersion: string;
    repositoryLabel: string;
    worktreeLabel: string;
    worktreeRealpathDigest: string;
    branch: string;
    startingCommit: string;
  }): Promise<void> {
    await this.tx.insert(coordinationRuntimeProfiles).values(input);
  }
  // Inbox materialization is owned by coordination-inbox-service.  These
  // methods are deliberately explicit so a host can provide its frozen-window
  // reader without weakening the runtime evidence transaction.
  async addInboxItem(item: InboxItem): Promise<InboxItem> {
    const digest = digestCanonical(item);
    await this.tx.insert(coordinationRuntimeInboxWindowItems).values({
      windowId: '__open__', itemId: item.id, eventId: item.eventId, threadId: item.threadId,
      taskId: item.taskId, sequence: item.sequence, payload: item.payload, itemDigest: digest,
    });
    return item;
  }
  async freezeInboxWindow(threadId: string, after: number, through: number, token: string): Promise<InboxWindow> {
    if (!token || through <= after) {
      protocolFailure('inbox_window_invalid', 'Window boundary is invalid');
    }
    if (await this.getThreadSequence(threadId) !== through) {
      protocolFailure('inbox_window_unstable', 'Through boundary is not current');
    }
    const rows = await this.tx.select().from(coordinationRuntimeInboxWindowItems)
      .where(and(
        eq(coordinationRuntimeInboxWindowItems.windowId, '__open__'),
        eq(coordinationRuntimeInboxWindowItems.threadId, threadId),
        gt(coordinationRuntimeInboxWindowItems.sequence, after),
        lte(coordinationRuntimeInboxWindowItems.sequence, through),
      ))
      .orderBy(coordinationRuntimeInboxWindowItems.sequence);
    if (!rows.length) {
      protocolFailure('inbox_window_incomplete', 'Window is empty');
    }
    const base = { threadId, afterExclusive: after, throughInclusive: through, boundaryToken: token,
      orderedItemIds: rows.map((r: any) => r.itemId), itemDigests: rows.map((r: any) => r.itemDigest) };
    const window: InboxWindow = { id: `window-${digestCanonical(base)}`, threadId, afterExclusive: after,
      throughInclusive: through, boundaryToken: token, orderedItemIds: base.orderedItemIds,
      boundaryDigest: digestCanonical(base) };
    await this.tx.insert(coordinationRuntimeInboxWindows).values({ ...window, canonicalPayload: base });
    await this.tx.update(coordinationRuntimeInboxWindowItems).set({ windowId: window.id })
      .where(inArray(coordinationRuntimeInboxWindowItems.itemId, window.orderedItemIds));
    return window;
  }
  async validateWindow(id: string): Promise<{ window: InboxWindow; items: InboxItem[] }> {
    const [w] = await this.tx.select().from(coordinationRuntimeInboxWindows)
      .where(eq(coordinationRuntimeInboxWindows.id, id));
    if (!w) {
      protocolFailure('inbox_window_incomplete', 'Frozen window is required');
    }
    const rows = await this.tx.select().from(coordinationRuntimeInboxWindowItems)
      .where(eq(coordinationRuntimeInboxWindowItems.windowId, id));
    const items = rows.sort((a: any, b: any) => a.sequence - b.sequence).map((r: any) => ({
      id: r.itemId, eventId: r.eventId, threadId: r.threadId, taskId: r.taskId,
      sequence: r.sequence, payload: r.payload,
    }));
    const base = { threadId: w.threadId, afterExclusive: w.afterExclusive,
      throughInclusive: w.throughInclusive, boundaryToken: w.boundaryToken,
      orderedItemIds: items.map((i: InboxItem) => i.id), itemDigests: items.map((i: InboxItem) => digestCanonical(i)) };
    if (
      await this.getThreadSequence(w.threadId) !== w.throughInclusive ||
      w.boundaryDigest !== digestCanonical(base) ||
      JSON.stringify(w.orderedItemIds) !== JSON.stringify(base.orderedItemIds)
    ) {
      protocolFailure('inbox_window_unstable', 'Frozen window no longer matches source records');
    }
    return { window: w as InboxWindow, items };
  }
  async getThreadSequence(threadId: string): Promise<number | undefined> {
    const rows = await this.tx.select({ sequence: coordinationRuntimeInboxWindowItems.sequence })
      .from(coordinationRuntimeInboxWindowItems).where(eq(coordinationRuntimeInboxWindowItems.threadId, threadId));
    return rows.length ? Math.max(...rows.map((r: any) => r.sequence)) : undefined;
  }

  async getPacket(id: string) { const [r] = await this.tx.select().from(coordinationRuntimePackets).where(eq(coordinationRuntimePackets.id, id)); return r && packet(r); }
  async getInteraction(id: string) { const [r] = await this.tx.select().from(coordinationRuntimeInteractions).where(eq(coordinationRuntimeInteractions.id, id)); return r && interaction(r); }
  async getReceipt(id: string) { const [r] = await this.tx.select().from(coordinationRuntimeReceipts).where(eq(coordinationRuntimeReceipts.id, id)); return r && receipt(r); }
  async getClaim(id: string) { const [r] = await this.tx.select().from(coordinationRuntimeClaims).where(eq(coordinationRuntimeClaims.id, id)); return r && claim(r); }
  async getExecution(id: string) { const [r] = await this.tx.select().from(coordinationRuntimeExecutions).where(eq(coordinationRuntimeExecutions.id, id)); return r && execution(r); }
  async executionForClaim(claimId: string) {
    const [r] = await this.tx.select().from(coordinationRuntimeExecutions)
      .where(eq(coordinationRuntimeExecutions.claimId, claimId)).limit(1);
    return r && execution(r);
  }
  async getCompletion(id: string) { const [r] = await this.tx.select().from(coordinationRuntimeCompletions).where(eq(coordinationRuntimeCompletions.id, id)); return r && completion(r); }
  async getVerification(id: string) { const [r] = await this.tx.select().from(coordinationRuntimeVerifications).where(eq(coordinationRuntimeVerifications.id, id)); return r && verification(r); }
  async getToolResult(id: string) { const [r] = await this.tx.select().from(coordinationRuntimeToolResults).where(eq(coordinationRuntimeToolResults.id, id)); return r && toolResult(r); }
  async toolResultsForClaim(claimId: string, claimEpoch: number) {
    return (await this.tx.select().from(coordinationRuntimeToolResults).where(and(eq(coordinationRuntimeToolResults.claimId, claimId), eq(coordinationRuntimeToolResults.claimEpoch, claimEpoch)))).map(toolResult);
  }
  async toolResultsForClaimAllEpochs(claimId: string) {
    return (await this.tx.select().from(coordinationRuntimeToolResults).where(eq(coordinationRuntimeToolResults.claimId, claimId))).map(toolResult);
  }
  async getResult(kind: string, id: string): Promise<unknown> {
    const readers: Record<string, (id: string) => Promise<unknown>> = {
      packet: this.getPacket.bind(this), interaction: this.getInteraction.bind(this),
      receipt: this.getReceipt.bind(this), claim: this.getClaim.bind(this),
      renewal: this.getClaim.bind(this), execution: this.getExecution.bind(this),
      completion: this.getCompletion.bind(this), verification: this.getVerification.bind(this),
      tool_result: this.getToolResult.bind(this),
    };
    return readers[kind]?.(id);
  }
  async idempotency(scope: string, key: string) {
    const [r] = await this.tx.select().from(coordinationRuntimeIdempotency).where(and(eq(coordinationRuntimeIdempotency.scope, scope), eq(coordinationRuntimeIdempotency.idempotencyKey, key)));
    return r && { payloadDigest: r.payloadDigest, resultKind: r.resultKind, resultId: r.resultId };
  }
  async saveIdempotency(scope: string, key: string, value: IdempotencyRecord) {
    await this.tx.insert(coordinationRuntimeIdempotency).values({ scope, idempotencyKey: key, ...value });
  }
  async savePacket(v: InheritancePacket) {
    const a = v.assignment;
    await this.tx.insert(coordinationRuntimePackets).values({ id: v.id, profileId: v.profileId, runtimeRegistrationId: v.runtimeRegistrationId, version: v.version, assignmentEventId: a.assignmentEventId, assignmentTaskId: a.taskId, assignmentThreadId: a.threadId, assignmentAuthor: a.assignmentAuthor, expectedSequence: a.expectedSequence, supersedesClaimId: v.supersedesClaimId, windowId: v.windowId, windowDigest: v.windowDigest, orderedInboxItemIds: v.orderedInboxItemIds, orderedEventIds: v.orderedEventIds, orderedThreadIds: v.orderedThreadIds, inheritedPayload: v.inherited, envelope: v.envelope, canonicalPayload: { ...v, digest: undefined }, digest: v.digest, createdAt: new Date(v.createdAt) });
  }
  async saveInteraction(v: ModelInteraction) {
    const packet = await this.getPacket(v.packetId);
    await this.tx.insert(coordinationRuntimeInteractions).values({
      id: v.id, packetId: v.packetId, assignmentEventId: packet!.assignment.assignmentEventId,
      assignmentTaskId: packet!.assignment.taskId, profileId: v.principal.profileId,
      runtimeRegistrationId: v.principal.runtimeRegistrationId, credentialId: v.principal.credentialId,
      turn: v.turn, attempt: v.attempt, requestDigest: v.requestDigest,
      responseDigest: v.responseDigest!, outcome: v.outcome, retryLineage: v.retryLineage,
      canonicalPayload: v, createdAt: new Date(v.createdAt),
    });
  }
  async saveReceipt(v: OutcomeReceipt) {
    await this.tx.insert(coordinationRuntimeReceipts).values({
      ...v,
      canonicalEnvelope: v,
      createdAt: new Date(v.createdAt),
    });
  }
  async saveClaim(v: ExecutionClaim) {
    const existing = await this.getClaim(v.id);
    if (existing) {
      await this.tx.update(coordinationRuntimeClaims).set({
        credentialId: v.credentialId,
        epoch: v.epoch,
        status: v.status,
        expiresAt: new Date(v.expiresAt),
        terminalAt: v.terminalAt === null ? null : new Date(v.terminalAt),
      }).where(eq(coordinationRuntimeClaims.id, v.id));
      return;
    }
    await this.tx.insert(coordinationRuntimeClaims).values({
      ...v,
      expiresAt: new Date(v.expiresAt),
      terminalAt: v.terminalAt === null ? null : new Date(v.terminalAt),
      createdAt: new Date(),
    });
  }
  async addClaimEvent(v: ClaimEvent) { await this.tx.insert(coordinationRuntimeClaimEvents).values({ ...v, occurredAt: new Date(v.occurredAt) }); }
  async saveExecution(v: ExecutionRecord) { await this.tx.insert(coordinationRuntimeExecutions).values({ ...v, envelope: v.envelope, canonicalPayload: v, createdAt: new Date() }); }
  async saveCompletion(v: CompletionRecord) { await this.tx.insert(coordinationRuntimeCompletions).values({ ...v, canonicalPayload: v, createdAt: new Date() }); }
  async saveVerification(v: VerificationDecision) { await this.tx.insert(coordinationRuntimeVerifications).values({ ...v, canonicalPayload: v, createdAt: new Date() }); }
  async saveToolResult(v: ToolResultRecord) {
    await this.tx.insert(coordinationRuntimeToolResults).values({
      ...v, canonicalPayload: v.canonicalPayload, createdAt: new Date(v.createdAt),
    });
  }
  async activeClaimForThread(threadId: string) { const [r] = await this.tx.select().from(coordinationRuntimeClaims).where(and(eq(coordinationRuntimeClaims.threadId, threadId), eq(coordinationRuntimeClaims.status, 'active'))); return r && claim(r); }
  async interactionForSlot(packetId: string, turn: number, attempt: number) { const [r] = await this.tx.select().from(coordinationRuntimeInteractions).where(and(eq(coordinationRuntimeInteractions.packetId, packetId), eq(coordinationRuntimeInteractions.turn, turn), eq(coordinationRuntimeInteractions.attempt, attempt))); return r && interaction(r); }
  async interactionsForPacket(packetId: string) { return (await this.tx.select().from(coordinationRuntimeInteractions).where(eq(coordinationRuntimeInteractions.packetId, packetId))).map(interaction); }
  async interactionsForAssignment(packet: InheritancePacket) { const rows = await this.tx.select().from(coordinationRuntimeInteractions).innerJoin(coordinationRuntimePackets, eq(coordinationRuntimePackets.id, coordinationRuntimeInteractions.packetId)).where(and(eq(coordinationRuntimePackets.assignmentEventId, packet.assignment.assignmentEventId), eq(coordinationRuntimePackets.assignmentTaskId, packet.assignment.taskId))); return rows.map((r: any) => interaction(r.coordination_runtime_interactions)); }
  async interactionForAssignmentSlot(p: InheritancePacket, t: number, a: number) { return (await this.interactionsForAssignment(p)).find((v: ModelInteraction) => v.turn === t && v.attempt === a); }
  async maxClaimEpoch(threadId: string) { const rows = await this.tx.select({ epoch: coordinationRuntimeClaims.epoch }).from(coordinationRuntimeClaims).where(eq(coordinationRuntimeClaims.threadId, threadId)); return Math.max(0, ...rows.map((r: any) => r.epoch)); }
  async packetForAssignmentVersion(event: string, version: number) { const [r] = await this.tx.select().from(coordinationRuntimePackets).where(and(eq(coordinationRuntimePackets.assignmentEventId, event), eq(coordinationRuntimePackets.version, version))); return r && packet(r); }
  async claimsForPacket(packetId: string) { return (await this.tx.select().from(coordinationRuntimeClaims).where(eq(coordinationRuntimeClaims.packetId, packetId))).map(claim); }
  async latestClaimForThread(threadId: string) { const [r] = await this.tx.select().from(coordinationRuntimeClaims).where(eq(coordinationRuntimeClaims.threadId, threadId)).orderBy(desc(coordinationRuntimeClaims.epoch)).limit(1); return r && claim(r); }
  async claimEventForEpoch(claimId: string, epoch: number) {
    const [r] = await this.tx.select().from(coordinationRuntimeClaimEvents)
      .where(and(eq(coordinationRuntimeClaimEvents.claimId, claimId), eq(coordinationRuntimeClaimEvents.epoch, epoch)))
      .orderBy(desc(coordinationRuntimeClaimEvents.occurredAt)).limit(1);
    return r && {
      id: r.id, claimId: r.claimId, epoch: r.epoch, kind: r.kind, reason: r.reason,
      priorClaimId: r.priorClaimId, occurredAt: +new Date(r.occurredAt),
    } as ClaimEvent;
  }
  async getActiveProfile(runtimeRegistrationId: string): Promise<CodingRuntimeProfile | undefined> {
    const [r] = await this.tx.select().from(coordinationRuntimeProfiles)
      .where(and(eq(coordinationRuntimeProfiles.runtimeRegistrationId, runtimeRegistrationId), eq(coordinationRuntimeProfiles.status, 'active')))
      .limit(1);
    return r && {
      id: r.id, runtimeRegistrationId: r.runtimeRegistrationId, actor: r.actor as CodingRuntimeProfile['actor'],
      capabilities: r.capabilities, provider: r.provider, model: r.model, adapterVersion: r.adapterVersion, status: r.status,
      startingCommit: r.startingCommit, repositoryLabel: r.repositoryLabel, branch: r.branch,
      worktreeLabel: r.worktreeLabel, worktreeRealpathDigest: r.worktreeRealpathDigest,
    };
  }
}

const packet = (r: any): InheritancePacket => ({ id: r.id, version: r.version, actor: 'luca-gemini', runtimeRegistrationId: r.runtimeRegistrationId, profileId: r.profileId, createdAt: +new Date(r.createdAt), supersedesClaimId: r.supersedesClaimId, windowId: r.windowId, windowDigest: r.windowDigest, orderedInboxItemIds: r.orderedInboxItemIds, orderedEventIds: r.orderedEventIds, orderedThreadIds: r.orderedThreadIds, assignment: { assignmentEventId: r.assignmentEventId, assignmentAuthor: r.assignmentAuthor, taskId: r.assignmentTaskId, threadId: r.assignmentThreadId, expectedSequence: r.expectedSequence }, inherited: r.inheritedPayload, envelope: r.envelope, digest: r.digest });
const interaction = (r: any): ModelInteraction => ({ id: r.id, packetId: r.packetId, principal: { actor: 'luca-gemini', runtimeRegistrationId: r.runtimeRegistrationId, credentialId: r.credentialId, profileId: r.profileId }, turn: r.turn, attempt: r.attempt, requestDigest: r.requestDigest, responseDigest: r.responseDigest, outcome: r.outcome, retryLineage: r.retryLineage, ...(r.canonicalPayload?.normalizedEvidence ? { normalizedEvidence: r.canonicalPayload.normalizedEvidence } : {}), createdAt: +new Date(r.createdAt) });
const receipt = (r: any): OutcomeReceipt => ({ id: r.id, packetId: r.packetId, packetDigest: r.packetDigest, interactionId: r.interactionId, runtimeRegistrationId: r.runtimeRegistrationId, profileId: r.profileId, outcome: r.outcome, createdAt: +new Date(r.createdAt) });
const claim = (r: any): ExecutionClaim => ({ id: r.id, threadId: r.threadId, packetId: r.packetId, runtimeRegistrationId: r.runtimeRegistrationId, profileId: r.profileId, credentialId: r.credentialId, priorClaimId: r.priorClaimId, epoch: r.epoch, expiresAt: +new Date(r.expiresAt), status: r.status, terminalAt: r.terminalAt && +new Date(r.terminalAt) });
const execution = (r: any): ExecutionRecord => ({
  id: r.id, claimId: r.claimId, claimEpoch: r.claimEpoch, runtimeRegistrationId: r.runtimeRegistrationId,
  profileId: r.profileId, credentialId: r.credentialId, envelope: r.envelope,
  derivedToolEvidence: r.canonicalPayload?.derivedToolEvidence ?? [],
  attestedLocalState: r.canonicalPayload?.attestedLocalState ?? {
    startingCommit: '', resultingHead: '', changedPaths: [], patchDigest: null,
    commandResults: [], elapsedMs: 0, modelTurns: 0, apiAttempts: 0,
  },
  executionDigest: r.executionDigest,
});
const completion = (r: any): CompletionRecord => ({ id: r.id, executionId: r.executionId, claimId: r.claimId, claimEpoch: r.claimEpoch, evidenceDigest: r.evidenceDigest });
const verification = (r: any): VerificationDecision => ({
  id: r.id, completionId: r.completionId, verifierActor: r.verifierActor,
  verifierRuntimeRegistrationId: r.verifierRuntimeRegistrationId, evidenceDigest: r.evidenceDigest,
  patchDigest: r.patchDigest, decision: r.canonicalPayload?.decision ?? 'approved',
  ...(r.canonicalPayload?.rationale ? { rationale: r.canonicalPayload.rationale } : {}),
  ...(r.canonicalPayload?.rerunEvidence !== undefined ? { rerunEvidence: r.canonicalPayload.rerunEvidence } : {}),
});
const toolResult = (r: any): ToolResultRecord => ({
  id: r.id, claimId: r.claimId, claimEpoch: r.claimEpoch, claimEventId: r.claimEventId, interactionId: r.interactionId,
  callId: r.callId, runtimeRegistrationId: r.runtimeRegistrationId, profileId: r.profileId,
  credentialId: r.credentialId, validatedIntentDigest: r.validatedIntentDigest, toolName: r.toolName,
  outcome: r.outcome, canonicalPayload: r.canonicalPayload, resultDigest: r.resultDigest,
  createdAt: +new Date(r.createdAt),
});