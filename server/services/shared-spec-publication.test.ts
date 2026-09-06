import assert from "node:assert/strict";
import test from "node:test";
import { SharedSpecDomainError } from "./shared-spec-core";
import { SharedSpecPublicationService, type SpecPublication, type SpecPublicationStore } from "./shared-spec-publication";

const hash = "a".repeat(64);
const publications = new Map<string, SpecPublication & { requestedByActorId: string; idempotencyKey: string; requestDigest: string }>();
const store: SpecPublicationStore = {
  get: async id => publications.get(id),
  getByRequest: async (actor, key) => [...publications.values()].find(value => value.requestedByActorId === actor && value.idempotencyKey === key),
  create: async value => { publications.set(value.id, value); },
  update: async value => { publications.set(value.id, { ...publications.get(value.id)!, ...value }); },
  appendAttempt: async () => undefined,
};
const provider = {
  prepare: async () => ({ repository: "hola/specs", baseRef: "main", expectedBaseCommit: "b".repeat(40),
    destinationPath: "docs/superpowers/specs/approved.md", expectedDestinationAbsent: true }),
  publish: async () => ({ branchName: "shared-spec/p", pullRequestNumber: 1, pullRequestUrl: "https://example.test/pr/1" }),
  reconcile: async () => ({ state: "open" as const }),
};
const core = { exportApprovedBytes: async () => ({
  document: { repository: "hola/specs", gitPath: "docs/superpowers/specs/approved.md" },
  revision: { contentHash: hash }, review: { id: "review" }, bytes: Buffer.from("approved"),
}) };

test("publication requests use durable actor/idempotency identity", async () => {
  publications.clear();
  const service = new SharedSpecPublicationService(core as any, store, provider);
  const input = { documentId: "document", revisionId: "revision", reviewId: "review", idempotencyKey: "same" };
  const first = await service.request({ actorId: "author" }, input);
  const replay = await service.request({ actorId: "author" }, input);
  assert.equal(replay.id, first.id);
  assert.equal(publications.size, 1);
  await assert.rejects(
    () => service.request({ actorId: "author" }, { ...input, reviewId: "other" }),
    (error: SharedSpecDomainError) => error.code === "IDEMPOTENCY_MISMATCH",
  );
});