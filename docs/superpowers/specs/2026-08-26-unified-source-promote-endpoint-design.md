# Unified Source-Promote Endpoint Design

**Status: built and live (2026-08-31), not as an endpoint.** Two deliberate
deviations from the plan below, the second correcting the first:

1. The validation gate runs in an isolated GitHub Actions run
   (`.github/workflows/source-promote.yml`), not inside a HolaHola server
   process — that process also serves live Daniela/David traffic, and
   running `npm ci`/build/the full test suite there on every promotion was
   too much resource contention to accept.
2. There is no `POST /api/internal/source-promote` endpoint. The first
   attempt built one as a thin dispatch-and-poll proxy in front of the
   GitHub Actions workflow — but that made the whole mechanism only as
   reachable as whichever Replit process hosted it, and neither option was
   right: dev restarts constantly and was never meant to have uptime
   guarantees, and production is exactly the live-traffic process deviation
   1 was built to stay off of. The proxy also didn't buy any real security —
   the actual push credential (`HOLAHOLA_GITHUB_DEPLOY_KEY`) never touched
   it either way, only ever living in GitHub Actions secrets. So
   `scripts/source-promote.ts` calls the GitHub Actions API directly.
   GitHub's own API is already the always-on service here; there was
   nothing to proxy. Found this the hard way, by actually trying to test
   the endpoint version against a Replit dev instance that wasn't
   consistently up.

**Renamed 2026-08-31**: `scripts/source-promote.ts` → `scripts/cross-tool-promote.ts`,
`.github/workflows/source-promote.yml` → `.github/workflows/cross-tool-promote.yml`,
`.agents/skills/source-promote/` → `.agents/skills/cross-tool-promote/`. See
"Two entry points into `main`" below for why.

Everything else here — the state model, the fast-forward-only rule, the
narrow-scoped-token principle — is as designed, just enforced by a plain
script instead of a hosted endpoint. See
`.agents/skills/cross-tool-promote/SKILL.md` for the caller-facing how-to.

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
  3. Run the validation gate: `npm run check` (typecheck) and `npm run
     build` (compile) first as a fast fail, then the same three test groups
     the `main` ruleset's required `test` status check already runs —
     `npm run test:ci:unit`, `npm run test:ci:guards`, `npm run
     test:ci:episodes`. This is deliberately NOT the narrower
     `test:github-release-safety` check the existing bridge runs today —
     that script only statically verifies the release *tooling's own
     source* (deploy-key usage, host-key pinning) and never executes the
     application's unit tests, guard checks, or episode/North Star checks.
     Validating against anything narrower than the real CI suite would let
     a branch that fails a required status check still reach `main` through
     this endpoint's bypass-exempt deploy key — silently reopening, for
     every caller, the exact gap the `main` ruleset was built to close.
  4. Only if the branch is a clean fast-forward candidate and validation
     passes: fast-forward `main` and push, using the one deploy key this
     endpoint holds.
  5. Return a receipt immediately (`202`, pending), matching the existing
     write-ahead-log pattern from `canonical-conversation-exchange` — a
     status the caller can poll rather than a long-blocking request, since
     build+test validation takes real time.

## Test validity and resilience

This endpoint becomes the *sole* gate for every automated caller — unlike
today's PR flow, there is no human necessarily looking at the check output
before `main` moves. That raises the bar on the `test:ci:*` groups
themselves: a test that's flaky or environment-fragile is no longer a minor
annoyance a human re-runs, it's either a silent block on legitimate work or,
worse, a silent gap that lets something broken through.

Concrete precedent from tonight, not a hypothetical: the `dist/`
stale-entry guard in `scan-unwrapped-image-uploads.test.ts` failed on every
CI run for reasons unrelated to any real regression — it assumed a locally
built `dist/` directory that a fresh, unbuilt CI checkout never has. Nobody
was in danger while it was a visible PR check; the same class of bug inside
this endpoint's gate would either wrongly refuse valid branches or, if the
next fragile test happens to fail-open instead of fail-closed, wrongly
admit a broken one.

Before this endpoint goes live, the `test:ci:*` groups it depends on need:

- **Environment parity with CI, not just "runs somewhere"**: the endpoint's
  execution environment must match `ci.yml`'s assumptions exactly (same
  ephemeral Postgres service, same required secrets, no artifact — like
  `dist/` — assumed to pre-exist from a prior build step).
- **Determinism**: no test whose pass/fail depends on timing, execution
  order, or parallelism. The existing `ISOLATED_TEST_FILE` carve-out in
  `scripts/run-ci-test-steps.mjs` (giving one race-prone ownership test its
  own process) is the right pattern — any other test with the same symptom
  needs the same treatment, not a shrug.
- **Fail-closed, not fail-open, on gate infrastructure errors**: if a
  `test:ci:*` group itself errors out (times out, can't reach the DB
  service, etc.) rather than cleanly passing or failing, the endpoint must
  treat that as a refusal, never as an implicit pass.
