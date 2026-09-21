import assert from "node:assert/strict";
import test from "node:test";
import { HolaHolaCoordinationTokenAuthenticator } from "../adapters/hola-hola-shared-spec-auth";
import { SharedSpecCore, InMemorySharedSpecRepository } from "../services/shared-spec-core";
import type { LiveInstructionDocumentSyncProvider, LiveInstructionSyncTarget } from "../services/shared-spec-live-sync";
import { createSharedSpecRouter, publicationActionContext } from "./shared-spec-routes";
import { type Router } from "express";

/** Pulls out the real registered Express handler so tests exercise production wiring, not a reimplementation. */
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
    type() { return response; },
    send(body: unknown) { state.body = body; return response; },
  };
  return { response, state };
}
const fakeRequest = (params: Record<string, string>, body: Record<string, unknown> = {}) =>
  ({ params, body, header: () => undefined }) as any;

/** Sets up a flagged-or-not document with a review claimed and ready to decide, mirroring the setup() helper in shared-spec-core.test.ts. */
async function setupReadyReview(liveInstructionDocument: boolean) {
  const core = new SharedSpecCore(new InMemorySharedSpecRepository());
  await core.setReviewerPolicy({ actorId: "admin", capabilities: ["policy_admin"] }, {
    actorId: "reviewer", capability: "reviewer", active: true, idempotencyKey: "reviewer-on",
  });
  const created = await core.createDocument({ actorId: "author" }, {
    title: "Live Doc", kind: "architecture", repository: "hola/hola", gitPath: "docs/superpowers/specs/live.md",
    markdown: "# Live\n", liveInstructionDocument, idempotencyKey: "create",
  });
  const review = await core.markRevisionReady({ actorId: "author" }, {
    documentId: created.document.id, revisionId: created.revision.id, idempotencyKey: "ready",
  });
  await core.claimReview({ actorId: "reviewer" }, review.id, "claim");
  return { core, created, review };
}

test("generic shared-spec router boots with injected core and authenticator, not REPLIT configuration", async () => {
  const original = process.env.REPLIT_DEPLOYMENT;
  delete process.env.REPLIT_DEPLOYMENT;
  try {
    const core = new SharedSpecCore(new InMemorySharedSpecRepository());
    const router = createSharedSpecRouter({
      core,
      authenticator: { authenticate: async () => ({ actorId: "portable-test-actor" }) },
    });
    const paths = (router as any).stack.map((layer: any) => layer.route?.path).filter(Boolean);
    assert.ok(paths.includes("/documents"));
    assert.ok(paths.includes("/documents/:documentId/revisions"));
    assert.ok(paths.includes("/documents/by-destination"));
    assert.ok(paths.includes("/documents/share"));
  } finally {
    if (original === undefined) delete process.env.REPLIT_DEPLOYMENT;
    else process.env.REPLIT_DEPLOYMENT = original;
  }
});

test("HolaHola token adapter is an optional host adapter with explicit actor identity", async () => {
  const auth = new HolaHolaCoordinationTokenAuthenticator(new Map([
    ["test-token", { actorId: "hola-reviewer", capabilities: ["reviewer"] as const }],
  ]));
  const result = await auth.authenticate({ header: (name: string) => name === "x-shared-spec-token" ? "test-token" : undefined } as any);
  assert.deepEqual(result, { actorId: "hola-reviewer", capabilities: ["reviewer"] });
});

test("actor capabilities are supplied only by the injected authenticator, never request claims", async () => {
  const authenticator = {
    authenticate: async (_request: unknown) => ({ actorId: "ordinary-actor" }),
  };
  const maliciousRequest = { body: { actorId: "admin", capabilities: ["policy_admin"] }, headers: { "x-actor-capabilities": "policy_admin" } };
  const actor = await authenticator.authenticate(maliciousRequest);
  assert.deepEqual(actor, { actorId: "ordinary-actor" });
  assert.equal(actor.capabilities, undefined);
});

test("the by-destination note lookup is registered ahead of the :documentId param route so it is never shadowed", async () => {
  const core = new SharedSpecCore(new InMemorySharedSpecRepository());
  const router = createSharedSpecRouter({
    core,
    authenticator: { authenticate: async () => ({ actorId: "portable-test-actor" }) },
  });
  const paths = (router as any).stack.map((layer: any) => layer.route?.path).filter(Boolean);
  const byDestinationIndex = paths.indexOf("/documents/by-destination");
  const paramIndex = paths.indexOf("/documents/:documentId");
  assert.ok(byDestinationIndex >= 0 && paramIndex >= 0);
  assert.ok(byDestinationIndex < paramIndex, "by-destination must be registered before the :documentId param route");
});

