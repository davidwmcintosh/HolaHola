/**
 * The full effect of deciding a shared-spec review: the domain decision
 * itself (SharedSpecCore.approveReview/rejectReview), the review_decided
 * notification, and -- only on approval of a liveInstructionDocument -- the
 * git working-tree sync (see shared-spec-live-sync.ts).
 *
 * Extracted from shared-spec-routes.ts so there is exactly one
 * implementation of "what happens when a review is decided", callable from
 * any entry point (the HTTP API, and in-process tool callers such as Alden's
 * decide_shared_spec_review -- see alden-shared-spec-review.ts). A caller
 * that instead invokes core.approveReview/rejectReview directly gets the
 * domain state change but silently skips the notification and, for a
 * liveInstructionDocument, leaves the on-disk file stale even though the
 * document row now reads "approved" -- exactly the gap this module closes.
 *
 * Callers must pass the *same* notifications/liveSync instances the HTTP
 * routes use (see getHolaHolaSharedSpecNotificationSink/LiveSync in
 * hola-hola-shared-spec-bootstrap.ts), not freshly constructed ones:
 * GitWorkingTreeLiveSyncProvider serializes concurrent syncs to the same
 * gitPath only within a single instance (see its own concurrency note), so a
 * second instance would not be serialized against the first.
 */
import type { ActorContext, SharedSpecCore, SharedSpecReview } from "./shared-spec-core";
import type { SharedSpecNotificationSink } from "./shared-spec-notifications";
import type { LiveInstructionDocumentSyncProvider, LiveInstructionSyncResult } from "./shared-spec-live-sync";

export interface DecideSharedSpecReviewDeps {
  readonly core: SharedSpecCore;
  readonly notifications: SharedSpecNotificationSink;
  readonly liveSync?: LiveInstructionDocumentSyncProvider;
}

export interface DecideSharedSpecReviewInput {
  readonly reviewId: string;
  readonly decision: "approve" | "reject";
  readonly rationale?: string;
  readonly evidenceReferences?: readonly string[];
  readonly idempotencyKey: string;
}

export interface DecideSharedSpecReviewResult {
  readonly review: SharedSpecReview;
  readonly liveSync?: LiveInstructionSyncResult;
}

export async function decideSharedSpecReviewWithEffects(
  deps: DecideSharedSpecReviewDeps,
  actor: ActorContext,
  input: DecideSharedSpecReviewInput,
): Promise<DecideSharedSpecReviewResult> {
  const { core, notifications, liveSync } = deps;
  const review = await (input.decision === "approve"
    ? core.approveReview(actor, { reviewId: input.reviewId, rationale: input.rationale, evidenceReferences: input.evidenceReferences, idempotencyKey: input.idempotencyKey })
    : core.rejectReview(actor, { reviewId: input.reviewId, rationale: input.rationale, evidenceReferences: input.evidenceReferences, idempotencyKey: input.idempotencyKey }));
  const revision = await core.readRevision(review.revisionId);
  const delivery = await notifications.deliver({
    idempotencyKey: `shared-spec:review_decided:v2:${review.id}:${review.state}:${actor.actorId}`, kind: "review_decided",
    initiatingActorId: actor.actorId,
    documentId: review.documentId, revisionId: review.revisionId, contentHash: revision.contentHash,
    reviewId: review.id, recipientActorId: review.requestedByActorId,
    summary: `Shared spec review ${review.state}: ${review.documentId}/${review.revisionId}`,
  });
  if (delivery.state === "failed") throw new Error(`Shared-spec transition was stored but notification delivery failed: ${delivery.error}`);
  if (input.decision !== "approve") return { review };

  const { document } = await core.showDocument(review.documentId);
  if (!document.liveInstructionDocument) return { review };
  if (!liveSync) {
    console.error(`shared-spec live-sync: no provider configured for flagged document ${document.id} (${document.gitPath})`);
    return { review, liveSync: { state: "stale", reason: "Live-instruction-document sync is not configured on this host" } };
  }
  const revisions = await core.listRevisions(document.id);
  const revisionOrdinal = revisions.findIndex(item => item.id === revision.id) + 1 || revisions.length;
  const result = await liveSync.sync({
    documentId: document.id, title: document.title, repository: document.repository, gitPath: document.gitPath,
    markdown: revision.markdown, contentHash: revision.contentHash, revisionOrdinal,
    knownRevisionContentHashes: revisions.map(item => item.contentHash),
  });
  if (result.state === "stale") console.error(`shared-spec live-sync: ${document.gitPath} is stale -- ${result.reason}`);
  return { review, liveSync: result };
}
