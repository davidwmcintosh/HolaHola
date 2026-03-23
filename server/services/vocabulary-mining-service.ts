import { callGemini, GEMINI_MODELS } from '../gemini-utils';
import { storage } from '../storage';
import type { InsertUserReviewItem } from '@shared/schema';

interface MinedItem {
  prompt: string;
  targetText: string;
  context?: string;
  itemType: 'vocabulary' | 'phrase' | 'grammar';
}

interface MiningResult {
  items: MinedItem[];
}

const MINING_PROMPT = (language: string) => `You are analyzing a language tutoring conversation to extract vocabulary and phrases the student should review.

Language being learned: ${language}

Analyze the conversation and identify 3-5 items that:
1. The student used incorrectly and was corrected
2. The student seemed unsure about (asked for help, long pauses, or used English instead)
3. New vocabulary or phrases the tutor introduced that are useful to remember
4. Grammar patterns the student struggled with

For each item, extract:
- "prompt": English label/description of what the student needs to know (e.g. "to ask for the bill" or "the number 42")
- "targetText": The correct form in ${language} (e.g. "la cuenta, por favor" or "cuarenta y dos")
- "context": A short sentence showing how it appeared in the conversation (optional)
- "itemType": one of "vocabulary", "phrase", or "grammar"

IMPORTANT:
- Only include items where the student showed uncertainty or made an error — not things they got right
- If the conversation has fewer than 10 student messages or is mostly small talk with no language learning, return an empty array
- Maximum 5 items; fewer is fine if there aren't enough clear learning moments

Return ONLY valid JSON in this format:
{"items": [{"prompt": "...", "targetText": "...", "context": "...", "itemType": "vocabulary"}]}`;

export async function mineVocabularyFromSession(
  userId: string,
  language: string,
  history: Array<{ role: string; content: string }>,
  conversationId?: string | null,
  scenarioSlug?: string | null,
): Promise<{ saved: number }> {
  if (!history || history.length < 10) {
    console.log('[VocabMining] Skipping — conversation too short');
    return { saved: 0 };
  }

  const studentMessages = history.filter(h => h.role === 'user');
  if (studentMessages.length < 4) {
    console.log('[VocabMining] Skipping — not enough student messages');
    return { saved: 0 };
  }

  // Build a compact transcript for the prompt
  const transcript = history
    .slice(-30) // Last 30 messages to stay within token limits
    .map(h => `${h.role === 'user' ? 'Student' : 'Daniela'}: ${h.content}`)
    .join('\n');

  const prompt = `${MINING_PROMPT(language)}\n\nConversation:\n${transcript}`;

  try {
    const raw = await callGemini(GEMINI_MODELS.FLASH, [{ role: 'user', content: prompt }]);
    if (!raw) return { saved: 0 };

    // Parse JSON — find the JSON object in the response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[VocabMining] No JSON found in Gemini response');
      return { saved: 0 };
    }

    let result: MiningResult;
    try {
      result = JSON.parse(jsonMatch[0]) as MiningResult;
    } catch {
      console.warn('[VocabMining] Failed to parse Gemini JSON response');
      return { saved: 0 };
    }

    if (!result.items || result.items.length === 0) {
      console.log('[VocabMining] No items extracted from session');
      return { saved: 0 };
    }

    const toInsert: InsertUserReviewItem[] = result.items
      .filter(item => item.prompt && item.targetText)
      .map(item => ({
        userId,
        language,
        prompt: item.prompt,
        targetText: item.targetText,
        context: item.context || null,
        itemType: item.itemType || 'vocabulary',
        sourceConversationId: conversationId || null,
        scenarioSlug: scenarioSlug || null,
        mastered: false,
        attempts: 0,
        correctCount: 0,
      }));

    if (toInsert.length === 0) return { saved: 0 };

    const saved = await storage.createReviewItems(toInsert);
    console.log(`[VocabMining] ✓ Saved ${saved.length} review items for user ${userId}`);
    return { saved: saved.length };
  } catch (err: any) {
    console.warn('[VocabMining] Mining failed:', err.message);
    return { saved: 0 };
  }
}
