# Git-Only Mailbox Ledger Implementation Plan

**Design:** `docs/superpowers/specs/2026-09-04-git-only-mailbox-ledger-design.md`

## 1. Pure deterministic mailbox module

- Define the two mailbox identities, exact actor pairs, note schema, and ledger schema.
- Strictly parse JSON with exact-key validation.
- Require canonical UTC ISO timestamps, unique non-empty IDs, and canonical
  `(createdAt DESC, id ASC)` ordering.
- Canonically serialize ledgers and render stable Markdown without locale,
  clock, filesystem, environment, or database access.
- Add focused tests for successful rendering, byte stability, and malformed,
  duplicate, reordered, actor-mismatched, and noncanonical inputs.

## 2. Normal snapshot generation

- Map the existing unread mailbox rows to the canonical ledger model.
- Render ledger and Markdown from the same normalized value.
- Replace each file atomically through a temporary sibling.
- Read back and validate the final pair.
- Leave Alden and founder snapshots unchanged.
- Establish and inspect the initial committed ledger/Markdown pairs.

## 3. Typed reconciliation policy

- Replace generated verifier strings with a versioned `mailbox-ledger` proof
  object containing exact ledger path, mailbox identity, and formatter version.
- Permit only the two approved output/ledger/mailbox tuples.
- Reject unknown proof keys, arbitrary commands, path drift, unsupported
  versions, and generated-local policies without the exact built-in proof.

## 4. Exact-commit generated proof

- Read ledger and Markdown blobs from `packet.localSha`.
- Strictly validate and render through the pure module.
- Require byte equality with committed Markdown before writing.
- Stage only the output in the isolated worktree and re-read the staged blob.
- Fail closed without moving `main`, retaining candidate refs, or running
  candidate-controlled code.

## 5. Hermetic verification

- Extend the real-Git matrix with success for both directions and failures for
  missing/malformed/reordered/duplicate ledgers, stale Markdown, wrong path,
  ledger conflict, and arbitrary proof text.
- Assert the reconciliation service has no database imports and no verifier
  command execution.
- Run focused tests, TypeScript, source-control safety tests, source bridge
  tests, and system health.
- Update operator handoff and batch documentation.
- Submit the actual final diff for unconditional dual-engine architecture
  approval before commit.