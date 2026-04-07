/**
 * Growth Memory Outcome Service
 *
 * When Cindy writes a `what_worked` note, this service fires asynchronously
 * to match the note content to the most relevant growth memory via Gemini,
 * then credits that memory's `timesApplied` and optionally `successRate`.
 *
 * Key behaviors:
 * - `#resonance` tag in note body = high-confidence override (no threshold required)
 * - Confidence >= 0.7 (or #resonance) = increment timesApplied + update successRate
 * - Confidence < 0.7 (no #resonance) = increment timesApplied only (don't corrupt quality signal)
 * - All updates are atomic SQL expressions (no read-then-write race under concurrency)
 * - Gemini memoryId is validated against candidate set before any DB write
 * - All errors caught and logged — never surfaces to Cindy
 */

import { getSharedDb } from '../db';
import { danielaGrowthMemories } from '@shared/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { callGemini, GEMINI_MODELS } from '../gemini-utils';

const RESONANCE_TAG = '#resonance';
const HIGH_CONFIDENCE_THRESHOLD = 0.7;
const MAX_MEMORIES_TO_CONSIDER = 50;
const LESSON_PREVIEW_LENGTH = 250;

interface OutcomeMatch {
  memoryId: string;
  confidence: number;
  hasResonance: boolean;
}

interface MemoryCandidate {
  id: string;
  title: string;
  category: string | null;
  lesson: string;
}

/**
 * Match a what_worked note to a growth memory using Gemini semantic analysis.
 * Validates the returned memoryId against the candidate set before returning.
 * Returns the best match or null if no confident match found.
 */
async function matchNoteToMemory(noteContent: string): Promise<OutcomeMatch | null> {
  const hasResonance = noteContent.toLowerCase().includes(RESONANCE_TAG);

  // Fetch top active, non-superseded growth memories by composite score
  const memories: MemoryCandidate[] = await getSharedDb()
    .select({
      id: danielaGrowthMemories.id,
      title: danielaGrowthMemories.title,
      category: danielaGrowthMemories.category,
      lesson: danielaGrowthMemories.lesson,
    })
    .from(danielaGrowthMemories)
    .where(and(
      eq(danielaGrowthMemories.isActive, true),
      isNull(danielaGrowthMemories.supersededBy),
    ))
    .orderBy(sql`(${danielaGrowthMemories.consolidatedFromCount} * 3 + ${danielaGrowthMemories.importance} * 2 + ${danielaGrowthMemories.timesApplied}) DESC`)
    .limit(MAX_MEMORIES_TO_CONSIDER);

  if (memories.length === 0) {
    console.log('[GrowthOutcome] No active memories to match against');
    return null;
  }

  // Build candidate ID set for validation of Gemini output
  const candidateIds = new Set(memories.map(m => m.id));

  const memorySummaries = memories.map(m => ({
    id: m.id,
    title: m.title,
    category: m.category,
    lesson: m.lesson.substring(0, LESSON_PREVIEW_LENGTH),
  }));

  const resonanceNote = hasResonance
    ? '\n\nNote: The teacher flagged this win with #resonance — she feels particularly proud of this result.'
    : '';

  const prompt = `You are analyzing a language teacher's "what worked" note to identify which of her teaching growth memories it best corresponds to.

WHAT WORKED NOTE:
"${noteContent.replace(RESONANCE_TAG, '').trim()}"
${resonanceNote}

GROWTH MEMORIES TO MATCH AGAINST:
${JSON.stringify(memorySummaries, null, 2)}

Find the single growth memory that this "what worked" note MOST SPECIFICALLY describes a successful application of. The note should be describing a moment where she used the technique captured in the memory and it worked well.

Return JSON with exactly this structure:
{
  "memoryId": "id-of-best-matching-memory",
  "confidence": 0.85,
  "reasoning": "Brief explanation of why this is the best match"
}

Rules:
- confidence is 0.0 to 1.0 — how certain you are this note describes applying THAT specific memory
- If the note is too vague to match to any specific memory, return confidence <= 0.4
- If no memory relates at all, return { "memoryId": null, "confidence": 0.0, "reasoning": "No match" }
- Only return ONE match — the single best one
- You MUST use one of the exact IDs provided in the list above
- confidence >= 0.7 means you're confident this is the right memory`;

  try {
    const response = await callGemini(GEMINI_MODELS.FLASH, [
      { role: 'user', content: prompt }
    ]);

    const clean = response.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(clean) as { memoryId: string | null; confidence: number; reasoning: string };

    // Clamp confidence to valid range
    const confidence = Math.max(0, Math.min(1, parsed.confidence ?? 0));

    if (!parsed.memoryId || confidence <= 0) {
      console.log(`[GrowthOutcome] No match found (confidence: ${confidence}) — ${parsed.reasoning}`);
      return null;
    }

    // Validate returned ID against the candidates we actually sent
    if (!candidateIds.has(parsed.memoryId)) {
      console.warn(`[GrowthOutcome] Gemini returned unknown memoryId "${parsed.memoryId}" — discarding to prevent hallucinated credit`);
      return null;
    }

    console.log(`[GrowthOutcome] Matched to memory ${parsed.memoryId} (confidence: ${confidence}${hasResonance ? ', #resonance' : ''}) — ${parsed.reasoning}`);

    return {
      memoryId: parsed.memoryId,
      confidence,
      hasResonance,
    };
  } catch (err: any) {
    console.warn('[GrowthOutcome] Gemini matching failed:', err.message);
    return null;
  }
}

