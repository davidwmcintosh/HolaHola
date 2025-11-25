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
  type Topic,
  type InsertTopic,
  type CulturalTip,
  type InsertCulturalTip,
  type User,
  type UpsertUser,
  type MediaFile,
  type InsertMediaFile,
  type MessageMedia,
  type InsertMessageMedia,
  type CanDoStatement,
  type StudentCanDoProgress,
  type InsertStudentCanDoProgress,
  type TeacherClass,
  type InsertTeacherClass,
  type ClassEnrollment,
  type InsertClassEnrollment,
  type CurriculumPath,
  type InsertCurriculumPath,
  type CurriculumUnit,
  type InsertCurriculumUnit,
  type CurriculumLesson,
  type InsertCurriculumLesson,
  type Assignment,
  type InsertAssignment,
  type AssignmentSubmission,
  type InsertAssignmentSubmission,
  type AdminAuditLog,
  type ConversationTopic,
  type InsertConversationTopic,
  type VocabularyWordTopic,
  type InsertVocabularyWordTopic,
  type UserLesson,
  type InsertUserLesson,
  type UserLessonItem,
  type InsertUserLessonItem,
  users,
  conversations,
  messages,
  vocabularyWords,
  grammarExercises,
  userProgress as userProgressTable,
  progressHistory as progressHistoryTable,
  pronunciationScores,
  topics as topicsTable,
  culturalTips as culturalTipsTable,
  mediaFiles,
  messageMedia,
  canDoStatements,
  studentCanDoProgress,
  teacherClasses,
  classEnrollments,
  curriculumPaths,
  curriculumUnits,
  curriculumLessons,
  assignments,
  assignmentSubmissions,
  adminAuditLog,
  conversationTopics,
  vocabularyWordTopics,
  userLessons,
  userLessonItems,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { markCorrect, markIncorrect } from "./spaced-repetition";
