/**
 * Mastery Evidence Worker — ACTFL Can-Do tracking
 *
 * At session end: analyzes the session transcript against the student's current
 * ACTFL level, identifies Can-Do statements that were demonstrated or attempted,
 * and writes evidence rows to student_can_do_evidence (time-series, append-only).
 *
 * At session start: builds a "Mastery Digest" — a compact 3-part summary of
 * what the student has mastered, is working on, and hasn't reached yet.
 * Injected into pre-session synthesis for Daniela's awareness.
 *
 * Design principles (Gemini consult June 22, 2026):
 *   - Post-session worker only. No real-time tool calls — mastery is analytical,
 *     not conversational. Real-time would waste tool slots and derail the persona.
 *   - canDoStatements table already exists (language, actflLevel, mode, statement).
 *   - studentCanDoProgress (booleans) is separate from this evidence log.
 *   - Inject the DIGEST into the synthesis prompt, not raw evidence rows.
 *     "Mastered / Working On / Not Yet" is actionable. Raw rows are noise.
 *   - Confidence scores decay: recent evidence outweighs old evidence.
 *     Simple decay: score × (0.9 ^ weeks_since).
 */

import { GoogleGenAI } from "@google/genai";
import { getSharedDb } from "../db";
import { eq, and, desc, sql } from "drizzle-orm";

const MASTERY_MODEL = "gemini-3-flash-preview";
const MASTERY_MAX_TOKENS = 600;
const MIN_EXCHANGES_FOR_MASTERY = 5;

let _client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!_client) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("[MasteryWorker] GEMINI_API_KEY not set");
    _client = new GoogleGenAI({ apiKey: key });
  }
  return _client;
}

export { MIN_EXCHANGES_FOR_MASTERY };

/**
 * Load Can-Do statements relevant to the student's current ACTFL level.
 * Loads statements for the current level and one level below (consolidation)
 * and one level above (stretch targets).
 */
async function loadRelevantCanDoStatements(
  language: string,
  actflLevel: string | null,
): Promise<Array<{ id: string; actflLevel: string; mode: string | null; statement: string }>> {
  const db = getSharedDb();
  try {
    const { canDoStatements } = await import("@shared/schema");

    // Load universal statements (language-agnostic ACTFL standards)
    const rows = await db
      .select({
        id: canDoStatements.id,
        actflLevel: canDoStatements.actflLevel,
        mode: canDoStatements.mode,
        statement: canDoStatements.statement,
      })
      .from(canDoStatements)
      .where(eq(canDoStatements.language, "universal"))
      .orderBy(canDoStatements.actflLevel, canDoStatements.mode);

    return rows;
  } catch (err: any) {
    console.warn("[MasteryWorker] loadRelevantCanDoStatements failed:", err?.message ?? err);
    return [];
  }
}

/**
 * Analyze a session transcript and write Can-Do evidence rows.
 * Called fire-and-forget from ws.on('close').
 */
