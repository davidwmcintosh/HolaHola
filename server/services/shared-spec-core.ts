import { createHash, randomUUID } from "node:crypto";

/**
 * The shared-spec domain is deliberately free of HTTP, database-driver, and
 * host-platform imports. A PostgreSQL adapter can implement the repository
 * interfaces below; the in-memory implementation is useful for executable
 * domain tests and local embedding.
 */

export type SharedSpecDocumentKind = "design" | "architecture";
export type SharedSpecDocumentState = "draft" | "ready_for_review" | "approved" | "published" | "merged" | "archived";
export type SharedSpecReviewState = "pending" | "approved" | "rejected" | "cancelled";
export type ReviewerCapability = "reviewer" | "policy_admin";

export interface ActorContext {
  readonly actorId: string;
  /**
   * Authentication adapters may grant policy administration directly. Review
   * eligibility itself is always resolved from the versioned reviewer policy.
   */
  readonly capabilities?: readonly ReviewerCapability[];
}

export interface SharedSpecDocument {
  readonly id: string;
  readonly title: string;
  readonly summary?: string;
  readonly kind: SharedSpecDocumentKind;
  readonly repository: string;
  readonly gitPath: string;
  readonly currentRevisionId: string;
  readonly state: SharedSpecDocumentState;
  readonly creatorActorId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface SharedSpecRevision {
  readonly id: string;
  readonly documentId: string;
  readonly parentRevisionId?: string;
  readonly markdown: string;
  readonly contentHash: string;
  readonly authorActorId: string;
  readonly idempotencyKey: string;
  /** Digest of the mutation request which created this immutable revision. */
  readonly requestDigest: string;
  readonly createdAt: Date;
}

export interface ReviewerPolicyVersion {
  readonly id: string;
  readonly version: number;
  readonly actorId: string;
  readonly capability: ReviewerCapability;
  readonly active: boolean;
  readonly documentKind?: SharedSpecDocumentKind;
  readonly provenance?: string;
  readonly effectiveAt: Date;
  readonly changedByActorId: string;
}

export interface SharedSpecReview {
  readonly id: string;
  readonly documentId: string;
  readonly revisionId: string;
  readonly revisionContentHash: string;
  /** Actor that requested the review, distinct from its optional assignee. */
  readonly requestedByActorId: string;
  readonly idempotencyKey: string;
  readonly requestDigest: string;
  readonly requestedReviewerActorId?: string;
  readonly claimedReviewerActorId?: string;
  readonly decisionActorId?: string;
  readonly state: SharedSpecReviewState;
  readonly rationale?: string;
  readonly evidenceReferences: readonly string[];
  readonly requestedAt: Date;
  readonly claimedAt?: Date;
  readonly decidedAt?: Date;
  /** Immutable policy evidence captured at the decision, never re-resolved. */
  readonly decisionPolicyVersionId?: string;
  readonly decisionPolicyVersion?: number;
  readonly decisionPolicyActorId?: string;
  readonly decisionPolicyCapability?: ReviewerCapability;
  readonly decisionPolicyActive?: boolean;
  readonly decisionPolicyDocumentKind?: SharedSpecDocumentKind;
  readonly decisionPolicyEffectiveAt?: Date;
}

export interface IdempotencyRecord {
  readonly scope: string;
  readonly actorId: string;
  readonly key: string;
  readonly requestDigest: string;
  readonly resultType: "document" | "revision" | "review" | "policy";
  readonly resultId: string;
}

export interface SharedSpecTransaction {
  getDocument(id: string): Promise<SharedSpecDocument | undefined>;
  listDocuments(): Promise<readonly SharedSpecDocument[]>;
  insertDocument(document: SharedSpecDocument): Promise<void>;
  updateDocument(document: SharedSpecDocument): Promise<void>;
  getRevision(id: string): Promise<SharedSpecRevision | undefined>;
  listRevisions(documentId: string): Promise<readonly SharedSpecRevision[]>;
  insertRevision(revision: SharedSpecRevision): Promise<void>;
  /**
   * Database implementations must use `WHERE current_revision_id = expected`;
   * false means zero rows changed and the caller must not insert a revision.
   */
  compareAndSetCurrentRevision(
    documentId: string,
    expectedRevisionId: string,
    nextRevisionId: string,
    state: SharedSpecDocumentState,
    updatedAt: Date,
  ): Promise<boolean>;
  getReview(id: string): Promise<SharedSpecReview | undefined>;
  listReviews(documentId: string): Promise<readonly SharedSpecReview[]>;
  insertReview(review: SharedSpecReview): Promise<void>;
  updateReview(review: SharedSpecReview): Promise<void>;
  getActivePolicy(
    actorId: string,
    capability: ReviewerCapability,
    kind?: SharedSpecDocumentKind,
  ): Promise<ReviewerPolicyVersion | undefined>;
  getPolicyById(id: string): Promise<ReviewerPolicyVersion | undefined>;
  insertPolicy(policy: ReviewerPolicyVersion): Promise<void>;
  nextPolicyVersion(): Promise<number>;
  getIdempotency(
    scope: string,
    actorId: string,
    key: string,
  ): Promise<IdempotencyRecord | undefined>;
  insertIdempotency(record: IdempotencyRecord): Promise<void>;
}

export interface SharedSpecRepository {
  transaction<T>(work: (tx: SharedSpecTransaction) => Promise<T>): Promise<T>;
}

export type SharedSpecErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "IDEMPOTENCY_MISMATCH"
  | "FORBIDDEN"
  | "INVALID_STATE";

export class SharedSpecDomainError extends Error {
  constructor(
    readonly code: SharedSpecErrorCode,
    message: string,
    readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "SharedSpecDomainError";
  }
}

export const hashSharedSpecMarkdown = (markdown: string): string =>
  createHash("sha256").update(Buffer.from(markdown, "utf8")).digest("hex");

const digestRequest = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");

const clone = <T>(value: T): T => structuredClone(value);
const nowDefault = (): Date => new Date();
const canonicalRepositoryPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/;
const canonicalSpecPathPattern = /^docs\/superpowers\/specs\/[A-Za-z0-9][A-Za-z0-9._-]*\.md$/;

export interface SharedSpecCoreOptions {
  readonly now?: () => Date;
  readonly newId?: () => string;
}

export interface CreateDocumentInput {
  title: string;
  summary?: string;
  kind: SharedSpecDocumentKind;
  repository: string;
  gitPath: string;
  markdown: string;
  idempotencyKey: string;
}

export interface AppendRevisionInput {
  documentId: string;
  baseRevisionId: string;
  markdown: string;
  idempotencyKey: string;
}

export interface MarkRevisionReadyInput {
  documentId: string;
  revisionId: string;
  requestedReviewerActorId?: string;
  idempotencyKey: string;
}

export interface ReviewDecisionInput {
  reviewId: string;
  rationale?: string;
  evidenceReferences?: readonly string[];
  idempotencyKey: string;
}

export class SharedSpecCore {
  private sequence = 0;
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(private readonly repository: SharedSpecRepository, options: SharedSpecCoreOptions = {}) {
    this.now = options.now ?? nowDefault;
    this.newId = options.newId ?? randomUUID;
  }

