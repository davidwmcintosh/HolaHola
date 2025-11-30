import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, real, index, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ===== Enums =====

// User role enum for multi-role system
export const userRoleEnum = pgEnum('user_role', ['student', 'teacher', 'developer', 'admin']);

// Learning context enum - distinguishes self-directed vs class-directed learning
export const learningContextEnum = pgEnum('learning_context', ['self_directed', 'class_assigned']);

// Syllabus completion status enum
export const syllabusStatusEnum = pgEnum('syllabus_status', ['not_started', 'in_progress', 'completed_early', 'completed_assigned', 'skipped']);

// Replit Auth Integration - Session storage table
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Replit Auth Integration - User storage table with Stripe billing
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email"), // No unique constraint - using Replit Auth sub (id) as primary identifier
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  // User role for multi-role system
  role: userRoleEnum("role").default("student").notNull(), // student, teacher, developer, admin
  learningPathMode: varchar("learning_path_mode").default("open"), // open, structured
  // Developer testing override
  developerModel: varchar("developer_model"), // null (use tier-based), 'gpt-4o-mini', or 'gpt-4o' for developers/admins
  // Admin impersonation for support/debugging
  impersonatedUserId: varchar("impersonated_user_id"), // If admin is impersonating, this is the original admin's ID
  impersonatedBy: varchar("impersonated_by"), // The admin ID who initiated impersonation
  impersonationExpiresAt: timestamp("impersonation_expires_at"), // Impersonation session expiry
  // Learning preferences
  targetLanguage: varchar("target_language"), // english, spanish, french, german, italian, portuguese, japanese, mandarin, korean
  nativeLanguage: varchar("native_language").default("english"), // Language for explanations
  difficultyLevel: varchar("difficulty_level"), // beginner, intermediate, advanced
  onboardingCompleted: boolean("onboarding_completed").default(false),
  // Tutor preference - allows students to choose male or female tutor voice/avatar
  tutorGender: varchar("tutor_gender").default("female"), // male, female - matches voice and avatar
  // Tutor personality - baseline emotion style for the AI tutor
  tutorPersonality: varchar("tutor_personality").default("warm"), // warm, calm, energetic, professional
  // Tutor expressiveness - how much the AI deviates from baseline (1=subtle, 5=very expressive)
  tutorExpressiveness: integer("tutor_expressiveness").default(3), // 1-5 scale
  // ACTFL proficiency tracking
  actflLevel: varchar("actfl_level"), // novice_low, novice_mid, novice_high, intermediate_low, intermediate_mid, intermediate_high, advanced_low, advanced_mid, advanced_high, superior, distinguished
  // Stripe billing integration
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  subscriptionTier: varchar("subscription_tier").default("free"), // free, basic, pro, institutional
  subscriptionStatus: varchar("subscription_status").default("active"), // active, canceled, past_due, trialing
  // Usage tracking for cost analysis
  monthlyMessageCount: integer("monthly_message_count").default(0), // Voice messages sent this month
  monthlyMessageLimit: integer("monthly_message_limit").default(20), // 20 for free, unlimited for paid
  lastMessageResetDate: timestamp("last_message_reset_date").defaultNow(),
  totalConversations: integer("total_conversations").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const updateUserPreferencesSchema = z.object({
  targetLanguage: z.string().optional(),
  nativeLanguage: z.string().optional(),
  difficultyLevel: z.string().optional(),
  onboardingCompleted: z.boolean().optional(),
  tutorGender: z.enum(['male', 'female']).optional(),
  tutorPersonality: z.enum(['warm', 'calm', 'energetic', 'professional']).optional(),
  tutorExpressiveness: z.number().min(1).max(5).optional(),
});

export type UpdateUserPreferences = z.infer<typeof updateUserPreferencesSchema>;
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Tutor Voices - Admin-configurable voices per language with male/female options
// This replaces hardcoded voice mappings and allows admin voice audition/assignment
export const tutorVoices = pgTable("tutor_voices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  language: varchar("language").notNull(), // spanish, french, german, etc.
  gender: varchar("gender").notNull(), // male, female
  provider: varchar("provider").notNull().default("cartesia"), // cartesia, google
  voiceId: varchar("voice_id").notNull(), // Cartesia voice ID or Google voice name
  voiceName: varchar("voice_name").notNull(), // Display name for admin UI (e.g., "Mexican Woman")
  languageCode: varchar("language_code").notNull(), // Language code for TTS (e.g., "es", "en")
  speakingRate: real("speaking_rate").notNull().default(0.9), // Speed: 0.7 (slow) to 1.3 (fast), 0.9 = natural
  personality: varchar("personality").notNull().default("warm"), // warm, calm, energetic, professional
  expressiveness: integer("expressiveness").notNull().default(3), // 1-5 scale
  emotion: varchar("emotion").notNull().default("friendly"), // Default emotion for TTS
  isActive: boolean("is_active").notNull().default(true), // Enable/disable voice without deleting
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_tutor_voices_language_gender").on(table.language, table.gender),
]);

export const insertTutorVoiceSchema = createInsertSchema(tutorVoices).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTutorVoice = z.infer<typeof insertTutorVoiceSchema>;
export type TutorVoice = typeof tutorVoices.$inferSelect;

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  language: text("language").notNull(), // Target language being learned
  nativeLanguage: text("native_language").notNull().default("english"), // Student's native language (for explanations)
  difficulty: text("difficulty").notNull(),
  topic: text("topic"),
  title: text("title"), // Thread name for multiple conversations
  messageCount: integer("message_count").notNull().default(0),
  duration: integer("duration").notNull().default(0),
  isOnboarding: boolean("is_onboarding").notNull().default(false),
  onboardingStep: text("onboarding_step"),
  userName: text("user_name"), // Kept for backward compatibility
  // Performance tracking for auto-difficulty adjustment
  successfulMessages: integer("successful_messages").notNull().default(0), // Messages with score >= 60
  totalAssessedMessages: integer("total_assessed_messages").notNull().default(0), // Total user messages assessed
  // ACTFL standards tracking
  actflLevel: text("actfl_level"), // novice_low, novice_mid, novice_high, intermediate_low, intermediate_mid, intermediate_high, advanced_low, advanced_mid, advanced_high, superior, distinguished
  // Organization features (Phase 1)
  isStarred: boolean("is_starred").notNull().default(false), // User can star/favorite conversations
  // Institutional features - Class/Course assignment
  classId: varchar("class_id"), // Links to teacherClasses table for filtering by class (e.g., "Spanish 101")
  learningContext: learningContextEnum("learning_context").default("self_directed"), // self_directed or class_assigned
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_conversations_user_id").on(table.userId),
  index("idx_conversations_user_language").on(table.userId, table.language),
  index("idx_conversations_class").on(table.classId),
]);

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id),
  role: text("role").notNull(),
  content: text("content").notNull(),
  // Voice conversation text display - shows foreign language text on screen for reading reinforcement
  targetLanguageText: text("target_language_text"), // Foreign language portion to display during voice chat
  // Subtitle sequence for showing multiple subtitles (encouragement + teaching word)
  subtitlesJson: text("subtitles_json"), // JSON array of {text: string, duration?: number} - shows sequentially
  // Word-level timing data for synchronized subtitle highlighting (karaoke-style)
  wordTimingsJson: text("word_timings_json"), // JSON array of {word: string, startTime: number, endTime: number}
  // AI tutor multimedia - images from stock sources or AI-generated
  mediaJson: text("media_json"), // JSON array of media items {type: "stock"|"ai_generated", query?, prompt?, url?, ...}
  // Performance tracking (for user messages only)
  performanceScore: integer("performance_score"), // 0-100: AI assessment of response quality
  // ACTFL standards tracking - auto-tagged by AI based on language complexity
  actflLevel: text("actfl_level"), // novice_low, novice_mid, etc. - AI detects complexity of message content
  // Background enrichment status for voice chat optimization
  enrichmentStatus: text("enrichment_status"), // null (complete), "pending", "processing", "failed" - used for split response in voice chat
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_messages_conversation_id").on(table.conversationId),
]);

