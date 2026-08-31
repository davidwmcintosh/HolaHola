---
name: source-promote
description: Get a committed branch onto main safely, the same way from any tool (Claude Code, Replit, Cursor, Antigravity). Tool: scripts/source-promote.ts.
---

# Source Promote

**Full design & rationale:** `docs/superpowers/specs/2026-08-26-unified-source-promote-endpoint-design.md`

## What this skill is for

Use whenever committed local work needs to reach `main` and a plain `git push` won't work — `main` is protected (PR required, one status check, the only bypass is a deploy key no caller ever holds directly). This is the one shared path every tool uses identically, instead of each interface growing its own habit for "how I get code onto main."

## How it works

1. Commit locally, then `git push origin <branch>` normally — pushing a non-`main` branch needs no special credential, the ruleset only protects `main` itself.
2. Run:
   ```bash
   npx tsx scripts/source-promote.ts push <branch>
   ```
   This calls the GitHub Actions API **directly** — no HolaHola server involved at all — to dispatch `.github/workflows/source-promote.yml`, then polls until it finishes.
3. That workflow run does the real work: refuses if `main` isn't an ancestor of the branch (diverged — no automatic reconciliation, ever), then runs the same validation a human PR gets (`npm run check`, `npm run build`, the three `test:ci:*` groups) via an ephemeral Neon branch (`npm run db:branch -- gate`, see `.agents/skills/neon-branch/SKILL.md`), and only on a full pass fast-forwards `main` and pushes using the existing deploy key over SSH — that key lives only in GitHub Actions secrets, never touched by this script or by any caller.
4. `scripts/source-promote.ts push` prints the terminal result: `SYNCED` (main now includes the branch) or `FAILED` (with the run URL to inspect — nothing was pushed).

## Why no server is involved

An earlier version of this had `scripts/source-promote.ts` call a HolaHola-hosted endpoint (`POST /api/internal/source-promote`), which then dispatched the workflow. That added a reachability dependency — Replit dev restarts constantly and was never meant to have uptime guarantees, and production is exactly the live-traffic process this whole design was built to stay off of — without adding real security, since the actual push credential (`HOLAHOLA_GITHUB_DEPLOY_KEY`) never touched that endpoint either; it only ever lived in GitHub Actions secrets. GitHub's own API is already the always-on service here. Removed 2026-08-31 once this became clear from actually trying to test it against a Replit instance that wasn't reliably up.

## Required setup

One secret in `.env` (or wherever the caller actually runs — this needs no server-side secret at all now):
- `GITHUB_ACTIONS_DISPATCH_TOKEN` — a GitHub fine-grained PAT, scoped to this repo only, "Actions: Read and write" and nothing else. Used only to trigger/poll the workflow run — never touches repo-write access directly.

## Reminders

- A diverged branch is refused outright, not reconciled — fix the divergence yourself (rebase/merge) before retrying.
- `npx tsx scripts/source-promote.ts status <jobId>` re-checks a run's status later — it's stateless, resolved fresh from GitHub each time via the jobId embedded in the run's name, no local bookkeeping needed.
- This replaces ad hoc pushes to `main` for every tool — if you find yourself about to try a direct `git push origin main`, use this instead; it will likely be rejected by the ruleset anyway.
