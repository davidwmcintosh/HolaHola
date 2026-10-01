# Runtime onboarding — implementation review and remaining gates

## Review boundary

This document reviews the implementation record, not a production release.
The approved design remains
[`2026-10-01-reusable-runtime-onboarding-design.md`](superpowers/specs/2026-10-01-reusable-runtime-onboarding-design.md),
document `6f181485-4263-41f5-b952-670415f884d6`, revision
`e07a22ad-07bd-47aa-b931-899f6b3699ca`, approved review
`b9fc8404-bcde-412d-a108-f2baf326930b`. It is immutable and was not edited or
re-approved by this implementation review. This new document does not change
that approval or constitute independent review of this implementation.

The backend, client, founder UI, identity wiring, and OpenAI Responses adapter
are implemented in the working source tree. The corrected full isolated gate
passed and reviewed migration 0064 was applied to the verified UNPOOLED shared
target. A subsequent backend-only startup-order correction passed its focused
checks and typecheck but was not rerun through the full gate. Separate
live-device checks remain pending; this is not a supported live installation
or released package.

## Implementation summary

### Standalone client package

`scripts/build-runtime-onboarding-package.mjs` builds a self-contained Node.js
20+ package containing:

- `bin/holahola-onboarding.mjs` — `setup`, `status`, `mcp`, and `sdk` commands;
- `lib/runtime-onboarding-sdk.mjs` — importable OpenAI Responses adapter;
- `scripts/runtime-onboarding-native-store.ps1` — Windows DPAPI adapter;
- `package.json` and `README.txt`; and
- `manifest.json` — source revision, source-dirty/release flags, and SHA-256
  hashes for the package files.

The bundle targets Node 20 and includes its SDK dependencies. The destination
needs Node 20, but does not need `tsx`, `npm install`, or Coordinator V2's
execution closure. Release mode refuses a dirty source tree. A package and its
co-located manifest are not an independent source/trust pin: build only from
the reviewed source revision, then compare source and files against an
independently trusted release record. No release build or artifact publication
is claimed here.

### Enrollment, identity, and custody

The onboarding service/client flow binds endpoint origin, actor, runtime ID,
invitation, request, public-key fingerprint, challenge nonce, and proof
purpose. The client signs the exact returned canonical challenge bytes with a
locally generated proof key. The server returns a scoped credential only after
the approved proof flow. The helper has no token export action or plaintext
file fallback, and reports bounded secret-safe errors.

Durability safeguards include invitation expiry being independent from the
already-enrolled key's recovery path, exact same-key replay after a lost first
request response, bounded canonical endpoint proofs, safe capability profiles,
and atomic native key initialization. Credentials remain scoped to endpoint,
actor, and runtime. Native adapter source exists for Windows, macOS, and Linux;
hosted use requires an explicitly runtime-restricted adapter with atomic
`setIfAbsent`.

The founder UI displays invitation/request expiry, verifies the request's
actor, runtime, capabilities, verification code, and fingerprint, and presents
historical server-derived ledger-read evidence. A successful authenticated
threads/inbox read can record `runtime_onboarding_ledger_read` for the matching
enrolled runtime. That evidence is historical, not a current-connection
indicator; it is not inferred from renewal or `lastUsedAt`. Inbox
acknowledgement remains separate from authentication, and neither inbox
acknowledgement nor onboarding ledger-read evidence is Coordinator V2
execution.

### OpenAI Responses and MCP

`createRuntimeOpenAIResponsesClient` accepts an already-authorized injected
OpenAI SDK instance and adapts `responses.create(...)` to use the enrolled
coordination MCP server. The coordination credential is loaded from the
scoped store and added only to the fixed remote MCP `Authorization: Bearer`
header; the adapter does not accept, return, export, or print the OpenAI
platform API key or coordination credential. The caller's OpenAI SDK/key
remains host-managed.

The remote MCP endpoint is fixed to the trusted endpoint origin and
`/api/mcp/coordination`. Remote MCP tool approval is always mandatory;
`allowedTools` is optional narrowing only. Callers cannot override the
coordination MCP tool or use an alternate MCP server through this adapter.
This actual Responses API adapter is distinct from the CLI `sdk` action, which
is a safe authenticated coordination/MCP read check. Hermetic tests do not
prove a live OpenAI API call or an IDE's integration.

