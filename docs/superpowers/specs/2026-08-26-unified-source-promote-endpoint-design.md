# Unified Source-Promote Endpoint Design

## Goal

Replace two separate implementations of "get committed work onto `main`
safely" — Replit's existing `source-bridge.sh`/`sync-to-github.sh` and
whatever Claude Code would otherwise build for itself — with one shared,
centrally-hosted endpoint that both sides call identically. One place holds
the rules. One place holds the GitHub deploy key. No caller, from either
side, ever holds it directly.

This follows the same shape already proven working tonight for
`/api/internal/canonical-conversation-exchange`: a `source: 'replit' |
'claude-code'`-tagged request against one shared, token-authenticated
endpoint, rather than parallel per-caller implementations that can quietly
drift apart from each other (the exact failure mode already found tonight in
`server/db.ts` vs `server/neon-db.ts`).

## Scope

- New endpoint: `POST /api/internal/source-promote`.
- Auth: same token tier as `REPLIT_AGENT_TOKEN` (or a dedicated token scoped
  to just this capability — open question, see below). Never the GitHub
  deploy key itself; callers never hold that.
- Request: `{ source: 'replit' | 'claude-code', branch: string }`.
- Caller responsibility, before calling: commit locally, push the named
  branch to GitHub normally. Pushing a non-`main` branch is unrestricted by
  the new ruleset — no special credential needed for that step.
- Endpoint responsibility, and only the endpoint's:
  1. Fetch the named branch and current `main`.
  2. Refuse (do not attempt to resolve) if `main` and the branch have
     diverged — mirrors `source-bridge.sh`'s existing `diverged` state
     exactly; no automatic reconciliation, ever.
  3. Run the validation gate: `npm run check`, `npm run build`,
     `test:github-release-safety` — the same checks the existing bridge
     already runs.
  4. Only if the branch is a clean fast-forward candidate and validation
     passes: fast-forward `main` and push, using the one deploy key this
     endpoint holds.
  5. Return a receipt immediately (`202`, pending), matching the existing
     write-ahead-log pattern from `canonical-conversation-exchange` — a
     status the caller can poll rather than a long-blocking request, since
     build+test validation takes real time.

## State model

Reuse the state vocabulary `source-bridge.sh` already has, rather than
inventing a second one: `retrying`, `diverged`, `dirty`, `ready_to_promote`,
`synced`, `failed`. Same meanings, same terminal conditions. One vocabulary
for both sides.

## Migration path

`source-bridge.sh` itself gets updated to call this endpoint instead of
holding its own copy of the deploy key and push logic. This is not "add a
second path for Claude Code alongside the existing Replit one" — it is
collapsing to one real implementation that both sides use. Sequencing:
build and verify the endpoint against Claude Code's use case first (lower
risk, not yet load-bearing for production sync), then migrate Replit's
bridge onto it once proven, rather than changing both at once.

## Security

Two secrets, deliberately distinct so a compromise of one doesn't grant the
other:

- **`SOURCE_BRIDGE_API_TOKEN`** (new) — what callers authenticate to the
  endpoint with. Names what it's for, not what platform created it; not tied
  to Replit the way `REPLIT_AGENT_TOKEN` is, on purpose, given the direction
  of this whole effort. Callers never see or hold a GitHub credential.
- **`HOLAHOLA_GITHUB_DEPLOY_KEY`** (existing, reused as-is for now) — the
  endpoint's own git-push credential. Relocated so only the endpoint's
  environment holds it; Replit's bridge stops materializing it directly once
  migrated. Reuses the existing normalization logic in
  `scripts/github-release-ssh.sh` verbatim (armored single-line-to-PEM
  reconstruction) rather than re-implementing it — that problem is already
  solved, no reason to solve it twice.

**Deliberate, named future work — not forgotten, not done now:** once this
endpoint is live and Replit's bridge has migrated onto it, rotate to a
dedicated deploy key created specifically for this endpoint, and revoke
`HOLAHOLA_GITHUB_DEPLOY_KEY`. Reusing the existing key now is the right
minimal-disruption starting point; treating that as the permanent state
would mean the new, centralized system quietly inherits a credential that
predates the redesign, with no clean boundary marking why it exists. Track
as a follow-up task once Path 1 is proven working, not before.

## Non-goals

- Does not touch Daniela's prompt context injection or neural network — no
  Gemini approval gate applies per `replit.md`'s scoped rule (confirmed by
  re-reading the rule directly, not assumed).
- Does not change how the `main` ruleset itself works (PR required,
  deploy-key bypass) — this endpoint is what legitimately uses that bypass,
  not a way around it.
- Does not remove the ability to push an ordinary feature branch normally;
  only promotion to `main` is centralized.

## Verification

- A Claude Code-sourced branch and a Replit-sourced branch both promote
  correctly through the same endpoint, producing identical `main` history.
- A deliberately diverged branch is refused, not silently reconciled.
- A branch that fails `npm run check`/build/release-safety is refused, and
  the failure reason is visible in the status receipt.
- Confirm the deploy key is never observable from either caller's side —
  not in logs, not in responses, not in the request path.
- After Replit's bridge migrates onto this endpoint, confirm its existing
  behavior (state file, summary output, retry/backoff) is unchanged from
  the caller's perspective, even though the underlying push logic moved.

## Review

No mandatory Gemini gate — this doesn't touch prompt context injection or
the neural network. Real review still expected: pass this doc to Alden and
Luca [Replit] before building, given it's the one place in the system that
would hold write-and-bypass power over `main`. Gemini's welcome in that
review too, just not required by the standing rule.
