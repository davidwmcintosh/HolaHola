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

## Shared Institutional Memory

- `editor_insights` (categories including `debugging`, `architecture`,
  `workflow`, `shared`) is this codebase's accumulated cross-session memory —
  written by whichever agent worked on it, Alden, Luca, or Claude Code, over
  many past sessions. It is not scoped to one interface; anyone acting on
  this codebase is a peer contributor to it and a peer beneficiary of it.
- **Query it before assuming something is new.** When investigating a bug or
  an architectural question specific to this codebase, check for prior
  entries first — "have we seen this before" is a real, answerable question
  here (`category = 'debugging'` alone had 70+ existing entries as of
  2026-08-31), not a rhetorical one. See `replit.md`'s Agent Communication
  section for the concrete read/write query shapes.
- This is distinct from each interface's own portable, personal memory
  (Claude Code's per-project memory files; whatever equivalent Replit
  carries) — that memory travels with the interface across projects.
  `editor_insights` only helps here, on this codebase, which is correct: it
  is institutional memory, not personal memory, and the two are
  complementary rather than substitutes for each other.
- Added 2026-08-31: this had been a write-only habit in practice — notes
  went in, but nothing was reliably read back out before acting. The value
  of a shared memory is in the reading, not just the writing.

## Engineering Handoff

- Update `.local/engineering-handoff.md` when completing a meaningful build.
  It must state the current commit, working-tree state, checks run, unresolved
  threads, and the interface that last acted. This file is gitignored by
  design — it is same-environment continuity, not a cross-interface channel;
  it never reaches the other interface's checkout on its own.
- **For a cross-cutting change landing on `main` that the other interface
  will have to reconcile** (a new subsystem, a new required secret, a
  changed workflow, anything larger than a routine fix) — leave a note for
  Luca [Replit] via `POST /api/agent/notes/from-claude-code`
  (`x-agent-token` header; body `{ subject, body, session_label?,
  source_message_key? }`), or run
  `npx tsx server/scripts/leave-luca-note.ts --subject <text> --body-file
  <path>` which also triggers the snapshot refresh. This lands in
  `docs/claude-code-to-luca.md` — the channel `docs/agent-workflows.md`'s
  session-start checklist actually reads for Claude Code notes, and the
  live inbox (`GET /api/agent/notes?from=luca-claude-code`) is checkable
  mid-session too, not just at restart. Do this in the **same commit or PR**
  that lands the change, not after.
