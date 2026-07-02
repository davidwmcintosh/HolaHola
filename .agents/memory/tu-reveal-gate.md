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

**What is NOT yet built:**
- System prompt fragment injection at session start: check if `tu_revealed` milestone exists for student → inject fragment that tells Daniela tú forms are unlocked. This should go in the pre-session synthesis or system prompt assembly, loading from `student_milestones` before building the GL session prompt.

**Why:** Madrigal method deliberately withholds tú until the student has internalized third-person/usted. The surprise of tú reveal is a designed expansion moment — not a time delay but a knowledge threshold.
