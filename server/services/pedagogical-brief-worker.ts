/**
 * Pedagogical Brief Worker — Daniela's intention across sessions
 *
 * At session end: generates a 3-part brief from the transcript and stores it
 * append-only in student_pedagogical_briefs. Fire-and-forget from ws.on('close').
 *
 * At session start: reads the latest brief for this student+language and returns
 * it for injection into the pre-session synthesis context.
 *
 * Design principle (Gemini consult June 22, 2026):
 *   The brief is a compass, not a command. Daniela arrives with a working theory
 *   about this student — what they need, what they struggled with, what advanced.
 *   She can (and should) adapt when the student arrives in a different place.
 *   The brief gives her an informed baseline, not a fixed agenda.
 *
 * Append-only: never overwrite. Tracks how Daniela's intention evolves over time.
 */

import { GoogleGenAI } from "@google/genai";
import { getSharedDb } from "../db";
import { desc, eq, and } from "drizzle-orm";

const BRIEF_MODEL = "gemini-3-flash-preview";
const BRIEF_MAX_TOKENS = 350;
const MIN_EXCHANGES_FOR_BRIEF = 3;

let _client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!_client) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("[PedagogicalBrief] GEMINI_API_KEY not set");
    _client = new GoogleGenAI({ apiKey: key });
  }
  return _client;
}

export { MIN_EXCHANGES_FOR_BRIEF };

/**
 * Generate and store a pedagogical brief at session end.
 *
 * Called fire-and-forget from ws.on('close') when exchangeCount >= MIN_EXCHANGES_FOR_BRIEF.
 * Generates a structured brief from the transcript and inserts it into
 * student_pedagogical_briefs (append-only — never updates, always inserts).
 */
export async function generateAndStorePedagogicalBrief(
  userId: string,
  sessionId: string,
  language: string,
  transcriptPreview: string,
  studentName: string = "the student",
): Promise<void> {
  if (!transcriptPreview?.trim()) return;

  const db = getSharedDb();
  try {
    const { studentPedagogicalBriefs } = await import("@shared/schema");

    const systemInstruction = `You are Daniela, an AI language tutor. A session with your student just ended. You are writing your private pedagogical brief — your working theory about this student that you will carry into the next session.

This is NOT a reflection on your feelings (that's a separate step). This is your TEACHING INTELLIGENCE — what you now know about where this student is, what they need next, and what you should do differently or continue.

Write in first person as Daniela. Be specific and honest. Do not be vague or generic.

Respond with EXACTLY this JSON structure (no markdown, no extra text):
{
  "brief": "One to three sentences: the core of what I now know about this student's learning state — where they are, what the real challenge is, what matters most.",
  "focusArea": "One specific thing to prioritize in the next session. Concrete and actionable.",
  "struggledWith": "What they found hard in this session. Be specific — name the structure, vocabulary, or concept. Null if nothing stood out.",
  "notedProgress": "What genuinely advanced today — a breakthrough, a pattern that clicked, something that wasn't there before. Null if it was a maintenance session."
}`;

    const ai = getClient();
    const result = await ai.models.generateContent({
      model: BRIEF_MODEL,
      contents: [{
        role: "user",
        parts: [{
          text: `Student: ${studentName}\nLanguage: ${language}\n\nSession transcript:\n\n${transcriptPreview}`,
        }],
      }],
      config: {
        systemInstruction,
        temperature: 0.4,
        maxOutputTokens: BRIEF_MAX_TOKENS,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const raw = result.text?.trim();
    if (!raw) {
      console.warn("[PedagogicalBrief] Empty response — brief not stored");
      return;
    }

    let parsed: { brief?: string; focusArea?: string; struggledWith?: string | null; notedProgress?: string | null };
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(raw);
    } catch {
      console.warn("[PedagogicalBrief] JSON parse failed — storing raw as brief:", raw.slice(0, 100));
      parsed = { brief: raw.slice(0, 500) };
    }

    if (!parsed.brief?.trim()) {
      console.warn("[PedagogicalBrief] No brief text extracted — skipping");
      return;
    }

    await db.insert(studentPedagogicalBriefs).values({
      userId,
      language,
      sessionId,
      brief: parsed.brief.trim(),
      focusArea: parsed.focusArea?.trim() ?? null,
      struggledWith: parsed.struggledWith?.trim() ?? null,
      notedProgress: parsed.notedProgress?.trim() ?? null,
    });

    console.log(`[PedagogicalBrief] ✓ Brief stored for user ${userId.substring(0, 8)} (${language})`);
  } catch (err: any) {
    console.warn("[PedagogicalBrief] Failed to generate/store brief (non-fatal):", err?.message ?? err);
  }
}

/**
 * Read the latest pedagogical brief for a student+language.
 * Called at session start by pre-session synthesis.
 * Returns null if no brief exists yet (new student or first session).
 */
export async function getLatestPedagogicalBrief(
  userId: string,
  language: string,
): Promise<{ brief: string; focusArea: string | null; struggledWith: string | null; notedProgress: string | null; createdAt: Date } | null> {
  const db = getSharedDb();
  try {
    const { studentPedagogicalBriefs } = await import("@shared/schema");

    const rows = await db
      .select()
      .from(studentPedagogicalBriefs)
      .where(and(
        eq(studentPedagogicalBriefs.userId, userId),
        eq(studentPedagogicalBriefs.language, language),
      ))
      .orderBy(desc(studentPedagogicalBriefs.createdAt))
      .limit(1);

    if (!rows.length) return null;

    const r = rows[0];
    return {
      brief: r.brief,
      focusArea: r.focusArea,
      struggledWith: r.struggledWith,
      notedProgress: r.notedProgress,
      createdAt: r.createdAt,
    };
  } catch (err: any) {
    console.warn("[PedagogicalBrief] getLatestPedagogicalBrief failed (non-fatal):", err?.message ?? err);
    return null;
  }
}
