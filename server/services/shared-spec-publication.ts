import { createHash, randomUUID } from "node:crypto";
import { hashSharedSpecMarkdown, SharedSpecDomainError, type ActorContext, type SharedSpecCore } from "./shared-spec-core";

export type SpecPublicationState = "requested" | "creating" | "open" | "merged" | "closed" | "conflict" | "failed";

export interface SpecPublication {
  readonly id: string;
  readonly documentId: string;
  readonly revisionId: string;
  readonly reviewId: string;
  readonly contentHash: string;
  readonly repository: string;
  readonly baseRef: string;
  readonly expectedBaseCommit: string;
  readonly destinationPath: string;
  readonly expectedDestinationBlobHash?: string;
  readonly expectedDestinationAbsent: boolean;
  readonly requestedByActorId: string;
  readonly idempotencyKey: string;
  readonly requestDigest: string;
  readonly state: SpecPublicationState;
  readonly branchName?: string;
  readonly pullRequestNumber?: number;
  readonly pullRequestUrl?: string;
  readonly lastError?: string;
}

export interface SpecPublicationProvider {
  prepare(input: {
    documentId: string; revisionId: string; reviewId: string; contentHash: string;
    repository: string; destinationPath: string;
  }): Promise<Pick<SpecPublication, "repository" | "baseRef" | "expectedBaseCommit" | "destinationPath" | "expectedDestinationBlobHash" | "expectedDestinationAbsent">>;
  publish(input: Omit<SpecPublication, "state" | "branchName" | "pullRequestNumber" | "pullRequestUrl" | "lastError"> & { bytes: Uint8Array }): Promise<{
    branchName: string; pullRequestNumber: number; pullRequestUrl: string;
  }>;
  reconcile(publication: SpecPublication): Promise<Pick<SpecPublication, "state" | "pullRequestNumber" | "pullRequestUrl">>;
}

/** Persistence remains replaceable while migrations are deployed independently. */
export interface SpecPublicationStore {
  get(id: string): Promise<SpecPublication | undefined>;
  getByRequest(requestedByActorId: string, idempotencyKey: string): Promise<(SpecPublication & {
    requestedByActorId: string; idempotencyKey: string; requestDigest: string;
  }) | undefined>;
  create?(publication: SpecPublication): Promise<void>;
  update(publication: SpecPublication): Promise<void>;
  appendAttempt(input: {
    publicationId: string; operation: string; outcome: "started" | "succeeded" | "failed" | "conflict";
    errorDetail?: string; responseMetadata?: Record<string, unknown>;
  }): Promise<void>;
}

/**
 * Application-layer orchestration. Core export remains the authority for exact
 * approved bytes; provider failures only update publication state/attempts.
 */
export class SharedSpecPublicationService {
  constructor(
    private readonly core: SharedSpecCore,
    private readonly store: SpecPublicationStore,
    private readonly provider: SpecPublicationProvider,
  ) {}

  async status(actor: ActorContext, publicationId: string): Promise<SpecPublication> {
    const publication = await this.mustPublication(publicationId);
    this.requirePublicationManager(actor, publication);
    return publication;
  }

  async request(actor: ActorContext, input: {
    documentId: string; revisionId: string; reviewId: string; idempotencyKey: string;
  }): Promise<SpecPublication> {
    if (!this.store.create) throw new Error("Publication store does not support create");
    if (!input.idempotencyKey) throw new Error("idempotencyKey is required");
    const requestDigest = createHash("sha256").update(JSON.stringify({
      documentId: input.documentId, revisionId: input.revisionId, reviewId: input.reviewId,
    })).digest("hex");
    const existing = await this.store.getByRequest(actor.actorId, input.idempotencyKey);
    if (existing) {
      if (existing.requestDigest !== requestDigest) {
        throw new SharedSpecDomainError("IDEMPOTENCY_MISMATCH", "Publication idempotency key was reused with a different request");
      }
      return existing;
    }
    const approved = await this.core.exportApprovedBytes(input.documentId, input.revisionId);
    if (approved.review.id !== input.reviewId) {
      throw new Error("Publication must reference the exact approved revision");
    }
    const prepared = await this.provider.prepare({
      documentId: input.documentId, revisionId: input.revisionId, reviewId: input.reviewId,
      contentHash: approved.revision.contentHash, repository: approved.document.repository,
      destinationPath: approved.document.gitPath,
    });
    const publication: SpecPublication = {
      ...input, ...prepared, contentHash: approved.revision.contentHash,
      id: randomUUID(), state: "requested", requestedByActorId: actor.actorId, requestDigest,
    };
    try {
      await this.store.create(publication);
    } catch (error) {
      // The database unique key is the race-safe authority. Re-read it rather
      // than allowing two concurrent requests to become two publications.
      const raced = await this.store.getByRequest(actor.actorId, input.idempotencyKey);
      if (!raced) throw error;
      if (raced.requestDigest !== requestDigest) {
        throw new SharedSpecDomainError("IDEMPOTENCY_MISMATCH", "Publication idempotency key was reused with a different request");
      }
      return raced;
    }
    await this.store.appendAttempt({ publicationId: publication.id, operation: "request", outcome: "started" });
    return publication;
  }

  async publish(actor: ActorContext, publicationId: string): Promise<SpecPublication> {
    const publication = await this.mustPublication(publicationId);
    this.requirePublicationManager(actor, publication);
    if (publication.state === "merged" || publication.state === "open") return publication;
    const approved = await this.core.exportApprovedBytes(publication.documentId, publication.revisionId);
    if (approved.review.id !== publication.reviewId || approved.revision.contentHash !== publication.contentHash ||
      hashSharedSpecMarkdown(approved.bytes.toString("utf8")) !== publication.contentHash) {
      throw new Error("Publication no longer matches the approved immutable revision");
    }
    await this.store.appendAttempt({ publicationId, operation: "publish", outcome: "started" });
    const creating = { ...publication, state: "creating" as const, lastError: undefined };
    await this.store.update(creating);
    try {
      const result = await this.provider.publish({ ...creating, bytes: approved.bytes });
      const open = { ...creating, state: "open" as const, ...result };
      await this.store.update(open);
      await this.store.appendAttempt({ publicationId, operation: "publish", outcome: "succeeded", responseMetadata: { pullRequestNumber: result.pullRequestNumber } });
      return open;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const state: SpecPublicationState = /drift|conflict/i.test(message) ? "conflict" : "failed";
      const failed = { ...creating, state, lastError: message };
      await this.store.update(failed);
      await this.store.appendAttempt({ publicationId, operation: "publish", outcome: state === "conflict" ? "conflict" : "failed", errorDetail: message });
      return failed;
    }
  }

  async reconcile(actor: ActorContext, publicationId: string): Promise<SpecPublication> {
    const publication = await this.mustPublication(publicationId);
    this.requirePublicationManager(actor, publication);
    const resolved = await this.provider.reconcile(publication);
    const updated = { ...publication, ...resolved };
    await this.store.update(updated);
    await this.store.appendAttempt({ publicationId, operation: "reconcile", outcome: "succeeded", responseMetadata: { state: updated.state } });
    return updated;
  }

  private async mustPublication(id: string): Promise<SpecPublication> {
    const publication = await this.store.get(id);
    if (!publication) throw new Error(`Publication not found: ${id}`);
    return publication;
  }
  private requirePublicationManager(actor: ActorContext, publication: SpecPublication): void {
    if (actor.actorId !== publication.requestedByActorId && !actor.capabilities?.includes("policy_admin")) {
      throw new Error("Only the publication requester or a policy administrator may manage it");
    }
  }
}