import assert from "node:assert/strict";
import test from "node:test";
import { hashSharedSpecMarkdown, SharedSpecDomainError } from "./shared-spec-core";
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

test("publish binds the authenticated actor's id into the provider context, overriding any caller-supplied actorId", async () => {
  // A local store/core/provider triple, isolated from the module-level ones
  // above: publish() re-verifies the approved bytes hash before calling the
  // provider, so the fixture's contentHash must be a real hash of its bytes.
  const localPublications = new Map<string, SpecPublication & { requestedByActorId: string; idempotencyKey: string; requestDigest: string }>();
  const localStore: SpecPublicationStore = {
    get: async id => localPublications.get(id),
    getByRequest: async (actorId, key) => [...localPublications.values()].find(value => value.requestedByActorId === actorId && value.idempotencyKey === key),
    create: async value => { localPublications.set(value.id, value); },
    update: async value => { localPublications.set(value.id, { ...localPublications.get(value.id)!, ...value }); },
    appendAttempt: async () => undefined,
  };
  const markdown = "approved-actor-binding-fixture";
  const localCore = { exportApprovedBytes: async () => ({
    document: { repository: "hola/specs", gitPath: "docs/superpowers/specs/approved.md" },
    revision: { contentHash: hashSharedSpecMarkdown(markdown) }, review: { id: "review" }, bytes: Buffer.from(markdown),
  }) };
  let receivedContext: unknown;
  const spyProvider = {
    prepare: async () => ({ repository: "hola/specs", baseRef: "main", expectedBaseCommit: "b".repeat(40),
      destinationPath: "docs/superpowers/specs/approved.md", expectedDestinationAbsent: true }),
    publish: async (_input: unknown, context: unknown) => {
      receivedContext = context;
      return { branchName: "shared-spec/p", pullRequestNumber: 1, pullRequestUrl: "https://example.test/pr/1" };
    },
    reconcile: async () => ({ state: "open" as const }),
  };
  const service = new SharedSpecPublicationService(localCore as any, localStore, spyProvider as any);
  const input = { documentId: "document", revisionId: "revision", reviewId: "review", idempotencyKey: "publish-actor-binding" };
  const requested = await service.request({ actorId: "author" }, input);
  // A caller-supplied actorId in the context must never reach the provider --
  // only the actor this call was authenticated with may.
  await service.publish({ actorId: "author" }, requested.id, { taskRef: "1455", actorId: "someone-else" } as any);
  assert.deepEqual(receivedContext, { taskRef: "1455", actorId: "author" });
});