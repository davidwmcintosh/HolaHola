## Verify real consumers before propagating a new coordination-actor token

A new `COORDINATION_<ACTOR>_TOKEN` secret's real footprint is whatever code
actually reads `process.env.<TOKEN_ENV>` at runtime — not every store a
sibling actor's token happens to live in. Two things commonly get conflated:

- The running server (dev workflow + published deployment) needs the real
  value, because `server/middleware/coordination-auth.ts` compares incoming
  `x-coordination-token` headers against it. Replit syncs a Secret to both
  the dev workspace and the published deployment's environment automatically
  (confirmed via `viewEnvVars` returning true for both `development` and
  `production` scopes) — nothing extra to configure there.
- A GitHub Actions workflow does NOT automatically need the real secret just
  because it runs a test file that imports the auth module. HTTP-level tests
  for a specific actor commonly set
  `process.env.COORDINATION_<ACTOR>_TOKEN = <synthetic-value>` for the
  duration of the test and restore the previous value in `finally` — the
  real secret is never read. Grep the actual workflow YAML for
  `secrets.COORDINATION_` and trace which script/test file it runs before
  assuming a new actor token needs to be added as a GitHub Actions
  repository secret.

**Why:** assuming symmetry with sibling tokens (this project has separate
tokens for david, alden, and multiple luca-* hats) leads to either
needlessly asking the user to duplicate a sensitive credential into GitHub,
or missing a store that genuinely does need it. Verified Sep 26 2026 while
wiring `COORDINATION_DAVID_TOKEN` into founder policy routes plus a CLI
script: only the dev/prod server environments needed it; the one GitHub
workflow touching the same test family (`cross-tool-promote.yml`) neither
runs that test nor references the secret.

**How to apply:** before telling a user a new coordination/actor secret
needs to go "everywhere," grep for the token's env-var name across
`.github/workflows/*.yml` (specifically `secrets.<NAME>`, not just the name
appearing in a comment) and check whether any test touching it fabricates
its own temporary value instead of reading the real one. Also check
`viewEnvVars({ type: "secret", environment })` for `development` and
`production` directly rather than assuming Replit's general auto-sync
applies without verifying the specific key.

