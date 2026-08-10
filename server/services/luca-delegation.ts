/**
 * luca-delegation.ts
 *
 * The handoff that lets Luca direct work from inside HolaHola.
 *
 * delegateToAlden(task, opts?) performs the full delegation loop:
 *
 *   1. Posts Luca's task assignment to Team Room ("LUCA [delegation → Alden]:")
 *   2. Appends the assignment to the rolling episode (via episode hook)
 *   3. Calls Alden (via alden-persona-service) with the task
 *   4. Posts Alden's response to Team Room ("Alden" speaker)
 *   5. Appends Alden's response to the rolling episode
 *   6. Returns the full DelegationResult
 *
 * Why direct import instead of HTTP round-trip:
 *   The priority-task HTTP endpoint already handles the public API. This
 *   service skips the network hop and persistence overhead for server-side
 *   delegation calls (e.g. from luca-responder after an @luca nudge). The
 *   result is always posted to Team Room regardless so David sees it live.
 *
 * Episode attribution labels (per two-channel record pattern):
 *   - Task:     **LUCA [delegation → Alden]:** <text>
 *   - Response: **ALDEN [delegation]:** <text>
 */

import { postAsLuca } from './luca-responder';
import { maybeAppendDelegationExchange } from './team-room-episode-hook';
import { storage } from '../storage';
import { emitNewMessage } from './team-room-ws-broker';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DelegationEngine = 'current' | 'anthropic' | 'gemini' | 'both';

export interface DelegationOptions {
  /** Optional background context to include with the task */
  context?: string;
  /** Which Alden engine(s) to use. Defaults to 'current'. */
  engines?: DelegationEngine;
  /**
   * Optional room ID to post into. Defaults to first active room.
   * Pass this when the caller already knows the room (avoids a DB query).
   */
  roomId?: string;
}

export interface DelegationEngineResult {
  engine: 'anthropic' | 'gemini';
  response: string;
}