// Word type enum for grammar classification
export const wordTypeEnum = pgEnum('word_type', ['noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction', 'pronoun', 'article', 'other']);

export const vocabularyWords = pgTable("vocabulary_words", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  language: text("language").notNull(),
  word: text("word").notNull(),
  translation: text("translation").notNull(),
  example: text("example").notNull(),
  pronunciation: text("pronunciation").notNull(),
  difficulty: text("difficulty").notNull(),
  // ACTFL standards tracking
  actflLevel: text("actfl_level"), // novice_low, novice_mid, etc.
  // Organization features (Phase 2) - Link to source conversation
  sourceConversationId: varchar("source_conversation_id").references(() => conversations.id), // Where this word was learned
  sourceMessageId: varchar("source_message_id"), // Optional: specific message that introduced the word
  // Institutional features - Class/Course assignment
  classId: varchar("class_id"), // Links to teacherClasses table for filtering by class (e.g., "Spanish 101")
  // Grammar classification (Phase 3) - For filtering flashcards by grammar type
  wordType: wordTypeEnum("word_type"), // noun, verb, adjective, etc.
  verbTense: text("verb_tense"), // present, past, future, conditional, etc. (for verbs)
  verbMood: text("verb_mood"), // indicative, subjunctive, imperative (for verbs)
  verbPerson: text("verb_person"), // 1st_singular, 3rd_plural, etc. (for verbs)
  nounGender: text("noun_gender"), // masculine, feminine, neutral (for nouns)
  nounNumber: text("noun_number"), // singular, plural (for nouns)
  grammarNotes: text("grammar_notes"), // Additional grammar info (e.g., "irregular", "reflexive")
  // Spaced repetition fields
  nextReviewDate: timestamp("next_review_date").notNull().defaultNow(),
  correctCount: integer("correct_count").notNull().default(0), // Lifetime correct reviews
  incorrectCount: integer("incorrect_count").notNull().default(0), // Lifetime incorrect reviews
  repetition: integer("repetition").notNull().default(0), // Consecutive correct reviews (resets on failure)
  easeFactor: real("ease_factor").notNull().default(2.5), // SM-2 algorithm default
  interval: integer("interval").notNull().default(1), // Days until next review
  createdAt: timestamp("created_at").notNull().defaultNow(), // Track when word was learned
}, (table) => [
  index("idx_vocabulary_user_id").on(table.userId),
  index("idx_vocabulary_source_conversation").on(table.sourceConversationId),
  index("idx_vocabulary_word_type").on(table.wordType),
  index("idx_vocabulary_class").on(table.classId),
]);

export const grammarExercises = pgTable("grammar_exercises", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  language: text("language").notNull(),
  difficulty: text("difficulty").notNull(),
  // ACTFL standards tracking
  actflLevel: text("actfl_level"), // novice_low, novice_mid, etc.
  // Link to grammar competency for organized practice
  competencyId: varchar("competency_id"), // References grammarCompetencies
  question: text("question").notNull(),
  options: text("options").array().notNull(),
  correctAnswer: integer("correct_answer").notNull(),
  explanation: text("explanation").notNull(),
  // Exercise type for varied practice
  exerciseType: text("exercise_type").default("multiple_choice"), // multiple_choice, fill_blank, error_correction, conjugation
  // Hint for micro-coaching
  hint: text("hint"), // Optional hint for struggling learners
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_grammar_exercises_language").on(table.language),
  index("idx_grammar_exercises_competency").on(table.competencyId),
]);

// Grammar category enum for organizing competencies
export const grammarCategoryEnum = pgEnum('grammar_category', [
  'verb_tense',        // Present, Past, Future, Conditional, etc.
  'verb_mood',         // Indicative, Subjunctive, Imperative
  'verb_aspect',       // Simple, Progressive, Perfect
  'verb_type',         // Regular, Irregular, Reflexive, Modal
  'noun_agreement',    // Gender, Number
  'pronoun',           // Subject, Object, Reflexive, Possessive
  'adjective',         // Agreement, Placement, Comparison
  'adverb',            // Formation, Placement
  'preposition',       // Usage, Contractions
  'article',           // Definite, Indefinite, Partitive
  'sentence_structure', // Word order, Questions, Negation
  'clause',            // Relative, Conditional, Temporal
]);

// Master grammar competencies - ACTFL-aligned grammar forms
export const grammarCompetencies = pgTable("grammar_competencies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Core identification
  name: text("name").notNull(), // e.g., "Present Tense - Regular Verbs"
  slug: text("slug").notNull(), // e.g., "present-tense-regular"
  language: text("language").notNull(), // spanish, french, etc.
  // Categorization
  category: grammarCategoryEnum("category").notNull(), // verb_tense, verb_mood, etc.
  subcategory: text("subcategory"), // e.g., "regular", "irregular", "stem-changing"
  // ACTFL alignment
  actflLevel: text("actfl_level").notNull(), // novice_low through distinguished
  actflLevelNumeric: integer("actfl_level_numeric").notNull(), // 1-11 for sorting
  // Content
  description: text("description").notNull(), // Full explanation for Grammar Hub
  shortExplanation: text("short_explanation").notNull(), // 1-2 sentences for micro-coaching
  examples: text("examples").array().notNull(), // Example sentences with translations
  commonMistakes: text("common_mistakes").array(), // Typical errors to watch for
  // Teaching metadata
  prerequisiteIds: text("prerequisite_ids").array(), // Competencies that should be learned first
  difficultyScore: integer("difficulty_score").notNull().default(1), // 1-10 relative difficulty
  estimatedMinutes: integer("estimated_minutes").notNull().default(15), // Time to master
  // Applicable verb/noun info (for conjugation drills)
  paradigmJson: text("paradigm_json"), // JSON with full conjugation/declension table
  // Status
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_grammar_competencies_language").on(table.language),
  index("idx_grammar_competencies_actfl").on(table.actflLevel),
  index("idx_grammar_competencies_category").on(table.category),
  index("idx_grammar_competencies_slug").on(table.slug),
]);

