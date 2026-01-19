import { callGeminiWithSchema, GEMINI_MODELS } from "../gemini-utils";
import { db, getSharedDb, getUserDb } from "../db";
import { 
  curriculumLessons, 
  vocabularyWords, 
  conversationTopics, 
  topics,
  syllabusProgress,
  conversations,
  messages as messagesTable,
  pronunciationScores
} from "@shared/schema";
import { eq, and, inArray, avg, gte } from "drizzle-orm";

interface CompetencyCheckResult {
  lessonId: string;
  covered: boolean;
  coveragePercent: number;
  topicCoverage: {
    required: string[];
    covered: string[];
    missing: string[];
    percent: number;
  };
  vocabularyCoverage: {
    required: string[];
    mastered: string[];
    missing: string[];
    percent: number;
  };
  grammarCoverage: {
    required: string[];
    demonstrated: string[];
    missing: string[];
    percent: number;
  };
  pronunciationScore: number | null;
  pronunciationRequired: number;
  pronunciationPassed: boolean;
  evidenceConversationIds: string[];
  recommendation: 'complete_early' | 'partial_progress' | 'needs_work';
}

interface VocabularyExtractionResult {
  extractedWords: string[];
  grammarConcepts: string[];
}

const VOCABULARY_EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    extractedWords: {
      type: "array",
      description: "All vocabulary words the student correctly used or demonstrated understanding of",
      items: { type: "string" },
    },
    grammarConcepts: {
      type: "array",
      description: "Grammar concepts the student correctly demonstrated (e.g., 'past_tense', 'subjunctive', 'conditional')",
      items: { type: "string" },
    },
  },
  required: ["extractedWords", "grammarConcepts"],
};

export async function extractVocabularyFromConversation(
  messageHistory: Array<{ role: string; content: string }>,
  targetLanguage: string
): Promise<VocabularyExtractionResult> {
  const userMessages = messageHistory
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join('\n');

  const prompt = `Analyze these student utterances in ${targetLanguage} and extract:
1. All vocabulary words the student correctly used (in their base/dictionary form)
2. Grammar concepts they demonstrated correctly

STUDENT UTTERANCES:
${userMessages}

Focus on words and grammar the STUDENT produced, not what the tutor said.
Return words in their base form (infinitive for verbs, singular for nouns).
For grammar, use standard linguistic terms: past_tense, present_tense, subjunctive, conditional, plural_agreement, gender_agreement, etc.`;

  try {
    const result = await callGeminiWithSchema<VocabularyExtractionResult>(
      GEMINI_MODELS.FLASH,
      [
        { role: "system", content: "You are a language learning analyst. Extract vocabulary and grammar from student speech." },
        { role: "user", content: prompt },
      ],
      VOCABULARY_EXTRACTION_SCHEMA
    );
    return result;
  } catch (error) {
    console.error("[COMPETENCY] Error extracting vocabulary:", error);
    return { extractedWords: [], grammarConcepts: [] };
  }
}