import { db } from "./db";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (Replit Auth Integration)
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserPreferences(userId: string, preferences: {
    targetLanguage?: string;
    nativeLanguage?: string;
    difficultyLevel?: string;
    onboardingCompleted?: boolean;
  }): Promise<User | undefined>;
  updateUserStripeInfo(userId: string, stripeInfo: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionTier?: string;
    subscriptionStatus?: string;
  }): Promise<User | undefined>;

  // Usage tracking for voice messages
  checkVoiceUsage(userId: string): Promise<{allowed: boolean, remaining: number, limit: number}>;
  incrementVoiceUsage(userId: string): Promise<void>;
  checkAndIncrementVoiceUsage(userId: string): Promise<{allowed: boolean, remaining: number, limit: number}>;
  getUserUsageStats(userId: string): Promise<{monthlyMessageCount: number, monthlyMessageLimit: number, remaining: number}>;
  resetMonthlyUsageIfNeeded(userId: string): Promise<void>;

  // Stripe data queries (from stripe-replit-sync PostgreSQL tables)
  getProduct(productId: string): Promise<any | null>;
  listProducts(active?: boolean, limit?: number, offset?: number): Promise<any[]>;
  getPrice(priceId: string): Promise<any | null>;
  listPrices(active?: boolean, limit?: number, offset?: number): Promise<any[]>;
  getSubscription(subscriptionId: string): Promise<any | null>;

  // Conversations
  createConversation(data: typeof conversations.$inferInsert): Promise<Conversation>;
  getConversation(id: string, userId: string): Promise<Conversation | undefined>;
  getUserConversations(userId: string): Promise<Conversation[]>;
  getConversationsByLanguage(language: string, userId: string): Promise<Conversation[]>;
  getConversationByLanguageAndDifficulty(language: string, difficulty: string, userId: string): Promise<Conversation | undefined>;
  updateConversation(id: string, userId: string, data: Partial<Conversation>): Promise<Conversation | undefined>;
  deleteConversation(id: string, userId: string): Promise<boolean>;

  // Messages
  createMessage(data: InsertMessage): Promise<Message>;
  getMessage(messageId: string, userId: string): Promise<Message | undefined>;
  getMessagesByConversation(conversationId: string): Promise<Message[]>;
  updateMessage(id: string, data: Partial<Message>): Promise<Message | undefined>;
  searchMessages(userId: string, query: string, limit?: number): Promise<Array<Message & { conversationTitle: string | null }>>;

  // Vocabulary
  createVocabularyWord(data: InsertVocabularyWord): Promise<VocabularyWord>;
  getVocabularyWord(id: string): Promise<VocabularyWord | undefined>;
  getVocabularyWords(language: string, userId: string, difficulty?: string): Promise<VocabularyWord[]>;
  updateVocabularyReview(id: string, isCorrect: boolean): Promise<VocabularyWord | undefined>;
  getDueVocabulary(language: string, userId: string, difficulty?: string, limit?: number): Promise<VocabularyWord[]>;

  // Grammar
  createGrammarExercise(data: InsertGrammarExercise): Promise<GrammarExercise>;
  getGrammarExercises(language: string, difficulty?: string): Promise<GrammarExercise[]>;

  // User Progress
  getOrCreateUserProgress(language: string, userId: string): Promise<UserProgress>;
  updateUserProgress(id: string, data: Partial<UserProgress>): Promise<UserProgress | undefined>;

  // Progress History
  createProgressHistory(data: InsertProgressHistory): Promise<ProgressHistory>;
  getProgressHistory(language: string, userId: string, days?: number): Promise<ProgressHistory[]>;

  // Pronunciation Scores
  createPronunciationScore(data: InsertPronunciationScore): Promise<PronunciationScore>;
  getPronunciationScoresByConversation(conversationId: string): Promise<PronunciationScore[]>;
  getPronunciationScoreByMessage(messageId: string): Promise<PronunciationScore | undefined>;
  getPronunciationScoreStats(conversationId: string): Promise<{ averageScore: number; totalScores: number }>;

  // Topics
  getTopics(): Promise<Topic[]>;
  getTopic(id: string): Promise<Topic | undefined>;
  createTopic(data: InsertTopic): Promise<Topic>;

  // Cultural Tips
  getCulturalTips(language: string): Promise<CulturalTip[]>;
  getCulturalTip(id: string): Promise<CulturalTip | undefined>;
  createCulturalTip(data: InsertCulturalTip): Promise<CulturalTip>;

  // Media Files
  createMediaFile(data: InsertMediaFile): Promise<MediaFile>;
  getMediaFile(id: string): Promise<MediaFile | undefined>;
  getUserMediaFiles(userId: string): Promise<MediaFile[]>;
  
  // Message Media (images in conversations)
  createMessageMedia(data: InsertMessageMedia): Promise<MessageMedia>;
  getMessageMedia(messageId: string): Promise<Array<MessageMedia & { mediaFile: MediaFile }>>;
  
  // Image Caching (for reducing API costs and improving speed)
  getCachedStockImage(searchQuery: string): Promise<MediaFile | undefined>;
  getCachedAIImage(promptHash: string): Promise<MediaFile | undefined>;
  cacheImage(data: InsertMediaFile): Promise<MediaFile>;
  incrementImageUsage(id: string): Promise<void>;

  // ACTFL Can-Do Statements
  getCanDoStatements(language?: string, actflLevel?: string, category?: string): Promise<CanDoStatement[]>;
  getCanDoStatement(id: string): Promise<CanDoStatement | undefined>;
  seedCanDoStatements(): Promise<void>;
  
  // Student Can-Do Progress
  getUserCanDoProgress(userId: string): Promise<StudentCanDoProgress[]>;
  toggleCanDoProgress(userId: string, statementId: string): Promise<StudentCanDoProgress | null>;
  getCanDoProgressByStatement(userId: string, statementId: string): Promise<StudentCanDoProgress | undefined>;

  // Teacher Classes
  createTeacherClass(data: InsertTeacherClass): Promise<TeacherClass>;
  getTeacherClass(id: string): Promise<TeacherClass | undefined>;
  getTeacherClasses(teacherId: string): Promise<TeacherClass[]>;
  updateTeacherClass(id: string, data: Partial<TeacherClass>): Promise<TeacherClass | undefined>;
  deleteTeacherClass(id: string): Promise<boolean>;
  getClassByJoinCode(joinCode: string): Promise<TeacherClass | undefined>;

  // Class Enrollments
  enrollStudent(classId: string, studentId: string): Promise<ClassEnrollment>;
  getClassEnrollments(classId: string): Promise<Array<ClassEnrollment & { student: User }>>;
  getStudentEnrollments(studentId: string): Promise<Array<ClassEnrollment & { class: TeacherClass }>>;
  unenrollStudent(classId: string, studentId: string): Promise<boolean>;
  isStudentEnrolled(classId: string, studentId: string): Promise<boolean>;

  // Curriculum Paths
  createCurriculumPath(data: InsertCurriculumPath): Promise<CurriculumPath>;
  getCurriculumPath(id: string): Promise<CurriculumPath | undefined>;
  getCurriculumPaths(language?: string): Promise<CurriculumPath[]>;
  updateCurriculumPath(id: string, data: Partial<CurriculumPath>): Promise<CurriculumPath | undefined>;

  // Curriculum Units
  createCurriculumUnit(data: InsertCurriculumUnit): Promise<CurriculumUnit>;
  getCurriculumUnits(curriculumPathId: string): Promise<CurriculumUnit[]>;
  getCurriculumUnit(id: string): Promise<CurriculumUnit | undefined>;

  // Curriculum Lessons
  createCurriculumLesson(data: InsertCurriculumLesson): Promise<CurriculumLesson>;
  getCurriculumLessons(curriculumUnitId: string): Promise<CurriculumLesson[]>;
  getCurriculumLesson(id: string): Promise<CurriculumLesson | undefined>;

  // Assignments
  createAssignment(data: InsertAssignment): Promise<Assignment>;
  getAssignment(id: string): Promise<Assignment | undefined>;
  getClassAssignments(classId: string): Promise<Assignment[]>;
  getTeacherAssignments(teacherId: string): Promise<Assignment[]>;
  updateAssignment(id: string, data: Partial<Assignment>): Promise<Assignment | undefined>;
  deleteAssignment(id: string): Promise<boolean>;

  // Assignment Submissions
  createAssignmentSubmission(data: InsertAssignmentSubmission): Promise<AssignmentSubmission>;
  getSubmissionById(id: string): Promise<AssignmentSubmission | undefined>;
  getAssignmentSubmission(assignmentId: string, studentId: string): Promise<AssignmentSubmission | undefined>;
  getStudentSubmissions(studentId: string): Promise<Array<AssignmentSubmission & { assignment: Assignment }>>;
  getAssignmentSubmissions(assignmentId: string): Promise<Array<AssignmentSubmission & { student: User }>>;
  updateAssignmentSubmission(id: string, data: Partial<AssignmentSubmission>): Promise<AssignmentSubmission | undefined>;

  // ===== Admin-Only Methods =====
  
  // User Management
  getAllUsers(options?: { role?: string; limit?: number; offset?: number }): Promise<{ users: User[]; total: number }>;
  updateUserRole(userId: string, newRole: 'student' | 'teacher' | 'developer' | 'admin'): Promise<User | undefined>;
  
  // Class Management (Platform-wide)
  getAllClasses(options?: { limit?: number; offset?: number }): Promise<{ classes: Array<TeacherClass & { teacher: User; enrollmentCount: number }>; total: number }>;
  getClassWithDetails(classId: string): Promise<(TeacherClass & { teacher: User; enrollmentCount: number; assignmentCount: number }) | undefined>;
  
  // Assignment Management (Platform-wide)
  getAllAssignments(options?: { limit?: number; offset?: number }): Promise<{ assignments: Array<Assignment & { class: TeacherClass; teacher: User }>; total: number }>;
  getAllSubmissions(options?: { limit?: number; offset?: number }): Promise<{ submissions: Array<AssignmentSubmission & { assignment: Assignment; student: User }>; total: number }>;
  
  // Platform Metrics
  getPlatformMetrics(): Promise<{
    totalUsers: number;
    totalStudents: number;
    totalTeachers: number;
    totalDevelopers: number;
    totalAdmins: number;
    totalClasses: number;
    totalAssignments: number;
    totalSubmissions: number;
    totalConversations: number;
  }>;
  
  // Growth Metrics (time-series data)
  getGrowthMetrics(days: number): Promise<{
    newUsers: Array<{ date: string; count: number }>;
    newClasses: Array<{ date: string; count: number }>;
    newAssignments: Array<{ date: string; count: number }>;
  }>;
  
  // Top Performers
  getTopTeachers(limit: number): Promise<Array<User & { classCount: number; studentCount: number }>>;
  getTopClasses(limit: number): Promise<Array<TeacherClass & { teacher: User; enrollmentCount: number }>>;
  
  // Audit Logging
  logAdminAction(data: {
    actorId: string;
    action: string;
    targetType?: string;
    targetId?: string;
    metadata?: any;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void>;
  getAdminAuditLogs(options?: { limit?: number; offset?: number; actorId?: string }): Promise<{ logs: any[]; total: number }>;
  
  // Impersonation
  startImpersonation(adminId: string, targetUserId: string, durationMinutes: number): Promise<User | undefined>;
  endImpersonation(userId: string): Promise<User | undefined>;
  getActiveImpersonations(): Promise<Array<User & { impersonatedUserEmail?: string }>>;

  // ===== Organization System (Phases 1, 2, 3) =====
  
  // Phase 1: Conversation starring and time-based filtering
  toggleConversationStar(id: string, userId: string): Promise<Conversation | undefined>;
  getFilteredConversations(userId: string, filter: {
    timeFilter?: 'today' | 'week' | 'month' | 'older';
    starredOnly?: boolean;
    topicId?: string;
  }): Promise<Conversation[]>;
  
  // Phase 1: Vocabulary time-based filtering
  getFilteredVocabulary(userId: string, language: string, filter: {
    timeFilter?: 'today' | 'week' | 'month' | 'older';
    topicId?: string;
    sourceConversationId?: string;
  }): Promise<VocabularyWord[]>;

  // Phase 2: Conversation topic tagging
  addConversationTopic(conversationId: string, topicId: string, confidence?: number): Promise<ConversationTopic>;
  getConversationTopics(conversationId: string): Promise<Array<ConversationTopic & { topic: Topic }>>;
  removeConversationTopic(conversationId: string, topicId: string): Promise<boolean>;

  // Phase 2: Vocabulary topic tagging
  addVocabularyWordTopic(vocabularyWordId: string, topicId: string): Promise<VocabularyWordTopic>;
  getVocabularyWordTopics(vocabularyWordId: string): Promise<Array<VocabularyWordTopic & { topic: Topic }>>;
  removeVocabularyWordTopic(vocabularyWordId: string, topicId: string): Promise<boolean>;

  // Phase 3: User Lessons (bundles)
  createUserLesson(data: InsertUserLesson): Promise<UserLesson>;
  getUserLessons(userId: string, language?: string): Promise<UserLesson[]>;
  getUserLesson(id: string, userId: string): Promise<UserLesson | undefined>;
  updateUserLesson(id: string, userId: string, data: Partial<UserLesson>): Promise<UserLesson | undefined>;
  deleteUserLesson(id: string, userId: string): Promise<boolean>;

  // Phase 3: Lesson Items
  addLessonItem(data: InsertUserLessonItem): Promise<UserLessonItem>;
  getLessonItems(lessonId: string): Promise<Array<UserLessonItem & { 
    conversation?: Conversation; 
    vocabularyWord?: VocabularyWord; 
  }>>;
  removeLessonItem(id: string): Promise<boolean>;
  
  // Phase 3: Auto-generate lesson from time range
  generateWeeklyLesson(userId: string, language: string, weekStart: Date): Promise<UserLesson | null>;
}

export class DatabaseStorage implements IStorage {
  constructor() {
    // Commented out: vocabulary words now require userId, so seed data won't work
    // this.seedData();
  }

  // Commented out: vocabulary words now require userId
  // private async seedData() {
  //   // Check if data already exists to avoid duplicates
  //   const existingVocab = await db.select().from(vocabularyWords).limit(1);
  //   if (existingVocab.length > 0) {
  //     return;
  //   }

  //   // Seed vocabulary words
  //   const spanishWords: InsertVocabularyWord[] = [
  //     { language: "spanish", word: "Hola", translation: "Hello", example: "Hola, ¿cómo estás?", pronunciation: "OH-lah", difficulty: "beginner" },
  //     { language: "spanish", word: "Gracias", translation: "Thank you", example: "Gracias por tu ayuda.", pronunciation: "GRAH-see-ahs", difficulty: "beginner" },
  //     { language: "spanish", word: "Amigo", translation: "Friend", example: "Mi amigo es muy amable.", pronunciation: "ah-MEE-goh", difficulty: "beginner" },
  //     { language: "spanish", word: "Casa", translation: "House", example: "Mi casa es grande.", pronunciation: "KAH-sah", difficulty: "beginner" },
  //     { language: "spanish", word: "Comida", translation: "Food", example: "La comida está deliciosa.", pronunciation: "koh-MEE-dah", difficulty: "intermediate" },
  //   ];

  //   for (const word of spanishWords) {
  //     await this.createVocabularyWord(word);
  //   }

  //   // Seed grammar exercises
  //   const spanishGrammar: InsertGrammarExercise[] = [
  //     {
  //       language: "spanish",
  //       difficulty: "beginner",
  //       question: "Complete: Yo ___ estudiante.",
  //       options: ["es", "soy", "eres", "está"],
  //       correctAnswer: 1,
  //       explanation: "Use 'soy' for the first person singular of the verb 'ser' (to be).",
  //     },
  //     {
  //       language: "spanish",
  //       difficulty: "intermediate",
  //       question: "Choose the correct verb: Ella ___ una manzana.",
  //       options: ["come", "como", "comes", "comen"],
  //       correctAnswer: 0,
  //       explanation: "'Come' is the third person singular form of 'comer' (to eat).",
  //     },
  //   ];

  //   for (const exercise of spanishGrammar) {
  //     await this.createGrammarExercise(exercise);
  //   }

  //   // Seed topics
  //   const initialTopics: InsertTopic[] = [
  //     {
  //       name: "Shopping & Retail",
  //       description: "Practice buying items, asking for prices, and navigating stores",
  //       category: "Daily Life",
  //       icon: "ShoppingCart",
  //       samplePhrases: ["How much does this cost?", "I'd like to buy...", "Do you have this in another size?"],
  //       difficulty: null,
  //     },
  //     {
  //       name: "Food & Restaurants",
  //       description: "Order meals, ask about ingredients, and discuss food preferences",
  //       category: "Daily Life",
  //       icon: "UtensilsCrossed",
  //       samplePhrases: ["I'd like to order...", "What do you recommend?", "The bill, please"],
  //       difficulty: null,
  //     },
  //     {
  //       name: "Travel & Transportation",
  //       description: "Navigate airports, hotels, and public transportation",
  //       category: "Travel",
  //       icon: "Plane",
  //       samplePhrases: ["Where is the train station?", "I need a ticket to...", "How long does it take?"],
  //       difficulty: null,
  //     },
  //     {
  //       name: "Directions & Navigation",
  //       description: "Ask for and give directions in the city",
  //       category: "Travel",
  //       icon: "MapPin",
  //       samplePhrases: ["How do I get to...?", "Is it far from here?", "Turn left at..."],
  //       difficulty: null,
  //     },
  //     {
  //       name: "Weather & Small Talk",
  //       description: "Discuss weather, seasons, and make casual conversation",
  //       category: "Daily Life",
  //       icon: "CloudSun",
  //       samplePhrases: ["How's the weather today?", "It's really hot/cold", "I love this season"],
  //       difficulty: null,
  //     },
  //     {
  //       name: "Work & Business",
  //       description: "Professional conversations, meetings, and workplace communication",
  //       category: "Business",
  //       icon: "Briefcase",
  //       samplePhrases: ["I work as a...", "Let's schedule a meeting", "What's your job?"],
  //       difficulty: "intermediate",
  //     },
  //     {
  //       name: "Hobbies & Interests",
  //       description: "Talk about sports, music, movies, books, and personal interests",
  //       category: "Social",
  //       icon: "Music",
  //       samplePhrases: ["I like to...", "What do you do for fun?", "My favorite is..."],
  //       difficulty: null,
  //     },
  //     {
  //       name: "Family & Relationships",
  //       description: "Discuss family members, friends, and personal relationships",
  //       category: "Social",
  //       icon: "Users",
  //       samplePhrases: ["I have two brothers", "This is my friend...", "My family lives in..."],
  //       difficulty: null,
  //     },
  //     {
  //       name: "Health & Medical",
  //       description: "Visit doctors, pharmacies, and discuss health concerns",
  //       category: "Daily Life",
  //       icon: "Heart",
  //       samplePhrases: ["I don't feel well", "I need medicine for...", "Where is the hospital?"],
  //       difficulty: "intermediate",
  //     },
  //     {
  //       name: "Technology & Gadgets",
  //       description: "Talk about phones, computers, apps, and digital life",
  //       category: "Modern Life",
  //       icon: "Smartphone",
  //       samplePhrases: ["My phone isn't working", "Can I have the WiFi password?", "I use this app..."],
  //       difficulty: null,
  //     },
  //     {
  //       name: "Home & Accommodation",
  //       description: "Describe your home, rent apartments, and discuss living spaces",
  //       category: "Daily Life",
  //       icon: "Home",
  //       samplePhrases: ["I live in a...", "How many rooms?", "I'm looking for an apartment"],
  //       difficulty: null,
  //     },
  //     {
  //       name: "Education & Learning",
  //       description: "Discuss school, university, studies, and educational experiences",
  //       category: "Social",
  //       icon: "GraduationCap",
  //       samplePhrases: ["I'm studying...", "What's your major?", "I go to... school"],
  //       difficulty: null,
  //     },
  //   ];

  //   for (const topic of initialTopics) {
  //     await this.createTopic(topic);
  //   }

  //   // Seed cultural tips
  //   const culturalTips: InsertCulturalTip[] = [
  //     // Spanish cultural tips
  //     {
  //       language: "spanish",
  //       category: "Greetings",
  //       title: "Double-Cheek Kiss Greeting",
  //       content: "In Spain and many Latin American countries, it's customary to greet friends and family with two kisses on the cheek (one on each side). Start with the right cheek first.",
  //       context: "Common in social settings with friends and family",
  //       relatedTopics: ["Social Interactions"],
  //       icon: "Users",
  //     },
  //     {
  //       language: "spanish",
  //       category: "Dining",
  //       title: "Late Dinner Times",
  //       content: "In Spain, dinner (la cena) is typically eaten much later than in other countries—often between 9 PM and 11 PM. Restaurants may not even open for dinner until 8:30 PM.",
  //       context: "When dining out in Spain",
  //       relatedTopics: ["Food & Restaurants"],
  //       icon: "UtensilsCrossed",
  //     },
  //     {
  //       language: "spanish",
  //       category: "Social Norms",
  //       title: "Siesta Tradition",
  //       content: "The siesta is a traditional afternoon rest period in Spain, typically from 2-5 PM. Many small shops and businesses close during this time, though this practice is becoming less common in larger cities.",
  //       context: "Shopping and business hours in Spain",
  //       relatedTopics: ["Shopping & Retail", "Daily Routines"],
  //       icon: "Clock",
  //     },
  //     // French cultural tips
  //     {
  //       language: "french",
  //       category: "Greetings",
  //       title: "La Bise Greeting",
  //       content: "In France, 'la bise' (cheek kisses) is a common greeting. The number varies by region—Paris typically does 2, while some southern regions do 3 or 4. Air kissing (not actual lip contact) while touching cheeks is the norm.",
  //       context: "Greeting friends and acquaintances",
  //       relatedTopics: ["Social Interactions"],
  //       icon: "Users",
  //     },
  //     {
  //       language: "french",
  //       category: "Dining",
  //       title: "Bread Etiquette",
  //       content: "In French dining, bread is placed directly on the tablecloth, not on your plate. Break it with your hands rather than cutting it with a knife. It's used to push food onto your fork.",
  //       context: "Dining at restaurants or formal meals",
  //       relatedTopics: ["Food & Restaurants"],
  //       icon: "UtensilsCrossed",
  //     },
  //     {
  //       language: "french",
  //       category: "Social Norms",
  //       title: "Formal vs. Informal 'You'",
  //       content: "French has two forms of 'you': 'tu' (informal) and 'vous' (formal). Always use 'vous' with strangers, elderly people, or in professional settings. Wait for others to invite you to use 'tu'.",
  //       context: "All social and professional interactions",
  //       relatedTopics: null,
  //       icon: "MessageSquare",
  //     },
  //     // German cultural tips
  //     {
  //       language: "german",
  //       category: "Social Norms",
  //       title: "Punctuality is Sacred",
  //       content: "Being on time is extremely important in German culture. Arriving even 5 minutes late is considered rude. If you're running late, always call ahead to inform the other party.",
  //       context: "All appointments and social gatherings",
  //       relatedTopics: null,
  //       icon: "Clock",
  //     },
  //     {
  //       language: "german",
  //       category: "Dining",
  //       title: "Table Manners: Keep Hands Visible",
  //       content: "In German dining etiquette, keep both hands on or above the table at all times (but not elbows). Resting your hands in your lap is considered poor manners.",
  //       context: "Formal and casual dining",
  //       relatedTopics: ["Food & Restaurants"],
  //       icon: "UtensilsCrossed",
  //     },
  //     // Italian cultural tips
  //     {
  //       language: "italian",
  //       category: "Dining",
  //       title: "Coffee Culture Rules",
  //       content: "Italians drink cappuccino only in the morning, never after 11 AM. Espresso is the afternoon/evening coffee. Ordering a cappuccino after lunch marks you as a tourist.",
  //       context: "Ordering coffee at cafés",
  //       relatedTopics: ["Food & Restaurants"],
  //       icon: "Coffee",
  //     },
  //     {
  //       language: "italian",
  //       category: "Social Norms",
  //       title: "Passionate Hand Gestures",
  //       content: "Hand gestures are an integral part of Italian communication. Italians use their hands expressively while speaking, and certain gestures have specific meanings that vary by region.",
  //       context: "Everyday conversation",
  //       relatedTopics: ["Social Interactions"],
  //       icon: "Hand",
  //     },
  //     // Portuguese cultural tips
  //     {
  //       language: "portuguese",
  //       category: "Greetings",
  //       title: "Warm Physical Greetings",
  //       content: "In Brazil, greetings often include hugs and kisses on both cheeks, even in business settings. In Portugal, handshakes are more common in professional contexts, while cheek kisses are for friends.",
  //       context: "Meeting people socially or professionally",
  //       relatedTopics: ["Social Interactions"],
  //       icon: "Users",
  //     },
  //     {
  //       language: "portuguese",
  //       category: "Social Norms",
  //       title: "Beach and Casual Culture (Brazil)",
  //       content: "In Brazil, especially in coastal cities, casual beachwear (havaianas, shorts) is acceptable in many settings. Brazilians value comfort and relaxed dress codes in everyday situations.",
  //       context: "Everyday dress and social situations",
  //       relatedTopics: null,
  //       icon: "Sun",
  //     },
  //     // Japanese cultural tips
  //     {
  //       language: "japanese",
  //       category: "Greetings",
  //       title: "Bowing Etiquette",
  //       content: "Bowing is the traditional Japanese greeting. A slight bow (15°) is casual, while deeper bows (30°-45°) show more respect. The depth and duration depend on the social context and the person's status.",
  //       context: "All social and professional interactions",
  //       relatedTopics: ["Social Interactions"],
  //       icon: "Users",
  //     },
  //     {
  //       language: "japanese",
  //       category: "Dining",
  //       title: "Chopstick Taboos",
  //       content: "Never stick chopsticks vertically into rice (resembles funeral rituals) or pass food chopstick-to-chopstick (also funeral-related). Rest chopsticks on the holder when not using them.",
  //       context: "Dining with chopsticks",
  //       relatedTopics: ["Food & Restaurants"],
  //       icon: "UtensilsCrossed",
  //     },
  //     {
  //       language: "japanese",
  //       category: "Social Norms",
  //       title: "Taking Shoes Off",
  //       content: "Remove shoes before entering homes, temples, and some traditional restaurants. Slippers are usually provided. Never wear outdoor shoes on tatami mats.",
  //       context: "Entering homes and certain establishments",
  //       relatedTopics: null,
  //       icon: "Home",
  //     },
  //     // Mandarin Chinese cultural tips
  //     {
  //       language: "mandarin",
  //       category: "Dining",
  //       title: "Refusing Food Politely",
  //       content: "In Chinese culture, hosts often insist multiple times when offering food. It's polite to refuse once or twice before accepting. Accepting immediately might seem greedy.",
  //       context: "Dining in someone's home or at banquets",
  //       relatedTopics: ["Food & Restaurants"],
  //       icon: "UtensilsCrossed",
  //     },
  //     {
  //       language: "mandarin",
  //       category: "Gift Giving",
  //       title: "Red Envelopes for Luck",
  //       content: "Red envelopes (红包, hóngbāo) containing money are given during holidays, weddings, and special occasions. The color red symbolizes luck and prosperity. Never give amounts with the number 4.",
  //       context: "Holidays, weddings, Chinese New Year",
  //       relatedTopics: null,
  //       icon: "Gift",
  //     },
  //     // Korean cultural tips
  //     {
  //       language: "korean",
  //       category: "Social Norms",
  //       title: "Respect for Elders",
  //       content: "Age hierarchy is very important in Korean culture. Always show respect to elders by using formal language, letting them eat first, and bowing when greeting. Pour drinks for elders with both hands.",
  //       context: "All social interactions",
  //       relatedTopics: ["Social Interactions"],
  //       icon: "Users",
  //     },
  //     {
  //       language: "korean",
  //       category: "Dining",
  //       title: "Soju Drinking Etiquette",
  //       content: "When drinking soju or alcohol, turn your head away from elders when taking a sip as a sign of respect. Receive drinks with both hands, and never pour your own drink—pour for others and they'll pour for you.",
  //       context: "Social drinking situations",
  //       relatedTopics: ["Food & Restaurants", "Social Interactions"],
  //       icon: "Wine",
  //     },
  //   ];

  //   for (const tip of culturalTips) {
  //     await this.createCulturalTip(tip);
  //   }
  // }

  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async upsertUser(user: UpsertUser): Promise<User> {
    const [upserted] = await db
      .insert(users)
      .values(user)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return upserted;
  }

  async updateUserPreferences(userId: string, preferences: {
    targetLanguage?: string;
    nativeLanguage?: string;
    difficultyLevel?: string;
    onboardingCompleted?: boolean;
  }): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({
        ...preferences,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async updateUserStripeInfo(userId: string, stripeInfo: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionTier?: string;
    subscriptionStatus?: string;
  }): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ ...stripeInfo, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  // Usage tracking for voice messages
  async resetMonthlyUsageIfNeeded(userId: string): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) return;

    const now = new Date();
    const lastReset = user.lastMessageResetDate ? new Date(user.lastMessageResetDate) : new Date(0);
    
    // Check if we're in a new month
    const isNewMonth = now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear();
    
    if (isNewMonth) {
      await db.update(users)
        .set({
          monthlyMessageCount: 0,
          lastMessageResetDate: now,
          updatedAt: now,
        })
        .where(eq(users.id, userId));
    }
  }

  async checkVoiceUsage(userId: string): Promise<{allowed: boolean, remaining: number, limit: number}> {
    // Reset monthly counter if needed
    await this.resetMonthlyUsageIfNeeded(userId);
    
    const user = await this.getUser(userId);
    if (!user) {
      return { allowed: false, remaining: 0, limit: 0 };
    }

    // DEVELOPER OVERRIDE: Admins and developers bypass all limits
    const developerRoles = ['admin', 'developer'];
    if (user.role && developerRoles.includes(user.role)) {
      console.log(`[DEVELOPER MODE] User ${userId} (role: ${user.role}) bypassing voice limits`);
      return {
        allowed: true,
        remaining: 999999,
        limit: 999999,
      };
    }

    const currentCount = user.monthlyMessageCount || 0;
    const limit = user.monthlyMessageLimit || 20;
    
    // Paid tiers have "unlimited" (high limit like 999999)
    const paidTiers = ['basic', 'pro', 'institutional'];
    const isPaidTier = user.subscriptionTier && paidTiers.includes(user.subscriptionTier);
    const effectiveLimit = isPaidTier ? 999999 : limit;

    const allowed = currentCount < effectiveLimit;
    const remaining = Math.max(0, effectiveLimit - currentCount);

    return {
      allowed,
      remaining,
      limit: effectiveLimit,
    };
  }

  async incrementVoiceUsage(userId: string): Promise<void> {
    // Atomic increment with limit check to prevent race conditions
    // This UPDATE will only succeed if the current count is below the limit
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // DEVELOPER OVERRIDE: Admins and developers don't increment counter
    const developerRoles = ['admin', 'developer'];
    if (user.role && developerRoles.includes(user.role)) {
      console.log(`[DEVELOPER MODE] User ${userId} (role: ${user.role}) skipping usage increment`);
      return; // Skip increment for developers
    }

    const limit = user.monthlyMessageLimit || 20;
    const paidTiers = ['basic', 'pro', 'institutional'];
    const isPaidTier = user.subscriptionTier && paidTiers.includes(user.subscriptionTier);
    const effectiveLimit = isPaidTier ? 999999 : limit;

    const [updated] = await db
      .update(users)
      .set({
        monthlyMessageCount: sql`${users.monthlyMessageCount} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(users.id, userId),
          sql`${users.monthlyMessageCount} < ${effectiveLimit}`
        )
      )
      .returning();

    // If no row was updated, user has exceeded limit (race condition)
    if (!updated) {
      throw new Error('Voice usage limit exceeded');
    }
  }

  async checkAndIncrementVoiceUsage(userId: string): Promise<{allowed: boolean, remaining: number, limit: number}> {
    // Reset monthly counter if needed
    await this.resetMonthlyUsageIfNeeded(userId);
    
    const user = await this.getUser(userId);
    if (!user) {
      return { allowed: false, remaining: 0, limit: 0 };
    }

    // DEVELOPER OVERRIDE: Admins and developers bypass all limits
    const developerRoles = ['admin', 'developer'];
    if (user.role && developerRoles.includes(user.role)) {
      console.log(`[DEVELOPER MODE] User ${userId} (role: ${user.role}) bypassing voice limits (no increment)`);
      return {
        allowed: true,
        remaining: 999999,
        limit: 999999,
      };
    }

    const currentCount = user.monthlyMessageCount || 0;
    const limit = user.monthlyMessageLimit || 20;
    
    // Paid tiers have "unlimited" (high limit like 999999)
    // Explicitly check for paid tier values to avoid undefined/null bugs
    const paidTiers = ['basic', 'pro', 'institutional'];
    const isPaidTier = user.subscriptionTier && paidTiers.includes(user.subscriptionTier);
    const effectiveLimit = isPaidTier ? 999999 : limit;

    // Atomic increment with limit check to prevent race conditions
    // This UPDATE will only succeed if the current count is below the limit
    const [updated] = await db
      .update(users)
      .set({
        monthlyMessageCount: sql`${users.monthlyMessageCount} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(users.id, userId),
          sql`${users.monthlyMessageCount} < ${effectiveLimit}`
        )
      )
      .returning();

    // If no row was updated, user has exceeded limit
    if (!updated) {
      return {
        allowed: false,
        remaining: 0,
        limit: effectiveLimit,
      };
    }

    const newCount = updated.monthlyMessageCount || 0;
    return {
      allowed: true,
      remaining: Math.max(0, effectiveLimit - newCount),
      limit: effectiveLimit,
    };
  }

  async getUserUsageStats(userId: string): Promise<{monthlyMessageCount: number, monthlyMessageLimit: number, remaining: number}> {
    await this.resetMonthlyUsageIfNeeded(userId);
    
    const user = await this.getUser(userId);
    if (!user) {
      return { monthlyMessageCount: 0, monthlyMessageLimit: 0, remaining: 0 };
    }

    const count = user.monthlyMessageCount || 0;
    const limit = user.monthlyMessageLimit || 20;
    
    // Explicitly check for paid tier values to avoid undefined/null bugs
    const paidTiers = ['basic', 'pro', 'institutional'];
    const isPaidTier = user.subscriptionTier && paidTiers.includes(user.subscriptionTier);
    const effectiveLimit = isPaidTier ? 999999 : limit;

    return {
      monthlyMessageCount: count,
      monthlyMessageLimit: effectiveLimit,
      remaining: Math.max(0, effectiveLimit - count),
    };
  }

  // Stripe data queries (from stripe-replit-sync PostgreSQL tables)
  async getProduct(productId: string): Promise<any | null> {
    const result = await db.execute(
      sql`SELECT * FROM stripe.products WHERE id = ${productId}`
    );
    return result.rows[0] || null;
  }

  async listProducts(active = true, limit = 20, offset = 0): Promise<any[]> {
    const result = await db.execute(
      sql`SELECT * FROM stripe.products WHERE active = ${active} LIMIT ${limit} OFFSET ${offset}`
    );
    return result.rows;
  }

  async getPrice(priceId: string): Promise<any | null> {
    const result = await db.execute(
      sql`SELECT * FROM stripe.prices WHERE id = ${priceId}`
    );
    return result.rows[0] || null;
  }

  async listPrices(active = true, limit = 20, offset = 0): Promise<any[]> {
    const result = await db.execute(
      sql`SELECT * FROM stripe.prices WHERE active = ${active} LIMIT ${limit} OFFSET ${offset}`
    );
    return result.rows;
  }

  async getSubscription(subscriptionId: string): Promise<any | null> {
    const result = await db.execute(
      sql`SELECT * FROM stripe.subscriptions WHERE id = ${subscriptionId}`
    );
    return result.rows[0] || null;
  }

  async createConversation(data: typeof conversations.$inferInsert): Promise<Conversation> {
    const [conversation] = await db.insert(conversations).values(data).returning();
    return conversation;
  }

  async getConversation(id: string, userId: string): Promise<Conversation | undefined> {
    const result = await db.select().from(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
    return result[0];
  }

  async getUserConversations(userId: string): Promise<Conversation[]> {
    return await db.select().from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.createdAt));
  }

  private async getConversationById(id: string): Promise<Conversation | undefined> {
    const result = await db.select().from(conversations).where(eq(conversations.id, id));
    return result[0];
  }

  async getConversationsByLanguage(language: string, userId: string): Promise<Conversation[]> {
    return await db.select().from(conversations)
      .where(and(eq(conversations.language, language), eq(conversations.userId, userId)))
      .orderBy(desc(conversations.createdAt));
  }

  async getConversationByLanguageAndDifficulty(language: string, difficulty: string, userId: string): Promise<Conversation | undefined> {
    const result = await db.select().from(conversations)
      .where(and(
        eq(conversations.language, language),
        eq(conversations.difficulty, difficulty),
        eq(conversations.userId, userId)
      ));
    return result[0];
  }

  async updateConversation(id: string, userId: string, data: Partial<Conversation>): Promise<Conversation | undefined> {
    const filteredData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined)
    );
    
    const [updated] = await db.update(conversations)
      .set(filteredData)
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
      .returning();
    
    return updated;
  }

  private async updateConversationInternal(id: string, data: Partial<Conversation>): Promise<Conversation | undefined> {
    const filteredData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined)
    );
    
    const [updated] = await db.update(conversations)
      .set(filteredData)
      .where(eq(conversations.id, id))
      .returning();
    
    return updated;
  }

  async deleteConversation(id: string, userId: string): Promise<boolean> {
    const conversation = await this.getConversation(id, userId);
    if (!conversation) {
      return false;
    }
    
    await db.delete(messages).where(eq(messages.conversationId, id));
    await db.delete(pronunciationScores).where(eq(pronunciationScores.conversationId, id));
    const result = await db.delete(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async createMessage(data: InsertMessage): Promise<Message> {
    const [message] = await db.insert(messages).values(data).returning();

    const conversation = await this.getConversationById(data.conversationId);
    if (conversation) {
      const allMessages = await this.getMessagesByConversation(data.conversationId);
      
      let duration = 0;
      if (allMessages.length > 0) {
        const firstMessage = allMessages[0];
        const lastMessage = allMessages[allMessages.length - 1];
        const durationMs = new Date(lastMessage.createdAt).getTime() - new Date(firstMessage.createdAt).getTime();
        duration = Math.floor(durationMs / 60000);
      }
      
      await this.updateConversationInternal(data.conversationId, {
        messageCount: conversation.messageCount + 1,
        duration,
      });
    }

    return message;
  }

  async getMessage(messageId: string, userId: string): Promise<Message | undefined> {
    const result = await db.select({
      id: messages.id,
      conversationId: messages.conversationId,
      role: messages.role,
      actflLevel: messages.actflLevel,
      content: messages.content,
      targetLanguageText: messages.targetLanguageText,
      subtitlesJson: messages.subtitlesJson,
      wordTimingsJson: messages.wordTimingsJson,
      mediaJson: messages.mediaJson,
      performanceScore: messages.performanceScore,
      enrichmentStatus: messages.enrichmentStatus,
      createdAt: messages.createdAt,
    })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(and(
        eq(messages.id, messageId),
        eq(conversations.userId, userId)
      ))
      .limit(1);
    
    return result[0];
  }

  async getMessagesByConversation(conversationId: string): Promise<Message[]> {
    return await db.select().from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
  }

  async updateMessage(id: string, data: Partial<Message>): Promise<Message | undefined> {
    const [updated] = await db.update(messages)
      .set(data)
      .where(eq(messages.id, id))
      .returning();
    return updated;
  }

  async searchMessages(userId: string, query: string, limit: number = 20): Promise<Array<Message & { conversationTitle: string | null }>> {
    // Week 1 Feature: Smart search across all user conversations
    const results = await db
      .select({
        // Message fields
        id: messages.id,
        conversationId: messages.conversationId,
        role: messages.role,
        actflLevel: messages.actflLevel,
        content: messages.content,
        targetLanguageText: messages.targetLanguageText,
        subtitlesJson: messages.subtitlesJson,
        wordTimingsJson: messages.wordTimingsJson,
        mediaJson: messages.mediaJson,
        performanceScore: messages.performanceScore,
        enrichmentStatus: messages.enrichmentStatus,
        createdAt: messages.createdAt,
        // Conversation context
        conversationTitle: conversations.title,
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(and(
        eq(conversations.userId, userId),
        sql`${messages.content} ILIKE ${'%' + query + '%'}`
      ))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
    
    return results;
  }

  async createVocabularyWord(data: InsertVocabularyWord): Promise<VocabularyWord> {
    const [word] = await db.insert(vocabularyWords).values(data).returning();
    return word;
  }

  async getVocabularyWord(id: string): Promise<VocabularyWord | undefined> {
    const [word] = await db
      .select()
      .from(vocabularyWords)
      .where(eq(vocabularyWords.id, id))
      .limit(1);
    return word;
  }

  async getVocabularyWords(language: string, userId: string, difficulty?: string): Promise<VocabularyWord[]> {
    if (difficulty) {
      return await db.select().from(vocabularyWords)
        .where(and(
          eq(vocabularyWords.language, language),
          eq(vocabularyWords.userId, userId),
          eq(vocabularyWords.difficulty, difficulty)
        ));
    }
    return await db.select().from(vocabularyWords)
      .where(and(eq(vocabularyWords.language, language), eq(vocabularyWords.userId, userId)));
  }

  async updateVocabularyReview(id: string, isCorrect: boolean): Promise<VocabularyWord | undefined> {
    const result = await db.select().from(vocabularyWords).where(eq(vocabularyWords.id, id));
    const word = result[0];
    if (!word) return undefined;

    const currentState = {
      easeFactor: word.easeFactor,
      interval: word.interval,
      correctCount: word.correctCount,
      incorrectCount: word.incorrectCount,
      repetition: word.repetition,
    };

    const reviewResult = isCorrect ? markCorrect(currentState) : markIncorrect(currentState);

    const [updated] = await db.update(vocabularyWords)
      .set({
        nextReviewDate: reviewResult.nextReviewDate,
        easeFactor: reviewResult.easeFactor,
        interval: reviewResult.interval,
        correctCount: reviewResult.correctCount,
        incorrectCount: reviewResult.incorrectCount,
        repetition: reviewResult.repetition,
      })
      .where(eq(vocabularyWords.id, id))
      .returning();

    return updated;
  }

  async getDueVocabulary(language: string, userId: string, difficulty?: string, limit: number = 5): Promise<VocabularyWord[]> {
    const now = new Date();
    const conditions = [
      eq(vocabularyWords.language, language),
      eq(vocabularyWords.userId, userId),
      sql`${vocabularyWords.nextReviewDate} <= ${now}`
    ];

    if (difficulty) {
      conditions.push(eq(vocabularyWords.difficulty, difficulty));
    }

    return await db.select().from(vocabularyWords)
      .where(and(...conditions))
      .orderBy(vocabularyWords.nextReviewDate)
      .limit(limit);
  }

  async createGrammarExercise(data: InsertGrammarExercise): Promise<GrammarExercise> {
    const [exercise] = await db.insert(grammarExercises).values(data).returning();
    return exercise;
  }

  async getGrammarExercises(language: string, difficulty?: string): Promise<GrammarExercise[]> {
    if (difficulty) {
      return await db.select().from(grammarExercises)
        .where(and(eq(grammarExercises.language, language), eq(grammarExercises.difficulty, difficulty)));
    }
    return await db.select().from(grammarExercises)
      .where(eq(grammarExercises.language, language));
  }

  async getOrCreateUserProgress(language: string, userId: string): Promise<UserProgress> {
    const result = await db.select().from(userProgressTable)
      .where(and(eq(userProgressTable.language, language), eq(userProgressTable.userId, userId)));
    
    if (result.length > 0) {
      return result[0];
    }

    const [progress] = await db.insert(userProgressTable)
      .values({ language, userId })
      .returning();
    return progress;
  }

  async updateUserProgress(id: string, data: Partial<UserProgress>): Promise<UserProgress | undefined> {
    const [updated] = await db.update(userProgressTable)
      .set(data)
      .where(eq(userProgressTable.id, id))
      .returning();
    return updated;
  }

  async createProgressHistory(data: InsertProgressHistory): Promise<ProgressHistory> {
    const [history] = await db.insert(progressHistoryTable).values(data).returning();
    return history;
  }

  async getProgressHistory(language: string, userId: string, days: number = 30): Promise<ProgressHistory[]> {
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    return await db.select().from(progressHistoryTable)
      .where(and(
        eq(progressHistoryTable.language, language),
        eq(progressHistoryTable.userId, userId),
        gte(progressHistoryTable.date, cutoffDate)
      ))
      .orderBy(progressHistoryTable.date);
  }

  async createPronunciationScore(data: InsertPronunciationScore): Promise<PronunciationScore> {
    const [score] = await db.insert(pronunciationScores).values(data).returning();
    return score;
  }

  async getPronunciationScoresByConversation(conversationId: string): Promise<PronunciationScore[]> {
    return await db.select().from(pronunciationScores)
      .where(eq(pronunciationScores.conversationId, conversationId))
      .orderBy(pronunciationScores.createdAt);
  }

  async getPronunciationScoreByMessage(messageId: string): Promise<PronunciationScore | undefined> {
    const result = await db.select().from(pronunciationScores)
      .where(eq(pronunciationScores.messageId, messageId));
    return result[0];
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

  async getTopics(): Promise<Topic[]> {
    return await db.select().from(topicsTable);
  }

  async getTopic(id: string): Promise<Topic | undefined> {
    const result = await db.select().from(topicsTable).where(eq(topicsTable.id, id));
    return result[0];
  }

  async createTopic(data: InsertTopic): Promise<Topic> {
    const [topic] = await db.insert(topicsTable).values(data).returning();
    return topic;
  }

  async getCulturalTips(language: string): Promise<CulturalTip[]> {
    return await db.select().from(culturalTipsTable)
      .where(eq(culturalTipsTable.language, language));
  }

  async getCulturalTip(id: string): Promise<CulturalTip | undefined> {
    const result = await db.select().from(culturalTipsTable).where(eq(culturalTipsTable.id, id));
    return result[0];
  }

  async createCulturalTip(data: InsertCulturalTip): Promise<CulturalTip> {
    const [culturalTip] = await db.insert(culturalTipsTable).values(data).returning();
    return culturalTip;
  }

  // Media Files
  async createMediaFile(data: InsertMediaFile): Promise<MediaFile> {
    const [mediaFile] = await db.insert(mediaFiles).values(data).returning();
    return mediaFile;
  }

  async getMediaFile(id: string): Promise<MediaFile | undefined> {
    const result = await db.select().from(mediaFiles).where(eq(mediaFiles.id, id));
    return result[0];
  }

  async getUserMediaFiles(userId: string): Promise<MediaFile[]> {
    return await db.select().from(mediaFiles)
      .where(eq(mediaFiles.uploadedBy, userId))
      .orderBy(desc(mediaFiles.createdAt));
  }

  // Message Media (images in conversations)
  async createMessageMedia(data: InsertMessageMedia): Promise<MessageMedia> {
    const [media] = await db.insert(messageMedia).values(data).returning();
    return media;
  }

  async getMessageMedia(messageId: string): Promise<Array<MessageMedia & { mediaFile: MediaFile }>> {
    const results = await db
      .select()
      .from(messageMedia)
      .leftJoin(mediaFiles, eq(messageMedia.mediaFileId, mediaFiles.id))
      .where(eq(messageMedia.messageId, messageId));

    return results.map(r => ({
      ...r.message_media,
      mediaFile: r.media_files!,
    }));
  }

  // Image Caching - for reducing API costs and improving speed
  async getCachedStockImage(searchQuery: string): Promise<MediaFile | undefined> {
    const result = await db
      .select()
      .from(mediaFiles)
      .where(
        and(
          eq(mediaFiles.imageSource, "stock"),
          eq(mediaFiles.searchQuery, searchQuery)
        )
      )
      .limit(1);
    return result[0];
  }

  async getCachedAIImage(promptHash: string): Promise<MediaFile | undefined> {
    const result = await db
      .select()
      .from(mediaFiles)
      .where(
        and(
          eq(mediaFiles.imageSource, "ai_generated"),
          eq(mediaFiles.promptHash, promptHash)
        )
      )
      .limit(1);
    return result[0];
  }

  async cacheImage(data: InsertMediaFile): Promise<MediaFile> {
    const [mediaFile] = await db.insert(mediaFiles).values(data).returning();
    return mediaFile;
  }

  async incrementImageUsage(id: string): Promise<void> {
    await db
      .update(mediaFiles)
      .set({ usageCount: sql`${mediaFiles.usageCount} + 1` })
      .where(eq(mediaFiles.id, id));
  }

  // ACTFL Can-Do Statements
  async getCanDoStatements(language?: string, actflLevel?: string, category?: string): Promise<CanDoStatement[]> {
    let query = db.select().from(canDoStatements);
    
    const conditions = [];
    if (language) {
      conditions.push(eq(canDoStatements.language, language));
    }
    if (actflLevel) {
      conditions.push(eq(canDoStatements.actflLevel, actflLevel));
    }
    if (category) {
      conditions.push(eq(canDoStatements.category, category));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query;
  }

  async getCanDoStatement(id: string): Promise<CanDoStatement | undefined> {
    const result = await db.select().from(canDoStatements).where(eq(canDoStatements.id, id));
    return result[0];
  }

  async seedCanDoStatements(): Promise<void> {
    const { getAllCanDoStatements } = await import('./actfl-can-do-statements');
    const allStatements = getAllCanDoStatements();
    
    const existing = await db.select().from(canDoStatements).limit(1);
    if (existing.length > 0) {
      return;
    }
    
    for (const stmt of allStatements) {
      await db.insert(canDoStatements).values(stmt);
    }
  }

  // Student Can-Do Progress
  async getUserCanDoProgress(userId: string): Promise<StudentCanDoProgress[]> {
    return await db
      .select()
      .from(studentCanDoProgress)
      .where(eq(studentCanDoProgress.userId, userId));
  }

  async toggleCanDoProgress(userId: string, statementId: string): Promise<StudentCanDoProgress | null> {
    const existing = await this.getCanDoProgressByStatement(userId, statementId);
    
    if (existing) {
      await db
        .delete(studentCanDoProgress)
        .where(
          and(
            eq(studentCanDoProgress.userId, userId),
            eq(studentCanDoProgress.canDoStatementId, statementId)
          )
        );
      return null;
    } else {
      const [progress] = await db
        .insert(studentCanDoProgress)
        .values({
          userId,
          canDoStatementId: statementId,
          selfAssessed: true,
          dateAchieved: new Date(),
        })
        .returning();
      return progress;
    }
  }

  async getCanDoProgressByStatement(userId: string, statementId: string): Promise<StudentCanDoProgress | undefined> {
    const result = await db
      .select()
      .from(studentCanDoProgress)
      .where(
        and(
          eq(studentCanDoProgress.userId, userId),
          eq(studentCanDoProgress.canDoStatementId, statementId)
        )
      );
    return result[0];
  }

  // ===== Teacher Classes =====
  
  async createTeacherClass(data: InsertTeacherClass): Promise<TeacherClass> {
    const [teacherClass] = await db.insert(teacherClasses).values(data).returning();
    return teacherClass;
  }

  async getTeacherClass(id: string): Promise<TeacherClass | undefined> {
    const result = await db.select().from(teacherClasses).where(eq(teacherClasses.id, id));
    return result[0];
  }

  async getTeacherClasses(teacherId: string): Promise<TeacherClass[]> {
    return await db.select().from(teacherClasses).where(eq(teacherClasses.teacherId, teacherId));
  }

  async updateTeacherClass(id: string, data: Partial<TeacherClass>): Promise<TeacherClass | undefined> {
    const [updated] = await db
      .update(teacherClasses)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(teacherClasses.id, id))
      .returning();
    return updated;
  }

  async deleteTeacherClass(id: string): Promise<boolean> {
    const result = await db.delete(teacherClasses).where(eq(teacherClasses.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getClassByJoinCode(joinCode: string): Promise<TeacherClass | undefined> {
    const result = await db.select().from(teacherClasses).where(eq(teacherClasses.joinCode, joinCode));
    return result[0];
  }

  // ===== Class Enrollments =====
  
  async enrollStudent(classId: string, studentId: string): Promise<ClassEnrollment> {
    // Check if already enrolled to prevent duplicates
    const existing = await db
      .select()
      .from(classEnrollments)
      .where(
        and(
          eq(classEnrollments.classId, classId),
          eq(classEnrollments.studentId, studentId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // If enrollment exists but was deactivated, reactivate it
      if (!existing[0].isActive) {
        const [updated] = await db
          .update(classEnrollments)
          .set({ isActive: true, enrolledAt: new Date() })
          .where(eq(classEnrollments.id, existing[0].id))
          .returning();
        return updated;
      }
      // Already enrolled and active
      return existing[0];
    }

    // Create new enrollment
    const [enrollment] = await db
      .insert(classEnrollments)
      .values({ classId, studentId })
      .returning();
    return enrollment;
  }

  async getClassEnrollments(classId: string): Promise<Array<ClassEnrollment & { student: User }>> {
    const result = await db
      .select()
      .from(classEnrollments)
      .leftJoin(users, eq(classEnrollments.studentId, users.id))
      .where(eq(classEnrollments.classId, classId));
    
    return result.map(row => ({
      ...row.class_enrollments,
      student: row.users!
    }));
  }

  async getStudentEnrollments(studentId: string): Promise<Array<ClassEnrollment & { class: TeacherClass }>> {
    const result = await db
      .select()
      .from(classEnrollments)
      .leftJoin(teacherClasses, eq(classEnrollments.classId, teacherClasses.id))
      .where(eq(classEnrollments.studentId, studentId));
    
    return result.map(row => ({
      ...row.class_enrollments,
      class: row.teacher_classes!
    }));
  }

  async unenrollStudent(classId: string, studentId: string): Promise<boolean> {
    const result = await db
      .delete(classEnrollments)
      .where(
        and(
          eq(classEnrollments.classId, classId),
          eq(classEnrollments.studentId, studentId)
        )
      );
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async isStudentEnrolled(classId: string, studentId: string): Promise<boolean> {
    const result = await db
      .select()
      .from(classEnrollments)
      .where(
        and(
          eq(classEnrollments.classId, classId),
          eq(classEnrollments.studentId, studentId),
          eq(classEnrollments.isActive, true)
        )
      )
      .limit(1);
    return result.length > 0;
  }

  // ===== Curriculum Paths =====
  
  async createCurriculumPath(data: InsertCurriculumPath): Promise<CurriculumPath> {
    const [path] = await db.insert(curriculumPaths).values(data).returning();
    return path;
  }

  async getCurriculumPath(id: string): Promise<CurriculumPath | undefined> {
    const result = await db.select().from(curriculumPaths).where(eq(curriculumPaths.id, id));
    return result[0];
  }

  async getCurriculumPaths(language?: string): Promise<CurriculumPath[]> {
    if (language) {
      return await db.select().from(curriculumPaths).where(eq(curriculumPaths.language, language));
    }
    return await db.select().from(curriculumPaths);
  }

  async updateCurriculumPath(id: string, data: Partial<CurriculumPath>): Promise<CurriculumPath | undefined> {
    const [updated] = await db
      .update(curriculumPaths)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(curriculumPaths.id, id))
      .returning();
    return updated;
  }

  // ===== Curriculum Units =====
  
  async createCurriculumUnit(data: InsertCurriculumUnit): Promise<CurriculumUnit> {
    const [unit] = await db.insert(curriculumUnits).values(data).returning();
    return unit;
  }

  async getCurriculumUnits(curriculumPathId: string): Promise<CurriculumUnit[]> {
    return await db
      .select()
      .from(curriculumUnits)
      .where(eq(curriculumUnits.curriculumPathId, curriculumPathId))
      .orderBy(curriculumUnits.orderIndex);
  }

  async getCurriculumUnit(id: string): Promise<CurriculumUnit | undefined> {
    const result = await db.select().from(curriculumUnits).where(eq(curriculumUnits.id, id));
    return result[0];
  }

  // ===== Curriculum Lessons =====
  
  async createCurriculumLesson(data: InsertCurriculumLesson): Promise<CurriculumLesson> {
    const [lesson] = await db.insert(curriculumLessons).values(data).returning();
    return lesson;
  }

  async getCurriculumLessons(curriculumUnitId: string): Promise<CurriculumLesson[]> {
    return await db
      .select()
      .from(curriculumLessons)
      .where(eq(curriculumLessons.curriculumUnitId, curriculumUnitId))
      .orderBy(curriculumLessons.orderIndex);
  }

  async getCurriculumLesson(id: string): Promise<CurriculumLesson | undefined> {
    const result = await db.select().from(curriculumLessons).where(eq(curriculumLessons.id, id));
    return result[0];
  }

  // ===== Assignments =====
  
  async createAssignment(data: InsertAssignment): Promise<Assignment> {
    const [assignment] = await db.insert(assignments).values(data).returning();
    return assignment;
  }

  async getAssignment(id: string): Promise<Assignment | undefined> {
    const result = await db.select().from(assignments).where(eq(assignments.id, id));
    return result[0];
  }

  async getClassAssignments(classId: string): Promise<Assignment[]> {
    return await db
      .select()
      .from(assignments)
      .where(eq(assignments.classId, classId))
      .orderBy(desc(assignments.createdAt));
  }

  async getTeacherAssignments(teacherId: string): Promise<Assignment[]> {
    return await db
      .select()
      .from(assignments)
      .where(eq(assignments.teacherId, teacherId))
      .orderBy(desc(assignments.createdAt));
  }

  async updateAssignment(id: string, data: Partial<Assignment>): Promise<Assignment | undefined> {
    const [updated] = await db
      .update(assignments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(assignments.id, id))
      .returning();
    return updated;
  }

  async deleteAssignment(id: string): Promise<boolean> {
    const result = await db.delete(assignments).where(eq(assignments.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ===== Assignment Submissions =====
  
  async createAssignmentSubmission(data: InsertAssignmentSubmission): Promise<AssignmentSubmission> {
    const [submission] = await db.insert(assignmentSubmissions).values(data).returning();
    return submission;
  }

  async getAssignmentSubmission(assignmentId: string, studentId: string): Promise<AssignmentSubmission | undefined> {
    const result = await db
      .select()
      .from(assignmentSubmissions)
      .where(
        and(
          eq(assignmentSubmissions.assignmentId, assignmentId),
          eq(assignmentSubmissions.studentId, studentId)
        )
      );
    return result[0];
  }

  async getStudentSubmissions(studentId: string): Promise<Array<AssignmentSubmission & { assignment: Assignment }>> {
    const result = await db
      .select()
      .from(assignmentSubmissions)
      .leftJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
      .where(eq(assignmentSubmissions.studentId, studentId))
      .orderBy(desc(assignmentSubmissions.createdAt));
    
    return result.map(row => ({
      ...row.assignment_submissions,
      assignment: row.assignments!
    }));
  }

  async getAssignmentSubmissions(assignmentId: string): Promise<Array<AssignmentSubmission & { student: User }>> {
    const result = await db
      .select()
      .from(assignmentSubmissions)
      .leftJoin(users, eq(assignmentSubmissions.studentId, users.id))
      .where(eq(assignmentSubmissions.assignmentId, assignmentId));
    
    return result.map(row => ({
      ...row.assignment_submissions,
      student: row.users!
    }));
  }

  async getSubmissionById(id: string): Promise<AssignmentSubmission | undefined> {
    const result = await db
      .select()
      .from(assignmentSubmissions)
      .where(eq(assignmentSubmissions.id, id))
      .limit(1);
    return result[0];
  }

  async updateAssignmentSubmission(id: string, data: Partial<AssignmentSubmission>): Promise<AssignmentSubmission | undefined> {
    const [updated] = await db
      .update(assignmentSubmissions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(assignmentSubmissions.id, id))
      .returning();
    return updated;
  }

  // ===== Admin-Only Methods =====
  
  // User Management
  async getAllUsers(options?: { role?: string; limit?: number; offset?: number }): Promise<{ users: User[]; total: number }> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    
    const allUsers = options?.role
      ? await db.select().from(users).where(eq(users.role, options.role as any)).limit(limit).offset(offset).orderBy(desc(users.createdAt))
      : await db.select().from(users).limit(limit).offset(offset).orderBy(desc(users.createdAt));
    
    // Get total count
    const countResult = options?.role 
      ? await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.role, options.role as any))
      : await db.select({ count: sql<number>`count(*)` }).from(users);
    
    return {
      users: allUsers,
      total: Number((countResult[0] as any).count)
    };
  }

  async updateUserRole(userId: string, newRole: 'student' | 'teacher' | 'developer' | 'admin'): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({ role: newRole, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }
  
  // Class Management (Platform-wide)
  async getAllClasses(options?: { limit?: number; offset?: number }): Promise<{ classes: Array<TeacherClass & { teacher: User; enrollmentCount: number }>; total: number }> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    
    const result = await db
      .select({
        class: teacherClasses,
        teacher: users,
        enrollmentCount: sql<number>`(SELECT COUNT(*) FROM ${classEnrollments} WHERE ${classEnrollments.classId} = ${teacherClasses.id})`
      })
      .from(teacherClasses)
      .leftJoin(users, eq(teacherClasses.teacherId, users.id))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(teacherClasses.createdAt));
    
    // Get total count
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(teacherClasses) as any;
    
    return {
      classes: result.map(row => ({
        ...row.class,
        teacher: row.teacher!,
        enrollmentCount: Number(row.enrollmentCount)
      })),
      total: Number(count)
    };
  }

  async getClassWithDetails(classId: string): Promise<(TeacherClass & { teacher: User; enrollmentCount: number; assignmentCount: number }) | undefined> {
    const result = await db
      .select({
        class: teacherClasses,
        teacher: users,
        enrollmentCount: sql<number>`(SELECT COUNT(*) FROM ${classEnrollments} WHERE ${classEnrollments.classId} = ${teacherClasses.id})`,
        assignmentCount: sql<number>`(SELECT COUNT(*) FROM ${assignments} WHERE ${assignments.classId} = ${teacherClasses.id})`
      })
      .from(teacherClasses)
      .leftJoin(users, eq(teacherClasses.teacherId, users.id))
      .where(eq(teacherClasses.id, classId))
      .limit(1);
    
    if (result.length === 0) return undefined;
    
    const row = result[0];
    return {
      ...row.class,
      teacher: row.teacher!,
      enrollmentCount: Number(row.enrollmentCount),
      assignmentCount: Number(row.assignmentCount)
    };
  }
  
  // Assignment Management (Platform-wide)
  async getAllAssignments(options?: { limit?: number; offset?: number }): Promise<{ assignments: Array<Assignment & { class: TeacherClass; teacher: User }>; total: number }> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    
    const result = await db
      .select({
        assignment: assignments,
        class: teacherClasses,
        teacher: users
      })
      .from(assignments)
      .leftJoin(teacherClasses, eq(assignments.classId, teacherClasses.id))
      .leftJoin(users, eq(assignments.teacherId, users.id))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(assignments.createdAt));
    
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(assignments) as any;
    
    return {
      assignments: result.map(row => ({
        ...row.assignment,
        class: row.class!,
        teacher: row.teacher!
      })),
      total: Number(count)
    };
  }

  async getAllSubmissions(options?: { limit?: number; offset?: number }): Promise<{ submissions: Array<AssignmentSubmission & { assignment: Assignment; student: User }>; total: number }> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    
    const result = await db
      .select({
        submission: assignmentSubmissions,
        assignment: assignments,
        student: users
      })
      .from(assignmentSubmissions)
      .leftJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
      .leftJoin(users, eq(assignmentSubmissions.studentId, users.id))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(assignmentSubmissions.createdAt));
    
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(assignmentSubmissions) as any;
    
    return {
      submissions: result.map(row => ({
        ...row.submission,
        assignment: row.assignment!,
        student: row.student!
      })),
      total: Number(count)
    };
  }
  
  // Platform Metrics
  async getPlatformMetrics(): Promise<{
    totalUsers: number;
    totalStudents: number;
    totalTeachers: number;
    totalDevelopers: number;
    totalAdmins: number;
    totalClasses: number;
    totalAssignments: number;
    totalSubmissions: number;
    totalConversations: number;
  }> {
    const [
      { totalUsers },
      { totalStudents },
      { totalTeachers },
      { totalDevelopers },
      { totalAdmins },
      { totalClasses },
      { totalAssignments },
      { totalSubmissions },
      { totalConversations }
    ] = await Promise.all([
      db.select({ totalUsers: sql<number>`count(*)` }).from(users).then(r => r[0] as any),
      db.select({ totalStudents: sql<number>`count(*)` }).from(users).where(eq(users.role, 'student' as any)).then(r => r[0] as any),
      db.select({ totalTeachers: sql<number>`count(*)` }).from(users).where(eq(users.role, 'teacher' as any)).then(r => r[0] as any),
      db.select({ totalDevelopers: sql<number>`count(*)` }).from(users).where(eq(users.role, 'developer' as any)).then(r => r[0] as any),
      db.select({ totalAdmins: sql<number>`count(*)` }).from(users).where(eq(users.role, 'admin' as any)).then(r => r[0] as any),
      db.select({ totalClasses: sql<number>`count(*)` }).from(teacherClasses).then(r => r[0] as any),
      db.select({ totalAssignments: sql<number>`count(*)` }).from(assignments).then(r => r[0] as any),
      db.select({ totalSubmissions: sql<number>`count(*)` }).from(assignmentSubmissions).then(r => r[0] as any),
      db.select({ totalConversations: sql<number>`count(*)` }).from(conversations).then(r => r[0] as any),
    ]);
    
    return {
      totalUsers: Number(totalUsers),
      totalStudents: Number(totalStudents),
      totalTeachers: Number(totalTeachers),
      totalDevelopers: Number(totalDevelopers),
      totalAdmins: Number(totalAdmins),
      totalClasses: Number(totalClasses),
      totalAssignments: Number(totalAssignments),
      totalSubmissions: Number(totalSubmissions),
      totalConversations: Number(totalConversations),
    };
  }
  
  // Growth Metrics (time-series data)
  async getGrowthMetrics(days: number): Promise<{
    newUsers: Array<{ date: string; count: number }>;
    newClasses: Array<{ date: string; count: number }>;
    newAssignments: Array<{ date: string; count: number }>;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const [newUsers, newClasses, newAssignments] = await Promise.all([
      db
        .select({
          date: sql<string>`DATE(${users.createdAt})`,
          count: sql<number>`count(*)`
        })
        .from(users)
        .where(gte(users.createdAt, startDate))
        .groupBy(sql`DATE(${users.createdAt})`)
        .orderBy(sql`DATE(${users.createdAt})`),
      
      db
        .select({
          date: sql<string>`DATE(${teacherClasses.createdAt})`,
          count: sql<number>`count(*)`
        })
        .from(teacherClasses)
        .where(gte(teacherClasses.createdAt, startDate))
        .groupBy(sql`DATE(${teacherClasses.createdAt})`)
        .orderBy(sql`DATE(${teacherClasses.createdAt})`),
      
      db
        .select({
          date: sql<string>`DATE(${assignments.createdAt})`,
          count: sql<number>`count(*)`
        })
        .from(assignments)
        .where(gte(assignments.createdAt, startDate))
        .groupBy(sql`DATE(${assignments.createdAt})`)
        .orderBy(sql`DATE(${assignments.createdAt})`)
    ]) as any;
    
    return {
      newUsers: newUsers.map((r: any) => ({ date: r.date, count: Number(r.count) })),
      newClasses: newClasses.map((r: any) => ({ date: r.date, count: Number(r.count) })),
      newAssignments: newAssignments.map((r: any) => ({ date: r.date, count: Number(r.count) })),
    };
  }
  
  // Top Performers
  async getTopTeachers(limit: number): Promise<Array<User & { classCount: number; studentCount: number }>> {
    const result = await db
      .select({
        teacher: users,
        classCount: sql<number>`COUNT(DISTINCT ${teacherClasses.id})`,
        studentCount: sql<number>`COUNT(DISTINCT ${classEnrollments.studentId})`
      })
      .from(users)
      .leftJoin(teacherClasses, eq(users.id, teacherClasses.teacherId))
      .leftJoin(classEnrollments, eq(teacherClasses.id, classEnrollments.classId))
      .where(eq(users.role, 'teacher' as any))
      .groupBy(users.id)
      .orderBy(desc(sql`COUNT(DISTINCT ${teacherClasses.id})`))
      .limit(limit);
    
    return result.map(row => ({
      ...row.teacher,
      classCount: Number(row.classCount),
      studentCount: Number(row.studentCount)
    }));
  }

  async getTopClasses(limit: number): Promise<Array<TeacherClass & { teacher: User; enrollmentCount: number }>> {
    const result = await db
      .select({
        class: teacherClasses,
        teacher: users,
        enrollmentCount: sql<number>`COUNT(${classEnrollments.id})`
      })
      .from(teacherClasses)
      .leftJoin(users, eq(teacherClasses.teacherId, users.id))
      .leftJoin(classEnrollments, eq(teacherClasses.id, classEnrollments.classId))
      .groupBy(teacherClasses.id, users.id)
      .orderBy(desc(sql`COUNT(${classEnrollments.id})`))
      .limit(limit);
    
    return result.map(row => ({
      ...row.class,
      teacher: row.teacher!,
      enrollmentCount: Number(row.enrollmentCount)
    }));
  }
  
  // Audit Logging
  async logAdminAction(data: {
    actorId: string;
    action: string;
    targetType?: string;
    targetId?: string;
    metadata?: any;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await db.insert(adminAuditLog).values(data);
  }

  async getAdminAuditLogs(options?: { limit?: number; offset?: number; actorId?: string }): Promise<{ logs: any[]; total: number }> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    
    const logs = options?.actorId
      ? await db.select().from(adminAuditLog).where(eq(adminAuditLog.actorId, options.actorId)).limit(limit).offset(offset).orderBy(desc(adminAuditLog.createdAt))
      : await db.select().from(adminAuditLog).limit(limit).offset(offset).orderBy(desc(adminAuditLog.createdAt));
    
    const countResult = options?.actorId
      ? await db.select({ count: sql<number>`count(*)` }).from(adminAuditLog).where(eq(adminAuditLog.actorId, options.actorId))
      : await db.select({ count: sql<number>`count(*)` }).from(adminAuditLog);
    
    return {
      logs,
      total: Number((countResult[0] as any).count)
    };
  }
  
  // Impersonation
  async startImpersonation(adminId: string, targetUserId: string, durationMinutes: number): Promise<User | undefined> {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + durationMinutes);
    
    const [updated] = await db
      .update(users)
      .set({
        impersonatedUserId: targetUserId,
        impersonatedBy: adminId,
        impersonationExpiresAt: expiresAt,
        updatedAt: new Date()
      })
      .where(eq(users.id, targetUserId))
      .returning();
    
    return updated;
  }

  async endImpersonation(userId: string): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({
        impersonatedUserId: null,
        impersonatedBy: null,
        impersonationExpiresAt: null,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    
    return updated;
  }

  async getActiveImpersonations(): Promise<Array<User & { impersonatedUserEmail?: string }>> {
    const now = new Date();
    const result = await db
      .select({
        user: users,
        impersonatedUser: {
          email: users.email
        }
      })
      .from(users)
      .where(
        and(
          sql`${users.impersonatedBy} IS NOT NULL`,
          gte(users.impersonationExpiresAt as any, now)
        )
      );
    
    return result.map(row => ({
      ...row.user,
      impersonatedUserEmail: row.impersonatedUser.email || undefined
    }));
  }

  // ===== Organization System Implementation (Phases 1, 2, 3) =====

  // Phase 1: Toggle star on conversation
  async toggleConversationStar(id: string, userId: string): Promise<Conversation | undefined> {
    const conversation = await this.getConversation(id, userId);
    if (!conversation) return undefined;
    
    const [updated] = await db
      .update(conversations)
      .set({ isStarred: !conversation.isStarred })
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
      .returning();
    
    return updated;
  }

  // Phase 1: Get filtered conversations
  async getFilteredConversations(userId: string, filter: {
    timeFilter?: 'today' | 'week' | 'month' | 'older';
    starredOnly?: boolean;
    topicId?: string;
  }): Promise<Conversation[]> {
    const conditions: any[] = [eq(conversations.userId, userId)];
    
    // Time-based filtering
    if (filter.timeFilter) {
      const now = new Date();
      let dateThreshold: Date;
      
      switch (filter.timeFilter) {
        case 'today':
          dateThreshold = new Date(now.setHours(0, 0, 0, 0));
          conditions.push(gte(conversations.createdAt, dateThreshold));
          break;
        case 'week':
          dateThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          conditions.push(gte(conversations.createdAt, dateThreshold));
          break;
        case 'month':
          dateThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          conditions.push(gte(conversations.createdAt, dateThreshold));
          break;
        case 'older':
          dateThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          conditions.push(lte(conversations.createdAt, dateThreshold));
          break;
      }
    }
    
    // Starred filter
    if (filter.starredOnly) {
      conditions.push(eq(conversations.isStarred, true));
    }
    
    // Topic filter (requires join)
    if (filter.topicId) {
      const convIds = await db
        .select({ conversationId: conversationTopics.conversationId })
        .from(conversationTopics)
        .where(eq(conversationTopics.topicId, filter.topicId));
      
      if (convIds.length > 0) {
        conditions.push(sql`${conversations.id} IN (${sql.join(convIds.map(c => sql`${c.conversationId}`), sql`, `)})`);
      } else {
        return []; // No conversations match this topic
      }
    }
    
    return await db
      .select()
      .from(conversations)
      .where(and(...conditions))
      .orderBy(desc(conversations.createdAt));
  }

  // Phase 1: Get filtered vocabulary
  async getFilteredVocabulary(userId: string, language: string, filter: {
    timeFilter?: 'today' | 'week' | 'month' | 'older';
    topicId?: string;
    sourceConversationId?: string;
  }): Promise<VocabularyWord[]> {
    const conditions: any[] = [
      eq(vocabularyWords.userId, userId),
      eq(vocabularyWords.language, language)
    ];
    
    // Time-based filtering
    if (filter.timeFilter) {
      const now = new Date();
      let dateThreshold: Date;
      
      switch (filter.timeFilter) {
        case 'today':
          dateThreshold = new Date(now.setHours(0, 0, 0, 0));
          conditions.push(gte(vocabularyWords.createdAt, dateThreshold));
          break;
        case 'week':
          dateThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          conditions.push(gte(vocabularyWords.createdAt, dateThreshold));
          break;
        case 'month':
          dateThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          conditions.push(gte(vocabularyWords.createdAt, dateThreshold));
          break;
        case 'older':
          dateThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          conditions.push(lte(vocabularyWords.createdAt, dateThreshold));
          break;
      }
    }
    
    // Source conversation filter
    if (filter.sourceConversationId) {
      conditions.push(eq(vocabularyWords.sourceConversationId, filter.sourceConversationId));
    }
    
    // Topic filter
    if (filter.topicId) {
      const wordIds = await db
        .select({ vocabularyWordId: vocabularyWordTopics.vocabularyWordId })
        .from(vocabularyWordTopics)
        .where(eq(vocabularyWordTopics.topicId, filter.topicId));
      
      if (wordIds.length > 0) {
        conditions.push(sql`${vocabularyWords.id} IN (${sql.join(wordIds.map(w => sql`${w.vocabularyWordId}`), sql`, `)})`);
      } else {
        return [];
      }
    }
    
    return await db
      .select()
      .from(vocabularyWords)
      .where(and(...conditions))
      .orderBy(desc(vocabularyWords.createdAt));
  }

  // Phase 2: Conversation topic tagging
  async addConversationTopic(conversationId: string, topicId: string, confidence: number = 1.0): Promise<ConversationTopic> {
    const [created] = await db
      .insert(conversationTopics)
      .values({ conversationId, topicId, confidence })
      .returning();
    return created;
  }

  async getConversationTopics(conversationId: string): Promise<Array<ConversationTopic & { topic: Topic }>> {
    const result = await db
      .select({
        conversationTopic: conversationTopics,
        topic: topicsTable
      })
      .from(conversationTopics)
      .innerJoin(topicsTable, eq(conversationTopics.topicId, topicsTable.id))
      .where(eq(conversationTopics.conversationId, conversationId));
    
    return result.map(r => ({ ...r.conversationTopic, topic: r.topic }));
  }

  async removeConversationTopic(conversationId: string, topicId: string): Promise<boolean> {
    const result = await db
      .delete(conversationTopics)
      .where(and(
        eq(conversationTopics.conversationId, conversationId),
        eq(conversationTopics.topicId, topicId)
      ));
    return true;
  }

  // Phase 2: Vocabulary topic tagging
  async addVocabularyWordTopic(vocabularyWordId: string, topicId: string): Promise<VocabularyWordTopic> {
    const [created] = await db
      .insert(vocabularyWordTopics)
      .values({ vocabularyWordId, topicId })
      .returning();
    return created;
  }

  async getVocabularyWordTopics(vocabularyWordId: string): Promise<Array<VocabularyWordTopic & { topic: Topic }>> {
    const result = await db
      .select({
        vocabTopic: vocabularyWordTopics,
        topic: topicsTable
      })
      .from(vocabularyWordTopics)
      .innerJoin(topicsTable, eq(vocabularyWordTopics.topicId, topicsTable.id))
      .where(eq(vocabularyWordTopics.vocabularyWordId, vocabularyWordId));
    
    return result.map(r => ({ ...r.vocabTopic, topic: r.topic }));
  }

  async removeVocabularyWordTopic(vocabularyWordId: string, topicId: string): Promise<boolean> {
    await db
      .delete(vocabularyWordTopics)
      .where(and(
        eq(vocabularyWordTopics.vocabularyWordId, vocabularyWordId),
        eq(vocabularyWordTopics.topicId, topicId)
      ));
    return true;
  }

  // Phase 3: User Lessons
  async createUserLesson(data: InsertUserLesson): Promise<UserLesson> {
    const [created] = await db.insert(userLessons).values(data).returning();
    return created;
  }

  async getUserLessons(userId: string, language?: string): Promise<UserLesson[]> {
    const conditions = [eq(userLessons.userId, userId), eq(userLessons.isArchived, false)];
    if (language) {
      conditions.push(eq(userLessons.language, language));
    }
    return await db
      .select()
      .from(userLessons)
      .where(and(...conditions))
      .orderBy(desc(userLessons.createdAt));
  }

  async getUserLesson(id: string, userId: string): Promise<UserLesson | undefined> {
    const [lesson] = await db
      .select()
      .from(userLessons)
      .where(and(eq(userLessons.id, id), eq(userLessons.userId, userId)));
    return lesson;
  }

  async updateUserLesson(id: string, userId: string, data: Partial<UserLesson>): Promise<UserLesson | undefined> {
    const [updated] = await db
      .update(userLessons)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(userLessons.id, id), eq(userLessons.userId, userId)))
      .returning();
    return updated;
  }

  async deleteUserLesson(id: string, userId: string): Promise<boolean> {
    // Soft delete by archiving
    const result = await this.updateUserLesson(id, userId, { isArchived: true });
    return !!result;
  }

  // Phase 3: Lesson Items
  async addLessonItem(data: InsertUserLessonItem): Promise<UserLessonItem> {
    const [created] = await db.insert(userLessonItems).values(data).returning();
    return created;
  }

  async getLessonItems(lessonId: string): Promise<Array<UserLessonItem & { conversation?: Conversation; vocabularyWord?: VocabularyWord }>> {
    const items = await db
      .select()
      .from(userLessonItems)
      .where(eq(userLessonItems.lessonId, lessonId))
      .orderBy(userLessonItems.displayOrder);
    
    // Fetch related data
    const result = await Promise.all(items.map(async (item) => {
      let conversation: Conversation | undefined;
      let vocabularyWord: VocabularyWord | undefined;
      
      if (item.conversationId) {
        const [conv] = await db.select().from(conversations).where(eq(conversations.id, item.conversationId));
        conversation = conv;
      }
      if (item.vocabularyWordId) {
        const [word] = await db.select().from(vocabularyWords).where(eq(vocabularyWords.id, item.vocabularyWordId));
        vocabularyWord = word;
      }
      
      return { ...item, conversation, vocabularyWord };
    }));
    
    return result;
  }

  async removeLessonItem(id: string): Promise<boolean> {
    await db.delete(userLessonItems).where(eq(userLessonItems.id, id));
    return true;
  }

  // Phase 3: Auto-generate weekly lesson
  async generateWeeklyLesson(userId: string, language: string, weekStart: Date): Promise<UserLesson | null> {
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    // Get conversations from this week
    const weekConversations = await db
      .select()
      .from(conversations)
      .where(and(
        eq(conversations.userId, userId),
        eq(conversations.language, language),
        gte(conversations.createdAt, weekStart),
        lte(conversations.createdAt, weekEnd)
      ))
      .orderBy(conversations.createdAt);
    
    // Get vocabulary from this week
    const weekVocabulary = await db
      .select()
      .from(vocabularyWords)
      .where(and(
        eq(vocabularyWords.userId, userId),
        eq(vocabularyWords.language, language),
        gte(vocabularyWords.createdAt, weekStart),
        lte(vocabularyWords.createdAt, weekEnd)
      ));
    
    // Only create if there's content
    if (weekConversations.length === 0 && weekVocabulary.length === 0) {
      return null;
    }
    
    // Calculate total minutes
    const totalMinutes = weekConversations.reduce((sum, c) => sum + c.duration, 0);
    
    // Create the lesson
    const weekLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const lesson = await this.createUserLesson({
      userId,
      language,
      title: `Week of ${weekLabel}`,
      description: `${weekConversations.length} conversations, ${weekVocabulary.length} new words`,
      startDate: weekStart,
      endDate: weekEnd,
      conversationCount: weekConversations.length,
      vocabularyCount: weekVocabulary.length,
      totalMinutes,
      lessonType: 'weekly_auto'
    });
    
    // Add items
    let order = 0;
    for (const conv of weekConversations) {
      await this.addLessonItem({
        lessonId: lesson.id,
        itemType: 'conversation',
        conversationId: conv.id,
        displayOrder: order++
      });
    }
    for (const word of weekVocabulary) {
      await this.addLessonItem({
        lessonId: lesson.id,
        itemType: 'vocabulary',
        vocabularyWordId: word.id,
        displayOrder: order++
      });
    }
    
    return lesson;
  }
}

export const storage = new DatabaseStorage();
