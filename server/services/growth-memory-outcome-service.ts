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

/**
 * Match a what_worked note to a growth memory using Gemini semantic analysis.
 * Returns the best match or null if no confident match found.
 */
async function matchNoteToMemory(noteContent: string): Promise<OutcomeMatch | null> {
  const hasResonance = noteContent.toLowerCase().includes(RESONANCE_TAG);

  // Fetch top active, non-superseded growth memories by composite score
  const memories = await getSharedDb()
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
- confidence >= 0.7 means you're confident this is the right memory`;

  try {
    const response = await callGemini(GEMINI_MODELS.FLASH, [
      { role: 'user', content: prompt }
    ]);

    const clean = response.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(clean) as { memoryId: string | null; confidence: number; reasoning: string };

    if (!parsed.memoryId || parsed.confidence <= 0) {
      console.log(`[GrowthOutcome] No match found (confidence: ${parsed.confidence}) — ${parsed.reasoning}`);
      return null;
    }

    console.log(`[GrowthOutcome] Matched to memory ${parsed.memoryId} (confidence: ${parsed.confidence}${hasResonance ? ', #resonance' : ''}) — ${parsed.reasoning}`);

    return {
      memoryId: parsed.memoryId,
      confidence: parsed.confidence,
      hasResonance,
    };
  } catch (err: any) {
    console.warn('[GrowthOutcome] Gemini matching failed:', err.message);
    return null;
  }
}

/**
 * Update a growth memory's timesApplied and successRate after a confirmed win.
 * - Always increments timesApplied + sets lastAppliedAt
 * - Only updates successRate if isHighConfidence (confidence >= 0.7 or #resonance)
 */
async function creditMemory(memoryId: string, isHighConfidence: boolean): Promise<void> {
  const [current] = await getSharedDb()
    .select({
      timesApplied: danielaGrowthMemories.timesApplied,
      successRate: danielaGrowthMemories.successRate,
    })
    .from(danielaGrowthMemories)
    .where(eq(danielaGrowthMemories.id, memoryId))
    .limit(1);

  if (!current) {
    console.warn(`[GrowthOutcome] Memory ${memoryId} not found for crediting`);
    return;
  }

  const currentTimesApplied = current.timesApplied ?? 0;
  const newTimesApplied = currentTimesApplied + 1;

  const updates: Record<string, any> = {
    timesApplied: newTimesApplied,
    lastAppliedAt: new Date(),
    updatedAt: new Date(),
  };

  if (isHighConfidence) {
    // Running weighted average: this is always a positive outcome (1.0)
    // newRate = (oldRate * oldCount + 1.0) / newCount
    const currentRate = current.successRate ?? 0;
    const newSuccessRate = currentTimesApplied === 0
      ? 1.0
      : (currentRate * currentTimesApplied + 1.0) / newTimesApplied;

    updates.successRate = Math.min(newSuccessRate, 1.0);
    console.log(`[GrowthOutcome] ✓ Credited memory ${memoryId}: timesApplied=${newTimesApplied}, successRate=${(updates.successRate * 100).toFixed(1)}%`);
  } else {
    console.log(`[GrowthOutcome] ✓ Credited memory ${memoryId}: timesApplied=${newTimesApplied} (low-confidence, successRate unchanged)`);
  }

  await getSharedDb()
    .update(danielaGrowthMemories)
    .set(updates)
    .where(eq(danielaGrowthMemories.id, memoryId));
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
