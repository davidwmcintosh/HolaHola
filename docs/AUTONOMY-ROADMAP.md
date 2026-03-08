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
**Status:** Not started
**Owner:** Alden
**Priority:** High

Alden should compile a weekly summary of what the team surfaced — bugs found, fixes
made, insights generated, content gaps, security posture — and open a Team Room
conversation around priorities for the coming week. This happens without David initiating
it.

**Scope:**
- Weekly digest: every Monday (or when the next session opens after the weekend)
- Sources: Express Lane history, Wren security findings, Lyra analysis, Sofia issue list,
  recent Tier 1 fixes performed autonomously
- Output: a brief Team Room message from Alden with 3-5 prioritized items and a
  recommendation on sequencing
- Alden does NOT implement — he proposes. The team discusses. David confirms or redirects.

---

### CAP-003: Wren Auto-Patches Fixable Bugs
**Status:** Not started
**Owner:** Wren
**Priority:** High

When Wren's security audit or architectural review identifies a clearly broken pattern
with a known fix, she should implement the fix herself under Tier 1 rules. She already
has read access to the codebase. This extends that to targeted write access for bug fixes.

**Scope of autonomous fixes (must meet ALL criteria):**
- The issue is provably broken, not a code style or opinion disagreement
- The fix is localized to one function or file
- No new dependencies introduced
- Fix is reversible via the checkpoint system
- Wren posts a clear summary to Express Lane: what was broken, what she changed, the
  commit-equivalent description

**Examples of qualifying fixes:**
- `ON CONFLICT DO NOTHING` for duplicate-key inserts (like NeuralSync — already fixed manually)
- Missing null checks causing crashes
- Wrong variable referenced in a calculation
- Dead code causing a worker to silently fail

**Examples that do NOT qualify (go to Team Room first):**
- Performance refactors
- Changing how a feature behaves
- Modifying any user-facing API
- Anything touching auth, billing, or security boundaries

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

| Capability | Status | Est. Start |
|------------|--------|------------|
| CAP-001: Workers → Team Room | Not started | TBD |
| CAP-002: Alden weekly digest | Not started | TBD |
| CAP-003: Wren auto-patch | Not started | TBD |
| CAP-004: Lyra content trigger | Not started | TBD |
| CAP-005: Sofia issue cleanup | Not started | TBD |
| CAP-006: Alden memory check-ins | Not started | TBD |

As capabilities are built, update status to: **In progress → Review → Live**.