// User progress on grammar competencies
export const userGrammarProgress = pgTable("user_grammar_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  competencyId: varchar("competency_id").notNull(), // References grammarCompetencies
  language: text("language").notNull(),
  // Mastery tracking
  masteryLevel: integer("mastery_level").notNull().default(0), // 0-100 percentage
  exercisesCompleted: integer("exercises_completed").notNull().default(0),
  exercisesCorrect: integer("exercises_correct").notNull().default(0),
  // Spaced repetition for grammar
  nextReviewDate: timestamp("next_review_date"),
  repetition: integer("repetition").notNull().default(0), // Consecutive correct (SM-2)
  easeFactor: real("ease_factor").notNull().default(2.5),
  interval: integer("interval").notNull().default(1), // Days until next review
  // Voice session usage
  usedInConversation: boolean("used_in_conversation").notNull().default(false),
  conversationUsageCount: integer("conversation_usage_count").notNull().default(0),
  lastConversationUse: timestamp("last_conversation_use"),
  // Timestamps
  firstPracticed: timestamp("first_practiced"),
  lastPracticed: timestamp("last_practiced"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_user_grammar_progress_user").on(table.userId),
  index("idx_user_grammar_progress_user_lang").on(table.userId, table.language),
  index("idx_user_grammar_progress_competency").on(table.competencyId),
]);

// Grammar errors detected during voice sessions (telemetry)
export const grammarErrors = pgTable("grammar_errors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  conversationId: varchar("conversation_id").references(() => conversations.id),
  messageId: varchar("message_id"), // References messages.id
  language: text("language").notNull(),
  // Error details
  competencyId: varchar("competency_id"), // References grammarCompetencies if identifiable
  errorCategory: grammarCategoryEnum("error_category"), // Which grammar area
  errorType: text("error_type").notNull(), // Specific error type (e.g., "verb_conjugation", "gender_agreement")
  // Context
  userText: text("user_text").notNull(), // What the user said/wrote
  correctedText: text("corrected_text"), // Correct version
  explanation: text("explanation"), // Why it was wrong
  // Tracking
  wasAddressed: boolean("was_addressed").notNull().default(false), // Did we show micro-coaching?
  wasPracticed: boolean("was_practiced").notNull().default(false), // Did user complete follow-up drill?
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_grammar_errors_user").on(table.userId),
  index("idx_grammar_errors_user_lang").on(table.userId, table.language),
  index("idx_grammar_errors_competency").on(table.competencyId),
  index("idx_grammar_errors_conversation").on(table.conversationId),
]);

// Grammar assignments for teachers
export const grammarAssignments = pgTable("grammar_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  classId: varchar("class_id").notNull(), // References teacherClasses
  teacherId: varchar("teacher_id").notNull().references(() => users.id),
  // Assignment details
  title: text("title").notNull(),
  description: text("description"),
  competencyIds: text("competency_ids").array().notNull(), // Grammar topics to cover
  // Requirements
  minExercises: integer("min_exercises").notNull().default(10), // Minimum exercises to complete
  minScore: integer("min_score").notNull().default(70), // Minimum % to pass
  // Schedule
  dueDate: timestamp("due_date"),
  isPublished: boolean("is_published").notNull().default(false),
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_grammar_assignments_class").on(table.classId),
  index("idx_grammar_assignments_teacher").on(table.teacherId),
]);

// Student submissions for grammar assignments
export const grammarAssignmentSubmissions = pgTable("grammar_assignment_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").notNull(), // References grammarAssignments
  studentId: varchar("student_id").notNull().references(() => users.id),
  // Progress
  exercisesCompleted: integer("exercises_completed").notNull().default(0),
  exercisesCorrect: integer("exercises_correct").notNull().default(0),
  score: integer("score"), // Final percentage (null if incomplete)
  // Status
  status: text("status").notNull().default("not_started"), // not_started, in_progress, completed, graded
  submittedAt: timestamp("submitted_at"),
  gradedAt: timestamp("graded_at"),
  teacherFeedback: text("teacher_feedback"),
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_grammar_submissions_assignment").on(table.assignmentId),
  index("idx_grammar_submissions_student").on(table.studentId),
]);

// Insert and Select schemas for grammar tables
export const insertGrammarExerciseSchema = createInsertSchema(grammarExercises).omit({
  id: true,
  createdAt: true,
});