export async function checkLessonCompetency(
  studentId: string,
  classId: string,
  lessonId: string
): Promise<CompetencyCheckResult> {
  console.log(`[COMPETENCY] Checking competency for student ${studentId}, lesson ${lessonId}`);

  const [lesson] = await getSharedDb()
    .select()
    .from(curriculumLessons)
    .where(eq(curriculumLessons.id, lessonId))
    .limit(1);

  if (!lesson) {
    throw new Error(`Lesson ${lessonId} not found`);
  }

  const requiredTopics = lesson.requiredTopics || [];
  const requiredVocabulary = lesson.requiredVocabulary || [];
  const requiredGrammar = lesson.requiredGrammar || [];
  const minPronunciationScore = lesson.minPronunciationScore || 70;

  const studentConversations = await db
    .select({
      id: conversations.id,
      createdAt: conversations.createdAt,
    })
    .from(conversations)
    .where(
      and(
        eq(conversations.userId, studentId),
        eq(conversations.classId, classId)
      )
    );

  const conversationIds = studentConversations.map(c => c.id);

  if (conversationIds.length === 0) {
    return {
      lessonId,
      covered: false,
      coveragePercent: 0,
      topicCoverage: { required: requiredTopics, covered: [], missing: requiredTopics, percent: 0 },
      vocabularyCoverage: { required: requiredVocabulary, mastered: [], missing: requiredVocabulary, percent: 0 },
      grammarCoverage: { required: requiredGrammar, demonstrated: [], missing: requiredGrammar, percent: 0 },
      pronunciationScore: null,
      pronunciationRequired: minPronunciationScore,
      pronunciationPassed: false,
      evidenceConversationIds: [],
      recommendation: 'needs_work',
    };
  }

  let coveredTopicNames: string[] = [];
  if (conversationIds.length > 0) {
    const coveredTopicsData = await db
      .select({
        topicId: conversationTopics.topicId,
        name: topics.name,
      })
      .from(conversationTopics)
      .innerJoin(topics, eq(conversationTopics.topicId, topics.id))
      .where(inArray(conversationTopics.conversationId, conversationIds));
    
    coveredTopicNames = Array.from(new Set(coveredTopicsData.map(t => t.name)));
  }

  const masteredVocab = await db
    .select({ word: vocabularyWords.word })
    .from(vocabularyWords)
    .where(
      and(
        eq(vocabularyWords.userId, studentId),
        gte(vocabularyWords.repetition, 3)
      )
    );
  
  const masteredWords = masteredVocab.map(v => v.word.toLowerCase());

  const allMessages = await db
    .select({
      role: messagesTable.role,
      content: messagesTable.content,
      conversationId: messagesTable.conversationId,
    })
    .from(messagesTable)
    .where(inArray(messagesTable.conversationId, conversationIds));

  const messageHistory = allMessages.map(m => ({ 
    role: m.role, 
    content: m.content || '' 
  }));

  const { extractedWords, grammarConcepts } = messageHistory.length > 0 
    ? await extractVocabularyFromConversation(messageHistory, 'target')
    : { extractedWords: [], grammarConcepts: [] };

  const allDemonstratedVocab = Array.from(new Set([
    ...masteredWords,
    ...extractedWords.map(w => w.toLowerCase())
  ]));

  const pronScores = await db
    .select({ score: pronunciationScores.score })
    .from(pronunciationScores)
    .where(inArray(pronunciationScores.conversationId, conversationIds));

  const avgPronunciationScore = pronScores.length > 0
    ? pronScores.reduce((sum, p) => sum + (p.score || 0), 0) / pronScores.length
    : null;

  const topicsCovered = requiredTopics.filter(t => 
    coveredTopicNames.some(name => name.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(name.toLowerCase()))
  );
  const topicsMissing = requiredTopics.filter(t => !topicsCovered.includes(t));
  const topicPercent = requiredTopics.length > 0 
    ? (topicsCovered.length / requiredTopics.length) * 100 
    : 100;

  const vocabCovered = requiredVocabulary.filter(v => 
    allDemonstratedVocab.some(d => d.includes(v.toLowerCase()) || v.toLowerCase().includes(d))
  );
  const vocabMissing = requiredVocabulary.filter(v => !vocabCovered.includes(v));
  const vocabPercent = requiredVocabulary.length > 0 
    ? (vocabCovered.length / requiredVocabulary.length) * 100 
    : 100;

  const grammarDemonstrated = requiredGrammar.filter(g =>
    grammarConcepts.some(d => 
      d.toLowerCase().includes(g.toLowerCase()) || 
      g.toLowerCase().includes(d.toLowerCase())
    )
  );
  const grammarMissing = requiredGrammar.filter(g => !grammarDemonstrated.includes(g));
  const grammarPercent = requiredGrammar.length > 0 
    ? (grammarDemonstrated.length / requiredGrammar.length) * 100 
    : 100;

  const pronunciationPassed = avgPronunciationScore !== null && avgPronunciationScore >= minPronunciationScore;

  const overallPercent = (topicPercent + vocabPercent + grammarPercent) / 3;

  const weights = { topics: 0.4, vocab: 0.35, grammar: 0.25 };
  const weightedCoverage = 
    (topicPercent * weights.topics) + 
    (vocabPercent * weights.vocab) + 
    (grammarPercent * weights.grammar);

  const evidenceIds = conversationIds.filter(id => {
    const convTopics = allMessages
      .filter(m => m.conversationId === id)
      .length > 0;
    return convTopics;
  });

  let recommendation: 'complete_early' | 'partial_progress' | 'needs_work';
  if (weightedCoverage >= 80 && (pronunciationPassed || avgPronunciationScore === null)) {
    recommendation = 'complete_early';
  } else if (weightedCoverage >= 40) {
    recommendation = 'partial_progress';
  } else {
    recommendation = 'needs_work';
  }

  return {
    lessonId,
    covered: recommendation === 'complete_early',
    coveragePercent: Math.round(weightedCoverage),
    topicCoverage: {
      required: requiredTopics,
      covered: topicsCovered,
      missing: topicsMissing,
      percent: Math.round(topicPercent),
    },
    vocabularyCoverage: {
      required: requiredVocabulary,
      mastered: vocabCovered,
      missing: vocabMissing,
      percent: Math.round(vocabPercent),
    },
    grammarCoverage: {
      required: requiredGrammar,
      demonstrated: grammarDemonstrated,
      missing: grammarMissing,
      percent: Math.round(grammarPercent),
    },
    pronunciationScore: avgPronunciationScore !== null ? Math.round(avgPronunciationScore) : null,
    pronunciationRequired: minPronunciationScore,
    pronunciationPassed,
    evidenceConversationIds: evidenceIds.slice(0, 5),
    recommendation,
  };
}

