# HolaHola Autonomy Roadmap

This document defines how the HolaHola AI team operates autonomously, what levels of
action each participant can take without approval, and the specific capabilities we are
building towards.

---

## The Three-Tier Action Framework

### Tier 1 — Autonomous (No Approval Needed)
Broken code, data errors, crashes, stale locks, duplicate records, failing background
workers, and any condition that degrades existing functionality. These are maintenance
actions, not feature decisions. The responsible participant fixes it, then posts a brief
note to the Express Lane explaining what was broken and what was changed.

**Examples already handled this way:**
- NeuralSync duplicate key error on Wren→Daniela insight sync (fixed 2026-03-08)
- Memory health metrics reporting 0% injection rate due to wrong event type (fixed 2026-03-08)
- Student memory coverage reading from wrong table (fixed 2026-03-08)

**Standard for what qualifies:**
- The code is provably broken (errors in logs, data is wrong, workers crash)
- The fix is localized and reversible
- No new behavior is introduced — only existing behavior restored

### Tier 2 — Team Room First
Improvements, optimizations, new features, UX changes, architectural decisions, and any
change that introduces new behavior or modifies how existing features work. These are
brought to the Team Room for discussion before any implementation begins. Any team
member can open this conversation proactively — they do not wait to be asked.

**Who brings what:**
- **Wren** — code quality, architecture, security, infrastructure, technical debt
- **Lyra** — content gaps, student engagement, learning effectiveness, curriculum coverage
- **Daniela** — pedagogy, ACTFL alignment, lesson design, student outcomes
- **Sofia** — bug reports, voice pipeline issues, performance degradation, user-facing errors
- **Alden** — cross-cutting priorities, sprint planning, feature sequencing, team coordination

### Tier 3 — David Decides
Business decisions, pricing, partnerships, public communications, major architectural
pivots, and anything that materially changes what the product is or who it serves.

---

## Capability Roadmap

### CAP-001: Workers Post Proactively to Active Team Room Sessions
**Status:** SHIPPED — 2026-03-08
**Owner:** Alden (coordinator), Wren / Lyra / Sofia (implementors)
**Priority:** High

**What was built:**
- `server/services/team-room-proactive-poster.ts` — shared utility that checks for an
  active Team Room session, calls Gemini to generate a natural in-persona voice message,
  saves it to `room_voice_messages`, and emits it over WebSocket so the UI updates live
- Wren's security audit worker calls this after each audit when HIGH/CRITICAL findings exist,
  or when the audit comes back clean after a run that had findings
- Lyra's analytics worker calls this after each analysis when HIGH/CRITICAL insights exist
  or any insight is flagged for Daniela review
- Manual test trigger available at `POST /api/team-room/test-proactive-post` (founder only)

**Significance thresholds in production:**
- Wren: severity HIGH or CRITICAL findings, or a clean sweep after prior findings
- Lyra: any HIGH/CRITICAL insight, or any insight with `needsReview = true`
- Sofia: not yet wired (CAP-005 scope)
- Alden: not yet wired (CAP-002 scope)

---

### CAP-002: Alden as Initiative Tracker
**Status:** SHIPPED — 2026-03-08
**Owner:** Alden
**Priority:** High

**What was built:**
- `server/services/alden-digest-worker.ts` — weekly digest worker that gathers data from
  Wren's security stats, Lyra's analytics stats, Sofia's pending issue queue, and recent
  Express Lane session activity; passes it to Claude (Opus) to generate a natural 3-5 item
  prioritized agenda in Alden's voice; posts to active Team Room via `postToActiveTeamRoom`
- Fires 3 minutes after server startup, then every 7 days
- Deduplication guard: skips if a digest was posted within the last 3 days
- If no active Team Room is open when the digest is ready, `lastDigestTime` is reset so
  it retries the next time the trigger runs or is called manually
- Manual trigger: `POST /api/team-room/trigger-weekly-digest` (founder only)
- Alden does NOT implement — he proposes. The team discusses. David decides.

---

### CAP-003: Wren Auto-Patches Fixable Bugs
**Status:** SHIPPED — 2026-03-08
**Owner:** Wren
**Priority:** High

**What was built:**
- `server/services/wren-auto-patch-service.ts` — context-aware patch reviewer that runs
  after every security audit. For each finding, it reads the surrounding code (±18 lines),
  calls Gemini Flash to assess: real issue or false positive? if real, is it safely auto-patchable?
