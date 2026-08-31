# Source Promotion API

## Status

Implemented v1 design. Production publishing remains an explicit Replit action.

## Platform boundary

Replit's supported publishing flow is user-initiated in the Workspace. Replit
does not expose a supported application API that can publish the current Repl
or return a deployment identity to this server. The source-promotion API
therefore does not deploy, emulate the Publish UI, or call undocumented Replit
interfaces.

The API has three responsibilities:

1. report bridge and promotion-request state;
2. prepare an exact source candidate using the existing bridge;
3. record an authenticated operator attestation after explicit Publish.

The recorded attestation is intentionally not described as independent
deployment verification.

## Authority and authentication

The API is disabled by default and its operational routes are not mounted
unless both:

- `SOURCE_PROMOTION_API_ENABLED=true`; and
- a dedicated `SOURCE_PROMOTION_TOKEN` secret is available.

The token is compared in constant time. It is separate from
`REPLIT_AGENT_TOKEN` so ordinary agent authority does not imply production
source-promotion authority. Mutation requests also require a validated actor
label for audit attribution and a mandatory idempotency key.

When disabled or misconfigured, the reserved API prefix returns an explicit
JSON 404 denial instead of falling through to the application's SPA HTML.

## Execution boundary

The HTTP layer never runs caller-provided commands. It invokes only these fixed
arguments with `execFile`:

- `bash scripts/source-bridge.sh prepare-promotion`
- `bash scripts/source-bridge.sh record-promotion <validated-40-hex-sha>`

`source-bridge.sh` remains the sole Git mutator. Its existing advisory lock,
SSH transport, clean-tree checks, fresh fetch, ancestry checks, fast-forward
rules, and exact-SHA checks remain authoritative.

## Durable request state

Each idempotency key is stored only as a SHA-256 hash in a private local request
record. The payload has a separate digest. An exact retry returns the existing
record; reuse with a different action or payload fails with conflict.

Request states are:

- `accepted`
- `running`
- `succeeded`
- `failed`
- `ambiguous`

If the application restarts while a request is accepted or running, the next
read marks it `ambiguous`. It is never silently retried. The operator must first
inspect the bridge status, then use a new idempotency key only when the outcome
is understood.

## Candidate and validation rules

Validation manifest version 2 contains:

- TypeScript typecheck;
- production build;
- canonical unit, guard, and episode CI groups;
- source-bridge safety;
- GitHub release safety;
- GitHub sync shell guards.

The manifest is bound to the candidate SHA and receives a deterministic
validation ID. After validation, the bridge fetches again and proves the
validated SHA is still the exact equal Replit/GitHub head. The resulting
candidate expires after one hour by default.

Recording refuses a dirty, changed, unequal, stale, expired, or non-ready
candidate. It also requires the exact candidate SHA supplied by the
authenticated caller.

## Rollout

The existing CLI promotion commands remain supported. This API does not replace
the source-bridge workflow. Enabling the HTTP surface and migrating an external
caller are separate operational decisions made only after validation.