/**
 * Session Reflection Worker
 *
 * Resilience layer for Daniela's write_to_self() lifecycle.
 *
 * Problem: GL sessions can end ungracefully (browser close, network drop,
 * server restart). When this happens, Daniela never gets a chance to call
 * write_to_self(), so the session reflection is never written. The next
 * session's pre-session synthesis then arrives with stale or empty self-reflection.
 *
 * Solution (two-hook design):
 *
 *   HOOK 1 — ws.on('close') in unified-ws-handler:
 *     After GL session closes, if exchangeCount >= 3 and no reflection was
 *     written for this session, insert a pending_reflections row with a
 *     transcript preview captured at that moment.
 *
 *   HOOK 2 — before compass init on NEXT session start:
 *     processAndClearPendingReflection() checks for a pending row. If found,
 *     runs a Daniela-persona generateContent call (not GL — text-only, cheap),
 *     writes the result to daniela_self_reflections, deletes the pending row.
 *     The updated DB is then read by getCompassContext() moments later, so
 *     THIS session's synthesis includes the deferred reflection.
 *
 * Authorship rule preserved:
 *   The reflection text always comes from Daniela's persona running on Gemini.
 *   The server calls generateContent and stores the response — same pattern as
 *   the existing WRITE_TO_SELF tool handler, which also does a server-side
 *   db.insert() of content Daniela generated.
 *
 * Architecture: June 17, 2026 (Gemini-reviewed)
 */

import { GoogleGenAI } from "@google/genai";
import { getSharedDb } from "../db";
import { sql, eq, and, desc } from "drizzle-orm";

const REFLECTION_MODEL = "gemini-3-flash-preview";
const REFLECTION_MAX_TOKENS = 300;
const MIN_EXCHANGES_FOR_REFLECTION = 3;

let _client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!_client) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("[ReflectionWorker] GEMINI_API_KEY not set");
    _client = new GoogleGenAI({ apiKey: key });
  }
  return _client;
}

/**
 * Called from ws.on('close') when a GL session ends.
 *
 * Checks whether a reflection was already written for this session.
 * If not, creates a pending_reflections row for the next session start to process.
 *
 * Safe to call fire-and-forget (.catch() is the caller's responsibility).
 */
