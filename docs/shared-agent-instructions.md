# Shared Agent Instructions

This is the durable instruction source shared by Claude Code and Replit Agent.
Interface-specific files must link here rather than copying identity or continuity
rules. Keep this file free of secrets, credentials, and private user data.

## Canonical Conversation Record

- The shared canonical conversation path is the append-only
  `.local/.chat_capture` log, drained by `agent-session-autosave.ts` into
  `conversation_memories`. The database record is canonical; a rolling episode
  is its DB-first projection, never a competing source.
- Record complete user/assistant exchanges through
  `server/scripts/record-exchange.ts` or
  `POST /api/internal/canonical-conversation-exchange`. Do not claim an exchange
  is recorded merely because bytes reached a local file.
- Replit uses `--source replit` and preserves the authored four-channel Luca
  response. Claude Code uses `--source claude-code --assistant-file <path>`.
  Their labels remain distinct in every canonical record:
  `David [Replit]` / `Luca [Replit]` and
  `David [Claude Code]` / `Claude Code`.
- Every exchange requires a caller-generated stable turn ID and has a durable
  receipt. On acknowledgement timeout, retry with the same `--turn-id`; this
  cannot create a second copy. Fresh exchanges are written atomically, so a
  retry always finds either the complete exchange or no exchange. A malformed
  one-sided historical capture is quarantined visibly for reconciliation rather
  than being merged with a late side. A
  `FAILED ACKNOWLEDGEMENT` capture-status line
  means the exchange remains pending and must not be represented as canonical.
- Live-mode episode projection is automatic after the database insert succeeds.
  Never manually append a duplicate exchange to an episode.

## Record Integrity

- Preserve dialogue verbatim. Do not rewrite canonical dialogue, combine
  authors, relabel one interface as another, or replace the database record
  from Markdown.
- Keep raw source evidence separate from semantic conversation records. Raw
  capture is evidence of what the collector saw; attributed dialogue is a
  distinct, revisable projection.
- Keep explicit source and event identities through retries. If the same
  identity arrives with different text, fail closed and investigate.

## Engineering Handoff

- Update `.local/engineering-handoff.md` when completing a meaningful build.
  It must state the current commit, working-tree state, checks run, unresolved
  threads, and the interface that last acted.
- Project-specific architecture, operating commands, and safety constraints
  remain in `replit.md`; do not duplicate this shared cross-interface contract
  in interface-specific instruction files.