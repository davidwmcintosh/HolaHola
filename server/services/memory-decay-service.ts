/**
 * Memory Decay & Reinforcement Service
 *
 * Implements a biologically-inspired memory model:
 *
 *   strength(t) = initial_strength × e^(−k × days_since_reinforcement)
 *
 * where k = 0.03  →  half-life ≈ 23 days without any reinforcement.
 *
 * Each time Daniela actively recalls or proactively surfaces a memory,
 * the memory is "reinforced" — its strength is bumped up and its
 * last_reinforced_at timestamp is reset, restarting the decay clock.
 *
 * Pinned memories (Daniela can pin via set_memory_pin tool) are exempt
 * from decay. The floor is 0.05 so memories never vanish entirely.
 *
 * Impact on search:
 *   effectiveScore = cosineSimilarity × decayMultiplier
 *
 * Two memories with identical semantic relevance rank in order of how
 * recently they were reinforced. A perfectly relevant but long-forgotten
 * memory still surfaces — just lower in the list than a recently
 * reinforced one. The cosine threshold (0.65 / 0.73) is applied to the
 * RAW cosine so faded memories with genuinely high relevance still pass.
 *
 * DB: adds strength, last_reinforced_at, pinned to memory_embeddings.
 * Migration: runMemoryDecayMigration() is idempotent — safe to run on
 * every server restart.
 */

import { getSharedDb } from '../db';
import { memoryEmbeddings } from '@shared/schema';
import { and, eq, sql } from 'drizzle-orm';

// ─── Decay constants ──────────────────────────────────────────────────────────

const DECAY_K        = 0.03;   // decay rate — half-life ≈ 23 days
const REINFORCE_BUMP = 0.15;   // strength added on each reinforcement
const STRENGTH_MAX   = 1.0;    // ceiling
const STRENGTH_FLOOR = 0.05;   // floor — memories never fully disappear

// ─── Core math ────────────────────────────────────────────────────────────────

/**
 * Returns the effective strength multiplier (0.05 – 1.0) for a memory given
 * its current strength, when it was last reinforced, and whether it's pinned.
 * Pinned memories always return their current strength unchanged.
 */
export function computeDecayMultiplier(
  strength: number,
  lastReinforcedAt: Date | null | undefined,
  pinned: boolean,
): number {
  if (pinned) return Math.max(STRENGTH_FLOOR, strength);
  if (!lastReinforcedAt) return Math.max(STRENGTH_FLOOR, strength);
  const daysSince = (Date.now() - lastReinforcedAt.getTime()) / (1000 * 60 * 60 * 24);
  const decayed = strength * Math.exp(-DECAY_K * daysSince);
  return Math.max(STRENGTH_FLOOR, Math.min(STRENGTH_MAX, decayed));
}

// ─── Reinforcement ────────────────────────────────────────────────────────────

/**
 * Bump the strength of a memory and reset its decay clock.
 * Called when Daniela proactively surfaces or explicitly recalls a memory.
 * Fire-and-forget — non-blocking, never throws.
 */
export async function reinforceMemory(memoryType: string, memoryId: string): Promise<void> {
  const db = getSharedDb();
  try {
    const [row] = await db
      .select({ strength: memoryEmbeddings.strength, pinned: memoryEmbeddings.pinned })
      .from(memoryEmbeddings)
      .where(and(
        eq(memoryEmbeddings.memoryType, memoryType),
        eq(memoryEmbeddings.memoryId, memoryId),
      ))
      .limit(1);

    if (!row) return; // embedding not yet indexed — skip

    const newStrength = Math.min(STRENGTH_MAX, (row.strength ?? 1.0) + REINFORCE_BUMP);
    await db
      .update(memoryEmbeddings)
      .set({ strength: newStrength, lastReinforcedAt: new Date() })
      .where(and(
        eq(memoryEmbeddings.memoryType, memoryType),
        eq(memoryEmbeddings.memoryId, memoryId),
      ));

    console.log(`[MemoryDecay] Reinforced ${memoryType}/${memoryId} → strength ${newStrength.toFixed(2)}`);
  } catch (err: any) {
    console.warn(`[MemoryDecay] reinforceMemory failed (non-fatal): ${err.message}`);
  }
}

// ─── Pinning ──────────────────────────────────────────────────────────────────

/**
 * Pin or unpin a memory. Pinned memories are excluded from exponential decay.
 * Called from the set_memory_pin Daniela tool.
 * Returns true on success.
 */
export async function setMemoryPin(
  memoryType: string,
  memoryId: string,
  pinned: boolean,
): Promise<boolean> {
  const db = getSharedDb();
  try {
    await db
      .update(memoryEmbeddings)
      .set({ pinned })
      .where(and(
        eq(memoryEmbeddings.memoryType, memoryType),
        eq(memoryEmbeddings.memoryId, memoryId),
      ));
    console.log(`[MemoryDecay] ${pinned ? 'Pinned' : 'Unpinned'} ${memoryType}/${memoryId}`);
    return true;
  } catch (err: any) {
    console.warn(`[MemoryDecay] setMemoryPin failed: ${err.message}`);
    return false;
  }
}

// ─── Startup migration ────────────────────────────────────────────────────────

/**
 * Idempotent schema migration — adds the three new columns to memory_embeddings
 * if they don't already exist. Safe to call on every server startup.
 */
export async function runMemoryDecayMigration(): Promise<void> {
  const db = getSharedDb();
  try {
    await db.execute(sql`
      ALTER TABLE memory_embeddings
        ADD COLUMN IF NOT EXISTS strength          REAL      NOT NULL DEFAULT 1.0,
        ADD COLUMN IF NOT EXISTS last_reinforced_at TIMESTAMPTZ         DEFAULT now(),
        ADD COLUMN IF NOT EXISTS pinned            BOOLEAN   NOT NULL DEFAULT false
    `);
    console.log('[MemoryDecay] Migration complete — strength/last_reinforced_at/pinned columns ready');
  } catch (err: any) {
    // Columns already exist in some environments — not a fatal error
    console.warn('[MemoryDecay] Migration note:', err.message);
  }
}