  async createDocument(actor: ActorContext, input: CreateDocumentInput): Promise<{
    document: SharedSpecDocument; revision: SharedSpecRevision;
  }> {
    this.required(actor.actorId, "actorId");
    this.required(input.title, "title"); this.required(input.repository, "repository");
    this.required(input.gitPath, "gitPath"); this.required(input.markdown, "markdown");
    this.required(input.idempotencyKey, "idempotencyKey");
    if (!canonicalRepositoryPattern.test(input.repository)) {
      throw new SharedSpecDomainError("VALIDATION", "repository must be a canonical owner/name value");
    }
    if (!canonicalSpecPathPattern.test(input.gitPath)) {
      throw new SharedSpecDomainError("VALIDATION", "gitPath must be docs/superpowers/specs/<safe>.md");
    }
    const requestDigest = digestRequest(input);
    return this.repository.transaction(async tx => {
      const duplicate = await this.idempotent(tx, "create-document", actor.actorId, input.idempotencyKey, requestDigest);
      if (duplicate) {
        const document = await this.mustDocument(tx, duplicate.resultId);
        return { document, revision: await this.mustRevision(tx, document.currentRevisionId) };
      }
      const at = this.now();
      const documentId = this.newId();
      const revisionId = this.newId();
      const revision: SharedSpecRevision = { id: revisionId, documentId, markdown: input.markdown,
        contentHash: hashSharedSpecMarkdown(input.markdown), authorActorId: actor.actorId,
        idempotencyKey: input.idempotencyKey, requestDigest, createdAt: at };
      const document: SharedSpecDocument = { id: documentId, title: input.title, summary: input.summary,
        kind: input.kind, repository: input.repository, gitPath: input.gitPath, currentRevisionId: revisionId,
        state: "draft", creatorActorId: actor.actorId, createdAt: at, updatedAt: at };
      await tx.insertDocument(document); await tx.insertRevision(revision);
      await tx.insertIdempotency({ scope: "create-document", actorId: actor.actorId, key: input.idempotencyKey,
        requestDigest, resultType: "document", resultId: documentId });
      return { document, revision };
    });
  }

