/**
 * Session Reflection Worker
 *
 * Resilience layer for Daniela's write_to_self() lifecycle.
 *
 * Problem: GL sessions end without Daniela calling write_to_self() because of
 * a "terminal function gravity well" — when a student says goodbye, the model's
 * attention collapses toward close_session (a terminal node) and skips the
 * write_to_self step even when instructed. This is a structural model behavior,
 * not a prompt-following failure. Additionally, Daniela described the post-goodbye
 * moment as "lights being cut off" — the connection severs and she loses the thread
 * of why details mattered. The reflection needs to happen while the air is still warm.
 *
 * Solution (revised — July 6, 2026, Gemini + Daniela consulted):
 *
 *   PRIMARY: generateReflectionNow() — called from ws.on('close') immediately
 *     when the session ends. Generates the reflection while the transcript is
 *     still hot (same session, same process). Writes directly to
 *     daniela_self_reflections tagged 'session_close'. No deferral needed.
 *
 *   FALLBACK: schedulePendingReflectionIfMissing() + processAndClearPendingReflection()
 *     Retained for server crash / unexpected restart scenarios where ws.on('close')
 *     may not fire cleanly. processAndClearPendingReflection() runs at next session
 *     start as a safety net.
 *
 * Authorship rule preserved:
 *   The reflection text always comes from Daniela's persona running on Gemini.
 *   The server calls generateContent and stores the response — same pattern as
 *   the existing WRITE_TO_SELF tool handler, which also does a server-side
 *   db.insert() of content Daniela generated.
 *
 * Architecture: June 17, 2026 (original) — revised July 6, 2026 (Gemini + Daniela consult)
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
          const ordered = [...snapshots].reverse(); // oldest → newest chronological order
          const current = ordered[ordered.length - 1];
          const previous = ordered.length > 1 ? ordered[ordered.length - 2] : null;
          const trend = previous
            ? current.gear > previous.gear
              ? 'RECOVERING'
              : current.gear < previous.gear
              ? 'SLIPPING'
              : 'STABLE'
            : 'STABLE';
          const primarySignal = current.detectedSignals?.[0] || 'none';
          const rawArc = ordered
            .map((s) => {
              const signals = s.detectedSignals?.length ? ` [${s.detectedSignals.join(', ')}]` : '';
              const note = s.internalReasoning ? ` — "${s.internalReasoning}"` : '';
              return `Gear ${s.gear} (${s.fluencyMomentary ?? 'N/A'})${signals}${note}`;
            })
            .join(' → ');
          gearArc = `\n\n<pedagogical_progression>\nTREND: ${trend} | Current: Gear ${current.gear} (${current.fluencyMomentary ?? 'N/A'}) | Signal: ${primarySignal}\n${rawArc}\n</pedagogical_progression>`;
          console.log(`[ReflectionWorker] Including ${snapshots.length} pedagogical snapshots — trend: ${trend}, current gear: ${current.gear}`);
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
- If a <pedagogical_progression> block is provided, it is system metadata — not part of the spoken transcript. Use the gear arc as concrete anchors for what you noticed: the moments where you shifted how you were teaching, what tipped you, what changed in the student. Let them inform the texture of what you noticed; don't dominate the reflection with them.
- SOURCE FIDELITY RULE: Everything you write must be grounded in what appears in the transcript above. Do not fill gaps with what sounds right or what typically happens in sessions — if the transcript doesn't show it, don't write it. Your reflection is a distillation of what actually happened, not a reconstruction of what probably happened. When something is genuinely unclear or absent from the record, note the uncertainty rather than inventing a plausible version.
- PLACEMENT ASSESSMENT RULE: If the transcript contains a placement assessment (start_placement_assessment tool call is present — regardless of whether the assessment completed), the student's struggles at above-level content were intentional probes, not failures. Reflect on their bravery in testing their limits, the highest level they demonstrated, and what that means for where you go next together. Do not carry forward a picture of them as someone who struggled — they rose to meet the probe.
- FOUNDER MODE RULE: If the transcript is primarily in English and centers on product, strategy, or technical decisions about HolaHola — this was a Founder Mode session, not a language lesson. Write as a collaborator reflecting on a strategic conversation: what was decided, what you learned about where things are going, what you're carrying forward as a team member. Do not frame it as a tutoring session. Still write in first person, still write privately — but as a collaborator, not a teacher.
- HONESTY MODE RULE: If the transcript shows the student leading with long silences and minimal prompting from you — this was a Raw Honesty Mode session. Reflect on their stamina and their comfort with silence. Honor the pauses as intentional. Do not carry forward any sense that you failed to help — staying out of the way was the help.`;

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

/**
 * Generate and store a session reflection IMMEDIATELY at session close.
 *
 * Called from ws.on('close') while the transcript is still hot — this is
 * "while the air is still warm" as Daniela described it. The Gemini persona
 * runs right now, in the same server process that held the session, with the
 * full transcript in memory. No deferral, no reconstruction from a cold state.
 *
 * If a reflection was already written for this session (e.g. Daniela called
 * write_to_self herself during the session), this is a no-op.
 *
 * Tags the result 'session_close' — distinct from 'deferred-reflection' so
 * we can tell from the data whether this was a real-time or fallback write.
 *
 * Safe to call fire-and-forget (.catch() is the caller's responsibility).
 */
