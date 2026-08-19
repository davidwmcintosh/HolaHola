/**
 * GL Game Session Detector
 *
 * Detects whether a completed GL session contained a game (counting game,
 * word association, role-play, etc.) and, if so, saves a dedicated
 * conversation_memory row so Daniela can find it later via semantic search.
 *
 * Problem solved: GL exchanges land in the rolling episode archive, but a
 * student asking "remember that counting game?" gets only a weak Arm 5 hit
 * (the episode archive entry) rather than a focused, titled game record.
 * This module creates that focused record automatically on session end.
 *
 * Hook: called from GeminiLiveSession.stop() after transcripts are flushed.
 */

import { getSharedDb } from '../db';
import { conversationMemories } from '@shared/schema';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SessionExchange {
  user: string;
  daniela: string;
}

export interface GameDetectionResult {
  detected: boolean;
  gameType: string;
  label: string;
  confidence: 'high' | 'medium';
}

interface GamePattern {
  type: string;
  label: string;
  patterns: RegExp[];
  /** Number of distinct patterns from the list that must match. Default 1. */
  minMatches?: number;
}

// ── Pattern library ──────────────────────────────────────────────────────────

// Exported for test seam: self-check empties this array to prove the guard is real.
export const GAME_PATTERNS: GamePattern[] = [
  {
    type: 'counting-game',
    label: 'counting game',
    patterns: [
      /\bcount(?:ing|ed|s)?\b/i,
      /\bone\s*,?\s*two\s*,?\s*three\b/i,
      /\bun\b.{0,10}\bdos\b.{0,10}\btres\b/i,
      /\bcuánt[ao]s?\b/i,
      /\bnúmeros?\b/i,
      /\bcount\s+(?:to|from)\b/i,
      /\blet'?s\s+count\b/i,
      /\bvamos?\s+a\s+contar\b/i,
    ],
    minMatches: 2,
  },
  {
    type: 'word-association',
    label: 'word association game',
    patterns: [
      /\bword\s+association\b/i,
      /\bsay\s+(?:a\s+)?word\b/i,
      /\bfirst\s+word\b/i,
      /\bdi(?:ce|ga)?\s+una\s+palabra\b/i,
      /\bpalabra\s+que\s+te\s+(?:venga|llegue)\b/i,
    ],
    minMatches: 1,
  },
  {
    type: 'twenty-questions',
    label: '20 questions game',
    patterns: [
      /\btwenty\s+questions?\b/i,
      /\b20\s+questions?\b/i,
      /\bveinte\s+preguntas?\b/i,
      /\bi(?:'m|\s+am)\s+thinking\s+of\b/i,
      /\bestoy\s+pensando\s+en\b/i,
      /\bes\s+(?:un\s+)?(?:animal|mineral|vegetal|objeto)\b/i,
      /\banimal\s+o\s+(?:mineral|vegetal)\b/i,
    ],
    minMatches: 2,
  },
  {
    type: 'role-play',
    label: 'role-play scenario',
    patterns: [
      /\brole.?play\b/i,
      /\blet'?s\s+pretend\b/i,
      /\bimagina\s+que\b/i,
      /\bfingamos\b/i,
      /\byou\s+(?:are|play)\s+(?:a|an|the)\b/i,
      /\beres\s+(?:un|una)\b/i,
      /\bescenario\b/i,
    ],
    minMatches: 2,
  },
  {
    type: 'vocabulary-quiz',
    label: 'vocabulary quiz',
    // IMPORTANT: generic translation questions ("how do you say X?", "what does Y mean?")
    // are the most common tutoring prompts and must NOT be used as match criteria.
    // Vocabulary-quiz detection requires an explicit quiz/game signal — the student
    // or Daniela must name or structure an activity as a quiz, not just ask a question.
    patterns: [
      /\bvocabulary\s+quiz\b/i,
      /\bprueba\s+de\s+vocabulario\b/i,
      /\bvocab\s+quiz\b/i,
      /\blet'?s\s+(do\s+a\s+)?(?:vocab|vocabulary)\s+quiz\b/i,
      /\btranslation\s+(?:quiz|game|challenge)\b/i,
      /\btest\s+your\s+(?:spanish|vocabulary|vocab|words)\b/i,
      /\bjuego\s+de\s+vocabulario\b/i,
    ],
    minMatches: 1,
  },
  {
    type: 'simon-says',
    label: 'Simon Says game',
    patterns: [
      /\bsimon\s+says?\b/i,
      /\bsimón\s+dice\b/i,
    ],
    minMatches: 1,
  },
  {
    type: 'storytelling',
    label: 'collaborative storytelling',
    patterns: [
      /\bcontinue\s+(?:the\s+)?story\b/i,
      /\badd\s+to\s+(?:the\s+)?story\b/i,
      /\bcontinúa\s+(?:la\s+)?historia\b/i,
      /\bwhat\s+happens\s+next\b/i,
      /\bqué\s+pasa\s+después\b/i,
      /\bonce\s+upon\s+a\s+time\b/i,
      /\bérase\s+una\s+vez\b/i,
    ],
    minMatches: 2,
  },
  {
    type: 'i-spy',
    label: 'I Spy game',
    patterns: [
      /\bi\s+spy\b/i,
      /\bveo\s+veo\b/i,
    ],
    minMatches: 1,
  },
  {
    type: 'riddle',
    label: 'riddles',
    patterns: [
      /\briddle\b/i,
      /\bacertijo\b/i,
      /\badivina(?:nza)?\b/i,
      /\bwhat\s+am\s+i\b/i,
      /\bwhat\s+has\b.{0,40}\bbut\b/i,
    ],
    minMatches: 2,
  },
  {
    type: 'flashcard-drill',
    label: 'flashcard drill',
    patterns: [
      /\bflashcard\b/i,
      /\brepeat\s+after\s+me\b/i,
      /\brepite\s+(?:después\s+de\s+mí|conmigo)\b/i,
      /\bdi\s+(?:otra\s+vez|de\s+nuevo)\b/i,
    ],
    minMatches: 2,
  },
];

// ── Detection ────────────────────────────────────────────────────────────────

/**
 * Scan a completed session's exchanges for known game patterns.
 * Returns the first (highest-priority) match, or detected=false.
 *
 * Minimum 3 exchanges required — short sessions are almost certainly not games.
 */
export function detectGameInTranscript(exchanges: SessionExchange[]): GameDetectionResult {
  if (exchanges.length < 3) {
    return { detected: false, gameType: '', label: '', confidence: 'medium' };
  }

  const fullText = exchanges.map(e => `${e.user} ${e.daniela}`).join('\n');

  for (const pattern of GAME_PATTERNS) {
    const matchCount = pattern.patterns.filter(p => p.test(fullText)).length;
    const minRequired = pattern.minMatches ?? 1;
    if (matchCount >= minRequired) {
      const confidence = matchCount >= minRequired + 1 ? 'high' : 'medium';
      return {
        detected: true,
        gameType: pattern.type,
        label: pattern.label,
        confidence,
      };
    }
  }

  return { detected: false, gameType: '', label: '', confidence: 'medium' };
}

// ── Save ─────────────────────────────────────────────────────────────────────

export interface GameSessionSaveParams {
  exchanges: SessionExchange[];
  tutorName: string;
  targetLanguage: string;
  userId?: string | number | null;
  // NOTE: studentName is intentionally NOT accepted.
  // conversation_memories is a globally shared, unscoped table; any name
  // stored here is visible to all recall paths without row-level access
  // control. All game-session records are fully de-identified at insert time.
}

/**
 * Payload that would be inserted into conversation_memories.
 * Exported so CI tests can verify the exact values without a DB write.
 *
 * PRIVACY INVARIANT: none of the string fields in this payload may contain
 * student identity (name, userId, or verbatim student speech).
 */
export interface GameMemoryPayload {
  title: string;
  summary: string;
  content: string;
  participants: string;
  tags: string[];
}

/**
 * Build the de-identified conversation_memory payload for a detected game session.
 *
 * All fields are safe to store in the globally shared conversation_memories table:
 *   • title   — game type + language only (no student identity)
 *   • summary — structural aggregate (turn count, confidence) — no names
 *   • content — Daniela's tutor speech only, 1 200-char cap — no student utterances
 *   • participants — generic "Student [GL]" label — no real name
 *   • tags    — game-session, game-type, language, gl-auto-capture
 *
 * Returns null when result.detected is false (caller should not insert).
 */
export function buildGameMemoryPayload(
  exchanges: SessionExchange[],
  result: GameDetectionResult,
  targetLanguage: string,
  tutorName: string,
): GameMemoryPayload | null {
  if (!result.detected) return null;

  const lang = targetLanguage
    ? targetLanguage.charAt(0).toUpperCase() + targetLanguage.slice(1)
    : 'Spanish';

  // Title: game type + language. No student name, no speech.
  const title = `GL Game Session: ${result.label} (${lang})`;

  // ── Structured metadata only — no verbatim speech ────────────────────────
  // PRIVACY INVARIANT: conversation_memories has no per-row access control.
  // Arm 5 of processUnifiedRecall searches title/summary/content without
  // user-scoping. Tutor speech is excluded alongside student speech because
  // tutors routinely echo student names ("Great job, María!"), repeat personal
  // details mentioned during the session, or reproduce other identifying content.
  //
  // content stores structural, speech-free metadata only:
  //   • game type, language, turn count, confidence  — all non-identifying
  //   • no tutor utterances, no student utterances

  const now = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const summary =
    `Daniela ran a ${result.label} over ${exchanges.length} turns in ${lang}. ` +
    `Detection confidence: ${result.confidence}. Auto-captured on ${now}.`;

  const content =
    `game_type: ${result.gameType}\n` +
    `game_label: ${result.label}\n` +
    `language: ${lang}\n` +
    `turns: ${exchanges.length}\n` +
    `confidence: ${result.confidence}\n` +
    `captured_date: ${now}\n` +
    `tutor: ${tutorName}\n` +
    `note: verbatim speech not stored (privacy — unscoped shared table)`;

  // Participants: generic label — no real student name.
  const tutorLabel = `${tutorName} [GL]`;
  const participants = `Student [GL] + ${tutorLabel}`;

  const tags = [
    'game-session',
    result.gameType,
    ...(targetLanguage ? [targetLanguage.toLowerCase()] : ['spanish']),
    'gl-auto-capture',
  ];

  return { title, summary, content, participants, tags };
}

/**
 * Insert a game-session memory row from a pre-built payload and return the
 * new memory ID (or null on failure).
 *
 * Exported so tests can call with a unique CI-sentinel tag, get the ID back
 * immediately, and do deterministic cleanup — without relying on tag queries
 * that could accidentally match production rows.
 *
 * Production callers use this via maybeAutoSaveGameSession; CI tests call it
 * directly after injecting an extra sentinel tag into the payload.
 */
export async function insertGameMemory(
  payload: GameMemoryPayload,
  userId?: string | null,
): Promise<string | null> {
  try {
    const db = getSharedDb();
    const [row] = await db
      .insert(conversationMemories)
      .values({
        title: payload.title,
        summary: payload.summary,
        content: payload.content,
        participants: payload.participants,
        entryType: 'conversation',
        tags: payload.tags,
        importance: 8,
        arcName: 'game-sessions',
      })
      .returning({ id: conversationMemories.id });

    return row?.id ?? null;
  } catch (err: any) {
    console.warn('[GLGameDetector] INSERT failed:', err?.message);
    return null;
  }
}

/**
 * Detect a game in the completed session transcript and, if found, save a
 * dedicated conversation_memory row tagged 'game-session' so semantic search
 * can surface it accurately.
 *
 * Fire-and-forget: call without await from stop().
 */
export async function maybeAutoSaveGameSession(params: GameSessionSaveParams): Promise<void> {
  const { exchanges, tutorName, targetLanguage } = params;

  const result = detectGameInTranscript(exchanges);
  if (!result.detected) return;

  const payload = buildGameMemoryPayload(exchanges, result, targetLanguage, tutorName);
  if (!payload) return;

  const userId = params.userId != null ? String(params.userId) : undefined;
  const memoryId = await insertGameMemory(payload, userId);
  if (!memoryId) return;

  console.log(
    `[GLGameDetector] Saved game-session memory ${memoryId} ` +
    `(${result.gameType}, ${exchanges.length} turns, confidence=${result.confidence}) — embedding…`,
  );

  // Embed async so it shows up in semantic search (Arm 1/2/5).
  import('../scripts/reembed-memory')
    .then(mod => mod.reembedConversationMemory(memoryId, userId))
    .then(() => {
      console.log(`[GLGameDetector] Embedded game-session memory ${memoryId}`);
    })
    .catch((err: any) => {
      console.warn(`[GLGameDetector] Embed failed for ${memoryId}:`, err?.message);
    });
}