  async listDocuments(): Promise<readonly SharedSpecDocument[]> {
    return this.repository.transaction(tx => tx.listDocuments());
  }

  async showDocument(documentId: string): Promise<{ document: SharedSpecDocument; currentRevision: SharedSpecRevision }> {
    return this.repository.transaction(async tx => {
      const document = await this.mustDocument(tx, documentId);
      return { document, currentRevision: await this.mustRevision(tx, document.currentRevisionId) };
    });
  }

  async readRevision(revisionId: string): Promise<SharedSpecRevision> {
    return this.repository.transaction(tx => this.mustRevision(tx, revisionId));
  }

  async listRevisions(documentId: string): Promise<readonly SharedSpecRevision[]> {
    return this.repository.transaction(async tx => {
      await this.mustDocument(tx, documentId);
      return tx.listRevisions(documentId);
    });
  }

  async compareRevisions(leftRevisionId: string, rightRevisionId: string): Promise<{
    left: SharedSpecRevision; right: SharedSpecRevision; identical: boolean;
  }> {
    return this.repository.transaction(async tx => {
      const left = await this.mustRevision(tx, leftRevisionId);
      const right = await this.mustRevision(tx, rightRevisionId);
      if (left.documentId !== right.documentId) throw new SharedSpecDomainError("VALIDATION", "Revisions belong to different documents");
      return { left, right, identical: left.contentHash === right.contentHash };
    });
  }

  async appendRevision(actor: ActorContext, input: AppendRevisionInput): Promise<SharedSpecRevision> {
    this.required(actor.actorId, "actorId"); this.required(input.documentId, "documentId");
    this.required(input.baseRevisionId, "baseRevisionId"); this.required(input.markdown, "markdown"); this.required(input.idempotencyKey, "idempotencyKey");
    const requestDigest = digestRequest(input);
    return this.repository.transaction(async tx => {
      const duplicate = await this.idempotent(tx, `append:${input.documentId}`, actor.actorId, input.idempotencyKey, requestDigest);
      if (duplicate) return this.mustRevision(tx, duplicate.resultId);
      const document = await this.mustDocument(tx, input.documentId);
      if (document.currentRevisionId !== input.baseRevisionId) {
        throw new SharedSpecDomainError("CONFLICT", "Revision base is no longer current", {
          submittedBaseRevisionId: input.baseRevisionId, currentRevisionId: document.currentRevisionId,
        });
      }
      const at = this.now();
      const revision: SharedSpecRevision = { id: this.newId(), documentId: document.id,
        parentRevisionId: input.baseRevisionId, markdown: input.markdown, contentHash: hashSharedSpecMarkdown(input.markdown),
        authorActorId: actor.actorId, idempotencyKey: input.idempotencyKey, requestDigest, createdAt: at };
      // The transaction is rolled back on a failed CAS, so the immutable row
      // cannot escape as an orphan. In PostgreSQL this ordering also permits a
      // foreign key from documents.current_revision_id to revisions.id.
      await tx.insertRevision(revision);
      if (!await tx.compareAndSetCurrentRevision(document.id, input.baseRevisionId, revision.id, "draft", at)) {
        const current = await this.mustDocument(tx, document.id);
        throw new SharedSpecDomainError("CONFLICT", "Revision base is no longer current", {
          submittedBaseRevisionId: input.baseRevisionId, currentRevisionId: current.currentRevisionId,
        });
      }
      await tx.insertIdempotency({ scope: `append:${document.id}`, actorId: actor.actorId, key: input.idempotencyKey,
        requestDigest, resultType: "revision", resultId: revision.id });
      return revision;
    });
  }

