/**
 * Pathfinder Service — Gap 9: Curriculum-forward advisory goal
 *
 * Compares what a student has demonstrated against the Can-Do statement catalog
 * for their language + ACTFL level, and returns a soft advisory suggestion for
 * what Daniela might consider focusing on next.
 *
 * IMPORTANT: This is advisory only. Daniela decides whether and how to pursue it.
 * This service does NOT override Madrigal lesson sequencing. It surfaces information;
 * the pedagogical judgment is entirely Daniela's.
 *
 * Design principle (matching pedagogical-brief-worker.ts):
 *   The pathfinder gives Daniela a compass bearing, not a command. She arrives
 *   knowing what's within reach — but she teaches what this student needs today,
 *   not what the algorithm says is next.
 */

import { getSharedDb } from "../db";
import { eq, and, notInArray, sql } from "drizzle-orm";

const ACTFL_ORDER = [
  'novice_low', 'novice_mid', 'novice_high',
  'intermediate_low', 'intermediate_mid', 'intermediate_high',
  'advanced_low', 'advanced_mid', 'advanced_high',
  'superior', 'distinguished',
];

function nextActflLevel(current: string): string | null {
  const idx = ACTFL_ORDER.indexOf(current);
  if (idx === -1 || idx >= ACTFL_ORDER.length - 1) return null;
  return ACTFL_ORDER[idx + 1];
}

/**
 * Returns an advisory goal string for synthesis injection, or null if not enough
 * data to make a useful suggestion.
 *
 * Looks at the student's current ACTFL level and finds Can-Do statements in that
 * band (and the next band) that have no evidence or very low evidence.
 */
export async function getAdvisoryGoal(
  userId: string,
  language: string,
  actflLevel: string | null,
): Promise<string | null> {
  if (!userId || !language || !actflLevel) return null;

  try {
    const db = getSharedDb();
    const { canDoStatements, studentCanDoEvidence } = await import("@shared/schema");

    // Which ACTFL levels to look at: current + one above
    const targetLevels = [actflLevel];
    const next = nextActflLevel(actflLevel);
    if (next) targetLevels.push(next);

    // Find all Can-Do statements at those levels for this language
    const allStatements = await db
      .select({ id: canDoStatements.id, statement: canDoStatements.statement, actflLevel: canDoStatements.actflLevel })
      .from(canDoStatements)
      .where(and(
        eq(canDoStatements.language, language),
        sql`${canDoStatements.actflLevel} = ANY(ARRAY[${sql.raw(targetLevels.map(l => `'${l}'`).join(','))}])`,
      ))
      .limit(50);

    if (!allStatements.length) return null;

    // Find statement IDs where the student has strong evidence (confident mastery)
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const evidenceRows = await db
      .select({
        canDoStatementId: studentCanDoEvidence.canDoStatementId,
        confidenceScore: studentCanDoEvidence.confidenceScore,
      })
      .from(studentCanDoEvidence)
      .where(and(
        eq(studentCanDoEvidence.userId, userId),
        eq(studentCanDoEvidence.language, "universal"),
        sql`${studentCanDoEvidence.observedAt} > ${cutoff.toISOString()}`,
      ));

    // Compute average confidence per statement
    const confidenceMap = new Map<string, number[]>();
    for (const row of evidenceRows) {
      if (!confidenceMap.has(row.canDoStatementId)) {
        confidenceMap.set(row.canDoStatementId, []);
      }
      confidenceMap.get(row.canDoStatementId)!.push(row.confidenceScore);
    }

    const avgConfidence = (id: string): number => {
      const scores = confidenceMap.get(id);
      if (!scores?.length) return 0;
      return scores.reduce((a, b) => a + b, 0) / scores.length;
    };

    // Find statements at the student's current level that have low/no evidence
    const currentLevelStatements = allStatements.filter(s => s.actflLevel === actflLevel);
    const nextLevelStatements = next ? allStatements.filter(s => s.actflLevel === next) : [];

    // Sort: prefer statements at current level with some evidence (20-50 confidence)
    // over completely untouched ones — those are ripe for consolidation
    const ripeForConsolidation = currentLevelStatements
      .filter(s => { const avg = avgConfidence(s.id); return avg > 15 && avg < 65; })
      .sort((a, b) => avgConfidence(b.id) - avgConfidence(a.id));

    const untouched = currentLevelStatements
      .filter(s => avgConfidence(s.id) === 0);

    const nearHorizon = nextLevelStatements
      .filter(s => avgConfidence(s.id) < 30)
      .slice(0, 1);

    // Pick the best suggestion
    const candidate = ripeForConsolidation[0] ?? untouched[0] ?? nearHorizon[0];
    if (!candidate) return null;

    const isNearHorizon = candidate.actflLevel === next;
    if (isNearHorizon) {
      return `One possibility worth considering for a stretch: "${candidate.statement}" — this is at the next level (${candidate.actflLevel}), and the student may be ready to reach for it. Your call.`;
    }
    const avg = Math.round(avgConfidence(candidate.id));
    if (avg > 0) {
      return `Something worth consolidating: "${candidate.statement}" — some evidence exists (${avg}% confidence), but it hasn't been nailed down yet. Could be worth a natural visit if it fits.`;
    }
    return `A gap that might be worth filling: "${candidate.statement}" — no evidence yet at ${candidate.actflLevel} level. Worth keeping in mind if it fits today's session.`;

  } catch (err: any) {
    console.warn("[Pathfinder] Advisory goal lookup failed (non-fatal):", err?.message ?? err);
    return null;
  }
}
