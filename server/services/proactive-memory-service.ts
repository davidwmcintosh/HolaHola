/**
 * Proactive Memory Surfacing Service
 *
 * After each user utterance, asynchronously checks whether the content
 * semantically matches any stored memory. Results are STAGED in the session
 * and injected into context at the START of the NEXT turn — zero latency
 * impact on the current response.
 *
 * Design principles:
 * - Threshold 0.73 (vs recall's 0.65) — higher bar to avoid noisy injections
 * - Max 2 surfaces per utterance, 8 total per session (avoid context bloat)
 * - Deduplication: never surface the same memory twice in a session
 * - Only substantive utterances (≥ 6 words) trigger a check
 * - Incognito sessions: always skipped
 * - Never throws — best-effort enrichment, failure is silent
 */

import { semanticSearch } from './semantic-memory-service';
import { getSharedDb } from '../db';
import {
  studentInsights,
  learnerPersonalFacts,
  hiveSnapshots,
  danielaGrowthMemories,
} from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { StreamingSession } from './streaming-session-types';

const SIMILARITY_THRESHOLD = 0.73;
const MAX_PER_CHECK = 2;
const MAX_PER_SESSION = 8;
const MIN_WORDS = 6;

async function hydrateMemory(memoryType: string, memoryId: string): Promise<string | null> {
  const db = getSharedDb();
  try {
    if (memoryType === 'student_insight') {
      const [row] = await db
        .select({ insight: studentInsights.insight, category: studentInsights.category })
        .from(studentInsights)
        .where(eq(studentInsights.id, memoryId))
        .limit(1);
      if (row) return `[${row.category}] ${row.insight}`;
    } else if (memoryType === 'personal_fact') {
      const [row] = await db
        .select({ fact: learnerPersonalFacts.fact, factType: learnerPersonalFacts.factType })
        .from(learnerPersonalFacts)
        .where(eq(learnerPersonalFacts.id, memoryId))
        .limit(1);
      if (row) return `[${row.factType}] ${row.fact}`;
    } else if (memoryType === 'hive_snapshot') {
      const [row] = await db
        .select({ title: hiveSnapshots.title, content: hiveSnapshots.content })
        .from(hiveSnapshots)
        .where(eq(hiveSnapshots.id, memoryId))
        .limit(1);
      if (row) return `${row.title}: ${(row.content ?? '').substring(0, 200)}`;
    } else if (memoryType === 'growth_memory') {
      const [row] = await db
        .select({ content: danielaGrowthMemories.content })
        .from(danielaGrowthMemories)
        .where(eq(danielaGrowthMemories.id, memoryId))
        .limit(1);
      if (row) return (row.content ?? '').substring(0, 200);
    }
  } catch { /* skip — hydration is best-effort */ }
  return null;
}

/**
 * Fire this after each user utterance (non-awaited in the hot path).
 * Stages discovered memories in session.pendingMemorySurfaces for
 * injection at the top of the next Gemini call.
 */
export async function checkForMemoryTrigger(
  session: StreamingSession,
  utterance: string,
): Promise<void> {
  const wordCount = utterance.trim().split(/\s+/).length;
  if (wordCount < MIN_WORDS) return;
  if (session.isIncognito) return;
  if (!session.userId) return;

  if (!session.surfacedMemoryIds) session.surfacedMemoryIds = new Set();
  if (session.surfacedMemoryIds.size >= MAX_PER_SESSION) return;

  try {
    const hits = await semanticSearch(
      String(session.userId),
      utterance,
      MAX_PER_CHECK + 3, // fetch extras to account for dedup filtering
      ['student_insight', 'personal_fact', 'hive_snapshot', 'growth_memory'],
    );

    const fresh = hits
      .filter(h =>
        h.similarity >= SIMILARITY_THRESHOLD &&
        !session.surfacedMemoryIds!.has(h.memoryId),
      )
      .slice(0, MAX_PER_CHECK);

    if (fresh.length === 0) return;

    const surfaces: string[] = [];
    for (const hit of fresh) {
      const content = await hydrateMemory(hit.memoryType, hit.memoryId);
      if (!content) continue;
      session.surfacedMemoryIds!.add(hit.memoryId);
      surfaces.push(`— ${content}  [${(hit.similarity * 100).toFixed(0)}% relevant]`);
    }

    if (surfaces.length === 0) return;

    if (!session.pendingMemorySurfaces) session.pendingMemorySurfaces = [];
    session.pendingMemorySurfaces.push(...surfaces);
    console.log(`[MemorySurface] Staged ${surfaces.length} memory surface(s) for next turn`);
  } catch (err: any) {
    console.warn('[MemorySurface] Check failed (non-fatal):', err.message);
  }
}
