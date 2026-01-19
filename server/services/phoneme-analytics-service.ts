import { db, getUserDb } from '../db';
import { phonemeStruggles, type InsertPhonemeStruggle, type PhonemeStruggle } from '@shared/schema';
import { eq, and, inArray, desc, sql } from 'drizzle-orm';

interface WordAnalysis {
  word: string;
  confidence: number;
  start?: number;
  end?: number;
}

interface PhonemeMapping {
  phoneme: string;
  category: string;
  displayLabel: string;
  patterns: RegExp[];
}

const PHONEME_MAPPINGS: Record<string, PhonemeMapping[]> = {
  spanish: [
    { phoneme: 'r', category: 'consonant', displayLabel: 'Rolling R (RR)', patterns: [/rr/i, /^r/i] },
    { phoneme: 'ɲ', category: 'consonant', displayLabel: 'Ñ Sound', patterns: [/ñ/i, /ny/i] },
    { phoneme: 'x', category: 'fricative', displayLabel: 'J/G Sound', patterns: [/j/i, /ge/i, /gi/i] },
    { phoneme: 'θ', category: 'fricative', displayLabel: 'Spanish Z/C', patterns: [/z/i, /ce/i, /ci/i] },
    { phoneme: 'll', category: 'consonant', displayLabel: 'LL/Y Sound', patterns: [/ll/i, /y[aeiou]/i] },
    { phoneme: 'b/v', category: 'consonant', displayLabel: 'B/V Distinction', patterns: [/b/i, /v/i] },
    { phoneme: 'd', category: 'consonant', displayLabel: 'Soft D', patterns: [/d[aeiou]/i] },
  ],
  french: [
    { phoneme: 'ʁ', category: 'consonant', displayLabel: 'French R', patterns: [/r/i] },
    { phoneme: 'y', category: 'vowel', displayLabel: 'U Sound (ü)', patterns: [/u/i] },
    { phoneme: 'ø', category: 'vowel', displayLabel: 'EU Sound', patterns: [/eu/i, /œu/i] },
    { phoneme: 'ã', category: 'nasal', displayLabel: 'Nasal AN/EN', patterns: [/an/i, /en/i, /am/i, /em/i] },
    { phoneme: 'ɛ̃', category: 'nasal', displayLabel: 'Nasal IN', patterns: [/in/i, /im/i, /ain/i, /ein/i] },
    { phoneme: 'ɔ̃', category: 'nasal', displayLabel: 'Nasal ON', patterns: [/on/i, /om/i] },
    { phoneme: 'œ̃', category: 'nasal', displayLabel: 'Nasal UN', patterns: [/un/i, /um/i] },
  ],
  german: [
    { phoneme: 'ç', category: 'fricative', displayLabel: 'CH Sound (ich)', patterns: [/ch/i] },
    { phoneme: 'x', category: 'fricative', displayLabel: 'CH Sound (ach)', patterns: [/ach/i, /och/i, /uch/i] },
    { phoneme: 'ʏ', category: 'vowel', displayLabel: 'Ü Sound', patterns: [/ü/i, /ue/i] },
    { phoneme: 'ø', category: 'vowel', displayLabel: 'Ö Sound', patterns: [/ö/i, /oe/i] },
    { phoneme: 'ʃ', category: 'fricative', displayLabel: 'SCH Sound', patterns: [/sch/i] },
    { phoneme: 'ts', category: 'consonant', displayLabel: 'Z Sound', patterns: [/z/i, /tz/i] },
    { phoneme: 'pf', category: 'consonant', displayLabel: 'PF Sound', patterns: [/pf/i] },
  ],
  italian: [
    { phoneme: 'ʎ', category: 'consonant', displayLabel: 'GL Sound', patterns: [/gl[i]/i] },
    { phoneme: 'ɲ', category: 'consonant', displayLabel: 'GN Sound', patterns: [/gn/i] },
    { phoneme: 'r', category: 'consonant', displayLabel: 'Rolled R', patterns: [/rr/i, /^r/i] },
    { phoneme: 'dʒ', category: 'consonant', displayLabel: 'G Sound (soft)', patterns: [/ge/i, /gi/i] },
    { phoneme: 'tʃ', category: 'consonant', displayLabel: 'C Sound (soft)', patterns: [/ce/i, /ci/i] },
  ],
  portuguese: [
    { phoneme: 'ʁ', category: 'consonant', displayLabel: 'Portuguese R', patterns: [/rr/i, /^r/i] },
    { phoneme: 'ɲ', category: 'consonant', displayLabel: 'NH Sound', patterns: [/nh/i] },
    { phoneme: 'ʎ', category: 'consonant', displayLabel: 'LH Sound', patterns: [/lh/i] },
    { phoneme: 'ã', category: 'nasal', displayLabel: 'Nasal Ã', patterns: [/ã/i, /an/i, /am/i] },
    { phoneme: 'õ', category: 'nasal', displayLabel: 'Nasal Õ', patterns: [/õ/i, /on/i, /om/i] },
  ],
  japanese: [
    { phoneme: 'ɾ', category: 'consonant', displayLabel: 'R/L Sound', patterns: [/r/i, /l/i] },
    { phoneme: 'ts', category: 'consonant', displayLabel: 'TSU Sound', patterns: [/tsu/i] },
    { phoneme: 'ɯ', category: 'vowel', displayLabel: 'U Sound', patterns: [/u/i] },
    { phoneme: 'N', category: 'nasal', displayLabel: 'Final N (ん)', patterns: [/n$/i] },
  ],
  mandarin: [
    { phoneme: 'ʂ', category: 'fricative', displayLabel: 'SH Sound', patterns: [/sh/i] },
    { phoneme: 'ʐ', category: 'fricative', displayLabel: 'R Sound (初)', patterns: [/r/i] },
    { phoneme: 'tɕ', category: 'consonant', displayLabel: 'J Sound', patterns: [/j/i] },
    { phoneme: 'tɕʰ', category: 'consonant', displayLabel: 'Q Sound', patterns: [/q/i] },
    { phoneme: 'ɕ', category: 'fricative', displayLabel: 'X Sound', patterns: [/x/i] },
    { phoneme: 'ü', category: 'vowel', displayLabel: 'Ü Sound', patterns: [/ü/i, /yu/i] },
  ],
  korean: [
    { phoneme: 'ɾ/l', category: 'consonant', displayLabel: 'ㄹ Sound', patterns: [/r/i, /l/i] },
    { phoneme: 'p͈', category: 'consonant', displayLabel: 'ㅃ Sound (tense)', patterns: [/pp/i, /bb/i] },
    { phoneme: 't͈', category: 'consonant', displayLabel: 'ㄸ Sound (tense)', patterns: [/tt/i, /dd/i] },
    { phoneme: 'k͈', category: 'consonant', displayLabel: 'ㄲ Sound (tense)', patterns: [/kk/i, /gg/i] },
  ],
  english: [
    { phoneme: 'θ', category: 'fricative', displayLabel: 'TH Sound (thin)', patterns: [/th/i] },
    { phoneme: 'ð', category: 'fricative', displayLabel: 'TH Sound (this)', patterns: [/th/i] },
    { phoneme: 'ɹ', category: 'consonant', displayLabel: 'R Sound', patterns: [/r/i] },
    { phoneme: 'æ', category: 'vowel', displayLabel: 'Short A (cat)', patterns: [/a/i] },
    { phoneme: 'ŋ', category: 'nasal', displayLabel: 'NG Sound', patterns: [/ng/i, /nk/i] },
  ],
};

