/**
 * Memory Conflict Resolver
 *
 * Inspired by Mem0's two-phase memory pipeline: when a new fact arrives,
 * instead of just checking for duplicates (which trigram similarity already
 * handles), this layer asks an LLM whether the new fact SUPERSEDES,
 * MERGES WITH, or genuinely ADDS TO what the tutor already knows.
 *
 * Example: Student says "I moved to Austin."
 * - Trigram similarity: "Austin" ≠ "Dallas" → not a duplicate → would create second fact
 * - Conflict resolver: recognizes these are contradictory location facts → deactivates "Dallas"
 *
 * Only fires for STATEFUL fact types (one truth at a time) and
 * TIME-SENSITIVE types (facts that can be superseded by events).
 * Additive types (hobbies, family members, interests) are left alone.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getSharedDb } from '../db';
import { learnerPersonalFacts } from '@shared/schema';
import { eq } from 'drizzle-orm';

// One truth at a time — new facts of these types may supersede old ones
const STATEFUL_FACT_TYPES = new Set([
  'location',
  'work',
  'school',
  'job_title',
  'relationship_status',
  'living_situation',
]);

// Future-facing facts that may become stale or be superseded by outcomes
const TIME_SENSITIVE_FACT_TYPES = new Set([
  'goal',
  'travel',
  'life_event',
]);

// Purely additive — multiple valid facts can coexist
const ADDITIVE_FACT_TYPES = new Set([
  'hobby',
  'interest',
  'preference',
  'family',
  'food',
  'language',
  'music',
  'personality',
]);

export type ConflictResolution = 'add' | 'update' | 'merge' | 'skip';

export interface ConflictDecision {
  resolution: ConflictResolution;
  conflictingFactId?: string;
  mergedFact?: string;
  reason: string;
}

function getClient(): Anthropic {
  return new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL || undefined,
  });
}

export function needsConflictResolution(factType: string): boolean {
  if (ADDITIVE_FACT_TYPES.has(factType)) return false;
  return STATEFUL_FACT_TYPES.has(factType) || TIME_SENSITIVE_FACT_TYPES.has(factType);
}

interface ExistingFact {
  id: string;
  fact: string;
  mentionCount: number;
  lastMentionedAt: Date | null;
}

/**
 * Ask Claude Sonnet to classify the relationship between a new fact and existing ones.
 * Uses Sonnet (not Opus) — this is a fast, structured classification, not deep reasoning.
 */
export async function resolveMemoryConflict(
  newFact: string,
  factType: string,
  existingFacts: ExistingFact[],
): Promise<ConflictDecision> {
  if (existingFacts.length === 0) {
    return { resolution: 'add', reason: 'No existing facts of this type' };
  }

  const existingList = existingFacts
    .map((f, i) => {
      const lastSeen = f.lastMentionedAt
        ? f.lastMentionedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'unknown date';
      return `[${i + 1}] ID:${f.id} — "${f.fact}" (mentioned ${f.mentionCount}x, last on ${lastSeen})`;
    })
    .join('\n');

  const prompt = `You are resolving memory conflicts for an AI language tutor. The tutor learned a new fact about a student and you must decide how to reconcile it with what it already knows.

Fact type: ${factType}
New fact: "${newFact}"

Existing stored facts of this type:
${existingList}

Choose one action:
- "add"    — New fact is genuinely new. Store it alongside existing facts. (Use when both facts can be simultaneously true.)
- "update" — New fact SUPERSEDES or CONTRADICTS an existing one. Deactivate the old fact, store the new one. (e.g., "moved to Austin" supersedes "lives in Dallas")
- "merge"  — New fact overlaps with an existing one and together they form a richer single fact. Replace the old with the merged version.
- "skip"   — New fact is essentially identical to an existing one. Do not create a duplicate.

Respond ONLY with this JSON:
{
  "resolution": "add" | "update" | "merge" | "skip",
  "conflicting_fact_index": null or integer (1-based index from the list above),
  "merged_text": null or string (only if resolution is "merge" — the combined text to store),
  "reason": "one concise sentence"
}`;

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      console.warn('[MemoryConflict] Could not parse LLM response, defaulting to add');
      return { resolution: 'add', reason: 'Parse error — defaulting to add' };
    }

    const parsed = JSON.parse(match[0]);
    const resolution: ConflictResolution = (['add', 'update', 'merge', 'skip'].includes(parsed.resolution))
      ? parsed.resolution
      : 'add';

    const conflictIndex: number | null = parsed.conflicting_fact_index;
    const conflictingFact = conflictIndex && conflictIndex >= 1 && conflictIndex <= existingFacts.length
      ? existingFacts[conflictIndex - 1]
      : undefined;

    return {
      resolution,
      conflictingFactId: conflictingFact?.id,
      mergedFact: parsed.merged_text ?? undefined,
      reason: parsed.reason ?? '',
    };
  } catch (err: any) {
    console.warn('[MemoryConflict] Resolution call failed, defaulting to add:', err.message);
    return { resolution: 'add', reason: 'Conflict resolution failed — defaulting to add' };
  }
}

/**
 * Apply a conflict resolution decision to the database.
 * Returns whether the caller should proceed with saving the new fact,
 * and optionally a modified fact text (for merge).
 */
export async function applyConflictResolution(
  decision: ConflictDecision,
): Promise<{ shouldSave: boolean; resolvedFact?: string }> {
  switch (decision.resolution) {
    case 'skip':
      console.log(`[MemoryConflict] Skipping duplicate — ${decision.reason}`);
      return { shouldSave: false };

    case 'update':
      if (decision.conflictingFactId) {
        await getSharedDb()
          .update(learnerPersonalFacts)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(learnerPersonalFacts.id, decision.conflictingFactId));
        console.log(`[MemoryConflict] Superseded fact ${decision.conflictingFactId} — ${decision.reason}`);
      }
      return { shouldSave: true };

    case 'merge':
      if (decision.conflictingFactId) {
        await getSharedDb()
          .update(learnerPersonalFacts)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(learnerPersonalFacts.id, decision.conflictingFactId));
        console.log(`[MemoryConflict] Merged with fact ${decision.conflictingFactId} — ${decision.reason}`);
      }
      return { shouldSave: true, resolvedFact: decision.mergedFact };

    case 'add':
    default:
      console.log(`[MemoryConflict] Adding new fact — ${decision.reason}`);
      return { shouldSave: true };
  }
}
