// Task 1612: docs/coordination-clients.md and docs/shared-agent-instructions.md
// kept receiving ordinary git commits after their Sep 21 2026 seeding
// (see seed-live-instruction-documents.ts), without ever going through the
// shared-spec review ceremony (markRevisionReady -> claimReview ->
// approveReview). shared-spec's own record of each document's "current"
// (approved) revision drifted arbitrarily far behind the real git file as a
// result. See docs/superpowers/specs/2026-09-21-shared-docs-db-canonical-design.md's
// "Live-instruction-document drift" addendum, and the drift check in
// GitWorkingTreeLiveSyncProvider.syncExclusive() (shared-spec-live-sync.ts)
// that this script's captured revisions exist to satisfy: once this script
// runs, a real future review on either document starts from a base that
// actually matches the working tree, and the drift check no longer refuses
// every legitimate approve/resync attempt on these two documents forever.
//
// Same status-quo-capture bypass technique as the original Sep 21 seeding:
// directly appends a revision holding the file's *current* content, then
// writes an "approved" review and flips the document to "approved" through a
// single repository transaction, skipping ready/claim/approve. This is a
// narrow, one-off script technique -- never a general shared-spec CLI/HTTP
// "auto-approve" capability. See seed-live-instruction-documents.ts's own
// header for the same rule stated for the original seed. This script never
// writes to git; the git file is already the correct, current content being
// captured, so there is nothing for GitWorkingTreeLiveSyncProvider to do here.
//
// Idempotent and safe to re-run: a document whose current revision's content
// already matches the git file, and whose state is already "approved", is
// left untouched. Refuses to touch a document with a `ready_for_review`
// state -- that means a real reviewer-ceremony revision is already in
// flight, and this script must never override an active human decision.
//
// Usage:
//   npx tsx server/scripts/reconcile-live-instruction-document-drift.ts --dry-run
//   npx tsx server/scripts/reconcile-live-instruction-document-drift.ts

import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { closeDbConnections, getSharedDb } from "../db";
import { SharedSpecCore, hashSharedSpecMarkdown, type SharedSpecReview } from "../services/shared-spec-core";
import { PostgresSharedSpecRepository } from "../services/shared-spec-postgres-repository";
import { isDirectCliInvocation } from "./lib/cli-entrypoint";

const DRY_RUN = process.argv.includes("--dry-run");

// Must match SHARED_SPEC_GITHUB_REPOSITORY / seed-live-instruction-documents.ts.
const REPOSITORY = "davidwmcintosh/HolaHola";
const ACTOR = "coordination-system";

const GIT_PATHS = [
  "docs/shared-agent-instructions.md",
  "docs/coordination-clients.md",
] as const;

const RATIONALE =
  'Task 1612 drift reconciliation: this document\'s shared-spec "current" ' +
  "revision had fallen behind its actual git-tracked content because ordinary " +
  "commits landed on this path outside the review ceremony. This revision " +
  "captures the file's real current content, mirroring the same status-quo-" +
  "capture pattern used by the original Sep 21 2026 seeding " +
  "(seed-live-instruction-documents.ts); it was not independently reviewed.";

async function main(): Promise<void> {
  const root = resolve(import.meta.dirname, "../..");
  const repository = new PostgresSharedSpecRepository(getSharedDb());
  const core = new SharedSpecCore(repository);

  for (const gitPath of GIT_PATHS) {
    const found = await core.findByDestination(REPOSITORY, gitPath);
    if (!found) {
      console.log(`SKIP  ${gitPath}: no shared-spec document found for this destination`);
      continue;
    }
    const { document, currentRevision } = found;
    if (document.state === "ready_for_review") {
      console.log(`SKIP  ${gitPath}: document ${document.id} has a revision ready_for_review right now -- resolve that review first; this script never overrides an in-flight decision`);
      continue;
    }

    const gitContent = await readFile(resolve(root, gitPath), "utf8");
    const gitHash = hashSharedSpecMarkdown(gitContent);
    const contentAlreadyCaptured = gitHash === currentRevision.contentHash;

    if (contentAlreadyCaptured && document.state === "approved") {
      console.log(`OK    ${gitPath}: already reconciled (revision ${currentRevision.id.slice(0, 8)} matches git, state=approved)`);
      continue;
    }

    console.log(
      `DRIFT ${gitPath}: document=${document.id} state=${document.state} currentRevision=${currentRevision.id.slice(0, 8)} ` +
      `(len=${currentRevision.markdown.length}, hash=${currentRevision.contentHash.slice(0, 12)}) vs git (len=${gitContent.length}, hash=${gitHash.slice(0, 12)})`,
    );
    if (DRY_RUN) {
      console.log(`      would ${contentAlreadyCaptured ? "mark the existing revision approved" : "append a new revision capturing the current git content"} and set state=approved`);
      continue;
    }

    // Resuming a prior partial run: the append already landed (its content
    // now matches git) but the review/state-flip below did not complete.
    // Reuse that revision instead of appending a second, identical one.
    const revision = contentAlreadyCaptured
      ? currentRevision
      : await core.appendRevision(
          { actorId: ACTOR },
          {
            documentId: document.id,
            baseRevisionId: currentRevision.id,
            markdown: gitContent,
            idempotencyKey: `task-1612-drift-reconciliation-v1:${gitPath}:${gitHash}`,
          },
        );

    const { document: documentAfterAppend } = await core.showDocument(document.id);
    const now = new Date();
    const idempotencyKey = `task-1612-drift-reconciliation-review-v1:${gitPath}:${gitHash}`;
    const review: SharedSpecReview = {
      id: randomUUID(),
      documentId: document.id,
      revisionId: revision.id,
      revisionContentHash: revision.contentHash,
      requestedByActorId: ACTOR,
      idempotencyKey,
      requestDigest: hashSharedSpecMarkdown(`${idempotencyKey}:${document.id}:${revision.id}`),
      state: "approved",
      rationale: RATIONALE,
      evidenceReferences: [],
      requestedAt: now,
      decidedAt: now,
      decisionActorId: ACTOR,
      // Deliberately left undefined (all-NULL branch of
      // shared_spec_reviews_decision_policy_snapshot): no real
      // reviewer-policy evaluation happened for this reconciliation capture.
    };

    await repository.transaction(async (tx) => {
      await tx.insertReview(review);
      await tx.updateDocument({ ...documentAfterAppend, state: "approved", updatedAt: now });
    });

    console.log(`FIXED ${gitPath}: document=${document.id} revision=${revision.id} review=${review.id} now state=approved`);
  }
}

// server/db.ts's pool sets idleTimeoutMillis but not allowExitOnIdle, so
// falling off the end without an explicit process.exit() would hold this
// one-shot process alive for up to two minutes after the real work is done.
// See .agents/memory/pg-pool-idle-timeout-ci-hang.md.
if (isDirectCliInvocation("reconcile-live-instruction-document-drift.ts")) {
  main()
    .then(async () => {
      await closeDbConnections();
      process.exit(0);
    })
    .catch(async (error) => {
      process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
      await closeDbConnections().catch(() => {});
      process.exit(1);
    });
}
