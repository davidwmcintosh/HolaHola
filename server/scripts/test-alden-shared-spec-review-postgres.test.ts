/**
 * Integration coverage for Alden's OWN shared-spec review-decision entry
 * point (server/services/alden-shared-spec-review.ts) -- not the shared
 * wrapper it delegates to.
 *
 * Two existing tests already guard adjacent parts of this chain:
 *   - server/services/shared-spec-review-decision.test.ts proves
 *     decideSharedSpecReviewWithEffects itself (the wrapper) writes+commits
 *     a liveInstructionDocument and delivers a review_decided notification,
 *     against an InMemorySharedSpecRepository and a real temp git repo.
 *   - server/scripts/test-shared-spec-review-decision-bypass-guard.ts is a
 *     static guard: it fails if any code path outside that wrapper calls
 *     core.approveReview/rejectReview directly.
 * Neither one ever calls claimAldenSharedSpecReview/decideAldenSharedSpecReview
 * themselves, so neither would catch a bug specific to Alden's own wiring --
 * e.g. getCore()/getHolaHolaSharedSpecNotificationSink()/
 * getHolaHolaSharedSpecLiveSync() resolving to the wrong instance, the wrong
 * actor identity being threaded through, or a future edit to
 * alden-shared-spec-review.ts that still calls
 * decideSharedSpecReviewWithEffects but breaks how its arguments are built.
 * alden-shared-spec-review.ts is also the exact file responsible for the
 * original incident this whole chain defends against (an earlier version
 * called core.approveReview() directly, silently skipping the notification
 * and git sync) -- see that file's own header comment.
 *
 * This file exercises Alden's real exported functions end to end, through
 * his real production singletons: getCore() (backed by server/db.ts's
 * getSharedDb()), getHolaHolaSharedSpecNotificationSink(), and
 * getHolaHolaSharedSpecLiveSync() (the latter two from
 * server/adapters/hola-hola-shared-spec-bootstrap.ts) -- not hand-built
 * fakes. That requires a real Postgres database (the notification sink
 * writes a real coordination_events row) and a real git working tree
 * (getHolaHolaSharedSpecLiveSync() defaults to process.cwd()), so it lives
 * here as a *-postgres.test.ts file rather than inline alongside
 * alden-shared-spec-review.ts. See
 * .agents/memory/local-disposable-postgres-sandbox.md for how to stand up a
 * throwaway instance to run this file directly.
 */

import assert from "node:assert/strict";
import { execFile as callbackExecFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";
import * as schema from "@shared/schema";
import { SharedSpecCore } from "../services/shared-spec-core";
import { PostgresSharedSpecRepository } from "../services/shared-spec-postgres-repository";
import { getVerifiedCiDatabaseUrl } from "../ci-database";

const execFile = promisify(callbackExecFile);

// Checked first so this file gets real database coverage two independent
// ways: the ordinary consolidated CI cadence (GitHub Actions' job-local
// CI_DATABASE_URL, verified by getVerifiedCiDatabaseUrl -- reachable once
// this file is spliced into scripts/run-ci-test-steps.mjs, no schema
// migration required) and scripts/neon-branch.ts's migration-gate branch
// (which deletes CI from its child env and falls through to the
// ALDEN_SHARED_SPEC_REVIEW_TEST_DATABASE_URL branch below). Mirrors the
// identical dual-check in
// server/scripts/test-shared-spec-live-instruction-document-postgres.test.ts.
function disposableTarget(): string | undefined {
  const ci = getVerifiedCiDatabaseUrl();
  if (ci) return ci;
  const url = process.env.ALDEN_SHARED_SPEC_REVIEW_TEST_DATABASE_URL;
  if (!url) {
    if (process.env.ALDEN_SHARED_SPEC_REVIEW_REQUIRE_DATABASE_TESTS === "1") {
      throw new Error("ALDEN_SHARED_SPEC_REVIEW_TEST_DATABASE_URL is required by the migration gate");
    }
    return undefined;
  }
  if (process.env.ALDEN_SHARED_SPEC_REVIEW_TEST_DATABASE_DISPOSABLE !== "1") {
    throw new Error("ALDEN_SHARED_SPEC_REVIEW_TEST_DATABASE_DISPOSABLE=1 is required");
  }
  if (url === process.env.ALDEN_SHARED_SPEC_REVIEW_FORBIDDEN_SHARED_URL) {
    throw new Error("Alden shared-spec review-decision test refuses the shared Neon database");
  }
  return url;
}

const OWN_SOURCE = readFileSync(fileURLToPath(import.meta.url), "utf8");
test("this file hard-fails under the gate instead of silently skipping DB coverage", () => {
  assert.ok(OWN_SOURCE.includes('ALDEN_SHARED_SPEC_REVIEW_REQUIRE_DATABASE_TESTS === "1"'));
  assert.ok(OWN_SOURCE.includes("ALDEN_SHARED_SPEC_REVIEW_FORBIDDEN_SHARED_URL"));
  assert.ok(OWN_SOURCE.includes("context.skip("));
});

// Mirrors the identical self-check in
// server/scripts/test-shared-spec-live-instruction-document-postgres.test.ts
// -- without this, a deleted branchEnv wiring in cmdGate() would just make
// the test below skip silently inside the Neon migration gate.
const NEON_BRANCH_GATE_SOURCE = readFileSync("scripts/neon-branch.ts", "utf8");
test("scripts/neon-branch.ts still wires the Alden shared-spec review-decision gate env in cmdGate", () => {
  assert.match(NEON_BRANCH_GATE_SOURCE, /ALDEN_SHARED_SPEC_REVIEW_REQUIRE_DATABASE_TESTS: '1'/);
  assert.match(NEON_BRANCH_GATE_SOURCE, /ALDEN_SHARED_SPEC_REVIEW_TEST_DATABASE_URL: directUrl/);
  assert.match(NEON_BRANCH_GATE_SOURCE, /ALDEN_SHARED_SPEC_REVIEW_TEST_DATABASE_DISPOSABLE: '1'/);
});

async function makeRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "alden-shared-spec-review-"));
  await execFile("git", ["init", "-q"], { cwd: dir });
  await execFile("git", ["config", "user.email", "test@example.test"], { cwd: dir });
  await execFile("git", ["config", "user.name", "Test"], { cwd: dir });
  return dir;
}
async function commitCountFor(repo: string, gitPath: string): Promise<number> {
  const { stdout } = await execFile("git", ["log", "--oneline", "--", gitPath], { cwd: repo });
  return stdout.trim().split("\n").filter(Boolean).length;
}

