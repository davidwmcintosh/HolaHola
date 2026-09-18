---
name: GitHub Actions secrets require manual add
description: No credential available in this project can create/rotate a GitHub Actions repo secret via the API; a fine-grained PAT's repo-level "permissions" field is not proof of its real scope either.
---

## The constraint

Setting or rotating a GitHub Actions repository secret (`PUT
/repos/{owner}/{repo}/actions/secrets/{name}`) requires a credential with
"Secrets: write" repository permission. In this project, verified
empirically (Sep 18 2026) that NEITHER of the two credentials otherwise
capable of broad repo administration has it:

- David's personal fine-grained PAT (`GITHUB_ACTIONS_DISPATCH_TOKEN`, full
  admin/maintain/push/triage/pull on the repo) — 403 "Resource not
  accessible by personal access token" on the secrets public-key endpoint.
- The coordinator's GitHub App installation token
  (`server/services/github-app-auth.ts`, `fetchGithubInstallationToken`) —
  403 "Resource not accessible by integration" on the same endpoint.

**How to apply:** don't spend time trying to script a GitHub Actions secret
creation/update in this project — ask the user to add or update it directly
via the repo's Settings → Secrets and variables → Actions UI. This is a
normal, expected manual step here, not a workaround to avoid.

## Fine-grained PAT scope verification

A fine-grained PAT's `permissions` object on `GET /repos/{owner}/{repo}`
(e.g. `{admin:true, maintain:true, push:true, triage:true, pull:true}`)
reflects the **authenticated user's role** on the repo, not what that
specific token was actually granted. A PAT explicitly scoped to only
"Administration: Read and write" still showed that same full-admin-looking
`permissions` object.

**Why:** this field is a legacy convenience/back-compat field predating
fine-grained PATs; it does not narrow when the token's granted permission
categories do.

**How to apply:** to verify what a fine-grained PAT can actually do, test
real endpoints that require the specific permission category in question
and check for 200 vs 403 ("Resource not accessible by personal access
token") — never trust the repo-level `permissions` object as evidence of a
fine-grained PAT's real scope.
