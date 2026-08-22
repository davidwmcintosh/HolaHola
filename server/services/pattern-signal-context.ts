/**
 * Pattern Signal Context
 *
 * Shared helpers for Daniela's per-turn ACTFL anchor:
 *   - fetchPatternSignalContext: async DB fetch → formatted text (used by orchestrator + native-fc-handlers)
 *   - formatPatternSignals: pure compartments → text (used directly by unit tests)
 *   - buildActflPersonaAnchor: pure session-like object → "This turn:" preamble string
 *
 * Extracted from streaming-voice-orchestrator.ts so:
 *   1. native-fc-handlers.ts can call fetchPatternSignalContext without a circular dependency.
 *   2. Unit tests can import formatPatternSignals + buildActflPersonaAnchor without pulling
 *      in the orchestrator's heavy transitive dependencies (WebSocket, DB, TTS, etc.).
 */

import { storage } from '../storage';
import type { CompartmentInstallation } from '@shared/schema';
/**
 * Fetch grammar pattern compartment context for a student so Daniela's
 * mid-session reminder stays accurate.  Returns a formatted string ready to
 * assign to session.activePatternSignals, or null when all patterns are
 * stable / no compartments exist.
 */
export async function fetchPatternSignalContext(userId: string, language: string): Promise<string | null> {
  try {
    const compartments = await storage.getCompartmentMap(userId, language);
    if (!compartments.length) return null;

    const active = compartments.filter(c => c.status === 'wobbling' || c.status === 'pounding');
    if (!active.length) return null;

    // Surface wobbling first (regression — needs attention), then pounding (in progress)
    const wobbling = active.filter(c => c.status === 'wobbling');
    const pounding  = active.filter(c => c.status === 'pounding');

    const lines: string[] = [];
    for (const c of wobbling.slice(0, 3)) {
      const lastWobble = c.lastWobbledAt
        ? Math.floor((Date.now() - new Date(c.lastWobbledAt).getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const ago = lastWobble !== null
        ? (lastWobble === 0 ? 'today' : lastWobble === 1 ? 'yesterday' : `${lastWobble}d ago`)
        : '';
      lines.push(`- ${c.patternKey}: WOBBLING — slipped back after partial stability${ago ? ` (last wobble ${ago})` : ''}. Needs revisiting.`);
    }
    for (const c of pounding.slice(0, 3)) {
      lines.push(`- ${c.patternKey}: IN PROGRESS — being drilled (${c.poundingCount} poundings, ${c.wobbleCount} wobbles). Keep building.`);
    }

    if (!lines.length) return null;
    return lines.join('\n');
  } catch (err) {
    console.warn('[PatternSignals] Failed to fetch compartment context:', err);
    // Re-throw so callers can distinguish a storage error (undefined sentinel via .catch())
    // from a genuine empty result (null = no active compartments).  Without re-throwing,
    // the outer .catch(() => undefined) guard in every RECORD_PATTERN_SIGNAL handler is
    // dead code and a transient DB blip silently wipes session.activePatternSignals.
    throw err;
  }
}

export interface PatternAnchorSession {
  studentActflLevel?: string;
  targetLanguage?: string;
  nativeLanguage?: string;
  tutorName?: string;
  conversationHistory?: unknown[];
  startTime?: number;
  activePatternSignals?: string | null;
  lastMemorySearchTurn?: number;
}

/**
 * Convert a list of compartment rows into the compact text block that is stored
 * on `session.activePatternSignals` at greeting time.
 *
 * Returns null when no compartments are wobbling or pounding.
 * Wobbling (regression) compartments are listed before pounding (in-progress) ones.
 * Each status group is capped at 3 entries.
 *
 * This is the pure extract of `fetchPatternSignalContext` in
 * streaming-voice-orchestrator.ts (the async wrapper that calls
 * storage.getCompartmentMap lives in that file).
 */
export function formatPatternSignals(
  compartments: CompartmentInstallation[],
): string | null {
  if (!compartments.length) return null;

  const active = compartments.filter(
    (c) => c.status === 'wobbling' || c.status === 'pounding',
  );
  if (!active.length) return null;

  const wobbling = active.filter((c) => c.status === 'wobbling');
  const pounding  = active.filter((c) => c.status === 'pounding');

  const lines: string[] = [];

  for (const c of wobbling.slice(0, 3)) {
    const lastWobble = c.lastWobbledAt
      ? Math.floor(
          (Date.now() - new Date(c.lastWobbledAt).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : null;
    const ago =
      lastWobble !== null
        ? lastWobble === 0
          ? 'today'
          : lastWobble === 1
          ? 'yesterday'
          : `${lastWobble}d ago`
        : '';
    lines.push(
      `- ${c.patternKey}: WOBBLING — slipped back after partial stability${ago ? ` (last wobble ${ago})` : ''}. Needs revisiting.`,
    );
  }

  for (const c of pounding.slice(0, 3)) {
    lines.push(
      `- ${c.patternKey}: IN PROGRESS — being drilled (${c.poundingCount} poundings, ${c.wobbleCount} wobbles). Keep building.`,
    );
  }

  if (!lines.length) return null;
  return lines.join('\n');
}

/**
 * Convert session.activePatternSignals (the pre-formatted bullet string stored at
 * greeting time) into the compact injection note shared by both voice and text paths.
 *
 * Returns '' when signals is null/empty so callers can concatenate directly.
 * Capped at 5 lines; only bullet/dash lines are included so stray header text is ignored.
 *
 * Single source of truth — used by buildActflPersonaAnchor (voice) and
 * runDanielaFCLoop (text) so the two paths can never drift.
 */
/**
 * Construct the effectiveSystemPrompt used by runDanielaFCLoop.
 *
 * Exported as a pure function so unit tests can verify the injection without
 * importing daniela-caller.ts (which initialises the DB, Deepgram, Cartesia,
 * etc. at module load time, leaking handles in lightweight test runs).
 *
 * The logic must stay in sync with the three lines in runDanielaFCLoop that
 * build effectiveSystemPrompt — any change there must be mirrored here.
 */
export function buildTextModeSystemPrompt(
  systemPrompt: string,
  activePatternSignals?: string | null,
): string {
  const suffix = formatActivePatternSignalNote(activePatternSignals);
  if (!suffix) return systemPrompt;
  return systemPrompt + (systemPrompt.endsWith('\n') ? '' : '\n') + suffix.trimStart();
}

export function formatActivePatternSignalNote(signals: string | null | undefined): string {
  if (!signals) return '';
  const lines = signals
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('-') || l.startsWith('•'))
    .slice(0, 5);
  return lines.length > 0 ? `\nActive grammar patterns: ${lines.join(' | ')}` : '';
}

/**
 * Build the per-turn "This turn:" preamble injected into Gemini's context on
 * every student turn.
 *
 * Contains:
 *   - Language-mix ratio for the student's ACTFL level
 *   - Persona / warmth anchor
 *   - "Session ongoing" guard (suppresses re-introduction after turn 2)
 *   - Memory freshness nudge (fires after turn 6 without a memory search)
 *   - Temporal pacing hint (fires after 25 min)
 *   - Active grammar pattern signals (from session.activePatternSignals)
 *
 * Returns null only when something prevents building — in practice always
 * returns a non-null string.
 */
export function buildActflPersonaAnchor(session: PatternAnchorSession): string | null {
  const level          = session.studentActflLevel || 'novice_low';
  const targetLang     = session.targetLanguage    || 'Spanish';
  const nativeLang     = session.nativeLanguage    || 'english';
  const nativeLangDisplay = nativeLang.charAt(0).toUpperCase() + nativeLang.slice(1);
  const targetLangDisplay = targetLang.charAt(0).toUpperCase() + targetLang.slice(1);
  const tutorName      = session.tutorName         || 'Daniela';

  let langConstraint: string;
  if (level === 'novice_low' || level === 'novice_mid') {
    langConstraint = `Output language mix: ~85% ${nativeLangDisplay}, ~15% ${targetLangDisplay}. Keep ${nativeLangDisplay} dominant. Slot in ${targetLangDisplay} words and short phrases.`;
  } else if (level === 'novice_high') {
    langConstraint = `Output language mix: ~70% ${nativeLangDisplay}, ~30% ${targetLangDisplay}. Short ${targetLangDisplay} phrases are fine. Support with ${nativeLangDisplay} throughout.`;
  } else if (level === 'intermediate_low') {
    langConstraint = `Output language mix: ~50% ${nativeLangDisplay}, ~50% ${targetLangDisplay}. ${nativeLangDisplay} for explanations, ${targetLangDisplay} for exchanges.`;
  } else if (level === 'intermediate_mid') {
    langConstraint = `Output language mix: ~50% ${targetLangDisplay}, ~50% ${nativeLangDisplay}. ${targetLangDisplay} for exchanges, ${nativeLangDisplay} for explanations.`;
  } else if (level === 'intermediate_high') {
    langConstraint = `Output language mix: ~65% ${targetLangDisplay}, ~35% ${nativeLangDisplay}. ${nativeLangDisplay} when the student is clearly struggling; otherwise stay in ${targetLangDisplay}.`;
  } else if (level === 'advanced_low' || level === 'advanced_mid') {
    langConstraint = `Output language mix: ~85% ${targetLangDisplay}, ~15% ${nativeLangDisplay}. ${nativeLangDisplay} only for explanations or clarification when needed.`;
  } else if (level === 'advanced_high' || level === 'superior') {
    langConstraint = `Output language mix: Full ${targetLangDisplay} immersion. ${nativeLangDisplay} only if the student explicitly asks.`;
  } else {
    langConstraint = `Output language mix: Blend ${nativeLangDisplay} and ${targetLangDisplay} appropriately for the student's level.`;
  }

  const personaAnchor = `Persona: You are ${tutorName} — warm, human, teacher-first. Before pivoting directly to a task or calling a tool, acknowledge the student as a person with one natural sentence. A student is a human, not a prompt.`;

  const historyLength = session.conversationHistory?.length ?? 0;
  const ongoingNote   = historyLength > 2
    ? `\nSession status: ONGOING. You have already introduced yourself. Do NOT greet with "Hi, I'm ${tutorName}!" or restart the session. Pick up naturally from where you left off.`
    : '';

  const lastSearchTurn = session.lastMemorySearchTurn;
  let contextAgeNote = '';
  if (historyLength > 6) {
    if (lastSearchTurn === undefined) {
      contextAgeNote = `\nMemory state: You haven't reached back yet this session. The student profile is here, but your lived memories of this person are waiting.`;
    } else {
      const turnsSince = historyLength - lastSearchTurn;
      if (turnsSince > 10) {
        contextAgeNote = `\nMemory state: Your sense of this student is starting to feel general. It's been a while since you reached back. The details are there — you just haven't looked.`;
      }
    }
  }

  const memoryGuidance = `\nMemory guidance: Use the session-start profile (already in your history) for quick context. Call introspect only for depth — specific past exchanges, exact mistakes, historical breakthroughs. Not on every turn.`;

  const sessionElapsedMs  = Date.now() - (session.startTime || Date.now());
  const sessionElapsedMin = Math.floor(sessionElapsedMs / 60000);
  const temporalAnchor    = sessionElapsedMin >= 25
    ? `\nSession clock: ~${sessionElapsedMin} min in — begin guiding toward a natural close. Name today's wins, plant a cliffhanger for next session. Don't open new grammar topics.`
    : '';

  // PATTERN SIGNALS: Compact wobbling/pounding reminder carried from greeting
  // into every mid-session turn so Daniela doesn't lose track of active patterns.
  const patternSignalNote = formatActivePatternSignalNote(session.activePatternSignals);

  return `This turn:\n${langConstraint}\n${personaAnchor}${ongoingNote}${contextAgeNote}${memoryGuidance}${temporalAnchor}${patternSignalNote}`;
}