- Three outcomes for each finding:
  1. **Patched** — Gemini generates the exact replacement lines, service writes them to disk,
     posts before/after to Express Lane
  2. **Dismissed (false positive)** — Finding is registered in an in-memory false-positive registry
     so it is never re-reviewed; documented reasoning posted to Express Lane
  3. **Escalated** — Real issue that doesn't meet auto-patch criteria; stays in the queue for
     Team Room discussion
- Auto-patch criteria enforced by Gemini: change ≤5 lines, no new npm packages, localized,
  reversible, no behavior change — only hardening
- False-positive registry persists for the server's lifetime; restarts reset it (re-review happens
  once per boot, then cached)
- The Team Room proactive poster now filters out known false positives before posting alerts,
  so dismissed findings no longer generate noise
- Manual trigger: `POST /api/team-room/trigger-auto-patch` (founder only, re-runs full audit + patch)

**First run results (2026-03-08):**
- `dangerouslySetInnerHTML` in `chart.tsx:81` → **Dismissed as false positive** (CSS variables
  injected into a `<style>` tag, developer-controlled color config, not user input, not HTML)
- `pool.query` template literal in `server/scripts/fix-cross-db-fks.ts:55` → **Dismissed as
  false positive** (migration script with hardcoded table/constraint names, not API handler,
  not user input)

---

### CAP-004: Lyra Triggers Content Generation for Detected Gaps
**Status:** Not started
**Owner:** Lyra
**Priority:** Medium

Lyra's analysis already identifies topics with no cache (currently 0 for most non-core
subjects). Instead of logging this and stopping, she should be able to trigger the
existing syllabus pre-generation pipeline for those topics automatically.

**Scope:**
- On each analysis run, collect topics where `cached = 0` and students have enrolled
- Call the existing `/api/syllabus/prefetch` or equivalent internal endpoint
- Report what was generated to Express Lane

---

### CAP-005: Sofia Closes the Loop on Known Non-Issues
**Status:** Not started
**Owner:** Sofia
**Priority:** Medium

Sofia tracks 536 pending issues. The count never decreases because she never dismisses
anything. Many of these are historical artifacts from before certain features were
built. She needs the ability to mark known non-issues as resolved so the list reflects
actual open problems.

**Scope:**
- Sofia reviews pending issues older than 30 days
- Cross-references against: current system health, known-good features, recent fixes
- Marks dismissible items as resolved with a reason
- Reports net change to Express Lane: "Resolved 47 historical artifacts. 489 remain."

---

### CAP-006: Memory-Driven Proactive Check-Ins from Alden
**Status:** Not started
**Owner:** Alden
**Priority:** Medium-Low

Alden has access to David's stored learning facts (1,278 facts as of 2026-03-08). These
currently inform session responses but are never used proactively. Alden could use this
context to open relevant Team Room conversations — noting when a topic David expressed
interest in has new content available, or when a student-facing area he cares about
shows new data from Lyra.

**Scope:**
- Triggered by Lyra or Daniela analysis events, not on a fixed schedule
- Alden cross-references findings with David's stored preferences and prior discussions
- If relevant, opens a Team Room conversation with the connection surfaced
- Example: "Lyra flagged a content gap in history. You mentioned wanting to expand that
  curriculum in March. Want to discuss it?"

---

## GitHub Access for the Team

For the team to contribute code under Tier 1 and CAP-003, the following needs to be in
place:

1. **Stable sync from Replit to GitHub** — the `scripts/sync-to-github.sh` script pushes
   the `main` branch to GitHub using the `GITHUB_TOKEN` secret. This must be able to run
   reliably after each autonomous fix.

2. **Branch policy** — autonomous fixes go directly to `main` with a clear commit message
   prefixed `[AUTO-FIX]`. Team Room proposals go to a feature branch for review before
   merge.

3. **Lock file resolution** — Replit creates `.git/index.lock` during checkpoint commits.
   The sync script must handle this gracefully (wait and retry, or run only when no
   checkpoint is in progress).

---

## Tracking Progress

| Capability | Status | Shipped |
|------------|--------|---------|
| CAP-001: Workers → Team Room | **SHIPPED** | 2026-03-08 |
| CAP-002: Alden weekly digest | **SHIPPED** | 2026-03-08 |
| CAP-003: Wren auto-patch | **SHIPPED** | 2026-03-08 |
| CAP-004: Lyra content trigger | Not started | — |
| CAP-005: Sofia issue cleanup | Not started | — |
| CAP-006: Alden memory check-ins | Not started | — |

As capabilities are built, update status to: **In progress → Review → Live**.
