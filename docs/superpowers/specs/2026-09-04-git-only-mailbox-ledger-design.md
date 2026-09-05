# Git-Only Mailbox Ledger Design

**Status:** Approved design; awaiting written-spec review

## Purpose

Safe source reconciliation currently fails closed when either generated mailbox
snapshot conflicts:

- `docs/claude-code-to-luca.md`
- `docs/luca-to-claude-code.md`

That behavior is correct because the existing snapshot generator reads the
shared Neon `agent_notes` table and includes a wall-clock generation time.
Reconciliation must never connect to that database, and therefore cannot prove
that restoring either local Markdown file reproduces authoritative bytes.

This design adds an independent, deterministic, Git-tracked input for each
snapshot. The normal application may obtain notes from Neon before writing
those inputs. Reconciliation reads only immutable Git objects and never invokes
the database-backed acquisition path.

## Safety boundary

The feature preserves all V1 source-reconciliation restrictions:

- no database imports or connections in reconciliation code;
- no checkout or movement of the primary worktree;
- no movement of `main`;
- no push, force update, reset, rebase, promotion, or remote deletion;
- no candidate-controlled executable, package script, or shell verifier;
- no filesystem timestamp or current-time input;
- no broad path policy or inference about another generated file.

Only the two exact mailbox output paths gain automatic generated-local proof.
Every other path keeps its existing policy.

## Components

### 1. Canonical mailbox ledger

Add one committed JSON ledger for each direction:

- `docs/mailbox-ledgers/claude-code-to-luca.json`
- `docs/mailbox-ledgers/luca-to-claude-code.json`

Each file has one canonical JSON shape:

```json
{
  "schemaVersion": 1,
  "mailbox": "claude-code-to-luca",
  "notes": [
    {
      "id": "stable-note-id",
      "fromAgent": "luca-claude-code",
      "toAgent": "agent",
      "subject": "Subject",
      "body": "Verbatim body",
      "sessionLabel": null,
      "createdAt": "2026-09-04T18:00:00.000Z"
    }
  ]
}
```

The opposite direction uses mailbox identity `luca-to-claude-code`, sender
`agent`, and recipient `luca-claude-code`.

The schema permits exactly the documented keys. It contains no generated time,
read time, database ordering token, environment value, or nullable field other
than `sessionLabel`.

Notes are sorted deterministically by:

1. `createdAt` descending;
2. `id` ascending as the stable tie-breaker.

IDs must be non-empty and unique. Dates must be canonical UTC ISO strings.
Sender, recipient, and mailbox identity must agree. Unknown keys, duplicate
IDs, invalid dates, invalid actors, or unstable ordering invalidate the ledger.

### 2. Pure mailbox formatter

Extract a small pure module that owns:

- ledger normalization and validation;
- canonical JSON serialization;
- Markdown rendering for both mailbox directions.

It accepts data and returns bytes. It does not import the database, filesystem,
clock, workspace root, or source-control services.

The Markdown output removes the nondeterministic `Generated:` line. Empty and
non-empty snapshots use stable headers and explanatory text. Note sections
preserve the subject, body, session label, stable note ID, and a date rendered
from the canonical `createdAt` value in one fixed locale/timezone-independent
format.

### 3. Normal application writer

The existing database-backed snapshot service remains responsible for reading
unread notes. For the two Luca mailbox directions it will:

1. map selected rows to the canonical ledger model;
2. validate and deterministically sort the model;
3. render canonical ledger and Markdown bytes from the same model;
4. write each file through a temporary sibling and atomic rename;
5. verify the final on-disk ledger still renders the final Markdown bytes.

The filesystem cannot atomically rename two paths as one transaction. A crash
between the two renames may therefore leave a temporarily mismatched pair, but
that mismatch is detectable: the final verification, the next normal refresh,
and reconciliation's byte proof all fail rather than accepting mixed
generations.

The Alden and founder snapshot behavior is outside this task and remains
unchanged.

### 4. Built-in reconciliation verifier

The policy manifest replaces `unavailable-git-only` with a structured,
versioned built-in proof declaration. It binds:

- exact Markdown output path;
- exact ledger input path;
- mailbox identity;
- formatter version.

The declaration is data, not a command. Manifest validation accepts only the
two known path/ledger/mailbox combinations.

During a generated-local conflict, reconciliation:

1. reads the exact ledger blob from `packet.localSha`;
2. reads the exact local Markdown blob from `packet.localSha`;
3. validates ledger schema, mailbox identity, actors, IDs, dates, and ordering;
4. renders expected Markdown using the trusted local pure formatter;
5. requires expected bytes to equal the committed local Markdown blob;
6. writes expected bytes to the isolated worktree;
7. stages the output path;
8. requires the staged blob to equal the expected and local committed bytes.

It does not run the normal snapshot writer, import its database acquisition
layer, execute a verifier string, or read the ledger from the mutable primary
filesystem.

## Ledger conflicts

The ledger paths are proof inputs, not generated outputs. V1 does not
automatically reconcile them.

If both histories changed the same ledger path and Git cannot merge it cleanly,
the path is unclassified and candidate construction stops. This prevents an
automatic output resolution from concealing disagreement in its source data.

If only the local history changed the ledger, reconciliation can use that exact
local commit blob to prove the corresponding local Markdown output. If the
ledger is absent from the local commit, proof fails closed.

## Error handling

All of the following return `generated_regeneration_failed` and retain the
existing immutable candidate audit behavior:

- missing ledger blob;
- malformed JSON;
- unsupported schema or formatter version;
- unknown fields;
- wrong ledger path or mailbox identity;
- wrong sender or recipient;
- duplicate note ID;
- noncanonical date;
- unstable note ordering;
- committed Markdown drift from rendered bytes;
- staged bytes differing from expected bytes.

No failure falls back to keeping local Markdown without proof.

## Migration

The implementation will use the normal database-backed application path once
to create initial ledger/Markdown pairs. Those generated files will be
inspected and committed together with the implementation.

This one-time establishment does not relax reconciliation's no-database
boundary. Future application refreshes keep each pair synchronized.

## Testing

### Pure formatter tests

- canonical ledger serialization is byte-stable;
- both empty mailbox outputs are stable;
- populated output ordering is stable;
- equal timestamps use ID tie-breaking;
- subject/body/session text is preserved;
- timezone and process locale do not change output;
- repeated rendering returns identical bytes.

### Validation failures

- unknown schema or formatter version;
- unknown object fields;
- missing required field;
- wrong mailbox, sender, or recipient;
- duplicate IDs;
- invalid or noncanonical dates;
- reordered notes;
- output/ledger path mismatch.

### Hermetic real-Git reconciliation

- successful generated resolution for each mailbox direction;
- missing local ledger;
- malformed ledger;
- stale local Markdown;
- conflicting ledger path;
- staged byte mismatch;
- deterministic replay produces the same candidate SHA;
- failure removes pre-commit candidate refs and worktrees;
- primary `HEAD` and `main` remain unchanged;
- source reconciliation has no database import;
- generated resolution executes no arbitrary command or candidate-owned code.

## Completion criteria

The task is complete when:

1. normal mailbox refresh writes deterministic ledger/Markdown pairs with
   atomic per-file replacement and post-write pair verification;
2. both exact generated-local policies use built-in ledger proof;
3. reconciliation resolves either snapshot only when the exact local ledger
   reproduces the exact local Markdown bytes;
4. all malformed, stale, missing, reordered, and conflicting inputs fail closed;
5. focused tests, TypeScript, source-control safety, and system health pass;
6. final architecture review returns unconditional approval.