export const insertGrammarCompetencySchema = createInsertSchema(grammarCompetencies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserGrammarProgressSchema = createInsertSchema(userGrammarProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGrammarErrorSchema = createInsertSchema(grammarErrors).omit({
  id: true,
  createdAt: true,
});

export const insertGrammarAssignmentSchema = createInsertSchema(grammarAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGrammarAssignmentSubmissionSchema = createInsertSchema(grammarAssignmentSubmissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertGrammarExercise = z.infer<typeof insertGrammarExerciseSchema>;
export type GrammarExercise = typeof grammarExercises.$inferSelect;

export type InsertGrammarCompetency = z.infer<typeof insertGrammarCompetencySchema>;
export type GrammarCompetency = typeof grammarCompetencies.$inferSelect;

export type InsertUserGrammarProgress = z.infer<typeof insertUserGrammarProgressSchema>;
export type UserGrammarProgress = typeof userGrammarProgress.$inferSelect;

export type InsertGrammarError = z.infer<typeof insertGrammarErrorSchema>;
export type GrammarError = typeof grammarErrors.$inferSelect;

export type InsertGrammarAssignment = z.infer<typeof insertGrammarAssignmentSchema>;
export type GrammarAssignment = typeof grammarAssignments.$inferSelect;

export type InsertGrammarAssignmentSubmission = z.infer<typeof insertGrammarAssignmentSubmissionSchema>;
export type GrammarAssignmentSubmission = typeof grammarAssignmentSubmissions.$inferSelect;

export const userProgress = pgTable("user_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
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
  // ACTFL proficiency tracking
  currentActflLevel: text("current_actfl_level"), // Current assessed ACTFL level for this language
  lastActflAssessment: timestamp("last_actfl_assessment"), // When ACTFL level was last updated
});

// ACTFL FACT Criteria Progress Tracking
// Tracks evidence-based progression aligned with ACTFL 2024 Guidelines
export const actflProgress = pgTable("actfl_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  language: text("language").notNull(),
  
  // F - Functions: Communication tasks student can handle
  tasksCompleted: text("tasks_completed").array().default(sql`ARRAY[]::text[]`), // e.g., ["greetings", "ordering_food", "describing_family"]
  tasksTotal: integer("tasks_total").notNull().default(0), // Total unique tasks mastered
  
  // A - Accuracy: Linguistic control (pronunciation, grammar, vocab)
  avgPronunciationConfidence: real("avg_pronunciation_confidence").default(0), // From Deepgram (0-1 scale)
  totalVoiceMessages: integer("total_voice_messages").default(0),
  grammarScore: real("grammar_score").default(0), // From AI assessment (0-1 scale)
  vocabularyScore: real("vocabulary_score").default(0), // From AI assessment (0-1 scale)
  
  // C - Context: Range of situations and topics
  topicsCovered: text("topics_covered").array().default(sql`ARRAY[]::text[]`), // e.g., ["family", "school", "hobbies", "travel"]
  topicsTotal: integer("topics_total").notNull().default(0), // Total unique topics covered
  
  // T - Text Type: Discourse complexity level
  textType: text("text_type").default('words'), // "words", "sentences", "paragraphs", "multi_paragraph"
  avgMessageLength: real("avg_message_length").default(0), // Average words per user message
  longestMessageLength: integer("longest_message_length").default(0), // Longest coherent message
  
  // Time-based progression (ACTFL requires sustained performance)
  practiceHours: real("practice_hours").default(0), // Total practice time in hours
  messagesAtCurrentLevel: integer("messages_at_current_level").default(0), // Messages since last level change
  daysAtCurrentLevel: integer("days_at_current_level").default(0), // Days at current ACTFL level
  lastAdvancement: timestamp("last_advancement"), // Last ACTFL level change
  
  // Overall assessment
  currentActflLevel: text("current_actfl_level").default('novice_low'),
  readyForAdvancement: boolean("ready_for_advancement").default(false), // AI recommendation
  advancementReason: text("advancement_reason"), // Why student is/isn't ready
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_actfl_progress_user_language").on(table.userId, table.language),
]);

export const insertActflProgressSchema = createInsertSchema(actflProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertActflProgress = z.infer<typeof insertActflProgressSchema>;
export type ActflProgress = typeof actflProgress.$inferSelect;

export const progressHistory = pgTable("progress_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
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

// Topic type enum: subject (travel, food), grammar (past tense, subjunctive), function (asking questions)
export const topicTypeEnum = pgEnum('topic_type', ['subject', 'grammar', 'function']);

export const topics = pgTable("topics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  topicType: topicTypeEnum("topic_type").notNull().default('subject'), // subject, grammar, or function
  category: text("category").notNull(), // e.g., "Daily Life", "Travel", "Business" OR "Verb Tenses", "Mood"
  icon: text("icon").notNull(), // Lucide icon name
  samplePhrases: text("sample_phrases").array().notNull(),
  difficulty: text("difficulty"), // Optional difficulty recommendation
  // Grammar-specific fields
  grammarConcept: text("grammar_concept"), // For grammar topics: "past_tense", "subjunctive", etc.
  applicableLanguages: text("applicable_languages").array(), // Languages this grammar applies to (null = all)
  actflLevelRange: text("actfl_level_range"), // e.g., "novice_high-intermediate_mid"
}, (table) => [
  index("idx_topics_type").on(table.topicType),
  index("idx_topics_category").on(table.category),
]);

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

// ===== Dual-Path Learning System: Institutional Features =====

// ACTFL Can-Do Statements for progress tracking
export const canDoStatements = pgTable("can_do_statements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  language: text("language").notNull(), // spanish, french, etc.
  actflLevel: text("actfl_level").notNull(), // novice_low, novice_mid, etc.
  category: text("category").notNull(), // interpersonal, interpretive, presentational
  mode: text("mode"), // speaking, listening, reading, writing
  statement: text("statement").notNull(), // "I can greet someone and introduce myself"
  description: text("description"), // Additional context/examples
});

// Student progress on Can-Do statements
export const studentCanDoProgress = pgTable("student_can_do_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  canDoStatementId: varchar("can_do_statement_id").notNull().references(() => canDoStatements.id),
  selfAssessed: boolean("self_assessed").default(false), // Student marked as achieved
  teacherVerified: boolean("teacher_verified").default(false), // Teacher confirmed
  aiDetected: boolean("ai_detected").default(false), // AI detected evidence in conversations
  dateAchieved: timestamp("date_achieved"),
  evidenceConversationId: varchar("evidence_conversation_id").references(() => conversations.id), // Conversation that demonstrated this skill
  notes: text("notes"), // Teacher notes
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Structured curriculum paths (e.g., "Spanish 1 - High School")
export const curriculumPaths = pgTable("curriculum_paths", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // "Spanish 1 - High School"
  description: text("description").notNull(),
  language: text("language").notNull(),
  targetAudience: text("target_audience"), // "High School", "Middle School", "Adult Learners"
  startLevel: text("start_level").notNull(), // novice_low
  endLevel: text("end_level").notNull(), // intermediate_low
  estimatedHours: integer("estimated_hours"), // 150 hours
  isPublished: boolean("is_published").default(false),
  createdBy: varchar("created_by").references(() => users.id), // Teacher who created it
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Units within a curriculum path
export const curriculumUnits = pgTable("curriculum_units", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  curriculumPathId: varchar("curriculum_path_id").notNull().references(() => curriculumPaths.id),
  name: text("name").notNull(), // "Unit 1: Greetings & Introductions"
  description: text("description").notNull(),
  orderIndex: integer("order_index").notNull(), // Order within the path
  actflLevel: text("actfl_level"), // Target proficiency level for this unit
  culturalTheme: text("cultural_theme"), // Cultural focus of the unit
  estimatedHours: integer("estimated_hours"),
});

// Individual lessons within a unit
export const curriculumLessons = pgTable("curriculum_lessons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  curriculumUnitId: varchar("curriculum_unit_id").notNull().references(() => curriculumUnits.id),
  name: text("name").notNull(), // "Lesson 1: Basic Greetings"
  description: text("description").notNull(),
  orderIndex: integer("order_index").notNull(), // Order within the unit
  lessonType: text("lesson_type").notNull(), // conversation, vocabulary, grammar, cultural_exploration
  actflLevel: text("actfl_level"),
  // Lesson content
  conversationTopic: text("conversation_topic"), // Topic for AI conversation
  conversationPrompt: text("conversation_prompt"), // System prompt for this lesson
  // Learning objectives
  objectives: text("objectives").array(), // What students should be able to do
  estimatedMinutes: integer("estimated_minutes"), // Expected completion time
  // Competency mapping - links to topic slugs for automatic coverage detection
  requiredTopics: text("required_topics").array(), // e.g., ["greetings-introductions", "making-requests"]
  requiredVocabulary: text("required_vocabulary").array(), // Key words that must be mastered
  requiredGrammar: text("required_grammar").array(), // Grammar concepts (e.g., "present_tense", "noun-adjective-agreement")
  minPronunciationScore: real("min_pronunciation_score"), // Minimum pronunciation confidence (0-1)
});

// Institutional hour packages for classes (tracks purchased allocations)
export const classHourPackages = pgTable("class_hour_packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // "Basic 10-Hour Package", "Standard 20-Hour Package", "Premium 30-Hour Package"
  hoursPerStudent: integer("hours_per_student").notNull(), // Hours allocated per enrolled student
  totalPurchasedHours: integer("total_purchased_hours"), // Total hours purchased for this package (if bulk)
  usedHours: integer("used_hours").default(0), // Total hours used across all allocations
  pricePerStudent: integer("price_per_student"), // Price in cents per student (e.g., 5000 = $50)
  purchasedAt: timestamp("purchased_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // When this package expires
  purchaserId: varchar("purchaser_id").references(() => users.id), // Teacher, admin, or institution
  status: varchar("status").default("active"), // active, expired, exhausted
  stripeSubscriptionId: varchar("stripe_subscription_id"), // For Stripe linkage
  metadata: text("metadata"), // JSON for additional contract details
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Teacher classes (for structured path)
export const teacherClasses = pgTable("teacher_classes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teacherId: varchar("teacher_id").notNull().references(() => users.id),
  createdById: varchar("created_by_id").references(() => users.id), // Track who created this (teacher or admin)
  name: text("name").notNull(), // "Spanish 1 - Period 3"
  description: text("description"),
  language: text("language").notNull(),
  curriculumPathId: varchar("curriculum_path_id").references(() => curriculumPaths.id), // Optional: link to structured curriculum
  joinCode: varchar("join_code").unique().notNull(), // 6-digit code for students to join
  isActive: boolean("is_active").default(true),
  isPublicCatalogue: boolean("is_public_catalogue").default(false), // If true, class is visible in public catalogue and allows self-enrollment
  hoursPerStudent: integer("hours_per_student"), // Legacy: base hours allocated (moved to classHourPackages)
  hourPackageId: varchar("hour_package_id").references(() => classHourPackages.id), // Link to purchased hour package
  hoursPerStudentOverride: integer("hours_per_student_override"), // Optional per-class override
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Class enrollment (students in classes)
export const classEnrollments = pgTable("class_enrollments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  classId: varchar("class_id").notNull().references(() => teacherClasses.id),
  studentId: varchar("student_id").notNull().references(() => users.id),
  enrolledAt: timestamp("enrolled_at").notNull().defaultNow(),
  isActive: boolean("is_active").default(true),
  // Hour allocation for this enrollment
  allocatedSeconds: integer("allocated_seconds").default(0), // Total hours allocated (in seconds, e.g., 36000 = 10 hrs)
  usedSeconds: integer("used_seconds").default(0), // Hours used so far
  // Pacing status for falling-behind warnings
  paceStatus: varchar("pace_status").default("on_track"), // on_track, ahead, behind, critical
  expectedProgressPercent: real("expected_progress_percent"), // Where student should be based on time elapsed
  actualProgressPercent: real("actual_progress_percent"), // Where student actually is
}, (table) => [
  index("idx_class_enrollments_student").on(table.studentId),
  index("idx_class_enrollments_class").on(table.classId),
]);

// Teacher assignments
export const assignments = pgTable("assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  classId: varchar("class_id").notNull().references(() => teacherClasses.id),
  teacherId: varchar("teacher_id").notNull().references(() => users.id),
  title: text("title").notNull(), // "Week 1: Greetings Practice"
  description: text("description"),
  assignmentType: text("assignment_type").notNull(), // conversation, vocabulary_review, grammar_exercise, curriculum_lesson
  // Assignment content
  curriculumLessonId: varchar("curriculum_lesson_id").references(() => curriculumLessons.id), // Link to curriculum lesson
  conversationTopic: text("conversation_topic"), // For conversation assignments
  targetMinutes: integer("target_minutes"), // Expected practice time
  targetMessageCount: integer("target_message_count"), // For conversation practice
  // Deadlines
  dueDate: timestamp("due_date"),
  isPublished: boolean("is_published").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Student assignment submissions
export const assignmentSubmissions = pgTable("assignment_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").notNull().references(() => assignments.id),
  studentId: varchar("student_id").notNull().references(() => users.id),
  conversationId: varchar("conversation_id").references(() => conversations.id), // Conversation for this assignment
  status: text("status").default("not_started"), // not_started, in_progress, submitted, graded
  // Completion tracking
  minutesCompleted: integer("minutes_completed").default(0),
  messagesCompleted: integer("messages_completed").default(0),
  vocabularyMastered: integer("vocabulary_mastered").default(0),
  // Grading
  teacherScore: integer("teacher_score"), // 0-100
  teacherFeedback: text("teacher_feedback"),
  aiScore: integer("ai_score"), // Auto-calculated based on performance
  submittedAt: timestamp("submitted_at"),
  gradedAt: timestamp("graded_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Syllabus progress - tracks lesson completion per student with organic vs assigned completion
export const syllabusProgress = pgTable("syllabus_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull().references(() => users.id),
  classId: varchar("class_id").notNull().references(() => teacherClasses.id),
  lessonId: varchar("lesson_id").notNull().references(() => curriculumLessons.id),
  // Completion status
  status: syllabusStatusEnum("status").default("not_started"), // not_started, in_progress, completed_early, completed_assigned, skipped
  // Evidence of completion
  evidenceConversationId: varchar("evidence_conversation_id").references(() => conversations.id), // Conversation that covered this lesson
  evidenceType: text("evidence_type"), // organic_conversation, assigned_practice, quick_review
  // Competency scores at time of completion
  topicsCoveredCount: integer("topics_covered_count").default(0), // How many required topics were covered
  vocabularyMastered: integer("vocabulary_mastered").default(0), // How many required words were mastered
  grammarScore: real("grammar_score"), // Grammar accuracy during completion (0-1)
  pronunciationScore: real("pronunciation_score"), // Avg pronunciation confidence (0-1)
  // Tutor verification
  tutorVerified: boolean("tutor_verified").default(false), // Did AI tutor confirm competency?
  tutorNotes: text("tutor_notes"), // AI assessment notes
  // Timing
  completedAt: timestamp("completed_at"),
  scheduledDate: timestamp("scheduled_date"), // When this lesson was supposed to be done (per syllabus)
  daysAhead: integer("days_ahead"), // Positive = completed early, negative = late
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_syllabus_progress_student").on(table.studentId),
  index("idx_syllabus_progress_class").on(table.classId),
  index("idx_syllabus_progress_lesson").on(table.lessonId),
  index("idx_syllabus_progress_status").on(table.status),
]);

// ===== Usage Tracking & Credit System =====

// Entitlement type enum - how credits were earned
export const entitlementTypeEnum = pgEnum('entitlement_type', ['class_allocation', 'purchase', 'bonus', 'trial']);

// Voice session status enum
export const voiceSessionStatusEnum = pgEnum('voice_session_status', ['active', 'completed', 'abandoned', 'error']);

// Voice sessions - tracks each tutoring session with timing and exchange data
export const voiceSessions = pgTable("voice_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  conversationId: varchar("conversation_id").references(() => conversations.id),
  // Session timing
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
  durationSeconds: integer("duration_seconds").default(0), // Total session time
  // Exchange tracking
  exchangeCount: integer("exchange_count").default(0), // Number of back-and-forth turns
  studentSpeakingSeconds: integer("student_speaking_seconds").default(0),
  tutorSpeakingSeconds: integer("tutor_speaking_seconds").default(0),
  // Cost tracking (for internal analytics)
  ttsCharacters: integer("tts_characters").default(0), // Characters sent to TTS
  sttSeconds: integer("stt_seconds").default(0), // Seconds of STT processing
  // Session metadata
  language: varchar("language"),
  status: voiceSessionStatusEnum("status").default("active"),
  // Class context (if enrolled)
  classId: varchar("class_id").references(() => teacherClasses.id),
}, (table) => [
  index("idx_voice_sessions_user").on(table.userId),
  index("idx_voice_sessions_started").on(table.startedAt),
  index("idx_voice_sessions_class").on(table.classId),
]);

// Usage ledger - credit transactions (earned and consumed)
export const usageLedger = pgTable("usage_ledger", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  // Credit amount (positive = earned, negative = consumed)
  creditSeconds: integer("credit_seconds").notNull(), // Time in seconds (3600 = 1 hour)
  // Source of credits
  entitlementType: entitlementTypeEnum("entitlement_type").notNull(),
  description: text("description"), // "Class enrollment: Spanish 101", "Purchased: 10 Hour Package"
  // References
  classId: varchar("class_id").references(() => teacherClasses.id), // For class allocations
  voiceSessionId: varchar("voice_session_id").references(() => voiceSessions.id), // For consumption
  stripePaymentId: varchar("stripe_payment_id"), // For purchases
  // Expiration
  expiresAt: timestamp("expires_at"), // null = never expires
  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_usage_ledger_user").on(table.userId),
  index("idx_usage_ledger_created").on(table.createdAt),
  index("idx_usage_ledger_expires").on(table.expiresAt),
]);

// Hour packages - defines purchasable hour bundles
export const hourPackages = pgTable("hour_packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(), // "Try It", "Starter", "Regular", "Committed"
  description: text("description"),
  hours: integer("hours").notNull(), // Number of hours
  priceInCents: integer("price_in_cents").notNull(), // Price in cents (e.g., 1200 = $12)
  stripePriceId: varchar("stripe_price_id"), // Stripe price ID for checkout
  // Package type
  isInstitutional: boolean("is_institutional").default(false), // For class packages vs individual
  // Validity
  validityDays: integer("validity_days"), // null = never expires, e.g., 365 for 1 year
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== Admin System Tables =====

// Admin audit log for tracking all admin actions
export const adminAuditLog = pgTable("admin_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actorId: varchar("actor_id").notNull().references(() => users.id), // Admin who performed the action
  action: text("action").notNull(), // "change_user_role", "delete_class", "impersonate_user", etc.
  targetType: text("target_type"), // "user", "class", "assignment", "system"
  targetId: varchar("target_id"), // ID of the affected entity
  metadata: jsonb("metadata"), // Additional data: { from: 'student', to: 'teacher', reason: '...' }
  ipAddress: varchar("ip_address"), // Optional: track IP for security
  userAgent: text("user_agent"), // Optional: track browser/device
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_admin_audit_actor").on(table.actorId),
  index("idx_admin_audit_target").on(table.targetType, table.targetId),
  index("idx_admin_audit_created").on(table.createdAt),
]);

// ===== Join Tables for Many-to-Many Relationships =====

// Links lessons to Can-Do statements
export const lessonCanDoStatements = pgTable("lesson_can_do_statements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  lessonId: varchar("lesson_id").notNull().references(() => curriculumLessons.id),
  canDoStatementId: varchar("can_do_statement_id").notNull().references(() => canDoStatements.id),
});

// Links lessons to cultural tips
export const lessonCulturalTips = pgTable("lesson_cultural_tips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  lessonId: varchar("lesson_id").notNull().references(() => curriculumLessons.id),
  culturalTipId: varchar("cultural_tip_id").notNull().references(() => culturalTips.id),
});

// Links assignments to vocabulary words
export const assignmentVocabulary = pgTable("assignment_vocabulary", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").notNull().references(() => assignments.id),
  vocabularyWordId: varchar("vocabulary_word_id").notNull().references(() => vocabularyWords.id),
});

