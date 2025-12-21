/**
 * Pronunciation Drill Mode Service
 * 
 * Provides focused phoneme practice sessions based on student's struggle patterns.
 * Integrates with the student learning service to pull pronunciation-related struggles
 * and generates targeted drills to address specific phonetic challenges.
 * 
 * Philosophy: Identify patterns in pronunciation struggles, then provide
 * focused, repetitive practice to build muscle memory and confidence.
 */

import { GoogleGenAI } from '@google/genai';
import { db } from '../db';
import { recurringStruggles, hiveSnapshots } from '@shared/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { z } from 'zod';

export const startSessionSchema = z.object({
  language: z.string().min(1, "Language is required"),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional().default('intermediate'),
  phonemes: z.array(z.string()).optional(),
});

export const submitResponseSchema = z.object({
  transcribedSpeech: z.string().optional().default(''),
  pronunciationScore: z.number().min(0).max(100),
});

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface PhonemeChallenge {
  phoneme: string;
  description: string;
  examples: string[];
  difficultyScore: number;
  occurrenceCount: number;
}

export interface PronunciationDrillItem {
  id: string;
  phrase: string;
  targetPhoneme: string;
  phoneticGuide: string;
  slowSpeed: string;
  normalSpeed: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tips: string[];
}

export interface PronunciationDrillSession {
  sessionId: string;
  studentId: string;
  language: string;
  targetPhonemes: string[];
  drillItems: PronunciationDrillItem[];
  totalItems: number;
  currentIndex: number;
  correctCount: number;
  incorrectCount: number;
  startedAt: Date;
  focusAreas: PhonemeChallenge[];
}

const activeDrillSessions = new Map<string, PronunciationDrillSession>();