  async setReviewerPolicy(actor: ActorContext, input: Omit<ReviewerPolicyVersion, "id" | "version" | "effectiveAt" | "changedByActorId"> & { idempotencyKey: string }): Promise<ReviewerPolicyVersion> {
    this.requirePolicyAdmin(actor); this.required(input.actorId, "policy actorId"); this.required(input.idempotencyKey, "idempotencyKey");
    const requestDigest = digestRequest(input);
    return this.repository.transaction(async tx => {
      const duplicate = await this.idempotent(tx, "set-policy", actor.actorId, input.idempotencyKey, requestDigest);
      if (duplicate) return (await this.policyById(tx, duplicate.resultId));
      const policy: ReviewerPolicyVersion = { id: this.newId(), version: await tx.nextPolicyVersion(), actorId: input.actorId,
        capability: input.capability, active: input.active, documentKind: input.documentKind, provenance: input.provenance,
        effectiveAt: this.now(), changedByActorId: actor.actorId };
      await tx.insertPolicy(policy);
      await tx.insertIdempotency({ scope: "set-policy", actorId: actor.actorId, key: input.idempotencyKey,
        requestDigest, resultType: "policy", resultId: policy.id });
      return policy;
    });
  }

  async markRevisionReady(actor: ActorContext, input: MarkRevisionReadyInput): Promise<SharedSpecReview> {
    this.required(actor.actorId, "actorId"); this.required(input.documentId, "documentId");
    this.required(input.revisionId, "revisionId"); this.required(input.idempotencyKey, "idempotencyKey");
    const requestDigest = digestRequest(input);
    return this.repository.transaction(async tx => {
      const duplicate = await this.idempotent(tx, `ready:${input.documentId}`, actor.actorId, input.idempotencyKey, requestDigest);
      if (duplicate) return this.mustReview(tx, duplicate.resultId);
      const document = await this.mustDocument(tx, input.documentId);
      const revision = await this.mustRevision(tx, input.revisionId);
      this.requireAuthorOrPolicyAdmin(actor, revision);
      if (document.state !== "draft") throw new SharedSpecDomainError("INVALID_STATE", "Only a draft document may be marked ready");
      if (document.currentRevisionId !== revision.id) throw new SharedSpecDomainError("CONFLICT", "Only the current revision may be marked ready");
      if ((await tx.listReviews(document.id)).some(review => review.revisionId === revision.id)) {
        throw new SharedSpecDomainError("CONFLICT", "A review already exists for this revision");
      }
      if (input.requestedReviewerActorId) await this.assertEligibleReviewer(tx, input.requestedReviewerActorId, document, revision);
      const review: SharedSpecReview = { id: this.newId(), documentId: document.id, revisionId: revision.id,
        revisionContentHash: revision.contentHash, requestedByActorId: actor.actorId,
        requestedReviewerActorId: input.requestedReviewerActorId, idempotencyKey: input.idempotencyKey,
        requestDigest, state: "pending", evidenceReferences: [], requestedAt: this.now() };
      await tx.insertReview(review);
      await tx.updateDocument({ ...document, state: "ready_for_review", updatedAt: this.now() });
      await tx.insertIdempotency({ scope: `ready:${document.id}`, actorId: actor.actorId, key: input.idempotencyKey,
        requestDigest, resultType: "review", resultId: review.id });
      return review;
    });
  }

  async claimReview(actor: ActorContext, reviewId: string, idempotencyKey: string): Promise<SharedSpecReview> {
    this.required(actor.actorId, "actorId"); this.required(reviewId, "reviewId"); this.required(idempotencyKey, "idempotencyKey");
    return this.repository.transaction(async tx => {
      const review = await this.mustReview(tx, reviewId); const digest = digestRequest({ reviewId });
      const duplicate = await this.idempotent(tx, `claim:${reviewId}`, actor.actorId, idempotencyKey, digest);
      if (duplicate) return this.mustReview(tx, duplicate.resultId);
      const { document, revision } = await this.reviewTarget(tx, review);
      if (review.state !== "pending" || review.claimedReviewerActorId) throw new SharedSpecDomainError("INVALID_STATE", "Review cannot be claimed");
      if (review.requestedReviewerActorId && review.requestedReviewerActorId !== actor.actorId) throw new SharedSpecDomainError("FORBIDDEN", "Review is assigned to another actor");
      await this.assertEligibleReviewer(tx, actor.actorId, document, revision);
      const updated = { ...review, claimedReviewerActorId: actor.actorId, claimedAt: this.now() };
      await tx.updateReview(updated);
      await tx.insertIdempotency({ scope: `claim:${reviewId}`, actorId: actor.actorId, key: idempotencyKey, requestDigest: digest, resultType: "review", resultId: reviewId });
      return updated;
    });
  }

