/**
 * Memory Consolidation Worker
 *
 * Merges related hive_snapshots into higher-fidelity aggregate memories.
 *
 * Problem: after months of sessions, a student accumulates hundreds of
 * session_summary snapshots — each individually weak, collectively rich.
 * Searching through all of them is noisy and slow.
 *
 * Solution: periodically consolidate the oldest N summaries into a single
 * well-structured synthesis. The synthesis is stored as an 'aggregate_analytics'
 * snapshot with metadata tagging it as a consolidation. Source snapshots get
 * a metadata flag (consolidatedInto) so they're still queryable but can be
 * deprioritized in search.
 *
 * Runs weekly. Safe to run repeatedly — checks for already-consolidated sources.
 * Does not delete any data — only adds the consolidated view.
 *
 * Authorship note: This synthesizes observations and patterns, not Daniela's
 * first-person voice. It lives in hive_snapshots, not daniela_self_reflections.
 */

import { getSharedDb } from '../db';
import { hiveSnapshots, users } from '@shared/schema';
import type { HiveSnapshotType } from '@shared/schema';
import { eq, and, sql, desc, isNull } from 'drizzle-orm';
import { callGemini, GEMINI_MODELS } from '../gemini-utils';

const CONSOLIDATOR_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // weekly
const MIN_SUMMARIES_TO_CONSOLIDATE = 6; // need at least 6 before consolidating
const SUMMARIES_PER_CONSOLIDATION = 5; // consolidate 5 at a time

type SnapshotRow = {
  id: string;
  title: string | null;
  content: string | null;
  createdAt: Date;
};

