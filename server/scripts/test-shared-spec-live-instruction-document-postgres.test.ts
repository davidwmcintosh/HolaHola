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
import { type Router } from "express";

const execFile = promisify(callbackExecFile);

function disposableTarget(): string | undefined {
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