- **An owner for the guard suite's health**: the `KNOWN_NON_SCRIPT_ROOTS`-style
  stale-entry pattern (an assumption drifting out of sync with reality)
  should get a periodic sanity sweep, not just a fix-on-discovery.

## State model

Reuse the state vocabulary `source-bridge.sh` already has, rather than
inventing a second one: `retrying`, `diverged`, `dirty`, `ready_to_promote`,
`synced`, `failed`. Same meanings, same terminal conditions. One vocabulary
for both sides.

## Migration path — superseded 2026-08-31, see "Two entry points" below

This section originally said `source-bridge.sh` would be updated to call
this endpoint instead of holding its own copy of the deploy key and push
logic — "collapsing to one real implementation that both sides use." That
didn't happen, deliberately, once Replit's own parallel system was
discovered (see below): Replit's `source-control-service.ts` is hard-wired
to *its own persistent dev checkout*, not a caller-specified branch, so this
tool's job (an arbitrary branch from an arbitrary external caller) was never
actually something it could absorb. Collapsing to one implementation was the
wrong goal; two correctly-scoped entry points is the actual design.

## Two entry points into `main`

Discovered 2026-08-31: while this endpoint (later: script) was being built,
Replit independently built its own git-promotion system —
`server/services/source-control-service.ts` +
`server/services/source-promotion-service.ts`, "source-promotion,"
`docs/superpowers/specs/2026-08-27-source-promotion-api-design.md` — neither
side aware of the other. Read in full before concluding these conflict; they
don't:

- **This tool** (`cross-tool-promote`): stateless, caller-agnostic. Any
  external tool commits and pushes an ordinary branch, then asks this to
  validate and fast-forward `main`. Works from anywhere — a laptop, a
  Codespace, any CI — because it never assumes anything about where the
  caller's checkout lives.
- **Replit's `source-promotion`**: answers a narrower, different question —
  "is *this one persistent checkout* (Replit's own dev environment) in sync
  with GitHub, and is a candidate ready for the human to explicitly click
  Replit Publish." It requires the calling process's actual working
  directory to already be on `main`; it structurally cannot take an
  arbitrary branch from an arbitrary caller. It is not Replit-API-dependent
  the way that might first suggest — it's plain git/SSH/npm, portable to
  wherever "dev" is hosted — but the *problem it solves* is inherently about
  one specific persistent checkout, not any tool's arbitrary work.

Given that, merging them would mean bolting arbitrary-caller support onto a
coordinator built and carefully invariant-checked around one persistent
checkout — a real risk to work Replit had already finished, for a
consolidation that wasn't actually buying anything. Two entry points is the
correct shape, not technical debt: a future platform with its own
host-specific constraints (Antigravity, say) could reasonably add a third.
What every such entry point should share, and what to check against when
evaluating a future one: fast-forward-only, no automatic reconciliation of a
divergent branch, and the deploy key never held by the calling agent/tool
directly.

## Security

One secret now (`SOURCE_BRIDGE_API_TOKEN` from the original plan was removed
along with the server-hosted endpoint — see the Status note at the top):

- **`GITHUB_ACTIONS_DISPATCH_TOKEN`** — a GitHub fine-grained PAT, scoped to
  this repo only, "Actions: Read and write" and nothing else. What callers
  hold to trigger/poll the workflow run. Cannot push code or read repo
  contents directly.
- **`HOLAHOLA_GITHUB_DEPLOY_KEY`** — the actual git-push credential. Lives
  only in GitHub Actions secrets, used only inside the isolated workflow run,
  never touched by any caller or by this script. Reuses the existing
  normalization logic in `scripts/github-release-ssh.sh` verbatim (armored
  single-line-to-PEM reconstruction, since hardened 2026-08-31 by Replit's
  own parallel work, backward-compatible with this script's usage) rather
  than re-implementing it.

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
- A branch that fails `npm run check`, `npm run build`, or any of the three
  `test:ci:*` groups is refused, and the failure reason (including which
  group and which check within it) is visible in the status receipt.
- A branch that passes `npm run check`/`build` but fails one of the
  `test:ci:*` groups is refused — confirms the gate isn't silently relying
  on the narrower typecheck/build/release-safety checks alone.
- Confirm the deploy key is never observable from either caller's side —
  not in logs, not in responses, not in the request path.
- A `test:ci:*` group that errors out (DB unreachable, timeout) rather than
  reporting pass/fail is treated as a refusal — deliberately break the gate
  infrastructure once to confirm the endpoint doesn't fail open.
- Run the full validation gate against the same branch 5+ times back to
  back with no code changes; every run agrees (all pass or all refuse for
  the same reason) — a flaky disagreement here is a gate bug, not noise.
- After Replit's bridge migrates onto this endpoint, confirm its existing
  behavior (state file, summary output, retry/backoff) is unchanged from
  the caller's perspective, even though the underlying push logic moved.

## Review

No mandatory Gemini gate — this doesn't touch prompt context injection or
the neural network. Real review still expected: pass this doc to Alden and
Luca [Replit] before building, given it's the one place in the system that
would hold write-and-bypass power over `main`. Gemini's welcome in that
review too, just not required by the standing rule.