export interface DelegationResult {
  /** True when at least one engine returned a non-empty response */
  ok: boolean;
  /** One entry per engine that ran */
  results: DelegationEngineResult[];
  /** Engines that were requested */
  engines: Array<'anthropic' | 'gemini'>;
  /** The episode name that was appended to (null if no rolling episode active) */
  episodeName: string | null;
  /** Error message if the delegation itself failed */
  error?: string;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Format Luca's task announcement for Team Room.
 * Readable for David scrolling the room live.
 */
function formatTaskAnnouncement(task: string, context: string | undefined): string {
  const lines: string[] = [`Delegating to Alden:\n\n${task}`];
  if (context) {
    lines.push(`\nContext: ${context}`);
  }
  return lines.join('');
}

/**
 * Format Alden's response for Team Room.
 * Multi-engine responses are separated clearly.
 */
function formatAldenTeamRoomPost(results: DelegationEngineResult[]): string {
  if (results.length === 1) {
    return `**Alden [${results[0].engine}] — Delegation Response**\n\n${results[0].response}`;
  }
  const anthropic = results.find(r => r.engine === 'anthropic')?.response ?? '—';
  const gemini    = results.find(r => r.engine === 'gemini')?.response ?? '—';
  return [
    `**Alden Dual-Engine Delegation Response**`,
    ``,
    `**Anthropic:**`,
    anthropic,
    ``,
    `**Gemini:**`,
    gemini,
  ].join('\n');
}

/**
 * Format the full delegation exchange for the rolling episode.
 * Both Luca's task and Alden's response land in one block so the episode
 * reads as a conversation, not two disconnected entries.
 */
function formatEpisodeExchange(
  task: string,
  context: string | undefined,
  results: DelegationEngineResult[],
): string {
  const taskLine = context
    ? `**LUCA [delegation → Alden]:** ${task}\n\n_Context: ${context}_`
    : `**LUCA [delegation → Alden]:** ${task}`;

  let responseLine: string;
  if (results.length === 1) {
    responseLine = `**ALDEN [delegation]:** ${results[0].response}`;
  } else {
    const anthropic = results.find(r => r.engine === 'anthropic')?.response ?? '—';
    const gemini    = results.find(r => r.engine === 'gemini')?.response ?? '—';
    responseLine = [
      `**ALDEN [delegation — anthropic]:** ${anthropic}`,
      ``,
      `**ALDEN [delegation — gemini]:** ${gemini}`,
    ].join('\n');
  }

  return `${taskLine}\n\n${responseLine}`;
}

// ── Core delegation function ──────────────────────────────────────────────────

/**
 * Perform the full Luca → Alden delegation loop.
 *
 * Resolves with a DelegationResult — callers should inspect `result.ok` and
 * log `result.error` when false. The function never throws; all errors are
 * captured in the result so the Team Room is always informed.
 */
export async function delegateToAlden(
  task: string,
  opts: DelegationOptions = {},
): Promise<DelegationResult> {
  const { context, engines = 'current', roomId } = opts;

  // ── Step 1: Post Luca's assignment to Team Room ───────────────────────────
  const announcement = formatTaskAnnouncement(task, context);
  const usedRoomId = await postAsLuca(announcement, roomId);

  console.log(`[LucaDelegation] Task submitted → Alden. Room: ${usedRoomId ?? 'unknown'}`);

  // ── Step 2: Call Alden ────────────────────────────────────────────────────
  let engineResults: DelegationEngineResult[] = [];
  try {
    const { generateAldenResponse, getAldenEngine } = await import('./alden-persona-service');

    const userMessage = context
      ? `[LUCA DELEGATION]\n\n${task}\n\n[CONTEXT]\n${context}`
      : `[LUCA DELEGATION]\n\n${task}`;

    const currentEngine = await getAldenEngine();
    const enginesToRun: Array<'anthropic' | 'gemini'> =
      engines === 'both'      ? ['anthropic', 'gemini'] :
      engines === 'anthropic' ? ['anthropic'] :
      engines === 'gemini'    ? ['gemini'] :
      [currentEngine];

    engineResults = await Promise.all(
      enginesToRun.map(async (eng) => {
        const res = await generateAldenResponse({
          userMessage,
          founderName: 'Luca',
          engineOverride: eng,
        });
        return { engine: eng, response: res.response };
      })
    );
  } catch (aldenErr: any) {
    console.error('[LucaDelegation] Alden call failed:', aldenErr.message);

    // Post failure notice to Team Room so David sees it
    const errMsg = `Alden delegation failed: ${aldenErr.message}`;
    await postAsLuca(errMsg, usedRoomId ?? undefined).catch(() => {});

    return {
      ok: false,
      results: [],
      engines: [],
      episodeName: null,
      error: aldenErr.message,
    };
  }

  // ── Step 3: Post Alden's response to Team Room ────────────────────────────
  try {
    const teamRoomPost = formatAldenTeamRoomPost(engineResults);
    const targetRoom = usedRoomId ?? (await storage.listTeamRooms(1))[0]?.id;
    if (targetRoom) {
      const msg = await storage.createRoomMessage({
        roomId: targetRoom,
        speaker: 'Alden',
        content: teamRoomPost,
      });
      emitNewMessage(targetRoom, msg);
      console.log(`[LucaDelegation] Alden response posted to Team Room (${targetRoom})`);
    }
  } catch (postErr: any) {
    console.warn('[LucaDelegation] Failed to post Alden response to Team Room:', postErr.message);
    // Non-fatal — episode append still runs
  }

  // ── Step 4: Append the full delegation exchange to the rolling episode ─────
  let episodeName: string | null = null;
  try {
    const exchange = formatEpisodeExchange(task, context, engineResults);
    episodeName = await maybeAppendDelegationExchange(exchange);
  } catch (epErr: any) {
    console.warn('[LucaDelegation] Episode append failed:', (epErr as any).message);
    // Non-fatal — Team Room record exists
  }

  const enginesToRunFinal: Array<'anthropic' | 'gemini'> = engineResults.map(r => r.engine);

  return {
    ok: engineResults.length > 0 && engineResults.some(r => r.response.length > 0),
    results: engineResults,
    engines: enginesToRunFinal,
    episodeName,
  };
}