// ===== Progress Tracking for Both Learning Paths =====

// Structured Path: Student progress through curriculum lessons
export const studentLessonProgress = pgTable("student_lesson_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull().references(() => users.id),
  lessonId: varchar("lesson_id").notNull().references(() => curriculumLessons.id),
  status: text("status").default("not_started"), // not_started, in_progress, completed
  minutesSpent: integer("minutes_spent").default(0),
  messagesCompleted: integer("messages_completed").default(0),
  conversationId: varchar("conversation_id").references(() => conversations.id), // Latest conversation for this lesson
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Open Path: Student-set learning goals
export const studentGoals = pgTable("student_goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull().references(() => users.id),
  language: text("language").notNull(),
  goalType: text("goal_type").notNull(), // conversation_hours, vocabulary_count, can_do_statements, custom
  title: text("title").notNull(), // "Practice 10 hours of conversation"
  description: text("description"),
  targetValue: integer("target_value"), // Numeric goal (e.g., 10 hours)
  currentValue: integer("current_value").default(0),
  isCompleted: boolean("is_completed").default(false),
  targetDate: timestamp("target_date"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ===== Multimedia Content System =====

// Core media files table - stores all images, videos, and audio
// Includes image caching for stock and AI-generated images to reduce costs and improve speed
export const mediaFiles = pgTable("media_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  uploadedBy: varchar("uploaded_by").references(() => users.id), // User who uploaded (null for system media)
  mediaType: text("media_type").notNull(), // image, video, audio
  url: text("url").notNull(), // URL or path to the media file
  thumbnailUrl: text("thumbnail_url"), // Thumbnail for videos/images
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(), // image/jpeg, video/mp4, audio/mpeg, etc.
  fileSize: integer("file_size"), // Bytes
  width: integer("width"), // For images/videos
  height: integer("height"), // For images/videos
  duration: integer("duration"), // Seconds (for video/audio)
  title: text("title"), // Optional descriptive title
  description: text("description"), // Optional description
  tags: text("tags").array(), // Searchable tags
  language: text("language"), // Relevant language (optional)
  // Image caching fields - for reducing API costs and improving speed
  imageSource: text("image_source"), // "stock" (Unsplash), "ai_generated" (DALL-E), "user_upload", null for non-cached
  searchQuery: text("search_query"), // For stock images - the Unsplash search query (e.g., "coffee", "sandwich")
  promptHash: text("prompt_hash"), // For AI images - hash of the prompt for cache lookups
  usageCount: integer("usage_count").default(0), // Track how often this cached image is reused
  attributionJson: text("attribution_json"), // JSON with attribution data (photographer, URLs for Unsplash)
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  // Indexes for fast cache lookups
  index("idx_media_search_query").on(table.searchQuery),
  index("idx_media_prompt_hash").on(table.promptHash),
]);

// Images shared in conversations (e.g., "What is this in Spanish?")
export const messageMedia = pgTable("message_media", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().references(() => messages.id),
  mediaFileId: varchar("media_file_id").notNull().references(() => mediaFiles.id),
  caption: text("caption"), // User's caption for the image
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Pre-recorded instructional video lessons
export const videoLessons = pgTable("video_lessons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  language: text("language").notNull(), // Target language
  difficultyLevel: text("difficulty_level").notNull(), // beginner, intermediate, advanced
  category: text("category").notNull(), // grammar, pronunciation, vocabulary, culture, conversation
  videoFileId: varchar("video_file_id").notNull().references(() => mediaFiles.id),
  duration: integer("duration").notNull(), // Seconds
  thumbnailUrl: text("thumbnail_url"),
  // ACTFL alignment
  actflLevel: text("actfl_level"), // Target proficiency level
  // Content organization
  tags: text("tags").array(), // Searchable tags
  topics: text("topics").array(), // Related conversation topics
  // Learning objectives
  objectives: text("objectives").array(), // What students will learn
  // Metadata
  viewCount: integer("view_count").default(0),
  isPublished: boolean("is_published").default(true),
  createdBy: varchar("created_by").references(() => users.id), // Creator (teacher/admin)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Supplementary pronunciation audio examples
export const pronunciationAudio = pgTable("pronunciation_audio", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  language: text("language").notNull(),
  text: text("text").notNull(), // The word/phrase being pronounced
  phoneticSpelling: text("phonetic_spelling"), // IPA or simplified phonetic
  audioFileId: varchar("audio_file_id").notNull().references(() => mediaFiles.id),
  // Optional links to vocabulary
  vocabularyWordId: varchar("vocabulary_word_id").references(() => vocabularyWords.id),
  // Metadata
  nativeSpeaker: boolean("native_speaker").default(true), // Is this a native speaker recording?
  speed: text("speed").default("normal"), // slow, normal, fast
  gender: text("gender"), // male, female, neutral (optional)
  dialectRegion: text("dialect_region"), // e.g., "Castilian Spanish", "Mexican Spanish"
  tags: text("tags").array(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Visual aids for lessons (diagrams, illustrations, infographics)
export const lessonVisualAids = pgTable("lesson_visual_aids", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  lessonId: varchar("lesson_id").notNull().references(() => curriculumLessons.id),
  mediaFileId: varchar("media_file_id").notNull().references(() => mediaFiles.id),
  title: text("title").notNull(), // e.g., "Verb Conjugation Chart"
  description: text("description"),
  displayOrder: integer("display_order").notNull().default(0), // Order within the lesson
  isRequired: boolean("is_required").default(false), // Is this required viewing?
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Cultural media gallery (photos/videos for cultural context)
export const culturalTipMedia = pgTable("cultural_tip_media", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  culturalTipId: varchar("cultural_tip_id").references(() => culturalTips.id), // Optional link to specific tip
  language: text("language").notNull(),
  mediaFileId: varchar("media_file_id").notNull().references(() => mediaFiles.id),
  title: text("title").notNull(),
  caption: text("caption").notNull(), // Description of cultural significance
  category: text("category").notNull(), // greetings, dining, holidays, customs, landmarks, traditions
  region: text("region"), // Specific region/country (e.g., "Mexico", "Spain")
  tags: text("tags").array(),
  displayOrder: integer("display_order").default(0),
  isFeatured: boolean("is_featured").default(false), // Highlight in gallery
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ===== Organization System (Phases 2 & 3) =====

// Phase 2: AI-generated topic tags for conversations (auto-tagged by Gemini)
export const conversationTopics = pgTable("conversation_topics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id),
  topicId: varchar("topic_id").notNull().references(() => topics.id),
  confidence: real("confidence").default(1.0), // AI confidence score (0-1)
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_conversation_topics_conv").on(table.conversationId),
  index("idx_conversation_topics_topic").on(table.topicId),
]);

// Phase 2: Topic tags for vocabulary words
export const vocabularyWordTopics = pgTable("vocabulary_word_topics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vocabularyWordId: varchar("vocabulary_word_id").notNull().references(() => vocabularyWords.id),
  topicId: varchar("topic_id").notNull().references(() => topics.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_vocab_topics_word").on(table.vocabularyWordId),
  index("idx_vocab_topics_topic").on(table.topicId),
]);

// Phase 3: User-created lesson bundles (grouping conversations, vocab, and grammar)
export const userLessons = pgTable("user_lessons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: text("title").notNull(), // "Spanish Week 1" or AI-suggested title
  description: text("description"), // Optional description
  language: text("language").notNull(),
  // Time range for auto-generated lessons
  startDate: timestamp("start_date"), // Earliest conversation included
  endDate: timestamp("end_date"), // Latest conversation included
  // Summary stats (cached for quick display)
  conversationCount: integer("conversation_count").default(0),
  vocabularyCount: integer("vocabulary_count").default(0),
  totalMinutes: integer("total_minutes").default(0),
  // AI-generated summary using Gemini's 2M context window
  aiSummary: text("ai_summary"), // What was learned, key topics covered
  aiSuggestions: text("ai_suggestions"), // Suggested next steps
  // Lesson type
  lessonType: text("lesson_type").default("manual"), // "manual", "weekly_auto", "topic_auto"
  isArchived: boolean("is_archived").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_user_lessons_user").on(table.userId),
  index("idx_user_lessons_date_range").on(table.userId, table.startDate, table.endDate),
]);

// Phase 3: Items within a lesson bundle
export const userLessonItems = pgTable("user_lesson_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  lessonId: varchar("lesson_id").notNull().references(() => userLessons.id),
  itemType: text("item_type").notNull(), // "conversation", "vocabulary", "grammar_note"
  // Reference to the specific item (only one will be set)
  conversationId: varchar("conversation_id").references(() => conversations.id),
  vocabularyWordId: varchar("vocabulary_word_id").references(() => vocabularyWords.id),
  // For grammar notes (AI-generated insights)
  grammarNote: text("grammar_note"), // AI-generated grammar point from the lesson
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_lesson_items_lesson").on(table.lessonId),
]);

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
}).extend({
  content: z.string().min(1, "Message content is required").max(10000, "Message must be less than 10000 characters"),
});

export const insertVocabularyWordSchema = createInsertSchema(vocabularyWords).omit({
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

// ===== Dual-Path Learning System Types =====

export const insertCanDoStatementSchema = createInsertSchema(canDoStatements).omit({
  id: true,
});

export const insertStudentCanDoProgressSchema = createInsertSchema(studentCanDoProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCurriculumPathSchema = createInsertSchema(curriculumPaths).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(1, "Name is required").max(200, "Name must be less than 200 characters").trim(),
  description: z.string().min(1, "Description is required").max(2000, "Description must be less than 2000 characters").trim(),
});

export const insertCurriculumUnitSchema = createInsertSchema(curriculumUnits).omit({
  id: true,
}).extend({
  name: z.string().min(1, "Name is required").max(200, "Name must be less than 200 characters").trim(),
  description: z.string().min(1, "Description is required").max(2000, "Description must be less than 2000 characters").trim(),
});

export const insertCurriculumLessonSchema = createInsertSchema(curriculumLessons).omit({
  id: true,
}).extend({
  name: z.string().min(1, "Name is required").max(200, "Name must be less than 200 characters").trim(),
  description: z.string().min(1, "Description is required").max(2000, "Description must be less than 2000 characters").trim(),
  conversationPrompt: z.string().max(5000, "Prompt must be less than 5000 characters").optional(),
});

export const insertClassHourPackageSchema = createInsertSchema(classHourPackages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTeacherClassSchema = createInsertSchema(teacherClasses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(1, "Class name is required").max(100, "Class name must be less than 100 characters").trim(),
  description: z.string().max(1000, "Description must be less than 1000 characters").optional(),
});

export const insertClassEnrollmentSchema = createInsertSchema(classEnrollments).omit({
  id: true,
  enrolledAt: true,
});

export const insertAssignmentSchema = createInsertSchema(assignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  title: z.string().min(1, "Title is required").max(200, "Title must be less than 200 characters").trim(),
  description: z.string().max(5000, "Description must be less than 5000 characters").optional(),
  conversationTopic: z.string().max(500, "Topic must be less than 500 characters").optional(),
});

export const insertAssignmentSubmissionSchema = createInsertSchema(assignmentSubmissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  teacherFeedback: z.string().max(5000, "Feedback must be less than 5000 characters").optional(),
});

export const insertSyllabusProgressSchema = createInsertSchema(syllabusProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSyllabusProgress = z.infer<typeof insertSyllabusProgressSchema>;
export type SyllabusProgress = typeof syllabusProgress.$inferSelect;

export const insertAdminAuditLogSchema = createInsertSchema(adminAuditLog).omit({
  id: true,
  createdAt: true,
}).extend({
  action: z.string().min(1, "Action is required").max(100, "Action must be less than 100 characters").trim(),
  targetType: z.string().max(50, "Target type must be less than 50 characters").optional(),
  targetId: z.string().optional(),
});

export type InsertCanDoStatement = z.infer<typeof insertCanDoStatementSchema>;
export type CanDoStatement = typeof canDoStatements.$inferSelect;

export type InsertStudentCanDoProgress = z.infer<typeof insertStudentCanDoProgressSchema>;
export type StudentCanDoProgress = typeof studentCanDoProgress.$inferSelect;

export type InsertCurriculumPath = z.infer<typeof insertCurriculumPathSchema>;
export type CurriculumPath = typeof curriculumPaths.$inferSelect;

export type InsertCurriculumUnit = z.infer<typeof insertCurriculumUnitSchema>;
export type CurriculumUnit = typeof curriculumUnits.$inferSelect;

export type InsertCurriculumLesson = z.infer<typeof insertCurriculumLessonSchema>;
export type CurriculumLesson = typeof curriculumLessons.$inferSelect;

export type InsertClassHourPackage = z.infer<typeof insertClassHourPackageSchema>;
export type ClassHourPackage = typeof classHourPackages.$inferSelect;

export type InsertTeacherClass = z.infer<typeof insertTeacherClassSchema>;
export type TeacherClass = typeof teacherClasses.$inferSelect;

export type InsertClassEnrollment = z.infer<typeof insertClassEnrollmentSchema>;
export type ClassEnrollment = typeof classEnrollments.$inferSelect;

export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;
export type Assignment = typeof assignments.$inferSelect;

export type InsertAssignmentSubmission = z.infer<typeof insertAssignmentSubmissionSchema>;
export type AssignmentSubmission = typeof assignmentSubmissions.$inferSelect;

export type InsertAdminAuditLog = z.infer<typeof insertAdminAuditLogSchema>;
export type AdminAuditLog = typeof adminAuditLog.$inferSelect;

// ===== Usage Tracking & Credit System Types =====

export const insertVoiceSessionSchema = createInsertSchema(voiceSessions).omit({
  id: true,
  startedAt: true,
});

export const insertUsageLedgerSchema = createInsertSchema(usageLedger).omit({
  id: true,
  createdAt: true,
});

export const insertHourPackageSchema = createInsertSchema(hourPackages).omit({
  id: true,
  createdAt: true,
});

export type InsertVoiceSession = z.infer<typeof insertVoiceSessionSchema>;
export type VoiceSession = typeof voiceSessions.$inferSelect;

export type InsertUsageLedger = z.infer<typeof insertUsageLedgerSchema>;
export type UsageLedger = typeof usageLedger.$inferSelect;

export type InsertHourPackage = z.infer<typeof insertHourPackageSchema>;
export type HourPackage = typeof hourPackages.$inferSelect;

// ===== Join Table Types =====

export const insertLessonCanDoStatementSchema = createInsertSchema(lessonCanDoStatements).omit({
  id: true,
});

export const insertLessonCulturalTipSchema = createInsertSchema(lessonCulturalTips).omit({
  id: true,
});

export const insertAssignmentVocabularySchema = createInsertSchema(assignmentVocabulary).omit({
  id: true,
});

export const insertStudentLessonProgressSchema = createInsertSchema(studentLessonProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStudentGoalSchema = createInsertSchema(studentGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLessonCanDoStatement = z.infer<typeof insertLessonCanDoStatementSchema>;
export type LessonCanDoStatement = typeof lessonCanDoStatements.$inferSelect;

export type InsertLessonCulturalTip = z.infer<typeof insertLessonCulturalTipSchema>;
export type LessonCulturalTip = typeof lessonCulturalTips.$inferSelect;

export type InsertAssignmentVocabulary = z.infer<typeof insertAssignmentVocabularySchema>;
export type AssignmentVocabulary = typeof assignmentVocabulary.$inferSelect;

export type InsertStudentLessonProgress = z.infer<typeof insertStudentLessonProgressSchema>;
export type StudentLessonProgress = typeof studentLessonProgress.$inferSelect;

export type InsertStudentGoal = z.infer<typeof insertStudentGoalSchema>;
export type StudentGoal = typeof studentGoals.$inferSelect;

// ===== Multimedia Content Types =====

export const insertMediaFileSchema = createInsertSchema(mediaFiles).omit({
  id: true,
  createdAt: true,
});

export const insertMessageMediaSchema = createInsertSchema(messageMedia).omit({
  id: true,
  createdAt: true,
});

export const insertVideoLessonSchema = createInsertSchema(videoLessons).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPronunciationAudioSchema = createInsertSchema(pronunciationAudio).omit({
  id: true,
  createdAt: true,
});

export const insertLessonVisualAidSchema = createInsertSchema(lessonVisualAids).omit({
  id: true,
  createdAt: true,
});

export const insertCulturalTipMediaSchema = createInsertSchema(culturalTipMedia).omit({
  id: true,
  createdAt: true,
});

export type InsertMediaFile = z.infer<typeof insertMediaFileSchema>;
export type MediaFile = typeof mediaFiles.$inferSelect;

export type InsertMessageMedia = z.infer<typeof insertMessageMediaSchema>;
export type MessageMedia = typeof messageMedia.$inferSelect;

export type InsertVideoLesson = z.infer<typeof insertVideoLessonSchema>;
export type VideoLesson = typeof videoLessons.$inferSelect;

export type InsertPronunciationAudio = z.infer<typeof insertPronunciationAudioSchema>;
export type PronunciationAudio = typeof pronunciationAudio.$inferSelect;

export type InsertLessonVisualAid = z.infer<typeof insertLessonVisualAidSchema>;
export type LessonVisualAid = typeof lessonVisualAids.$inferSelect;

export type InsertCulturalTipMedia = z.infer<typeof insertCulturalTipMediaSchema>;
export type CulturalTipMedia = typeof culturalTipMedia.$inferSelect;

// ===== Organization System Types (Phases 2 & 3) =====

export const insertConversationTopicSchema = createInsertSchema(conversationTopics).omit({
  id: true,
  createdAt: true,
});

export const insertVocabularyWordTopicSchema = createInsertSchema(vocabularyWordTopics).omit({
  id: true,
  createdAt: true,
});

export const insertUserLessonSchema = createInsertSchema(userLessons).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  title: z.string().min(1, "Title is required").max(200, "Title must be less than 200 characters").trim(),
  description: z.string().max(2000, "Description must be less than 2000 characters").optional(),
});

export const insertUserLessonItemSchema = createInsertSchema(userLessonItems).omit({
  id: true,
  createdAt: true,
});

export type InsertConversationTopic = z.infer<typeof insertConversationTopicSchema>;
export type ConversationTopic = typeof conversationTopics.$inferSelect;

export type InsertVocabularyWordTopic = z.infer<typeof insertVocabularyWordTopicSchema>;
export type VocabularyWordTopic = typeof vocabularyWordTopics.$inferSelect;

export type InsertUserLesson = z.infer<typeof insertUserLessonSchema>;
export type UserLesson = typeof userLessons.$inferSelect;

export type InsertUserLessonItem = z.infer<typeof insertUserLessonItemSchema>;
export type UserLessonItem = typeof userLessonItems.$inferSelect;
