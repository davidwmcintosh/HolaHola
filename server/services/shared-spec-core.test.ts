import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemorySharedSpecRepository,
  SharedSpecCore,
  SharedSpecDomainError,
  hashSharedSpecMarkdown,
  type SharedSpecDocument,
  type SharedSpecRepository,
  type SharedSpecRevision,
} from "./shared-spec-core";

const author = { actorId: "author" };
const reviewer = { actorId: "reviewer" };
const admin = { actorId: "admin", capabilities: ["policy_admin"] as const };

async function setup() {
  let id = 0;
  const core = new SharedSpecCore(new InMemorySharedSpecRepository(), {
    newId: () => `id-${++id}`,
    now: () => new Date("2026-09-06T00:00:00.000Z"),
  });
  await core.setReviewerPolicy(admin, {
    actorId: reviewer.actorId, capability: "reviewer", active: true, idempotencyKey: "reviewer-on",
  });
  const created = await core.createDocument(author, {
    title: "Portable core", kind: "design", repository: "hola/hola",
    gitPath: "docs/superpowers/specs/portable.md", markdown: "# One\n",
    idempotencyKey: "create",
  });
  return { core, created };
}

test("compare-and-swap admits one concurrent append and leaves the loser non-mutating", async () => {
  const { core, created } = await setup();
  const results = await Promise.allSettled([
    core.appendRevision(author, { documentId: created.document.id, baseRevisionId: created.revision.id, markdown: "# Two\n", idempotencyKey: "first" }),
    core.appendRevision({ actorId: "other" }, { documentId: created.document.id, baseRevisionId: created.revision.id, markdown: "# Three\n", idempotencyKey: "second" }),
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
  assert.equal((rejected!.reason as SharedSpecDomainError).code, "CONFLICT");
  assert.equal((await core.listRevisions(created.document.id)).length, 2);
});

test("idempotency returns matching revision and rejects different request reuse", async () => {
  const { core, created } = await setup();
  const input = { documentId: created.document.id, baseRevisionId: created.revision.id, markdown: "# Two\n", idempotencyKey: "append" };
  const first = await core.appendRevision(author, input);
  assert.equal((await core.appendRevision(author, input)).id, first.id);
  await assert.rejects(
    () => core.appendRevision(author, { ...input, markdown: "# Different\n" }),
    (error: SharedSpecDomainError) => error.code === "IDEMPOTENCY_MISMATCH",
  );
});

test("authors cannot claim or approve their own revision", async () => {
  const { core, created } = await setup();
  const review = await core.markRevisionReady(author, {
    documentId: created.document.id, revisionId: created.revision.id, idempotencyKey: "ready",
  });
  await assert.rejects(
    () => core.claimReview(author, review.id, "self-claim"),
    (error: SharedSpecDomainError) => error.code === "FORBIDDEN",
  );
});

test("ready review retains its requester and exact mutation digest", async () => {
  const { core, created } = await setup();
  const review = await core.markRevisionReady(author, {
    documentId: created.document.id, revisionId: created.revision.id, idempotencyKey: "ready-requester",
  });
  assert.equal(review.requestedByActorId, author.actorId);
  assert.match(review.requestDigest, /^[0-9a-f]{64}$/);
  assert.equal(created.revision.requestDigest.length, 64);
});

test("creation only accepts canonical repository and safe spec namespace", async () => {
  const core = new SharedSpecCore(new InMemorySharedSpecRepository());
  const input = { title: "x", kind: "design" as const, repository: "owner/repo", gitPath: "docs/superpowers/specs/safe.md", markdown: "# x", idempotencyKey: "x" };
  await assert.rejects(() => core.createDocument(author, { ...input, repository: "owner/repo/extra" }), (error: SharedSpecDomainError) => error.code === "VALIDATION");
  await assert.rejects(() => core.createDocument(author, { ...input, gitPath: "docs/superpowers/specs/../unsafe.md" }), (error: SharedSpecDomainError) => error.code === "VALIDATION");
});

test("default identifiers remain unique across independent core instances", async () => {
  const first = new SharedSpecCore(new InMemorySharedSpecRepository());
  const second = new SharedSpecCore(new InMemorySharedSpecRepository());
  const input = {
    title: "Restart-safe identifiers",
    summary: "Confirms independent application processes cannot reuse document IDs.",
    kind: "architecture" as const,
    repository: "hola-hola/app",
    gitPath: "docs/superpowers/specs/restart-safe-identifiers.md",
    markdown: "# Restart-safe identifiers\n",
    idempotencyKey: "create",
  };
  const [left, right] = await Promise.all([
    first.createDocument(author, input),
    second.createDocument(author, input),
  ]);
  assert.notEqual(left.document.id, right.document.id);
  assert.match(left.document.id, /^[0-9a-f-]{36}$/);
  assert.match(right.document.id, /^[0-9a-f-]{36}$/);
});

test("approval changes only the current ready document and rejection restores draft", async () => {
  const { core, created } = await setup();
  const review = await core.markRevisionReady(author, { documentId: created.document.id, revisionId: created.revision.id, idempotencyKey: "ready-state" });
  await core.claimReview(reviewer, review.id, "claim-state");
  await core.rejectReview(reviewer, { reviewId: review.id, idempotencyKey: "reject-state" });
  assert.equal((await core.showDocument(created.document.id)).document.state, "draft");
  await assert.rejects(() => core.markRevisionReady(author, { documentId: created.document.id, revisionId: created.revision.id, idempotencyKey: "duplicate" }), (error: SharedSpecDomainError) => error.code === "CONFLICT");
  const revision = await core.appendRevision(author, { documentId: created.document.id, baseRevisionId: created.revision.id, markdown: "# revised", idempotencyKey: "revised" });
  const second = await core.markRevisionReady(author, { documentId: created.document.id, revisionId: revision.id, idempotencyKey: "ready-second" });
  await core.claimReview(reviewer, second.id, "claim-second");
  await core.approveReview(reviewer, { reviewId: second.id, idempotencyKey: "approve-state" });
  assert.equal((await core.showDocument(created.document.id)).document.state, "approved");
  await assert.rejects(() => core.markRevisionReady(author, { documentId: created.document.id, revisionId: revision.id, idempotencyKey: "after-approval" }), (error: SharedSpecDomainError) => error.code === "INVALID_STATE");
});

test("policy administration is separately authorized and approvals bind policy version", async () => {
  const { core, created } = await setup();
  await assert.rejects(
    () => core.setReviewerPolicy(author, { actorId: "new-reviewer", capability: "reviewer", active: true, idempotencyKey: "forbidden" }),
    (error: SharedSpecDomainError) => error.code === "FORBIDDEN",
  );
  const review = await core.markRevisionReady(author, {
    documentId: created.document.id, revisionId: created.revision.id, idempotencyKey: "ready",
  });
  await core.claimReview(reviewer, review.id, "claim");
  const approved = await core.approveReview(reviewer, { reviewId: review.id, rationale: "looks good", idempotencyKey: "approve" });
  assert.equal(approved.decisionPolicyVersion, 1);
  await core.setReviewerPolicy(admin, {
    actorId: reviewer.actorId, capability: "reviewer", active: false, idempotencyKey: "reviewer-off",
  });
  assert.equal(approved.decisionPolicyVersion, 1);
  assert.ok(approved.decisionPolicyVersionId);
});

test("historical approval and exact approved byte export survive later edits and policy removal", async () => {
  const { core, created } = await setup();
  const review = await core.markRevisionReady(author, {
    documentId: created.document.id, revisionId: created.revision.id, idempotencyKey: "ready",
  });
  await core.claimReview(reviewer, review.id, "claim");
  await core.approveReview(reviewer, { reviewId: review.id, idempotencyKey: "approve" });
  await core.appendRevision(author, {
    documentId: created.document.id, baseRevisionId: created.revision.id, markdown: "# Changed\n", idempotencyKey: "edit",
  });
  await core.setReviewerPolicy(admin, {
    actorId: reviewer.actorId, capability: "reviewer", active: false, idempotencyKey: "reviewer-off",
  });
  const exported = await core.exportApprovedBytes(created.document.id, created.revision.id);
  assert.deepEqual(exported.bytes, Buffer.from("# One\n", "utf8"));
  assert.equal(exported.revision.contentHash, hashSharedSpecMarkdown(exported.bytes.toString("utf8")));
});

test("share creates a note on first call, revises it on a matching base, and rejects a stale or missing base", async () => {
  const core = new SharedSpecCore(new InMemorySharedSpecRepository());
  const created = await core.shareDocument(author, {
    repository: "hola/hola", gitPath: "notes/finding.md", markdown: "# First\n", idempotencyKey: "share-1",
  });
  assert.equal(created.created, true);
  assert.equal(created.document.kind, "note");
  assert.equal(created.document.state, "draft");
  assert.equal(created.revision.parentRevisionId, undefined);

  const revised = await core.shareDocument({ actorId: "other-hat" }, {
    repository: "hola/hola", gitPath: "notes/finding.md", markdown: "# Second\n",
    baseRevisionId: created.revision.id, idempotencyKey: "share-2",
  });
  assert.equal(revised.created, false);
  assert.equal(revised.revision.parentRevisionId, created.revision.id);
  assert.equal((await core.findByDestination("hola/hola", "notes/finding.md"))?.currentRevision.id, revised.revision.id);

  await assert.rejects(
    () => core.shareDocument(author, { repository: "hola/hola", gitPath: "notes/finding.md", markdown: "# Stale\n", baseRevisionId: created.revision.id, idempotencyKey: "share-3" }),
    (error: SharedSpecDomainError) => error.code === "CONFLICT",
  );
  await assert.rejects(
    () => core.shareDocument(author, { repository: "hola/hola", gitPath: "notes/finding.md", markdown: "# Missing base\n", idempotencyKey: "share-4" }),
    (error: SharedSpecDomainError) => error.code === "CONFLICT",
  );
});

test("sharing without a title derives one from the path, and idempotent replay returns the exact same revision", async () => {
  const core = new SharedSpecCore(new InMemorySharedSpecRepository());
  const input = { repository: "hola/hola", gitPath: "notes/gate3-verifier-coprovisioning-gap.md", markdown: "# Finding\n", idempotencyKey: "share-once" };
  const first = await core.shareDocument(author, input);
  assert.equal(first.document.title, "gate3-verifier-coprovisioning-gap");
  const replay = await core.shareDocument(author, input);
  assert.equal(replay.revision.id, first.revision.id);
  assert.equal(replay.created, true);
  await assert.rejects(
    () => core.shareDocument(author, { ...input, markdown: "# Different\n" }),
    (error: SharedSpecDomainError) => error.code === "IDEMPOTENCY_MISMATCH",
  );
});

test("share only accepts the notes/ namespace, never the reviewed specs namespace", async () => {
  const core = new SharedSpecCore(new InMemorySharedSpecRepository());
  await assert.rejects(
    () => core.shareDocument(author, { repository: "hola/hola", gitPath: "docs/superpowers/specs/not-a-note.md", markdown: "# x\n", idempotencyKey: "bad-path" }),
    (error: SharedSpecDomainError) => error.code === "VALIDATION",
  );
});

test("a lost create race against a brand-new note path surfaces the same clean conflict as a lost revise race, never a raw database error", async () => {
  // The in-memory repository serializes transactions one at a time, so two
  // genuinely concurrent shareDocument calls can never both observe "nothing
  // here yet" the way two real database transactions can under read-committed
  // isolation. This repository shim forces that exact interleaving
  // deterministically: the first destination lookup inside shareDocument's
  // own transaction reports "not found" (as a real racing reader would), but
  // insertDocument then fails with the same low-level shape a real unique-
  // index violation carries, because a "winner" row already committed to the
  // underlying store first.
  const winner: SharedSpecDocument = {
    id: "winner-doc", title: "race", kind: "note", repository: "hola/hola", gitPath: "notes/race.md",
    currentRevisionId: "winner-rev", state: "draft", creatorActorId: "other-hat",
    createdAt: new Date("2026-09-06T00:00:00.000Z"), updatedAt: new Date("2026-09-06T00:00:00.000Z"),
  };
  const winnerRevision: SharedSpecRevision = {
    id: "winner-rev", documentId: "winner-doc", markdown: "# Winner\n", contentHash: hashSharedSpecMarkdown("# Winner\n"),
    authorActorId: "other-hat", idempotencyKey: "winner-key", requestDigest: "winner-digest",
    createdAt: new Date("2026-09-06T00:00:00.000Z"),
  };
  const inner = new InMemorySharedSpecRepository();
  await inner.transaction(async tx => { await tx.insertDocument(winner); await tx.insertRevision(winnerRevision); });
  let destinationLookups = 0;
  const racing: SharedSpecRepository = {
    transaction: work => inner.transaction(tx => work({
      ...tx,
      getDocumentByDestination: async (repository, gitPath) => {
        destinationLookups += 1;
        // Only the call made from inside shareDocument's own transaction (the
        // very first lookup) simulates the lost race; findByDestination's
        // later, separate re-read must see the real, already-committed row.
        return destinationLookups === 1 ? undefined : tx.getDocumentByDestination(repository, gitPath);
      },
      insertDocument: async () => {
        throw Object.assign(
          new Error('duplicate key value violates unique constraint "uq_shared_spec_documents_active_destination"'),
          { code: "23505", constraint: "uq_shared_spec_documents_active_destination" },
        );
      },
    })),
  };
  const core = new SharedSpecCore(racing);
  await assert.rejects(
    () => core.shareDocument(author, { repository: "hola/hola", gitPath: "notes/race.md", markdown: "# Loser\n", idempotencyKey: "loser-key" }),
    (error: SharedSpecDomainError) => error.code === "CONFLICT"
      && error.details.documentId === "winner-doc" && error.details.currentRevisionId === "winner-rev",
  );
  assert.equal((await core.findByDestination("hola/hola", "notes/race.md"))?.document.id, "winner-doc");
});

test("an unrelated database failure during share is never mistaken for a destination race", async () => {
  const racing: SharedSpecRepository = {
    transaction: work => new InMemorySharedSpecRepository().transaction(tx => work({
      ...tx,
      insertDocument: async () => { throw Object.assign(new Error("connection terminated unexpectedly"), { code: "57P01" }); },
    })),
  };
  const core = new SharedSpecCore(racing);
  await assert.rejects(
    () => core.shareDocument(author, { repository: "hola/hola", gitPath: "notes/unrelated-failure.md", markdown: "# x\n", idempotencyKey: "unrelated-1" }),
    (error: unknown) => !(error instanceof SharedSpecDomainError) && (error as { code?: string }).code === "57P01",
  );
});

test("findByDestination returns undefined for an unknown destination", async () => {
  const core = new SharedSpecCore(new InMemorySharedSpecRepository());
  assert.equal(await core.findByDestination("hola/hola", "notes/unknown.md"), undefined);
});

test("createDocument itself validates the gitPath pattern against the document's own kind", async () => {
  const core = new SharedSpecCore(new InMemorySharedSpecRepository());
  await core.createDocument(author, { title: "A note via createDocument", kind: "note", repository: "hola/hola", gitPath: "notes/direct-create.md", markdown: "# x\n", idempotencyKey: "direct-create" });
  await assert.rejects(
    () => core.createDocument(author, { title: "x", kind: "note", repository: "hola/hola", gitPath: "docs/superpowers/specs/wrong-namespace.md", markdown: "# x\n", idempotencyKey: "direct-create-bad" }),
    (error: SharedSpecDomainError) => error.code === "VALIDATION",
  );
});