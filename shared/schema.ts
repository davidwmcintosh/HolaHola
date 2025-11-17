import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  language: text("language").notNull(),
  difficulty: text("difficulty").notNull(),
  topic: text("topic"),
  messageCount: integer("message_count").notNull().default(0),
  duration: integer("duration").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id),
  role: text("role").notNull(),
  content: text("content").notNull(),
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
  lastPracticeDate: timestamp("last_practice_date"),
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
