# Gate 3 Green-Baseline Recovery Design

## Problem

The first generation-specific Windows Gate 3 run reached the production
coordinator, exchanged its bootstrap, proved founder-approved ownership, created
a packet and claim, and completed two approved tool calls. Gemini ran
`git status --short` and the exact focused test, saw a green baseline, and
stopped without inspecting or editing the target file.

The driver rejected the result because no patch existed. This was correct
fail-closed behavior, but the task artifact made the missing assertion too easy
to mistake for already-complete coverage.

## Current Test State

The target test already rejects:

- an outcome receipt from a different runtime;
- a claim from a different runtime;
- claims from two same-runtime principals with different profiles.

It does not yet reject `recordOutcomeReceipt` from `otherProfile`, which retains
Gemini's runtime registration and credential while changing only `profileId`.
That is the meaningful missing assertion.

## Task Artifact Change

Replace the broad objective with an explicit current-baseline warning and exact
delta:

- state that the focused test already passes;
- state that different-profile claim rejection assertions already exist;
- state that a passing baseline is not completion;
- require one new `expectCode` assertion around
  `fixture.service.recordOutcomeReceipt`;
- require `otherProfile`, `fixture.packet.id`, `fixture.packet.digest`,
  `fixture.interaction.id`, and a new idempotency key;
- require the exact error `consumption_not_authorized`;
- require `otherProfile` to preserve Gemini's runtime registration and
  credential while changing only the profile;
- preserve the existing claim assertions;
- retain the one-file boundary and exact focused test command.

This remains a narrow test-strengthening task. It does not authorize production
code changes.

## Static Guard

Extend the provisioning test to assert that the generated artifact contains
behavioral needles covering:

- the green-baseline warning;
- `recordOutcomeReceipt`;
- `otherProfile`;
- the runtime-registration and credential identity requirement;
- `consumption_not_authorized`;
- preservation of existing claim assertions;
- the exact target path;
- the exact focused test command.

The guard validates the assignment contract, not the eventual implementation
syntax. Gemini may still choose the assertion's local arrangement and
idempotency-key text.

## Recovery and Authority

The failed generation's bootstrap was consumed and is never retried. Its bundle,
challenge, receipt, assignment, window, packet, claim, credential, and execution
identifiers remain historical evidence only.

After the task artifact and guard are reviewed and promoted:

1. Windows fetches the new protected commit and confirms the approved branch,
   exact `HEAD`, exact `origin/main`, and a clean worktree.
2. Windows preserves the failed generation in private quarantine.
3. Windows initializes a new DPAPI `CurrentUser` credential.
4. Windows emits a new public bundle with a generation-specific runtime ID.
5. Replit creates a fresh Phase A attempt.
6. The founder approves that exact challenge.
7. Replit runs Phase B and creates a fresh frozen assignment/window.
8. Windows invokes the bounded launcher exactly once.
9. An independent hat verifies the patch, focused test, execution, completion,
   cleanup, and absence of secret exposure.

No claim is made against malicious software running as the same Windows user.

## Validation

Before promotion:

- run the focused provisioning/template test;
- run the Windows launcher boundary test if the rebuilt bundle hash changes;
- run `npm run check`;
- run the canonical protected promotion manifest;
- obtain final dual-engine Alden approval.

Task 1449 remains cancelled. This recovery does not create an installer or
productize the coordinator.