  async assignReview(actor: ActorContext, reviewId: string, reviewerActorId: string, idempotencyKey: string): Promise<SharedSpecReview> {
    this.required(actor.actorId, "actorId"); this.required(reviewId, "reviewId"); this.required(reviewerActorId, "reviewerActorId"); this.required(idempotencyKey, "idempotencyKey"); this.requirePolicyAdmin(actor);
    return this.repository.transaction(async tx => {
      const review = await this.mustReview(tx, reviewId); const digest = digestRequest({ reviewId, reviewerActorId });
      const duplicate = await this.idempotent(tx, `assign:${reviewId}`, actor.actorId, idempotencyKey, digest);
      if (duplicate) return this.mustReview(tx, duplicate.resultId);
      const { document, revision } = await this.reviewTarget(tx, review);
      if (review.state !== "pending") throw new SharedSpecDomainError("INVALID_STATE", "Only a pending review may be assigned");
      await this.assertEligibleReviewer(tx, reviewerActorId, document, revision);
      const updated = { ...review, requestedReviewerActorId: reviewerActorId, claimedReviewerActorId: undefined, claimedAt: undefined };
      await tx.updateReview(updated);
      await tx.insertIdempotency({ scope: `assign:${reviewId}`, actorId: actor.actorId, key: idempotencyKey, requestDigest: digest, resultType: "review", resultId: reviewId });
      return updated;
    });
  }

  async approveReview(actor: ActorContext, input: ReviewDecisionInput): Promise<SharedSpecReview> {
    return this.decideReview(actor, input, "approved");
  }
  async rejectReview(actor: ActorContext, input: ReviewDecisionInput): Promise<SharedSpecReview> {
    return this.decideReview(actor, input, "rejected");
  }

  async exportApprovedBytes(documentId: string, revisionId?: string): Promise<{
    document: SharedSpecDocument; revision: SharedSpecRevision; review: SharedSpecReview; bytes: Buffer;
  }> {
    return this.repository.transaction(async tx => {
      const document = await this.mustDocument(tx, documentId);
      const reviews = await tx.listReviews(documentId);
      if (!revisionId && document.state !== "approved") {
        throw new SharedSpecDomainError("INVALID_STATE", "The current document is not approved; specify an approved revision");
      }
      const selectedRevisionId = revisionId ?? document.currentRevisionId;
      const review = reviews.find(item => item.state === "approved" && item.revisionId === selectedRevisionId);
      if (!review) throw new SharedSpecDomainError("INVALID_STATE", "No approved revision is available for export");
      const revision = await this.mustRevision(tx, review.revisionId);
      if (hashSharedSpecMarkdown(revision.markdown) !== review.revisionContentHash) throw new SharedSpecDomainError("CONFLICT", "Approved revision hash is invalid");
      return { document, revision, review, bytes: Buffer.from(revision.markdown, "utf8") };
    });
  }

