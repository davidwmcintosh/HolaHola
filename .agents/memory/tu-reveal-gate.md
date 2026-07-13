---
name: Tú reveal gate infrastructure
description: Madrigal pedagogical gate — student earns tú forms after demonstrating usted/third-person fluency. Table + tool built July 2 2026.
---

**What was built (July 2, 2026):**
- `student_milestones` table in `shared/schema.ts` — columns: studentId, language, milestoneKey, successCount, distinctDays, lastEvidenceDateStr (YYYY-MM-DD string), unlockedAt, evidenceSummary. Unique constraint on (studentId, language, milestoneKey).
- Migration applied: `migrations/0002_white_northstar.sql`
- `record_usted_fluency` tool in registry (legacyType: `RECORD_USTED_FLUENCY`), handler in `native-fc-handlers.ts`

**Milestone keys:**
- `usted_fluency` — running counter. incremented each time Daniela calls `record_usted_fluency`
- `tu_revealed` — gate row. inserted (with `unlockedAt`) when threshold is crossed

**Threshold (Gemini-refined):**
- 25 successful communicative uses of usted/third-person forms
- Across at least 2 distinct calendar days (sleep cycle — not just session count)
- Daniela calls the tool silently; does NOT announce the count

**Day tracking:** Uses `lastEvidenceDateStr` (YYYY-MM-DD string) to avoid TZ complexity. `distinctDays` increments only when today != lastEvidenceDateStr.

**Fully wired (confirmed July 12, 2026):**
- `getTuRevealFragment` is exported from `pre-session-synthesis.ts` and imported + called in `server/unified-ws-handler.ts` at the GL system prompt assembly point (~line 3045). The fragment is prepended to `geminiLiveSystemPrompt` when the milestone row exists. Log line: `[GeminiLive] ✓ tú reveal fragment injected (N chars)`. Nothing left to build on this feature.

**Why:** Madrigal method deliberately withholds tú until the student has internalized third-person/usted. The surprise of tú reveal is a designed expansion moment — not a time delay but a knowledge threshold.
