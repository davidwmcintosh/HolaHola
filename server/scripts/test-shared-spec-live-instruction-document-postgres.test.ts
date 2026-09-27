// Full-stack integration coverage for the live-instruction-document sync
// path (Phase 8 of
// docs/superpowers/plans/2026-09-21-shared-docs-db-canonical-implementation-plan.md).
//
// Three existing test files each cover one link of this chain in isolation:
//   - shared-spec-core.test.ts: approval lifecycle against InMemorySharedSpecRepository.
//   - shared-spec-live-sync.test.ts: GitWorkingTreeLiveSyncProvider against a real git repo, called directly.
//   - shared-spec-routes.test.ts: the /reviews/:reviewId/approve route against InMemorySharedSpecRepository plus a fake liveSync stub.
// None of them prove the real PostgresSharedSpecRepository and the real
// GitWorkingTreeLiveSyncProvider work together through the actual route
// handler -- e.g. that approveReview()'s returned revision content is
// exactly what lands in the git working tree, end to end, with a real
// database in the loop. This file closes that gap.
//
// Requires a disposable Postgres database (SHARED_SPEC_TEST_* below) with
// the shared_spec_* migration already applied. See
// .agents/memory/local-disposable-postgres-sandbox.md for how to stand up a
// throwaway instance to run this file directly.

import assert from "node:assert/strict";
import { execFile as callbackExecFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { SharedSpecCore } from "../services/shared-spec-core";
import { PostgresSharedSpecRepository } from "../services/shared-spec-postgres-repository";
import { GitWorkingTreeLiveSyncProvider } from "../services/shared-spec-live-sync";
import { createSharedSpecRouter } from "../routes/shared-spec-routes";
import { getVerifiedCiDatabaseUrl } from "../ci-database";
import { type Router } from "express";

const execFile = promisify(callbackExecFile);

// Checked first so this file gets real database coverage two independent
// ways: the ordinary consolidated CI cadence (GitHub Actions' job-local
// CI_DATABASE_URL, verified by getVerifiedCiDatabaseUrl -- reachable once
// this file is spliced into scripts/run-ci-test-steps.mjs, no schema
// migration required) and scripts/neon-branch.ts's migration-gate branch
// (which deletes CI from its child env and falls through to the
// SHARED_SPEC_TEST_DATABASE_URL branch below). Mirrors the identical
// dual-check in server/services/release-cutover-attestation-service.test.ts.
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
    throw new Error("shared-spec live-instruction-document test refuses the shared Neon database");
  }
  return url;
}

const OWN_SOURCE = readFileSync(fileURLToPath(import.meta.url), "utf8");
test("this file hard-fails under the gate instead of silently skipping DB coverage", () => {
  assert.ok(OWN_SOURCE.includes('SHARED_SPEC_REQUIRE_DATABASE_TESTS === "1"'));
  assert.ok(OWN_SOURCE.includes("SHARED_SPEC_FORBIDDEN_SHARED_URL"));
  assert.ok(OWN_SOURCE.includes("context.skip("));
});

// Mirrors the identical self-check in
// server/scripts/test-coordination-runtime-postgres-repository.test.ts --
// without this, a deleted branchEnv wiring in cmdGate() would just make
// every test below skip silently inside the Neon migration gate.
const NEON_BRANCH_GATE_SOURCE = readFileSync("scripts/neon-branch.ts", "utf8");
test("scripts/neon-branch.ts still wires the shared-spec live-instruction-document gate env in cmdGate", () => {
  assert.match(NEON_BRANCH_GATE_SOURCE, /SHARED_SPEC_REQUIRE_DATABASE_TESTS: '1'/);
  assert.match(NEON_BRANCH_GATE_SOURCE, /SHARED_SPEC_TEST_DATABASE_URL: directUrl/);
  assert.match(NEON_BRANCH_GATE_SOURCE, /SHARED_SPEC_TEST_DATABASE_DISPOSABLE: '1'/);
});

