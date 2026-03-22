import { getSharedDb } from '../db';
import { vocabularyWords, userReviewItems } from '@shared/schema';
import { and, eq } from 'drizzle-orm';

/**
 * In-memory store for newly mastered words that Daniela should acknowledge
 * on the next conversation turn. Keyed by userId.
 * Cleared after being injected into the system prompt.
 */
export const pendingMasteryAcknowledgments = new Map<string, string[]>();

/**
 * Runtime stats for Lyra's credit sensitivity monitoring.
 * Accumulates since last server start. Reset via resetCreditStats().
 */
export interface CreditRuntimeStats {
  turnsProcessed: number;         // total conversation turns run through credit engine
  wordsCredited: number;          // total individual word credits applied
  masteredViaChat: number;        // words that crossed mastery threshold via conversation alone
  highCreditTurns: number;        // turns where ≥5 words credited in one turn (flag for over-crediting)
  correctionMarkerHits: number;   // times correction markers were detected (marker caught something)
  skippedDueToCorrection: number; // words skipped because Daniela corrected them
  sinceMs: number;                // epoch when tracking began
}

const _stats: CreditRuntimeStats = {
  turnsProcessed: 0,
  wordsCredited: 0,
  masteredViaChat: 0,
  highCreditTurns: 0,
  correctionMarkerHits: 0,
  skippedDueToCorrection: 0,
  sinceMs: Date.now(),
};

export function getCreditRuntimeStats(): Readonly<CreditRuntimeStats> {
  return { ..._stats };
}

export function resetCreditStats(): void {
  Object.assign(_stats, {
    turnsProcessed: 0,
    wordsCredited: 0,
    masteredViaChat: 0,
    highCreditTurns: 0,
    correctionMarkerHits: 0,
    skippedDueToCorrection: 0,
    sinceMs: Date.now(),
  });
}

const CORRECTION_MARKERS = [
  'actually', 'you should say', 'the correct form is', 'should be', 'it should be',
  'try saying', 'instead of', 'corrección', 'se dice', 'la forma correcta',
  'debería ser', 'deberías decir', 'lo correcto es', 'recuerda que',
];

/**
 * Returns a set of lowercased words that Daniela explicitly corrected.
 * Heuristic: any word that appears within 150 chars of a correction marker.
 */
function detectCorrectedWords(danielaResponse: string): Set<string> {
  const corrected = new Set<string>();
  const lower = danielaResponse.toLowerCase();

  for (const marker of CORRECTION_MARKERS) {
    let idx = lower.indexOf(marker);
    while (idx !== -1) {
      const window = lower.slice(idx, idx + 200);
      const words = window.match(/[a-záéíóúüñ\w]{2,}/g) || [];
      words.forEach(w => corrected.add(w));
      idx = lower.indexOf(marker, idx + 1);
    }
  }
  return corrected;
}

function extractWords(text: string): string[] {
  return (text.match(/[a-záéíóúüñA-ZÁÉÍÓÚÜÑ\w]{2,}/g) || []).map(w => w.toLowerCase());
}

/**
 * Applies conversational credit for vocabulary words the student used correctly
 * (i.e., Daniela didn't correct them). Fire-and-forget — never throws.
 *
 * Credits:
 *  - vocabulary_words (SM-2 via updateVocabularyReview)
 *  - user_review_items (SM-2 via recordReviewItemAttempt)
 *
 * Stores newly mastered words in pendingMasteryAcknowledgments for Daniela
 * to weave into her next response.
 */
export async function applyConversationalCredit(params: {
  userId: string;
  language: string;
  studentMessage: string;
  danielaResponse: string;
  conversationId: string;
  storage: {
    updateVocabularyReview: (id: string, isCorrect: boolean) => Promise<(any & { newlyMastered: boolean }) | undefined>;
    recordReviewItemAttempt: (id: string, isCorrect: boolean) => Promise<any>;
  };
}): Promise<void> {
  const { userId, language, studentMessage, danielaResponse, storage } = params;

  try {
    _stats.turnsProcessed++;

    const studentWords = extractWords(studentMessage);
    if (studentWords.length < 2) return;

    const corrected = detectCorrectedWords(danielaResponse);
    if (corrected.size > 0) _stats.correctionMarkerHits++;

    const [userVocab, reviewItems] = await Promise.all([
      getSharedDb()
        .select({ id: vocabularyWords.id, word: vocabularyWords.word })
        .from(vocabularyWords)
        .where(and(eq(vocabularyWords.userId, userId), eq(vocabularyWords.language, language))),
      getSharedDb()
        .select({ id: userReviewItems.id, targetText: userReviewItems.targetText, mastered: userReviewItems.mastered })
        .from(userReviewItems)
        .where(and(eq(userReviewItems.userId, userId), eq(userReviewItems.language, language), eq(userReviewItems.mastered, false))),
    ]);

    const newlyMastered: string[] = [];
    let turnCredits = 0;

    for (const vocab of userVocab) {
      const wordLower = vocab.word.toLowerCase();
      if (studentWords.includes(wordLower)) {
        if (corrected.has(wordLower)) {
          _stats.skippedDueToCorrection++;
        } else {
          const result = await storage.updateVocabularyReview(vocab.id, true);
          turnCredits++;
          _stats.wordsCredited++;
          if (result?.newlyMastered) {
            newlyMastered.push(vocab.word);
            _stats.masteredViaChat++;
            console.log(`[ConversationalCredit] Mastered via conversation: "${vocab.word}"`);
          } else {
            console.log(`[ConversationalCredit] Credited: "${vocab.word}" (interval: ${result?.interval ?? 0}d)`);
          }
        }
      }
    }

    for (const item of reviewItems) {
      const itemWords = extractWords(item.targetText);
      const used = itemWords.some(w => studentWords.includes(w));
      const wasCorrected = itemWords.some(w => corrected.has(w));
      if (used) {
        if (wasCorrected) {
          _stats.skippedDueToCorrection++;
        } else {
          await storage.recordReviewItemAttempt(item.id, true);
          turnCredits++;
          _stats.wordsCredited++;
          console.log(`[ConversationalCredit] Credited review item: "${item.targetText}"`);
        }
      }
    }

    if (turnCredits >= 5) _stats.highCreditTurns++;

    if (newlyMastered.length > 0) {
      const existing = pendingMasteryAcknowledgments.get(userId) || [];
      pendingMasteryAcknowledgments.set(userId, [...existing, ...newlyMastered]);
      console.log(`[ConversationalCredit] Pending mastery acknowledgment for ${userId}: ${newlyMastered.join(', ')}`);
    }
  } catch (err) {
    console.error('[ConversationalCredit] Non-critical error:', err);
  }
}
