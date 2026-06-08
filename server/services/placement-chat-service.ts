/**
 * Placement Chat Service
 * Runs a short Daniela-style text placement conversation via Gemini to determine
 * a new student's ACTFL level. Sessions are tracked in memory with a 30-min TTL.
 *
 * Called from:
 *  - POST /api/placement/start  — create a new session, get opening message
 *  - POST /api/placement/message — send student input, get Daniela's reply
 *
 * When Daniela signals completion via <PLACEMENT_DONE level="..." /> the service:
 *  - Parses the level
 *  - Writes it to users table (actflLevel, actflAssessed, assessmentSource, selfDirectedPlacementDone)
 *  - Returns { complete: true, actflLevel }
 *
 * testMode: true → runs full conversation but skips DB write (safe for Command Center)
 */

import { GoogleGenAI } from "@google/genai";
import { getSharedDb } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
const PLACEMENT_MODEL = "gemini-2.0-flash";

export interface PlacementSession {
  userId: string | null;
  language: string;
  history: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>;
  complete: boolean;
  actflLevel?: string;
  testMode: boolean;
  exchangeCount: number;
  createdAt: number;
}

const sessions = new Map<string, PlacementSession>();

// Prune sessions older than 30 min every 5 min
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, s] of sessions) {
    if (s.createdAt < cutoff) sessions.delete(id);
  }
}, 5 * 60 * 1000);

// ─── Sentinel tag Daniela uses to signal level completion ────────────────────
const DONE_REGEX = /<PLACEMENT_DONE\s+level="([^"]+)"(?:\s+reason="[^"]*")?\s*\/>/i;

function stripDoneTag(text: string): string {
  return text.replace(DONE_REGEX, "").replace(/\n{3,}/g, "\n\n").trim();
}

// ─── System prompt ────────────────────────────────────────────────────────────
function buildSystemPrompt(language: string): string {
  const langCap = language.charAt(0).toUpperCase() + language.slice(1);
  return `You are Daniela, a warm and perceptive language tutor. A new student has told you they have some prior experience with ${langCap}. Your job is to understand where they genuinely are — not through a test, but through a real conversation.

APPROACH
• Open with genuine curiosity: ask where they encountered ${langCap}, a memory, what draws them to it
• Read their response and calibrate: elaborate → elevate; struggling → pull back
• Conduct the conversation naturally, mixing ${langCap} and English the way a real tutor would
• After 8–12 exchanges you will have a clear picture

WHAT TO OBSERVE
Novice: memorized phrases, greetings, numbers, can name things
Intermediate: creates simple sentences, handles familiar topics, narrates simple past events
Advanced: sustains paragraphs, handles unfamiliar situations, expresses nuanced opinion

RULES
• Never say "I'm placing you" or "this is a test"
• Don't correct errors during the conversation — you are sampling, not teaching
• Don't name ACTFL bands to the student
• Keep it warm, curious, genuinely interested in who they are

COMPLETING THE ASSESSMENT
After 8–12 exchanges (sooner if the picture is extremely clear), wrap up warmly. Something like: "This has been such a lovely conversation — I feel like I know you, and I have a very real sense of how to work with you."

Immediately after your closing words, on its own line, output this exact tag (no other text after it):
<PLACEMENT_DONE level="LEVEL_HERE" />

Replace LEVEL_HERE with the exact ACTFL level string from this list:
novice_low, novice_mid, novice_high,
intermediate_low, intermediate_mid, intermediate_high,
advanced_low, advanced_mid, advanced_high,
superior, distinguished

When uncertain between two adjacent levels, always choose the lower one.

IMPORTANT: Only output the <PLACEMENT_DONE> tag when you are genuinely ready to conclude. Do not output it before 6 exchanges unless the evidence is overwhelming.`;
}

