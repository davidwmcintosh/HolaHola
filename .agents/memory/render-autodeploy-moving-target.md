---
name: Render redeploys on every push to main
description: Render appears to rebuild and re-promote on every push to main regardless of content, making "the verified release" a moving target during active development.
---

Confirmed empirically 2026-09-17: an edit limited to `.agents/memory/` (a
memory-bookkeeping file plus one new topic file, zero application code) ended
up committed and, within roughly an hour, was the exact `commitSha` reported
by all three of `getholahola.com`, `render.getholahola.com`, and the raw
`onrender.com` `/health/release` endpoints (`authority: "build"`,
`commitSource: "render-build-input"`). Nothing explicitly deployed or
published anything from this session — it followed purely from an ordinary
file edit landing on `main`.

**Why:** Any task whose job is "verify commit X, then act on that exact
verified release" (task #1453's DNS cutover is the concrete case) races
against every other commit — including docs-only and memory-only ones —
landing on `main` in the same window. A release confirmed minutes ago can
already be superseded by the time the next step runs.

**How to apply:** Before advising on a "release mismatch" or similar
verified-vs-current decision, re-check the live `/health/release` endpoints
directly rather than trusting either side of a comparison someone else made
earlier — by the time you look, a third commit may already be current. Don't
assume a low-risk file edit (memory, docs) is deployment-inert in this
project.

## Registered deployment metadata is not live-host authority

Deployment metadata that lists a custom domain does not prove which platform currently serves that domain. Check the live release-identity endpoint before selecting a publishing action or setting platform-specific production variables.

**Why:** Replit reported a successful public Autoscale deployment with `getholahola.com` as its primary URL, while the live domain's release identity reported `render-build-input` for the current source. Replit's production environment settings therefore could not establish the live Render process's configuration. With Render automatic deploys enabled, a source-sync push is a live deployment side effect, even when the source coordinator's own prepare operation never publishes.

**How to apply:** Distinguish registration/deployment metadata, live build identity, and per-platform environment configuration. Do not claim a Replit-only variable configures Render. Before promising preparation without publication, verify whether source synchronization triggers a live auto-deploy, and stop for founder control rather than bypassing candidate gates.

## Cutover evidence is not a deploy freeze

The historical cutover design chose an immutable release-identity attestation
instead of a deployment freeze. Decision evidence stays fixed; production does
not.

**Why:** Multiple independent actors can advance the source. Pausing a single
sync scheduler does not stop every writer and would create false confidence.
The rationale is preserved in
`docs/superpowers/specs/2026-09-17-release-cutover-attestation-design.md`.

**How to apply:** Keep the commit and source digest shown for a decision
unchanged. Before action, and even on matching retries, require unexpired
evidence and fresh live agreement. Drift blocks action rather than silently
substituting a newer release. Never describe this mechanism as a deploy pin.

## Automatic deployment policy must be verified live

Automatic deployment is a live Render setting, not a permanent property of the repository. Render's dashboard “Deploy a specific commit” action disables automatic deploys.

**Why:** Earlier automatic-deployment observations stopped predicting production behavior when authenticated Render inspection showed auto-deploy disabled. Passing GitHub CI and an updated main branch did not themselves publish production. Render documents the dashboard action's effect at https://render.com/docs/deploys#deploying-a-specific-commit.

**How to apply:** Read the existing service's actual auto-deploy policy before asserting that source synchronization will publish. Treat earlier observations and checked-in Blueprints as historical or desired configuration, not current authority. Keep manual exact-candidate publication unless the founder explicitly approves a cadence change; verify live commit and source digest before recording promotion.
