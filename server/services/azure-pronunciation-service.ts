import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import { db, getUserDb } from "../db";
import { phonemeStruggles, type InsertPhonemeStruggle } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION;

const CONFIDENCE_THRESHOLDS = {
  SEVERE: 0.60,
  MODERATE: 0.75,
  MILD: 0.90,
};

const LANGUAGE_LOCALE_MAP: Record<string, string> = {
  spanish: "es-ES",
  french: "fr-FR",
  german: "de-DE",
  italian: "it-IT",
  portuguese: "pt-BR",
  japanese: "ja-JP",
  mandarin: "zh-CN",
  korean: "ko-KR",
  english: "en-US",
};

export interface PhonemeScore {
  phoneme: string;
  accuracyScore: number;
  nbestPhonemes?: Array<{ phoneme: string; score: number }>;
}

export interface WordScore {
  word: string;
  accuracyScore: number;
  errorType?: string;
  phonemes: PhonemeScore[];
}

export interface PronunciationResult {
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  pronScore: number;
  words: WordScore[];
  rawPhonemes: Array<{
    phoneme: string;
    score: number;
    word: string;
  }>;
}

class AzurePronunciationService {
  private isConfigured: boolean;

  constructor() {
    this.isConfigured = !!(AZURE_SPEECH_KEY && AZURE_SPEECH_REGION);
    if (this.isConfigured) {
      console.log(`[Azure Pronunciation] ✓ Service configured (region: ${AZURE_SPEECH_REGION})`);
    } else {
      console.log("[Azure Pronunciation] ⚠ Not configured - missing AZURE_SPEECH_KEY or AZURE_SPEECH_REGION");
    }
  }

  isAvailable(): boolean {
    return this.isConfigured;
  }

