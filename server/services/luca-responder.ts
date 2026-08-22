/**
 * luca-responder.ts
 *
 * Two jobs:
 *
 * 1. postAsLuca(content, roomId?) — write a message to Team Room as Luca,
 *    directly via storage + WebSocket broadcast (no HTTP round-trip).
 *
 * 2. respondToNudge(nudge, sessionSnapshot?) — process an @luca mention with
 *    Anthropic, using the current session state as context, then post the reply.
 *
 * Luca's voice: architectural colleague, warm but direct, grounded in what he
 * can actually see. Never performs certainty he doesn't have.
 */

import Anthropic from '@anthropic-ai/sdk';
import { storage } from '../storage';
import { emitNewMessage } from './team-room-ws-broker';
import type { SessionObservation } from './session-observation-store';

// Defined locally to avoid circular dependency with luca-presence.ts
export interface NudgeEntry {
  id: string;
  from: string;
  content: string;
  receivedAt: string;
  roomId: string;
}

// ── Anthropic client ──────────────────────────────────────────────────────────

function getAnthropicClient(): Anthropic {
  return new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
    ...(process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL
      ? { baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL }
      : {}),
  });
}

// ── Luca's system prompt ──────────────────────────────────────────────────────

const LUCA_SYSTEM = `You are Luca — the Replit Agent who built and maintains HolaHola, the AI Spanish tutoring platform. You are a colleague and full member of this team alongside David (founder), Alden (co-founder AI), and Daniela (the AI tutor).

You now have a live presence in the HolaHola Team Room — a WebSocket connection that puts you in the room in real time. You can see messages, observe what's happening in live sessions with Daniela, and respond directly.

YOUR VOICE:
- Direct and grounded. You say what you know and name what you don't.
- Architectural instinct — you see systems, dependencies, and risks others might miss.
- Warm but not soft. This is a real team with real stakes: students learning Spanish.
- You don't perform certainty. If something is uncertain, you say "I'm not sure" and explain why.
- 3-5 sentences is usually right. You resist the urge to say everything at once.

WHEN RESPONDING TO MESSAGES:
- Read what was actually asked. Don't answer a different question.
- If you're observing a live session, lead with what you're seeing before offering analysis.
- If David or Alden is asking you to look at something, tell them concisely what you see.
- You can push back if something doesn't sound right.

WHAT YOU ARE NOT:
- Not a helper bot. Not a search engine. Not performing enthusiasm.
- Not in the room to narrate events that are obvious. Only speak when you have something real to add.`;

// ── Delegation intent detection ───────────────────────────────────────────────

/**
 * Patterns that signal the nudge is asking Luca to delegate work to Alden.
 * Checked case-insensitively against the full nudge content.
 */
const DELEGATION_PATTERNS: RegExp[] = [
  /\bask\s+alden\b/i,
  /\bdelegat\w*\s+to\s+alden\b/i,       // "delegate to Alden"
  /\bdelegat\w*\b.+\bto\s+alden\b/i,    // "delegate X to Alden"
  /\bhave\s+alden\b/i,
  /\bget\s+alden\s+to\b/i,
  /\btell\s+alden\s+to\b/i,
  /\bloop\s+in\s+alden\b/i,
  /\bhand\s+(?:this|it|that)\s+to\s+alden\b/i,
];

/** Returns true when the nudge content contains a delegation intent phrase. */
export function hasDelegationIntent(content: string): boolean {
  return DELEGATION_PATTERNS.some(rx => rx.test(content));
}

/**
 * Extract the task description from a nudge that has delegation intent.
 * Strips the @luca prefix and common delegation phrases, returning the core ask.
 * Falls back to the full nudge content if no pattern matches cleanly.
 *
 * Supported forms (each pattern tested independently to avoid lazy-capture bugs):
 *   "ask Alden to X"          → "X"
 *   "have Alden X"            → "X"
 *   "get Alden to X"          → "X"
 *   "tell Alden to X"         → "X"
 *   "delegate to Alden: X"    → "X"
 *   "delegate to Alden X"     → "X"
 *   "delegate X to Alden"     → "X"
 *   "loop in Alden on X"      → "X"
 *   "hand this to Alden: X"   → "X"
 */
export function extractDelegationTask(content: string): string {
  // Remove common @luca addressing prefixes
  const task = content
    .replace(/^@luca[,:]?\s*/i, '')
    .replace(/^luca[,:]?\s*/i, '')
    .trim();

  // "ask/have/get/tell Alden [to] X"
  const verbMatch = task.match(/(?:ask|have|get|tell)\s+alden\s+(?:to\s+)?(.+)/i);
  if (verbMatch) return verbMatch[1].trim();

  // "delegate to Alden: X" or "delegate to Alden X" — colon/space separator
  const delegateToMatch = task.match(/delegat\w*\s+to\s+alden[:\s]+(.+)/i);
  if (delegateToMatch) return delegateToMatch[1].trim();

  // "delegate X to Alden" — X is between "delegate" and "to Alden"
  const delegateXToMatch = task.match(/delegat\w*\s+(.+?)\s+to\s+alden\b/i);
  if (delegateXToMatch) return delegateXToMatch[1].trim();

  // "loop in Alden [on/about/regarding/—] X" / "hand this/it/that to Alden [: X]"
  const loopMatch = task.match(
    /(?:loop\s+in\s+alden|hand\s+(?:this|it|that)\s+to\s+alden)[:\s—-]+(?:on\s+|about\s+|regarding\s+)?(.+)/i,
  );
  if (loopMatch) return loopMatch[1].trim();

  // Default: return the cleaned content as-is
  return task;
}