const CONFIDENCE_THRESHOLDS = {
  SEVERE: 0.70,     // Below this = severe difficulty
  MODERATE: 0.85,   // Below this = moderate difficulty
  MILD: 0.95,       // Below this = mild difficulty
};

export class PhonemeAnalyticsService {
  private detectPhonemesInWord(word: string, language: string): PhonemeMapping[] {
    const mappings = PHONEME_MAPPINGS[language] || PHONEME_MAPPINGS['english'] || [];
    const detectedPhonemes: PhonemeMapping[] = [];
    
    for (const mapping of mappings) {
      for (const pattern of mapping.patterns) {
        if (pattern.test(word)) {
          detectedPhonemes.push(mapping);
          break;
        }
      }
    }
    
    return detectedPhonemes;
  }

  private calculateSeverity(confidence: number): 'severe' | 'moderate' | 'mild' {
    if (confidence < CONFIDENCE_THRESHOLDS.SEVERE) return 'severe';
    if (confidence < CONFIDENCE_THRESHOLDS.MODERATE) return 'moderate';
    return 'mild';
  }

  async analyzeAndStorePhonemes(
    studentId: string,
    language: string,
    wordAnalyses: WordAnalysis[],
    sessionId?: string
  ): Promise<PhonemeStruggle[]> {
    const phonemeData: Map<string, {
      mapping: PhonemeMapping;
      confidences: number[];
      words: string[];
    }> = new Map();

    for (const analysis of wordAnalyses) {
      if (analysis.confidence >= CONFIDENCE_THRESHOLDS.MILD) continue;

      const detectedPhonemes = this.detectPhonemesInWord(analysis.word, language);
      
      for (const mapping of detectedPhonemes) {
        const existing = phonemeData.get(mapping.phoneme);
        if (existing) {
          existing.confidences.push(analysis.confidence);
          if (!existing.words.includes(analysis.word)) {
            existing.words.push(analysis.word);
          }
        } else {
          phonemeData.set(mapping.phoneme, {
            mapping,
            confidences: [analysis.confidence],
            words: [analysis.word],
          });
        }
      }
    }

    const results: PhonemeStruggle[] = [];

    for (const [phoneme, data] of Array.from(phonemeData.entries())) {
      const avgConfidence = data.confidences.reduce((a: number, b: number) => a + b, 0) / data.confidences.length;
      const minConfidence = Math.min(...data.confidences);
      const maxConfidence = Math.max(...data.confidences);
      const severity = this.calculateSeverity(avgConfidence);

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
        const totalCount = (record.occurrenceCount || 0) + data.confidences.length;
        const newAvgConfidence = ((record.averageConfidence || 0.5) * (record.occurrenceCount || 1) + avgConfidence * data.confidences.length) / totalCount;
        
        const existingWords = record.exampleWords || [];
        const mergedWords = Array.from(new Set([...existingWords, ...data.words])).slice(0, 10);
        
        const existingSessions = record.sessionIds || [];
        const mergedSessions = sessionId 
          ? Array.from(new Set([...existingSessions, sessionId])).slice(-20)
          : existingSessions;

        const [updated] = await getUserDb().update(phonemeStruggles)
          .set({
            averageConfidence: newAvgConfidence,
            lowestConfidence: Math.min(record.lowestConfidence || 1, minConfidence),
            highestConfidence: Math.max(record.highestConfidence || 0, maxConfidence),
            severity: this.calculateSeverity(newAvgConfidence),
            occurrenceCount: totalCount,
            lastOccurredAt: new Date(),
            exampleWords: mergedWords,
            sessionIds: mergedSessions,
            status: newAvgConfidence >= CONFIDENCE_THRESHOLDS.MILD ? 'improving' : 'active',
            updatedAt: new Date(),
          })
          .where(eq(phonemeStruggles.id, record.id))
          .returning();
        
        if (updated) results.push(updated);
      } else {
        const insertData: InsertPhonemeStruggle = {
          studentId,
          language,
          phoneme,
          phonemeCategory: data.mapping.category,
          displayLabel: data.mapping.displayLabel,
          averageConfidence: avgConfidence,
          lowestConfidence: minConfidence,
          highestConfidence: maxConfidence,
          severity,
          occurrenceCount: data.confidences.length,
          exampleWords: data.words.slice(0, 10),
          sessionIds: sessionId ? [sessionId] : [],
          status: 'active',
        };

        const [inserted] = await getUserDb().insert(phonemeStruggles)
          .values(insertData)
          .returning();
        
        if (inserted) results.push(inserted);
      }
    }

