---
name: GitHub Actions checkout token shadowing
description: actions/checkout's persisted default GITHUB_TOKEN extraheader silently overrides a later URL-embedded custom push token in the same job.
---

Any workflow step that does `git push https://x-access-token:$TOKEN@github.com/...`
after an earlier `actions/checkout@vN` step (default `persist-credentials: true`)
actually pushes using the checkout-persisted default `GITHUB_TOKEN`, not the
URL-embedded token — even though the URL looks like it should win.
`actions/checkout` writes a `http.https://github.com/.extraheader` git-config
entry scoped to `https://github.com/`; git/curl send an already-configured
extraheader instead of the Authorization implied by URL userinfo, so the URL
credential is silently ignored, not merely deprioritized.

**Why:** confirmed in `cross-tool-promote.yml` (Sep 18 2026): a "Fast-forward
main and push" step authenticated as `github-actions[bot]` (the default
token's identity) instead of the intended GitHub App installation token, and
branch protection denied it with a 403 that looked like an App-permission
problem but wasn't — a parallel in-process push using the identical
token-minting code succeeded at the same time, proving the App credential
itself was fine.

**How to apply:** in any workflow step that pushes with a non-default token
after a `checkout` step, run `git config --unset-all
http.https://github.com/.extraheader || true` immediately before that push
(not earlier — earlier steps, like an ancestor/fetch check, may still need
the persisted default token for read access). Prefer this targeted unset
over `persist-credentials: false` on checkout when earlier steps in the same
job need read access via the default token.
