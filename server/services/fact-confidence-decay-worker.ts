/**
 * Fact Confidence Decay Worker
 *
 * Simulates natural forgetting for time-sensitive learner facts.
 * A good tutor remembers what you told her last week; she doesn't actively
 * track something you mentioned once six months ago and never brought up again.
 *
 * WHAT DECAYS:
 *   - Only time-sensitive fact types: goal, travel, life_event
 *   - Only active facts (valid_to IS NULL)
 *   - Only facts unreinforced for >= 14 days (lastMentionedAt threshold)
 *
 * WHAT DOESN'T DECAY:
 *   - Stateful facts (location, work, school) — these stay true until explicitly superseded
 *   - Additive facts (hobby, interest, family) — these accumulate and persist
 *   - Facts mentioned within the last 14 days — reinforcement resets the clock
 *
 * DECAY FORMULA:
 *   confidence = MAX(MIN_CONFIDENCE, confidence * DECAY_FACTOR)
 *   Applied once per weekly run, per qualifying fact.
 *
 *   Starting at 0.8 with 15% weekly decay after 14 days of silence:
 *     Week 2:  0.80 → first decay kicks in
 *     Week 3:  0.68
 *     Week 4:  0.58
 *     Week 5:  0.49  ← fading from Daniela's active follow-ups (< 0.5)
 *     Week 7:  0.36
 *     Week 9:  0.26  ← faded entirely from active context (< 0.3)
 *     Week 12: 0.16  ← near floor
 *     Floor:   0.05  (never fully zero — history is preserved)
 *
 * EFFECT ON RETRIEVAL:
 *   Daniela's snapshot context filters follow-up candidates to confidence >= 0.3.
 *   Facts below that threshold still exist in the DB (valid_to IS NULL, history preserved)
 *   but stop appearing in her active conversational context.
 *
 * REVERSAL:
 *   Any mention of the fact by the student resets lastMentionedAt and bumps mentionCount,
 *   which causes the conflict resolver to treat it as a reinforcement (bumps confidence back).
 */

import { getSharedDb } from '../db';
import { learnerPersonalFacts } from '@shared/schema';
import { and, eq, isNull, lt, inArray, sql } from 'drizzle-orm';

const DECAY_FACTOR = 0.85;
const MIN_CONFIDENCE = 0.05;
const REINFORCEMENT_WINDOW_DAYS = 14;
const RUN_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // weekly

const TIME_SENSITIVE_TYPES = ['goal', 'travel', 'life_event'];

interface DecayStats {
  totalRuns: number;
  lastRunAt: Date | null;
  lastDecayedCount: number;
  lastFadedCount: number; // crossed below 0.3 this run
}

const stats: DecayStats = {
  totalRuns: 0,
  lastRunAt: null,
  lastDecayedCount: 0,
  lastFadedCount: 0,
};

async function runDecayCycle(): Promise<void> {
  const startMs = Date.now();
  const reinforcementCutoff = new Date(Date.now() - REINFORCEMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Fetch all qualifying facts: time-sensitive, active, unreinforced
  const qualifying = await getSharedDb()
    .select({
      id: learnerPersonalFacts.id,
      factType: learnerPersonalFacts.factType,
      fact: learnerPersonalFacts.fact,
      confidenceScore: learnerPersonalFacts.confidenceScore,
      lastMentionedAt: learnerPersonalFacts.lastMentionedAt,
    })
    .from(learnerPersonalFacts)
    .where(
      and(
        isNull(learnerPersonalFacts.validTo),
        inArray(learnerPersonalFacts.factType, TIME_SENSITIVE_TYPES),
        lt(learnerPersonalFacts.lastMentionedAt, reinforcementCutoff)
      )
    );

  if (qualifying.length === 0) {
    console.log('[FactDecay] No qualifying facts this cycle');
    stats.totalRuns++;
    stats.lastRunAt = new Date();
    stats.lastDecayedCount = 0;
    stats.lastFadedCount = 0;
    return;
  }

  let decayedCount = 0;
  let fadedCount = 0;

  for (const fact of qualifying) {
    const currentConfidence = fact.confidenceScore ?? 0.8;
    if (currentConfidence <= MIN_CONFIDENCE) continue;

    const prevConfidence = currentConfidence;
    const newConfidence = Math.max(MIN_CONFIDENCE, currentConfidence * DECAY_FACTOR);
    const crossedFadeThreshold = prevConfidence >= 0.3 && newConfidence < 0.3;

    await getSharedDb()
      .update(learnerPersonalFacts)
      .set({
        confidenceScore: newConfidence,
        updatedAt: new Date(),
      })
      .where(eq(learnerPersonalFacts.id, fact.id));

    decayedCount++;
    if (crossedFadeThreshold) {
      fadedCount++;
      console.log(
        `[FactDecay] FADED: ${fact.factType} — "${fact.fact.slice(0, 60)}" ` +
        `(${prevConfidence.toFixed(2)} → ${newConfidence.toFixed(2)}, now below active threshold)`
      );
    }
  }

  const elapsedMs = Date.now() - startMs;
  stats.totalRuns++;
  stats.lastRunAt = new Date();
  stats.lastDecayedCount = decayedCount;
  stats.lastFadedCount = fadedCount;

  console.log(
    `[FactDecay] Cycle complete: ${decayedCount} facts decayed, ${fadedCount} faded below threshold (${elapsedMs}ms)`
  );
}

let decayInterval: ReturnType<typeof setInterval> | null = null;

export function startFactConfidenceDecayWorker(): void {
  if (decayInterval) {
    console.log('[FactDecay] Worker already running');
    return;
  }

  console.log(
    `[FactDecay] Starting — decay ${Math.round((1 - DECAY_FACTOR) * 100)}%/week on ` +
    `unreinforced time-sensitive facts (${REINFORCEMENT_WINDOW_DAYS}d window)`
  );

  // Run immediately at startup to catch any backlog from previous deployments
  runDecayCycle().catch(err =>
    console.error('[FactDecay] Startup run failed:', err.message)
  );

  // Then repeat weekly
  decayInterval = setInterval(() => {
    runDecayCycle().catch(err =>
      console.error('[FactDecay] Periodic run failed:', err.message)
    );
  }, RUN_INTERVAL_MS);
}

export function getDecayWorkerStats(): DecayStats {
  return { ...stats };
}