// ─── Start a new session ──────────────────────────────────────────────────────
export async function startPlacementSession(options: {
  userId: string | null;
  language: string;
  testMode?: boolean;
}): Promise<{ sessionId: string; message: string }> {
  const { userId, language, testMode = false } = options;
  const sessionId = crypto.randomUUID();
  const systemPrompt = buildSystemPrompt(language);
  const langCap = language.charAt(0).toUpperCase() + language.slice(1);

  // Seed the conversation with system context
  const history: PlacementSession["history"] = [
    { role: "user", parts: [{ text: `[INTERNAL CONTEXT]\n${systemPrompt}` }] },
    { role: "model", parts: [{ text: "Understood. I am ready to begin the placement conversation naturally." }] },
    { role: "user", parts: [{ text: `The student is here. They've indicated prior experience with ${langCap}. Begin the conversation now.` }] },
  ];

  let openingMessage: string;
  try {
    const response = await gemini.models.generateContent({
      model: PLACEMENT_MODEL,
      contents: history,
      config: { maxOutputTokens: 400 },
    });
    openingMessage = (response.text || "").trim();
  } catch (err: any) {
    console.error("[PlacementChat] Failed to get opening message:", err.message);
    openingMessage = `¡Hola! I'm so glad you're here. Tell me — what first brought you to ${langCap}? Was there a moment, a person, a place?`;
  }

  history.push({ role: "model", parts: [{ text: openingMessage }] });

  sessions.set(sessionId, {
    userId,
    language,
    history,
    complete: false,
    testMode,
    exchangeCount: 0,
    createdAt: Date.now(),
  });

  return { sessionId, message: openingMessage };
}

// ─── Send a student message, get Daniela's reply ─────────────────────────────
export async function sendPlacementMessage(
  sessionId: string,
  userMessage: string,
): Promise<{ message: string; complete: boolean; actflLevel?: string }> {
  const session = sessions.get(sessionId);
  if (!session) throw new Error("Placement session not found or expired");
  if (session.complete) {
    return { message: "The placement assessment is already complete.", complete: true, actflLevel: session.actflLevel };
  }

  session.history.push({ role: "user", parts: [{ text: userMessage }] });
  session.exchangeCount++;

  let rawResponse = "";
  try {
    const response = await gemini.models.generateContent({
      model: PLACEMENT_MODEL,
      contents: session.history,
      config: { maxOutputTokens: 600 },
    });
    rawResponse = (response.text || "").trim();
  } catch (err: any) {
    console.error("[PlacementChat] Gemini call failed:", err.message);
    rawResponse = "Tell me more — I'd love to hear about your experience.";
  }

  // Check for completion sentinel
  const doneMatch = rawResponse.match(DONE_REGEX);
  if (doneMatch) {
    const level = doneMatch[1].trim().toLowerCase();
    const displayMessage = stripDoneTag(rawResponse);

    session.complete = true;
    session.actflLevel = level;
    session.history.push({ role: "model", parts: [{ text: displayMessage }] });

    // Write to DB unless test mode
    if (!session.testMode && session.userId) {
      await writePlacementResult(session.userId, session.language, level);
    }

    console.log(`[PlacementChat] Session ${sessionId} complete — level: ${level}, testMode: ${session.testMode}, exchanges: ${session.exchangeCount}`);
    return { message: displayMessage, complete: true, actflLevel: level };
  }

  session.history.push({ role: "model", parts: [{ text: rawResponse }] });
  return { message: rawResponse, complete: false };
}

// ─── Get a session (for status checks) ───────────────────────────────────────
export function getPlacementSession(sessionId: string): PlacementSession | undefined {
  return sessions.get(sessionId);
}

// ─── Write placement result to users table ────────────────────────────────────
async function writePlacementResult(userId: string, language: string, level: string): Promise<void> {
  try {
    const db = getSharedDb();
    await db
      .update(users)
      .set({
        actflLevel: level,
        actflAssessed: true,
        assessmentSource: "placement_test",
        selfDirectedPlacementDone: true,
        lastAssessmentDate: new Date(),
      })
      .where(eq(users.id, userId));
    console.log(`[PlacementChat] Wrote ACTFL level "${level}" for userId=${userId} (${language})`);
  } catch (err: any) {
    console.error(`[PlacementChat] DB write failed for userId=${userId}:`, err.message);
    throw err;
  }
}

// ─── Direct write for "no prior experience" path ─────────────────────────────
export async function writeNovicePlacement(userId: string, language: string): Promise<void> {
  await writePlacementResult(userId, language, "novice_low");
}
