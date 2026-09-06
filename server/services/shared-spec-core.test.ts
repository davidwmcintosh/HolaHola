import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemorySharedSpecRepository,
  SharedSpecCore,
  SharedSpecDomainError,
  hashSharedSpecMarkdown,
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