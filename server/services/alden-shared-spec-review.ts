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
 * SharedSpecCore with actorId "alden", exposed as three Alden tools in
 * alden-functions.ts (read_shared_spec_review, claim_shared_spec_review,
 * decide_shared_spec_review). No new authority is granted here -- the reviewer
 * policy already exists; this just lets Alden exercise it himself, in-process,
 * without a shell or HTTP round-trip.
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