async function makeRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "shared-spec-live-instruction-doc-"));
  await execFile("git", ["init", "-q"], { cwd: dir });
  await execFile("git", ["config", "user.email", "test@example.test"], { cwd: dir });
  await execFile("git", ["config", "user.name", "Test"], { cwd: dir });
  await writeFile(join(dir, "README.md"), "seed\n", "utf8");
  await execFile("git", ["add", "README.md"], { cwd: dir });
  await execFile("git", ["commit", "-q", "-m", "seed"], { cwd: dir });
  return dir;
}
async function commitCount(repo: string): Promise<number> {
  const { stdout } = await execFile("git", ["log", "--oneline"], { cwd: repo });
  return stdout.trim().split("\n").filter(Boolean).length;
}

/** Pulls out the real registered Express handler, mirroring shared-spec-routes.test.ts's findHandler(). */
function findHandler(router: Router, method: "get" | "post", path: string): (request: any, response: any) => Promise<void> | void {
  const layer = (router as any).stack.find((entry: any) => entry.route?.path === path && entry.route?.methods?.[method]);
  if (!layer) throw new Error(`No ${method.toUpperCase()} ${path} handler registered`);
  return layer.route.stack[0].handle;
}
function fakeResponse() {
  const state: { statusCode: number; body: unknown } = { statusCode: 200, body: undefined };
  const response: any = {
    status(code: number) { state.statusCode = code; return response; },
    json(body: unknown) { state.body = body; return response; },
  };
  return { response, state };
}
const fakeRequest = (params: Record<string, string>, body: Record<string, unknown> = {}) => ({ params, body, header: () => undefined }) as any;

test("approving a flagged live-instruction document, through the real route handler with a real Postgres repository, commits the approved markdown to a real git working tree", async (context) => {
  const url = disposableTarget();
  if (!url) {
    context.skip("set SHARED_SPEC_TEST_DATABASE_URL and SHARED_SPEC_TEST_DATABASE_DISPOSABLE=1");
    return;
  }

  const pool = new Pool({ connectionString: url });
  try {
    const db = drizzle(pool, { schema });
    const core = new SharedSpecCore(new PostgresSharedSpecRepository(db));
    const repoDir = await makeRepo();
    const liveSync = new GitWorkingTreeLiveSyncProvider({ rootDir: repoDir });
    const router = createSharedSpecRouter({ core, authenticator: { authenticate: async () => ({ actorId: "reviewer" }) }, liveSync });

    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    await core.setReviewerPolicy({ actorId: "admin", capabilities: ["policy_admin"] }, {
      actorId: "reviewer", capability: "reviewer", active: true, idempotencyKey: `reviewer-on-${suffix}`,
    });

    // ----- Case 1: a document flagged liveInstructionDocument: true -----
    const gitPath = `docs/superpowers/specs/live-integration-test-${suffix}.md`;
    const markdown = `# Live Integration Test ${suffix}\n\nApproved content that must land verbatim in git.\n`;
    const created = await core.createDocument({ actorId: "author" }, {
      title: "Live Integration Test", kind: "architecture", repository: "hola/hola", gitPath, markdown,
      liveInstructionDocument: true, idempotencyKey: `create-flagged-${suffix}`,
    });
    const review = await core.markRevisionReady({ actorId: "author" }, {
      documentId: created.document.id, revisionId: created.revision.id, idempotencyKey: `ready-flagged-${suffix}`,
    });
    await core.claimReview({ actorId: "reviewer" }, review.id, `claim-flagged-${suffix}`);

    const commitsBeforeApprove = await commitCount(repoDir);
    const { response, state } = fakeResponse();
    await findHandler(router, "post", "/reviews/:reviewId/approve")(
      fakeRequest({ reviewId: review.id }, { idempotencyKey: `approve-flagged-${suffix}` }), response,
    );
    assert.equal(state.statusCode, 200, JSON.stringify(state.body));
    assert.equal((state.body as any).liveSync.state, "synced");
    assert.equal((state.body as any).liveSync.commitCreated, true);
    assert.equal(await commitCount(repoDir), commitsBeforeApprove + 1, "approving a flagged document must create exactly one new commit");
    assert.equal(await readFile(join(repoDir, gitPath), "utf8"), markdown, "the git working tree must hold the exact approved markdown");

    const { document: documentAfterApproval } = await core.showDocument(created.document.id);
    assert.equal(documentAfterApproval.state, "approved");
    assert.equal(documentAfterApproval.currentRevisionId, created.revision.id);

    // ----- Case 2: an otherwise-identical document without the flag must never touch git -----
    const unflaggedGitPath = `docs/superpowers/specs/unflagged-integration-test-${suffix}.md`;
    const createdUnflagged = await core.createDocument({ actorId: "author" }, {
      title: "Unflagged Integration Test", kind: "architecture", repository: "hola/hola", gitPath: unflaggedGitPath,
      markdown: "# Not live\n", idempotencyKey: `create-unflagged-${suffix}`,
    });
    const reviewUnflagged = await core.markRevisionReady({ actorId: "author" }, {
      documentId: createdUnflagged.document.id, revisionId: createdUnflagged.revision.id, idempotencyKey: `ready-unflagged-${suffix}`,
    });
    await core.claimReview({ actorId: "reviewer" }, reviewUnflagged.id, `claim-unflagged-${suffix}`);

    const commitsBeforeUnflagged = await commitCount(repoDir);
    const { response: unflaggedResponse, state: unflaggedState } = fakeResponse();
    await findHandler(router, "post", "/reviews/:reviewId/approve")(
      fakeRequest({ reviewId: reviewUnflagged.id }, { idempotencyKey: `approve-unflagged-${suffix}` }), unflaggedResponse,
    );
    assert.equal(unflaggedState.statusCode, 200, JSON.stringify(unflaggedState.body));
    assert.equal((unflaggedState.body as any).liveSync, undefined, "an unflagged document's approval response must carry no liveSync result");
    assert.equal(await commitCount(repoDir), commitsBeforeUnflagged, "approving an unflagged document must never touch the git working tree");
  } finally {
    await pool.end();
  }
});

