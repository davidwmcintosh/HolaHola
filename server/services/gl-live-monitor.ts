/**
 * GL Live Monitor — real-time Team Room alerts during active GL sessions.
 *
 * When threshold events fire in the GL pipeline (HIGH friction, thought stalls,
 * tool failures, reconnects, ACTFL recalibration), this service posts immediately
 * to the Team Room so Alden can watch live sessions and diagnose problems in real time
 * rather than after the fact.
 *
 * Design principles:
 * - Fire-and-forget: never block the GL pipeline on a Team Room post.
 * - Per-session cooldown: same event type won't spam every 2 seconds.
 * - Threshold-gated: only notable events post (not every tool call).
 */

const COOLDOWN_MS = 30_000; // 30s per event-type per session

// Map of `${sessionId}:${eventType}` → last-posted timestamp
const cooldowns = new Map<string, number>();

function isOnCooldown(sessionId: string, eventType: string): boolean {
  const key = `${sessionId}:${eventType}`;
  const last = cooldowns.get(key) ?? 0;
  if (Date.now() - last < COOLDOWN_MS) return true;
  cooldowns.set(key, Date.now());
  // Prune stale entries periodically to prevent map growth in long server runs
  if (cooldowns.size > 500) {
    const cutoff = Date.now() - COOLDOWN_MS * 10;
    for (const [k, v] of cooldowns) {
      if (v < cutoff) cooldowns.delete(k);
    }
  }
  return false;
}

async function postToTeamRoom(content: string): Promise<void> {
  try {
    const agentToken = process.env.REPLIT_AGENT_TOKEN;
    if (!agentToken) return;
    const appUrl = process.env.APP_URL || 'http://localhost:5000';
    await fetch(`${appUrl}/api/agent/team-room/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-agent-token': agentToken },
      body: JSON.stringify({ content }),
    });
  } catch {
    // Non-critical — monitoring must never crash the session
  }
}

export type GlLiveEventType =
  | 'friction_high'
  | 'thought_stall'
  | 'tool_failure'
  | 'audio_reset_cluster'
  | 'reconnect_mid_turn'
  | 'actfl_recalibration'
  | 'grace_expired';

/**
 * Post a threshold alert to Team Room during a live GL session.
 * Silently no-ops when on cooldown or when the Team Room token is absent.
 */
export function glLiveAlert(opts: {
  sessionId: string;
  userId: string | number;
  lang?: string;
  eventType: GlLiveEventType;
  detail: Record<string, unknown>;
}): void {
  const { sessionId, userId, lang, eventType, detail } = opts;
  if (isOnCooldown(sessionId, eventType)) return;

  const sessionTag = `[session ${String(sessionId).slice(0, 8)} · user ${String(userId).slice(0, 8)}${lang ? ` · ${lang}` : ''}]`;
  const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  const lines: string[] = [`🔴 GL LIVE [${time}] ${sessionTag}`];

  switch (eventType) {
    case 'friction_high':
      lines.push(`HIGH FRICTION — student showing clear struggle signals`);
      if (detail.avgPauseMs) lines.push(`  Pre-speech pause: ${Math.round(Number(detail.avgPauseMs) / 100) / 10}s avg`);
      if (detail.avgWords) lines.push(`  Words/turn: ${detail.avgWords}`);
      if (detail.avgMidPauses) lines.push(`  Mid-sentence pauses: ${detail.avgMidPauses}/turn`);
      break;
    case 'thought_stall':
      lines.push(`THOUGHT STALL — Gemini reasoned but produced no audio/text in 10s; turn sealed manually`);
      if (detail.thoughtBuffer) lines.push(`  Thought preview: "${String(detail.thoughtBuffer).slice(0, 120)}"`);
      break;
    case 'tool_failure':
      lines.push(`TOOL FAILURE — ${detail.toolName ?? 'unknown'}`);
      if (detail.error) lines.push(`  Error: ${String(detail.error).slice(0, 200)}`);
      break;
    case 'audio_reset_cluster':
      lines.push(`AUDIO RESET CLUSTER — ${detail.count ?? '?'} resets in short window`);
      if (detail.tools) lines.push(`  Tools involved: ${detail.tools}`);
      break;
    case 'reconnect_mid_turn':
      lines.push(`RECONNECT MID-TURN — connection dropped while Daniela was speaking`);
      if (detail.attempt) lines.push(`  Reconnect attempt: ${detail.attempt}`);
      break;
    case 'actfl_recalibration':
      lines.push(`ACTFL RECALIBRATION — VAD tier changing, proactive reconnect triggered`);
      if (detail.newLevel) lines.push(`  New level: ${detail.newLevel}`);
      break;
    case 'grace_expired':
      lines.push(`GRACE PERIOD EXPIRED — student disconnected and did not return`);
      if (detail.exchangeCount) lines.push(`  Exchanges completed: ${detail.exchangeCount}`);
      break;
  }

  const message = lines.join('\n');
  // Fire-and-forget — never await this
  postToTeamRoom(message).catch(() => {});
}