    return results;
  }

  async getStudentPhonemeStruggles(
    studentId: string,
    language?: string,
    status?: 'active' | 'improving' | 'mastered'
  ): Promise<PhonemeStruggle[]> {
    const conditions = [eq(phonemeStruggles.studentId, studentId)];
    
    if (language) {
      conditions.push(eq(phonemeStruggles.language, language));
    }
    
    if (status) {
      conditions.push(eq(phonemeStruggles.status, status));
    }

    return getUserDb().select()
      .from(phonemeStruggles)
      .where(and(...conditions))
      .orderBy(desc(phonemeStruggles.occurrenceCount));
  }

  async getClassPhonemePatterns(
    studentIds: string[],
    language: string
  ): Promise<{
    phoneme: string;
    displayLabel: string;
    category: string;
    studentCount: number;
    totalOccurrences: number;
    averageConfidence: number;
    severity: string;
    prevalencePercent: number;
    severityCounts: { severe: number; moderate: number; mild: number };
  }[]> {
    if (studentIds.length === 0) return [];

    const struggles = await getUserDb().select()
      .from(phonemeStruggles)
      .where(and(
        inArray(phonemeStruggles.studentId, studentIds),
        eq(phonemeStruggles.language, language),
        eq(phonemeStruggles.status, 'active')
      ));

    const patternMap = new Map<string, {
      phoneme: string;
      displayLabel: string;
      category: string;
      studentIds: Set<string>;
      totalOccurrences: number;
      confidenceSum: number;
      severityCounts: { severe: number; moderate: number; mild: number };
    }>();

    for (const struggle of struggles) {
      const existing = patternMap.get(struggle.phoneme);
      const severityKey = (struggle.severity || 'moderate') as 'severe' | 'moderate' | 'mild';
      
      if (existing) {
        existing.studentIds.add(struggle.studentId);
        existing.totalOccurrences += struggle.occurrenceCount || 1;
        existing.confidenceSum += (struggle.averageConfidence || 0.5) * (struggle.occurrenceCount || 1);
        existing.severityCounts[severityKey]++;
      } else {
        patternMap.set(struggle.phoneme, {
          phoneme: struggle.phoneme,
          displayLabel: struggle.displayLabel || struggle.phoneme,
          category: struggle.phonemeCategory || 'unknown',
          studentIds: new Set([struggle.studentId]),
          totalOccurrences: struggle.occurrenceCount || 1,
          confidenceSum: (struggle.averageConfidence || 0.5) * (struggle.occurrenceCount || 1),
          severityCounts: {
            severe: severityKey === 'severe' ? 1 : 0,
            moderate: severityKey === 'moderate' ? 1 : 0,
            mild: severityKey === 'mild' ? 1 : 0,
          },
        });
      }
    }

    return Array.from(patternMap.values())
      .map(p => ({
        phoneme: p.phoneme,
        displayLabel: p.displayLabel,
        category: p.category,
        studentCount: p.studentIds.size,
        totalOccurrences: p.totalOccurrences,
        averageConfidence: p.totalOccurrences > 0 ? p.confidenceSum / p.totalOccurrences : 0.5,
        severity: this.calculateSeverity(p.totalOccurrences > 0 ? p.confidenceSum / p.totalOccurrences : 0.5),
        prevalencePercent: Math.round((p.studentIds.size / studentIds.length) * 100),
        severityCounts: p.severityCounts,
      }))
      .sort((a, b) => b.studentCount - a.studentCount);
  }

  async markPhonemeMastered(
    studentId: string,
    language: string,
    phoneme: string
  ): Promise<PhonemeStruggle | null> {
    const [updated] = await getUserDb().update(phonemeStruggles)
      .set({
        status: 'mastered',
        masteredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(phonemeStruggles.studentId, studentId),
        eq(phonemeStruggles.language, language),
        eq(phonemeStruggles.phoneme, phoneme)
      ))
      .returning();

    return updated || null;
  }
}

export const phonemeAnalyticsService = new PhonemeAnalyticsService();
