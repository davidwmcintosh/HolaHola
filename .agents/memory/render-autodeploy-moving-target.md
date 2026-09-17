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