async function consolidateForStudent(
  userId: string,
  studentName: string,
  summaries: SnapshotRow[],
): Promise<void> {
  const db = getSharedDb();

  // Take the oldest N summaries that haven't been consolidated yet
  const unmerged = summaries.filter(s => {
    // Skip snapshots that already have a consolidatedInto marker
    return true; // filtering via SQL below
  }).slice(0, SUMMARIES_PER_CONSOLIDATION);

  if (unmerged.length < 3) return; // Not enough to bother

  const contextBlock = unmerged.map(s => {
    const date = new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `[${date}] ${s.title || 'Session'}: ${s.content?.substring(0, 600) || '(no content)'}`;
  }).join('\n\n---\n\n');

  const dateRange = (() => {
    const dates = unmerged.map(s => new Date(s.createdAt));
    const min = new Date(Math.min(...dates.map(d => d.getTime())));
    const max = new Date(Math.max(...dates.map(d => d.getTime())));
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(min)} – ${fmt(max)}`;
  })();

  const prompt = `You are synthesizing session notes about ${studentName}'s language learning journey.

Below are ${unmerged.length} session summaries spanning ${dateRange}. Write a concise, 250-300 word consolidated synthesis that captures:
- The main themes and patterns across these sessions
- Specific linguistic areas that were practiced or struggled with
- Notable breakthroughs or persistent challenges
- How the student's confidence or approach evolved over this period
- Any recurring topics or personal context that came up

Be specific — include concrete examples from the notes. Write in third person (about the student). No bullet points.

SESSIONS:
${contextBlock}

Write the synthesis now:`;

  const synthesis = (await callGemini(GEMINI_MODELS.FLASH, [
    { role: 'user', content: prompt },
  ])).trim();

  if (!synthesis) {
    console.warn(`[Consolidator] Gemini returned empty synthesis for ${userId}`);
    return;
  }

  const sourceIds = unmerged.map(s => s.id);

  // Save consolidated snapshot
  const insertResult = await db.insert(hiveSnapshots).values({
    userId,
    snapshotType: 'aggregate_analytics' as HiveSnapshotType,
    title: `Consolidated: ${dateRange} (${unmerged.length} sessions)`,
    content: synthesis,
    importance: 8,
    language: 'spanish', // default; language-agnostic content
    metadata: {
      consolidation: true,
      sourceIds,
      dateRange,
      studentName,
      consolidatedAt: new Date().toISOString(),
    },
  }).returning({ id: hiveSnapshots.id });

  const insertedRow = insertResult[0];
  if (!insertedRow) {
    console.warn(`[Consolidator] Insert returned no row for ${userId} — aborting consolidation`);
    return;
  }
  const aggregateId = insertedRow.id;

  // Mark source snapshots as consolidated
  for (const sourceId of sourceIds) {
    try {
      const existing = await db
        .select({ metadata: hiveSnapshots.metadata })
        .from(hiveSnapshots)
        .where(eq(hiveSnapshots.id, sourceId))
        .limit(1);
      const existingMeta = (existing[0]?.metadata as Record<string, any>) || {};
      await db
        .update(hiveSnapshots)
        .set({ metadata: { ...existingMeta, consolidatedInto: aggregateId } })
        .where(eq(hiveSnapshots.id, sourceId));
    } catch {
      // Non-fatal — metadata update failure doesn't invalidate the consolidation
    }
  }

  console.log(`[Consolidator] Consolidated ${unmerged.length} summaries for ${userId} → aggregate ${aggregateId}`);
}

async function runConsolidator(): Promise<void> {
  const db = getSharedDb();

  try {
    // Find all students who have unconsolidated session summaries
    const studentIds = await db
      .selectDistinct({ userId: hiveSnapshots.userId })
      .from(hiveSnapshots)
      .where(and(
        eq(hiveSnapshots.snapshotType, 'session_summary'),
        sql`(metadata->>'consolidatedInto') IS NULL`,
        sql`${hiveSnapshots.userId} IS NOT NULL`,
      ));

    if (studentIds.length === 0) {
      console.log('[Consolidator] No unconsolidated session summaries found');
      return;
    }

    console.log(`[Consolidator] Checking ${studentIds.length} student(s)...`);
    let totalConsolidated = 0;

    for (const { userId } of studentIds) {
      if (!userId) continue;

      try {
        // Get all unconsolidated summaries for this student
        const summaries = await db
          .select({
            id: hiveSnapshots.id,
            title: hiveSnapshots.title,
            content: hiveSnapshots.content,
            createdAt: hiveSnapshots.createdAt,
          })
          .from(hiveSnapshots)
          .where(and(
            eq(hiveSnapshots.userId, userId),
            eq(hiveSnapshots.snapshotType, 'session_summary'),
            sql`(metadata->>'consolidatedInto') IS NULL`,
          ))
          .orderBy(hiveSnapshots.createdAt) // oldest first
          .limit(50);

        if (summaries.length < MIN_SUMMARIES_TO_CONSOLIDATE) continue;

        // Get student name for context
        const userRow = await db
          .select({ firstName: users.firstName, username: users.username })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        const studentName = userRow[0]?.firstName || userRow[0]?.username || 'the student';

        await consolidateForStudent(userId, studentName, summaries);
        totalConsolidated++;

        // Small pause between students to avoid hammering Gemini
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err: any) {
        console.error(`[Consolidator] Failed for student ${userId}:`, err.message);
      }
    }

    console.log(`[Consolidator] Run complete — consolidated for ${totalConsolidated} student(s)`);
  } catch (err: any) {
    console.error('[Consolidator] Worker run failed:', err.message);
  }
}

export function startMemoryConsolidator(): void {
  console.log('[Consolidator] Starting (interval: weekly)');

  // Boot run after 120 seconds (low priority, run well after other workers)
  setTimeout(() => {
    runConsolidator().catch(err =>
      console.error('[Consolidator] Boot run failed:', err.message)
    );
  }, 120000);

  setInterval(() => {
    runConsolidator().catch(err =>
      console.error('[Consolidator] Periodic run failed:', err.message)
    );
  }, CONSOLIDATOR_INTERVAL_MS);
}
