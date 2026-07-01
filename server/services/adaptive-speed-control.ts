import type { StreamingSession } from './streaming-session-types';
import { voiceSpeedToRate } from './voice-speed-config';

/**
 * Adaptive Speech Rate Configuration
 * Auto-adjusts Daniela's speaking speed based on student comprehension signals
 */
const ADAPTIVE_SPEED_CONFIG = {
  // STT confidence thresholds
  LOW_CONFIDENCE_THRESHOLD: 0.7,    // Below this triggers slowdown consideration
  VERY_LOW_CONFIDENCE_THRESHOLD: 0.5, // Below this forces significant slowdown

  // Struggle thresholds
  STRUGGLE_SLOWDOWN_THRESHOLD: 3,   // After N struggles, start slowing down
  STRUGGLE_MAX_EFFECT: 6,           // Cap slowdown effect at N struggles

  // Speed adjustment factors
  MIN_SPEED_MULTIPLIER: 0.7,        // Never go below 70% of user's chosen speed
  MAX_SPEED_MULTIPLIER: 1.0,        // Never exceed user's chosen speed

  // Rolling window for STT confidence
  CONFIDENCE_WINDOW_SIZE: 5,        // Track last N transcripts
};

/**
 * Calculate adaptive speaking rate based on session signals.
 * Returns a multiplier to apply to the user's chosen speed.
 * @returns Multiplier (0.7–1.0) to apply to base speaking rate
 */
export function calculateAdaptiveSpeedMultiplier(session: StreamingSession): number {
  if (!session.adaptiveSpeedEnabled) {
    return 1.0;
  }

  let multiplier = 1.0;

  if (session.recentSttConfidences.length > 0) {
    const avgConfidence = session.recentSttConfidences.reduce((a, b) => a + b, 0) / session.recentSttConfidences.length;
    if (avgConfidence < ADAPTIVE_SPEED_CONFIG.VERY_LOW_CONFIDENCE_THRESHOLD) {
      multiplier = Math.min(multiplier, 0.8);
    } else if (avgConfidence < ADAPTIVE_SPEED_CONFIG.LOW_CONFIDENCE_THRESHOLD) {
      multiplier = Math.min(multiplier, 0.9);
    }
  }

  if (session.sessionStruggleCount >= ADAPTIVE_SPEED_CONFIG.STRUGGLE_SLOWDOWN_THRESHOLD) {
    const effectiveStruggles = Math.min(session.sessionStruggleCount, ADAPTIVE_SPEED_CONFIG.STRUGGLE_MAX_EFFECT);
    const struggleEffect = (effectiveStruggles - ADAPTIVE_SPEED_CONFIG.STRUGGLE_SLOWDOWN_THRESHOLD + 1) * 0.05;
    multiplier = Math.min(multiplier, 1.0 - struggleEffect);
  }

  return Math.max(ADAPTIVE_SPEED_CONFIG.MIN_SPEED_MULTIPLIER, Math.min(ADAPTIVE_SPEED_CONFIG.MAX_SPEED_MULTIPLIER, multiplier));
}

/**
 * Get the effective speaking rate with adaptive adjustment applied.
 * @returns Final speaking rate for TTS (clamped to Cartesia's 0.6–1.5 range)
 */
export function getAdaptiveSpeakingRate(session: StreamingSession): number {
  const baseRate = voiceSpeedToRate(session.voiceSpeed);
  const multiplier = calculateAdaptiveSpeedMultiplier(session);
  const adaptiveRate = baseRate * multiplier;

  if (multiplier < 1.0) {
    console.log(`[Adaptive Speed] Slowing down: ${baseRate} → ${adaptiveRate.toFixed(2)} (${(multiplier * 100).toFixed(0)}% of user speed)`);
  }

  return Math.max(0.6, Math.min(1.5, adaptiveRate));
}

/**
 * Update rolling STT confidence window. Auto-enables adaptive speed on low confidence.
 */
export function trackSttConfidence(session: StreamingSession, confidence: number): void {
  session.recentSttConfidences.push(confidence);
  while (session.recentSttConfidences.length > ADAPTIVE_SPEED_CONFIG.CONFIDENCE_WINDOW_SIZE) {
    session.recentSttConfidences.shift();
  }
  if (confidence < ADAPTIVE_SPEED_CONFIG.LOW_CONFIDENCE_THRESHOLD && !session.adaptiveSpeedEnabled) {
    session.adaptiveSpeedEnabled = true;
    console.log(`[Adaptive Speed] Auto-enabled due to low STT confidence (${(confidence * 100).toFixed(0)}%)`);
  }
}

/**
 * Increment struggle count. Auto-enables adaptive speed when threshold is crossed.
 * Also pushes a timestamp to (session as any)._struggleTimestamps so the
 * PedagogicalSupervisor can compute a rolling 5-minute struggle window instead of
 * relying on the global lifetime counter (which never resets within a session).
 */
export function trackStruggle(session: StreamingSession): void {
  const now = Date.now();
  const fiveMinAgo = now - 5 * 60 * 1000;
  // Prune immediately on every call to prevent unbounded array growth in long sessions.
  let ts: number[] = (session as any)._struggleTimestamps || [];
  ts = ts.filter((t: number) => t > fiveMinAgo);
  ts.push(now);
  (session as any)._struggleTimestamps = ts;
  const rollingCount = ts.length;
  // Use rolling count for adaptive speed so old struggles don't permanently degrade the session.
  if (rollingCount >= ADAPTIVE_SPEED_CONFIG.STRUGGLE_SLOWDOWN_THRESHOLD && !session.adaptiveSpeedEnabled) {
    session.adaptiveSpeedEnabled = true;
    console.log(`[Adaptive Speed] Auto-enabled due to rolling struggle count (${rollingCount} in last 5 min)`);
  }
  // Also increment the lifetime counter for telemetry / DB sync purposes (not used for decisions).
  session.sessionStruggleCount++;
}
