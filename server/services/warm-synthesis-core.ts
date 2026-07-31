/**
 * warm-synthesis-core.ts
 *
 * Testable extraction of the core business logic from the
 * POST /api/sessions/warm-synthesis route handler.
 *
 * Accepting peekFn, generateFn, and setWarmFn as parameters lets the test
 * suite inject mocks (e.g. a throwing peekFn) without touching a live HTTP
 * server or monkey-patching module exports.  The route passes the real
 * production functions; Part 7 of the absence-return-synthesis test passes
 * a throwing mock for peekFn to exercise the catch path at runtime.
 */

import type { CompassContext } from '@shared/schema';

/** Shape of the absence signal forwarded to synthesis */
export type WarmSynthesisSignal = {
  daysSinceLastSession: number;
  firstName: string | null;
  callTranscript?: string | null;
} | null;

/**
 * Core logic of the warm-synthesis route:
 *   1. Peek for a pending absence nudge via peekFn (non-mutating, read-only)
 *   2. Call generateFn (generatePreSessionSynthesis) with the signal, or null
 *      if the peek threw — failures in peek must NEVER block synthesis
 *   3. Store the result via setWarmFn (setWarmSynthesis) for the WS handler
 *
 * The inner try/catch around peekFn emits a console.warn on error and keeps
 * returningAfterAbsence = null so synthesis always completes.
 */
export async function runWarmSynthesisCore(
  userId: string,
  compassContext: CompassContext,
  language: string,
  peekFn: (userId: string) => Promise<WarmSynthesisSignal>,
  generateFn: (
    ctx: CompassContext,
    tutorName: string,
    userId: string,
    language: string,
    returningAfterAbsence: WarmSynthesisSignal,
  ) => Promise<string | null>,
  setWarmFn: (userId: string, synthesis: string) => void,
): Promise<string | null> {
  // ── Peek for a pending absence nudge (read-only) ─────────────────────────
  // Peek at whether this student has a pending absence nudge so the warm cache
  // carries the returning-student signal. We deliberately use the READ-ONLY peek
  // here — the actual nudge resolution (DB update + Express Lane note) must only
  // happen at true session start (WS handler / orchestrator), not on Prepare screen
  // load, because the student may close the browser without ever starting a session.
  let returningAfterAbsence: WarmSynthesisSignal = null;
  try {
    returningAfterAbsence = await peekFn(userId);
    if (returningAfterAbsence) {
      console.log(
        `[WarmSynthesis] ✓ Pending absence nudge detected (${returningAfterAbsence.daysSinceLastSession} day(s)) — baking into warm cache (read-only peek, no resolution)`,
      );
    }
  } catch (absErr: any) {
    // Non-fatal — absence check failure must never block synthesis
    console.warn('[WarmSynthesis] Absence peek failed (non-fatal):', absErr?.message);
  }

  // ── Generate synthesis (with or without absence signal) ──────────────────
  const synthesis = await generateFn(compassContext, 'Daniela', userId, language, returningAfterAbsence);
  if (synthesis) {
    setWarmFn(userId, synthesis);
    console.log(`[WarmSynthesis] ✓ Pre-computed for user ${userId.substring(0, 8)} (${synthesis.length} chars)`);
  }
  return synthesis ?? null;
}