const LANGUAGE_PHONEME_CHALLENGES: Record<string, PhonemeChallenge[]> = {
  spanish: [
    { phoneme: 'rr', description: 'Rolled R (alveolar trill)', examples: ['perro', 'carro', 'correr'], difficultyScore: 8, occurrenceCount: 0 },
    { phoneme: 'r', description: 'Single R tap', examples: ['pero', 'caro', 'para'], difficultyScore: 6, occurrenceCount: 0 },
    { phoneme: 'ñ', description: 'Palatal nasal (ny sound)', examples: ['año', 'niño', 'mañana'], difficultyScore: 5, occurrenceCount: 0 },
    { phoneme: 'll/y', description: 'Lateral or fricative (varies by region)', examples: ['llave', 'pollo', 'calle'], difficultyScore: 4, occurrenceCount: 0 },
    { phoneme: 'j/g', description: 'Velar fricative (harsh h)', examples: ['joven', 'general', 'rojo'], difficultyScore: 5, occurrenceCount: 0 },
    { phoneme: 'b/v', description: 'B/V distinction (often same sound)', examples: ['beber', 'vivir', 'vaca'], difficultyScore: 4, occurrenceCount: 0 },
    { phoneme: 'd', description: 'Soft D between vowels', examples: ['lado', 'todo', 'nada'], difficultyScore: 4, occurrenceCount: 0 },
    { phoneme: 'z/c', description: 'Theta sound (Spain) or S (Latin America)', examples: ['zapato', 'cinco', 'plaza'], difficultyScore: 3, occurrenceCount: 0 },
  ],
  french: [
    { phoneme: 'r', description: 'Uvular R (back of throat)', examples: ['rouge', 'Paris', 'merci'], difficultyScore: 9, occurrenceCount: 0 },
    { phoneme: 'u/ou', description: 'Rounded front vowel distinction', examples: ['tu/tout', 'vu/vous', 'su/sous'], difficultyScore: 8, occurrenceCount: 0 },
    { phoneme: 'nasal vowels', description: 'Nasal vowel sounds (on, an, in)', examples: ['bon', 'dans', 'vin'], difficultyScore: 7, occurrenceCount: 0 },
    { phoneme: 'silent letters', description: 'Final consonant liaison', examples: ['petit', 'grand', 'vous'], difficultyScore: 6, occurrenceCount: 0 },
    { phoneme: 'eu', description: 'Rounded front mid vowel', examples: ['deux', 'bleu', 'peu'], difficultyScore: 6, occurrenceCount: 0 },
  ],
  german: [
    { phoneme: 'ch', description: 'Ich-laut vs Ach-laut', examples: ['ich', 'mich', 'acht', 'noch'], difficultyScore: 7, occurrenceCount: 0 },
    { phoneme: 'ü', description: 'Rounded front high vowel', examples: ['für', 'über', 'müssen'], difficultyScore: 7, occurrenceCount: 0 },
    { phoneme: 'ö', description: 'Rounded front mid vowel', examples: ['schön', 'möchten', 'können'], difficultyScore: 7, occurrenceCount: 0 },
    { phoneme: 'r', description: 'Uvular R', examples: ['rot', 'richtig', 'sprechen'], difficultyScore: 6, occurrenceCount: 0 },
    { phoneme: 'final consonant devoicing', description: 'B/D/G become P/T/K at end', examples: ['Tag', 'und', 'ab'], difficultyScore: 5, occurrenceCount: 0 },
  ],
  mandarin: [
    { phoneme: 'tones', description: 'Four tones with different meanings', examples: ['mā/má/mǎ/mà', 'shī/shí/shǐ/shì'], difficultyScore: 10, occurrenceCount: 0 },
    { phoneme: 'x', description: 'Alveolo-palatal fricative', examples: ['xie', 'xiao', 'xiang'], difficultyScore: 8, occurrenceCount: 0 },
    { phoneme: 'q', description: 'Alveolo-palatal affricate', examples: ['qi', 'qing', 'qian'], difficultyScore: 8, occurrenceCount: 0 },
    { phoneme: 'zh/ch/sh/r', description: 'Retroflex sounds', examples: ['zhong', 'chi', 'shi', 'ri'], difficultyScore: 8, occurrenceCount: 0 },
    { phoneme: 'ü', description: 'Rounded front vowel', examples: ['nü', 'lü', 'yue'], difficultyScore: 7, occurrenceCount: 0 },
  ],
  japanese: [
    { phoneme: 'r/l', description: 'Japanese flap (between R and L)', examples: ['ramen', 'arigato', 'roku'], difficultyScore: 6, occurrenceCount: 0 },
    { phoneme: 'long vowels', description: 'Vowel length distinction', examples: ['obasan/obaasan', 'koko/kooko'], difficultyScore: 7, occurrenceCount: 0 },
    { phoneme: 'double consonants', description: 'Geminate consonants', examples: ['kitte', 'gakko', 'nippon'], difficultyScore: 6, occurrenceCount: 0 },
    { phoneme: 'pitch accent', description: 'Word accent patterns', examples: ['hashi (chopsticks/bridge)', 'ame (rain/candy)'], difficultyScore: 8, occurrenceCount: 0 },
  ],
  korean: [
    { phoneme: 'ㅓ/ㅗ', description: 'Open-mid back vowel distinction', examples: ['어/오', '서울/소울'], difficultyScore: 7, occurrenceCount: 0 },
    { phoneme: 'aspirated/tense', description: 'Three-way consonant distinction', examples: ['가/까/카', '다/따/타'], difficultyScore: 9, occurrenceCount: 0 },
    { phoneme: 'final consonants', description: 'Unreleased finals (받침)', examples: ['밥', '꽃', '앞'], difficultyScore: 7, occurrenceCount: 0 },
  ],
  italian: [
    { phoneme: 'double consonants', description: 'Geminate distinction', examples: ['pala/palla', 'caro/carro', 'fato/fatto'], difficultyScore: 6, occurrenceCount: 0 },
    { phoneme: 'gli', description: 'Palatal lateral', examples: ['famiglia', 'figlio', 'gli'], difficultyScore: 6, occurrenceCount: 0 },
    { phoneme: 'gn', description: 'Palatal nasal', examples: ['gnocchi', 'montagna', 'ogni'], difficultyScore: 5, occurrenceCount: 0 },
    { phoneme: 'r', description: 'Trilled R', examples: ['Roma', 'carro', 'perro'], difficultyScore: 7, occurrenceCount: 0 },
  ],
  portuguese: [
    { phoneme: 'nasal vowels', description: 'Nasalized vowel sounds', examples: ['são', 'bem', 'fim'], difficultyScore: 7, occurrenceCount: 0 },
    { phoneme: 'lh/nh', description: 'Palatal sounds', examples: ['filho', 'banho', 'trabalho'], difficultyScore: 5, occurrenceCount: 0 },
    { phoneme: 'r/rr', description: 'R sound variations', examples: ['caro/carro', 'rio', 'porta'], difficultyScore: 6, occurrenceCount: 0 },
    { phoneme: 'open/closed vowels', description: 'Vowel quality distinction', examples: ['avô/avó', 'e/é'], difficultyScore: 6, occurrenceCount: 0 },
  ],
  arabic: [
    { phoneme: 'ع', description: 'Voiced pharyngeal fricative (ayn)', examples: ['عربي', 'علم', 'سعيد'], difficultyScore: 10, occurrenceCount: 0 },
    { phoneme: 'ح', description: 'Voiceless pharyngeal fricative', examples: ['حب', 'صباح', 'حمد'], difficultyScore: 9, occurrenceCount: 0 },
    { phoneme: 'خ', description: 'Voiceless uvular fricative', examples: ['خير', 'أخ', 'بخير'], difficultyScore: 7, occurrenceCount: 0 },
    { phoneme: 'ق', description: 'Voiceless uvular stop', examples: ['قلب', 'قال', 'وقت'], difficultyScore: 8, occurrenceCount: 0 },
    { phoneme: 'emphatic consonants', description: 'Pharyngealized sounds (ص, ض, ط, ظ)', examples: ['صباح', 'ضرب', 'طبيعي'], difficultyScore: 8, occurrenceCount: 0 },
  ],
};