## Existing boundaries preserved

- Existing Coordinator V2 execution behavior, source pin, invocation, and
  identity reset are unchanged.
- Onboarding adds no source/runtime publication or deployment.
- No onboarding invitation or scoped onboarding credential has been issued.
- The development public endpoint is configured by
  `COORDINATION_PUBLIC_ENDPOINT` only; this is not production endpoint evidence.
- Reviewed onboarding migration 0064 was applied to the verified UNPOOLED
  shared target after the complete isolated gate passed. That shared schema
  serves both environments; this did not publish application source/runtime.
- The later startup-order correction changes no schema and requires no second
  migration.

## Verification record

| Area | Current evidence | Status |
| --- | --- | --- |
| Linux native-store locking | The Linux `flock` mixed-XDG fixture is reported verified. | Narrow fixture evidence only. |
| Windows DPAPI/ACL | Adapter source exists. | Real Windows verification pending; the known Windows count issue remains unresolved. |
| macOS Keychain | Adapter source exists. | Real macOS verification pending. |
| Linux Secret Service | Adapter source exists. | Live Secret Service verification pending. |
| Runtime clients | CLI, stdio bridge, and OpenAI Responses adapter source/tests exist. | Real Cursor/OpenAI Agents client smoke tests pending. |
| OpenAI Responses | Adapter delegates to an injected SDK; isolated coverage exists. | Real authorized SDK/API invocation pending; no key is supplied by onboarding. |
| Backend/client/UI/identity checks | Full-project typecheck passes. Earlier focused evidence includes 20 client/SDK tests, five route/domain checks, catalogue and actor-completeness checks; latest 13 targeted runtime/SDK/restricted tests and two response-log tests passed. Startup-order AST/Passport checks passed 3/3, the existing route test 1/1, and typecheck passed. | Startup-order tests are wired to CI; the full gate was not rerun after this backend-only fix. Founder UI fixture pass is not a live authenticated view. |
| Independent review | Gemini source reviews `5aceedde-167d-4ecc-a5f8-c163e3252bb1` and `119fb593-4dff-47d6-8115-ec9535ba13a7` approved their respective source scopes; the latter is limited to startup ordering. | Source review does not certify a native client or authorize publication. |
| Generated helper | Development package at `/tmp/runtime-onboarding-dev.KL0vBf/package`; manifest verified 5/5 and reproducibility check passed once. Backend route source is not bundled, so the route-order correction required no package rebuild. | Artifact remains `sourceDirty=true`, `release=false`; not final, released, or distributable as an approved release. |
| Response logging | Sensitive-family omission follows URL-path/backslash canonicalization and bounded, fail-closed decoding before JSON serialization. | Logging exclusions do not establish reachability properties for proxies or unshown handlers. |
| Database migration | Corrected full gate `kc5EhlOi` exited 0 with `READY_TO_PROMOTE`; it ran 177 CI commands plus formal PostgreSQL/data-operation proofs. | Reviewed migration 0064 was applied once with `npx drizzle-kit migrate` on the verified UNPOOLED shared target; its hash registered once in `drizzle.__drizzle_migrations`, and all three onboarding tables are present. |
| Release/source pin | Builder creates source/hash metadata and refuses dirty release builds. | No clean reviewed release artifact, independent pin, or publication claimed. |

Latest route and logging hardening canonicalizes public Fetch route case,
encoding, decoded separators, and dot segments before store or network access.
The global logging policy canonicalizes backslashes and URL paths, applies
bounded eight-pass decoding with fail-closed handling, then omits sensitive
families. The two malformed-source tests assert zero store/fetch calls; other
denied-source tests assert zero fetch calls; the compiled smoke asserted zero
store and fetch calls for 19 denied routes. A read-only near-expiry mock made
one SDK call with no renewal or network access. No proxy or unshown-handler
reachability claim is made.

The first full-gate lifecycle-reaper failure was a global count, not a finding
that onboarding caused the extra sessions: at least three were created by
earlier suites in that same gate (transport lease, host authorization, and
Windows generation); the fourth origin is unproven. A fresh focused-only
baseline passed, while adding one synthetic unrelated stale session reproduced
3 vs 2. The fixture-only correction retains and strengthens checks for exact
owned states, reasons, cleanup, lease, and live protections. The corrected full
gate passed; disposable branch `test/migration-2026-10-01T18-49-21-376Z` was
deleted. It completed before the backend-only startup-order follow-up below and
does not cover that later change.

