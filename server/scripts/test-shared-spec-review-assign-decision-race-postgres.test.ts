// Task 1664: task 1662 proved that claimReview's old write path -- read the
// review, check it's unclaimed, then write via PostgresSharedSpecRepository's
// plain unconditional UPDATE ... WHERE id = review.id -- let two concurrent
// claims both succeed, with the second silently overwriting the first. Two
// sibling methods in shared-spec-core.ts wrote reviews through that exact
// same plain tx.updateReview(updated) call, with no compare-and-set on the
// fields they change:
//
//   - assignReview: a policy_admin reassigns a review to a specific
//     reviewer, unconditionally clearing any existing claim. Two concurrent
//     assignReview calls against the same review could silently overwrite
//     each other with no error.
//   - decideReview (backing approveReview/rejectReview): checks
//     claimedReviewerActorId === actor.actorId before writing the decision.
//     Only the actor holding the claim can pass that check, so this is a
//     narrower, same-actor race (e.g. a rapid double-submit of
//     approve/reject with different idempotency keys) rather than a
//     two-different-actors race, but it is the identical non-atomic
//     read-check-write shape.
//
// Both are now guarded by dedicated compare-and-set methods
// (compareAndSetReviewAssignment, compareAndSetReviewDecision) mirroring
// compareAndSetReviewClaim's pattern. Just like that fix,
// InMemorySharedSpecRepository's transaction() fully serializes (see its
// class comment), so it cannot exhibit genuine cross-transaction
// interleaving -- only a real PostgreSQL database, where two transactions
// can each read the same row before either commits, can prove these guards
// actually close the races. This file is that proof, mirroring
// test-shared-spec-review-claim-race-postgres.test.ts's structure exactly.
//
// Requires a disposable Postgres database (SHARED_SPEC_TEST_* below) with the
// shared_spec_* migration already applied. Mirrors
// test-shared-spec-review-claim-race-postgres.test.ts's disposableTarget()
// gate exactly, including why getVerifiedCiDatabaseUrl() is checked before
// the dedicated SHARED_SPEC_TEST_DATABASE_* vars: it gives this file real-
// database coverage on every ordinary CI run (GitHub Actions' job-local
// CI_DATABASE_URL) as well as scripts/neon-branch.ts's migration gate, with
// no extra gate wiring beyond splicing this file into
// scripts/run-ci-test-steps.mjs and server/scripts/run-validation-suite.sh --
// scripts/neon-branch.ts's cmdGate() already sets the generic
// SHARED_SPEC_TEST_DATABASE_* env vars for any file using this pattern.
// See .agents/memory/replit-sandbox-process-quirks.md for how to stand up a
// throwaway instance to run this file directly.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { getVerifiedCiDatabaseUrl } from "../ci-database";
import { SharedSpecCore, SharedSpecDomainError, type ActorContext } from "../services/shared-spec-core";
import { PostgresSharedSpecRepository } from "../services/shared-spec-postgres-repository";

function disposableTarget(): string | undefined {
  const ci = getVerifiedCiDatabaseUrl();
  if (ci) return ci;
  const url = process.env.SHARED_SPEC_TEST_DATABASE_URL;
  if (!url) {
    if (process.env.SHARED_SPEC_REQUIRE_DATABASE_TESTS === "1") {
      throw new Error("SHARED_SPEC_TEST_DATABASE_URL is required by the migration gate");
    }
    return undefined;
  }
  if (process.env.SHARED_SPEC_TEST_DATABASE_DISPOSABLE !== "1") {
    throw new Error("SHARED_SPEC_TEST_DATABASE_DISPOSABLE=1 is required");
  }
  if (url === process.env.SHARED_SPEC_FORBIDDEN_SHARED_URL) {
    throw new Error("shared-spec review-assign/decision-race test refuses the shared Neon database");
  }
  return url;
}

// Mirrors the identical self-check in
// test-shared-spec-review-claim-race-postgres.test.ts -- without this, a
// quietly-deleted gate branch would make every test below skip silently
// forever, defeating the whole point of proving these races against a real
// database.
const OWN_SOURCE = readFileSync(fileURLToPath(import.meta.url), "utf8");
test("this file hard-fails under the gate instead of silently skipping DB coverage", () => {
  assert.ok(OWN_SOURCE.includes('SHARED_SPEC_REQUIRE_DATABASE_TESTS === "1"'));
  assert.ok(OWN_SOURCE.includes("SHARED_SPEC_FORBIDDEN_SHARED_URL"));
  assert.ok(OWN_SOURCE.includes("context.skip("));
});

