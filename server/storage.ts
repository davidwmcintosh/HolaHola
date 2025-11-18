import {
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type VocabularyWord,
  type InsertVocabularyWord,
  type GrammarExercise,
  type InsertGrammarExercise,
  type UserProgress,
  type InsertUserProgress,
  type ProgressHistory,
  type InsertProgressHistory,
  type PronunciationScore,
  type InsertPronunciationScore,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { markCorrect, markIncorrect } from "./spaced-repetition";

export interface IStorage {
  // Conversations
  createConversation(data: InsertConversation): Promise<Conversation>;
  getConversation(id: string): Promise<Conversation | undefined>;
  getAllConversations(): Promise<Conversation[]>;
  getConversationByLanguageAndDifficulty(language: string, difficulty: string): Promise<Conversation | undefined>;
  updateConversation(id: string, data: Partial<Conversation>): Promise<Conversation | undefined>;

  // Messages
  createMessage(data: InsertMessage): Promise<Message>;
  getMessagesByConversation(conversationId: string): Promise<Message[]>;
  updateMessage(id: string, data: Partial<Message>): Promise<Message | undefined>;

  // Vocabulary
  createVocabularyWord(data: InsertVocabularyWord): Promise<VocabularyWord>;
  getVocabularyWords(language: string, difficulty?: string): Promise<VocabularyWord[]>;
  updateVocabularyReview(id: string, isCorrect: boolean): Promise<VocabularyWord | undefined>;

  // Grammar
  createGrammarExercise(data: InsertGrammarExercise): Promise<GrammarExercise>;
  getGrammarExercises(language: string, difficulty?: string): Promise<GrammarExercise[]>;

  // User Progress
  getOrCreateUserProgress(language: string): Promise<UserProgress>;
  updateUserProgress(id: string, data: Partial<UserProgress>): Promise<UserProgress | undefined>;

  // Progress History
  createProgressHistory(data: InsertProgressHistory): Promise<ProgressHistory>;
  getProgressHistory(language: string, days?: number): Promise<ProgressHistory[]>;

  // Pronunciation Scores
  createPronunciationScore(data: InsertPronunciationScore): Promise<PronunciationScore>;
  getPronunciationScoresByConversation(conversationId: string): Promise<PronunciationScore[]>;
  getPronunciationScoreByMessage(messageId: string): Promise<PronunciationScore | undefined>;
  getPronunciationScoreStats(conversationId: string): Promise<{ averageScore: number; totalScores: number }>;
}

export class MemStorage implements IStorage {
  private conversations: Map<string, Conversation>;
  private messages: Map<string, Message>;
  private vocabularyWords: Map<string, VocabularyWord>;
  private grammarExercises: Map<string, GrammarExercise>;
  private userProgress: Map<string, UserProgress>;
  private progressHistory: Map<string, ProgressHistory>;
  private pronunciationScores: Map<string, PronunciationScore>;

  constructor() {
    this.conversations = new Map();
    this.messages = new Map();
    this.vocabularyWords = new Map();
    this.grammarExercises = new Map();
    this.userProgress = new Map();
    this.progressHistory = new Map();
    this.pronunciationScores = new Map();
    this.seedData();
  }

  private seedData() {
    // Seed vocabulary words
    const spanishWords: InsertVocabularyWord[] = [
      { language: "spanish", word: "Hola", translation: "Hello", example: "Hola, ¿cómo estás?", pronunciation: "OH-lah", difficulty: "beginner" },
      { language: "spanish", word: "Gracias", translation: "Thank you", example: "Gracias por tu ayuda.", pronunciation: "GRAH-see-ahs", difficulty: "beginner" },
      { language: "spanish", word: "Amigo", translation: "Friend", example: "Mi amigo es muy amable.", pronunciation: "ah-MEE-goh", difficulty: "beginner" },
      { language: "spanish", word: "Casa", translation: "House", example: "Mi casa es grande.", pronunciation: "KAH-sah", difficulty: "beginner" },
      { language: "spanish", word: "Comida", translation: "Food", example: "La comida está deliciosa.", pronunciation: "koh-MEE-dah", difficulty: "intermediate" },
    ];

    spanishWords.forEach(word => this.createVocabularyWord(word));

    // Seed grammar exercises
    const spanishGrammar: InsertGrammarExercise[] = [
      {
        language: "spanish",
        difficulty: "beginner",
        question: "Complete: Yo ___ estudiante.",
        options: ["es", "soy", "eres", "está"],
        correctAnswer: 1,
        explanation: "Use 'soy' for the first person singular of the verb 'ser' (to be).",
      },
      {
        language: "spanish",
        difficulty: "intermediate",
        question: "Choose the correct verb: Ella ___ una manzana.",
        options: ["come", "como", "comes", "comen"],
        correctAnswer: 0,
        explanation: "'Come' is the third person singular form of 'comer' (to eat).",
      },
    ];

    spanishGrammar.forEach(exercise => this.createGrammarExercise(exercise));
  }

  async createConversation(data: InsertConversation): Promise<Conversation> {
    const id = randomUUID();
    const conversation: Conversation = {
      id,
      language: data.language,
      difficulty: data.difficulty,
      topic: data.topic ?? null,
      messageCount: data.messageCount ?? 0,
      duration: data.duration ?? 0,
      isOnboarding: data.isOnboarding ?? false,
      onboardingStep: data.onboardingStep ?? null,
      userName: data.userName ?? null,
      successfulMessages: 0,
      totalAssessedMessages: 0,
      createdAt: new Date(),
    };
    this.conversations.set(id, conversation);
    return conversation;
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async getAllConversations(): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async getConversationByLanguageAndDifficulty(language: string, difficulty: string): Promise<Conversation | undefined> {
    return Array.from(this.conversations.values()).find(
      (conv) => conv.language === language && conv.difficulty === difficulty
    );
  }

  async updateConversation(id: string, data: Partial<Conversation>): Promise<Conversation | undefined> {
    const conversation = this.conversations.get(id);
    if (!conversation) {
      console.log('[STORAGE] updateConversation: conversation not found:', id);
      return undefined;
    }
    
    console.log('[STORAGE] updateConversation BEFORE:', {
      id,
      onboardingStep: conversation.onboardingStep,
      userName: conversation.userName,
      isOnboarding: conversation.isOnboarding
    });
    console.log('[STORAGE] updateConversation data to merge:', data);
    
    // Filter out undefined values to avoid overwriting existing data
    const filteredData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined)
    );
    
    console.log('[STORAGE] updateConversation filteredData:', filteredData);
    
    const updated = { ...conversation, ...filteredData };
    this.conversations.set(id, updated);
    
    console.log('[STORAGE] updateConversation AFTER:', {
      id: updated.id,
      onboardingStep: updated.onboardingStep,
      userName: updated.userName,
      isOnboarding: updated.isOnboarding
    });
    
    // Verify it was actually saved
    const verified = this.conversations.get(id);
    console.log('[STORAGE] updateConversation VERIFIED from Map:', {
      id: verified?.id,
      onboardingStep: verified?.onboardingStep,
      userName: verified?.userName,
      isOnboarding: verified?.isOnboarding
    });
    
    return updated;
  }

  async createMessage(data: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const message: Message = {
      ...data,
      id,
      performanceScore: data.performanceScore ?? null,
      createdAt: new Date(),
    };
    this.messages.set(id, message);

    // Update conversation stats
    const conversation = this.conversations.get(data.conversationId);
    if (conversation) {
      conversation.messageCount += 1;
      
      // Calculate duration from first message to most recent message
      const messages = await this.getMessagesByConversation(data.conversationId);
      if (messages.length > 0) {
        const firstMessage = messages[0];
        const lastMessage = messages[messages.length - 1];
        const durationMs = new Date(lastMessage.createdAt).getTime() - new Date(firstMessage.createdAt).getTime();
        conversation.duration = Math.floor(durationMs / 60000); // Convert to minutes
      }
      
      this.conversations.set(data.conversationId, conversation);
    }

    return message;
  }

  async getMessagesByConversation(conversationId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter((msg) => msg.conversationId === conversationId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async updateMessage(id: string, data: Partial<Message>): Promise<Message | undefined> {
    const message = this.messages.get(id);
    if (!message) return undefined;
    const updated = { ...message, ...data };
    this.messages.set(id, updated);
    return updated;
  }

  async createVocabularyWord(data: InsertVocabularyWord): Promise<VocabularyWord> {
    const id = randomUUID();
    const now = new Date();
    const word: VocabularyWord = { 
      ...data, 
      id,
      // Initialize spaced repetition fields
      nextReviewDate: now,
      correctCount: 0,
      incorrectCount: 0,
      repetition: 0,
      easeFactor: 2.5,
      interval: 1,
    };
    this.vocabularyWords.set(id, word);
    return word;
  }

  async getVocabularyWords(language: string, difficulty?: string): Promise<VocabularyWord[]> {
    return Array.from(this.vocabularyWords.values()).filter(
      (word) => word.language === language && (!difficulty || word.difficulty === difficulty)
    );
  }

  async updateVocabularyReview(id: string, isCorrect: boolean): Promise<VocabularyWord | undefined> {
    const word = this.vocabularyWords.get(id);
    if (!word) return undefined;

    // Calculate next review using SM-2 algorithm
    const currentState = {
      easeFactor: word.easeFactor,
      interval: word.interval,
      correctCount: word.correctCount,
      incorrectCount: word.incorrectCount,
      repetition: word.repetition,
    };

    const result = isCorrect ? markCorrect(currentState) : markIncorrect(currentState);

    // Update word with new review data
    const updated: VocabularyWord = {
      ...word,
      nextReviewDate: result.nextReviewDate,
      easeFactor: result.easeFactor,
      interval: result.interval,
      correctCount: result.correctCount,
      incorrectCount: result.incorrectCount,
      repetition: result.repetition,
    };

    this.vocabularyWords.set(id, updated);
    return updated;
  }

  async createGrammarExercise(data: InsertGrammarExercise): Promise<GrammarExercise> {
    const id = randomUUID();
    const exercise: GrammarExercise = { ...data, id };
    this.grammarExercises.set(id, exercise);
    return exercise;
  }

  async getGrammarExercises(language: string, difficulty?: string): Promise<GrammarExercise[]> {
    return Array.from(this.grammarExercises.values()).filter(
      (ex) => ex.language === language && (!difficulty || ex.difficulty === difficulty)
    );
  }

  async getOrCreateUserProgress(language: string): Promise<UserProgress> {
    const existing = Array.from(this.userProgress.values()).find(
      (p) => p.language === language
    );
    if (existing) return existing;

    const id = randomUUID();
    const progress: UserProgress = {
      id,
      language,
      wordsLearned: 0,
      practiceMinutes: 0,
      currentStreak: 0,
      longestStreak: 0,
      totalPracticeDays: 0,
      lastPracticeDate: null,
      suggestedDifficulty: null,
      lastDifficultyAdjustment: null,
    };
    this.userProgress.set(id, progress);
    return progress;
  }

  async updateUserProgress(id: string, data: Partial<UserProgress>): Promise<UserProgress | undefined> {
    const progress = this.userProgress.get(id);
    if (!progress) return undefined;
    const updated = { ...progress, ...data };
    this.userProgress.set(id, updated);
    return updated;
  }

  async createProgressHistory(data: InsertProgressHistory): Promise<ProgressHistory> {
    const id = randomUUID();
    const history: ProgressHistory = {
      id,
      language: data.language,
      date: data.date,
      wordsLearned: data.wordsLearned ?? 0,
      practiceMinutes: data.practiceMinutes ?? 0,
      conversationsCount: data.conversationsCount ?? 0,
    };
    this.progressHistory.set(id, history);
    return history;
  }

  async getProgressHistory(language: string, days: number = 30): Promise<ProgressHistory[]> {
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    return Array.from(this.progressHistory.values())
      .filter((h) => h.language === language && new Date(h.date) >= cutoffDate)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  async createPronunciationScore(data: InsertPronunciationScore): Promise<PronunciationScore> {
    const id = randomUUID();
    const score: PronunciationScore = {
      ...data,
      id,
      phoneticIssues: data.phoneticIssues ?? null,
      targetPhrase: data.targetPhrase ?? null,
      createdAt: new Date(),
    };
    this.pronunciationScores.set(id, score);
    return score;
  }

  async getPronunciationScoresByConversation(conversationId: string): Promise<PronunciationScore[]> {
    return Array.from(this.pronunciationScores.values())
      .filter((score) => score.conversationId === conversationId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async getPronunciationScoreByMessage(messageId: string): Promise<PronunciationScore | undefined> {
    return Array.from(this.pronunciationScores.values())
      .find((score) => score.messageId === messageId);
  }

  async getPronunciationScoreStats(conversationId: string): Promise<{ averageScore: number; totalScores: number }> {
    const scores = await this.getPronunciationScoresByConversation(conversationId);
    if (scores.length === 0) {
      return { averageScore: 0, totalScores: 0 };
    }
    const totalScore = scores.reduce((sum, score) => sum + score.score, 0);
    return {
      averageScore: Math.round(totalScore / scores.length),
      totalScores: scores.length,
    };
  }
}

export const storage = new MemStorage();