export class PronunciationDrillService {
  /**
   * Get student's pronunciation struggle patterns from learning service
   */
  async getStudentPronunciationStruggles(studentId: string, language: string): Promise<PhonemeChallenge[]> {
    const struggles = await db
      .select()
      .from(recurringStruggles)
      .where(and(
        eq(recurringStruggles.studentId, studentId),
        eq(recurringStruggles.language, language),
        eq(recurringStruggles.struggleArea, 'pronunciation'),
        isNull(recurringStruggles.resolvedAt)
      ))
      .orderBy(desc(recurringStruggles.occurrenceCount))
      .limit(10);

    if (struggles.length === 0) {
      return LANGUAGE_PHONEME_CHALLENGES[language] || [];
    }

    const challenges: PhonemeChallenge[] = struggles.map(s => ({
      phoneme: s.specificExamples || s.struggleArea,
      description: s.description || 'Pronunciation challenge',
      examples: [],
      difficultyScore: Math.min(10, Math.floor((s.occurrenceCount || 1) / 2) + 3),
      occurrenceCount: s.occurrenceCount || 0,
    }));

    return challenges;
  }

  /**
   * Generate drill items targeting specific phonemes
   */
  async generateDrillItems(
    language: string,
    targetPhonemes: string[],
    difficulty: 'beginner' | 'intermediate' | 'advanced',
    count: number = 10
  ): Promise<PronunciationDrillItem[]> {
    const phonemeList = targetPhonemes.join(', ');
    
    const prompt = `Generate ${count} pronunciation practice phrases for a ${difficulty} level student learning ${language}.

Focus on these challenging sounds/phonemes: ${phonemeList}

For each phrase, provide:
1. A natural phrase that contains the target sound
2. The specific phoneme being practiced
3. A phonetic guide (IPA or simplified)
4. Tips for pronunciation

Return as JSON array:
[
  {
    "phrase": "natural phrase in target language",
    "targetPhoneme": "the sound being practiced",
    "phoneticGuide": "simplified pronunciation guide",
    "slowSpeed": "phrase broken into syllables",
    "normalSpeed": "the phrase as spoken naturally",
    "difficulty": "easy|medium|hard",
    "tips": ["tip 1", "tip 2"]
  }
]

Guidelines:
- Start with easier phrases and gradually increase difficulty
- Include common, practical vocabulary
- Vary sentence patterns
- For ${difficulty} level, adjust complexity accordingly
- Make phrases memorable and contextually useful`;

    try {
      const result = await gemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
        },
      });

      const items = JSON.parse(result.text || '[]');
      
      return items.map((item: any, index: number) => ({
        id: `drill-${Date.now()}-${index}`,
        phrase: item.phrase || '',
        targetPhoneme: item.targetPhoneme || targetPhonemes[0] || '',
        phoneticGuide: item.phoneticGuide || '',
        slowSpeed: item.slowSpeed || item.phrase || '',
        normalSpeed: item.normalSpeed || item.phrase || '',
        difficulty: item.difficulty || 'medium',
        tips: item.tips || [],
      }));
    } catch (error: any) {
      console.error('[PronunciationDrill] Error generating drills:', error.message);
      return this.getFallbackDrillItems(language, targetPhonemes, count);
    }
  }

  /**
   * Start a new pronunciation drill session
   */
  async startSession(
    studentId: string,
    language: string,
    difficulty: 'beginner' | 'intermediate' | 'advanced',
    specificPhonemes?: string[]
  ): Promise<PronunciationDrillSession> {
    const sessionId = `pron-drill-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    let targetPhonemes: string[];
    let focusAreas: PhonemeChallenge[];
    
    if (specificPhonemes && specificPhonemes.length > 0) {
      targetPhonemes = specificPhonemes;
      focusAreas = specificPhonemes.map(p => ({
        phoneme: p,
        description: 'Selected for practice',
        examples: [],
        difficultyScore: 5,
        occurrenceCount: 0,
      }));
    } else {
      focusAreas = await this.getStudentPronunciationStruggles(studentId, language);
      targetPhonemes = focusAreas.slice(0, 3).map(f => f.phoneme);
      
      if (targetPhonemes.length === 0) {
        const langChallenges = LANGUAGE_PHONEME_CHALLENGES[language] || [];
        targetPhonemes = langChallenges.slice(0, 3).map(c => c.phoneme);
        focusAreas = langChallenges.slice(0, 3);
      }
    }
    
    const drillItems = await this.generateDrillItems(language, targetPhonemes, difficulty, 10);
    
    const session: PronunciationDrillSession = {
      sessionId,
      studentId,
      language,
      targetPhonemes,
      drillItems,
      totalItems: drillItems.length,
      currentIndex: 0,
      correctCount: 0,
      incorrectCount: 0,
      startedAt: new Date(),
      focusAreas,
    };
    
    activeDrillSessions.set(sessionId, session);
    
    console.log(`[PronunciationDrill] Started session ${sessionId} for ${studentId}`);
    console.log(`[PronunciationDrill] Focus: ${targetPhonemes.join(', ')}`);
    
    return session;
  }

  /**
   * Get current drill item for a session
   */
  getCurrentItem(sessionId: string): PronunciationDrillItem | null {
    const session = activeDrillSessions.get(sessionId);
    if (!session || session.currentIndex >= session.drillItems.length) {
      return null;
    }
    return session.drillItems[session.currentIndex];
  }

  /**
   * Submit response and evaluate pronunciation
   */
  async submitResponse(
    sessionId: string,
    transcribedSpeech: string,
    pronunciationScore: number
  ): Promise<{
    isCorrect: boolean;
    score: number;
    feedback: string;
    issues: string[];
    strengths: string[];
    nextItem: PronunciationDrillItem | null;
    sessionComplete: boolean;
    sessionSummary?: SessionSummary;
  }> {
    const session = activeDrillSessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    const currentItem = session.drillItems[session.currentIndex];
    const isCorrect = pronunciationScore >= 70;
    
    if (isCorrect) {
      session.correctCount++;
    } else {
      session.incorrectCount++;
    }
    
    session.currentIndex++;
    
    const feedback = this.generateFeedback(currentItem, transcribedSpeech, pronunciationScore, isCorrect);
    
    const sessionComplete = session.currentIndex >= session.drillItems.length;
    
    let sessionSummary: SessionSummary | undefined;
    if (sessionComplete) {
      sessionSummary = this.generateSessionSummary(session);
      await this.recordSessionResults(session);
    }
    
    return {
      isCorrect,
      score: pronunciationScore,
      feedback: feedback.message,
      issues: feedback.issues,
      strengths: feedback.strengths,
      nextItem: sessionComplete ? null : session.drillItems[session.currentIndex],
      sessionComplete,
      sessionSummary,
    };
  }

  /**
   * Get session status
   */
  getSession(sessionId: string): PronunciationDrillSession | null {
    return activeDrillSessions.get(sessionId) || null;
  }

  /**
   * Get all common phoneme challenges for a language
   */
  getLanguagePhonemes(language: string): PhonemeChallenge[] {
    return LANGUAGE_PHONEME_CHALLENGES[language] || [];
  }

  /**
   * End session early
   */
  async endSession(sessionId: string): Promise<SessionSummary | null> {
    const session = activeDrillSessions.get(sessionId);
    if (!session) {
      return null;
    }
    
    const summary = this.generateSessionSummary(session);
    await this.recordSessionResults(session);
    activeDrillSessions.delete(sessionId);
    
    return summary;
  }

  private generateFeedback(
    item: PronunciationDrillItem,
    transcribed: string,
    score: number,
    isCorrect: boolean
  ): { message: string; issues: string[]; strengths: string[] } {
    const issues: string[] = [];
    const strengths: string[] = [];
    
    if (score >= 90) {
      strengths.push('Excellent pronunciation!');
      strengths.push(`Great job with the ${item.targetPhoneme} sound`);
    } else if (score >= 80) {
      strengths.push('Good pronunciation');
      issues.push(`Minor refinement needed on ${item.targetPhoneme}`);
    } else if (score >= 70) {
      strengths.push('Decent attempt');
      issues.push(`Focus on ${item.targetPhoneme} placement`);
      issues.push('Try speaking more slowly');
    } else if (score >= 50) {
      issues.push(`The ${item.targetPhoneme} sound needs work`);
      issues.push('Listen to the model and try again');
      if (item.tips.length > 0) {
        issues.push(`Tip: ${item.tips[0]}`);
      }
    } else {
      issues.push('Pronunciation needs improvement');
      issues.push(`Practice the ${item.targetPhoneme} sound in isolation first`);
    }
    
    const messages = {
      excellent: 'Perfect! Your pronunciation is excellent.',
      good: 'Good job! Just a little more practice needed.',
      fair: 'Not bad! Keep practicing this sound.',
      needsWork: 'Keep trying! This is a challenging sound.',
    };
    
    const message = score >= 90 ? messages.excellent :
                    score >= 80 ? messages.good :
                    score >= 60 ? messages.fair :
                    messages.needsWork;
    
    return { message, issues, strengths };
  }

  private generateSessionSummary(session: PronunciationDrillSession): SessionSummary {
    const accuracy = session.totalItems > 0 
      ? Math.round((session.correctCount / (session.correctCount + session.incorrectCount)) * 100)
      : 0;
    
    const duration = Math.round((Date.now() - session.startedAt.getTime()) / 1000);
    
    return {
      sessionId: session.sessionId,
      totalItems: session.currentIndex,
      correctCount: session.correctCount,
      incorrectCount: session.incorrectCount,
      accuracy,
      durationSeconds: duration,
      targetPhonemes: session.targetPhonemes,
      recommendation: accuracy >= 80 
        ? 'Great progress! Try more advanced phrases next time.'
        : accuracy >= 60 
        ? 'Good effort! Continue practicing these sounds daily.'
        : 'Keep practicing! Consider more repetition drills.',
    };
  }

  private async recordSessionResults(session: PronunciationDrillSession): Promise<void> {
    try {
      const accuracy = (session.correctCount / Math.max(1, session.correctCount + session.incorrectCount)) * 100;
      const duration = Math.round((Date.now() - session.startedAt.getTime()) / 1000);
      
      console.log(`[PronunciationDrill] Session ${session.sessionId} completed:`);
      console.log(`  - Student: ${session.studentId}`);
      console.log(`  - Language: ${session.language}`);
      console.log(`  - Target phonemes: ${session.targetPhonemes.join(', ')}`);
      console.log(`  - Items completed: ${session.currentIndex}/${session.totalItems}`);
      console.log(`  - Accuracy: ${Math.round(accuracy)}% (${session.correctCount} correct, ${session.incorrectCount} incorrect)`);
      console.log(`  - Duration: ${duration}s`);
      
      await db.insert(hiveSnapshots).values({
        snapshotType: 'teaching_moment',
        userId: session.studentId,
        language: session.language,
        title: `Pronunciation Drill: ${session.targetPhonemes.join(', ')}`,
        content: JSON.stringify({
          type: 'pronunciation_drill_session',
          sessionId: session.sessionId,
          targetPhonemes: session.targetPhonemes,
          itemsCompleted: session.currentIndex,
          totalItems: session.totalItems,
          correctCount: session.correctCount,
          incorrectCount: session.incorrectCount,
          accuracy: Math.round(accuracy),
          durationSeconds: duration,
          focusAreas: session.focusAreas.map(f => f.phoneme),
        }),
        context: `Student completed pronunciation drill with ${Math.round(accuracy)}% accuracy on ${session.targetPhonemes.join(', ')}`,
        importance: accuracy >= 80 ? 8 : accuracy >= 60 ? 5 : 3,
        metadata: { tags: ['pronunciation', 'drill', ...session.targetPhonemes] },
      });
      
      console.log(`[PronunciationDrill] Session results persisted to hiveSnapshots`);
      
    } catch (error: any) {
      console.error('[PronunciationDrill] Error recording results:', error.message);
    }
  }

  private getFallbackDrillItems(
    language: string,
    targetPhonemes: string[],
    count: number
  ): PronunciationDrillItem[] {
    const items: PronunciationDrillItem[] = [];
    const challenges = LANGUAGE_PHONEME_CHALLENGES[language] || [];
    
    for (let i = 0; i < count && i < challenges.length; i++) {
      const challenge = challenges[i % challenges.length];
      items.push({
        id: `fallback-${i}`,
        phrase: challenge.examples[0] || challenge.phoneme,
        targetPhoneme: challenge.phoneme,
        phoneticGuide: challenge.description,
        slowSpeed: challenge.examples[0] || challenge.phoneme,
        normalSpeed: challenge.examples[0] || challenge.phoneme,
        difficulty: challenge.difficultyScore > 7 ? 'hard' : challenge.difficultyScore > 4 ? 'medium' : 'easy',
        tips: [`Focus on: ${challenge.description}`],
      });
    }
    
    return items;
  }
}

export interface SessionSummary {
  sessionId: string;
  totalItems: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  durationSeconds: number;
  targetPhonemes: string[];
  recommendation: string;
}

export const pronunciationDrillService = new PronunciationDrillService();