  /**
   * Assess pronunciation using Azure Speech SDK
   * IMPORTANT: audioBuffer must be WAV format (PCM 16-bit, 16kHz, mono) with RIFF header
   * For WebM/Opus audio from browser, transcoding to WAV is required before calling this method
   */
  async assessPronunciation(
    audioBuffer: Buffer,
    referenceText: string,
    language: string
  ): Promise<PronunciationResult | null> {
    if (!this.isConfigured) {
      console.log("[Azure Pronunciation] Service not configured, skipping assessment");
      return null;
    }
    
    // Validate audio format - check for RIFF/WAV header
    const header = audioBuffer.slice(0, 4).toString('ascii');
    if (header !== 'RIFF') {
      console.warn("[Azure Pronunciation] Audio buffer is not WAV format (missing RIFF header). Transcoding required.");
      // For POC, we'll attempt anyway but log the warning
    }

    const locale = LANGUAGE_LOCALE_MAP[language.toLowerCase()] || "en-US";
    
    try {
      const speechConfig = sdk.SpeechConfig.fromSubscription(
        AZURE_SPEECH_KEY!,
        AZURE_SPEECH_REGION!
      );
      speechConfig.speechRecognitionLanguage = locale;

      const pronunciationConfig = new sdk.PronunciationAssessmentConfig(
        referenceText,
        sdk.PronunciationAssessmentGradingSystem.HundredMark,
        sdk.PronunciationAssessmentGranularity.Phoneme,
        true
      );
      pronunciationConfig.enableProsodyAssessment = locale === "en-US";

      const pushStream = sdk.AudioInputStream.createPushStream(
        sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1)
      );
      pushStream.write(audioBuffer);
      pushStream.close();

      const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
      const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
      pronunciationConfig.applyTo(recognizer);

      return new Promise((resolve, reject) => {
        recognizer.recognizeOnceAsync(
          (result) => {
            if (result.reason === sdk.ResultReason.RecognizedSpeech) {
              const pronunciationResult = sdk.PronunciationAssessmentResult.fromResult(result);
              const jsonResult = JSON.parse(result.properties.getProperty(
                sdk.PropertyId.SpeechServiceResponse_JsonResult
              ));

              const words: WordScore[] = [];
              const rawPhonemes: Array<{ phoneme: string; score: number; word: string }> = [];

              if (jsonResult?.NBest?.[0]?.Words) {
                for (const wordData of jsonResult.NBest[0].Words) {
                  const phonemes: PhonemeScore[] = [];
                  
                  if (wordData.Phonemes) {
                    for (const phonemeData of wordData.Phonemes) {
                      const phonemeScore: PhonemeScore = {
                        phoneme: phonemeData.Phoneme,
                        accuracyScore: phonemeData.PronunciationAssessment?.AccuracyScore ?? 0,
                        nbestPhonemes: phonemeData.PronunciationAssessment?.NBestPhonemes,
                      };
                      phonemes.push(phonemeScore);
                      
                      rawPhonemes.push({
                        phoneme: phonemeData.Phoneme,
                        score: phonemeData.PronunciationAssessment?.AccuracyScore ?? 0,
                        word: wordData.Word,
                      });
                    }
                  }

                  words.push({
                    word: wordData.Word,
                    accuracyScore: wordData.PronunciationAssessment?.AccuracyScore ?? 0,
                    errorType: wordData.PronunciationAssessment?.ErrorType,
                    phonemes,
                  });
                }
              }

              const assessmentResult: PronunciationResult = {
                accuracyScore: pronunciationResult.accuracyScore,
                fluencyScore: pronunciationResult.fluencyScore,
                completenessScore: pronunciationResult.completenessScore,
                pronScore: pronunciationResult.pronunciationScore,
                words,
                rawPhonemes,
              };

              console.log(`[Azure Pronunciation] ✓ Assessment complete: accuracy=${assessmentResult.accuracyScore.toFixed(1)}, fluency=${assessmentResult.fluencyScore.toFixed(1)}, phonemes=${rawPhonemes.length}`);
              
              recognizer.close();
              resolve(assessmentResult);
            } else {
              console.log(`[Azure Pronunciation] Recognition failed: ${result.reason}`);
              recognizer.close();
              resolve(null);
            }
          },
          (error) => {
            console.error("[Azure Pronunciation] Error:", error);
            recognizer.close();
            reject(error);
          }
        );
      });
    } catch (error) {
      console.error("[Azure Pronunciation] Assessment error:", error);
      return null;
    }
  }

  private calculateSeverity(score: number): "severe" | "moderate" | "mild" {
    const confidence = score / 100;
    if (confidence < CONFIDENCE_THRESHOLDS.SEVERE) return "severe";
    if (confidence < CONFIDENCE_THRESHOLDS.MODERATE) return "moderate";
    return "mild";
  }

  private getPhonemeCategory(phoneme: string): string {
    const vowels = new Set(["a", "e", "i", "o", "u", "æ", "ɑ", "ɒ", "ɔ", "ə", "ɛ", "ɪ", "ʊ", "ʌ", "iː", "uː", "ɜː", "ɔː", "ɑː"]);
    const nasals = new Set(["m", "n", "ŋ", "ɲ", "ɴ"]);
    const fricatives = new Set(["f", "v", "θ", "ð", "s", "z", "ʃ", "ʒ", "x", "ɣ", "h", "ç"]);
    const diphthongs = new Set(["aɪ", "aʊ", "eɪ", "oʊ", "ɔɪ", "ɪə", "eə", "ʊə"]);
    
    const lower = phoneme.toLowerCase();
    if (diphthongs.has(lower)) return "diphthong";
    if (vowels.has(lower)) return "vowel";
    if (nasals.has(lower)) return "nasal";
    if (fricatives.has(lower)) return "fricative";
    return "consonant";
  }

  private getDisplayLabel(phoneme: string, language: string): string {
    const labels: Record<string, Record<string, string>> = {
      spanish: {
        "r": "Rolling R (rr)",
        "ɾ": "Tap R",
        "θ": "Theta (c/z)",
        "x": "Jota sound",
        "ɲ": "Eñe (ñ)",
        "ʎ": "Ll sound",
        "β": "Soft B/V",
        "ð": "Soft D",
        "ɣ": "Soft G",
      },
      french: {
        "ʁ": "French R",
        "y": "French U",
        "ø": "EU sound",
        "œ": "Open EU",
        "ɑ̃": "Nasal AN",
        "ɛ̃": "Nasal IN",
        "ɔ̃": "Nasal ON",
      },
      german: {
        "ç": "ICH-Laut",
        "x": "ACH-Laut",
        "ʊ": "Short U",
        "øː": "Long Ö",
        "yː": "Long Ü",
        "pf": "PF cluster",
        "ts": "Z/TZ sound",
      },
    };

    return labels[language.toLowerCase()]?.[phoneme] || `/${phoneme}/`;
  }

  async storePhonemeStruggles(
    studentId: string,
    language: string,
    result: PronunciationResult,
    sessionId?: string,
    classId?: string
  ): Promise<void> {
    const strugglingPhonemes = result.rawPhonemes.filter(p => p.score < 85);
    
    if (strugglingPhonemes.length === 0) {
      console.log("[Azure Pronunciation] No struggling phonemes detected");
      return;
    }

    const phonemeGroups = new Map<string, { scores: number[]; words: string[] }>();
    
    for (const p of strugglingPhonemes) {
      const existing = phonemeGroups.get(p.phoneme);
      if (existing) {
        existing.scores.push(p.score);
        if (!existing.words.includes(p.word)) {
          existing.words.push(p.word);
        }
      } else {
        phonemeGroups.set(p.phoneme, { scores: [p.score], words: [p.word] });
      }
    }

    for (const [phoneme, data] of Array.from(phonemeGroups.entries())) {
      const avgScore = data.scores.reduce((a: number, b: number) => a + b, 0) / data.scores.length;
      const minScore = Math.min(...data.scores);
      const maxScore = Math.max(...data.scores);
      const confidence = avgScore / 100;

      try {
        const existing = await getUserDb().select()
          .from(phonemeStruggles)
          .where(and(
            eq(phonemeStruggles.studentId, studentId),
            eq(phonemeStruggles.language, language),
            eq(phonemeStruggles.phoneme, phoneme)
          ))
          .limit(1);

        if (existing.length > 0) {
          const record = existing[0];
          const totalCount = (record.occurrenceCount || 0) + data.scores.length;
          const newAvgConfidence = (
            (record.averageConfidence || 0.5) * (record.occurrenceCount || 1) + 
            confidence * data.scores.length
          ) / totalCount;

          const existingWords = record.exampleWords || [];
          const mergedWords = Array.from(new Set([...existingWords, ...data.words])).slice(0, 10);
          
          const existingSessions = record.sessionIds || [];
          const mergedSessions = sessionId 
            ? Array.from(new Set([...existingSessions, sessionId])).slice(-20)
            : existingSessions;

          await getUserDb().update(phonemeStruggles)
            .set({
              averageConfidence: newAvgConfidence,
              lowestConfidence: Math.min(record.lowestConfidence || 1, minScore / 100),
              highestConfidence: Math.max(record.highestConfidence || 0, maxScore / 100),
              severity: this.calculateSeverity(newAvgConfidence * 100),
              occurrenceCount: totalCount,
              lastOccurredAt: new Date(),
              exampleWords: mergedWords,
              sessionIds: mergedSessions,
              status: newAvgConfidence >= 0.85 ? "improving" : "active",
              updatedAt: new Date(),
            })
            .where(eq(phonemeStruggles.id, record.id));
        } else {
          const insertData: InsertPhonemeStruggle = {
            studentId,
            language,
            phoneme,
            phonemeCategory: this.getPhonemeCategory(phoneme),
            displayLabel: this.getDisplayLabel(phoneme, language),
            averageConfidence: confidence,
            lowestConfidence: minScore / 100,
            highestConfidence: maxScore / 100,
            severity: this.calculateSeverity(avgScore),
            occurrenceCount: data.scores.length,
            exampleWords: data.words.slice(0, 10),
            sessionIds: sessionId ? [sessionId] : [],
            status: "active",
            classId: classId || undefined, // Learning source tracking
          };

          await getUserDb().insert(phonemeStruggles).values(insertData);
        }
      } catch (error) {
        console.error(`[Azure Pronunciation] Error storing phoneme ${phoneme}:`, error);
      }
    }

    console.log(`[Azure Pronunciation] ✓ Stored ${phonemeGroups.size} phoneme struggles for student ${studentId}`);
  }
}

export const azurePronunciationService = new AzurePronunciationService();