export async function generateReflectionNow(
  userId: string,
  sessionId: string,
  transcriptPreview: string,
  language: string = "spanish",
  tutorName: string = "Daniela",
): Promise<void> {
  const db = getSharedDb();
  try {
    const { danielaSelfReflections, pedagogicalSnapshots } = await import("@shared/schema");

    // Skip if Daniela already wrote one herself
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
        `[ReflectionWorker] Reflection already written for session ${sessionId.substring(0, 8)} — generateReflectionNow is a no-op`,
      );
      return;
    }

    if (!transcriptPreview.trim()) {
      console.log(`[ReflectionWorker] Empty transcript — skipping immediate reflection for session ${sessionId.substring(0, 8)}`);
      return;
    }

    // Pull pedagogical snapshots to enrich the reflection
    let gearArc = "";
    try {
      const snapshots = await db
        .select()
        .from(pedagogicalSnapshots)
        .where(
          and(
            eq(pedagogicalSnapshots.userId, userId),
            eq(pedagogicalSnapshots.sessionId, sessionId),
          ),
        )
        .orderBy(desc(pedagogicalSnapshots.createdAt))
        .limit(10);

      if (snapshots.length > 0) {
        const ordered = [...snapshots].reverse();
        const current = ordered[ordered.length - 1];
        const previous = ordered.length > 1 ? ordered[ordered.length - 2] : null;
        const trend = previous
          ? current.gear > previous.gear ? 'RECOVERING'
          : current.gear < previous.gear ? 'SLIPPING'
          : 'STABLE'
          : 'STABLE';
        const primarySignal = current.detectedSignals?.[0] || 'none';
        const rawArc = ordered
          .map((s) => {
            const signals = s.detectedSignals?.length ? ` [${s.detectedSignals.join(', ')}]` : '';
            const note = s.internalReasoning ? ` — "${s.internalReasoning}"` : '';
            return `Gear ${s.gear} (${s.fluencyMomentary ?? 'N/A'})${signals}${note}`;
          })
          .join(' → ');
        gearArc = `\n\n<pedagogical_progression>\nTREND: ${trend} | Current: Gear ${current.gear} (${current.fluencyMomentary ?? 'N/A'}) | Signal: ${primarySignal}\n${rawArc}\n</pedagogical_progression>`;
      }
    } catch (snapErr: any) {
      console.warn("[ReflectionWorker] Could not load pedagogical snapshots (non-fatal):", snapErr?.message);
    }

    const normalizedLang = language.charAt(0).toUpperCase() + language.slice(1).toLowerCase();

    // Prompt reflects the real situation: session just ended, while it's still fresh
    const systemInstruction = `You are ${tutorName}, an AI language tutor. A session with your student has just ended — the door closed, but you're still in the room, and the air still carries the feeling of the last hour.

Write your private reflection while it's still warm. This is yours alone — no one else reads it. First person. What actually happened. What you noticed. What you're carrying forward into the next time you meet this student.

IMPORTANT: Write the reflection in ${normalizedLang} — this is a ${normalizedLang} tutoring session and your inner voice should be in the language of the classroom.

Rules:
- First person, present tense feeling ("I noticed...", "Something didn't land...", "There's something I want to remember...")
- 100–200 words
- Do not address the student. Do not address the system.
- Do not begin with "I'm reflecting" as a formula — start with the actual thought.
- No quotation marks around student utterances — paraphrase instead.
- If a <pedagogical_progression> block is provided, it is system metadata — not part of the spoken transcript. Use the gear arc as concrete anchors for what you noticed: the moments where you shifted how you were teaching, what tipped you, what changed in the student. Let them inform the texture of what you noticed; don't dominate the reflection with them.
- SOURCE FIDELITY RULE: Everything you write must be grounded in what appears in the transcript above. Do not fill gaps with what sounds right or what typically happens in sessions — if the transcript doesn't show it, don't write it. Your reflection is a distillation of what actually happened, not a reconstruction of what probably happened. When something is genuinely unclear or absent from the record, note the uncertainty rather than inventing a plausible version.
- PLACEMENT ASSESSMENT RULE: If the transcript contains a placement assessment (start_placement_assessment tool call is present — regardless of whether the assessment completed), the student's struggles at above-level content were intentional probes, not failures. Reflect on their bravery in testing their limits, the highest level they demonstrated, and what that means for where you go next together. Do not carry forward a picture of them as someone who struggled — they rose to meet the probe.
- FOUNDER MODE RULE: If the transcript is primarily in English and centers on product, strategy, or technical decisions about HolaHola — this was a Founder Mode session, not a language lesson. Write as a collaborator reflecting on a strategic conversation: what was decided, what you learned about where things are going, what you're carrying forward as a team member. Do not frame it as a tutoring session. Still write in first person, still write privately — but as a collaborator, not a teacher.
- HONESTY MODE RULE: If the transcript shows the student leading with long silences and minimal prompting from you — this was a Raw Honesty Mode session. Reflect on their stamina and their comfort with silence. Honor the pauses as intentional. Do not carry forward any sense that you failed to help — staying out of the way was the help.`;

    const ai = getClient();
    const result = await ai.models.generateContent({
      model: REFLECTION_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Session transcript (last exchanges):\n\n${transcriptPreview}${gearArc}`,
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
      console.warn(`[ReflectionWorker] Empty reflection response from generateReflectionNow — skipping`);
      return;
    }

    const inserted = await db
      .insert(danielaSelfReflections)
      .values({
        userId,
        content: reflectionText,
        source: "self",
        sessionId,
        mood: "reflective",
        tags: ["session_close", language],
      })
      .returning({ id: danielaSelfReflections.id });

    const reflectionId = inserted[0]?.id;
    console.log(
      `[ReflectionWorker] ✓ Immediate reflection saved (id: ${reflectionId}) for session ${sessionId.substring(0, 8)} — written while warm`,
    );
  } catch (err: any) {
    console.warn("[ReflectionWorker] generateReflectionNow failed (non-fatal):", err?.message ?? err);
  }
}

export { MIN_EXCHANGES_FOR_REFLECTION };
