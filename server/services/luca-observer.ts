/**
 * luca-observer.ts
 *
 * Active session observation loop for Luca.
 *
 * Polls the session observation store every POLL_MS when sessions are active.
 * When it notices something significant — a new Guardian fire, a burst of tool
 * failures, a friction spike — it surfaces a note to Team Room proactively.
 *
 * Also exports getCurrentSessionSnapshot() so the nudge responder can ground
 * its replies in what Luca is actually seeing.
 *
 * Design note: reads directly from session-observation-store (same process)
 * rather than going through HTTP — avoids auth complexity and is zero-latency.
 */

import { getAllActiveObservations, type SessionObservation } from './session-observation-store';
import { postAsLuca } from './luca-responder';

// ── Config ────────────────────────────────────────────────────────────────────

const POLL_MS = 5_000;

// How many guardian fires in a short window before Luca surfaces a note
const GUARDIAN_SURFACE_THRESHOLD = 1; // surface on first new fire

// Minimum interval between proactive posts about the same session
const MIN_SURFACE_INTERVAL_MS = 60_000;

// ── Per-session tracking ──────────────────────────────────────────────────────

interface SessionTrack {
  lastGuardianCount: number;
  lastToolCount: number;
  lastSurfacedAt: number;
  lastSurfaceReason: string | null;
}

const _tracked = new Map<string, SessionTrack>();

// The most recently active observation (for nudge responder to use)
let _currentSnapshot: SessionObservation | null = null;

let _pollTimer: ReturnType<typeof setInterval> | null = null;

// ── Observation loop ──────────────────────────────────────────────────────────

function shouldSurface(track: SessionTrack, obs: SessionObservation): { surface: boolean; reason: string | null } {
  const now = Date.now();

  // Respect quiet period
  if (now - track.lastSurfacedAt < MIN_SURFACE_INTERVAL_MS) {
    return { surface: false, reason: null };
  }

  // New Guardian fires since last check
  const newGuardianFires = obs.guardianFireLog.length - track.lastGuardianCount;
  if (newGuardianFires >= GUARDIAN_SURFACE_THRESHOLD) {
    const last = obs.guardianFireLog[obs.guardianFireLog.length - 1];
    return {
      surface: true,
      reason: `Guardian fired (${last.path}): "${last.phrase.substring(0, 60)}"`,
    };
  }

  return { surface: false, reason: null };
}

function formatSurface(obs: SessionObservation, reason: string): string {
  const lang = obs.language ?? 'unknown language';
  const actfl = obs.actflLevel ?? '?';
  const exchanges = obs.exchangeCount;
  return `👁 *Live session note* — ${lang.charAt(0).toUpperCase() + lang.slice(1)}, ACTFL ${actfl}, exchange ${exchanges}: ${reason}`;
}

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
        _tracked.set(id, {
          lastGuardianCount: obs.guardianFireLog.length,
          lastToolCount: obs.recentToolCalls.length,
          lastSurfacedAt: 0,
          lastSurfaceReason: null,
        });
        console.log(`[LucaObserver] Now watching session: ${id} (${obs.language ?? '?'}, ACTFL ${obs.actflLevel ?? '?'})`);
        continue;
      }

      const track = _tracked.get(id)!;
      const { surface, reason } = shouldSurface(track, obs);

      if (surface && reason) {
        const message = formatSurface(obs, reason);
        await postAsLuca(message);
        track.lastSurfacedAt = Date.now();
        track.lastSurfaceReason = reason;
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
