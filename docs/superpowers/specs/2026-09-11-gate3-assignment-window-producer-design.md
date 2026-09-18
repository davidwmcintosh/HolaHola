# Gate 3 Assignment and Frozen-Window Producer

**Date:** September 11, 2026  
**Status:** Approved for implementation  
**Scope:** The missing trusted production bridge for task 1448 only

## Problem

Gate 3 recovery now preserves the stable Antigravity runtime and profile and
can replace a consumed bootstrap under fresh founder authority. The next
runtime step requires a canonical task assignment in a frozen runtime inbox
window.

Production currently has no producer for that projection.
`createCoordinationThread()` writes the canonical ledger and ordinary inbox.
`PostgresCoordinationRuntimeRepository.addInboxItem()` and
`freezeInboxWindow()` write the runtime projection, but only tests call them.
The runtime HTTP routes correctly consume an existing frozen window and must
not gain authority to create one.

Calling the repository methods manually would create unauthenticated,
unaudited operational authority outside the canonical ledger. The recovered
Windows bootstrap is one-shot and must not be consumed while this gap exists.

## Decision

Add a dedicated trusted operator service and CLI for the fixed Gate 3
assignment. Do not add a public HTTP endpoint and do not extend the generic
coordination CLI.

The CLI accepts:

- the validated public provisioning bundle path;
- an active founder receipt ID;
- a canonical lowercase UUID assignment-attempt ID.

Task, actor, runtime, profile, assignment author, target file, starting commit,
and all execution bounds remain fixed by the existing Gate 3 contracts.

## Canonical data flow

The service runs one shared-PostgreSQL transaction under ordered advisory locks
for the runtime and assignment attempt.

1. Validate the public bundle with the existing bundle validator.
2. Lock and reread the fixed runtime registration and active profile.
3. Validate the active founder receipt and its challenge against task `1448`,
   actor `luca-gemini`, artifact digest, public key, fingerprint, bundle context
   digest, and expiry.
4. Validate recovery lineage:
   - the latest successful `runtime_bootstrap_recovered` audit names this
     bundle digest and replacement bootstrap digest;
   - the registration still holds that unconsumed replacement digest;
   - registration and profile metadata still match the bundle;
   - no live runtime credential or Gate 3 proof grant exists.
5. Reject any packet history for the fixed runtime. Packet absence subsumes
   claim, interaction, execution, completion, and verification absence because
   those records require a packet lineage.
6. Create a new canonical coordination thread through
   `createCoordinationThread(..., tx)` as `luca-replit`, addressed to
   `luca-gemini`, with a fixed task-1448 title/description and a `created`
   event payload:

   ```json
   {
     "kind": "gate3_assignment",
     "receiptId": "ACTIVE_FOUNDER_RECEIPT_ID",
     "artifactSha256": "APPROVED_TASK_ARTIFACT_SHA256",
     "bundleDigest": "APPROVED_PUBLIC_BUNDLE_DIGEST",
     "content": {
       "assignment": {
         "author": "luca-replit",
         "taskId": "1448",
         "expectedSequence": 1
       }
     }
   }
   ```

   The payload deliberately omits `threadId`. The existing runtime packet
   route derives it from the immutable runtime inbox item when the assignment
   payload omits it.
7. Materialize that exact canonical event into
   `coordination_runtime_inbox_window_items`. The projection copies the event
   ID, thread ID, task ID, sequence, and payload; it does not author new
   assignment content.
8. Freeze a one-item window from sequence `0` through `1` with a fresh
   non-secret boundary token.
9. Record a successful non-secret credential audit containing only the
   assignment attempt ID, receipt ID, thread/event/window IDs, window digest,
   artifact digest, and bundle digest.
10. Commit all rows together or roll back all rows.

The ordinary inbox item created by the canonical ledger remains part of the
normal coordination record. The runtime projection is an immutable,
digest-bound view of the same event.

## Idempotency

The canonical event idempotency key is:

```text
gate3-assignment:${bundleDigest}:${assignmentAttemptId}
```