/**
 * Atomically credit a growth memory after a confirmed win.
 *
 * Uses SQL expressions in a single UPDATE so concurrent calls cannot
 * overwrite each other or distort the running average.
 *
 * - Always: times_applied = times_applied + 1, last_applied_at = now()
 * - High confidence only: success_rate = running weighted average (each what_worked = 1.0 win)
 */
async function creditMemory(memoryId: string, isHighConfidence: boolean): Promise<void> {
  const now = new Date();

  if (isHighConfidence) {
    // Atomic weighted-average update — no prior SELECT needed.
    // Formula: newRate = (COALESCE(success_rate,0) * times_applied + 1.0) / (times_applied + 1)
    // LEAST clamps to 1.0 ceiling.
    await getSharedDb()
      .update(danielaGrowthMemories)
      .set({
        timesApplied: sql`${danielaGrowthMemories.timesApplied} + 1`,
        lastAppliedAt: now,
        updatedAt: now,
        successRate: sql`LEAST(
          (COALESCE(${danielaGrowthMemories.successRate}, 0) * ${danielaGrowthMemories.timesApplied} + 1.0)
          / (${danielaGrowthMemories.timesApplied} + 1),
          1.0
        )`,
      })
      .where(eq(danielaGrowthMemories.id, memoryId));

    console.log(`[GrowthOutcome] ✓ Credited memory ${memoryId}: timesApplied++, successRate updated (high-confidence)`);
  } else {
    // Low-confidence: increment timesApplied only, leave successRate untouched
    await getSharedDb()
      .update(danielaGrowthMemories)
      .set({
        timesApplied: sql`${danielaGrowthMemories.timesApplied} + 1`,
        lastAppliedAt: now,
        updatedAt: now,
      })
      .where(eq(danielaGrowthMemories.id, memoryId));

    console.log(`[GrowthOutcome] ✓ Credited memory ${memoryId}: timesApplied++ (low-confidence, successRate unchanged)`);
  }
}

/**
 * Main entry point — call this after a what_worked note is saved.
 * Fully async, non-blocking. All errors are caught internally.
 */
export async function processWhatWorkedNote(noteContent: string): Promise<void> {
  try {
    const match = await matchNoteToMemory(noteContent);
    if (!match) return;

    const isHighConfidence = match.hasResonance || match.confidence >= HIGH_CONFIDENCE_THRESHOLD;
    await creditMemory(match.memoryId, isHighConfidence);
  } catch (err: any) {
    console.warn('[GrowthOutcome] Unexpected error in outcome processing:', err.message);
  }
}

export const growthMemoryOutcomeService = {
  processWhatWorkedNote,
};
