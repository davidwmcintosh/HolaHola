/**
 * Pattern Signal Context
 *
 * Shared helper: fetch the active grammar-pattern signals for a student so
 * Daniela's per-turn anchor (buildActflPersonaAnchor) reflects the latest
 * compartment state.  Extracted from streaming-voice-orchestrator.ts so it
 * can be called from native-fc-handlers.ts without creating a circular
 * dependency (orchestrator → native-fc-handlers → orchestrator).
 */

import { storage } from '../storage';

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
    return null;
  }
}
