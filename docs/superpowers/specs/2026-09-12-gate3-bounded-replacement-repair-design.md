# Gate 3 bounded replacement and durable continuation repair

## Status

Draft for founder review. No new Windows generation may be provisioned until this design is implemented, independently reviewed, published, and verified in production.

## Problem statement

The first post-baseline Windows Gate 3 generation consumed its one-shot bootstrap and then failed after two successful model/tool turns. PostgreSQL proves that credential exchange, founder proof, packet creation, claim acquisition, `git_status`, and `read_file` succeeded. The second continuation committed the `read_file` result but produced no turn-3 interaction, execution, or completion.

Three defects are established from the production code and durable evidence:

1. The immutable assignment payload carries only generic task metadata and approved digests. It does not carry the exact approved task artifact text, so Gemini is not told the precise missing assertion.
2. Gate 3 asks `write_file` to return an entire file. The target is 30,927 bytes, while normalization truncates string arguments at 20,000 characters. A valid whole-file response can therefore be corrupted before execution, and long verbatim output also risks provider output limits or recitation blocking.
3. `withGate3ProofGrantAuthority` owns the outer PostgreSQL transaction. When `recordInteraction` saves durable rejection evidence and then throws, that error escapes the authority callback and rolls back the rejection interaction, claim violation, and idempotency row. The comments promise surviving rejection evidence, but the production transaction boundary defeats that promise.

## Invariants

- PostgreSQL remains canonical authority.
- GitHub remains the approved immutable source snapshot.
- Founder approval remains bound to the exact task artifact, runtime profile, credential generation, and source commit.
- Windows may modify only `server/scripts/test-coordination-runtime.test.ts`.
- Windows may run exactly `npx tsx server/scripts/test-coordination-runtime.test.ts` as the proof test.
- Windows makes no commit and receives no long-lived or broker credential.
- A one-shot bootstrap is consumed regardless of success and is never restored.
- No identifier, credential, challenge, assignment, receipt, packet, claim, or generation from the failed run is reused.
- The design makes no claim of protection from malicious software running as the same Windows user.

## Design

### 1. Bind the exact task text into the assignment window

The assignment-window producer reads the exact prepared task artifact bytes from the canonical Gate 3 task path. Before creating any coordination event, it computes SHA-256 over those bytes and requires equality with the bundle's approved `artifactSha256`.

The immutable assignment payload includes a `taskArtifact` object containing:

- the verified SHA-256 digest;
- the exact UTF-8 task text.

Replay validation requires the same complete payload shape and bytes. The task text therefore enters the frozen inbox item, packet digest, ownership context, and Gemini request without trusting caller-supplied prose. A stale, missing, non-UTF-8, symlinked, or digest-mismatched task artifact fails before any assignment event is created.

### 2. Replace whole-file mutation with `replace_once`

The Gate 3 Gemini declaration exposes a fixed-target `replace_once` tool instead of `write_file`.

Arguments:

- `oldText`: non-empty exact source snippet;
- `newText`: replacement source snippet.

Policy:

- exactly those two string arguments are allowed;
- `oldText` and `newText` must differ;
- combined UTF-8 argument bytes are bounded by the existing 40,960-byte patch budget;
- the target path remains hardcoded to `server/scripts/test-coordination-runtime.test.ts` and is never model-controlled;
- `oldText` must occur exactly once in the current file;
- the replacement may not introduce a second changed path;
- the resulting Git diff must remain non-empty and within 40,960 bytes;
- the existing starting branch, starting commit, worktree digest, clean-tree, exact-test, and no-commit attestations remain unchanged.

The executor reads the current target, counts exact matches, applies one replacement in memory, writes the result once, and returns only bounded metadata and digests. It never returns or logs replacement content as execution output.

`read_file` remains fixed-target. Its full canonical result stays in PostgreSQL. Only the bounded model-facing evidence view may be truncated; the required change is in the first 20,000 characters, and `replace_once` needs only the local snippet around that change.

