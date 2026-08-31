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
   This calls `POST /api/internal/source-promote` on the running app, which dispatches `.github/workflows/source-promote.yml` — a GitHub Actions run, deliberately **not** the Replit process serving live Daniela/David traffic — and polls until it finishes.
3. That workflow run does the real work: refuses if `main` isn't an ancestor of the branch (diverged — no automatic reconciliation, ever), then runs the same validation a human PR gets (`npm run check`, `npm run build`, the three `test:ci:*` groups) via an ephemeral Neon branch (`npm run db:branch -- gate`, see `.agents/skills/neon-branch/SKILL.md`), and only on a full pass fast-forwards `main` and pushes using the existing deploy key over SSH.
4. `scripts/source-promote.ts push` prints the terminal result: `SYNCED` (main now includes the branch) or `FAILED` (with the run URL to inspect — nothing was pushed).

## Required setup

Two secrets in `.env` (and wherever the app actually runs — Replit Secrets):
- `SOURCE_BRIDGE_API_TOKEN` — authenticates callers to the endpoint. Same value needed by the server and by every caller.
- `GITHUB_ACTIONS_DISPATCH_TOKEN` — a GitHub fine-grained PAT, scoped to this repo only, "Actions: Read and write" and nothing else. Used only to trigger/poll the workflow run — never touches repo-write access directly.

`APP_URL` (already a standard env var for this project) tells the script which running app to call; override with `--url` if needed.

## Reminders

- A diverged branch is refused outright, not reconciled — fix the divergence yourself (rebase/merge) before retrying.
- The deploy key that actually pushes to `main` lives only in GitHub Actions secrets, never in this endpoint, never in any caller's environment.
- This replaces ad hoc pushes to `main` for every tool — if you find yourself about to try a direct `git push origin main`, use this instead; it will likely be rejected by the ruleset anyway.
