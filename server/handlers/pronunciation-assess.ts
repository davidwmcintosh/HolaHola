/**
 * Express route handler for POST /api/voice/assess-pronunciation.
 *
 * Extracted into its own module so it can be imported by both
 * server/routes.ts (production) and integration tests (test), ensuring
 * tests always exercise the real catch block — not a copy.
 *
 * Expected middleware chain before this handler:
 *   voiceLimiter  →  isAuthenticated  →  upload.single('audio')  →  handler
 */

import type { Request, Response } from "express";
import { getRequestUserId } from "../replitAuth.js";

export async function assessPronunciationHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { azurePronunciationService } = await import(
      "../services/azure-pronunciation-service.js"
    );

    if (!azurePronunciationService.isAvailable()) {
      res.status(503).json({
        error: "Azure Pronunciation Assessment not configured",
        hint: "Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION environment variables",
      });
      return;
    }

    const { referenceText, language, classId, sessionId } = req.body as {
      referenceText?: string;
      language?: string;
      classId?: string;
      sessionId?: string;
    };
    const userId = getRequestUserId(req);

    if (!(req as any).file) {
      res.status(400).json({ error: "Audio file required" });
      return;
    }

    if (!referenceText) {
      res
        .status(400)
        .json({ error: "Reference text required for pronunciation assessment" });
      return;
    }

    const audioBuffer = (req as any).file.buffer as Buffer;
    const targetLanguage = language || "spanish";

    console.log(
      `[Azure Pronunciation] Assessing pronunciation for: "${referenceText}" (${targetLanguage})`
    );

    const result = await azurePronunciationService.assessPronunciation(
      audioBuffer,
      referenceText,
      targetLanguage
    );

    if (!result) {
      // No speech was recognized — surface as pronunciation_unavailable so
      // the client can show a meaningful notice instead of a blank result.
      res.status(422).json({
        error: "pronunciation_unavailable",
        reason:
          "No speech recognized in the audio — please try again with a clear recording.",
      });
      return;
    }

    // Store phoneme struggles in database with learning context
    await azurePronunciationService.storePhonemeStruggles(
      userId,
      targetLanguage,
      result,
      sessionId || undefined,
      classId || undefined // Learning source tracking
    );

    res.json({
      success: true,
      scores: {
        accuracy: result.accuracyScore,
        fluency: result.fluencyScore,
        completeness: result.completenessScore,
        pronunciation: result.pronScore,
      },
      words: result.words.map((w) => ({
        word: w.word,
        accuracy: w.accuracyScore,
        errorType: w.errorType,
        phonemes: w.phonemes.map((p) => ({
          phoneme: p.phoneme,
          accuracy: p.accuracyScore,
        })),
      })),
      strugglingPhonemes: result.rawPhonemes
        .filter((p) => p.score < 85)
        .map((p) => ({
          phoneme: p.phoneme,
          score: p.score,
          word: p.word,
        })),
    });
  } catch (error: any) {
    console.error("[Azure Pronunciation] Assessment error:", error);
    // Classify Azure service failures so clients receive a machine-readable field.
    // Expected error shape: { error: 'pronunciation_unavailable', reason: string }
    if (error?.name === "AzurePronunciationError") {
      const status = error.category === "rate_limit" ? 429 : 503;
      res.status(status).json({
        error: "pronunciation_unavailable",
        reason: error.message,
      });
      return;
    }
    res.status(500).json({
      error: "pronunciation_unavailable",
      reason: error?.message || "Pronunciation assessment failed",
    });
  }
}
