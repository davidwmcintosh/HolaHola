---
name: GitHub App auth migration — credential surface map
description: Migrating source-control git transport away from the SSH deploy key; where every consumer of that credential lives and what still uses the old key.
---

# GitHub App auth migration — credential surface map

HolaHola's source-control coordinator (`server/services/source-control-service.ts`)
authenticates git pushes as a GitHub App installation
(`server/services/github-app-auth.ts`: JWT mint → installation-token
exchange, injected via `GIT_CONFIG_KEY_0=http.extraheader`, never
argv/URL-embedded) instead of the long-lived `HOLAHOLA_GITHUB_DEPLOY_KEY` SSH
key. Tokens are minted fresh per call and expire within the hour; a ruleset
bypass_actor tied to the App (not the key) was the point of the migration —
Sep 17 2026.

**The same logical credential has to be set in three independent stores; a
migration that only updates one of them leaves the others as a live bypass
path:**
1. Replit Secrets — consumed by `source-control-service.ts` on the
   Replit-side dev/coordinator process.
2. `render.yaml` (`sync: false` placeholders) + the Render dashboard's actual
   secret values — consumed by the Render **production runtime** for its
   own read-only exact-commit snapshot fetch (Render's image omits `.git`).
3. GitHub Actions repository secrets (a store separate from both of the
   above) — consumed by `.github/workflows/cross-tool-promote.yml`'s "Fast-forward
   main and push" step. Migrated and merged Sep 17 2026 (PR #21): the step
   mints an installation token via `scripts/print-github-app-token.ts` and
   pushes over HTTPS instead of the SSH deploy key.

**Migration complete as of Sep 17 2026** for the *push* path: both git-push
call sites (Replit coordinator, GitHub Actions) use the GitHub App. The
repository ruleset's bypass_actors was narrowed to exactly one entry (the App's
Integration id) — the old unscoped `DeployKey` bypass_actor entry was removed.
See [GitHub branch protection layering](github-branch-protection-layering.md)
for the classic-vs-ruleset conflict that had to be resolved first before the
bypass would actually take effect.

**The old `HOLAHOLA_GITHUB_DEPLOY_KEY` was deliberately NOT revoked.** It
remains registered and is still load-bearing for a *separate, read-only*
purpose unrelated to pushing: Render's production runtime uses it (or is
being wired to use it — see
`docs/superpowers/specs/2026-09-17-render-runtime-source-snapshot-design.md`)
to fetch an authenticated exact-commit source snapshot over SSH, since its
container image omits `.git`; `scripts/github-release-ssh.sh` /
`scripts/github-ssh-env.sh` are older tooling with the same dependency. None
of that is a bypass path — read-only fetch isn't gated by branch protection —
so removing the key's *bypass* privilege (done, above) fully closed the
original security hole without needing to revoke the credential itself.

**Separate gotcha hit migrating this third store:** a GitHub App pushing to
`.github/workflows/*` needs the App's "Workflows" permission specifically —
see [GitHub App permission approval](github-app-permission-approval.md).
Also see [Git LFS pre-push SSH hang](git-lfs-prepush-ssh-hang.md) for a
push-hang red herring encountered along the way.

**Why:** each store belongs to a different execution environment (Replit
workspace, Render's deployed container, GitHub's own Actions runners); none
of them read from each other.

**How to apply:** any future credential rotation or transport change for git
push access must touch all three call sites above, not just the one you
happen to be looking at. Grep for `HOLAHOLA_GITHUB_DEPLOY_KEY` /
`HOLAHOLA_GITHUB_APP_` across the whole repo including `.github/workflows/`,
not just `server/`, to find all live consumers before declaring a
credential migration complete.