// Regression coverage for task 1612: docs/coordination-clients.md and
// docs/shared-agent-instructions.md kept receiving ordinary git commits after
// their Sep 21 2026 seeding, without ever going through markRevisionReady ->
// claimReview -> approveReview. Nothing in the domain layer notices this --
// approveReview() only checks that the *revision* it is deciding is still the
// document's current one, never that the git working tree still matches the
// revision the new one was based on. Before the drift check in
// GitWorkingTreeLiveSyncProvider, finishing the review ceremony on a stale
// base silently discarded every intervening ordinary commit with no conflict
// and no warning. This test reproduces exactly that sequence end to end.
test("approving a revision built on a stale base reports staleness instead of silently discarding ordinary git commits made in between", async (context) => {
  const url = disposableTarget();
  if (!url) {
    context.skip("set SHARED_SPEC_TEST_DATABASE_URL and SHARED_SPEC_TEST_DATABASE_DISPOSABLE=1");
    return;
  }

  const pool = new Pool({ connectionString: url });
  try {
    const db = drizzle(pool, { schema });
    const core = new SharedSpecCore(new PostgresSharedSpecRepository(db));
    const repoDir = await makeRepo();
    const liveSync = new GitWorkingTreeLiveSyncProvider({ rootDir: repoDir });
    const router = createSharedSpecRouter({ core, authenticator: { authenticate: async () => ({ actorId: "reviewer" }) }, liveSync });

    const suffix = `stale-base-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    await core.setReviewerPolicy({ actorId: "admin", capabilities: ["policy_admin"] }, {
      actorId: "reviewer", capability: "reviewer", active: true, idempotencyKey: `reviewer-on-${suffix}`,
    });

    const gitPath = `docs/superpowers/specs/stale-base-test-${suffix}.md`;
    const revision1Markdown = `# Stale Base Test ${suffix}\n\nRevision 1.\n`;
    const created = await core.createDocument({ actorId: "author" }, {
      title: "Stale Base Test", kind: "architecture", repository: "hola/hola", gitPath, markdown: revision1Markdown,
      liveInstructionDocument: true, idempotencyKey: `create-${suffix}`,
    });
    const review1 = await core.markRevisionReady({ actorId: "author" }, {
      documentId: created.document.id, revisionId: created.revision.id, idempotencyKey: `ready-1-${suffix}`,
    });
    await core.claimReview({ actorId: "reviewer" }, review1.id, `claim-1-${suffix}`);
    const { response: response1, state: state1 } = fakeResponse();
    await findHandler(router, "post", "/reviews/:reviewId/approve")(
      fakeRequest({ reviewId: review1.id }, { idempotencyKey: `approve-1-${suffix}` }), response1,
    );
    assert.equal((state1.body as any).liveSync.state, "synced", JSON.stringify(state1.body));
    assert.equal(await readFile(join(repoDir, gitPath), "utf8"), revision1Markdown);

    // An ordinary commit lands on the same path, exactly as it has 15 times
    // over for the real coordination-clients.md -- never through shared-spec.
    const outOfBandMarkdown = `${revision1Markdown}\nAn ordinary edit that never went through shared-spec.\n`;
    await writeFile(join(repoDir, gitPath), outOfBandMarkdown, "utf8");
    await execFile("git", ["add", "--", gitPath], { cwd: repoDir });
    await execFile("git", ["commit", "-q", "-m", "ordinary edit, bypassing shared-spec"], { cwd: repoDir });
    const commitsAfterDrift = await commitCount(repoDir);

    // A second revision is proposed and reviewed built on revision 1 -- its
    // author has no way to know the working tree already moved past it.
    const revision2Markdown = `# Stale Base Test ${suffix}\n\nRevision 2, unaware of the drift.\n`;
    const revision2 = await core.appendRevision({ actorId: "author" }, {
      documentId: created.document.id, baseRevisionId: created.revision.id, markdown: revision2Markdown, idempotencyKey: `append-2-${suffix}`,
    });
    const review2 = await core.markRevisionReady({ actorId: "author" }, {
      documentId: created.document.id, revisionId: revision2.id, idempotencyKey: `ready-2-${suffix}`,
    });
    await core.claimReview({ actorId: "reviewer" }, review2.id, `claim-2-${suffix}`);
    const { response: response2, state: state2 } = fakeResponse();
    await findHandler(router, "post", "/reviews/:reviewId/approve")(
      fakeRequest({ reviewId: review2.id }, { idempotencyKey: `approve-2-${suffix}` }), response2,
    );

    assert.equal(state2.statusCode, 200, JSON.stringify(state2.body));
    // The shared-spec-level approval itself still succeeds -- the DB is not
    // blocked by a filesystem problem, matching the documented error-handling
    // contract for a stale working tree.
    assert.equal((state2.body as any).state, "approved");
    const { document: documentAfterApproval2 } = await core.showDocument(created.document.id);
    assert.equal(documentAfterApproval2.currentRevisionId, revision2.id);
    // But the working tree must not have been touched: no new commit, and the
    // out-of-band content must survive byte-for-byte.
    assert.equal((state2.body as any).liveSync.state, "stale", JSON.stringify(state2.body));
    assert.match((state2.body as any).liveSync.reason, /does not match any revision shared-spec has recorded/);
    assert.equal(await commitCount(repoDir), commitsAfterDrift, "a stale-base approval must create no commit");
    assert.equal(
      await readFile(join(repoDir, gitPath), "utf8"), outOfBandMarkdown,
      "the ordinary, out-of-band edit must survive untouched instead of being silently overwritten by revision 2",
    );
  } finally {
    await pool.end();
  }
});