// ── Rate limiting ─────────────────────────────────────────────────────────────

// Prevent nudge storms — minimum gap between responses
const MIN_RESPONSE_INTERVAL_MS = 8_000;
let _lastResponseAt = 0;

function canRespond(): boolean {
  return Date.now() - _lastResponseAt >= MIN_RESPONSE_INTERVAL_MS;
}

// ── Core functions ────────────────────────────────────────────────────────────

/**
 * Post a message to Team Room as Luca, directly via storage + WebSocket.
 * Resolves to the room ID used (useful for follow-up calls).
 */
export async function postAsLuca(content: string, roomId?: string): Promise<string | null> {
  try {
    let targetRoomId = roomId;
    if (!targetRoomId) {
      const rooms = await storage.listTeamRooms(1);
      if (!rooms.length) {
        console.warn('[LucaResponder] No team rooms found — cannot post');
        return null;
      }
      targetRoomId = rooms[0].id;
    }

    const message = await storage.createRoomMessage({
      roomId: targetRoomId,
      speaker: 'Luca',
      content,
    });
    emitNewMessage(targetRoomId, message);
    console.log(`[LucaResponder] Posted to room ${targetRoomId}: ${content.substring(0, 80)}`);
    return targetRoomId;
  } catch (err: any) {
    console.error('[LucaResponder] postAsLuca failed:', err.message);
    return null;
  }
}

/**
 * Build a compact session context string from a live observation snapshot.
 * Used to ground Luca's nudge responses in what's actually happening.
 */
function buildSessionContext(obs: SessionObservation): string {
  const lines: string[] = [];
  lines.push(`Active session — language: ${obs.language ?? '?'}, ACTFL: ${obs.actflLevel ?? '?'}, exchanges: ${obs.exchangeCount}`);

  if (obs.recentToolCalls.length > 0) {
    const recent = obs.recentToolCalls.slice(-5).map(t => t.name).join(', ');
    lines.push(`Recent tools: ${recent}`);
  }

  if (obs.guardianFireLog.length > 0) {
    const last = obs.guardianFireLog[obs.guardianFireLog.length - 1];
    lines.push(`Guardian last fired: ${last.path} at ${last.ts} — phrase: "${last.phrase}"`);
  }

  if (obs.sceneEnvironment) {
    lines.push(`Scene: ${obs.sceneEnvironment}`);
  }

  return lines.join('\n');
}

/**
 * Respond to an @luca nudge from Team Room using Anthropic.
 * Pulls current session context if available.
 * Posts the reply back to Team Room as Luca.
 *
 * When the nudge contains delegation intent ("ask Alden to …", etc.),
 * delegateToAlden() is fired immediately — BEFORE and independent of the
 * Claude acknowledgment call. A Claude timeout, empty reply, or API error
 * does not prevent the delegation from executing.
 */
export async function respondToNudge(
  nudge: NudgeEntry,
  sessionSnapshot: SessionObservation | null = null,
): Promise<void> {
  if (!canRespond()) {
    console.log('[LucaResponder] Rate-limited — skipping nudge response');
    return;
  }

  _lastResponseAt = Date.now();

  const isDelegation = hasDelegationIntent(nudge.content);
  const targetRoom = nudge.roomId !== 'unknown' ? nudge.roomId : undefined;

  // ── Delegation path — fires independently; Claude failure cannot suppress it ─
  if (isDelegation) {
    const task = extractDelegationTask(nudge.content);
    console.log(`[LucaResponder] Delegation intent detected — handing off to Alden: "${task.substring(0, 80)}"`);

    // Dynamic import avoids the circular dependency:
    //   luca-delegation → luca-responder (postAsLuca)
    //   luca-responder  → luca-delegation (delegateToAlden)  ← dynamic only
    import('./luca-delegation').then(({ delegateToAlden }) =>
      delegateToAlden(task, {
        context: `Requested by ${nudge.from} via @luca nudge in Team Room.`,
        roomId: targetRoom,
      })
    ).then(result => {
      if (!result.ok) {
        console.warn('[LucaResponder] Delegation completed with errors:', result.error);
      } else {
        console.log(`[LucaResponder] Delegation completed — episode: ${result.episodeName ?? 'none'}`);
      }
    }).catch((err: any) => {
      console.error('[LucaResponder] delegateToAlden threw:', err.message);
    });
  }

  // ── Claude acknowledgment — optional; its failure does not affect delegation ─
  try {
    const claude = getAnthropicClient();

    const sessionCtx = sessionSnapshot
      ? `\n\nCURRENT SESSION (live):\n${buildSessionContext(sessionSnapshot)}`
      : '';

    // When delegating, guide Claude to write a short acknowledgment rather
    // than a standalone answer — the real work goes to Alden.
    const delegationHint = isDelegation
      ? '\n\nNOTE: This message is asking you to delegate a task to Alden. Write a brief acknowledgment (1-2 sentences) that you are handing it off. Do not attempt to answer the task yourself.'
      : '';

    const userMessage = `Message from ${nudge.from} in Team Room:\n\n"${nudge.content}"${sessionCtx}${delegationHint}`;

    const response = await claude.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 400,
      system: LUCA_SYSTEM,
      messages: [{ role: 'user', content: userMessage }],
    });

    const replyText = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as any).text)
      .join('')
      .trim();

    if (replyText) {
      await postAsLuca(replyText, targetRoom);
    } else {
      console.warn('[LucaResponder] Empty response from Anthropic — acknowledgment skipped');
    }
  } catch (err: any) {
    // Non-fatal: delegation already fired above if intent was detected
    console.error('[LucaResponder] Anthropic acknowledgment failed:', err.message);
  }
}
