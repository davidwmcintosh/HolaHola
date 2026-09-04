# August 18 Source-Evidence Recovery

## Scope

This audit covers `conversation_memories.id =
ae65ed5b-eae5-4680-b1a0-15d6f4db676f`, created on August 18, 2026.
The row's content SHA-256 is
`d23927c9de77fb4160d66482d6072a729d02b89a8e9d10cfc2f89a4e90e1a30a`.

## Result

No surviving exact raw source evidence was found for the row's two-turn
sequence. The existing dialogue and authorship remain unchanged. No
`source-*`, `canonical-conversation`, or `capture-id:*` tag was added.

The dialogue does occur in the archived `docs/episode-30.md`, but that file is
the derived canonical replica. It is not an independent source record and
therefore cannot prove source identity or a capture ID.

## Evidence checked

- The retained `.local/.chat_capture` file (329,556 bytes; SHA-256
  `a09a24544ead04ad5f265e85ba14122a7aab322d7b505af124bb28e2353aae9e`)
  contains neither exact turn.
- All retained `.local/raw-window-captures/*.raw` files were searched byte for
  byte. Their SHA-256 values are the filenames
  `1b75ff0b433935ba1f903576e33120047dc31f6b6485c83d44dac52c7a47dc77`,
  `5fd90a48fd5db3e5850dc3a601f540758112dc02119cf42159b0eb9127803736`,
  and `852d890e87c4188cda2a1fc720ed2275a88248753e06c43e30c897987f35c203`.
  None contains either exact turn.
- The append-only `context_lineage_events` raw-window ledger had 33
  `raw_window_source_observed` rows at audit time. A database-side exact
  substring search of `payload_text` found no match for either turn.
- The private object-storage reconciliation archive was downloaded through
  `scripts/reconciliation-history-object-storage.ts`. The downloader verified
  stored object metadata and the manifest checksum. The complete Git bundle
  (`reconciliation-2026-08-21.bundle`, 2,299,170,535 bytes; SHA-256
  `5602886ca74ea2aab0f18b0c3832966fcc3de3eb63bbf9c8d982312cf7c0cbdb`)
  passed `git bundle verify` and an isolated `git fsck --full --strict
  --no-reflogs`.
- The verified bundle contains no historical `.local/.chat_capture` or
  `.local/raw-window-captures` object. Searching the bundle's retained capture
  artifacts found no exact turn. Searching the protected history found the
  dialogue only in `docs/episode-30.md`.

## Database and embedding decision

The target row still has only its original tags:
`david-luca-chat`, `verbatim`, `per-turn`, `chat-capture`, and `watchdog`.
Its content hash still matches the reviewed pre-incident watchdog manifest.
Because no row field was edited, `server/scripts/reembed-memory.ts` was not
run.