test("publicationActionContext prefers the task-ref header, falls back to the body, and omits blank values", () => {
  const fakeRequest = (header: string | undefined, body: unknown) =>
    ({ header: (name: string) => (name === "x-shared-spec-task-ref" ? header : undefined), body }) as any;
  assert.deepEqual(publicationActionContext(fakeRequest("1455", { taskRef: "9999" })), { taskRef: "1455" });
  assert.deepEqual(publicationActionContext(fakeRequest(undefined, { taskRef: "1455" })), { taskRef: "1455" });
  assert.deepEqual(publicationActionContext(fakeRequest(undefined, { taskRef: "  " })), { taskRef: undefined });
  assert.deepEqual(publicationActionContext(fakeRequest(undefined, undefined)), { taskRef: undefined });
});

test("approving a flagged document's revision syncs it through the injected liveSync provider and reports the result", async () => {
  const { core, created, review } = await setupReadyReview(true);
  const syncCalls: LiveInstructionSyncTarget[] = [];
  const liveSync: LiveInstructionDocumentSyncProvider = {
    sync: async (target) => { syncCalls.push(target); return { state: "synced", commitCreated: true, commitSha: "a".repeat(40) }; },
  };
  const router = createSharedSpecRouter({ core, authenticator: { authenticate: async () => ({ actorId: "reviewer" }) }, liveSync });
  const { response, state } = fakeResponse();
  await findHandler(router, "post", "/reviews/:reviewId/approve")(
    fakeRequest({ reviewId: review.id }, { idempotencyKey: "approve-1" }), response,
  );
  assert.equal(syncCalls.length, 1);
  assert.equal(syncCalls[0].documentId, created.document.id);
  assert.equal(syncCalls[0].gitPath, "docs/superpowers/specs/live.md");
  assert.equal(syncCalls[0].markdown, "# Live\n");
  assert.equal((state.body as any).liveSync.state, "synced");
});

test("approving an ordinary (non-flagged) document's revision never calls liveSync", async () => {
  const { core, review } = await setupReadyReview(false);
  let syncCalled = false;
  const liveSync: LiveInstructionDocumentSyncProvider = { sync: async () => { syncCalled = true; return { state: "synced", commitCreated: true }; } };
  const router = createSharedSpecRouter({ core, authenticator: { authenticate: async () => ({ actorId: "reviewer" }) }, liveSync });
  const { response, state } = fakeResponse();
  await findHandler(router, "post", "/reviews/:reviewId/approve")(
    fakeRequest({ reviewId: review.id }, { idempotencyKey: "approve-1" }), response,
  );
  assert.equal(syncCalled, false);
  assert.equal((state.body as any).liveSync, undefined);
});

test("approving a flagged document when no liveSync provider is configured still leaves the DB approval intact and reports a stale sync", async () => {
  const { core, review } = await setupReadyReview(true);
  const router = createSharedSpecRouter({ core, authenticator: { authenticate: async () => ({ actorId: "reviewer" }) } });
  const { response, state } = fakeResponse();
  await findHandler(router, "post", "/reviews/:reviewId/approve")(
    fakeRequest({ reviewId: review.id }, { idempotencyKey: "approve-1" }), response,
  );
  assert.equal((state.body as any).state, "approved");
  assert.equal((state.body as any).liveSync.state, "stale");
  assert.match((state.body as any).liveSync.reason, /not configured/);
});

test("resync rejects a document that is not flagged as a live-instruction document", async () => {
  const core = new SharedSpecCore(new InMemorySharedSpecRepository());
  const created = await core.createDocument({ actorId: "author" }, {
    title: "Ordinary Doc", kind: "design", repository: "hola/hola", gitPath: "docs/superpowers/specs/ordinary.md",
    markdown: "# Ordinary\n", idempotencyKey: "create",
  });
  const liveSync: LiveInstructionDocumentSyncProvider = { sync: async () => ({ state: "synced", commitCreated: true }) };
  const router = createSharedSpecRouter({ core, authenticator: { authenticate: async () => ({ actorId: "reviewer" }) }, liveSync });
  const { response, state } = fakeResponse();
  await findHandler(router, "post", "/documents/:documentId/resync")(fakeRequest({ documentId: created.document.id }), response);
  assert.equal(state.statusCode, 400);
  assert.match((state.body as any).error, /not a live-instruction document/);
});

test("resync re-applies the currently approved revision through the injected liveSync provider", async () => {
  const { core, created, review } = await setupReadyReview(true);
  await core.approveReview({ actorId: "reviewer" }, { reviewId: review.id, idempotencyKey: "approve-1" });
  const syncCalls: LiveInstructionSyncTarget[] = [];
  const liveSync: LiveInstructionDocumentSyncProvider = {
    sync: async (target) => { syncCalls.push(target); return { state: "synced", commitCreated: true, commitSha: "b".repeat(40) }; },
  };
  const router = createSharedSpecRouter({ core, authenticator: { authenticate: async () => ({ actorId: "reviewer" }) }, liveSync });
  const { response, state } = fakeResponse();
  await findHandler(router, "post", "/documents/:documentId/resync")(fakeRequest({ documentId: created.document.id }), response);
  assert.equal(syncCalls.length, 1);
  assert.equal(syncCalls[0].gitPath, "docs/superpowers/specs/live.md");
  assert.equal((state.body as any).liveSync.state, "synced");
});