export async function checkUpcomingLessonsForEarlyCompletion(
  studentId: string,
  classId: string
): Promise<Array<{ lessonId: string; lessonTitle: string; recommendation: string; coveragePercent: number }>> {
  const existingProgress = await db
    .select({ lessonId: syllabusProgress.lessonId })
    .from(syllabusProgress)
    .where(
      and(
        eq(syllabusProgress.studentId, studentId),
        eq(syllabusProgress.classId, classId)
      )
    );

  const completedLessonIds = new Set(existingProgress.map(p => p.lessonId));

  const allLessons = await getSharedDb()
    .select()
    .from(curriculumLessons);

  const results: Array<{ lessonId: string; lessonTitle: string; recommendation: string; coveragePercent: number }> = [];

  for (const lesson of allLessons) {
    if (completedLessonIds.has(lesson.id)) continue;
    if (!lesson.requiredTopics?.length && !lesson.requiredVocabulary?.length) continue;

    try {
      const competency = await checkLessonCompetency(studentId, classId, lesson.id);
      
      if (competency.coveragePercent >= 40) {
        results.push({
          lessonId: lesson.id,
          lessonTitle: lesson.name,
          recommendation: competency.recommendation,
          coveragePercent: competency.coveragePercent,
        });
      }
    } catch (error) {
      console.error(`[COMPETENCY] Error checking lesson ${lesson.id}:`, error);
    }
  }

  return results.sort((a, b) => b.coveragePercent - a.coveragePercent);
}

export async function markLessonAsOrganicallyCompleted(
  studentId: string,
  classId: string,
  lessonId: string,
  competencyResult: CompetencyCheckResult,
  tutorVerified: boolean = false
): Promise<boolean> {
  try {
    const existingProgress = await db
      .select()
      .from(syllabusProgress)
      .where(
        and(
          eq(syllabusProgress.studentId, studentId),
          eq(syllabusProgress.classId, classId),
          eq(syllabusProgress.lessonId, lessonId)
        )
      )
      .limit(1);

    const progressData = {
      studentId,
      classId,
      lessonId,
      status: 'completed_early' as const,
      evidenceType: 'organic_conversation',
      topicsCoveredCount: competencyResult.topicCoverage.covered.length,
      vocabularyMastered: competencyResult.vocabularyCoverage.mastered.length,
      grammarScore: competencyResult.grammarCoverage.percent / 100,
      pronunciationScore: competencyResult.pronunciationScore !== null 
        ? competencyResult.pronunciationScore / 100 
        : null,
      evidenceConversationId: competencyResult.evidenceConversationIds[0] || null,
      tutorVerified,
      tutorNotes: `Competency: ${competencyResult.coveragePercent}%. Topics: ${competencyResult.topicCoverage.covered.join(', ')}. Vocab: ${competencyResult.vocabularyCoverage.mastered.join(', ')}.`,
      completedAt: new Date(),
      daysAhead: 0,
    };

    if (existingProgress.length > 0) {
      await getUserDb()
        .update(syllabusProgress)
        .set(progressData)
        .where(eq(syllabusProgress.id, existingProgress[0].id));
    } else {
      await getUserDb().insert(syllabusProgress).values({
        id: crypto.randomUUID(),
        ...progressData,
      });
    }

    console.log(`[COMPETENCY] Marked lesson ${lessonId} as organically completed for student ${studentId}`);
    
    // FLUENCY WIRING: Record Can-Do statement progress for this lesson
    try {
      const { recordLessonCompletionCanDo } = await import('./fluency-wiring-service');
      const canDoRecorded = await recordLessonCompletionCanDo(
        studentId, 
        lessonId, 
        competencyResult.evidenceConversationIds[0]
      );
      if (canDoRecorded > 0) {
        console.log(`[COMPETENCY] Recorded ${canDoRecorded} Can-Do statements for lesson completion`);
      }
    } catch (canDoError) {
      console.error("[COMPETENCY] Error recording Can-Do progress:", canDoError);
      // Don't fail the lesson completion if Can-Do recording fails
    }
    
    return true;
  } catch (error) {
    console.error("[COMPETENCY] Error marking lesson complete:", error);
    return false;
  }
}