test("two concurrent assignReview reassignments of the same pending review against real PostgreSQL yield exactly one success and one clean rejection", async (context) => {
  const url = disposableTarget();
  if (!url) {
    context.skip("set SHARED_SPEC_TEST_DATABASE_URL and SHARED_SPEC_TEST_DATABASE_DISPOSABLE=1");
    return;
  }

  const pool = new Pool({ connectionString: url });
  try {
    const db = drizzle(pool, { schema });
    const core = new SharedSpecCore(new PostgresSharedSpecRepository(db));
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const admin: ActorContext = { actorId: `assign-race-admin-${suffix}`, capabilities: ["policy_admin"] };
    const author: ActorContext = { actorId: `assign-race-author-${suffix}` };
    const reviewerY: ActorContext = { actorId: `assign-race-reviewer-y-${suffix}` };
    const reviewerZ: ActorContext = { actorId: `assign-race-reviewer-z-${suffix}` };

    await core.setReviewerPolicy(admin, { actorId: reviewerY.actorId, capability: "reviewer", active: true, idempotencyKey: `y-on-${suffix}` });
    await core.setReviewerPolicy(admin, { actorId: reviewerZ.actorId, capability: "reviewer", active: true, idempotencyKey: `z-on-${suffix}` });

    // Ten independent reviews, each raced separately -- see the identical
    // rationale in test-shared-spec-review-claim-race-postgres.test.ts: a
    // race can happen to resolve without truly overlapping reads if one
    // connection's round trip is scheduled a little ahead of the other's,
    // which would make a single-attempt assertion pass for the wrong reason.
    const outcomes: Array<{ fulfilled: number; rejected: number; codes: string[]; winnerReviewerId: string | undefined; dbReviewerId: string | undefined }> = [];
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const attemptSuffix = `${suffix}-${attempt}`;
      const attemptDoc = await core.createDocument(author, {
        title: `Assign race attempt ${attempt}`, kind: "design", repository: "hola/hola",
        gitPath: `docs/superpowers/specs/assign-race-attempt-${attemptSuffix}.md`, markdown: "# Assign race attempt\n",
        idempotencyKey: `create-attempt-${attemptSuffix}`,
      });
      const attemptReview = await core.markRevisionReady(author, {
        documentId: attemptDoc.document.id, revisionId: attemptDoc.revision.id, idempotencyKey: `ready-attempt-${attemptSuffix}`,
      });

      const results = await Promise.allSettled([
        core.assignReview(admin, attemptReview.id, reviewerY.actorId, `assign-y-${attemptSuffix}`),
        core.assignReview(admin, attemptReview.id, reviewerZ.actorId, `assign-z-${attemptSuffix}`),
      ]);
      const fulfilled = results.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof core.assignReview>>> => result.status === "fulfilled");
      const rejected = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
      const finalReview = await core.getReview(attemptReview.id);
      outcomes.push({
        fulfilled: fulfilled.length,
        rejected: rejected.length,
        codes: rejected.map(result => (result.reason as SharedSpecDomainError)?.code ?? String(result.reason)),
        winnerReviewerId: fulfilled[0]?.value.requestedReviewerActorId,
        dbReviewerId: finalReview.requestedReviewerActorId,
      });
    }

    for (const outcome of outcomes) {
      assert.equal(outcome.fulfilled, 1, `expected exactly one winner, got ${JSON.stringify(outcome)}`);
      assert.equal(outcome.rejected, 1, `expected exactly one rejection, got ${JSON.stringify(outcome)}`);
      // assignReview's own pre-check only looks at review.state, which
      // neither concurrent call changes, so the loser always reaches the
      // compare-and-set guard rather than being turned away earlier -- the
      // rejection code is deterministically CONFLICT, unlike the claim race
      // test where the loser can also be caught by claimReview's own
      // pre-check (INVALID_STATE).
      assert.ok(
        outcome.codes.every(code => code === "CONFLICT"),
        `rejection must be a clean CONFLICT SharedSpecDomainError, got ${JSON.stringify(outcome)}`,
      );
      // The decisive check: the row actually persisted in PostgreSQL must
      // name the same reviewer assignReview reported as the winner. Before
      // the fix, both calls could fulfill and the DB-persisted reviewer
      // could differ from what one of the "successful" callers was told.
      assert.equal(outcome.dbReviewerId, outcome.winnerReviewerId, `DB-persisted assignee must match the reported winner, got ${JSON.stringify(outcome)}`);
    }
  } finally {
    await pool.end();
  }
});

