---
name: cross-tool-promote
description: Get a committed branch onto main safely, for any external tool/caller (Claude Code, Cursor, Antigravity, a human) that isn't Replit's own dev checkout. Tool: scripts/cross-tool-promote.ts.
---

# Cross-Tool Promote

**Full design & rationale:** `docs/superpowers/specs/2026-08-26-unified-source-promote-endpoint-design.md`

## What this skill is for

Use whenever committed local work needs to reach `main` and a plain `git push` won't work — `main` is protected (PR required, one status check, the only bypass is a deploy key no caller ever holds directly). This is the shared path for any tool or caller that isn't Replit's own persistent dev checkout.

## This is one of two entry points into `main` — know which one you are

Replit has its own, separately-scoped entry point: `server/services/source-control-service.ts` (the "source-promotion" system, `docs/superpowers/specs/2026-08-27-source-promotion-api-design.md`). It's hard-wired to *one specific persistent checkout* — it requires the calling process's actual working directory to already be sitting on `main`, and answers "is *this* checkout in sync with GitHub." It cannot serve an arbitrary branch from an arbitrary caller.

This tool is the opposite shape on purpose: stateless, caller-agnostic, works from anywhere (a laptop, a Codespace, any CI). If you're Replit's own dev environment reconciling its own checkout, use their system. If you're anything else — including a Claude Code session running from a machine that has never touched Replit's checkout — use this one. Two entry points into `main` is the intended design here, not a conflict to resolve into one; a future platform with its own host-specific constraints (Antigravity, say) could reasonably add a third. What all such entry points should share: fast-forward-only, no automatic reconciliation of a diverged branch, and the deploy key never held by the calling agent/tool.

## How it works

1. Commit locally, then `git push origin <branch>` normally — pushing a non-`main` branch needs no special credential, the ruleset only protects `main` itself.
2. Run:
   ```bash
   npx tsx scripts/cross-tool-promote.ts push <branch>
   ```
   This calls the GitHub Actions API **directly** — no HolaHola server involved at all — to dispatch `.github/workflows/cross-tool-promote.yml`, then polls until it finishes.
3. That workflow run does the real work: refuses if `main` isn't an ancestor of the branch (diverged — no automatic reconciliation, ever), then runs the same validation a human PR gets (`npm run check`, `npm run build`, the three `test:ci:*` groups) via an ephemeral Neon branch (`npm run db:branch -- gate`, see `.agents/skills/neon-branch/SKILL.md`), and only on a full pass fast-forwards `main` and pushes using the existing deploy key over SSH — that key lives only in GitHub Actions secrets, never touched by this script or by any caller.
4. `scripts/cross-tool-promote.ts push` prints the terminal result: `SYNCED` (main now includes the branch) or `FAILED` (with the run URL to inspect — nothing was pushed).

## Tell Replit what's coming through

Landing on `main` via this tool is exactly the "cross-cutting change the other
interface will have to reconcile" case `docs/shared-agent-instructions.md`'s
Engineering Handoff section covers — **add a `## From <interface> — <date>`
entry to `docs/alden-agent-handoff.md` in the same commit that lands the
change, not after.** Replit reads this file at session start and again on
every pull (`scripts/post-merge.sh` surfaces it automatically), so a change
that lands via `cross-tool-promote` with no handoff entry is the exact failure
this convention exists to prevent — a real incident, not a hypothetical (see
the Aug 31, 2026 entries in that file). Follow
`.agents/skills/pre-merge-handoff/SKILL.md`'s checklist before pushing:
cross-check the handoff entry against `git log origin/main..HEAD`, not memory.

## Why no server is involved

An earlier version of this had the script call a HolaHola-hosted endpoint (`POST /api/internal/source-promote`), which then dispatched the workflow. That added a reachability dependency — Replit dev restarts constantly and was never meant to have uptime guarantees, and production is exactly the live-traffic process this whole design was built to stay off of — without adding real security, since the actual push credential (`HOLAHOLA_GITHUB_DEPLOY_KEY`) never touched that endpoint either; it only ever lived in GitHub Actions secrets. GitHub's own API is already the always-on service here. Removed 2026-08-31 once this became clear from actually trying to test it against a Replit instance that wasn't reliably up.

## Required setup

One secret in `.env` (or wherever the caller actually runs — this needs no server-side secret at all):
- `GITHUB_ACTIONS_DISPATCH_TOKEN` — a GitHub fine-grained PAT, scoped to this repo only, "Actions: Read and write" and nothing else. Used only to trigger/poll the workflow run — never touches repo-write access directly.

## Reminders

- **A workflow file only dispatches via the API once it exists on the default branch (`main`).** A brand-new or renamed workflow file living only on a feature branch will 404 on `workflow_dispatch` no matter what `ref` you pass — this isn't the `ref`-picks-the-content gotcha below, it's a harder platform limit: GitHub doesn't recognize the workflow *at all* until its file has landed on the default branch at least once. Practical consequence: the very first real end-to-end test of a new or renamed workflow can only happen *after* merging it to `main`, never before. Found this discovering that `cross-tool-promote.yml` (renamed from `source-promote.yml`, never yet on `main`) 404'd on every dispatch attempt, even against its own branch.
- A diverged branch is refused outright, not reconciled — fix the divergence yourself (rebase/merge) before retrying.
- `npx tsx scripts/cross-tool-promote.ts status <jobId>` re-checks a run's status later — it's stateless, resolved fresh from GitHub each time via the jobId embedded in the run's name, no local bookkeeping needed.
- This replaces ad hoc pushes to `main` for every non-Replit-dev tool — if you find yourself about to try a direct `git push origin main`, use this instead; it will likely be rejected by the ruleset anyway.
- **`workflow_dispatch`'s `ref` picks which version of the workflow *file* runs, not just which branch gets validated.** This script always dispatches with `ref: 'main'` — deliberately, so a feature branch can never smuggle in a modified workflow file to weaken its own gate. The practical consequence: if you're fixing a bug *in the workflow file itself*, that fix has no effect until it's merged to `main` — dispatching against your branch still runs `main`'s old copy. This cost real time to discover (two identical failures in a row, from a fix that was correct but simply hadn't taken effect yet). To verify a workflow-file fix before merging, dispatch manually with `ref` set to your branch instead of using the normal `push` command — that's a deliberate one-off deviation for verification only, never the real path.
