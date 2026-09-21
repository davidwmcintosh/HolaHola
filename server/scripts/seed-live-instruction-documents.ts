// One-off Phase 6 status-quo capture for the two live-instruction documents.
//
// See docs/superpowers/specs/2026-09-21-shared-docs-db-canonical-design.md
// ("Migration / seeding (day one)", step 4) and
// docs/superpowers/plans/2026-09-21-shared-docs-db-canonical-implementation-plan.md
// (Phase 6, step 3): shared-agent-instructions.md and coordination-clients.md
// become shared-spec documents (kind: architecture, liveInstructionDocument:
// true) with their current git-tracked content as revision 1, and that
// revision is marked approved directly here -- never by adding a "skip
// review" capability to shared-spec-core.ts or shared-spec-cli.ts. This is a
// one-time capture of content that already existed and was already the
// operating truth; every revision after this one goes through the normal
// independent-reviewer ceremony untouched (markRevisionReady -> claimReview
// -> approveReview).
//
// Safe to re-run: a destination that already has an active document is
// skipped rather than re-created or overwritten.

import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { closeDbConnections, getSharedDb } from "../db";
import { SharedSpecCore, hashSharedSpecMarkdown, type SharedSpecReview } from "../services/shared-spec-core";
import { PostgresSharedSpecRepository } from "../services/shared-spec-postgres-repository";

// Must match SHARED_SPEC_GITHUB_REPOSITORY: GitWorkingTreeLiveSyncProvider
// cross-checks a live-instruction document's stored repository against that
// env var before it will sync an approval to the working tree.
const REPOSITORY = "davidwmcintosh/HolaHola";
const ACTOR = "coordination-system";
// Scoped per target below (idempotency is keyed on scope+actor+key together;
// a shared literal here would make the second document's createDocument call
// collide with the first as an "idempotency key reused with a different
// request" error instead of creating a second, distinct document).
const idempotencyKeyFor = (gitPath: string): string => `phase-6-status-quo-capture-v1:${gitPath}`;
const RATIONALE =
  "Phase 6 status-quo capture: revision 1 mirrors this file's pre-existing " +
  "git-tracked content and was not independently reviewed. See " +
  "docs/superpowers/specs/2026-09-21-shared-docs-db-canonical-design.md " +
  '("Migration / seeding (day one)", step 4).';

const targets = [
  {
    title: "Shared Agent Instructions",
    gitPath: "docs/shared-agent-instructions.md",
    summary: "Durable instruction source shared by every hat (Replit Agent, Claude Code, Gemini, HolaHola runtime agents).",
  },
  {
    title: "Coordination clients",
    gitPath: "docs/coordination-clients.md",
    summary: "Coordinator V2 client, credential-broker, and coordination-ledger reference for every hat.",
  },
] as const;

async function main(): Promise<void> {
  const root = resolve(import.meta.dirname, "../..");
  const repository = new PostgresSharedSpecRepository(getSharedDb());
  const core = new SharedSpecCore(repository);

  for (const target of targets) {
    const existing = await core.findByDestination(REPOSITORY, target.gitPath);
    if (existing) {
      console.log(`SKIP  ${target.gitPath}: active document already exists (${existing.document.id}, state=${existing.document.state})`);
      continue;
    }

    const markdown = await readFile(resolve(root, target.gitPath), "utf8");
    const { document, revision } = await core.createDocument(
      { actorId: ACTOR },
      {
        title: target.title,
        summary: target.summary,
        kind: "architecture",
        repository: REPOSITORY,
        gitPath: target.gitPath,
        markdown,
        liveInstructionDocument: true,
        idempotencyKey: idempotencyKeyFor(target.gitPath),
      },
    );

    const now = new Date();
    const idempotencyKey = idempotencyKeyFor(target.gitPath);
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
      // reviewer-policy evaluation happened for this bootstrap capture.
    };

    await repository.transaction(async (tx) => {
      await tx.insertReview(review);
      await tx.updateDocument({ ...document, state: "approved", updatedAt: now });
    });

    console.log(`SEED  ${target.gitPath}: document=${document.id} revision=${revision.id} review=${review.id}`);
  }
}

// server/db.ts's pool sets idleTimeoutMillis but not allowExitOnIdle, so
// falling off the end without an explicit process.exit() would hold this
// one-shot process alive for up to two minutes after the real work is done.
// See .agents/memory/pg-pool-idle-timeout-ci-hang.md.
if (process.argv[1]?.includes("seed-live-instruction-documents")) {
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
