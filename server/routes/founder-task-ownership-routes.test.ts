import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
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

test("ownership routes mount only after Replit and Google authentication middleware", () => {
  const source = readFileSync(new URL("../routes.ts", import.meta.url), "utf8");
  const setupAuthAt = source.indexOf("await setupAuth(app as any, authLimiter)");
  const setupGoogleAuthAt = source.indexOf("await setupGoogleAuth(app as any, authLimiter)");
  const ownershipRoutesAt = source.indexOf("registerFounderTaskOwnershipRoutes(app)");

  assert.notEqual(setupAuthAt, -1);
  assert.notEqual(setupGoogleAuthAt, -1);
  assert.notEqual(ownershipRoutesAt, -1);
  assert.ok(setupAuthAt < ownershipRoutesAt, "ownership routes must mount after Replit auth");
  assert.ok(setupGoogleAuthAt < ownershipRoutesAt, "ownership routes must mount after Google auth");
});