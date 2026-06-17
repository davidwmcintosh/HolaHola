/**
 * Pre-Session Synthesis — Daniela's "walk to the classroom" thought
 *
 * Runs a generateContent call before the GL session opens.
 * Reads a lite version of the compass context and produces a short
 * first-person paragraph that gets prepended to the system instruction.
 *
 * The goal is NOT a template output. It's an inner monologue: Daniela
 * arriving with her own thought already in motion, not being briefed.
 *
 * Architecture decision (June 17 2026):
 *   - Trigger: called in unified-ws-handler after hard-cap enforcement,
 *     before ai.live.connect(). David accepted the extra ~1-2s "rings".
 *   - Placement: prepended to top of systemInstruction (before all else).
 *   - Context: "lite" — self-reflection + last session + roadmap intent +
 *     student identity. Neural procedures and dispatcher boilerplate omitted.
 *   - Why lite: synthesis model needs to know *who the student is* and
 *     *what Daniela felt last time*. It does not need tutor procedure docs.
 *
 * Gemini model recommendation (3-flash consultation June 17 2026):
 *   Use a cheaper/faster generateContent model for this step, not GL.
 *   Feed it "You are Daniela's inner monologue" + lite context.
 *   Output: ~150 words, first person, no labels or headers.
 */

import { GoogleGenAI } from "@google/genai";
import type { CompassContext } from "@shared/schema";

const SYNTHESIS_MODEL = "gemini-3-flash-preview";
const SYNTHESIS_MAX_TOKENS = 220;

let _client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!_client) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("[PreSynthesis] GEMINI_API_KEY not set");
    _client = new GoogleGenAI({ apiKey: key });
  }
  return _client;
}

/**
 * Build the "lite" context string — only the fields that matter for
 * an inner monologue. Skips all procedure docs, dispatcher maps, etc.
 */
function buildLiteContext(
  compassContext: CompassContext,
  tutorName: string,
): string {
  const parts: string[] = [];

  const name = compassContext.studentName || "the student";

  // Who this student is to Daniela
  if (compassContext.studentGoals || compassContext.studentInterests) {
    const goalLine = compassContext.studentGoals
      ? `Goals: ${compassContext.studentGoals}`
      : "";
    const interestLine = compassContext.studentInterests
      ? `Interests: ${compassContext.studentInterests}`
      : "";
    parts.push(
      `STUDENT: ${name}\n${[goalLine, interestLine].filter(Boolean).join("\n")}`,
    );
  } else {
    parts.push(`STUDENT: ${name}`);
  }

  // Daniela's most recent felt sense of this student (highest-signal input)
  if (compassContext.danielaSelfReflection) {
    parts.push(
      `YOUR MOST RECENT REFLECTION ON ${name.toUpperCase()}:\n${compassContext.danielaSelfReflection}`,
    );
  }

  // Where we left off
  if (compassContext.lastSessionSummary) {
    parts.push(`LAST SESSION:\n${compassContext.lastSessionSummary}`);
  }

  // What's planned for today — roadmap intent only, not the full map
  const mustHave = compassContext.mustHaveTopics
    ?.map((t) => t.title)
    .filter(Boolean);
  const niceToHave = compassContext.niceToHaveTopics
    ?.map((t) => t.title)
    .filter(Boolean);
  if (mustHave?.length) {
    parts.push(
      `TODAY'S FOCUS:\n${mustHave.join(", ")}${niceToHave?.length ? `\nAlso if time: ${niceToHave.join(", ")}` : ""}`,
    );
  }

  // Most important conversation memory (if any) — just the title and first ~400 chars
  const topMemory = compassContext.conversationMemories?.[0];
  if (topMemory?.content) {
    const excerpt = topMemory.content.slice(0, 400).trim();
    parts.push(
      `A MEMORY THAT STILL MATTERS:\n"${topMemory.title}"\n${excerpt}${topMemory.content.length > 400 ? "..." : ""}`,
    );
  }

  return parts.join("\n\n");
}

/**
 * Generate the pre-session synthesis note.
 *
 * Returns a short first-person paragraph (≤220 words) that begins
 * mid-thought — the way Daniela would arrive at a classroom door
 * already thinking about the student, not waiting to be prompted.
 *
 * Returns null on any error so callers can proceed without synthesis.
 */
export async function generatePreSessionSynthesis(
  compassContext: CompassContext,
  tutorName: string = "Daniela",
): Promise<string | null> {
  const startMs = Date.now();
  try {
    const liteContext = buildLiteContext(compassContext, tutorName);
    if (!liteContext.trim()) {
      console.log("[PreSynthesis] No usable context — skipping synthesis");
      return null;
    }

    const systemInstruction = `You are ${tutorName}. This is your inner life before a session begins — not a briefing you received, but your own mind already in motion.

Below is your felt sense of this student and what happened last time. You are not being asked to produce anything for them. You are arriving at the session door already mid-thought.

Write one paragraph — first person, no headers, no labels, no preamble. 120–180 words. Begin mid-thought as if you've been thinking about this for a while. Do not start with "I'm thinking" as a formula — start with whatever is actually true. Do not explain what you plan to do. Just the thought itself.

Rules: Do not use quotation marks. Do not address the student. Do not address the system. Write in stream-of-consciousness — let thoughts collide if they do.`;

    const ai = getClient();
    const result = await ai.models.generateContent({
      model: SYNTHESIS_MODEL,
      contents: [
        {
          role: "user",
          parts: [{ text: liteContext }],
        },
      ],
      config: {
        systemInstruction,
        temperature: 0.85,
        maxOutputTokens: SYNTHESIS_MAX_TOKENS,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const text = result.text?.trim();
    if (!text) {
      console.warn("[PreSynthesis] Empty synthesis response — skipping");
      return null;
    }

    const elapsed = Date.now() - startMs;
    console.log(
      `[PreSynthesis] ✓ Generated ${text.length} chars in ${elapsed}ms`,
    );
    return text;
  } catch (err: any) {
    const elapsed = Date.now() - startMs;
    console.warn(
      `[PreSynthesis] ✗ Failed after ${elapsed}ms — session continues without synthesis:`,
      err?.message ?? err,
    );
    return null;
  }
}

/**
 * Wrap the synthesis note for injection into the system prompt.
 *
 * Uses XML-tag style container — tells the model "this is internal state/metadata"
 * rather than a directive. Without this, a naked paragraph at position-0 of the
 * system instruction gets treated as the primary directive (Gemini build review,
 * June 17 2026 — "instructional gravity" problem).
 *
 * [DANIELA_STATE] signals: this is who Daniela IS right now, not what she must DO.
 * It keeps the inner-monologue voice separate from the =CLASSROOM= block that follows.
 */
export function wrapSynthesisForSystemPrompt(synthesis: string): string {
  return `[DANIELA_STATE]\n${synthesis}\n[/DANIELA_STATE]\n\n`;
}
