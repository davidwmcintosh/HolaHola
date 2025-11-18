import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  language: text("language").notNull(),
  difficulty: text("difficulty").notNull(),
  topic: text("topic"),
  title: text("title"), // Thread name for multiple conversations
  messageCount: integer("message_count").notNull().default(0),
  duration: integer("duration").notNull().default(0),
  isOnboarding: boolean("is_onboarding").notNull().default(false),
  onboardingStep: text("onboarding_step"),
  userName: text("user_name"),
  // Performance tracking for auto-difficulty adjustment
  successfulMessages: integer("successful_messages").notNull().default(0), // Messages with score >= 60
  totalAssessedMessages: integer("total_assessed_messages").notNull().default(0), // Total user messages assessed
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id),
  role: text("role").notNull(),
  content: text("content").notNull(),
  // Performance tracking (for user messages only)
  performanceScore: integer("performance_score"), // 0-100: AI assessment of response quality
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const vocabularyWords = pgTable("vocabulary_words", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  language: text("language").notNull(),
  word: text("word").notNull(),
  translation: text("translation").notNull(),
  example: text("example").notNull(),
  pronunciation: text("pronunciation").notNull(),
  difficulty: text("difficulty").notNull(),
  // Spaced repetition fields
  nextReviewDate: timestamp("next_review_date").notNull().defaultNow(),
  correctCount: integer("correct_count").notNull().default(0), // Lifetime correct reviews
  incorrectCount: integer("incorrect_count").notNull().default(0), // Lifetime incorrect reviews
  repetition: integer("repetition").notNull().default(0), // Consecutive correct reviews (resets on failure)
  easeFactor: real("ease_factor").notNull().default(2.5), // SM-2 algorithm default
  interval: integer("interval").notNull().default(1), // Days until next review
});

export const grammarExercises = pgTable("grammar_exercises", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  language: text("language").notNull(),
  difficulty: text("difficulty").notNull(),
  question: text("question").notNull(),
  options: text("options").array().notNull(),
  correctAnswer: integer("correct_answer").notNull(),
  explanation: text("explanation").notNull(),
});

export const userProgress = pgTable("user_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  language: text("language").notNull(),
  wordsLearned: integer("words_learned").notNull().default(0),
  practiceMinutes: integer("practice_minutes").notNull().default(0),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  totalPracticeDays: integer("total_practice_days").notNull().default(0),
  lastPracticeDate: timestamp("last_practice_date"),
  // Auto-difficulty tracking
  suggestedDifficulty: text("suggested_difficulty"), // AI-recommended difficulty level
  lastDifficultyAdjustment: timestamp("last_difficulty_adjustment"), // When difficulty was last changed
});

export const progressHistory = pgTable("progress_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  language: text("language").notNull(),
  date: timestamp("date").notNull(),
  wordsLearned: integer("words_learned").notNull().default(0),
  practiceMinutes: integer("practice_minutes").notNull().default(0),
  conversationsCount: integer("conversations_count").notNull().default(0),
});

export const pronunciationScores = pgTable("pronunciation_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().references(() => messages.id),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id),
  transcribedText: text("transcribed_text").notNull(),
  targetPhrase: text("target_phrase"),
  score: integer("score").notNull(), // 0-100
  feedback: text("feedback").notNull(),
  phoneticIssues: text("phonetic_issues").array(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const topics = pgTable("topics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(), // e.g., "Daily Life", "Travel", "Business"
  icon: text("icon").notNull(), // Lucide icon name
  samplePhrases: text("sample_phrases").array().notNull(),
  difficulty: text("difficulty"), // Optional difficulty recommendation
});

export const culturalTips = pgTable("cultural_tips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  language: text("language").notNull(),
  category: text("category").notNull(), // e.g., "Greetings", "Dining", "Social Norms", "Customs", "Holidays"
  title: text("title").notNull(),
  content: text("content").notNull(),
  context: text("context").notNull(), // When/where this applies
  relatedTopics: text("related_topics").array(), // Optional topic associations
  icon: text("icon").notNull(), // Lucide icon name
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export const insertVocabularyWordSchema = createInsertSchema(vocabularyWords).omit({
  id: true,
});

export const insertGrammarExerciseSchema = createInsertSchema(grammarExercises).omit({
  id: true,
});

export const insertUserProgressSchema = createInsertSchema(userProgress).omit({
  id: true,
});

export const insertProgressHistorySchema = createInsertSchema(progressHistory).omit({
  id: true,
});

export const insertPronunciationScoreSchema = createInsertSchema(pronunciationScores).omit({
  id: true,
  createdAt: true,
});

export const insertTopicSchema = createInsertSchema(topics).omit({
  id: true,
});

export const insertCulturalTipSchema = createInsertSchema(culturalTips).omit({
  id: true,
});

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export type InsertVocabularyWord = z.infer<typeof insertVocabularyWordSchema>;
export type VocabularyWord = typeof vocabularyWords.$inferSelect;

export type InsertGrammarExercise = z.infer<typeof insertGrammarExerciseSchema>;
export type GrammarExercise = typeof grammarExercises.$inferSelect;

export type InsertUserProgress = z.infer<typeof insertUserProgressSchema>;
export type UserProgress = typeof userProgress.$inferSelect;

export type InsertProgressHistory = z.infer<typeof insertProgressHistorySchema>;
export type ProgressHistory = typeof progressHistory.$inferSelect;

export type InsertPronunciationScore = z.infer<typeof insertPronunciationScoreSchema>;
export type PronunciationScore = typeof pronunciationScores.$inferSelect;

export type InsertTopic = z.infer<typeof insertTopicSchema>;
export type Topic = typeof topics.$inferSelect;

export type InsertCulturalTip = z.infer<typeof insertCulturalTipSchema>;
export type CulturalTip = typeof culturalTips.$inferSelect;