test("two concurrent decisions from the same claiming actor with different idempotency keys against real PostgreSQL yield exactly one success and one clean rejection", async (context) => {
  const url = disposableTarget();
  if (!url) {
    context.skip("set SHARED_SPEC_TEST_DATABASE_URL and SHARED_SPEC_TEST_DATABASE_DISPOSABLE=1");
    return;
  }

  const pool = new Pool({ connectionString: url });
  try {
    const db = drizzle(pool, { schema });
    const core = new SharedSpecCore(new PostgresSharedSpecRepository(db));
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const admin: ActorContext = { actorId: `decide-race-admin-${suffix}`, capabilities: ["policy_admin"] };
    const author: ActorContext = { actorId: `decide-race-author-${suffix}` };
    const reviewer: ActorContext = { actorId: `decide-race-reviewer-${suffix}` };

    await core.setReviewerPolicy(admin, { actorId: reviewer.actorId, capability: "reviewer", active: true, idempotencyKey: `reviewer-on-${suffix}` });

    const outcomes: Array<{ fulfilled: number; rejected: number; codes: string[]; winnerState: string | undefined; dbReviewState: string | undefined; dbDocumentState: string | undefined }> = [];
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const attemptSuffix = `${suffix}-${attempt}`;
      const attemptDoc = await core.createDocument(author, {
        title: `Decide race attempt ${attempt}`, kind: "design", repository: "hola/hola",
        gitPath: `docs/superpowers/specs/decide-race-attempt-${attemptSuffix}.md`, markdown: "# Decide race attempt\n",
        idempotencyKey: `create-attempt-${attemptSuffix}`,
      });
      const attemptReview = await core.markRevisionReady(author, {
        documentId: attemptDoc.document.id, revisionId: attemptDoc.revision.id, idempotencyKey: `ready-attempt-${attemptSuffix}`,
      });
      // The claim itself is not part of the race -- only the two decisions
      // that follow it are, matching the task's "two concurrent decisions
      // from the claiming actor with different idempotency keys" scenario.
      await core.claimReview(reviewer, attemptReview.id, `claim-attempt-${attemptSuffix}`);

      const results = await Promise.allSettled([
        core.approveReview(reviewer, { reviewId: attemptReview.id, idempotencyKey: `approve-${attemptSuffix}` }),
        core.rejectReview(reviewer, { reviewId: attemptReview.id, idempotencyKey: `reject-${attemptSuffix}` }),
      ]);
      const fulfilled = results.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof core.approveReview>>> => result.status === "fulfilled");
      const rejected = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
      const finalReview = await core.getReview(attemptReview.id);
      const { document: finalDocument } = await core.showDocument(attemptDoc.document.id);
      outcomes.push({
        fulfilled: fulfilled.length,
        rejected: rejected.length,
        codes: rejected.map(result => (result.reason as SharedSpecDomainError)?.code ?? String(result.reason)),
        winnerState: fulfilled[0]?.value.state,
        dbReviewState: finalReview.state,
        dbDocumentState: finalDocument.state,
      });
    }

    for (const outcome of outcomes) {
      assert.equal(outcome.fulfilled, 1, `expected exactly one winner, got ${JSON.stringify(outcome)}`);
      assert.equal(outcome.rejected, 1, `expected exactly one rejection, got ${JSON.stringify(outcome)}`);
      // decideReview's own pre-check re-reads state and claimedReviewerActorId
      // together, so a loser that arrives after the winner has already
      // committed is turned away by that pre-check (FORBIDDEN) rather than by
      // the compare-and-set guard (CONFLICT) -- both are the clean domain
      // rejections this fix guarantees, mirroring the claim race test's
      // tolerance for either of claimReview's two clean rejection codes.
      assert.ok(
        outcome.codes.every(code => code === "CONFLICT" || code === "FORBIDDEN"),
        `rejection must be a clean SharedSpecDomainError (CONFLICT or FORBIDDEN), got ${JSON.stringify(outcome)}`,
      );
      // The decisive check: the row actually persisted in PostgreSQL, and the
      // document state it drives, must match the winner's decision. Before
      // the fix, both calls could fulfill and the DB-persisted state could
      // differ from what one of the "successful" callers was told.
      assert.equal(outcome.dbReviewState, outcome.winnerState, `DB-persisted review state must match the reported winner, got ${JSON.stringify(outcome)}`);
      assert.equal(outcome.dbDocumentState, outcome.winnerState === "approved" ? "approved" : "draft", `document state must reflect exactly the winning decision, got ${JSON.stringify(outcome)}`);
    }
  } finally {
    await pool.end();
  }
});
