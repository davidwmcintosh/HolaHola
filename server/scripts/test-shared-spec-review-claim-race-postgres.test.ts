// Task 1662: task 1658's listReviewerQueue open_eligible case made a fully
// open pending review discoverable by every eligible reviewer at once, so two
// reviewers racing to claim the exact same review is now a realistic
// scenario, not just a hypothetical. claimReview (shared-spec-core.ts) reads
// the review, checks claimedReviewerActorId is unset, then writes the claim,
// all inside one DB transaction; PostgresSharedSpecRepository's updateReview
// used to do a plain unconditional UPDATE ... WHERE id = review.id, with no
// compare-and-set on claimedReviewerActorId or state -- unlike
// compareAndSetCurrentRevision's explicit CAS for revisions. Reproduced
// directly against this exact repository before the fix: two concurrent
// claimReview calls both returned success, with the second's write silently
// overwriting the first's committed claim (no error to either caller).
//
// server/services/shared-spec-core.test.ts already adds an in-memory mirror
// of this scenario, but InMemorySharedSpecRepository's transaction() fully
// serializes (see its class comment), so it cannot exhibit genuine
// cross-transaction interleaving -- its loser is always rejected by
// claimReview's own pre-check, never by reaching the CAS. Only a real
// PostgreSQL database, where two transactions can each read the row as
// unclaimed before either commits, can prove compareAndSetReviewClaim
// actually closes the race. This file is that proof.
//
// Requires a disposable Postgres database (SHARED_SPEC_TEST_* below) with the
// shared_spec_* migration already applied. Mirrors
// test-shared-spec-live-instruction-document-postgres.test.ts's
// disposableTarget() gate exactly, including why getVerifiedCiDatabaseUrl()
// is checked before the dedicated SHARED_SPEC_TEST_DATABASE_* vars: it gives
// this file real-database coverage on every ordinary CI run (GitHub Actions'
// job-local CI_DATABASE_URL) as well as scripts/neon-branch.ts's migration
// gate, with no extra gate wiring beyond splicing this file into
// scripts/run-ci-test-steps.mjs and server/scripts/run-validation-suite.sh --
// scripts/neon-branch.ts's cmdGate() already sets the generic
// SHARED_SPEC_TEST_DATABASE_* env vars for any file using this pattern (see
// test-alden-shared-spec-review-discovery.test.ts for the identical
// no-extra-wiring precedent).
// See .agents/memory/local-disposable-postgres-sandbox.md for how to stand up
// a throwaway instance to run this file directly.

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
    throw new Error("shared-spec review-claim-race test refuses the shared Neon database");
  }
  return url;
}

// Mirrors the identical self-check in
// test-shared-spec-live-instruction-document-postgres.test.ts and
// test-alden-shared-spec-review-discovery.test.ts -- without this, a
// quietly-deleted gate branch would make every test below skip silently
// forever, defeating the whole point of proving this race against a real
// database.
const OWN_SOURCE = readFileSync(fileURLToPath(import.meta.url), "utf8");
test("this file hard-fails under the gate instead of silently skipping DB coverage", () => {
  assert.ok(OWN_SOURCE.includes('SHARED_SPEC_REQUIRE_DATABASE_TESTS === "1"'));
  assert.ok(OWN_SOURCE.includes("SHARED_SPEC_FORBIDDEN_SHARED_URL"));
  assert.ok(OWN_SOURCE.includes("context.skip("));
});

test("two reviewers racing to claim the same open review against real PostgreSQL yield exactly one success and one clean rejection", async (context) => {
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
    const admin: ActorContext = { actorId: `claim-race-admin-${suffix}`, capabilities: ["policy_admin"] };
    const author: ActorContext = { actorId: `claim-race-author-${suffix}` };
    const reviewerA: ActorContext = { actorId: `claim-race-reviewer-a-${suffix}` };
    const reviewerB: ActorContext = { actorId: `claim-race-reviewer-b-${suffix}` };

    await core.setReviewerPolicy(admin, { actorId: reviewerA.actorId, capability: "reviewer", active: true, idempotencyKey: `a-on-${suffix}` });
    await core.setReviewerPolicy(admin, { actorId: reviewerB.actorId, capability: "reviewer", active: true, idempotencyKey: `b-on-${suffix}` });

    // Ten independent reviews, each raced separately (rather than trusting a
    // single attempt), because a race can happen to resolve without truly
    // overlapping reads if one connection's round trip is scheduled a little
    // ahead of the other's, which would make a single-attempt assertion pass
    // for the wrong reason. Before compareAndSetReviewClaim existed, running
    // this loop reliably produced at least one review with two fulfilled
    // claims and two different actors believing they held it -- the exact
    // incident this test guards against.
    const outcomes: Array<{ fulfilled: number; rejected: number; codes: string[]; winnerActorId: string | undefined; dbActorId: string | undefined }> = [];
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const attemptSuffix = `${suffix}-${attempt}`;
      const attemptDoc = await core.createDocument(author, {
        title: `Claim race attempt ${attempt}`, kind: "design", repository: "hola/hola",
        gitPath: `docs/superpowers/specs/claim-race-attempt-${attemptSuffix}.md`, markdown: "# Claim race attempt\n",
        idempotencyKey: `create-attempt-${attemptSuffix}`,
      });
      const attemptReview = await core.markRevisionReady(author, {
        documentId: attemptDoc.document.id, revisionId: attemptDoc.revision.id, idempotencyKey: `ready-attempt-${attemptSuffix}`,
      });

      const results = await Promise.allSettled([
        core.claimReview(reviewerA, attemptReview.id, `claim-a-${attemptSuffix}`),
        core.claimReview(reviewerB, attemptReview.id, `claim-b-${attemptSuffix}`),
      ]);
      const fulfilled = results.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof core.claimReview>>> => result.status === "fulfilled");
      const rejected = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
      const finalReview = await core.getReview(attemptReview.id);
      outcomes.push({
        fulfilled: fulfilled.length,
        rejected: rejected.length,
        codes: rejected.map(result => (result.reason as SharedSpecDomainError)?.code ?? String(result.reason)),
        winnerActorId: fulfilled[0]?.value.claimedReviewerActorId,
        dbActorId: finalReview.claimedReviewerActorId,
      });
    }

    for (const outcome of outcomes) {
      assert.equal(outcome.fulfilled, 1, `expected exactly one winner, got ${JSON.stringify(outcome)}`);
      assert.equal(outcome.rejected, 1, `expected exactly one rejection, got ${JSON.stringify(outcome)}`);
      assert.ok(
        outcome.codes.every(code => code === "CONFLICT" || code === "INVALID_STATE"),
        `rejection must be a clean SharedSpecDomainError (CONFLICT or INVALID_STATE), got ${JSON.stringify(outcome)}`,
      );
      // The decisive check: the row actually persisted in PostgreSQL must
      // name the same actor claimReview reported as the winner. Before the
      // fix, both calls could fulfill and the DB-persisted actor could differ
      // from what one of the "successful" callers was told.
      assert.equal(outcome.dbActorId, outcome.winnerActorId, `DB-persisted claimant must match the reported winner, got ${JSON.stringify(outcome)}`);
    }
  } finally {
    await pool.end();
  }
});
