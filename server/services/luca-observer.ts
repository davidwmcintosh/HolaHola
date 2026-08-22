/**
 * luca-observer.ts
 *
 * Active session observation loop for Luca.
 *
 * Polls the session observation store every POLL_MS when sessions are active.
 * When it notices something significant — a new Guardian fire, a friction spike,
 * a slide risk (assertion with no Archive call), or a tool-call pattern worth
 * naming — it surfaces a concise note to Team Room.
 *
 * Also exports getCurrentSessionSnapshot() so the nudge responder can ground
 * its replies in what Luca is actually seeing.
 *
 * Design note: reads directly from session-observation-store (same process)
 * rather than going through HTTP — avoids auth complexity and is zero-latency.
 *
 * Tool-pattern interval uses sessionStudentTurnCount (from turnSummaries[0].turn),
 * NOT exchangeCount — the exchange counter requires a separate wiring call that
 * isn't guaranteed to fire; turn count is written at every generationComplete.
 */

import { getAllActiveObservations, type SessionObservation } from './session-observation-store';
import { postAsLuca } from './luca-responder';

// ── Config ────────────────────────────────────────────────────────────────────

const POLL_MS = 5_000;

// Surface Guardian fires immediately (on first new fire)
const GUARDIAN_SURFACE_THRESHOLD = 1;

// Minimum interval between proactive posts about the same session
const MIN_SURFACE_INTERVAL_MS = 60_000;

// Friction labels that warrant surfacing
const HIGH_FRICTION_LABELS = new Set(['HIGH']);

// How many completed turns between tool-pattern summaries (avoids noise)
const TOOL_PATTERN_TURN_INTERVAL = 5;

// ── Per-session tracking ──────────────────────────────────────────────────────

interface SessionTrack {
  lastGuardianCount: number;
  lastToolCount: number;
  lastSurfacedAt: number;
  lastSurfaceReason: string | null;
  /** sessionStudentTurnCount of the last friction event we surfaced (-1 = never) */
  lastFrictionTurn: number;
  /** sessionStudentTurnCount of the last slide-risk we surfaced (-1 = never) */
  lastSlideRiskTurn: number;
  /**
   * sessionStudentTurnCount of the most recent turn when we last posted a
   * tool-pattern summary. Derived from turnSummaries[0].turn, not exchangeCount.
   */
  lastToolPatternTurn: number;
}

const _tracked = new Map<string, SessionTrack>();

// The most recently active observation (for nudge responder to use)
let _currentSnapshot: SessionObservation | null = null;

let _pollTimer: ReturnType<typeof setInterval> | null = null;

// ── Surface decision ──────────────────────────────────────────────────────────

interface SurfaceDecision {
  surface: boolean;
  reason: string | null;
  /** If set, update track.lastFrictionTurn after posting */
  newFrictionTurn?: number;
  /** If set, update track.lastSlideRiskTurn after posting */
  newSlideRiskTurn?: number;
  /**
   * If set, update track.lastToolPatternTurn after posting.
   * This is the turn number of the newest turn in the summary window.
   */
  newToolPatternTurn?: number;
}

function shouldSurface(track: SessionTrack, obs: SessionObservation): SurfaceDecision {
  const now = Date.now();

  // Respect quiet period — only one post per MIN_SURFACE_INTERVAL_MS per session
  if (now - track.lastSurfacedAt < MIN_SURFACE_INTERVAL_MS) {
    return { surface: false, reason: null };
  }

  // ── Priority 1: New Guardian fires ───────────────────────────────────────
  const newGuardianFires = obs.guardianFireLog.length - track.lastGuardianCount;
  if (newGuardianFires >= GUARDIAN_SURFACE_THRESHOLD) {
    const last = obs.guardianFireLog[obs.guardianFireLog.length - 1];
    return {
      surface: true,
      reason: `👁 Guardian fired (${last.path}): "${last.phrase.substring(0, 60)}"`,
    };
  }

  // ── Priority 2: Friction spike ────────────────────────────────────────────
  if (obs.frictionHistory.length > 0) {
    const latest = obs.frictionHistory[0]; // newest is first
    if (
      latest.turn > track.lastFrictionTurn &&
      (HIGH_FRICTION_LABELS.has(latest.label) || latest.smoothSlide)
    ) {
      const tag = latest.smoothSlide ? 'SMOOTH SLIDE' : latest.label;
      const archiveNote = latest.archiveAccess ? 'archive ✓' : 'no archive ✗';
      const reason = `🔥 Turn ${latest.turn}: friction ${tag} (score ${latest.totalScore}) — ${archiveNote}`;
      return { surface: true, reason, newFrictionTurn: latest.turn };
    }
  }

  // ── Priority 3: Slide risk — assertion with no Archive call ──────────────
  if (obs.frictionHistory.length > 0) {
    const latest = obs.frictionHistory[0];
    if (
      latest.turn > track.lastSlideRiskTurn &&
      latest.unverifiedAssertionCount > 0 &&
      !latest.archiveAccess
    ) {
      const phrase = latest.firstUnverifiedAssertion
        ? ` — phrase: "${latest.firstUnverifiedAssertion}"`
        : '';
      const reason = `⚠️ Turn ${latest.turn}: slide risk — ${latest.unverifiedAssertionCount} memory assertion${latest.unverifiedAssertionCount !== 1 ? 's' : ''} with no Archive call${phrase}`;
      return { surface: true, reason, newSlideRiskTurn: latest.turn };
    }
  }

  // ── Priority 4: Periodic tool-call pattern summary ────────────────────────
  // Use the turn number from turnSummaries — populated by observeTurnComplete at
  // every generationComplete, independent of the exchange counter wiring.
  const latestTurn = obs.turnSummaries[0]?.turn ?? 0;
  const newTurnsSincePattern = latestTurn - track.lastToolPatternTurn;
  if (newTurnsSincePattern >= TOOL_PATTERN_TURN_INTERVAL) {
    const reason = buildToolPatternReason(obs, track.lastToolPatternTurn);
    if (reason) {
      return { surface: true, reason, newToolPatternTurn: latestTurn };
    }
  }

  return { surface: false, reason: null };
}