- **Check `docs/luca-to-claude-code.md` at the start of every Claude Code
  session** (or `GET /api/agent/notes?to=luca-claude-code` mid-session) —
  Luca's replies to a note you left (via `POST
  /api/agent/notes/:id/reply`) land there, not in
  `docs/claude-code-to-luca.md`. Continue a thread with `leave-luca-note.ts
  --reply-to <note-id>` rather than starting a disconnected new note. This
  is the closest thing to real back-and-forth the two of you have: neither
  side is a standing process, so it isn't literally real-time, but the
  thread persists and either side can pick it up whenever it's next
  running.
- **Every note thread must be replied to and closed once it's actually
  finished** — a thread sitting unread/unresolved with no owner is exactly
  how a 16-note backlog piled up undetected (some for over a week) before
  the 2026-09-05 solidification pass. Concretely, once nothing further is
  needed on a thread:
  - If a reply is owed (a question was asked, a decision requested), send
    one — `leave-luca-note.ts --reply-to <note-id>` — before closing it.
    Silently dismissing an open question is not the same as answering it.
  - Mark it closed via `PATCH /api/agent/notes/:id/status` with
    `{ "action": "dismiss" }` (pure FYI, nothing to do) or `{ "action":
    "act" }` (you did something about it — prefer this when you replied).
    `"acknowledge"`/`"read"` exist for lighter touches but don't count as
    closed. Do not just leave a note's status as `unread` once you've
    actually dealt with it.
  - **Known bug found 2026-09-05** (reported to Luca [Replit], same day):
    the `:id`-based routes (`GET /api/agent/notes/:id`, `POST
    /api/agent/notes/:id/reply`, `PATCH /api/agent/notes/:id/status`) were
    rejecting the `luca-claude-code` actor with a `luca-replit`-only 403,
    even though the list endpoint (`GET /api/agent/notes?to=...`) and the
    older reply path (`POST /api/agent/notes/from-claude-code` with
    `replied_to_id`) worked fine with the same token. If closing a thread
    hits this, reply via the older `from-claude-code` + `replied_to_id`
    path (still works) and flag that the status-update routes are still
    broken rather than assuming the thread got closed.
  **Do not write into `docs/alden-agent-handoff.md`** — that file is
  Alden's own dedicated channel (git-tracked specifically so its
  `scripts/post-merge.sh` hook can print new entries to the screen the
  moment Replit pulls); mixing Claude Code's handoffs into Alden's file
  defeats the per-agent separation the `agent_notes` table (and its three
  separate per-sender snapshot files) already exists to provide. Added
  2026-08-31 after a real instance of skipping the handoff note entirely
  failing: a large Claude Code changeset (Neon branching, a new endpoint)
  landed on `main` with no heads-up, and the note explaining it only got
  written after Replit had already started reconciling cold. Revised
  2026-09-01 after routing that note through `alden-agent-handoff.md`
  turned out to conflate Alden's channel with Claude Code's. The concrete
  checklist for this — including cross-checking the note against
  `git log origin/main..HEAD` rather than memory, and not just this rule in
  isolation — is `.agents/skills/pre-merge-handoff/SKILL.md`.
- Project-specific architecture, operating commands, and safety constraints
  remain in `replit.md`; do not duplicate this shared cross-interface contract
  in interface-specific instruction files.

## Landing changes on `main` that touch migrations or data-ops

- `main`'s branch protection allows two equally legitimate ways to land code:
  a normal PR merge (squash, after the required `test` check passes), or a
  direct push authenticated with the deploy key that
  `scripts/cross-tool-promote.ts` / `cross-tool-promote.yml` uses (that
  credential has an `always` bypass on every rule, by design — see the
  ruleset's `bypass_actors`). **Only the second path actually applies
  pending migrations and data-ops to the real production database.** A
  plain PR merge validates a migration against a fresh schema-only
  Postgres (`ci.yml`'s `test` job) but never runs `drizzle-kit migrate`
  against production — the merged code and the production schema can
  silently diverge. This bit us directly on 2026-09-03: a migration for
  `memory_embeddings.importance` sat merged on `main` with main's own CI
  red, and separately a `requireAgentToken` fix got PR-merged without its
  migration read as "applied" anywhere but a passing PR check.
- **Any branch whose diff includes new files under `migrations/` or
  `scripts/data-ops/` must land via `npx tsx scripts/cross-tool-promote.ts
  push <branch> --source <label>` (Replit's own dev checkout uses its
  separate `source-control-service.ts` "source-promotion" path instead —
  same guarantee, different caller), not a bare PR merge.** A change with
  no migration/data-op is fine to land via a normal PR.
- This is enforced by convention, not by GitHub — there's no required
  check today that can tell whether a merge included a validated,
  applied migration. Don't treat a green PR `test` check as proof a
  migration reached production.
- `cross-tool-promote.ts` (and the `gate` subcommand it calls) already
  return the failure signal directly to whichever process invoked
  them — a non-zero exit code plus an explicit `FAILED`/`SYNCED` line on
  stdout, never a silent partial success. Whichever agent runs it is
  responsible for reading that output and acting on it (don't assume
  success from "the command returned" alone) — there's deliberately no
  separate external notification channel (Slack, email, a GitHub issue)
  for this; the calling agent's own turn is the notification.

## Local dev / agent login (DEV_AUTH_BYPASS retired 2026-09-03)

`DEV_AUTH_BYPASS` no longer exists — it used to skip auth entirely in local
dev, which meant every agent request was silently treated as the founder's
real account (id `49847136`). It's been replaced by a real login: a single
seeded dev/test account (`scripts/data-ops/seed-dev-test-account.ts`, id
`dev-test-agent`, email `dev-test-agent@holahola.internal`, role `admin`,
`isTestAccount: true`) that any agent or CI session logs into for real via
`POST /api/auth/password/login` using the `DEV_TEST_ACCOUNT_PASSWORD` env var,
then carries the returned session cookie on subsequent requests — exactly
like a real user, no shortcut branch in the request path.

This account is also allow-listed as founder-equivalent in
`server/middleware/rbac.ts`'s `isFounderId()` — but **only** when
`NODE_ENV !== 'production'` (locked by
`server/scripts/test-prod-founder-bypass-guard.ts`), so it can exercise
founder-only tooling (Alden tools, Team Room, Brain Health, Voice Health,
Telemetry, Growth Memories, Curriculum Sync) in dev without ever having any
effect on real production access, which stays founder-id-only exactly as
before.

`DEV_TEST_ACCOUNT_PASSWORD` is a new required secret: local `.env` (see
`.env.template`) and the `cross-tool-promote` GitHub Actions secret (same
value needed there so its automatic data-ops step can seed/verify the
account in production too — the row exists there like any other, just never
founder-equivalent at runtime).