test(
  "Alden's real decide-review entry point writes+commits the working-tree file and delivers a review_decided notification, through his own singleton wiring",
  async (context) => {
    const url = disposableTarget();
    if (!url) {
      context.skip("set ALDEN_SHARED_SPEC_REVIEW_TEST_DATABASE_URL and ALDEN_SHARED_SPEC_REVIEW_TEST_DATABASE_DISPOSABLE=1");
      return;
    }
    // getCore() inside alden-shared-spec-review.ts resolves its database
    // through server/db.ts's module-level `export const db = getDb()`,
    // evaluated the instant that module is first imported. Setting this
    // before the dynamic import below -- rather than trusting whatever the
    // ambient process env already holds -- is what actually points Alden's
    // real singleton at the disposable database instead of production.
    process.env.NEON_SHARED_DATABASE_URL = url;

    const originalCwd = process.cwd();
    const setupPool = new Pool({ connectionString: url });
    try {
      const setupDb = drizzle(setupPool, { schema });
      const core = new SharedSpecCore(new PostgresSharedSpecRepository(setupDb));

      const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      // The real "alden" reviewer policy (granted 2026-09-11, per
      // alden-shared-spec-review.ts's own header comment) lives only in the
      // shared production database, not this disposable one -- grant it
      // here exactly as the precedent tests grant "reviewer".
      await core.setReviewerPolicy({ actorId: "admin", capabilities: ["policy_admin"] }, {
        actorId: "alden", capability: "reviewer", active: true, idempotencyKey: `alden-reviewer-on-${suffix}`,
      });

      // GitWorkingTreeLiveSyncProvider treats a repository mismatch as a
      // non-throwing "stale" result (see shared-spec-live-sync.ts), so the
      // fixture must target whatever repository this host is actually
      // configured for, not a hardcoded placeholder.
      const repository = (process.env.SHARED_SPEC_GITHUB_REPOSITORY || "hola/hola").trim();
      const gitPath = `docs/superpowers/specs/alden-review-test-${suffix}.md`;
      const markdown = `# Alden Review Test ${suffix}\n\nContent Alden is approving through his own review tool.\n`;
      const created = await core.createDocument({ actorId: "luca-replit" }, {
        title: "Alden Review Test", kind: "architecture", repository, gitPath, markdown,
        liveInstructionDocument: true, idempotencyKey: `create-${suffix}`,
      });
      const review = await core.markRevisionReady({ actorId: "luca-replit" }, {
        documentId: created.document.id, revisionId: created.revision.id, idempotencyKey: `ready-${suffix}`,
      });

      // getHolaHolaSharedSpecLiveSync() defaults its GitWorkingTreeLiveSyncProvider
      // to process.cwd() (see hola-hola-shared-spec-bootstrap.ts) and caches
      // that instance for the rest of the process, so the chdir must land
      // before the very first call that can construct it.
      const repoDir = await makeRepo();
      process.chdir(repoDir);

      const alden = await import("../services/alden-shared-spec-review");
      const { closeDbConnections } = await import("../db");
      try {
        const claimed = await alden.claimAldenSharedSpecReview(review.id);
        assert.equal(claimed.claimedReviewerActorId, "alden");

        const decided = await alden.decideAldenSharedSpecReview({
          reviewId: review.id, decision: "approve", rationale: "Looks correct.", evidenceReferences: [`test:${suffix}`],
        });
        assert.equal(decided.state, "approved");
        assert.equal(decided.decisionActorId, "alden");

        // (1) The working-tree file was actually written AND committed by
        // Alden's real singleton wiring -- not just "some liveSync provider
        // was invoked", which a wrong or mocked instance could report
        // without anything landing on disk under his real repository root.
        const onDisk = await readFile(join(repoDir, gitPath), "utf8");
        assert.equal(onDisk, markdown);
        assert.equal(
          await commitCountFor(repoDir, gitPath), 1,
          "Alden's approval must commit the working-tree file exactly once",
        );

        // (2) The real notification sink singleton actually delivered a
        // review_decided coordination event -- queried directly from
        // Postgres, independent of decideAldenSharedSpecReview's return
        // value, so a wrongly-wired or silently-swallowed delivery can't
        // pass by coincidence.
        const expectedIdempotencyKey = `shared-spec:review_decided:v2:${decided.id}:${decided.state}:alden`;
        const delivered = await setupDb
          .select()
          .from(schema.coordinationEvents)
          .where(and(
            eq(schema.coordinationEvents.actor, "alden"),
            eq(schema.coordinationEvents.idempotencyKey, expectedIdempotencyKey),
          ));
        assert.equal(
          delivered.length, 1,
          "Alden's real notification sink singleton must have delivered exactly one review_decided coordination event",
        );
        assert.equal(delivered[0].recipientActor, "luca-replit");
      } finally {
        await closeDbConnections();
      }
    } finally {
      process.chdir(originalCwd);
      await setupPool.end();
    }
  },
);
