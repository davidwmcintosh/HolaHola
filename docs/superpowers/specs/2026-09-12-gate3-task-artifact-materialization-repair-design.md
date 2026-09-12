# Gate 3 task-artifact materialization repair

## Problem

Windows preparation reads the checked-in task 1448 template, requires one
`__FINAL_STARTING_COMMIT__` placeholder, replaces it with the approved Git
starting commit, and hashes the resulting UTF-8 artifact.

The assignment-window producer currently hashes the raw template bytes. A real
bundle therefore cannot match the server artifact even when both sides use the
same checked-in source and starting commit. The producer fails closed with
`artifact_digest_mismatch` before creating an assignment or frozen window.

## Required invariant

The approved task artifact is the exact UTF-8 byte sequence obtained by:

1. Reading the checked-in task 1448 template through the bounded, no-follow
   file path.
2. Decoding it as strict UTF-8.
3. Requiring exactly one case-sensitive
   `__FINAL_STARTING_COMMIT__` placeholder.
4. Replacing that placeholder with `bundle.startingCommit`.
5. Encoding the materialized text as UTF-8 exactly once.

The server must hash and persist the same materialized byte sequence. It must
not accept prepared task text from Windows or any other caller.

## Design

### Artifact materialization

The assignment-window service will read the canonical template once per
request. The open file handle remains the authority for the complete bounded
read, preserving the existing no-follow and size checks.

After strict UTF-8 decoding, a focused helper will:

- reject zero or multiple placeholders with a typed artifact-template error;
- replace the single placeholder with the validated bundle starting commit;
- encode the result with `TextEncoder`;
- calculate SHA-256 from those encoded bytes; and
- return the materialized text and digest together.

The assignment producer will compare that digest with
`bundle.artifactSha256` before opening its database transaction. All assignment
payloads, inbox items, audits, and post-write checks will use the returned
materialized text and digest. No later code may reread or rematerialize the
template during the request.

### Test boundary

The disposable-PostgreSQL assignment-window suite will construct its valid
bundle from the materialized task text for the bundle's exact starting commit.
The fixture will require exactly one placeholder so the test cannot silently
recreate the raw-template mistake.

The artifact reader will expose only a narrow test seam accepted through the
existing test hooks or a dedicated optional test input. Production callers
will always use the fixed checked-in template path. Tests must not attempt to
replace module constants through global variables.

Required regressions:

1. A valid materialized bundle creates an assignment whose embedded artifact
   text contains the exact starting commit and whose digest matches the bundle.
2. A bundle containing the raw-template digest fails with
   `artifact_digest_mismatch` and creates no partial rows.
3. Templates with zero or multiple placeholders fail with the typed
   template-artifact error and create no partial rows.
4. A changed starting commit produces different materialized bytes and digest.
5. Existing idempotency, race, receipt, rollback, and canonical-projection
   checks remain green.

## Failure handling

Template read, decode, size, placeholder, or digest failure occurs before the
database transaction and creates no assignment authority. Existing transaction
rollback behavior remains unchanged for failures after mutation begins.

The failed live generation is retired independently: its founder receipt is
revoked, its failed assignment attempt is never retried, and its Windows
bootstrap, generated artifact, and task key are deleted before another
generation.

## Scope

Implementation is limited to:

- `server/services/coordination-gate3-assignment-window-service.ts`;
- `server/scripts/test-coordination-gate3-assignment-window.test.ts`; and
- required coordination handoff and batch documentation.

There are no schema, provisioning-bundle, Windows driver, prompt, task
objective, task 1449, or task 1450 changes.

## Verification and publication

Before publication:

1. Run the focused disposable-PostgreSQL assignment-window suite.
2. Run the focused coordinator runtime and HTTP suites affected by the shared
   artifact contract.
3. Run TypeScript checking, diff checking, and system health.
4. Obtain independent architectural review.
5. Run the Gemini review loop against the actual final code until it returns
   an unconditional approval.
6. Publish only the reviewed repair and its documentation. Do not include the
   unrelated uploaded screenshot or mailbox/episode changes.
7. Republish production before starting another fully fresh Windows
   generation.
