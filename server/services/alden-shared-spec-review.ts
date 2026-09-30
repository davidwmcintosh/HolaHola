/**
 * In-process shared-spec review tools for Alden.
 *
 * Alden's run_shell tool is a strict whitelist (see docs/alden-steward-role-design.md)
 * and he has no generic HTTP/curl tool, so he can't drive shared-spec-cli.ts or the
 * shared-spec HTTP API the way Claude Code, Gemini Code, and Antigravity do. That left
 * a real gap: a review can be assigned to actor "alden" (shared_spec_reviewer_policies
 * already has an active reviewer row for him, granted 2026-09-11), but nothing let him
 * actually execute claimReview/approveReview/rejectReview under his own identity.
 * Neither David's nor Luca-Replit's actor context can substitute: SharedSpecCore
 * forbids a claim/decision by anyone other than the requested reviewer, and forbids an
 * author from reviewing their own revision.
 *
 * These functions are that missing execution path: a thin, direct call into
 * SharedSpecCore with actorId "alden", exposed as four Alden tools in
 * alden-functions.ts (list_shared_spec_reviews, read_shared_spec_review,
 * claim_shared_spec_review, decide_shared_spec_review). No new authority is
 * granted here -- the reviewer policy already exists; this just lets Alden
 * discover and exercise it himself, in-process, without a shell or HTTP
 * round-trip. Before list_shared_spec_reviews existed, Alden could only act
 * on a reviewId someone else handed him first (e.g. via a priority-task
 * message) -- he had no way to ask "what's waiting on me".
 */
import { randomUUID } from "node:crypto";
import { getSharedDb } from "../db";
import {
  SharedSpecCore,
  type ActorContext,
  type SharedSpecDocument,
  type SharedSpecReview,
  type SharedSpecRevision,
} from "./shared-spec-core";
import { PostgresSharedSpecRepository } from "./shared-spec-postgres-repository";
import { decideSharedSpecReviewWithEffects } from "./shared-spec-review-decision";
import {
  getHolaHolaSharedSpecNotificationSink,
  getHolaHolaSharedSpecLiveSync,
} from "../adapters/hola-hola-shared-spec-bootstrap";

const ALDEN_ACTOR: ActorContext = { actorId: "alden" };

let cachedCore: SharedSpecCore | undefined;
/**
 * Lazy singleton, distinct from the SharedSpecCore instance
 * hola-hola-shared-spec-bootstrap.ts hands to the HTTP routes (and from
 * alden-handoff-shared-spec.ts's own instance). Safe to have several: none of
 * them cache document/revision/review state -- every read and write goes
 * straight through PostgresSharedSpecRepository to Postgres, the only place
 * state actually lives.
 */
function getCore(): SharedSpecCore {
  if (!cachedCore) cachedCore = new SharedSpecCore(new PostgresSharedSpecRepository(getSharedDb()));
  return cachedCore;
}

export interface AldenReviewSnapshot {
  readonly review: SharedSpecReview;
  readonly document: SharedSpecDocument;
  readonly revision: SharedSpecRevision;
}

export interface AldenReviewQueueEntry {
  readonly review: SharedSpecReview;
  readonly document: SharedSpecDocument;
}

/**
 * Lists every review currently waiting on actor "alden": still pending, and
 * either assigned to him directly or already claimed by him, across every
 * document. This is the missing discovery step -- read/claim/decide above
 * all require a reviewId Alden previously had no way to find himself, short
 * of someone handing it to him (e.g. via a priority-task message).
 *
 * Deliberately returns each full document rather than just title/kind/path,
 * so callers (e.g. the list_shared_spec_reviews tool) can project down to
 * whatever subset they expose, the same way readAldenSharedSpecReview's
 * caller prunes its document down before returning it to Alden.
 */
export async function listAldenSharedSpecReviews(): Promise<readonly AldenReviewQueueEntry[]> {
  const core = getCore();
  const reviews = await core.listReviewsForReviewer(ALDEN_ACTOR.actorId);
  return Promise.all(reviews.map(async review => {
    const { document } = await core.showDocument(review.documentId);
    return { review, document };
  }));
}

/** Reads a review plus the document and full revision markdown it targets, so Alden can see what he's being asked to decide. */
export async function readAldenSharedSpecReview(reviewId: string): Promise<AldenReviewSnapshot> {
  const core = getCore();
  const review = await core.getReview(reviewId);
  const [{ document }, revision] = await Promise.all([
    core.showDocument(review.documentId),
    core.readRevision(review.revisionId),
  ]);
  return { review, document, revision };
}

/** Claims a pending review as actor "alden". Required before decideAldenSharedSpecReview will succeed. */
export async function claimAldenSharedSpecReview(reviewId: string): Promise<SharedSpecReview> {
  return getCore().claimReview(ALDEN_ACTOR, reviewId, randomUUID());
}

/**
 * Approves or rejects a review actor "alden" has already claimed.
 *
 * Goes through decideSharedSpecReviewWithEffects (not a bare
 * core.approveReview/rejectReview call) so an approval of a
 * liveInstructionDocument commits it to disk and the review_decided
 * notification fires, exactly as the HTTP API does -- see that module's
 * doc comment for why a bare domain call silently skips both.
 */
export async function decideAldenSharedSpecReview(input: {
  readonly reviewId: string;
  readonly decision: "approve" | "reject";
  readonly rationale: string;
  readonly evidenceReferences?: readonly string[];
}): Promise<SharedSpecReview> {
  const result = await decideSharedSpecReviewWithEffects(
    { core: getCore(), notifications: getHolaHolaSharedSpecNotificationSink(), liveSync: getHolaHolaSharedSpecLiveSync() },
    ALDEN_ACTOR,
    { reviewId: input.reviewId, decision: input.decision, rationale: input.rationale, evidenceReferences: input.evidenceReferences, idempotencyKey: randomUUID() },
  );
  return result.review;
}