export interface SyllabusAheadMessage {
  shouldCongratulate: boolean;
  message: string;
  lessonsAhead: number;
  lessonNames: string[];
}

export async function checkIfStudentAheadOfSyllabus(
  studentId: string,
  classId: string | null
): Promise<SyllabusAheadMessage> {
  if (!classId) {
    return {
      shouldCongratulate: false,
      message: '',
      lessonsAhead: 0,
      lessonNames: [],
    };
  }

  try {
    const earlyCompletions = await getSharedDb()
      .select({
        id: syllabusProgress.id,
        lessonId: syllabusProgress.lessonId,
        lessonName: curriculumLessons.name,
        daysAhead: syllabusProgress.daysAhead,
      })
      .from(syllabusProgress)
      .innerJoin(curriculumLessons, eq(syllabusProgress.lessonId, curriculumLessons.id))
      .where(
        and(
          eq(syllabusProgress.studentId, studentId),
          eq(syllabusProgress.classId, classId),
          eq(syllabusProgress.status, 'completed_early')
        )
      );

    if (earlyCompletions.length === 0) {
      return {
        shouldCongratulate: false,
        message: '',
        lessonsAhead: 0,
        lessonNames: [],
      };
    }

    const lessonNames = earlyCompletions.map(e => e.lessonName);
    const congratsMessages = [
      `Excellent work! You've already covered ${earlyCompletions.length} lesson${earlyCompletions.length > 1 ? 's' : ''} through our conversations - you're ahead of the syllabus!`,
      `Great progress! Your natural practice has put you ahead - you've mastered content from ${lessonNames.join(', ')}.`,
      `You're doing amazing! Through our chats, you've already learned material that's coming up in your class.`,
      `Wonderful! You've organically covered ${earlyCompletions.length} curriculum topic${earlyCompletions.length > 1 ? 's' : ''} - that's real progress!`,
    ];

    return {
      shouldCongratulate: true,
      message: congratsMessages[Math.floor(Math.random() * congratsMessages.length)],
      lessonsAhead: earlyCompletions.length,
      lessonNames,
    };
  } catch (error) {
    console.error("[COMPETENCY] Error checking syllabus progress:", error);
    return {
      shouldCongratulate: false,
      message: '',
      lessonsAhead: 0,
      lessonNames: [],
    };
  }
}

export async function generateCongratulatoryPromptAddition(
  studentId: string,
  classId: string | null
): Promise<string> {
  const syllabusInfo = await checkIfStudentAheadOfSyllabus(studentId, classId);
  
  if (!syllabusInfo.shouldCongratulate) {
    return '';
  }

  return `
IMPORTANT CONTEXT: This student is enrolled in a class and has organically covered ${syllabusInfo.lessonsAhead} curriculum lesson${syllabusInfo.lessonsAhead > 1 ? 's' : ''} through your conversations.
They're ahead of their class syllabus! When appropriate, acknowledge their excellent progress and how their natural conversation practice is helping them learn.
Lessons they've already covered: ${syllabusInfo.lessonNames.join(', ')}.
`;
}
