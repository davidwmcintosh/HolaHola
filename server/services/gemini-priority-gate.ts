/**
 * Gemini Priority Gate
 * 
 * Prevents background workers (Sofia, Wren hive, Lyra) from exhausting the
 * Gemini quota while a live voice session is generating a response.
 * 
 * Usage:
 *   - Voice sessions: wrap Gemini calls with acquireVoiceSlot() / releaseVoiceSlot()
 *   - Background workers: call acquireBackgroundSlot() before calling Gemini;
 *     it resolves immediately when no voice slot is held, or waits up to
 *     BACKGROUND_MAX_WAIT_MS and then resolves anyway (never blocks forever).
 */

const BACKGROUND_MAX_WAIT_MS = 30_000; // background workers wait at most 30 s
const BACKGROUND_POLL_MS     = 500;    // how often they re-check

let activeLiveSessions = 0;
let backgroundWaiters: Array<() => void> = [];

/** Called by voice orchestrator at the start of every AI-generating turn. */
export function acquireVoiceSlot(): void {
  activeLiveSessions++;
}

/** Called by voice orchestrator when a turn finishes (success, error, or interrupt). */
export function releaseVoiceSlot(): void {
  activeLiveSessions = Math.max(0, activeLiveSessions - 1);
}

/** Returns true if any live voice session is currently generating. */
export function isVoiceActive(): boolean {
  return activeLiveSessions > 0;
}

/**
 * Background workers call this before making a Gemini request.
 * Resolves immediately when no live session is active; otherwise polls
 * until clear or the timeout elapses.
 */
export async function acquireBackgroundSlot(label = 'background'): Promise<void> {
  if (!isVoiceActive()) return;

  console.log(`[GeminiGate] ${label}: voice session active — waiting up to ${BACKGROUND_MAX_WAIT_MS / 1000}s`);
  const deadline = Date.now() + BACKGROUND_MAX_WAIT_MS;

  while (isVoiceActive() && Date.now() < deadline) {
    await new Promise<void>(resolve => setTimeout(resolve, BACKGROUND_POLL_MS));
  }

  if (isVoiceActive()) {
    console.warn(`[GeminiGate] ${label}: timeout waiting for voice slot — proceeding anyway`);
  } else {
    console.log(`[GeminiGate] ${label}: voice session cleared — proceeding`);
  }
}