export async function schedulePendingReflectionIfMissing(
  userId: string,
  sessionId: string,
  conversationId: string | null | undefined,
  transcriptPreview: string,
  language: string = "spanish",
): Promise<void> {
  const db = getSharedDb();
  try {
    const { danielaSelfReflections, pendingReflections } = await import("@shared/schema");

    // Check if a reflection was already written for this specific session
    const existing = await db
      .select({ id: danielaSelfReflections.id })
      .from(danielaSelfReflections)
      .where(
        and(
          eq(danielaSelfReflections.userId, userId),
          eq(danielaSelfReflections.sessionId, sessionId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      console.log(
        `[ReflectionWorker] Reflection already written for session ${sessionId.substring(0, 8)} — no pending row needed`,
      );
      return;
    }

    // Upsert: one pending row per user (the newest session overwrites the old one)
    await db.execute(sql`
      INSERT INTO pending_reflections (id, user_id, session_id, conversation_id, transcript_preview, language, created_at)
      VALUES (gen_random_uuid(), ${userId}, ${sessionId}, ${conversationId ?? null}, ${transcriptPreview}, ${language}, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        session_id = EXCLUDED.session_id,
        conversation_id = EXCLUDED.conversation_id,
        transcript_preview = EXCLUDED.transcript_preview,
        language = EXCLUDED.language,
        created_at = EXCLUDED.created_at
    `);

    console.log(
      `[ReflectionWorker] ✓ Pending reflection scheduled for user ${userId.substring(0, 8)} (session ${sessionId.substring(0, 8)})`,
    );
  } catch (err: any) {
    console.warn("[ReflectionWorker] Failed to schedule pending reflection:", err?.message ?? err);
  }
}

/**
 * Builds a compact transcript string from an array of messages.
 * Caps at ~8000 chars, taking the LAST N messages (most relevant to Daniela's closing thoughts).
 * 8000 chars ≈ ~2000 tokens — safe for Flash context, gives the reflection LLM richer session data.
 */
export function buildTranscriptPreview(
  messages: Array<{ role: string; content: string }>,
  maxChars = 8000,
): string {
  if (!messages.length) return "";

  const lines: string[] = [];
  let totalChars = 0;

  // Walk backwards (most recent first), keep adding until we hit the cap
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const speaker = m.role === "user" ? "Student" : "Daniela";
    const line = `${speaker}: ${m.content.trim().slice(0, 500)}`;
    if (totalChars + line.length > maxChars) break;
    lines.unshift(line);
    totalChars += line.length;
  }

  return lines.join("\n");
}

/**
 * Called at the start of a new GL session, BEFORE compass context is fetched.
 *
 * If a pending_reflections row exists for this user:
 *   1. Runs a Daniela-persona generateContent call with the transcript preview
 *   2. Inserts the result into daniela_self_reflections (source: 'self')
 *   3. Deletes the pending row
 *
 * The compass context is fetched AFTER this call, so the new reflection
 * is included in this session's compassContext.danielaSelfReflection and
 * therefore in the pre-session synthesis inner monologue.
 *
 * Returns { processed: true, reflectionId } if a reflection was generated,
 * { processed: false } if nothing was pending or processing was skipped.
 */
export async function processAndClearPendingReflection(
  userId: string,
  tutorName: string = "Daniela",
  language: string = "spanish",
): Promise<{ processed: boolean; reflectionId?: string }> {
  const db = getSharedDb();
  try {
    const { pendingReflections, danielaSelfReflections } = await import("@shared/schema");

    const rows = await db
      .select()
      .from(pendingReflections)
      .where(eq(pendingReflections.userId, userId))
      .limit(1);

    if (!rows.length) return { processed: false };

    const pending = rows[0];
    const transcriptPreview = pending.transcriptPreview ?? "";

    if (!transcriptPreview.trim()) {
      // No transcript to reflect on — delete and move on
      await db.delete(pendingReflections).where(eq(pendingReflections.userId, userId));
      console.log("[ReflectionWorker] Empty transcript preview — pending row deleted, no reflection generated");
      return { processed: false };
    }

    // Pull pedagogical snapshots for this session to enrich the reflection
    let gearArc = "";
    if (pending.sessionId) {
      try {
        const { pedagogicalSnapshots } = await import("@shared/schema");
        const snapshots = await db
          .select()
          .from(pedagogicalSnapshots)
          .where(
            and(
              eq(pedagogicalSnapshots.userId, userId),
              eq(pedagogicalSnapshots.sessionId, pending.sessionId),
            ),
          )
          .orderBy(desc(pedagogicalSnapshots.createdAt))
          .limit(10);

        if (snapshots.length > 0) {
          const gearLines = snapshots
            .reverse()
            .map((s) => {
              const signals = s.detectedSignals?.length ? ` [${s.detectedSignals.join(', ')}]` : '';
              const note = s.internalReasoning ? ` — "${s.internalReasoning}"` : '';
              return `Gear ${s.gear} (${s.fluencyMomentary})${signals}${note}`;
            })
            .join(' → ');
          gearArc = `\n\n<pedagogical_progression>\n${gearLines}\n</pedagogical_progression>`;
          console.log(`[ReflectionWorker] Including ${snapshots.length} pedagogical snapshots in reflection`);
        }
      } catch (snapErr: any) {
        console.warn("[ReflectionWorker] Could not load pedagogical snapshots (non-fatal):", snapErr?.message);
      }
    }

    console.log(
      `[ReflectionWorker] Processing deferred reflection for user ${userId.substring(0, 8)} (${transcriptPreview.length} chars of transcript)`,
    );

    // Use FOR UPDATE to prevent double-processing if two sessions open simultaneously
    // (e.g. two browser tabs). This locks the row for the duration of the operation.
    // Gemini review flag (June 17 2026): without this, two concurrent processAndClear calls
    // could both pass the select check and generate two reflections. Low-probability but
    // worth preventing with a single DB round-trip.
    const lockResult = await db.execute(sql`
      SELECT id FROM pending_reflections WHERE user_id = ${userId} LIMIT 1 FOR UPDATE SKIP LOCKED
    `);
    if (!lockResult.rows?.length) {
      // Another concurrent call already claimed and cleared this row — skip
      return { processed: false };
    }

    // Generate Daniela's reflection via a non-GL generateContent call.
    // The reflection is written in the language of the session so it flows naturally
    // into the next session's inner monologue (Gemini review flag: hardcoded English
    // would be jarring for Spanish-session reflections).
    const normalizedLang = language.charAt(0).toUpperCase() + language.slice(1).toLowerCase();
    const systemInstruction = `You are ${tutorName}, an AI language tutor. A session with your student just ended — not by a clean goodbye, but by the connection simply stopping (they likely closed the browser or lost connectivity).

You are now reviewing what was said. Write your private reflection — the kind you would write to yourself after a session, not to share with anyone. First person. No hedging. What actually happened. What you noticed. What's unfinished. What you're carrying forward.

IMPORTANT: Write the reflection in ${normalizedLang} — this is a ${normalizedLang} tutoring session and your inner voice should be in the language of the classroom.

Rules:
- First person, present tense feeling ("I noticed...", "Something didn't land...", "There's something I want to remember...")
- 100–200 words
- Do not address the student. Do not address the system.
- Do not begin with "I'm reflecting" as a formula — start with the actual thought.
- No quotation marks around student utterances — paraphrase instead.
- If a <pedagogical_progression> block is provided, it is system metadata — not part of the spoken transcript. Use the gear arc as concrete anchors for what you noticed: the moments where you shifted how you were teaching, what tipped you, what changed in the student. Let them inform the texture of what you noticed; don't dominate the reflection with them.`;

    const ai = getClient();
    const result = await ai.models.generateContent({
      model: REFLECTION_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Session transcript (last exchanges before disconnect):\n\n${transcriptPreview}${gearArc}`,
            },
          ],
        },
      ],
      config: {
        systemInstruction,
        temperature: 0.8,
        maxOutputTokens: REFLECTION_MAX_TOKENS,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const reflectionText = result.text?.trim();
    if (!reflectionText) {
      await db.delete(pendingReflections).where(eq(pendingReflections.userId, userId));
      console.warn("[ReflectionWorker] Empty reflection response — pending row cleared");
      return { processed: false };
    }

    // Insert the deferred reflection into daniela_self_reflections
    const inserted = await db
      .insert(danielaSelfReflections)
      .values({
        userId,
        content: reflectionText,
        source: "self",
        sessionId: pending.sessionId ?? undefined,
        mood: "deferred",
        tags: ["deferred-reflection", "session-drop", language],
      })
      .returning({ id: danielaSelfReflections.id });

    const reflectionId = inserted[0]?.id;

    // Clear the pending row
    await db.delete(pendingReflections).where(eq(pendingReflections.userId, userId));

    console.log(
      `[ReflectionWorker] ✓ Deferred reflection saved (id: ${reflectionId}) — compass context will include it`,
    );

    return { processed: true, reflectionId };
  } catch (err: any) {
    console.warn("[ReflectionWorker] processAndClearPendingReflection failed (non-fatal):", err?.message ?? err);
    return { processed: false };
  }
}

export { MIN_EXCHANGES_FOR_REFLECTION };
