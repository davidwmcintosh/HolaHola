import assert from "node:assert/strict";
import test from "node:test";
import type { Request } from "express";
import { resolveFounderDecisionActor } from "./founder-task-ownership-routes";

const authenticatedUser = { id: "founder-test-id" };

test("password-auth founder decisions use the loaded authenticated user", () => {
  const request = {
    session: { userId: authenticatedUser.id },
    authenticatedUser,
  } as unknown as Request;
  assert.equal(resolveFounderDecisionActor(request), authenticatedUser.id);
});

test("OIDC founder decisions use the same loaded authenticated user", () => {
  const request = {
    user: { claims: { sub: authenticatedUser.id } },
    authenticatedUser,
  } as unknown as Request;
  assert.equal(resolveFounderDecisionActor(request), authenticatedUser.id);
});

test("founder decisions fail closed without a loaded authenticated user", () => {
  assert.throws(
    () => resolveFounderDecisionActor({} as Request),
    (error: unknown) => (error as { code?: string })?.code === "FOUNDER_ID_REQUIRED",
  );
});