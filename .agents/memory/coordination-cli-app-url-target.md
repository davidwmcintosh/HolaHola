---
name: Coordination CLI APP_URL target mismatch
description: APP_URL secret can point to a different deployment (e.g. production) than the dev workspace; coordination policy/credential CLIs default to it and fail auth with a valid-looking token.
---

Coordination V2 CLIs that accept `--app-url` (or default to the `APP_URL` env var) -- e.g. `coordination-policy-cli.ts`, `coordination-credential-cli.ts` -- may silently target a different live deployment than the current dev workspace. A token (e.g. `COORDINATION_DAVID_TOKEN`) that is valid and present in the dev workspace's own secrets can still fail with a plain 401 "Invalid coordination token" if the request actually lands on a different deployment whose copy of that same-named secret has a different value.

**Why:** `resolveCoordinationActor` does a byte-exact `timingSafeEqual` against whatever that specific receiving process has in its own `process.env` -- two environments sharing a secret name does not imply the value is synced between them. `APP_URL` in this project points at a deployment separate from the Replit dev workspace (consistent with production running on Render, per other memory notes), so it is not a safe default for authenticating as a fixed-actor coordination token minted into the dev workspace's own secrets.

**How to apply:** Before concluding a coordination token is wrong or needs rotating, retry the same CLI call with `--app-url http://127.0.0.1:5000` to target the current dev workspace's own server directly. If that succeeds, the token was fine all along -- the default `APP_URL` was just pointing elsewhere. This is safe to rely on for authority writes (policy drafts/approvals/operator grants, task-artifact publication) because those tables live in the one shared Neon database read by every deployment -- a write accepted by the dev server's API is immediately visible to production and to any remote host (e.g. a Windows coordination host) that calls the production endpoint instead.