// /resync shares the exact same underlying GitWorkingTreeLiveSyncProvider.sync()
// call as approve, so it inherits the identical danger: it force-writes
// whatever shared-spec currently considers "the approved revision" over the
// working tree with no check that the working tree hasn't moved on since.
// Before the drift check, a resync call on a live-instruction document whose
// path had received ordinary commits since its last approval -- true of both
// real documents today -- would have silently erased them the moment anyone
// ran it, with no dirty-tree warning, because the committed drift looks
// identical to a clean checkout from resync's point of view.
test("resync refuses to overwrite ordinary git commits made since the last approved revision", async (context) => {
  const url = disposableTarget();
  if (!url) {
    context.skip("set SHARED_SPEC_TEST_DATABASE_URL and SHARED_SPEC_TEST_DATABASE_DISPOSABLE=1");
    return;
  }

  const pool = new Pool({ connectionString: url });
  try {
    const db = drizzle(pool, { schema });
    const core = new SharedSpecCore(new PostgresSharedSpecRepository(db));
    const repoDir = await makeRepo();
    const liveSync = new GitWorkingTreeLiveSyncProvider({ rootDir: repoDir });
    const router = createSharedSpecRouter({ core, authenticator: { authenticate: async () => ({ actorId: "reviewer" }) }, liveSync });

    const suffix = `resync-drift-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    await core.setReviewerPolicy({ actorId: "admin", capabilities: ["policy_admin"] }, {
      actorId: "reviewer", capability: "reviewer", active: true, idempotencyKey: `reviewer-on-${suffix}`,
    });

    const gitPath = `docs/superpowers/specs/resync-drift-test-${suffix}.md`;
    const revision1Markdown = `# Resync Drift Test ${suffix}\n\nRevision 1.\n`;
    const created = await core.createDocument({ actorId: "author" }, {
      title: "Resync Drift Test", kind: "architecture", repository: "hola/hola", gitPath, markdown: revision1Markdown,
      liveInstructionDocument: true, idempotencyKey: `create-${suffix}`,
    });
    const review1 = await core.markRevisionReady({ actorId: "author" }, {
      documentId: created.document.id, revisionId: created.revision.id, idempotencyKey: `ready-1-${suffix}`,
    });
    await core.claimReview({ actorId: "reviewer" }, review1.id, `claim-1-${suffix}`);
    const { response: approveResponse, state: approveState } = fakeResponse();
    await findHandler(router, "post", "/reviews/:reviewId/approve")(
      fakeRequest({ reviewId: review1.id }, { idempotencyKey: `approve-1-${suffix}` }), approveResponse,
    );
    assert.equal((approveState.body as any).liveSync.state, "synced", JSON.stringify(approveState.body));

    const outOfBandMarkdown = `${revision1Markdown}\nAn ordinary edit made after approval, never through shared-spec.\n`;
    await writeFile(join(repoDir, gitPath), outOfBandMarkdown, "utf8");
    await execFile("git", ["add", "--", gitPath], { cwd: repoDir });
    await execFile("git", ["commit", "-q", "-m", "ordinary edit after approval, bypassing shared-spec"], { cwd: repoDir });
    const commitsAfterDrift = await commitCount(repoDir);

    const { response: resyncResponse, state: resyncState } = fakeResponse();
    await findHandler(router, "post", "/documents/:documentId/resync")(fakeRequest({ documentId: created.document.id }), resyncResponse);

    assert.equal(resyncState.statusCode, 200, JSON.stringify(resyncState.body));
    assert.equal((resyncState.body as any).liveSync.state, "stale", JSON.stringify(resyncState.body));
    assert.match((resyncState.body as any).liveSync.reason, /does not match any revision shared-spec has recorded/);
    assert.equal(await commitCount(repoDir), commitsAfterDrift, "a stale resync must create no commit");
    assert.equal(
      await readFile(join(repoDir, gitPath), "utf8"), outOfBandMarkdown,
      "the ordinary, out-of-band edit must survive untouched instead of being silently overwritten by resync",
    );
  } finally {
    await pool.end();
  }
});