The service also takes an advisory lock on that value.

- Before evaluating new-authority preconditions, an exact completed attempt is
  reread and verified against its canonical event, runtime item, frozen window,
  receipt, artifact digest, and bundle digest. It returns the same thread,
  event, item, and window without writing.
- This exact replay remains readable after its packet is created. It cannot
  create or replace authority.
- A changed bundle or receipt binding with the same attempt ID fails.
- A new attempt ID creates fresh authority only if all preconditions still
  hold.
- An existing canonical event without its exact runtime item/window is treated
  as corruption. The service never fills a partial prior attempt.

The first transaction creates the ledger event, runtime projection, frozen
window, and audit. A successful exact retry performs no writes. The packet
history gate applies to new attempts, not to verified reads of the already
completed attempt.

## Authority and failure rules

The service fails closed when:

- the attempt ID is missing, non-canonical, or reused with changed bindings;
- the bundle is invalid or differs from the active profile;
- the receipt/challenge is missing, inactive, expired, revoked, or mismatched;
- Phase B recovery lineage is absent or does not bind the current registration
  digest to this bundle;
- the recovered bootstrap has already been consumed;
- a live credential or proof grant exists;
- any packet exists for the fixed runtime;
- task, actor, runtime, profile, artifact, branch, starting commit, worktree, or
  public-key bindings differ;
- the canonical ledger event, runtime projection, sequence, or window digest
  cannot be created atomically;
- task 1449 is supplied or inferred.

The service does not decrypt, receive, read, hash, rotate, or consume the
Windows bootstrap. It handles only public digests and non-secret authority IDs.

## CLI output

On success the CLI prints one JSON object containing only:

- assignment attempt ID;
- thread ID;
- assignment event ID;
- runtime inbox item ID;
- window ID and boundary digest;
- expected sequence;
- receipt ID;
- artifact digest;
- bundle digest.

It closes its own database connections before exit. Errors use fixed public
codes and never serialize bundle contents, database rows, credentials, keys, or
tokens.

## Verification

Use a fresh disposable PostgreSQL database. Tests must prove:

1. Invalid attempt IDs and bundles create zero rows.
2. Missing, expired, revoked, and mismatched receipts create zero rows.
3. Missing or mismatched recovery lineage creates zero rows.
4. Consumed bootstrap, live credential, live grant, or packet history blocks
   creation.
5. The successful transaction creates one canonical thread/event, one exact
   runtime projection, one frozen window, one ordinary inbox item, and one
   non-secret audit.
6. Every assignment and window field is bound to the canonical event and
   founder receipt.
7. Same-attempt retry returns the exact same IDs and creates no additional
   rows.
8. Changed payload under the same attempt fails.
9. Forced failure at each write boundary rolls back the entire operation.
10. Concurrent same-attempt calls have exactly one writer and one compatible
    replay.
11. The real CLI rejects invalid arguments, returns only the public allowlist,
    and exits without a hanging pool.
12. Existing runtime, broker, recovery, and Gate 3 tests remain green.

TypeScript and system health must pass. The actual final diff requires
unconditional Alden Anthropic, Alden Gemini, and independent architecture
approval before commit.

## Operational continuation

After this producer is published:

1. Create and approve fresh founder authority if the current receipt lacks more
   than ten minutes thirty seconds of remaining life.
2. Run Phase B with the unchanged public bundle. `replayed` is the expected
   compatible result after the already successful recovery.
3. Run the trusted assignment/window CLI with a new assignment-attempt UUID.
4. Confirm Windows reports `ANTIGRAVITY_GATE3_READY`, the worktree is clean,
   and `HEAD` is the approved starting commit.
5. Supply the new window ID, receipt ID, and artifact digest as non-secret
   launcher inputs.
6. Run the fixed Windows launcher exactly once.
7. Require packet, model-consumption, diff, exact focused-test, claim,
   execution, completion, cleanup, and no-secret evidence.
8. Obtain independent cross-hat verification before declaring Gate 3 complete.

Task 1449 remains cancelled. This design does not productize the coordinator.