  private async decideReview(actor: ActorContext, input: ReviewDecisionInput, decision: "approved" | "rejected"): Promise<SharedSpecReview> {
    this.required(actor.actorId, "actorId"); this.required(input.reviewId, "reviewId"); this.required(input.idempotencyKey, "idempotencyKey");
    return this.repository.transaction(async tx => {
      const review = await this.mustReview(tx, input.reviewId); const digest = digestRequest({ ...input, decision });
      const duplicate = await this.idempotent(tx, `${decision}:${review.id}`, actor.actorId, input.idempotencyKey, digest);
      if (duplicate) return this.mustReview(tx, duplicate.resultId);
      const { document, revision } = await this.reviewTarget(tx, review);
      if (review.state !== "pending" || review.claimedReviewerActorId !== actor.actorId) throw new SharedSpecDomainError("FORBIDDEN", "Only the claiming reviewer may decide this review");
      if (document.state !== "ready_for_review" || document.currentRevisionId !== revision.id) {
        throw new SharedSpecDomainError("CONFLICT", "Only the current ready revision may be decided");
      }
      const policy = await this.assertEligibleReviewer(tx, actor.actorId, document, revision);
      if (hashSharedSpecMarkdown(revision.markdown) !== review.revisionContentHash) throw new SharedSpecDomainError("CONFLICT", "Revision hash does not match review");
      const updated: SharedSpecReview = { ...review, state: decision, decisionActorId: actor.actorId, rationale: input.rationale,
        evidenceReferences: [...(input.evidenceReferences ?? [])], decidedAt: this.now(),
        decisionPolicyVersionId: policy.id, decisionPolicyVersion: policy.version,
        decisionPolicyActorId: policy.actorId, decisionPolicyCapability: policy.capability,
        decisionPolicyActive: policy.active, decisionPolicyDocumentKind: policy.documentKind,
        decisionPolicyEffectiveAt: policy.effectiveAt };
      await tx.updateReview(updated);
      await tx.updateDocument({
        ...document,
        state: decision === "approved" ? "approved" : "draft",
        updatedAt: this.now(),
      });
      await tx.insertIdempotency({ scope: `${decision}:${review.id}`, actorId: actor.actorId, key: input.idempotencyKey, requestDigest: digest, resultType: "review", resultId: review.id });
      return updated;
    });
  }

  private async reviewTarget(tx: SharedSpecTransaction, review: SharedSpecReview) {
    return { document: await this.mustDocument(tx, review.documentId), revision: await this.mustRevision(tx, review.revisionId) };
  }
  private async assertEligibleReviewer(tx: SharedSpecTransaction, actorId: string, document: SharedSpecDocument, revision: SharedSpecRevision) {
    if (revision.authorActorId === actorId) throw new SharedSpecDomainError("FORBIDDEN", "An author cannot review their own revision");
    const policy = await tx.getActivePolicy(actorId, "reviewer", document.kind);
    if (!policy) throw new SharedSpecDomainError("FORBIDDEN", "Actor is not an eligible reviewer");
    return policy;
  }
  private requirePolicyAdmin(actor: ActorContext) {
    if (!actor.capabilities?.includes("policy_admin")) throw new SharedSpecDomainError("FORBIDDEN", "Policy-admin capability is required");
  }
  private requireAuthorOrPolicyAdmin(actor: ActorContext, revision: SharedSpecRevision) {
    if (actor.actorId !== revision.authorActorId && !actor.capabilities?.includes("policy_admin")) {
      throw new SharedSpecDomainError("FORBIDDEN", "Only the revision author or a policy administrator may mark it ready");
    }
  }
  private required(value: string | undefined, name: string) {
    if (!value?.trim()) throw new SharedSpecDomainError("VALIDATION", `${name} is required`);
  }
  private async idempotent(tx: SharedSpecTransaction, scope: string, actorId: string, key: string, requestDigest: string) {
    const existing = await tx.getIdempotency(scope, actorId, key);
    if (!existing) return undefined;
    if (existing.requestDigest !== requestDigest) throw new SharedSpecDomainError("IDEMPOTENCY_MISMATCH", "Idempotency key was reused with a different request");
    return existing;
  }
  private async mustDocument(tx: SharedSpecTransaction, id: string) {
    const value = await tx.getDocument(id); if (!value) throw new SharedSpecDomainError("NOT_FOUND", "Document not found", { documentId: id }); return value;
  }
  private async mustRevision(tx: SharedSpecTransaction, id: string) {
    const value = await tx.getRevision(id); if (!value) throw new SharedSpecDomainError("NOT_FOUND", "Revision not found", { revisionId: id }); return value;
  }
  private async mustReview(tx: SharedSpecTransaction, id: string) {
    const value = await tx.getReview(id); if (!value) throw new SharedSpecDomainError("NOT_FOUND", "Review not found", { reviewId: id }); return value;
  }
  private async policyById(tx: SharedSpecTransaction, id: string): Promise<ReviewerPolicyVersion> {
    // Version ids are only exposed by idempotency replays. A generic repository
    // need not expose policy enumeration, so retrieve it through active lookup is
    // not possible; the in-memory implementation supplies this helper internally.
    const policy = await tx.getPolicyById(id);
    if (!policy) throw new SharedSpecDomainError("NOT_FOUND", "Policy version not found", { policyId: id });
    return policy;
  }
}

/** Serial transactions model PostgreSQL transaction isolation for core tests. */
export class InMemorySharedSpecRepository implements SharedSpecRepository {
  private documents = new Map<string, SharedSpecDocument>();
  private revisions = new Map<string, SharedSpecRevision>();
  private reviews = new Map<string, SharedSpecReview>();
  private policies = new Map<string, ReviewerPolicyVersion>();
  private idempotency = new Map<string, IdempotencyRecord>();
  private policyVersion = 0;
  private lock: Promise<void> = Promise.resolve();

