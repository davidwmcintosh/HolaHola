# Gemini Audit — Second Wave (Gaps 8, 9, 10) — June 23, 2026

## Audit scope
Three implementations from the 10/10 Daniela voice experience roadmap:
- Gap 8: SRS mastery decay (fading skills category)
- Gap 9: Curriculum-forward advisory goal (pathfinder service)
- Gap 10: Multi-modal continuity (screen context → GL tool response)

## Findings and resolutions

### Gap 8 — Memory hole (REAL BUG — FIXED)
**Finding:** The 90-day query window meant any skill unvisited for 91+ days silently
vanished from the digest — neither Mastered nor Fading. A student returning after
a semester break would appear as a complete beginner.

**Fix:** Extended query window from 90 to 365 days. Decay math handles signal-to-noise:
a score from 50 weeks ago decays to ~0.5% of its original value, so stale entries
naturally fall below all classification thresholds.

### Gap 9 — Language cross-reference (NOT A BUG — confirmed correct)
**Finding raised:** "universal" evidence vs "spanish" canDoStatements would yield
empty cross-reference.

**Actual behavior:** The cross-reference is by statement ID (canDoStatementId), not
by language string. Evidence rows tagged "universal" reference specific statement IDs
which ARE language-specific Spanish/French/etc. statements. The ID-based join works
correctly. Gemini's concern was based on misreading the query structure.

### Gap 9 — Advisory label hardening (VALID — FIXED)
**Finding:** "CURRICULUM COMPASS (advisory only — your call)" might still get hardened
into a required session goal by the synthesis model (LLM instruction drift).

**Fix:** Label changed to "OPTIONAL CURRICULUM HINT (skip if conversation is flowing —
student agency comes first)". Explicit language that prioritizes student agency over
the algorithm makes it harder for synthesis to treat it as a directive.

### Gap 10 — Timing (CONFIRMED CORRECT)
**Finding asked about:** Does injecting context into the SAME tool response that triggered
the event create ambiguity (model might think it's describing pre-call state)?

**Confirmed:** Correct pattern. GL processes tool responses as "what happened as a result
of the call." Model reads injected context as post-call visual state, not pre-call.

### Gap 10 — Observer report format (IMPROVEMENT — APPLIED)
**Recommendation:** Use explicit observer-report phrasing rather than generic labels.

**Fix:** Changed from `[Screen context — not spoken: item1 | item2]` to
`[SYSTEM UPDATE — not spoken: The student's screen now shows: item1 | item2]`.

### Gap 10 — Race condition (CONFIRMED SAFE)
**Finding asked about:** If two tools fire in the same turn, does the flush
happen once or twice?

**Confirmed safe:** Flush is inside `sendToolResponses()` which is called exactly
once per turn after the full tool batch resolves. All pendingGlContext items from
both tool calls are accumulated before flush.

## Items NOT in scope of this audit (Gemini raised, noted for awareness)
- **Shared dev+prod DB:** Acknowledged architectural constraint. Intentional for
  HolaHola (single Neon DB). Risk is managed via careful migration discipline.
- **Tool limit (64 cap):** Already handled via semantic search / neural net tool
  selection. Not a new concern.
- **Decay granularity (vocabulary vs grammar rates):** Good future enhancement.
  Logged to open-bugs.md for a future wave.
