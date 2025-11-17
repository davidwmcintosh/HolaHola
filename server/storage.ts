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
} from "@shared/schema";
import { randomUUID } from "crypto";

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

  // Vocabulary
  createVocabularyWord(data: InsertVocabularyWord): Promise<VocabularyWord>;
  getVocabularyWords(language: string, difficulty?: string): Promise<VocabularyWord[]>;

  // Grammar
  createGrammarExercise(data: InsertGrammarExercise): Promise<GrammarExercise>;
  getGrammarExercises(language: string, difficulty?: string): Promise<GrammarExercise[]>;

  // User Progress
  getOrCreateUserProgress(language: string): Promise<UserProgress>;
  updateUserProgress(id: string, data: Partial<UserProgress>): Promise<UserProgress | undefined>;
}

export class MemStorage implements IStorage {
  private conversations: Map<string, Conversation>;
  private messages: Map<string, Message>;
  private vocabularyWords: Map<string, VocabularyWord>;
  private grammarExercises: Map<string, GrammarExercise>;
  private userProgress: Map<string, UserProgress>;

  constructor() {
    this.conversations = new Map();
    this.messages = new Map();
    this.vocabularyWords = new Map();
    this.grammarExercises = new Map();
    this.userProgress = new Map();
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
    if (!conversation) return undefined;
    const updated = { ...conversation, ...data };
    this.conversations.set(id, updated);
    return updated;
  }

  async createMessage(data: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const message: Message = {
      ...data,
      id,
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

  async createVocabularyWord(data: InsertVocabularyWord): Promise<VocabularyWord> {
    const id = randomUUID();
    const word: VocabularyWord = { ...data, id };
    this.vocabularyWords.set(id, word);
    return word;
  }

  async getVocabularyWords(language: string, difficulty?: string): Promise<VocabularyWord[]> {
    return Array.from(this.vocabularyWords.values()).filter(
      (word) => word.language === language && (!difficulty || word.difficulty === difficulty)
    );
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
      lastPracticeDate: null,
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
}

export const storage = new MemStorage();