  async transaction<T>(work: (tx: SharedSpecTransaction) => Promise<T>): Promise<T> {
    let release!: () => void; const previous = this.lock; this.lock = new Promise(resolve => { release = resolve; });
    await previous;
    const snapshot = {
      documents: new Map([...this.documents].map(([key, value]) => [key, clone(value)])),
      revisions: new Map([...this.revisions].map(([key, value]) => [key, clone(value)])),
      reviews: new Map([...this.reviews].map(([key, value]) => [key, clone(value)])),
      policies: new Map([...this.policies].map(([key, value]) => [key, clone(value)])),
      idempotency: new Map([...this.idempotency].map(([key, value]) => [key, clone(value)])),
      policyVersion: this.policyVersion,
    };
    try {
      return await work(this.tx());
    } catch (error) {
      this.documents = snapshot.documents; this.revisions = snapshot.revisions; this.reviews = snapshot.reviews;
      this.policies = snapshot.policies; this.idempotency = snapshot.idempotency; this.policyVersion = snapshot.policyVersion;
      throw error;
    } finally { release(); }
  }
  private tx(): SharedSpecTransaction {
    const idemKey = (scope: string, actor: string, key: string) => `${scope}\u0000${actor}\u0000${key}`;
    return {
      getDocument: async id => clone(this.documents.get(id)),
      listDocuments: async () => [...this.documents.values()].map(clone),
      insertDocument: async value => {
        if (this.documents.has(value.id) || [...this.documents.values()].some(x => x.repository === value.repository && x.gitPath === value.gitPath)) {
          throw new SharedSpecDomainError("CONFLICT", "Document destination already exists");
        }
        this.documents.set(value.id, clone(value));
      },
      updateDocument: async value => { if (!this.documents.has(value.id)) throw new SharedSpecDomainError("NOT_FOUND", "Document not found"); this.documents.set(value.id, clone(value)); },
      getRevision: async id => clone(this.revisions.get(id)),
      listRevisions: async documentId => [...this.revisions.values()].filter(x => x.documentId === documentId).map(clone),
      insertRevision: async value => { if (this.revisions.has(value.id)) throw new SharedSpecDomainError("CONFLICT", "Revision already exists"); this.revisions.set(value.id, clone(value)); },
      compareAndSetCurrentRevision: async (id, expected, next, state, updatedAt) => {
        const doc = this.documents.get(id); if (!doc || doc.currentRevisionId !== expected) return false;
        this.documents.set(id, { ...doc, currentRevisionId: next, state, updatedAt: new Date(updatedAt) }); return true;
      },
      getReview: async id => clone(this.reviews.get(id)),
      listReviews: async documentId => [...this.reviews.values()].filter(x => x.documentId === documentId).map(clone),
      insertReview: async value => { this.reviews.set(value.id, clone(value)); },
      updateReview: async value => { if (!this.reviews.has(value.id)) throw new SharedSpecDomainError("NOT_FOUND", "Review not found"); this.reviews.set(value.id, clone(value)); },
      getActivePolicy: async (actorId, capability, kind) => {
        const matches = [...this.policies.values()].filter(x => x.actorId === actorId && x.capability === capability && (!x.documentKind || x.documentKind === kind));
        const latest = matches.sort((a, b) => b.version - a.version)[0];
        return latest?.active ? clone(latest) : undefined;
      },
      insertPolicy: async value => { this.policies.set(value.id, clone(value)); },
      nextPolicyVersion: async () => ++this.policyVersion,
      getPolicyById: async id => clone(this.policies.get(id)),
      getIdempotency: async (scope, actor, key) => clone(this.idempotency.get(idemKey(scope, actor, key))),
      insertIdempotency: async value => { const key = idemKey(value.scope, value.actorId, value.key); if (this.idempotency.has(key)) throw new SharedSpecDomainError("CONFLICT", "Idempotency key already exists"); this.idempotency.set(key, clone(value)); },
    };
  }
}