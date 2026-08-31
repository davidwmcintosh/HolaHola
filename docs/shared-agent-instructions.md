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
  threads, and the interface that last acted. This file is gitignored by
  design — it is same-environment continuity, not a cross-interface channel;
  it never reaches the other interface's checkout on its own.
- **For a cross-cutting change landing on `main` that the other interface
  will have to reconcile** (a new subsystem, a new required secret, a
  changed workflow, anything larger than a routine fix) — add a
  `## From <interface> — <date> (<short label>)` entry to
  `docs/alden-agent-handoff.md`, in the **same commit or PR** that lands the
  change, not after. This file is git-tracked and already checked at the
  other interface's session start, so the note arrives the moment they pull
  — no separate DB write, no relay through David required. Added
  2026-08-31 after a real instance of the alternative failing: a large
  Claude Code changeset (Neon branching, a new endpoint) landed on `main`
  with no heads-up, and the note explaining it only got written after
  Replit had already started reconciling cold. The concrete checklist for
  this — including cross-checking the handoff entry against
  `git log origin/main..HEAD` rather than memory, and not just this rule in
  isolation — is `.agents/skills/pre-merge-handoff/SKILL.md`.
- Project-specific architecture, operating commands, and safety constraints
  remain in `replit.md`; do not duplicate this shared cross-interface contract
  in interface-specific instruction files.