import {
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type VocabularyWord,
  type InsertVocabularyWord,
  type GrammarExercise,
  type InsertGrammarExercise,
  type GrammarCompetency,
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
  type SyllabusProgress,
  type InsertSyllabusProgress,
  type AdminAuditLog,
  type ConversationTopic,
  type InsertConversationTopic,
  type VocabularyWordTopic,
  type InsertVocabularyWordTopic,
  type UserLesson,
  type InsertUserLesson,
  type UserLessonItem,
  type InsertUserLessonItem,
  type ActflProgress,
  type InsertActflProgress,
  type ClassHourPackage,
  type InsertClassHourPackage,
  type ClassType,
  type InsertClassType,
  type ClassCurriculumUnit,
  type InsertClassCurriculumUnit,
  type ClassCurriculumLesson,
  type InsertClassCurriculumLesson,
  type UserLanguagePreferences,
  type InsertUserLanguagePreferences,
  userLanguagePreferences,
  classHourPackages,
  classTypes,
  classCurriculumUnits,
  classCurriculumLessons,
  users,
  conversations,
  messages,
  vocabularyWords,
  grammarExercises,
  grammarCompetencies,
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
  syllabusProgress,
  adminAuditLog,
  conversationTopics,
  vocabularyWordTopics,
  userLessons,
  userLessonItems,
  tutorVoices,
  actflProgress as actflProgressTable,
  type TutorVoice,
  type InsertTutorVoice,
  lessonCanDoStatements,
  type LessonCanDoStatement,
  usageLedger,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { markCorrect, markIncorrect } from "./spaced-repetition";
import { db } from "./db";
import { eq, and, desc, gte, lte, sql, isNull, inArray } from "drizzle-orm";

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
    tutorGender?: 'male' | 'female';
    tutorPersonality?: 'warm' | 'calm' | 'energetic' | 'professional';
    tutorExpressiveness?: number;
  }): Promise<User | undefined>;
  updateUserStripeInfo(userId: string, stripeInfo: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionTier?: string;
    subscriptionStatus?: string;
  }): Promise<User | undefined>;
  updateUserActfl(userId: string, actflData: {
    actflLevel?: string;
    actflAssessed?: boolean;
    assessmentSource?: string;
    lastAssessmentDate?: Date;
  }): Promise<User | undefined>;

  // Per-language self-directed preferences
  getLanguagePreferences(userId: string, language: string): Promise<UserLanguagePreferences | undefined>;
  getAllLanguagePreferences(userId: string): Promise<UserLanguagePreferences[]>;
  upsertLanguagePreferences(userId: string, language: string, preferences: {
    selfDirectedFlexibility?: 'guided' | 'flexible_goals' | 'open_exploration' | 'free_conversation';
    selfDirectedPlacementDone?: boolean;
  }): Promise<UserLanguagePreferences>;
  hasClassEnrollmentForLanguage(userId: string, language: string): Promise<boolean>;

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
  getGrammarCompetencies(language: string): Promise<GrammarCompetency[]>;
  getGrammarExercisesByCompetency(language: string, competencyId?: string): Promise<GrammarExercise[]>;

  // User Progress
  getOrCreateUserProgress(language: string, userId: string): Promise<UserProgress>;
  updateUserProgress(id: string, data: Partial<UserProgress>): Promise<UserProgress | undefined>;
  recordActivityAndUpdateStreak(userId: string, language: string, practiceMinutesToAdd?: number): Promise<UserProgress>;
  getUserLanguages(userId: string): Promise<string[]>;

  // ACTFL Progress (FACT criteria tracking for advancement)
  getOrCreateActflProgress(language: string, userId: string): Promise<ActflProgress>;
  updateActflProgress(id: string, data: Partial<ActflProgress>): Promise<ActflProgress | undefined>;
  recordVoiceExchange(userId: string, language: string, data: {
    pronunciationConfidence?: number;
    messageLength: number;
    topicsCovered?: string[];
    tasksCompleted?: string[];
  }): Promise<ActflProgress>;

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
  updateCulturalTip(id: string, data: Partial<InsertCulturalTip>): Promise<CulturalTip>;

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

  // Class Types (for categorizing classes)
  createClassType(data: InsertClassType): Promise<ClassType>;
  getClassType(id: string): Promise<ClassType | undefined>;
  getClassTypeBySlug(slug: string): Promise<ClassType | undefined>;
  getAllClassTypes(): Promise<ClassType[]>;
  getActiveClassTypes(): Promise<ClassType[]>;
  updateClassType(id: string, data: Partial<ClassType>): Promise<ClassType | undefined>;
  deleteClassType(id: string): Promise<boolean>;
  seedClassTypes(): Promise<void>;

  // Teacher Classes
  createTeacherClass(data: InsertTeacherClass): Promise<TeacherClass>;
  getTeacherClass(id: string): Promise<TeacherClass | undefined>;
  getTeacherClasses(teacherId: string): Promise<TeacherClass[]>;
  getAllActiveClasses(): Promise<TeacherClass[]>;
  getFeaturedClasses(): Promise<Array<TeacherClass & { classType?: ClassType }>>;
  updateTeacherClass(id: string, data: Partial<TeacherClass>): Promise<TeacherClass | undefined>;
  deleteTeacherClass(id: string): Promise<boolean>;
  getClassByJoinCode(joinCode: string): Promise<TeacherClass | undefined>;

  // Class Hour Packages (Institutional)
  createClassHourPackage(data: InsertClassHourPackage): Promise<ClassHourPackage>;
  getClassHourPackage(id: string): Promise<ClassHourPackage | undefined>;
  getClassHourPackages(purchaserId?: string): Promise<ClassHourPackage[]>;
  updateClassHourPackage(id: string, data: Partial<ClassHourPackage>): Promise<ClassHourPackage | undefined>;
  deleteClassHourPackage(id: string): Promise<boolean>;
  
  // Class Enrollments
  enrollStudent(classId: string, studentId: string): Promise<ClassEnrollment>;
  getClassEnrollments(classId: string): Promise<Array<ClassEnrollment & { student: User }>>;
  getStudentEnrollments(studentId: string): Promise<Array<ClassEnrollment & { class: TeacherClass }>>;
  unenrollStudent(classId: string, studentId: string): Promise<boolean>;
  isStudentEnrolled(classId: string, studentId: string): Promise<boolean>;
  updateClassEnrollment(enrollmentId: string, data: Partial<ClassEnrollment>): Promise<ClassEnrollment | undefined>;

  // Curriculum Paths
  createCurriculumPath(data: InsertCurriculumPath): Promise<CurriculumPath>;
  getCurriculumPath(id: string): Promise<CurriculumPath | undefined>;
  getCurriculumPaths(language?: string): Promise<CurriculumPath[]>;
  getCurriculumStats(): Promise<{ pathCount: number; unitCount: number; lessonCount: number; languageCount: number }>;
  updateCurriculumPath(id: string, data: Partial<CurriculumPath>): Promise<CurriculumPath | undefined>;

  // Curriculum Units
  createCurriculumUnit(data: InsertCurriculumUnit): Promise<CurriculumUnit>;
  getCurriculumUnits(curriculumPathId: string): Promise<CurriculumUnit[]>;
  getCurriculumUnit(id: string): Promise<CurriculumUnit | undefined>;

  // Curriculum Lessons
  createCurriculumLesson(data: InsertCurriculumLesson): Promise<CurriculumLesson>;
  getCurriculumLessons(curriculumUnitId: string): Promise<CurriculumLesson[]>;
  getCurriculumLesson(id: string): Promise<CurriculumLesson | undefined>;

  // Class-Specific Curriculum (Teacher's Customizable Syllabi)
  cloneCurriculumToClass(classId: string, curriculumPathId: string): Promise<{ units: ClassCurriculumUnit[]; lessons: ClassCurriculumLesson[] }>;
  getClassCurriculumUnits(classId: string): Promise<ClassCurriculumUnit[]>;
  getClassCurriculumUnit(id: string): Promise<ClassCurriculumUnit | undefined>;
  createClassCurriculumUnit(data: InsertClassCurriculumUnit): Promise<ClassCurriculumUnit>;
  updateClassCurriculumUnit(id: string, data: Partial<ClassCurriculumUnit>): Promise<ClassCurriculumUnit | undefined>;
  deleteClassCurriculumUnit(id: string): Promise<boolean>;
  reorderClassCurriculumUnits(classId: string, unitIds: string[]): Promise<ClassCurriculumUnit[]>;
  getClassCurriculumLessons(classUnitId: string): Promise<ClassCurriculumLesson[]>;
  getClassCurriculumLessonsForUnits(classUnitIds: string[]): Promise<ClassCurriculumLesson[]>;
  getClassCurriculumLesson(id: string): Promise<ClassCurriculumLesson | undefined>;
  createClassCurriculumLesson(data: InsertClassCurriculumLesson): Promise<ClassCurriculumLesson>;
  updateClassCurriculumLesson(id: string, data: Partial<ClassCurriculumLesson>): Promise<ClassCurriculumLesson | undefined>;
  deleteClassCurriculumLesson(id: string): Promise<boolean>;
  reorderClassCurriculumLessons(classUnitId: string, lessonIds: string[]): Promise<ClassCurriculumLesson[]>;
  getClassSyllabus(classId: string): Promise<{ units: Array<ClassCurriculumUnit & { lessons: ClassCurriculumLesson[] }> }>;

  // Can-Do Statements
  getCanDoStatementsByLanguage(language: string): Promise<CanDoStatement[]>;
  getLessonCanDoStatements(lessonIds: string[]): Promise<LessonCanDoStatement[]>;

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

  // Syllabus Progress
  createSyllabusProgress(data: InsertSyllabusProgress): Promise<SyllabusProgress>;
  getSyllabusProgress(studentId: string, classId: string): Promise<SyllabusProgress[]>;
  getSyllabusProgressByLesson(studentId: string, classId: string, lessonId: string): Promise<SyllabusProgress | undefined>;
  updateSyllabusProgress(id: string, data: Partial<SyllabusProgress>): Promise<SyllabusProgress | undefined>;
  getEarlyCompletions(classId: string): Promise<Array<SyllabusProgress & { student: User; lesson: CurriculumLesson }>>;
  checkLessonCoverage(studentId: string, classId: string, lessonId: string, coveredTopics: string[]): Promise<{ covered: boolean; coveragePercent: number; missingTopics: string[] }>;

  // ===== Admin-Only Methods =====
  
  // User Management
  getAllUsers(options?: { role?: string; limit?: number; offset?: number }): Promise<{ users: User[]; total: number }>;
  updateUserRole(userId: string, newRole: 'student' | 'teacher' | 'developer' | 'admin'): Promise<User | undefined>;
  updateUserDetails(userId: string, data: { firstName?: string; lastName?: string; email?: string; isTestAccount?: boolean; isBetaTester?: boolean }): Promise<User | undefined>;
  grantCredits(userId: string, creditHours: number, description: string, expiresAt?: Date): Promise<void>;
  
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

  // Review Hub: Unified learning data aggregation
  getReviewHubData(userId: string, language?: string, classId?: string, selfDirectedOnly?: boolean): Promise<{
    dueFlashcards: VocabularyWord[];
    recentConversations: Array<Conversation & { topics: Array<{ topic: Topic }> }>;
    culturalTips: CulturalTip[];
    activeLessons: UserLesson[];
    recentVocabulary: VocabularyWord[];
    topicsWithContent: Array<Topic & { conversationCount: number; vocabularyCount: number }>;
    nextLesson: {
      classId: string;
      className: string;
      lessonId: string;
      lessonName: string;
      lessonDescription: string | null;
      unitName: string;
      lessonType: string;
    } | null;
    upcomingAssignments: Array<{
      id: string;
      title: string;
      description: string | null;
      dueDate: Date | null;
      classId: string;
      className: string;
      lessonId: string | null;
      status: 'not_started' | 'in_progress' | 'submitted' | 'graded' | 'overdue';
    }>;
    syllabusOverview: {
      classId: string;
      className: string;
      curriculumName: string;
      totalLessons: number;
      completedLessons: number;
      units: Array<{
        id: string;
        name: string;
        orderIndex: number;
        lessons: Array<{
          id: string;
          name: string;
          orderIndex: number;
          lessonType: string;
          status: 'not_started' | 'in_progress' | 'completed';
          estimatedMinutes: number | null;
        }>;
      }>;
    } | null;
    stats: {
      totalConversations: number;
      totalVocabulary: number;
      dueCount: number;
      streakDays: number;
    };
  }>;

  // ===== Tutor Voice Management (Admin Console) =====
  
  // Get voice for a specific language and gender
  getTutorVoice(language: string, gender: 'male' | 'female'): Promise<TutorVoice | undefined>;
  
  // Get all configured voices
  getAllTutorVoices(): Promise<TutorVoice[]>;
  
  // Create or update a voice configuration
  upsertTutorVoice(data: InsertTutorVoice): Promise<TutorVoice>;
  
  // Delete a voice configuration
  deleteTutorVoice(id: string): Promise<boolean>;
  
  // Seed default voices (for initial setup)
  seedDefaultTutorVoices(): Promise<void>;

  // ===== Admin: Reset User Learning Data =====
  resetUserLearningData(userId: string, options?: {
    resetVocabulary?: boolean;
    resetConversations?: boolean;
    resetProgress?: boolean;
    resetLessons?: boolean;
  }): Promise<{ 
    vocabularyDeleted: number;
    conversationsDeleted: number;
    progressReset: boolean;
    lessonsDeleted: number;
  }>;
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
    // Build the update set - always update profile info
    const updateSet: Record<string, any> = {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      updatedAt: new Date(),
    };
    
    // Only update role if provided (for OIDC claims that include roles)
    // Role priority: admin > developer > teacher > student
    // We only upgrade roles, never downgrade
    if (user.role && user.id) {
      const rolePriority: Record<string, number> = {
        student: 1,
        teacher: 2,
        developer: 3,
        admin: 4,
      };
      
      // Check existing user's role to avoid downgrade
      const existingUser = await this.getUser(user.id);
      const existingPriority = existingUser?.role ? rolePriority[existingUser.role] || 0 : 0;
      const newPriority = rolePriority[user.role] || 0;
      
      // Only upgrade role, never downgrade
      if (newPriority > existingPriority) {
        updateSet.role = user.role;
      }
    }
    
    // Update test account flag if provided
    if (user.isTestAccount !== undefined) {
      updateSet.isTestAccount = user.isTestAccount;
    }
    
    const [upserted] = await db
      .insert(users)
      .values(user)
      .onConflictDoUpdate({
        target: users.id,
        set: updateSet,
      })
      .returning();
    return upserted;
  }

  async updateUserPreferences(userId: string, preferences: {
    targetLanguage?: string;
    nativeLanguage?: string;
    difficultyLevel?: string;
    onboardingCompleted?: boolean;
    tutorGender?: 'male' | 'female';
    tutorPersonality?: 'warm' | 'calm' | 'energetic' | 'professional';
    tutorExpressiveness?: number;
    selfDirectedFlexibility?: 'guided' | 'flexible_goals' | 'open_exploration' | 'free_conversation';
    selfDirectedPlacementDone?: boolean;
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

  async updateUserActfl(userId: string, actflData: {
    actflLevel?: string;
    actflAssessed?: boolean;
    assessmentSource?: string;
    lastAssessmentDate?: Date;
  }): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ ...actflData, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  // Per-language self-directed preferences
  async getLanguagePreferences(userId: string, language: string): Promise<UserLanguagePreferences | undefined> {
    const [prefs] = await db.select()
      .from(userLanguagePreferences)
      .where(and(
        eq(userLanguagePreferences.userId, userId),
        eq(userLanguagePreferences.language, language.toLowerCase())
      ))
      .limit(1);
    return prefs;
  }

  async getAllLanguagePreferences(userId: string): Promise<UserLanguagePreferences[]> {
    return db.select()
      .from(userLanguagePreferences)
      .where(eq(userLanguagePreferences.userId, userId));
  }

  async upsertLanguagePreferences(userId: string, language: string, preferences: {
    selfDirectedFlexibility?: 'guided' | 'flexible_goals' | 'open_exploration' | 'free_conversation';
    selfDirectedPlacementDone?: boolean;
  }): Promise<UserLanguagePreferences> {
    const normalizedLanguage = language.toLowerCase();
    const existing = await this.getLanguagePreferences(userId, normalizedLanguage);
    
    if (existing) {
      const [updated] = await db.update(userLanguagePreferences)
        .set({
          ...preferences,
          updatedAt: new Date(),
        })
        .where(eq(userLanguagePreferences.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(userLanguagePreferences)
        .values({
          userId,
          language: normalizedLanguage,
          selfDirectedFlexibility: preferences.selfDirectedFlexibility || 'flexible_goals',
          selfDirectedPlacementDone: preferences.selfDirectedPlacementDone || false,
        })
        .returning();
      return created;
    }
  }

  async hasClassEnrollmentForLanguage(userId: string, language: string): Promise<boolean> {
    // Check if user has any active class enrollments for this specific language
    const normalizedLanguage = language.toLowerCase();
    const enrollments = await db.select({ id: classEnrollments.id })
      .from(classEnrollments)
      .innerJoin(teacherClasses, eq(classEnrollments.classId, teacherClasses.id))
      .where(and(
        eq(classEnrollments.studentId, userId),
        eq(classEnrollments.status, 'active'),
        sql`LOWER(${teacherClasses.language}) = ${normalizedLanguage}`
      ))
      .limit(1);
    return enrollments.length > 0;
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
    // Automatically set learningContext based on classId
    const conversationData = {
      ...data,
      learningContext: data.classId ? 'class_assigned' : 'self_directed',
    } as typeof conversations.$inferInsert;
    
    const [conversation] = await db.insert(conversations).values(conversationData).returning();
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

  async getGrammarCompetencies(language: string): Promise<GrammarCompetency[]> {
    return await db.select().from(grammarCompetencies)
      .where(eq(grammarCompetencies.language, language))
      .orderBy(grammarCompetencies.actflLevelNumeric, grammarCompetencies.name);
  }

  async getGrammarExercisesByCompetency(language: string, competencyId?: string): Promise<GrammarExercise[]> {
    if (competencyId) {
      return await db.select().from(grammarExercises)
        .where(and(
          eq(grammarExercises.language, language),
          eq(grammarExercises.competencyId, competencyId)
        ));
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

  /**
   * Record user activity and update the streak
   * Call this when user completes a conversation, voice session, or any learning activity
   */
  async recordActivityAndUpdateStreak(userId: string, language: string, practiceMinutesToAdd: number = 0): Promise<UserProgress> {
    const progress = await this.getOrCreateUserProgress(language, userId);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Midnight today
    const lastPractice = progress.lastPracticeDate ? new Date(progress.lastPracticeDate) : null;
    
    let newStreak = progress.currentStreak || 0;
    let totalPracticeDays = progress.totalPracticeDays || 0;
    
    if (lastPractice) {
      const lastPracticeDay = new Date(lastPractice.getFullYear(), lastPractice.getMonth(), lastPractice.getDate());
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      
      const daysDiff = Math.floor((today.getTime() - lastPracticeDay.getTime()) / (24 * 60 * 60 * 1000));
      
      if (daysDiff === 0) {
        // Same day - streak stays the same, don't increment practice days
      } else if (daysDiff === 1) {
        // Yesterday - increment streak
        newStreak += 1;
        totalPracticeDays += 1;
      } else {
        // More than 1 day gap - reset streak to 1
        newStreak = 1;
        totalPracticeDays += 1;
      }
    } else {
      // First time practicing
      newStreak = 1;
      totalPracticeDays = 1;
    }
    
    // Update longest streak if current exceeds it
    const longestStreak = Math.max(progress.longestStreak || 0, newStreak);
    
    // Update practice minutes
    const practiceMinutes = (progress.practiceMinutes || 0) + practiceMinutesToAdd;
    
    const [updated] = await db.update(userProgressTable)
      .set({
        currentStreak: newStreak,
        longestStreak,
        totalPracticeDays,
        practiceMinutes,
        lastPracticeDate: now,
      })
      .where(eq(userProgressTable.id, progress.id))
      .returning();
    
    return updated || progress;
  }

  async getUserLanguages(userId: string): Promise<string[]> {
    const results = await db.select({ language: userProgressTable.language })
      .from(userProgressTable)
      .where(eq(userProgressTable.userId, userId));
    
    // Filter out invalid language entries (like UUIDs that got mistakenly stored)
    const validLanguages = ['spanish', 'french', 'german', 'italian', 'portuguese', 'japanese', 'mandarin', 'korean'];
    return results
      .map(r => r.language.toLowerCase())
      .filter(lang => validLanguages.includes(lang));
  }

  // ACTFL Progress Methods
  async getOrCreateActflProgress(language: string, userId: string): Promise<ActflProgress> {
    const result = await db.select().from(actflProgressTable)
      .where(and(eq(actflProgressTable.language, language), eq(actflProgressTable.userId, userId)));
    
    if (result.length > 0) {
      return result[0];
    }

    const [progress] = await db.insert(actflProgressTable)
      .values({ 
        language, 
        userId,
        currentActflLevel: 'novice_low',
        tasksCompleted: [],
        topicsCovered: [],
        textType: 'words',
      })
      .returning();
    return progress;
  }

  async updateActflProgress(id: string, data: Partial<ActflProgress>): Promise<ActflProgress | undefined> {
    const updateData: any = { ...data, updatedAt: new Date() };
    const [updated] = await db.update(actflProgressTable)
      .set(updateData)
      .where(eq(actflProgressTable.id, id))
      .returning();
    return updated;
  }

  async recordVoiceExchange(userId: string, language: string, data: {
    pronunciationConfidence?: number;
    messageLength: number;
    topicsCovered?: string[];
    tasksCompleted?: string[];
  }): Promise<ActflProgress> {
    const progress = await this.getOrCreateActflProgress(language, userId);
    
    // Update message count at current level
    const messagesAtCurrentLevel = (progress.messagesAtCurrentLevel || 0) + 1;
    
    // Update average message length (rolling average based on messages at level)
    const currentAvgLength = progress.avgMessageLength || 0;
    const avgMessageLength = messagesAtCurrentLevel === 1 
      ? data.messageLength 
      : (currentAvgLength * (messagesAtCurrentLevel - 1) + data.messageLength) / messagesAtCurrentLevel;
    
    // Update pronunciation confidence (rolling average)
    let avgPronunciationConfidence = progress.avgPronunciationConfidence || 0;
    if (data.pronunciationConfidence !== undefined) {
      avgPronunciationConfidence = messagesAtCurrentLevel === 1
        ? data.pronunciationConfidence
        : (avgPronunciationConfidence * (messagesAtCurrentLevel - 1) + data.pronunciationConfidence) / messagesAtCurrentLevel;
    }
    
    // Merge topics (unique)
    let topicsCovered = progress.topicsCovered || [];
    if (data.topicsCovered && data.topicsCovered.length > 0) {
      const existingTopics = new Set(topicsCovered);
      data.topicsCovered.forEach(t => existingTopics.add(t));
      topicsCovered = Array.from(existingTopics);
    }
    
    // Merge tasks (unique)
    let tasksCompleted = progress.tasksCompleted || [];
    if (data.tasksCompleted && data.tasksCompleted.length > 0) {
      const existingTasks = new Set(tasksCompleted);
      data.tasksCompleted.forEach(t => existingTasks.add(t));
      tasksCompleted = Array.from(existingTasks);
    }
    
    // Calculate days at current level (from last advancement or creation)
    const levelStartDate = progress.lastAdvancement || progress.createdAt || new Date();
    const daysAtCurrentLevel = Math.floor((Date.now() - levelStartDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Determine text type based on average message length
    let textType: string = 'words';
    if (avgMessageLength >= 15) {
      textType = 'paragraphs';
    } else if (avgMessageLength >= 5) {
      textType = 'sentences';
    }
    
    const updated = await this.updateActflProgress(progress.id, {
      messagesAtCurrentLevel,
      avgMessageLength,
      avgPronunciationConfidence,
      topicsCovered,
      topicsTotal: topicsCovered.length,
      tasksCompleted,
      tasksTotal: tasksCompleted.length,
      daysAtCurrentLevel,
      textType,
    });
    
    return updated || progress;
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

  async updateCulturalTip(id: string, data: Partial<InsertCulturalTip>): Promise<CulturalTip> {
    const [updated] = await db.update(culturalTipsTable)
      .set(data)
      .where(eq(culturalTipsTable.id, id))
      .returning();
    return updated;
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

  // ===== Class Types =====
  
  async createClassType(data: InsertClassType): Promise<ClassType> {
    const [classType] = await db.insert(classTypes).values(data).returning();
    return classType;
  }

  async getClassType(id: string): Promise<ClassType | undefined> {
    const result = await db.select().from(classTypes).where(eq(classTypes.id, id));
    return result[0];
  }

  async getClassTypeBySlug(slug: string): Promise<ClassType | undefined> {
    const result = await db.select().from(classTypes).where(eq(classTypes.slug, slug));
    return result[0];
  }

  async getAllClassTypes(): Promise<ClassType[]> {
    return await db.select().from(classTypes).orderBy(classTypes.displayOrder);
  }

  async getActiveClassTypes(): Promise<ClassType[]> {
    return await db.select().from(classTypes).where(eq(classTypes.isActive, true)).orderBy(classTypes.displayOrder);
  }

  async updateClassType(id: string, data: Partial<ClassType>): Promise<ClassType | undefined> {
    const [updated] = await db
      .update(classTypes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(classTypes.id, id))
      .returning();
    return updated;
  }

  async deleteClassType(id: string): Promise<boolean> {
    // First check if it's a preset type - those cannot be deleted
    const classType = await this.getClassType(id);
    if (!classType) return false;
    if (classType.isPreset) {
      throw new Error("Cannot delete preset class types");
    }
    const result = await db.delete(classTypes).where(eq(classTypes.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async seedClassTypes(): Promise<void> {
    const presetTypes = [
      {
        name: "ACTFL-Led Classes",
        slug: "actfl-led",
        description: "Structured courses following ACTFL World-Readiness Standards for Language Learning. Progress through Novice, Intermediate, Advanced, and Superior levels with comprehensive proficiency tracking.",
        icon: "Award",
        displayOrder: 1,
        isPreset: true,
        isActive: true,
      },
      {
        name: "Executive & Business",
        slug: "executive-business",
        description: "Professional language training designed for business contexts. Master workplace communication, negotiations, presentations, and industry-specific terminology.",
        icon: "Briefcase",
        displayOrder: 2,
        isPreset: true,
        isActive: true,
      },
      {
        name: "Quick Refresher",
        slug: "quick-refresher",
        description: "Fast-paced courses to brush up on language skills. Perfect for returning learners who need to reactivate dormant knowledge quickly.",
        icon: "Zap",
        displayOrder: 3,
        isPreset: true,
        isActive: true,
      },
      {
        name: "Travel & Culture",
        slug: "travel-culture",
        description: "Practical language skills for travelers. Learn essential phrases, cultural etiquette, and situational vocabulary for real-world adventures.",
        icon: "Plane",
        displayOrder: 4,
        isPreset: true,
        isActive: true,
      },
    ];

    for (const classType of presetTypes) {
      const existing = await this.getClassTypeBySlug(classType.slug);
      if (!existing) {
        await db.insert(classTypes).values(classType);
      }
    }
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

  async getAllActiveClasses(): Promise<TeacherClass[]> {
    return await db.select().from(teacherClasses).where(eq(teacherClasses.isActive, true));
  }

  async getFeaturedClasses(): Promise<Array<TeacherClass & { classType?: ClassType }>> {
    const result = await db
      .select({
        teacherClass: teacherClasses,
        classType: classTypes,
      })
      .from(teacherClasses)
      .leftJoin(classTypes, eq(teacherClasses.classTypeId, classTypes.id))
      .where(
        and(
          eq(teacherClasses.isFeatured, true),
          eq(teacherClasses.isActive, true),
          eq(teacherClasses.isPublicCatalogue, true)
        )
      )
      .orderBy(teacherClasses.featuredOrder);
    
    return result.map(r => ({
      ...r.teacherClass,
      classType: r.classType || undefined,
    }));
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
  
  // ===== Class Hour Packages (Institutional) =====
  
  async createClassHourPackage(data: InsertClassHourPackage): Promise<ClassHourPackage> {
    const [pkg] = await db.insert(classHourPackages).values(data).returning();
    return pkg;
  }
  
  async getClassHourPackage(id: string): Promise<ClassHourPackage | undefined> {
    const result = await db.select().from(classHourPackages).where(eq(classHourPackages.id, id));
    return result[0];
  }
  
  async getClassHourPackages(purchaserId?: string): Promise<ClassHourPackage[]> {
    if (purchaserId) {
      return await db.select().from(classHourPackages).where(eq(classHourPackages.purchaserId, purchaserId));
    }
    return await db.select().from(classHourPackages);
  }
  
  async updateClassHourPackage(id: string, data: Partial<ClassHourPackage>): Promise<ClassHourPackage | undefined> {
    const [updated] = await db
      .update(classHourPackages)
      .set(data)
      .where(eq(classHourPackages.id, id))
      .returning();
    return updated;
  }
  
  async deleteClassHourPackage(id: string): Promise<boolean> {
    const result = await db.delete(classHourPackages).where(eq(classHourPackages.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
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

  async updateClassEnrollment(enrollmentId: string, data: Partial<ClassEnrollment>): Promise<ClassEnrollment | undefined> {
    const [updated] = await db
      .update(classEnrollments)
      .set(data)
      .where(eq(classEnrollments.id, enrollmentId))
      .returning();
    return updated;
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

  async getCurriculumStats(): Promise<{ pathCount: number; unitCount: number; lessonCount: number; languageCount: number }> {
    const [pathResult] = await db.select({ count: sql<number>`count(*)::int` }).from(curriculumPaths);
    const [unitResult] = await db.select({ count: sql<number>`count(*)::int` }).from(curriculumUnits);
    const [lessonResult] = await db.select({ count: sql<number>`count(*)::int` }).from(curriculumLessons);
    const [languageResult] = await db.select({ count: sql<number>`count(distinct ${curriculumPaths.language})::int` }).from(curriculumPaths);
    
    return {
      pathCount: pathResult?.count || 0,
      unitCount: unitResult?.count || 0,
      lessonCount: lessonResult?.count || 0,
      languageCount: languageResult?.count || 0,
    };
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

  // ===== Class-Specific Curriculum (Teacher's Customizable Syllabi) =====

  async cloneCurriculumToClass(classId: string, curriculumPathId: string): Promise<{ units: ClassCurriculumUnit[]; lessons: ClassCurriculumLesson[] }> {
    // Get all units from the template
    const templateUnits = await this.getCurriculumUnits(curriculumPathId);
    const clonedUnits: ClassCurriculumUnit[] = [];
    const clonedLessons: ClassCurriculumLesson[] = [];

    for (const templateUnit of templateUnits) {
      // Clone the unit
      const [clonedUnit] = await db.insert(classCurriculumUnits).values({
        classId,
        sourceUnitId: templateUnit.id,
        name: templateUnit.name,
        description: templateUnit.description,
        orderIndex: templateUnit.orderIndex,
        actflLevel: templateUnit.actflLevel,
        culturalTheme: templateUnit.culturalTheme,
        estimatedHours: templateUnit.estimatedHours,
        isCustom: false,
        isRemoved: false,
      }).returning();
      clonedUnits.push(clonedUnit);

      // Get and clone all lessons for this unit
      const templateLessons = await this.getCurriculumLessons(templateUnit.id);
      for (const templateLesson of templateLessons) {
        const [clonedLesson] = await db.insert(classCurriculumLessons).values({
          classUnitId: clonedUnit.id,
          sourceLessonId: templateLesson.id,
          name: templateLesson.name,
          description: templateLesson.description,
          orderIndex: templateLesson.orderIndex,
          lessonType: templateLesson.lessonType,
          actflLevel: templateLesson.actflLevel,
          conversationTopic: templateLesson.conversationTopic,
          conversationPrompt: templateLesson.conversationPrompt,
          objectives: templateLesson.objectives,
          estimatedMinutes: templateLesson.estimatedMinutes,
          requiredTopics: templateLesson.requiredTopics,
          requiredVocabulary: templateLesson.requiredVocabulary,
          requiredGrammar: templateLesson.requiredGrammar,
          minPronunciationScore: templateLesson.minPronunciationScore,
          isCustom: false,
          isRemoved: false,
        }).returning();
        clonedLessons.push(clonedLesson);
      }
    }

    return { units: clonedUnits, lessons: clonedLessons };
  }

  async getClassCurriculumUnits(classId: string): Promise<ClassCurriculumUnit[]> {
    return await db
      .select()
      .from(classCurriculumUnits)
      .where(and(
        eq(classCurriculumUnits.classId, classId),
        eq(classCurriculumUnits.isRemoved, false)
      ))
      .orderBy(classCurriculumUnits.orderIndex);
  }

  async getClassCurriculumUnit(id: string): Promise<ClassCurriculumUnit | undefined> {
    const result = await db.select().from(classCurriculumUnits).where(eq(classCurriculumUnits.id, id));
    return result[0];
  }

  async createClassCurriculumUnit(data: InsertClassCurriculumUnit): Promise<ClassCurriculumUnit> {
    const [unit] = await db.insert(classCurriculumUnits).values(data).returning();
    return unit;
  }

  async updateClassCurriculumUnit(id: string, data: Partial<ClassCurriculumUnit>): Promise<ClassCurriculumUnit | undefined> {
    const [updated] = await db
      .update(classCurriculumUnits)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(classCurriculumUnits.id, id))
      .returning();
    return updated;
  }

  async deleteClassCurriculumUnit(id: string): Promise<boolean> {
    // Soft delete by marking as removed
    const [updated] = await db
      .update(classCurriculumUnits)
      .set({ isRemoved: true, updatedAt: new Date() })
      .where(eq(classCurriculumUnits.id, id))
      .returning();
    return !!updated;
  }

  async reorderClassCurriculumUnits(classId: string, unitIds: string[]): Promise<ClassCurriculumUnit[]> {
    const updated: ClassCurriculumUnit[] = [];
    for (let i = 0; i < unitIds.length; i++) {
      const [unit] = await db
        .update(classCurriculumUnits)
        .set({ orderIndex: i, updatedAt: new Date() })
        .where(and(
          eq(classCurriculumUnits.id, unitIds[i]),
          eq(classCurriculumUnits.classId, classId)
        ))
        .returning();
      if (unit) updated.push(unit);
    }
    return updated;
  }

  async getClassCurriculumLessons(classUnitId: string): Promise<ClassCurriculumLesson[]> {
    return await db
      .select()
      .from(classCurriculumLessons)
      .where(and(
        eq(classCurriculumLessons.classUnitId, classUnitId),
        eq(classCurriculumLessons.isRemoved, false)
      ))
      .orderBy(classCurriculumLessons.orderIndex);
  }

  async getClassCurriculumLessonsForUnits(classUnitIds: string[]): Promise<ClassCurriculumLesson[]> {
    if (classUnitIds.length === 0) return [];
    return await db
      .select()
      .from(classCurriculumLessons)
      .where(and(
        inArray(classCurriculumLessons.classUnitId, classUnitIds),
        eq(classCurriculumLessons.isRemoved, false)
      ))
      .orderBy(classCurriculumLessons.classUnitId, classCurriculumLessons.orderIndex);
  }

  async getClassCurriculumLesson(id: string): Promise<ClassCurriculumLesson | undefined> {
    const result = await db.select().from(classCurriculumLessons).where(eq(classCurriculumLessons.id, id));
    return result[0];
  }

  async createClassCurriculumLesson(data: InsertClassCurriculumLesson): Promise<ClassCurriculumLesson> {
    const [lesson] = await db.insert(classCurriculumLessons).values(data).returning();
    return lesson;
  }

  async updateClassCurriculumLesson(id: string, data: Partial<ClassCurriculumLesson>): Promise<ClassCurriculumLesson | undefined> {
    const [updated] = await db
      .update(classCurriculumLessons)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(classCurriculumLessons.id, id))
      .returning();
    return updated;
  }

  async deleteClassCurriculumLesson(id: string): Promise<boolean> {
    // Soft delete by marking as removed
    const [updated] = await db
      .update(classCurriculumLessons)
      .set({ isRemoved: true, updatedAt: new Date() })
      .where(eq(classCurriculumLessons.id, id))
      .returning();
    return !!updated;
  }

  async reorderClassCurriculumLessons(classUnitId: string, lessonIds: string[]): Promise<ClassCurriculumLesson[]> {
    const updated: ClassCurriculumLesson[] = [];
    for (let i = 0; i < lessonIds.length; i++) {
      const [lesson] = await db
        .update(classCurriculumLessons)
        .set({ orderIndex: i, updatedAt: new Date() })
        .where(and(
          eq(classCurriculumLessons.id, lessonIds[i]),
          eq(classCurriculumLessons.classUnitId, classUnitId)
        ))
        .returning();
      if (lesson) updated.push(lesson);
    }
    return updated;
  }

  async getClassSyllabus(classId: string): Promise<{ units: Array<ClassCurriculumUnit & { lessons: ClassCurriculumLesson[] }> }> {
    const units = await this.getClassCurriculumUnits(classId);
    const unitsWithLessons = await Promise.all(
      units.map(async (unit) => {
        const lessons = await this.getClassCurriculumLessons(unit.id);
        return { ...unit, lessons };
      })
    );
    return { units: unitsWithLessons };
  }

  // ===== Can-Do Statements =====
  
  async getCanDoStatementsByLanguage(language: string): Promise<CanDoStatement[]> {
    return await db
      .select()
      .from(canDoStatements)
      .where(eq(canDoStatements.language, language))
      .orderBy(canDoStatements.actflLevel, canDoStatements.category);
  }

  async getLessonCanDoStatements(lessonIds: string[]): Promise<LessonCanDoStatement[]> {
    if (lessonIds.length === 0) return [];
    return await db
      .select()
      .from(lessonCanDoStatements)
      .where(inArray(lessonCanDoStatements.lessonId, lessonIds));
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

  // ===== Syllabus Progress Methods =====

  async createSyllabusProgress(data: InsertSyllabusProgress): Promise<SyllabusProgress> {
    const [progress] = await db.insert(syllabusProgress).values(data).returning();
    return progress;
  }

  async getSyllabusProgress(studentId: string, classId: string): Promise<SyllabusProgress[]> {
    return await db
      .select()
      .from(syllabusProgress)
      .where(and(
        eq(syllabusProgress.studentId, studentId),
        eq(syllabusProgress.classId, classId)
      ))
      .orderBy(syllabusProgress.createdAt);
  }

  async getSyllabusProgressByLesson(studentId: string, classId: string, lessonId: string): Promise<SyllabusProgress | undefined> {
    const result = await db
      .select()
      .from(syllabusProgress)
      .where(and(
        eq(syllabusProgress.studentId, studentId),
        eq(syllabusProgress.classId, classId),
        eq(syllabusProgress.lessonId, lessonId)
      ))
      .limit(1);
    return result[0];
  }

  async updateSyllabusProgress(id: string, data: Partial<SyllabusProgress>): Promise<SyllabusProgress | undefined> {
    const [updated] = await db
      .update(syllabusProgress)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(syllabusProgress.id, id))
      .returning();
    return updated;
  }

  async getEarlyCompletions(classId: string): Promise<Array<SyllabusProgress & { student: User; lesson: CurriculumLesson }>> {
    const result = await db
      .select()
      .from(syllabusProgress)
      .leftJoin(users, eq(syllabusProgress.studentId, users.id))
      .leftJoin(curriculumLessons, eq(syllabusProgress.lessonId, curriculumLessons.id))
      .where(and(
        eq(syllabusProgress.classId, classId),
        eq(syllabusProgress.status, 'completed_early')
      ))
      .orderBy(desc(syllabusProgress.completedAt));
    
    return result.map(row => ({
      ...row.syllabus_progress,
      student: row.users!,
      lesson: row.curriculum_lessons!
    }));
  }

  async checkLessonCoverage(
    studentId: string, 
    classId: string, 
    lessonId: string, 
    coveredTopics: string[]
  ): Promise<{ covered: boolean; coveragePercent: number; missingTopics: string[] }> {
    // Get the lesson's required topics
    const lessonResult = await db
      .select()
      .from(curriculumLessons)
      .where(eq(curriculumLessons.id, lessonId))
      .limit(1);
    
    const lesson = lessonResult[0];
    if (!lesson || !lesson.requiredTopics || lesson.requiredTopics.length === 0) {
      return { covered: true, coveragePercent: 100, missingTopics: [] };
    }

    const requiredTopics = lesson.requiredTopics;
    const coveredSet = new Set(coveredTopics);
    const missingTopics = requiredTopics.filter(topic => !coveredSet.has(topic));
    const coveragePercent = Math.round(((requiredTopics.length - missingTopics.length) / requiredTopics.length) * 100);
    
    return {
      covered: missingTopics.length === 0,
      coveragePercent,
      missingTopics
    };
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

  async updateUserDetails(userId: string, data: { firstName?: string; lastName?: string; email?: string; isTestAccount?: boolean; isBetaTester?: boolean }): Promise<User | undefined> {
    const updateSet: Record<string, any> = { updatedAt: new Date() };
    
    if (data.firstName !== undefined) updateSet.firstName = data.firstName;
    if (data.lastName !== undefined) updateSet.lastName = data.lastName;
    if (data.email !== undefined) updateSet.email = data.email;
    if (data.isTestAccount !== undefined) updateSet.isTestAccount = data.isTestAccount;
    if (data.isBetaTester !== undefined) updateSet.isBetaTester = data.isBetaTester;
    
    const [updated] = await db
      .update(users)
      .set(updateSet)
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async grantCredits(userId: string, creditHours: number, description: string, expiresAt?: Date): Promise<void> {
    // Convert hours to seconds
    const creditSeconds = Math.round(creditHours * 3600);
    
    await db.insert(usageLedger).values({
      userId,
      creditSeconds,
      entitlementType: 'bonus',
      description: description || `Admin granted ${creditHours} hours`,
      expiresAt: expiresAt || null,
    });
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

  // Review Hub: Unified learning data aggregation
  async getReviewHubData(userId: string, language?: string, classId?: string, selfDirectedOnly?: boolean): Promise<{
    dueFlashcards: VocabularyWord[];
    recentConversations: Array<Conversation & { topics: Array<{ topic: Topic }> }>;
    culturalTips: CulturalTip[];
    activeLessons: UserLesson[];
    recentVocabulary: VocabularyWord[];
    topicsWithContent: Array<Topic & { conversationCount: number; vocabularyCount: number }>;
    nextLesson: {
      classId: string;
      className: string;
      lessonId: string;
      lessonName: string;
      lessonDescription: string | null;
      unitName: string;
      lessonType: string;
    } | null;
    upcomingAssignments: Array<{
      id: string;
      title: string;
      description: string | null;
      dueDate: Date | null;
      classId: string;
      className: string;
      lessonId: string | null;
      status: 'not_started' | 'in_progress' | 'submitted' | 'graded' | 'overdue';
    }>;
    syllabusOverview: {
      classId: string;
      className: string;
      curriculumName: string;
      totalLessons: number;
      completedLessons: number;
      units: Array<{
        id: string;
        name: string;
        orderIndex: number;
        lessons: Array<{
          id: string;
          name: string;
          orderIndex: number;
          lessonType: string;
          status: 'not_started' | 'in_progress' | 'completed';
          estimatedMinutes: number | null;
        }>;
      }>;
    } | null;
    stats: {
      totalConversations: number;
      totalVocabulary: number;
      dueCount: number;
      streakDays: number;
    };
  }> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Build class filter conditions
    const vocabClassFilter = classId 
      ? eq(vocabularyWords.classId, classId)
      : selfDirectedOnly 
        ? isNull(vocabularyWords.classId)
        : undefined;
    
    const convClassFilter = classId
      ? eq(conversations.classId, classId)
      : selfDirectedOnly
        ? isNull(conversations.classId)
        : undefined;
    
    // Build language filter conditions (undefined = all languages)
    const vocabLangFilter = language ? eq(vocabularyWords.language, language) : undefined;
    const convLangFilter = language ? eq(conversations.language, language) : undefined;
    
    // Helper to filter out undefined conditions for and()
    const buildAndConditions = (...conditions: (ReturnType<typeof eq> | ReturnType<typeof isNull> | ReturnType<typeof sql> | undefined)[]) => {
      const validConditions = conditions.filter((c): c is Exclude<typeof c, undefined> => c !== undefined);
      return validConditions.length > 0 ? and(...validConditions) : undefined;
    };

    // Get due flashcards (limit to 10 for daily review) - filtered by class and language
    const dueFlashcardsQuery = db
      .select()
      .from(vocabularyWords)
      .where(buildAndConditions(
        eq(vocabularyWords.userId, userId),
        vocabLangFilter,
        sql`${vocabularyWords.nextReviewDate} <= ${now}`,
        vocabClassFilter
      ))
      .orderBy(vocabularyWords.nextReviewDate)
      .limit(10);
    const dueFlashcards = await dueFlashcardsQuery;

    // Get recent conversations (last 7 days) with their topics - filtered by class and language
    const recentConvs = await db
      .select()
      .from(conversations)
      .where(buildAndConditions(
        eq(conversations.userId, userId),
        convLangFilter,
        gte(conversations.createdAt, weekAgo),
        convClassFilter
      ))
      .orderBy(desc(conversations.createdAt))
      .limit(10);

    // Fetch topics for each conversation
    const recentConversations: Array<Conversation & { topics: Array<{ topic: Topic }> }> = [];
    for (const conv of recentConvs) {
      const topicsResult = await this.getConversationTopics(conv.id);
      recentConversations.push({
        ...conv,
        topics: topicsResult.map(t => ({ topic: t.topic }))
      });
    }

    // Get cultural tips based on recent conversation topics (dynamic)
    // First, collect topic slugs from recent conversations (convert name to slug format)
    const nameToSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const recentTopicSlugs = new Set<string>();
    for (const conv of recentConversations) {
      for (const t of conv.topics) {
        if (t.topic.name) {
          recentTopicSlugs.add(nameToSlug(t.topic.name));
        }
      }
    }

    // Get all tips for this language (or aggregate from all user's languages)
    let allTips: CulturalTip[] = [];
    if (language) {
      allTips = await this.getCulturalTips(language);
    } else {
      // Aggregate tips from all languages the user has content in
      const userLanguages = await this.getUserLanguages(userId);
      for (const lang of userLanguages) {
        const langTips = await this.getCulturalTips(lang);
        allTips.push(...langTips);
      }
    }
    
    // Filter tips that match recent conversation topics
    let relevantTips = allTips.filter(tip => {
      if (!tip.relatedTopics || tip.relatedTopics.length === 0) return false;
      return tip.relatedTopics.some(topicSlug => recentTopicSlugs.has(topicSlug));
    });

    // If not enough topic-based tips, fill with random tips
    if (relevantTips.length < 3) {
      const remainingTips = allTips.filter(tip => !relevantTips.includes(tip));
      const shuffledRemaining = remainingTips.sort(() => Math.random() - 0.5);
      relevantTips = [...relevantTips, ...shuffledRemaining.slice(0, 3 - relevantTips.length)];
    } else {
      // Shuffle and pick 3 from relevant tips
      relevantTips = relevantTips.sort(() => Math.random() - 0.5).slice(0, 3);
    }

    const culturalTips = relevantTips;

    // Get active lessons (language-filtered if specified, or aggregate from all)
    let activeLessons: UserLesson[] = [];
    if (language) {
      activeLessons = await this.getUserLessons(userId, language);
    } else {
      const userLanguages = await this.getUserLanguages(userId);
      for (const lang of userLanguages) {
        const langLessons = await this.getUserLessons(userId, lang);
        activeLessons.push(...langLessons);
      }
    }

    // Get recently learned vocabulary (words with few repetitions = newly learned) - filtered by class and language
    const recentVocabulary = await db
      .select()
      .from(vocabularyWords)
      .where(buildAndConditions(
        eq(vocabularyWords.userId, userId),
        vocabLangFilter,
        sql`${vocabularyWords.repetition} < 3`, // Words with fewer than 3 repetitions are "new"
        vocabClassFilter
      ))
      .orderBy(desc(vocabularyWords.nextReviewDate))
      .limit(20);

    // Get topics with content counts
    const allTopics = await this.getTopics();
    const topicsWithContent: Array<Topic & { conversationCount: number; vocabularyCount: number }> = [];

    for (const topic of allTopics) {
      // Count conversations with this topic for this user - filtered by class and language
      const convTopicsQuery = db
        .select({ conversationId: conversationTopics.conversationId })
        .from(conversationTopics)
        .innerJoin(conversations, eq(conversationTopics.conversationId, conversations.id))
        .where(buildAndConditions(
          eq(conversationTopics.topicId, topic.id),
          eq(conversations.userId, userId),
          convLangFilter,
          convClassFilter
        ));
      const convTopics = await convTopicsQuery;

      // Count vocabulary with this topic for this user - filtered by class and language
      const vocabTopicsQuery = db
        .select({ vocabularyWordId: vocabularyWordTopics.vocabularyWordId })
        .from(vocabularyWordTopics)
        .innerJoin(vocabularyWords, eq(vocabularyWordTopics.vocabularyWordId, vocabularyWords.id))
        .where(buildAndConditions(
          eq(vocabularyWordTopics.topicId, topic.id),
          eq(vocabularyWords.userId, userId),
          vocabLangFilter,
          vocabClassFilter
        ));
      const vocabTopics = await vocabTopicsQuery;

      if (convTopics.length > 0 || vocabTopics.length > 0) {
        topicsWithContent.push({
          ...topic,
          conversationCount: convTopics.length,
          vocabularyCount: vocabTopics.length
        });
      }
    }

    // Sort by total content count
    topicsWithContent.sort((a, b) => 
      (b.conversationCount + b.vocabularyCount) - (a.conversationCount + a.vocabularyCount)
    );

    // Get total stats - filtered by class and language
    const totalConvsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(conversations)
      .where(buildAndConditions(
        eq(conversations.userId, userId),
        convLangFilter,
        convClassFilter
      ));

    const totalVocabResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(vocabularyWords)
      .where(buildAndConditions(
        eq(vocabularyWords.userId, userId),
        vocabLangFilter,
        vocabClassFilter
      ));

    const dueCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(vocabularyWords)
      .where(buildAndConditions(
        eq(vocabularyWords.userId, userId),
        vocabLangFilter,
        sql`${vocabularyWords.nextReviewDate} <= ${now}`,
        vocabClassFilter
      ));

    // Calculate streak (simplified - just check consecutive days with activity)
    // When "all languages" is selected, use the first language user has progress in
    let streakDays = 0;
    if (language) {
      const progress = await this.getOrCreateUserProgress(language, userId);
      streakDays = progress.currentStreak || 0;
    }

    // Find next lesson for enrolled students in this language
    let nextLesson: {
      classId: string;
      className: string;
      lessonId: string;
      lessonName: string;
      lessonDescription: string | null;
      unitName: string;
      lessonType: string;
    } | null = null;

    try {
      const enrollments = await this.getStudentEnrollments(userId);
      const activeEnrollments = enrollments.filter(e => 
        e.isActive && (!language || e.class?.language === language)
      );

      for (const enrollment of activeEnrollments) {
        const teacherClass = enrollment.class;
        if (!teacherClass?.curriculumPathId) continue;

        const curriculumPath = await this.getCurriculumPath(teacherClass.curriculumPathId);
        if (!curriculumPath) continue;

        const units = await this.getCurriculumUnits(curriculumPath.id);
        const syllabusProgress = await this.getSyllabusProgress(userId, teacherClass.id);
        
        const completedLessons = new Set(
          syllabusProgress
            .filter(p => p.status === 'completed_early' || p.status === 'completed_assigned' || p.tutorVerified)
            .map(p => p.lessonId)
        );

        // Find first incomplete lesson
        for (const unit of units) {
          const lessons = await this.getCurriculumLessons(unit.id);
          for (const lesson of lessons) {
            if (!completedLessons.has(lesson.id)) {
              nextLesson = {
                classId: teacherClass.id,
                className: teacherClass.name,
                lessonId: lesson.id,
                lessonName: lesson.name,
                lessonDescription: lesson.description,
                unitName: unit.name,
                lessonType: lesson.lessonType || 'conversation'
              };
              break;
            }
          }
          if (nextLesson) break;
        }
        if (nextLesson) break; // Use first class with incomplete lessons
      }
    } catch (error) {
      console.error('[ReviewHub] Error finding next lesson:', error);
    }

    // Fetch upcoming assignments for enrolled students
    type AssignmentWithStatus = {
      id: string;
      title: string;
      description: string | null;
      dueDate: Date | null;
      classId: string;
      className: string;
      lessonId: string | null;
      status: 'not_started' | 'in_progress' | 'submitted' | 'graded' | 'overdue';
    };
    const upcomingAssignments: AssignmentWithStatus[] = [];
    
    try {
      const enrollments = await this.getStudentEnrollments(userId);
      const activeEnrollments = enrollments.filter(e => 
        e.isActive && (!language || e.class?.language === language) && 
        (!classId || e.classId === classId)
      );
      
      for (const enrollment of activeEnrollments) {
        const teacherClass = enrollment.class;
        if (!teacherClass) continue;
        
        // Get assignments for this class
        const classAssignments = await this.getClassAssignments(teacherClass.id);
        
        for (const assignment of classAssignments) {
          // Get submission status for this student
          const submission = await this.getAssignmentSubmission(assignment.id, userId);
          
          let status: AssignmentWithStatus['status'] = 'not_started';
          if (submission) {
            if (submission.teacherScore !== null) {
              status = 'graded';
            } else if (submission.submittedAt) {
              status = 'submitted';
            } else {
              status = 'in_progress';
            }
          } else if (assignment.dueDate && new Date(assignment.dueDate) < now) {
            status = 'overdue';
          }
          
          // Only show non-graded assignments (upcoming or in progress)
          if (status !== 'graded') {
            upcomingAssignments.push({
              id: assignment.id,
              title: assignment.title,
              description: assignment.description,
              dueDate: assignment.dueDate,
              classId: teacherClass.id,
              className: teacherClass.name,
              lessonId: assignment.curriculumLessonId ?? null,
              status
            });
          }
        }
      }
      
      // Sort by urgency: overdue first, then by due date (soonest first), null dates last
      upcomingAssignments.sort((a, b) => {
        // Overdue items come first
        if (a.status === 'overdue' && b.status !== 'overdue') return -1;
        if (a.status !== 'overdue' && b.status === 'overdue') return 1;
        
        // Then sort by due date
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    } catch (error) {
      console.error('[ReviewHub] Error fetching assignments:', error);
    }

    // Build syllabus overview for enrolled class context
    type SyllabusOverview = {
      classId: string;
      className: string;
      curriculumName: string;
      totalLessons: number;
      completedLessons: number;
      units: Array<{
        id: string;
        name: string;
        orderIndex: number;
        lessons: Array<{
          id: string;
          name: string;
          orderIndex: number;
          lessonType: string;
          status: 'not_started' | 'in_progress' | 'completed';
          estimatedMinutes: number | null;
        }>;
      }>;
    };
    let syllabusOverview: SyllabusOverview | null = null;

    try {
      // Only build syllabus when viewing a specific class
      if (classId) {
        const teacherClass = await this.getTeacherClass(classId);
        if (teacherClass?.curriculumPathId) {
          const curriculumPath = await this.getCurriculumPath(teacherClass.curriculumPathId);
          if (curriculumPath) {
            const units = await this.getCurriculumUnits(curriculumPath.id);
            const syllabusProgress = await this.getSyllabusProgress(userId, classId);
            
            // Build a map of lesson progress
            const progressMap = new Map<string, 'not_started' | 'in_progress' | 'completed'>();
            for (const p of syllabusProgress) {
              if (p.status === 'completed_early' || p.status === 'completed_assigned' || p.tutorVerified) {
                progressMap.set(p.lessonId, 'completed');
              } else if (p.status === 'in_progress') {
                progressMap.set(p.lessonId, 'in_progress');
              }
            }

            let totalLessons = 0;
            let completedLessons = 0;
            const unitsWithLessons: SyllabusOverview['units'] = [];

            for (const unit of units) {
              const lessons = await this.getCurriculumLessons(unit.id);
              const lessonsWithStatus = lessons.map(lesson => {
                const status = progressMap.get(lesson.id) || 'not_started';
                totalLessons++;
                if (status === 'completed') completedLessons++;
                return {
                  id: lesson.id,
                  name: lesson.name,
                  orderIndex: lesson.orderIndex,
                  lessonType: lesson.lessonType,
                  status,
                  estimatedMinutes: lesson.estimatedMinutes
                };
              });

              unitsWithLessons.push({
                id: unit.id,
                name: unit.name,
                orderIndex: unit.orderIndex,
                lessons: lessonsWithStatus
              });
            }

            syllabusOverview = {
              classId: teacherClass.id,
              className: teacherClass.name,
              curriculumName: curriculumPath.name,
              totalLessons,
              completedLessons,
              units: unitsWithLessons
            };
          }
        }
      }
    } catch (error) {
      console.error('[ReviewHub] Error building syllabus overview:', error);
    }

    return {
      dueFlashcards,
      recentConversations,
      culturalTips,
      activeLessons,
      recentVocabulary,
      topicsWithContent,
      nextLesson,
      upcomingAssignments,
      syllabusOverview,
      stats: {
        totalConversations: Number(totalConvsResult[0]?.count || 0),
        totalVocabulary: Number(totalVocabResult[0]?.count || 0),
        dueCount: Number(dueCountResult[0]?.count || 0),
        streakDays
      }
    };
  }

  // ===== Tutor Voice Management =====

  async getTutorVoice(language: string, gender: 'male' | 'female'): Promise<TutorVoice | undefined> {
    const result = await db.select().from(tutorVoices).where(
      and(
        eq(tutorVoices.language, language),
        eq(tutorVoices.gender, gender),
        eq(tutorVoices.isActive, true)
      )
    ).limit(1);
    return result[0];
  }

  async getAllTutorVoices(): Promise<TutorVoice[]> {
    return db.select().from(tutorVoices).orderBy(tutorVoices.language, tutorVoices.gender);
  }

  async upsertTutorVoice(data: InsertTutorVoice): Promise<TutorVoice> {
    // Check if voice already exists for this language and gender
    const existing = await db.select().from(tutorVoices).where(
      and(
        eq(tutorVoices.language, data.language),
        eq(tutorVoices.gender, data.gender)
      )
    ).limit(1);

    if (existing[0]) {
      // Update existing
      const updated = await db.update(tutorVoices)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(tutorVoices.id, existing[0].id))
        .returning();
      return updated[0];
    } else {
      // Create new
      const created = await db.insert(tutorVoices).values(data).returning();
      return created[0];
    }
  }

  async deleteTutorVoice(id: string): Promise<boolean> {
    const result = await db.delete(tutorVoices).where(eq(tutorVoices.id, id)).returning();
    return result.length > 0;
  }

  async seedDefaultTutorVoices(): Promise<void> {
    // Check if voices already exist
    const existing = await db.select().from(tutorVoices).limit(1);
    if (existing.length > 0) {
      console.log('[Voice Seed] Voices already exist, skipping seed');
      return;
    }

    console.log('[Voice Seed] Seeding default tutor voices...');

    // Default voices from Cartesia - includes both male and female for each language
    const defaultVoices: InsertTutorVoice[] = [
      // English
      { language: 'english', gender: 'female', provider: 'cartesia', voiceId: '573e3144-a684-4e72-ac2b-9b2063a50b53', voiceName: 'Teacher Lady', languageCode: 'en' },
      { language: 'english', gender: 'male', provider: 'cartesia', voiceId: '638efaaa-4d0c-442e-b701-3fae16aad012', voiceName: 'Friendly Australian Man', languageCode: 'en' },
      // Spanish
      { language: 'spanish', gender: 'female', provider: 'cartesia', voiceId: '5c5ad5e7-1020-476b-8b91-fdcbe9cc313c', voiceName: 'Mexican Woman', languageCode: 'es' },
      { language: 'spanish', gender: 'male', provider: 'cartesia', voiceId: 'ee7ea9f8-c0c1-498c-9f64-1571fc4b6a32', voiceName: 'Spanish Male Narrator', languageCode: 'es' },
      // French
      { language: 'french', gender: 'female', provider: 'cartesia', voiceId: 'a249eaff-1e96-4d2c-b23b-12efa4f66f41', voiceName: 'French Conversational Lady', languageCode: 'fr' },
      { language: 'french', gender: 'male', provider: 'cartesia', voiceId: 'ab7c61f5-3daa-47dd-a23b-4ac0aac5f5c3', voiceName: 'French Narrator Man', languageCode: 'fr' },
      // German
      { language: 'german', gender: 'female', provider: 'cartesia', voiceId: '3f4ade23-6eb4-4279-ab05-6a144947c4d5', voiceName: 'German Conversational Woman', languageCode: 'de' },
      { language: 'german', gender: 'male', provider: 'cartesia', voiceId: 'fb26447f-308b-471e-8b00-8c6697283ca1', voiceName: 'German Narrator Man', languageCode: 'de' },
      // Italian
      { language: 'italian', gender: 'female', provider: 'cartesia', voiceId: '0e21713a-5e9a-428a-bed4-90d410b87f13', voiceName: 'Italian Narrator Woman', languageCode: 'it' },
      { language: 'italian', gender: 'male', provider: 'cartesia', voiceId: 'b9de4a89-2257-424b-94c2-db18ba68c81a', voiceName: 'Italian Male', languageCode: 'it' },
      // Portuguese
      { language: 'portuguese', gender: 'female', provider: 'cartesia', voiceId: '700d1ee3-a641-4018-ba6e-899dcadc9e2b', voiceName: 'Pleasant Brazilian Lady', languageCode: 'pt' },
      { language: 'portuguese', gender: 'male', provider: 'cartesia', voiceId: 'a3520a8f-226a-428d-9fcd-b0a4711a6829', voiceName: 'Brazilian Male', languageCode: 'pt' },
      // Japanese
      { language: 'japanese', gender: 'female', provider: 'cartesia', voiceId: '2b568345-1d48-4047-b25f-7baccf842eb0', voiceName: 'Japanese Woman Conversational', languageCode: 'ja' },
      { language: 'japanese', gender: 'male', provider: 'cartesia', voiceId: '8f091740-3df1-4795-8bd9-dc62d88e5131', voiceName: 'Japanese Male Calm', languageCode: 'ja' },
      // Mandarin Chinese
      { language: 'mandarin chinese', gender: 'female', provider: 'cartesia', voiceId: 'b991c420-1ad1-401b-bee0-34a16f76aa71', voiceName: 'Chinese Woman Narrator', languageCode: 'zh' },
      { language: 'mandarin chinese', gender: 'male', provider: 'cartesia', voiceId: '5619d38c-cf51-4d8e-9575-48f61a280413', voiceName: 'Chinese Commercial Man', languageCode: 'zh' },
      // Korean
      { language: 'korean', gender: 'female', provider: 'cartesia', voiceId: 'b5d7b5e0-c94d-47f8-8df5-b124cf8c8b8c', voiceName: 'Korean Woman', languageCode: 'ko' },
      { language: 'korean', gender: 'male', provider: 'cartesia', voiceId: '63ff761f-c1e8-414b-b969-d1833d1c870c', voiceName: 'Korean Male', languageCode: 'ko' },
    ];

    for (const voice of defaultVoices) {
      await db.insert(tutorVoices).values(voice);
    }

    console.log(`[Voice Seed] ✓ Seeded ${defaultVoices.length} default tutor voices`);
  }

  // ===== Admin: Reset User Learning Data =====
  async resetUserLearningData(userId: string, options?: {
    resetVocabulary?: boolean;
    resetConversations?: boolean;
    resetProgress?: boolean;
    resetLessons?: boolean;
  }): Promise<{ 
    vocabularyDeleted: number;
    conversationsDeleted: number;
    progressReset: boolean;
    lessonsDeleted: number;
  }> {
    const opts = {
      resetVocabulary: true,
      resetConversations: true,
      resetProgress: true,
      resetLessons: true,
      ...options
    };

    let vocabularyDeleted = 0;
    let conversationsDeleted = 0;
    let progressReset = false;
    let lessonsDeleted = 0;

    // Delete vocabulary words and their topic associations
    if (opts.resetVocabulary) {
      // First delete vocabulary word topics
      const userVocab = await db.select({ id: vocabularyWords.id })
        .from(vocabularyWords)
        .where(eq(vocabularyWords.userId, userId));
      
      for (const word of userVocab) {
        await db.delete(vocabularyWordTopics).where(eq(vocabularyWordTopics.vocabularyWordId, word.id));
      }
      
      // Then delete vocabulary words
      const vocabResult = await db.delete(vocabularyWords)
        .where(eq(vocabularyWords.userId, userId))
        .returning();
      vocabularyDeleted = vocabResult.length;
    }

    // Delete conversations and their associated data
    if (opts.resetConversations) {
      // Get all user conversations
      const userConvs = await db.select({ id: conversations.id })
        .from(conversations)
        .where(eq(conversations.userId, userId));
      
      for (const conv of userConvs) {
        // Delete messages
        await db.delete(messages).where(eq(messages.conversationId, conv.id));
        // Delete conversation topics
        await db.delete(conversationTopics).where(eq(conversationTopics.conversationId, conv.id));
      }
      
      // Delete conversations
      const convResult = await db.delete(conversations)
        .where(eq(conversations.userId, userId))
        .returning();
      conversationsDeleted = convResult.length;
    }

    // Reset user progress
    if (opts.resetProgress) {
      await db.delete(userProgressTable).where(eq(userProgressTable.userId, userId));
      await db.delete(actflProgressTable).where(eq(actflProgressTable.userId, userId));
      progressReset = true;
    }

    // Delete user lessons and their items
    if (opts.resetLessons) {
      const lessonsToDelete = await db.select({ id: userLessons.id })
        .from(userLessons)
        .where(eq(userLessons.userId, userId));
      
      for (const lesson of lessonsToDelete) {
        await db.delete(userLessonItems).where(eq(userLessonItems.lessonId, lesson.id));
      }
      
      const lessonResult = await db.delete(userLessons)
        .where(eq(userLessons.userId, userId))
        .returning();
      lessonsDeleted = lessonResult.length;
    }

    console.log(`[Admin] Reset learning data for user ${userId}: ${vocabularyDeleted} vocab, ${conversationsDeleted} convs, progress=${progressReset}, ${lessonsDeleted} lessons`);

    return {
      vocabularyDeleted,
      conversationsDeleted,
      progressReset,
      lessonsDeleted
    };
  }
}

export const storage = new DatabaseStorage();
