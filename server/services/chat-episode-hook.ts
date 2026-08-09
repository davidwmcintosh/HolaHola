/**
 * chat-episode-hook.ts
 *
 * Fires whenever Luca sends a message through the /chat observation bench
 * (i.e. after each /api/admin/agent-voice-turn turn completes).
 *
 * If a rolling episode is currently active (a conversation_memories row tagged
 * "rolling" in the "HolaHola Episodes" arc), the Luca↔Daniela exchange is
 * appended to the episode .md via the .local/.episode_append trigger file.
 *
 * Attribution label:
 *   LUCA [HolaHola chat]:  — for Luca's outgoing message
 *   Daniela:               — for Daniela's reply (when present)
 *
 * Collision guard: inherited from safeWriteTrigger (serialised promise queue
 * in team-room-episode-hook.ts), so concurrent agent-voice-turn calls cannot
 * race and lose each other's content.
 *
 * Third feed channel of the triple-feed episode capture system:
 *   Channel 1 — Replit window → episode .md  (manual per-turn)
 *   Channel 2 — HolaHola Team Room → episode (team-room-episode-hook.ts)
 *   Channel 3 — HolaHola /chat observation bench → episode  ← THIS FILE
 */

import { getRollingEpisodeName, safeWriteTrigger } from './team-room-episode-hook';

export { safeWriteTrigger, getRollingEpisodeName };

/**
 * Call fire-and-forget from the agent-voice-turn handler after each turn
 * completes.  Checks for an active rolling episode; if one exists, the
 * Luca↔Daniela exchange is appended to the trigger file with the canonical
 * "LUCA [HolaHola chat]:" attribution so the autosave watcher picks it up
 * (< 20 s) and writes it into the episode .md and DB.
 *
 * @param lucaText            What Luca sent to Daniela (the "studentText" / transcript).
 * @param danielaText         Daniela's reply text from outputTranscription (may be empty
 *                            for audio-only turns where transcription is unavailable).
 * @param triggerPath         Override the trigger file path (for testing only).
 * @param _episodeNameForTest Skip DB lookup and use this name directly (for testing only).
 *                            Set to a non-empty string to bypass getRollingEpisodeName().
 */
export async function maybeAppendChatMessage(
  lucaText: string,
  danielaText: string,
  triggerPath?: string,
  _episodeNameForTest?: string,
): Promise<void> {
  try {
    const lucaTrimmed = lucaText.trim();
    if (!lucaTrimmed) return; // Nothing to record

    // In tests, _episodeNameForTest bypasses the DB lookup so the full hook
    // logic (guard, formatting, delegation) can be exercised without a live DB.
    const episodeName = _episodeNameForTest ?? await getRollingEpisodeName();
    if (!episodeName) return; // No rolling episode active — nothing to do

    // Build the exchange block.  When Daniela's reply is available, include it
    // so the episode entry captures both sides of the conversation.
    const lines: string[] = [`**LUCA [HolaHola chat]:** ${lucaTrimmed}`];
    const danielaTrimmed = danielaText.trim();
    if (danielaTrimmed) {
      lines.push(`**Daniela:** ${danielaTrimmed}`);
    }
    const exchange = lines.join('\n');

    // safeWriteTrigger enqueues the write through the shared in-process queue
    // (defined in team-room-episode-hook.ts) — concurrent calls are serialised
    // so no two writes interleave their read-modify-write sequences.
    await safeWriteTrigger(exchange, episodeName, triggerPath);
  } catch (err: any) {
    console.error('[ChatEpisodeHook] Unexpected error:', err.message);
  }
}