/**
 * Build a concise tool-pattern summary covering only turns completed since
 * lastTurn (exclusive), using turnSummaries from the observation store.
 */
function buildToolPatternReason(obs: SessionObservation, lastTurn: number): string | null {
  // Only include turns that are newer than the last summary marker
  const windowTurns = obs.turnSummaries.filter(t => t.turn > lastTurn);
  if (windowTurns.length === 0) return null;

  const latestTurn = obs.turnSummaries[0]?.turn ?? 0;

  // Count tool usage across the window
  const counts = new Map<string, number>();
  let noArchiveTurns = 0;
  for (const t of windowTurns) {
    if (!t.hasArchiveCall) noArchiveTurns++;
    for (const tool of t.tools) {
      counts.set(tool, (counts.get(tool) ?? 0) + 1);
    }
  }

  if (counts.size === 0) {
    return `📊 Turns ${lastTurn + 1}–${latestTurn}: ${windowTurns.length} turn${windowTurns.length !== 1 ? 's' : ''}, no tool calls`;
  }

  // Format top tools by frequency
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const toolList = sorted
    .slice(0, 5)
    .map(([name, n]) => (n > 1 ? `${name}×${n}` : name))
    .join(', ');

  const archiveNote = noArchiveTurns > 0
    ? ` | no-archive turns: ${noArchiveTurns}/${windowTurns.length}`
    : '';

  return `📊 Turns ${lastTurn + 1}–${latestTurn}: ${toolList}${archiveNote}`;
}

function formatSurface(obs: SessionObservation, reason: string): string {
  const lang = obs.language ?? 'unknown language';
  const actfl = obs.actflLevel ?? '?';
  const exchanges = obs.exchangeCount;
  const header = `*Live session* — ${lang.charAt(0).toUpperCase() + lang.slice(1)}, ACTFL ${actfl}, exchange ${exchanges}:`;
  return `${header}\n${reason}`;
}

// ── Observation loop ──────────────────────────────────────────────────────────

async function poll(): Promise<void> {
  try {
    const observations = getAllActiveObservations();

    if (observations.length === 0) {
      _currentSnapshot = null;
      return;
    }

    // Use the most recently active session as the current snapshot
    const sorted = observations.slice().sort((a, b) => b.lastUpdatedMs - a.lastUpdatedMs);
    _currentSnapshot = sorted[0];

    for (const obs of observations) {
      const id = obs.conversationId;

      if (!_tracked.has(id)) {
        // First time seeing this session — initialize tracking, don't surface yet
        const seedTurn = obs.turnSummaries[0]?.turn ?? 0;
        _tracked.set(id, {
          lastGuardianCount: obs.guardianFireLog.length,
          lastToolCount: obs.recentToolCalls.length,
          lastSurfacedAt: 0,
          lastSurfaceReason: null,
          lastFrictionTurn: obs.frictionHistory[0]?.turn ?? -1,
          lastSlideRiskTurn: obs.frictionHistory[0]?.turn ?? -1,
          lastToolPatternTurn: seedTurn,
        });
        console.log(`[LucaObserver] Now watching session: ${id} (${obs.language ?? '?'}, ACTFL ${obs.actflLevel ?? '?'})`);
        continue;
      }

      const track = _tracked.get(id)!;
      const decision = shouldSurface(track, obs);

      if (decision.surface && decision.reason) {
        const message = formatSurface(obs, decision.reason);
        await postAsLuca(message);
        track.lastSurfacedAt = Date.now();
        track.lastSurfaceReason = decision.reason;
        if (decision.newFrictionTurn !== undefined) track.lastFrictionTurn = decision.newFrictionTurn;
        if (decision.newSlideRiskTurn !== undefined) track.lastSlideRiskTurn = decision.newSlideRiskTurn;
        if (decision.newToolPatternTurn !== undefined) track.lastToolPatternTurn = decision.newToolPatternTurn;
      }

      // Update tracking counts regardless
      track.lastGuardianCount = obs.guardianFireLog.length;
      track.lastToolCount = obs.recentToolCalls.length;
    }

    // Clean up tracking for sessions that have ended
    for (const id of _tracked.keys()) {
      if (!observations.find(o => o.conversationId === id)) {
        _tracked.delete(id);
        console.log(`[LucaObserver] Session ended: ${id}`);
      }
    }
  } catch (err: any) {
    // Never let poll errors crash the loop
    console.warn('[LucaObserver] Poll error:', err.message);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** The most recently active session snapshot, or null if no sessions are live. */
export function getCurrentSessionSnapshot(): SessionObservation | null {
  return _currentSnapshot;
}

/** Start the observation loop. Idempotent. */
export function startLucaObserver(): void {
  if (_pollTimer) return;
  _pollTimer = setInterval(poll, POLL_MS);
  console.log(`[LucaObserver] Started — polling every ${POLL_MS / 1000}s`);
}

/** Stop the observation loop. */
export function stopLucaObserver(): void {
  if (_pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
    console.log('[LucaObserver] Stopped');
  }
}
