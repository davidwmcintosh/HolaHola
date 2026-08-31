# Gemini Audit — Source Promotion API

**Date:** August 27, 2026  
**Model:** `gemini-3-flash-preview`  
**Scope:** Authenticated source-promotion routes, durable idempotency ledger,
source-bridge promotion state, validation-manifest integrity, candidate expiry,
and explicit Replit Publish boundary.

## Review context

The reviews included the actual implementation from:

- `server/services/source-promotion-service.ts`
- `server/routes/source-promotion-routes.ts`
- `server/routes.ts`
- `scripts/source-bridge.sh`
- `server/scripts/test-source-promotion-api.ts`
- `server/scripts/test-source-bridge.ts`
- `docs/superpowers/specs/2026-08-27-source-promotion-api-design.md`

The review was told that Replit's official documentation exposes no supported
application API for programmatically publishing the current Repl or returning a
deployment identity. The implementation therefore prepares source and records
an authenticated operator attestation after an explicit Replit Publish; it does
not deploy.

## Review rounds

The initial Gemini review found no blocker, but its response was truncated
before an approval line. An independent architect review then identified two
fail-closed gaps:

1. the CLI record command did not enforce a full lowercase 40-hex SHA; and
2. record-promotion did not independently validate the complete manifest,
   candidate binding, check results, and deterministic validation ID.

Both gaps were fixed in the shell and API layers. Adversarial regressions were
added for invalid SHA, missing manifest, unsupported version, wrong candidate
binding, failed checks, tampered validation ID, expiry, and the valid path.

The architect re-reviewed the corrected files and returned:

> PASS — the current source-promotion API and bridge meet the specified
> invariants; no remaining blockers found.

Gemini then performed a final approval-only review of the corrected critical
paths and returned:

> APPROVED — Ship it.

## Verification supplied to the final review

- TypeScript typecheck
- production build
- canonical unit CI group
- canonical guard CI group
- canonical episode CI group
- focused source-promotion API regression
- focused source-bridge regression
- GitHub release-safety regression
- GitHub sync shell guards
- system-health verifier

## Outcome

Unconditional approval. No further implementation changes were requested.