export async function analyzeSessionForMasteryEvidence(
  userId: string,
  sessionId: string,
  language: string,
  transcriptPreview: string,
  actflLevel: string | null,
): Promise<void> {
  if (!transcriptPreview?.trim()) return;

  const db = getSharedDb();
  try {
    const { studentCanDoEvidence } = await import("@shared/schema");

    const statements = await loadRelevantCanDoStatements(language, actflLevel);
    if (!statements.length) {
      console.log("[MasteryWorker] No Can-Do statements seeded yet — skipping evidence analysis");
      return;
    }

    const statementsBlock = statements
      .map(s => `ID:${s.id} [${s.actflLevel}/${s.mode ?? "general"}] ${s.statement}`)
      .join("\n");

    const systemInstruction = `You are an ACTFL-trained language assessment specialist analyzing a tutoring session transcript.

Your job: identify which Can-Do statements the student demonstrated evidence for in this session.

For each statement where you saw CLEAR evidence (the student actually performed the behavior, not just heard it), return a JSON object.

Only include statements where the student performed the behavior. Do not include statements the tutor performed. Do not be generous — a student stumbling through a phrase with heavy scaffolding is NOT evidence of mastery. A student producing the structure independently IS.

Respond with ONLY a JSON array (no markdown):
[
  {
    "statementId": "the-id-from-the-list",
    "confidenceScore": 0-100,
    "transcriptExcerpt": "brief quote or paraphrase of the moment",
    "workerNotes": "one sentence explaining why this scored this way"
  }
]

If no statements were demonstrated, return an empty array: []`;

    const ai = getClient();
    const result = await ai.models.generateContent({
      model: MASTERY_MODEL,
      contents: [{
        role: "user",
        parts: [{
          text: `Student ACTFL level: ${actflLevel ?? "unknown"}\nLanguage: ${language}\n\nCan-Do statements to check:\n${statementsBlock}\n\nSession transcript:\n${transcriptPreview}`,
        }],
      }],
      config: {
        systemInstruction,
        temperature: 0.2,
        maxOutputTokens: MASTERY_MAX_TOKENS,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const raw = result.text?.trim();
    if (!raw) return;

    let evidenceItems: Array<{ statementId: string; confidenceScore: number; transcriptExcerpt?: string; workerNotes?: string }>;
    try {
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      evidenceItems = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(raw);
    } catch {
      console.warn("[MasteryWorker] JSON parse failed:", raw.slice(0, 200));
      return;
    }

    if (!Array.isArray(evidenceItems) || !evidenceItems.length) {
      console.log(`[MasteryWorker] No Can-Do evidence found for session ${sessionId.substring(0, 8)}`);
      return;
    }

    // Validate statement IDs exist in our statements list
    const validIds = new Set(statements.map(s => s.id));
    const validItems = evidenceItems.filter(item =>
      item.statementId && validIds.has(item.statementId) &&
      typeof item.confidenceScore === "number" &&
      item.confidenceScore >= 0 && item.confidenceScore <= 100
    );

    if (!validItems.length) return;

    await db.insert(studentCanDoEvidence).values(
      validItems.map(item => ({
        userId,
        canDoStatementId: item.statementId,
        language,
        sessionId,
        confidenceScore: Math.round(item.confidenceScore),
        transcriptExcerpt: item.transcriptExcerpt?.slice(0, 500) ?? null,
        workerNotes: item.workerNotes?.slice(0, 300) ?? null,
      }))
    );

    console.log(`[MasteryWorker] ✓ ${validItems.length} Can-Do evidence rows stored for user ${userId.substring(0, 8)}`);
  } catch (err: any) {
    console.warn("[MasteryWorker] analyzeSessionForMasteryEvidence failed (non-fatal):", err?.message ?? err);
  }
}

/**
 * Build a Mastery Digest for pre-session synthesis injection.
 *
 * Aggregates recent evidence with time decay, categorizes each Can-Do statement
 * as Mastered (≥80% avg confidence, ≥2 observations), Working On (40-79%, ≥1),
 * or Not Yet (<40% or no evidence at level).
 *
 * Returns a compact 3-line string for the synthesis prompt, or null if no data.
 */
export async function getMasteryDigest(
  userId: string,
  language: string,
  actflLevel: string | null,
): Promise<string | null> {
  const db = getSharedDb();
  try {
    const { studentCanDoEvidence, canDoStatements } = await import("@shared/schema");

    // Get evidence for this student+language, last 90 days
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const evidenceRows = await db
      .select({
        statementId: studentCanDoEvidence.canDoStatementId,
        confidenceScore: studentCanDoEvidence.confidenceScore,
        observedAt: studentCanDoEvidence.observedAt,
        statement: canDoStatements.statement,
        actflLevel: canDoStatements.actflLevel,
        mode: canDoStatements.mode,
      })
      .from(studentCanDoEvidence)
      .innerJoin(canDoStatements, eq(studentCanDoEvidence.canDoStatementId, canDoStatements.id))
      .where(and(
        eq(studentCanDoEvidence.userId, userId),
        eq(studentCanDoEvidence.language, "universal"),
        sql`${studentCanDoEvidence.observedAt} > ${cutoff.toISOString()}`,
      ))
      .orderBy(desc(studentCanDoEvidence.observedAt));

    if (!evidenceRows.length) return null;

    // Aggregate with time decay: score × (0.9 ^ weeks_since)
    const now = Date.now();
    const statMap = new Map<string, { statement: string; actflLevel: string; mode: string | null; scores: number[]; count: number }>();

    for (const row of evidenceRows) {
      const weeksSince = (now - new Date(row.observedAt).getTime()) / (7 * 24 * 60 * 60 * 1000);
      const decayedScore = row.confidenceScore * Math.pow(0.9, weeksSince);

      if (!statMap.has(row.statementId)) {
        statMap.set(row.statementId, {
          statement: row.statement,
          actflLevel: row.actflLevel,
          mode: row.mode,
          scores: [],
          count: 0,
        });
      }
      const entry = statMap.get(row.statementId)!;
      entry.scores.push(decayedScore);
      entry.count++;
    }

    const mastered: string[] = [];
    const workingOn: string[] = [];

    for (const [, entry] of statMap) {
      const avg = entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length;
      const label = `${entry.statement} [${entry.actflLevel}]`;
      if (avg >= 80 && entry.count >= 2) {
        mastered.push(label);
      } else if (avg >= 40) {
        workingOn.push(label);
      }
    }

    if (!mastered.length && !workingOn.length) return null;

    const lines: string[] = [];
    if (mastered.length) {
      lines.push(`Mastered (can use freely): ${mastered.slice(0, 4).join("; ")}`);
    }
    if (workingOn.length) {
      lines.push(`Working on (actively developing): ${workingOn.slice(0, 3).join("; ")}`);
    }

    return lines.join("\n");
  } catch (err: any) {
    console.warn("[MasteryWorker] getMasteryDigest failed (non-fatal):", err?.message ?? err);
    return null;
  }
}
