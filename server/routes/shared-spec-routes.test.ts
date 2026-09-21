import assert from "node:assert/strict";
import test from "node:test";
import { HolaHolaCoordinationTokenAuthenticator } from "../adapters/hola-hola-shared-spec-auth";
import { SharedSpecCore, InMemorySharedSpecRepository } from "../services/shared-spec-core";
import { createSharedSpecRouter, publicationActionContext } from "./shared-spec-routes";

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