### 3. Preserve expected rejection evidence without weakening authority

The authority transaction remains the lock and revocation boundary for every protected continuation.

Inside the authority callback:

- append and validate the submitted tool-result batch;
- call the Gemini continuation and record normalized attempts;
- if `recordInteraction` returns an expected protocol rejection that has already written a rejected interaction and terminal claim event, catch only the explicit durable-rejection codes and return a tagged internal result instead of throwing;
- allow the outer authority transaction to commit;
- after `withGate3ProofGrantAuthority` returns, translate the tagged result back into the same public protocol error.

Unexpected provider, database, ownership, or infrastructure exceptions are not converted. They escape the authority callback, causing the whole continuation transaction—including the submitted tool-result batch—to roll back. This prevents the observed partial state.

The explicit durable-rejection allowlist is limited to errors whose rejection interaction and terminal claim evidence were written by `recordInteraction` in that transaction. No broad catch may commit ambiguous partial state.

### 4. Failed-generation cleanup

The failed runtime generation is historical evidence and is never reactivated. After the repair is published, verification must prove its credential is expired or revoked, its claim is no longer executable, and it produced no execution/completion. Cleanup must preserve immutable audit rows.

A subsequent attempt starts from a new Windows DPAPI initialization and uses entirely new bootstrap material, runtime ID, profile ID, attempt ID, challenge, founder receipt, assignment attempt, thread, event, inbox item, window, packet, claim, credential, and model interactions.

## Error handling

- Missing or mismatched task bytes: assignment creation fails before any event/window mutation.
- Non-unique `oldText`: local tool result is rejected; the claim becomes terminal with durable evidence.
- Oversized replacement arguments: provider intent is rejected before Windows execution; the claim becomes terminal with durable evidence.
- Unexpected continuation failure: the whole continuation transaction rolls back, including that request's tool-result batch.
- Expected provider-policy rejection: rejection interaction and claim violation commit, then the route returns the public error.
- Test failure, empty diff, multiple changed files, wrong branch/head, or changed task artifact: execution is denied and no completion is issued.

## Verification

### Focused tests

1. Assignment payload includes exact task bytes and digest; any byte drift fails before event creation.
2. Replay validation rejects missing, changed, or digest-only task payloads.
3. Gemini request contains the exact approved task text.
4. `replace_once` accepts one exact bounded replacement and changes only the fixed target.
5. It rejects zero matches, multiple matches, identical old/new text, extra arguments, oversized arguments, and path-like arguments.
6. The fixed Windows test command is still the only allowed command.
7. A malformed turn-3 intent commits one rejected interaction, one terminal claim event, and its idempotency record before the route returns an error.
8. An unexpected turn-3 infrastructure/database failure rolls back the request's tool-result batch and leaves no partial interaction.
9. The original task-1448 behavioral self-check still proves the required same-runtime/same-credential/different-profile `recordOutcomeReceipt` assertion is absent before Windows and present afterward.

### Repository checks

- Focused coordinator and provisioning suites.
- `npm run typecheck` with no new errors.
- `npx tsx server/scripts/verify-system-health.ts` with zero failures.
- Independent Gemini review and Alden review of the actual final code until unconditional approval.

### Fresh Windows proof

The fresh run must produce:

- exactly one modified file: `server/scripts/test-coordination-runtime.test.ts`;
- the precise missing `recordOutcomeReceipt(otherProfile, ...)` rejection assertion with expected code `consumption_not_authorized`;
- preservation of the existing claim assertions;
- a passing exact focused command: `npx tsx server/scripts/test-coordination-runtime.test.ts`;
- durable packet, interaction, tool-result, claim, execution, and completion records bound to the fresh generation;
- independent verification of patch bytes, changed path, branch/head invariants, cleanup, and no-secret evidence;
- no Windows commit.

## Out of scope

- Installer or productization work; task 1449 remains cancelled.
- Alden tool repair task 1450.
- General-purpose arbitrary patching or shell execution.
- Protection against malicious software running as the same Windows user.