## Startup-order follow-up and readiness

After the gate, a live anonymous onboarding/admin GET hung because onboarding
routes had been registered before setup of session Passport/auth. The route
registration was moved to after `await setupAuth` and `await setupGoogleAuth`,
before `coordPolicy`. The schema is unchanged; no second migration is needed.
An AST test checks actual ordering, comments, and hoist mutation, and exercises
the real Passport/default-founder chain to assert anonymous 401 and zero
onboarding-service calls. The three focused checks passed 3/3, the existing
route check passed 1/1, typecheck passed, and these checks are wired to CI.
Gemini review `119fb593-4dff-47d6-8115-ec9535ba13a7` approved this narrow
startup-order scope. The full gate was not rerun after this fix.

After the follow-up fix, a second development restart completed. Startup
readiness checks returned root 200 in 111 ms, anonymous admin 401 in 142 ms,
and an own Replit legacy-token Alden read 403 in 45 ms as expected under the
Alden/David allowlist; no impersonation occurred. A screenshot showed the
healthy public landing page and expected auth response. No actual
founder-cookie/API view was tested; the earlier fixture-based founder browser
pass had no second tester.

Relevant implementation and test surfaces include:

- `server/services/runtime-onboarding-service.ts`,
  `server/services/runtime-onboarding-store.ts`,
  `server/services/runtime-onboarding-client.ts`, and
  `server/services/runtime-onboarding-transports.ts`;
- `server/services/runtime-onboarding-openai-sdk.ts`;
- `server/routes/runtime-onboarding-routes.ts` and
  `client/src/pages/admin/RuntimeOnboarding.tsx`;
- `server/scripts/runtime-onboarding-cli.ts`,
  `server/scripts/runtime-onboarding-native-store.ps1`, and
  `scripts/build-runtime-onboarding-package.mjs`; and
- the corresponding `runtime-onboarding*.test.ts` files and
  `scripts/build-runtime-onboarding-package.test.mjs`.

## Required follow-up gates

1. Preserve the focused backend, client, route, SDK, and package checks plus
   `npm run typecheck` outcomes recorded above; rerun if subsequent changes
   affect those surfaces.
2. The corrected full gate passed and migration 0064 is applied. Do not repeat
   the migration for the schema-unchanged startup-order follow-up.
3. Complete a real authenticated founder-cookie/API view with an authorized
   tester before claiming founder-UI verification. The verified root and
   anonymous 401 responses establish startup readiness, not authenticated UI
   behavior or production availability.
4. Perform separate real Windows, macOS, and Linux Secret Service checks, and
   real Cursor/OpenAI Agents client smoke tests with explicitly authorized,
   appropriately scoped, revocable test credentials. Record exactly which
   operating system/client combination was tested.
5. Verify an actual OpenAI Responses call with the host's authorized SDK and
   confirm the remote MCP approval behavior. Do not pass the host's OpenAI key
   to onboarding or claim the hermetic adapter tests are a live-provider test.
6. Build release artifacts only from a reviewed clean source revision, validate
   the source pin and hashes independently, and use the authorized publication
   process. Do not publish while any prior gate is pending.

## Operator runbook

See [`runtime-onboarding-clients.md`](runtime-onboarding-clients.md) for the
client contract, package build/install boundary, enrollment/resume flow, native
store details, CLI commands, MCP configuration, and injected OpenAI SDK usage.
This runbook is instructions for a future authorized installation; it does not
issue invitations or credentials.

## Review disposition

This local report is a mutable companion to canonical implementation record
`d5959654-d61d-4c98-822f-22f7d23a68c5`. Revision
`092f91ad-4fc1-4206-8b51-0dd70fb2404c` and review
`930b460d-8edc-43bb-8d80-4055d88a4df1` are the current independently approved
snapshot. Main verified via GET the exact revision, `approved` state, and
`decisionActorId` `alden`. This approval is not release approval. This mutable
companion is not a governed generated live-instruction document; this approval
breadcrumb requires no new canonical revision and no canonical bytes were
changed. No source or runtime publication is claimed. The approved design
revision cited above remains unchanged.