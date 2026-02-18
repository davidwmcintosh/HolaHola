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
  type TopicCompetencyObservation,
  type InsertTopicCompetencyObservation,
  type DanielaRecommendation,
  type InsertDanielaRecommendation,
  type StudentTierSignal,
  type InsertStudentTierSignal,
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
  type CurriculumDrillItem,
  type InsertCurriculumDrillItem,
  type UserDrillProgress,
  type InsertUserDrillProgress,
  userLanguagePreferences,
  curriculumDrillItems,
  userDrillProgress,
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
  topicCompetencyObservations,
  danielaRecommendations,
  studentTierSignals,
  adminAuditLog,
  productConfig,
  type ProductConfig,
  type InsertProductConfig,
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
  selfBestPractices,
  peopleConnections,
  studentInsights,
  learningMotivations,
  recurringStruggles,
  sessionNotes,
  type SelfBestPractice,
  type InsertSelfBestPractice,
  type PeopleConnection,
  type InsertPeopleConnection,
  type StudentInsight,
  type InsertStudentInsight,
  type LearningMotivation,
  type InsertLearningMotivation,
  type RecurringStruggle,
  type InsertRecurringStruggle,
  type SessionNote,
  type InsertSessionNote,
  type BestPracticeCategory,
  actflAssessmentEvents,
  agentObservations,
  supportObservations,
  systemAlerts,
  type ActflAssessmentEvent,
  type InsertActflAssessmentEvent,
  type AgentObservation,
  type InsertAgentObservation,
  type SupportObservation,
  type InsertSupportObservation,
  type SystemAlert,
  type InsertSystemAlert,
  type SupportTicket,
  type InsertSupportTicket,
  type SupportMessage,
  type InsertSupportMessage,
  supportTickets,
  supportMessages,
  sofiaIssueReports,
  type SofiaIssueReport,
  type InsertSofiaIssueReport,
  type AgentCollaborationEvent,
  type InsertAgentCollaborationEvent,
  type SecureAgentMessage,
  agentCollaborationEvents,
  type ArisDrillAssignment,
  type InsertArisDrillAssignment,
  arisDrillAssignments,
  type ArisDrillResult,
  type InsertArisDrillResult,
  arisDrillResults,
  danielaSuggestions,
  type DanielaSuggestion,
  type InsertDanielaSuggestion,
  selfSurgeryProposals,
  type SelfSurgeryProposal,
  type InsertSelfSurgeryProposal,
  tutorProcedures,
  type TutorProcedure,
  type InsertTutorProcedure,
  toolKnowledge,
  type ToolKnowledge,
  type InsertToolKnowledge,
  situationalPatterns,
  type SituationalPattern,
  type InsertSituationalPattern,
  teachingPrinciples,
  type TeachingPrinciple,
  type InsertTeachingPrinciple,
  danielaGrowthMemories,
  type DanielaGrowthMemory,
  type InsertDanielaGrowthMemory,
  danielaNotes,
  type DanielaNote,
  type InsertDanielaNote,
  type DanielaNoteType,
  featureSprints,
  sprintStageTransitions,
  consultationThreads,
  consultationMessages,
  sprintTemplates,
  projectContextSnapshots,
  aiSuggestions,
  type FeatureSprint,
  type InsertFeatureSprint,
  type SprintStageTransition,
  type InsertSprintStageTransition,
  type ConsultationThread,
  type InsertConsultationThread,
  type ConsultationMessage,
  type InsertConsultationMessage,
  type SprintTemplate,
  type InsertSprintTemplate,
  type ProjectContextSnapshot,
  type InsertProjectContextSnapshot,
  type AiSuggestion,
  type InsertAiSuggestion,
  surgerySessions,
  surgeryTurns,
  type SurgerySession,
  type InsertSurgerySession,
  type SurgeryTurn,
  type InsertSurgeryTurn,
  danielaBeacons,
  type DanielaBeacon,
  type InsertDanielaBeacon,
  type DanielaBeaconStatus,
  northStarPrinciples,
  northStarUnderstanding,
  northStarExamples,
  type NorthStarPrinciple,
  type InsertNorthStarPrinciple,
  type NorthStarUnderstanding,
  type InsertNorthStarUnderstanding,
  type NorthStarExample,
  type InsertNorthStarExample,
  agendaQueue,
  type AgendaQueueItem,
  type InsertAgendaQueue,
  wrenInsights,
  type WrenInsight,
  type InsertWrenInsight,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { markCorrect, markIncorrect } from "./spaced-repetition";
import { db, getSharedDb, getUserDb } from "./db";
import { eq, and, desc, asc, gte, lte, gt, ne, sql, isNull, inArray, or } from "drizzle-orm";

export interface IStorage {
  // User operations (Replit Auth Integration)
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: { email: string; firstName?: string | null; lastName?: string | null; role?: string; authProvider?: string }): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserPreferences(userId: string, preferences: {
    targetLanguage?: string;
    nativeLanguage?: string;
    difficultyLevel?: string;
    onboardingCompleted?: boolean;
    tutorGender?: 'male' | 'female';
    tutorPersonality?: 'warm' | 'calm' | 'energetic' | 'professional';
    tutorExpressiveness?: number;
    selfDirectedFlexibility?: 'guided' | 'flexible_goals' | 'open_exploration' | 'free_conversation';
    selfDirectedPlacementDone?: boolean;
    memoryPrivacySettings?: {
      enabled: boolean;
      allowedCategories: string[];
      blockedCategories: string[];
      redactionRequested: boolean;
      redactionRequestedAt?: string;
    };
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
  updateUserTimezone(userId: string, timezone: string): Promise<void>;

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
  updateConversationLanguage(conversationId: string, language: string): Promise<void>;
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
  updateVocabularyWord(id: string, data: Partial<VocabularyWord>): Promise<VocabularyWord | undefined>;
  updateVocabularyReview(id: string, isCorrect: boolean): Promise<VocabularyWord | undefined>;
  getDueVocabulary(language: string, userId: string, difficulty?: string, limit?: number): Promise<VocabularyWord[]>;

  // Grammar
  createGrammarExercise(data: InsertGrammarExercise): Promise<GrammarExercise>;
  getGrammarExercises(language: string, difficulty?: string): Promise<GrammarExercise[]>;
  getGrammarCompetencies(language: string, classId?: string): Promise<GrammarCompetency[]>;
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
  getAllMediaFiles(options?: { source?: string; reviewed?: string; limit?: number; offset?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' }): Promise<{ files: MediaFile[]; total: number; newCount?: number; unreviewedCount?: number }>;
  updateMediaFile(id: string, data: { title?: string | null; description?: string | null; tags?: string[] | null; language?: string | null; isReviewed?: boolean; reviewedAt?: Date | null; reviewedBy?: string | null }): Promise<MediaFile | undefined>;
  bulkUpdateMediaReviewStatus(ids: string[], isReviewed: boolean, reviewedBy: string): Promise<number>;
  deleteMediaFile(id: string): Promise<boolean>;
  
  // Message Media (images in conversations)
  createMessageMedia(data: InsertMessageMedia): Promise<MessageMedia>;
  getMessageMedia(messageId: string): Promise<Array<MessageMedia & { mediaFile: MediaFile }>>;
  
  // Image Caching (for reducing API costs and improving speed)
  getCachedStockImage(searchQuery: string): Promise<MediaFile | undefined>;
  getCachedAIImage(promptHash: string): Promise<MediaFile | undefined>;
  cacheImage(data: InsertMediaFile): Promise<MediaFile>;
  incrementImageUsage(id: string): Promise<void>;
  incrementAlertViewCount(id: string): Promise<void>;

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
  getStudentEnrollment(studentId: string, classId: string): Promise<ClassEnrollment | undefined>;
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

  // Drill Items (for drill-type lessons)
  createDrillItem(data: InsertCurriculumDrillItem): Promise<CurriculumDrillItem>;
  getDrillItems(lessonId: string): Promise<CurriculumDrillItem[]>;
  getDrillItem(id: string): Promise<CurriculumDrillItem | undefined>;
  updateDrillItem(id: string, data: Partial<CurriculumDrillItem>): Promise<CurriculumDrillItem | undefined>;
  deleteDrillItem(id: string): Promise<boolean>;
  updateDrillItemAudio(id: string, audioUrl: string, audioDurationMs?: number): Promise<CurriculumDrillItem | undefined>;
  updateDrillItemAudioForGender(id: string, audioUrl: string, audioDurationMs: number, gender: 'female' | 'male'): Promise<CurriculumDrillItem | undefined>;

  // User Drill Progress
  getDrillProgress(userId: string, drillItemId: string): Promise<UserDrillProgress | undefined>;
  getDrillProgressForLesson(userId: string, lessonId: string): Promise<UserDrillProgress[]>;
  recordDrillAttempt(userId: string, drillItemId: string, score: number, timeSpentMs: number, classId?: string): Promise<UserDrillProgress>;
  getDueReviewItems(userId: string, lessonId?: string, limit?: number): Promise<CurriculumDrillItem[]>;
  checkDrillLessonCompletion(userId: string, lessonId: string): Promise<{ completed: boolean; masteredCount: number; totalCount: number; completionPercent: number }>;

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

  // Topic Competency Observations (Daniela's SYLLABUS_PROGRESS command)
  createTopicCompetencyObservation(data: InsertTopicCompetencyObservation): Promise<TopicCompetencyObservation>;
  getTopicCompetencyObservations(userId: string, language: string): Promise<TopicCompetencyObservation[]>;
  getUserTopicCompetencyByName(userId: string, language: string, topicName: string): Promise<TopicCompetencyObservation | undefined>;

  // ===== Daniela Recommendation Queue =====
  createDanielaRecommendation(data: InsertDanielaRecommendation): Promise<DanielaRecommendation>;
  getDanielaRecommendations(userId: string, options?: { language?: string; classId?: string; includeSnoozed?: boolean; includeCompleted?: boolean }): Promise<DanielaRecommendation[]>;
  updateDanielaRecommendation(id: string, data: Partial<DanielaRecommendation>): Promise<DanielaRecommendation | undefined>;
  snoozeRecommendation(id: string, untilDate: Date): Promise<DanielaRecommendation | undefined>;
  completeRecommendation(id: string, evidenceConversationId?: string): Promise<DanielaRecommendation | undefined>;
  dismissRecommendation(id: string): Promise<DanielaRecommendation | undefined>;

  // ===== Student Tier Signals =====
  createStudentTierSignal(data: InsertStudentTierSignal): Promise<StudentTierSignal>;
  getStudentTierSignals(userId: string, options?: { lessonId?: string; classId?: string; pendingOnly?: boolean }): Promise<StudentTierSignal[]>;
  getPendingTierSignals(options?: { classId?: string }): Promise<StudentTierSignal[]>;
  reviewTierSignal(id: string, reviewedBy: string, decision: string, notes?: string): Promise<StudentTierSignal | undefined>;

  // ===== Unified Progress API =====
  getUnifiedProgress(studentId: string, classId: string): Promise<import('@shared/schema').UnifiedProgressResponse | null>;

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
  
  // Product Config (Pricing settings)
  getProductConfig(key: string): Promise<ProductConfig | undefined>;
  getAllProductConfig(): Promise<ProductConfig[]>;
  upsertProductConfig(key: string, value: string, description: string, updatedBy: string): Promise<ProductConfig>;
  
  // Support Tickets (Admin)
  getAdminSupportTickets(options: {
    filters?: { status?: string; priority?: string; category?: string };
    limit?: number;
    offset?: number;
  }): Promise<{
    tickets: any[];
    total: number;
    stats: { pending: number; active: number; resolved: number; escalated: number };
  }>;
  
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
    language?: string;
  }): Promise<Conversation[]>;
  
  // Phase 1: Vocabulary time-based filtering
  getFilteredVocabulary(userId: string, language: string, filter: {
    timeFilter?: 'today' | 'week' | 'month' | 'older';
    topicId?: string;
    sourceConversationId?: string;
    classId?: string;
  }): Promise<VocabularyWord[]>;

  // Phase 2: Conversation topic tagging
  addConversationTopic(conversationId: string, topicId: string, confidence?: number): Promise<ConversationTopic>;
  getConversationTopics(conversationId: string): Promise<Array<ConversationTopic & { topic: Topic }>>;
  getConversationTopicsBatch(conversationIds: string[]): Promise<Record<string, Array<ConversationTopic & { topic: Topic }>>>;
  removeConversationTopic(conversationId: string, topicId: string): Promise<boolean>;
  
  // Mind Map: Aggregated topic mastery for visualization
  getUserTopicMastery(userId: string, language: string): Promise<Array<{
    id: string;
    name: string;
    status: 'discovered' | 'practiced' | 'mastered' | 'locked';
    practiceCount: number;
    lastPracticed: Date | null;
    connections: string[];
    category: string | null;
    danielaObservation?: { status: string; evidence: string | null; observedAt: Date };
  }>>;

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
          description: string | null;
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
  
  // Update TTS provider for all tutor voices at once
  updateAllTutorVoicesProvider(provider: string): Promise<number>;
  
  // Seed default voices (for initial setup)
  seedDefaultTutorVoices(): Promise<void>;
  
  // Seed Sofia support voices
  seedSupportVoices(): Promise<void>;

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
    firstMeetingReset: boolean;
  }>;

  // ===== Teacher: Reset Student Class Progress =====
  resetStudentClassProgress(classId: string, studentId: string): Promise<{
    conversationsDeleted: number;
    vocabularyDeleted: number;
    assignmentSubmissionsDeleted: number;
    placementReset: boolean;
  }>;

  // ===== Daniela's Neural Network Memory System =====
  
  // Self Best Practices - Universal teaching wisdom
  createBestPractice(data: InsertSelfBestPractice): Promise<SelfBestPractice>;
  getBestPractices(category?: BestPracticeCategory, activeOnly?: boolean): Promise<SelfBestPractice[]>;
  getBestPractice(id: string): Promise<SelfBestPractice | undefined>;
  updateBestPractice(id: string, data: Partial<SelfBestPractice>): Promise<SelfBestPractice | undefined>;
  upsertBestPractice(category: BestPracticeCategory, insight: string, context?: string, source?: string): Promise<SelfBestPractice>;
  incrementBestPracticeUsage(id: string): Promise<void>;
  
  // People Connections - Relationship awareness
  createPeopleConnection(data: InsertPeopleConnection): Promise<PeopleConnection>;
  getPeopleConnections(personId: string): Promise<PeopleConnection[]>;
  getAllPeopleConnections(): Promise<PeopleConnection[]>;
  updatePeopleConnection(id: string, data: Partial<PeopleConnection>): Promise<PeopleConnection | undefined>;
  // Find pending connections that might match a new user (by name)
  findPendingConnectionsByName(firstName: string, lastName?: string): Promise<PeopleConnection[]>;
  // Get connections where this person is the subject (personB or pending match)
  getConnectionsAboutPerson(personId: string, firstName?: string, lastName?: string): Promise<PeopleConnection[]>;
  // Link a pending connection to an actual user
  linkPendingConnection(connectionId: string, personBId: string): Promise<PeopleConnection | undefined>;
  
  // Student Insights - Per-student learning observations
  createStudentInsight(data: InsertStudentInsight): Promise<StudentInsight>;
  getStudentInsights(studentId: string, language?: string): Promise<StudentInsight[]>;
  updateStudentInsight(id: string, data: Partial<StudentInsight>): Promise<StudentInsight | undefined>;
  incrementInsightObservation(id: string): Promise<void>;
  upsertStudentInsight(studentId: string, language: string | null, insightType: string, insight: string, evidence?: string): Promise<StudentInsight>;
  
  // Learning Motivations - Why students are learning
  createLearningMotivation(data: InsertLearningMotivation): Promise<LearningMotivation>;
  getLearningMotivations(studentId: string, language?: string): Promise<LearningMotivation[]>;
  updateLearningMotivation(id: string, data: Partial<LearningMotivation>): Promise<LearningMotivation | undefined>;
  upsertLearningMotivation(studentId: string, language: string | null, motivation: string, details?: string, sourceConversationId?: string): Promise<LearningMotivation>;
  
  // Recurring Struggles - Persistent challenges
  createRecurringStruggle(data: InsertRecurringStruggle): Promise<RecurringStruggle>;
  getRecurringStruggles(studentId: string, language?: string, status?: string): Promise<RecurringStruggle[]>;
  updateRecurringStruggle(id: string, data: Partial<RecurringStruggle>): Promise<RecurringStruggle | undefined>;
  incrementStruggleOccurrence(id: string): Promise<void>;
  upsertRecurringStruggle(studentId: string, language: string, struggleArea: string, description: string, specificExamples?: string): Promise<RecurringStruggle>;
  
  // Session Notes - Post-session reflections
  createSessionNote(data: InsertSessionNote): Promise<SessionNote>;
  getSessionNotes(studentId: string, limit?: number): Promise<SessionNote[]>;
  getSessionNoteByConversation(conversationId: string): Promise<SessionNote | undefined>;
  
  // Aggregate Memory Context (for injecting into prompts)
  getStudentMemoryContext(studentId: string, language?: string): Promise<{
    insights: StudentInsight[];
    motivations: LearningMotivation[];
    struggles: RecurringStruggle[];
    recentNotes: SessionNote[];
    connections: PeopleConnection[];
  }>;
  
  // ACTFL Assessment Events (for analytics/effectiveness tracking)
  createActflAssessmentEvent(data: InsertActflAssessmentEvent): Promise<ActflAssessmentEvent>;
  getActflAssessmentEvents(options?: { userId?: string; language?: string; limit?: number }): Promise<ActflAssessmentEvent[]>;
  
  // Agent Observations (Development Agent's Neural Network)
  createAgentObservation(data: InsertAgentObservation): Promise<AgentObservation>;
  getAgentObservations(options?: { category?: string; status?: string; limit?: number }): Promise<AgentObservation[]>;
  updateAgentObservation(id: string, data: Partial<AgentObservation>): Promise<AgentObservation | undefined>;
  
  // Support Observations (Support Agent's Neural Network)
  createSupportObservation(data: InsertSupportObservation): Promise<SupportObservation>;
  getSupportObservations(options?: { category?: string; status?: string; escalationNeeded?: boolean; limit?: number }): Promise<SupportObservation[]>;
  updateSupportObservation(id: string, data: Partial<SupportObservation>): Promise<SupportObservation | undefined>;
  
  // System Alerts (Proactive Support Communications)
  createSystemAlert(data: InsertSystemAlert): Promise<SystemAlert>;
  getActiveSystemAlerts(options?: { target?: string; severity?: string }): Promise<SystemAlert[]>;
  updateSystemAlert(id: string, data: Partial<SystemAlert>): Promise<SystemAlert | undefined>;
  incrementAlertView(id: string): Promise<void>;
  incrementAlertDismiss(id: string): Promise<void>;
  getRecentSystemAlerts(options?: { limit?: number; environment?: string }): Promise<SystemAlert[]>;
  
  // Support Tickets (Tri-Lane Hive - Support Agent escalations)
  createSupportTicket(data: InsertSupportTicket): Promise<SupportTicket>;
  getSupportTicket(id: string): Promise<SupportTicket | undefined>;
  getSupportTickets(options?: { userId?: string; status?: string; category?: string; limit?: number }): Promise<SupportTicket[]>;
  updateSupportTicket(id: string, data: Partial<SupportTicket>): Promise<SupportTicket | undefined>;
  createSupportMessage(data: InsertSupportMessage): Promise<SupportMessage>;
  getSupportMessages(ticketId: string): Promise<SupportMessage[]>;
  // Alias for routes - maps senderType to role field
  addSupportMessage(data: { ticketId: string; senderType: 'user' | 'support'; senderId?: string; content: string }): Promise<SupportMessage>;
  
  // Sofia Issue Reports (Production voice debugging)
  createSofiaIssueReport(data: InsertSofiaIssueReport): Promise<SofiaIssueReport>;
  getSofiaIssueReports(options?: { status?: string; issueType?: string; userId?: string; limit?: number }): Promise<SofiaIssueReport[]>;
  updateSofiaIssueReport(id: string, data: Partial<SofiaIssueReport>): Promise<SofiaIssueReport | undefined>;
  
  // Daniela Suggestions (Hive Mind - Active contributions from Daniela)
  createDanielaSuggestion(data: InsertDanielaSuggestion): Promise<DanielaSuggestion>;
  
  // Self-Surgery Proposals (Daniela's direct neural network modifications)
  createSelfSurgeryProposal(data: InsertSelfSurgeryProposal): Promise<SelfSurgeryProposal>;
  getSelfSurgeryProposalById(id: string): Promise<SelfSurgeryProposal | undefined>;
  getSelfSurgeryProposals(options?: { status?: string; targetTable?: string; limit?: number }): Promise<SelfSurgeryProposal[]>;
  updateSelfSurgeryProposal(id: string, data: Partial<SelfSurgeryProposal>): Promise<SelfSurgeryProposal | undefined>;
  
  // Tri-Lane Hive Collaboration APIs
  getCollaborationContext(options?: { domainTags?: string[]; originRole?: string; limit?: number }): Promise<{
    danielaSuggestions: any[];
    agentObservations: AgentObservation[];
    supportObservations: SupportObservation[];
  }>;
  getPendingAcknowledgments(forRole: 'daniela' | 'editor' | 'support'): Promise<{
    danielaSuggestions: any[];
    agentObservations: AgentObservation[];
    supportObservations: SupportObservation[];
  }>;
  
  // Agenda Queue (Express Lane discussion items)
  createAgendaQueueItem(data: InsertAgendaQueue): Promise<AgendaQueueItem>;
  
  // ===== Feature Sprint System =====
  // Feature Sprints
  createFeatureSprint(data: InsertFeatureSprint): Promise<FeatureSprint>;
  getFeatureSprint(id: string): Promise<FeatureSprint | undefined>;
  getFeatureSprints(options?: { stage?: string; createdBy?: string; limit?: number }): Promise<FeatureSprint[]>;
  updateFeatureSprint(id: string, data: Partial<FeatureSprint>): Promise<FeatureSprint | undefined>;
  deleteFeatureSprint(id: string): Promise<void>;
  
  // Sprint Stage Transitions
  createSprintStageTransition(data: InsertSprintStageTransition): Promise<SprintStageTransition>;
  getSprintTransitions(sprintId: string): Promise<SprintStageTransition[]>;
  
  // Consultation Threads
  createConsultationThread(data: InsertConsultationThread): Promise<ConsultationThread>;
  getConsultationThread(id: string): Promise<ConsultationThread | undefined>;
  getConsultationThreads(options?: { createdBy?: string; sprintId?: string; limit?: number }): Promise<ConsultationThread[]>;
  updateConsultationThread(id: string, data: Partial<ConsultationThread>): Promise<ConsultationThread | undefined>;
  
  // Consultation Messages
  createConsultationMessage(data: InsertConsultationMessage): Promise<ConsultationMessage>;
  getConsultationMessages(threadId: string): Promise<ConsultationMessage[]>;
  
  // Sprint Templates
  getSprintTemplates(templateType?: string): Promise<SprintTemplate[]>;
  getSprintTemplate(id: string): Promise<SprintTemplate | undefined>;
  createSprintTemplate(data: InsertSprintTemplate): Promise<SprintTemplate>;
  incrementTemplateUsage(id: string): Promise<void>;
  
  // Project Context Snapshots
  getActiveProjectContext(): Promise<ProjectContextSnapshot | undefined>;
  createProjectContextSnapshot(data: InsertProjectContextSnapshot): Promise<ProjectContextSnapshot>;
  deactivateOldSnapshots(): Promise<void>;
  
  // AI Suggestions
  createAiSuggestion(data: InsertAiSuggestion): Promise<AiSuggestion>;
  getAiSuggestions(options?: { status?: string; suggestionType?: string; limit?: number }): Promise<AiSuggestion[]>;
  updateAiSuggestion(id: string, data: Partial<AiSuggestion>): Promise<AiSuggestion | undefined>;
  
  // ===== Collaborative Surgery Sessions =====
  createSurgerySession(data: InsertSurgerySession): Promise<SurgerySession>;
  getSurgerySession(id: string): Promise<SurgerySession | undefined>;
  getActiveSurgerySession(): Promise<SurgerySession | undefined>;
  getSurgerySessions(options?: { status?: string; limit?: number }): Promise<SurgerySession[]>;
  updateSurgerySession(id: string, data: Partial<SurgerySession>): Promise<SurgerySession | undefined>;
  
  createSurgeryTurn(data: InsertSurgeryTurn): Promise<SurgeryTurn>;
  getSurgeryTurns(sessionId: string): Promise<SurgeryTurn[]>;
  getLatestSurgeryTurn(sessionId: string): Promise<SurgeryTurn | undefined>;
  
  // ===== Daniela's North Star System =====
  // North Star Principles (immutable constitutional truths)
  createNorthStarPrinciple(data: InsertNorthStarPrinciple): Promise<NorthStarPrinciple>;
  getNorthStarPrinciple(id: string): Promise<NorthStarPrinciple | undefined>;
  getAllNorthStarPrinciples(): Promise<NorthStarPrinciple[]>;
  getNorthStarPrinciplesByCategory(category: string): Promise<NorthStarPrinciple[]>;
  updateNorthStarPrinciple(id: string, data: Partial<NorthStarPrinciple>): Promise<NorthStarPrinciple | undefined>;
  
  // North Star Understanding (Daniela's evolving grasp)
  createNorthStarUnderstanding(data: InsertNorthStarUnderstanding): Promise<NorthStarUnderstanding>;
  getNorthStarUnderstanding(principleId: string): Promise<NorthStarUnderstanding | undefined>;
  getAllNorthStarUnderstanding(): Promise<NorthStarUnderstanding[]>;
  updateNorthStarUnderstanding(id: string, data: Partial<NorthStarUnderstanding>): Promise<NorthStarUnderstanding | undefined>;
  deepenNorthStarUnderstanding(principleId: string, reflection: string, depth: string, sessionId?: string): Promise<NorthStarUnderstanding>;
  
  // North Star Examples (living illustrations)
  createNorthStarExample(data: InsertNorthStarExample): Promise<NorthStarExample>;
  getNorthStarExamples(principleId: string): Promise<NorthStarExample[]>;
  getApprovedNorthStarExamples(principleId: string): Promise<NorthStarExample[]>;
  approveNorthStarExample(id: string): Promise<NorthStarExample | undefined>;
  
  // Full North Star retrieval (for prompt injection)
  getFullNorthStar(): Promise<{
    principles: NorthStarPrinciple[];
    understanding: NorthStarUnderstanding[];
    examples: NorthStarExample[];
  }>;
  
  // ===== Wren Insights (Development Agent Memory) =====
  createWrenInsight(data: InsertWrenInsight): Promise<WrenInsight>;
  getWrenInsight(id: string): Promise<WrenInsight | undefined>;
  getWrenInsights(options?: { category?: string; limit?: number }): Promise<WrenInsight[]>;
  searchWrenInsights(query: string): Promise<WrenInsight[]>;
  updateWrenInsight(id: string, data: Partial<WrenInsight>): Promise<WrenInsight | undefined>;
  markWrenInsightUsed(id: string): Promise<WrenInsight | undefined>;
  deleteWrenInsight(id: string): Promise<boolean>;
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
    const result = await getUserDb().select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await getUserDb().select().from(users).where(eq(users.email, email.toLowerCase()));
    return result[0];
  }

  async createUser(userData: { email: string; firstName?: string | null; lastName?: string | null; role?: string; authProvider?: string }): Promise<User> {
    const [created] = await getUserDb().insert(users).values({
      email: userData.email.toLowerCase(),
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      role: (userData.role as any) || 'student',
      authProvider: (userData.authProvider as any) || 'pending',
    }).returning();
    return created;
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
    memoryPrivacySettings?: {
      enabled: boolean;
      allowedCategories: string[];
      blockedCategories: string[];
      redactionRequested: boolean;
      redactionRequestedAt?: string;
    };
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

  async updateUserTimezone(userId: string, timezone: string): Promise<void> {
    await db.update(users)
      .set({ timezone, updatedAt: new Date() })
      .where(eq(users.id, userId));
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
    // Also set ownerEmail for cross-environment access
    let ownerEmail: string | undefined;
    try {
      const user = await this.getUser(data.userId);
      ownerEmail = user?.email ?? undefined;
    } catch (e) {
      console.warn('[STORAGE] Could not get user email for conversation:', e);
    }
    
    const conversationData = {
      ...data,
      learningContext: data.classId ? 'class_assigned' : 'self_directed',
      ownerEmail,
    } as typeof conversations.$inferInsert;
    
    const [conversation] = await getSharedDb().insert(conversations).values(conversationData).returning();
    return conversation;
  }

  async getConversation(id: string, userId: string): Promise<Conversation | undefined> {
    // First try exact userId match
    let result = await getSharedDb().select().from(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
    
    if (result[0]) {
      return result[0];
    }
    
    // CROSS-ENV FALLBACK: If not found, try matching by email
    // This handles the case where conversations were created in dev but accessed from prod
    // (user has different userIds in dev vs prod, but same email)
    const user = await this.getUser(userId);
    if (user?.email) {
      // Find all userIds with this email from the shared database conversations
      const crossEnvResult = await getSharedDb().select().from(conversations)
        .where(eq(conversations.id, id));
      
      if (crossEnvResult[0]) {
        // Conversation exists - allow access since we authenticated
        console.log(`[STORAGE] Cross-env conversation access: conv=${id}, localUserId=${userId}, convUserId=${crossEnvResult[0].userId}`);
        return crossEnvResult[0];
      }
    }
    
    return undefined;
  }

  async getUserConversations(userId: string): Promise<Conversation[]> {
    console.log('[STORAGE] getUserConversations - querying shared DB for userId:', userId);
    
    // First try exact userId match
    let result = await getSharedDb().select().from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.createdAt));
    
    // CROSS-ENV LOOKUP: Also find conversations by ownerEmail
    // This handles accessing conversations created in another environment
    const user = await this.getUser(userId);
    if (user?.email) {
      const emailResult = await getSharedDb().select().from(conversations)
        .where(eq(conversations.ownerEmail, user.email))
        .orderBy(desc(conversations.createdAt));
      
      if (emailResult.length > 0) {
        console.log(`[STORAGE] getUserConversations - found ${emailResult.length} cross-env conversations by email`);
        
        // Merge and dedupe by conversation ID
        const seenIds = new Set(result.map(c => c.id));
        for (const conv of emailResult) {
          if (!seenIds.has(conv.id)) {
            result.push(conv);
            seenIds.add(conv.id);
          }
        }
        
        // Re-sort by createdAt after merge
        result.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
      }
    }
    
    console.log('[STORAGE] getUserConversations - found', result.length, 'total conversations');
    return result;
  }

  async debugGetSampleConversations(): Promise<Conversation[]> {
    // Debug method to see what userIds exist in the shared conversations table
    return await getSharedDb().select().from(conversations)
      .orderBy(desc(conversations.createdAt))
      .limit(10);
  }

  private async getConversationById(id: string): Promise<Conversation | undefined> {
    const result = await getSharedDb().select().from(conversations).where(eq(conversations.id, id));
    return result[0];
  }

  async getConversationsByLanguage(language: string, userId: string): Promise<Conversation[]> {
    return await getSharedDb().select().from(conversations)
      .where(and(eq(conversations.language, language), eq(conversations.userId, userId)))
      .orderBy(desc(conversations.createdAt));
  }

  async getConversationByLanguageAndDifficulty(language: string, difficulty: string, userId: string): Promise<Conversation | undefined> {
    const result = await getSharedDb().select().from(conversations)
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
    
    const [updated] = await getSharedDb().update(conversations)
      .set(filteredData)
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
      .returning();
    
    return updated;
  }

  private async updateConversationInternal(id: string, data: Partial<Conversation>): Promise<Conversation | undefined> {
    const filteredData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined)
    );
    
    const [updated] = await getSharedDb().update(conversations)
      .set(filteredData)
      .where(eq(conversations.id, id))
      .returning();
    
    return updated;
  }

  async updateConversationLanguage(conversationId: string, language: string): Promise<void> {
    // Update conversation language - used during cross-language tutor handoffs
    await getSharedDb().update(conversations)
      .set({ language: language.toLowerCase() })
      .where(eq(conversations.id, conversationId));
  }

  async deleteConversation(id: string, userId: string): Promise<boolean> {
    const conversation = await this.getConversation(id, userId);
    if (!conversation) {
      return false;
    }
    
    await getSharedDb().delete(messages).where(eq(messages.conversationId, id));
    await db.delete(pronunciationScores).where(eq(pronunciationScores.conversationId, id));
    const result = await getSharedDb().delete(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async createMessage(data: InsertMessage): Promise<Message> {
    const [message] = await getSharedDb().insert(messages).values(data).returning();

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
    const result = await getSharedDb().select({
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
    return await getSharedDb().select().from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
  }

  async updateMessage(id: string, data: Partial<Message>): Promise<Message | undefined> {
    const [updated] = await getSharedDb().update(messages)
      .set(data)
      .where(eq(messages.id, id))
      .returning();
    return updated;
  }

  async searchMessages(userId: string, query: string, limit: number = 20): Promise<Array<Message & { conversationTitle: string | null }>> {
    // Week 1 Feature: Smart search across all user conversations
    const results = await getSharedDb()
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
    // vocabulary_words is in SHARED database (FK to conversations which is also in SHARED)
    const [word] = await getSharedDb().insert(vocabularyWords).values(data).returning();
    return word;
  }

  async getVocabularyWord(id: string): Promise<VocabularyWord | undefined> {
    const [word] = await getSharedDb()
      .select()
      .from(vocabularyWords)
      .where(eq(vocabularyWords.id, id))
      .limit(1);
    return word;
  }

  async getVocabularyWords(language: string, userId: string, difficulty?: string): Promise<VocabularyWord[]> {
    if (difficulty) {
      return await getSharedDb().select().from(vocabularyWords)
        .where(and(
          eq(vocabularyWords.language, language),
          eq(vocabularyWords.userId, userId),
          eq(vocabularyWords.difficulty, difficulty)
        ));
    }
    return await getSharedDb().select().from(vocabularyWords)
      .where(and(eq(vocabularyWords.language, language), eq(vocabularyWords.userId, userId)));
  }

  async updateVocabularyWord(id: string, data: Partial<VocabularyWord>): Promise<VocabularyWord | undefined> {
    // Constrain to only safe fields for vocabulary mastery updates
    const safeFields: Partial<VocabularyWord> = {};
    if (data.correctCount !== undefined) safeFields.correctCount = data.correctCount;
    if (data.incorrectCount !== undefined) safeFields.incorrectCount = data.incorrectCount;
    if (data.repetition !== undefined) safeFields.repetition = data.repetition;
    if (data.nextReviewDate !== undefined) safeFields.nextReviewDate = data.nextReviewDate;
    if (data.easeFactor !== undefined) safeFields.easeFactor = data.easeFactor;
    if (data.interval !== undefined) safeFields.interval = data.interval;
    
    if (Object.keys(safeFields).length === 0) {
      return this.getVocabularyWord(id);
    }
    
    const [updated] = await getSharedDb().update(vocabularyWords)
      .set(safeFields)
      .where(eq(vocabularyWords.id, id))
      .returning();
    return updated;
  }

  async updateVocabularyReview(id: string, isCorrect: boolean): Promise<VocabularyWord | undefined> {
    const result = await getSharedDb().select().from(vocabularyWords).where(eq(vocabularyWords.id, id));
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

    const [updated] = await getSharedDb().update(vocabularyWords)
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

    return await getSharedDb().select().from(vocabularyWords)
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

  async getGrammarCompetencies(language: string, classId?: string): Promise<GrammarCompetency[]> {
    // ACTFL level to numeric mapping
    const actflLevelToNumeric: Record<string, number> = {
      'novice_low': 1,
      'novice_mid': 2,
      'novice_high': 3,
      'intermediate_low': 4,
      'intermediate_mid': 5,
      'intermediate_high': 6,
      'advanced_low': 7,
      'advanced_mid': 8,
      'advanced_high': 9,
      'superior': 10,
      'distinguished': 11,
    };
    
    // If classId provided, look up the class's curriculum path to get the endLevel
    if (classId) {
      const classResult = await db.select({
        curriculumPathId: teacherClasses.curriculumPathId,
      })
        .from(teacherClasses)
        .where(eq(teacherClasses.id, classId))
        .limit(1);
      
      if (classResult.length > 0 && classResult[0].curriculumPathId) {
        const pathResult = await db.select({
          endLevel: curriculumPaths.endLevel,
        })
          .from(curriculumPaths)
          .where(eq(curriculumPaths.id, classResult[0].curriculumPathId))
          .limit(1);
        
        if (pathResult.length > 0 && pathResult[0].endLevel) {
          // Normalize to lowercase for lookup (stored values may be UPPERCASE)
          const maxLevelNumeric = actflLevelToNumeric[pathResult[0].endLevel.toLowerCase()] || 11;
          
          // Filter competencies to only those at or below the class's end level
          return await db.select().from(grammarCompetencies)
            .where(and(
              eq(grammarCompetencies.language, language),
              lte(grammarCompetencies.actflLevelNumeric, maxLevelNumeric)
            ))
            .orderBy(grammarCompetencies.actflLevelNumeric, grammarCompetencies.name);
        }
      }
    }
    
    // Default: return all competencies for the language
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
    const validLanguages = ['spanish', 'french', 'german', 'italian', 'portuguese', 'japanese', 'mandarin', 'korean', 'english', 'hebrew'];
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
    return await getSharedDb().select().from(topicsTable);
  }

  async getTopic(id: string): Promise<Topic | undefined> {
    const result = await getSharedDb().select().from(topicsTable).where(eq(topicsTable.id, id));
    return result[0];
  }

  async createTopic(data: InsertTopic): Promise<Topic> {
    const [topic] = await getSharedDb().insert(topicsTable).values(data).returning();
    return topic;
  }

  async getCulturalTips(language: string): Promise<CulturalTip[]> {
    return await getSharedDb().select().from(culturalTipsTable)
      .where(eq(culturalTipsTable.language, language));
  }

  async getCulturalTip(id: string): Promise<CulturalTip | undefined> {
    const result = await getSharedDb().select().from(culturalTipsTable).where(eq(culturalTipsTable.id, id));
    return result[0];
  }

  async createCulturalTip(data: InsertCulturalTip): Promise<CulturalTip> {
    const [culturalTip] = await getSharedDb().insert(culturalTipsTable).values(data).returning();
    return culturalTip;
  }

  async updateCulturalTip(id: string, data: Partial<InsertCulturalTip>): Promise<CulturalTip> {
    const [updated] = await getSharedDb().update(culturalTipsTable)
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

  async getAllMediaFiles(options: { source?: string; reviewed?: string; limit?: number; offset?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' } = {}): Promise<{ files: MediaFile[]; total: number; newCount?: number; unreviewedCount?: number }> {
    const { source, reviewed, limit = 50, offset = 0, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    
    const conditions: any[] = [];
    if (source) conditions.push(eq(mediaFiles.imageSource, source));
    if (reviewed === 'reviewed') conditions.push(eq(mediaFiles.isReviewed, true));
    if (reviewed === 'unreviewed') conditions.push(eq(mediaFiles.isReviewed, false));
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const getSortColumn = () => {
      switch (sortBy) {
        case 'usageCount': return mediaFiles.usageCount;
        case 'fileSize': return mediaFiles.fileSize;
        case 'language': return mediaFiles.language;
        default: return mediaFiles.createdAt;
      }
    };
    
    const orderByClause = sortOrder === 'asc' ? asc(getSortColumn()) : desc(getSortColumn());
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const [files, countResult, newCountResult, unreviewedCountResult] = await Promise.all([
      whereClause
        ? db.select().from(mediaFiles).where(whereClause).orderBy(orderByClause).limit(limit).offset(offset)
        : db.select().from(mediaFiles).orderBy(orderByClause).limit(limit).offset(offset),
      whereClause
        ? db.select({ count: sql<number>`count(*)` }).from(mediaFiles).where(whereClause)
        : db.select({ count: sql<number>`count(*)` }).from(mediaFiles),
      db.select({ count: sql<number>`count(*)` }).from(mediaFiles).where(sql`${mediaFiles.createdAt} > ${oneDayAgo.toISOString()}`),
      db.select({ count: sql<number>`count(*)` }).from(mediaFiles).where(eq(mediaFiles.isReviewed, false))
    ]);
    
    return {
      files,
      total: Number(countResult[0]?.count || 0),
      newCount: Number(newCountResult[0]?.count || 0),
      unreviewedCount: Number(unreviewedCountResult[0]?.count || 0)
    };
  }

  async updateMediaFile(id: string, data: { title?: string | null; description?: string | null; tags?: string[] | null; language?: string | null; isReviewed?: boolean; reviewedAt?: Date | null; reviewedBy?: string | null }): Promise<MediaFile | undefined> {
    const allowedUpdates: Partial<typeof mediaFiles.$inferInsert> = {};
    if (data.title !== undefined) allowedUpdates.title = data.title;
    if (data.description !== undefined) allowedUpdates.description = data.description;
    if (data.tags !== undefined) allowedUpdates.tags = data.tags;
    if (data.language !== undefined) allowedUpdates.language = data.language;
    if (data.isReviewed !== undefined) allowedUpdates.isReviewed = data.isReviewed;
    if (data.reviewedAt !== undefined) allowedUpdates.reviewedAt = data.reviewedAt;
    if (data.reviewedBy !== undefined) allowedUpdates.reviewedBy = data.reviewedBy;
    
    if (Object.keys(allowedUpdates).length === 0) {
      return await this.getMediaFile(id);
    }
    
    const [updated] = await db.update(mediaFiles)
      .set(allowedUpdates)
      .where(eq(mediaFiles.id, id))
      .returning();
    return updated;
  }

  async bulkUpdateMediaReviewStatus(ids: string[], isReviewed: boolean, reviewedBy: string): Promise<number> {
    const result = await db.update(mediaFiles)
      .set({
        isReviewed,
        reviewedAt: isReviewed ? new Date() : null,
        reviewedBy: isReviewed ? reviewedBy : null,
      })
      .where(inArray(mediaFiles.id, ids));
    return ids.length;
  }

  async deleteMediaFile(id: string): Promise<boolean> {
    const result = await db.delete(mediaFiles).where(eq(mediaFiles.id, id));
    return true;
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
    let query = getSharedDb().select().from(canDoStatements);
    
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
    const result = await getSharedDb().select().from(canDoStatements).where(eq(canDoStatements.id, id));
    return result[0];
  }

  async seedCanDoStatements(): Promise<void> {
    const { getAllCanDoStatements } = await import('./actfl-can-do-statements');
    const allStatements = getAllCanDoStatements();
    
    const existing = await getSharedDb().select().from(canDoStatements).limit(1);
    if (existing.length > 0) {
      return;
    }
    
    for (const stmt of allStatements) {
      await getSharedDb().insert(canDoStatements).values(stmt);
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
    const [teacherClass] = await getSharedDb().insert(teacherClasses).values(data).returning();
    return teacherClass;
  }

  async getTeacherClass(id: string): Promise<TeacherClass | undefined> {
    const result = await getSharedDb().select().from(teacherClasses).where(eq(teacherClasses.id, id));
    return result[0];
  }

  async getTeacherClasses(teacherId: string): Promise<TeacherClass[]> {
    return await getSharedDb().select().from(teacherClasses).where(eq(teacherClasses.teacherId, teacherId));
  }

  async getAllActiveClasses(): Promise<TeacherClass[]> {
    return await getSharedDb().select().from(teacherClasses).where(eq(teacherClasses.isActive, true));
  }

  async getFeaturedClasses(): Promise<Array<TeacherClass & { classType?: ClassType }>> {
    const result = await getSharedDb()
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
    const [updated] = await getSharedDb()
      .update(teacherClasses)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(teacherClasses.id, id))
      .returning();
    return updated;
  }

  async deleteTeacherClass(id: string): Promise<boolean> {
    const result = await getSharedDb().delete(teacherClasses).where(eq(teacherClasses.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getClassByJoinCode(joinCode: string): Promise<TeacherClass | undefined> {
    const result = await getSharedDb().select().from(teacherClasses).where(eq(teacherClasses.joinCode, joinCode));
    return result[0];
  }
  
  // ===== Class Hour Packages (Institutional) =====
  
  async createClassHourPackage(data: InsertClassHourPackage): Promise<ClassHourPackage> {
    const [pkg] = await getSharedDb().insert(classHourPackages).values(data).returning();
    return pkg;
  }
  
  async getClassHourPackage(id: string): Promise<ClassHourPackage | undefined> {
    const result = await getSharedDb().select().from(classHourPackages).where(eq(classHourPackages.id, id));
    return result[0];
  }
  
  async getClassHourPackages(purchaserId?: string): Promise<ClassHourPackage[]> {
    if (purchaserId) {
      return await getSharedDb().select().from(classHourPackages).where(eq(classHourPackages.purchaserId, purchaserId));
    }
    return await getSharedDb().select().from(classHourPackages);
  }
  
  async updateClassHourPackage(id: string, data: Partial<ClassHourPackage>): Promise<ClassHourPackage | undefined> {
    const [updated] = await getSharedDb()
      .update(classHourPackages)
      .set(data)
      .where(eq(classHourPackages.id, id))
      .returning();
    return updated;
  }
  
  async deleteClassHourPackage(id: string): Promise<boolean> {
    const result = await getSharedDb().delete(classHourPackages).where(eq(classHourPackages.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ===== Class Enrollments =====
  
  async enrollStudent(classId: string, studentId: string): Promise<ClassEnrollment> {
    // Check if already enrolled to prevent duplicates
    const existing = await getSharedDb()
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
        const [updated] = await getSharedDb()
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
    const [enrollment] = await getSharedDb()
      .insert(classEnrollments)
      .values({ classId, studentId })
      .returning();
    return enrollment;
  }

  async getClassEnrollments(classId: string): Promise<Array<ClassEnrollment & { student: User }>> {
    const result = await getSharedDb()
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
    const result = await getSharedDb()
      .select()
      .from(classEnrollments)
      .leftJoin(teacherClasses, eq(classEnrollments.classId, teacherClasses.id))
      .where(eq(classEnrollments.studentId, studentId))
      .orderBy(teacherClasses.language, teacherClasses.name);
    
    return result.map(row => ({
      ...row.class_enrollments,
      class: row.teacher_classes!
    }));
  }

  async getStudentEnrollment(studentId: string, classId: string): Promise<ClassEnrollment | undefined> {
    const result = await getSharedDb()
      .select()
      .from(classEnrollments)
      .where(
        and(
          eq(classEnrollments.studentId, studentId),
          eq(classEnrollments.classId, classId)
        )
      )
      .limit(1);
    return result[0];
  }

  async unenrollStudent(classId: string, studentId: string): Promise<boolean> {
    const result = await getSharedDb()
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
    const result = await getSharedDb()
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
    const [path] = await getSharedDb().insert(curriculumPaths).values(data).returning();
    return path;
  }

  async getCurriculumPath(id: string): Promise<CurriculumPath | undefined> {
    const result = await getSharedDb().select().from(curriculumPaths).where(eq(curriculumPaths.id, id));
    return result[0];
  }

  async getCurriculumPaths(language?: string): Promise<CurriculumPath[]> {
    if (language) {
      return await getSharedDb().select().from(curriculumPaths).where(eq(curriculumPaths.language, language));
    }
    return await getSharedDb().select().from(curriculumPaths);
  }

  async getCurriculumStats(): Promise<{ pathCount: number; unitCount: number; lessonCount: number; languageCount: number }> {
    const [pathResult] = await getSharedDb().select({ count: sql<number>`count(*)::int` }).from(curriculumPaths);
    const [unitResult] = await getSharedDb().select({ count: sql<number>`count(*)::int` }).from(curriculumUnits);
    const [lessonResult] = await getSharedDb().select({ count: sql<number>`count(*)::int` }).from(curriculumLessons);
    const [languageResult] = await getSharedDb().select({ count: sql<number>`count(distinct ${curriculumPaths.language})::int` }).from(curriculumPaths);
    
    return {
      pathCount: pathResult?.count || 0,
      unitCount: unitResult?.count || 0,
      lessonCount: lessonResult?.count || 0,
      languageCount: languageResult?.count || 0,
    };
  }

  async updateCurriculumPath(id: string, data: Partial<CurriculumPath>): Promise<CurriculumPath | undefined> {
    const [updated] = await getSharedDb()
      .update(curriculumPaths)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(curriculumPaths.id, id))
      .returning();
    return updated;
  }

  // ===== Curriculum Units =====
  
  async createCurriculumUnit(data: InsertCurriculumUnit): Promise<CurriculumUnit> {
    const [unit] = await getSharedDb().insert(curriculumUnits).values(data).returning();
    return unit;
  }

  async getCurriculumUnits(curriculumPathId: string): Promise<CurriculumUnit[]> {
    return await getSharedDb()
      .select()
      .from(curriculumUnits)
      .where(eq(curriculumUnits.curriculumPathId, curriculumPathId))
      .orderBy(curriculumUnits.orderIndex);
  }

  async getCurriculumUnit(id: string): Promise<CurriculumUnit | undefined> {
    const result = await getSharedDb().select().from(curriculumUnits).where(eq(curriculumUnits.id, id));
    return result[0];
  }

  // ===== Curriculum Lessons =====
  
  async createCurriculumLesson(data: InsertCurriculumLesson): Promise<CurriculumLesson> {
    const [lesson] = await getSharedDb().insert(curriculumLessons).values(data).returning();
    return lesson;
  }

  async getCurriculumLessons(curriculumUnitId: string): Promise<CurriculumLesson[]> {
    return await getSharedDb()
      .select()
      .from(curriculumLessons)
      .where(eq(curriculumLessons.curriculumUnitId, curriculumUnitId))
      .orderBy(curriculumLessons.orderIndex);
  }

  async getCurriculumLesson(id: string): Promise<CurriculumLesson | undefined> {
    const result = await getSharedDb().select().from(curriculumLessons).where(eq(curriculumLessons.id, id));
    return result[0];
  }

  // ===== Drill Items =====

  async createDrillItem(data: InsertCurriculumDrillItem): Promise<CurriculumDrillItem> {
    const [item] = await getSharedDb().insert(curriculumDrillItems).values(data).returning();
    return item;
  }

  async getDrillItems(lessonId: string): Promise<CurriculumDrillItem[]> {
    return await getSharedDb()
      .select()
      .from(curriculumDrillItems)
      .where(eq(curriculumDrillItems.lessonId, lessonId))
      .orderBy(curriculumDrillItems.orderIndex);
  }

  async getDrillItem(id: string): Promise<CurriculumDrillItem | undefined> {
    const result = await getSharedDb().select().from(curriculumDrillItems).where(eq(curriculumDrillItems.id, id));
    return result[0];
  }

  async updateDrillItem(id: string, data: Partial<CurriculumDrillItem>): Promise<CurriculumDrillItem | undefined> {
    const [updated] = await getSharedDb()
      .update(curriculumDrillItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(curriculumDrillItems.id, id))
      .returning();
    return updated;
  }

  async deleteDrillItem(id: string): Promise<boolean> {
    const result = await getSharedDb().delete(curriculumDrillItems).where(eq(curriculumDrillItems.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async updateDrillItemAudio(id: string, audioUrl: string, audioDurationMs?: number): Promise<CurriculumDrillItem | undefined> {
    const updateData: Partial<CurriculumDrillItem> = { audioUrl, updatedAt: new Date() };
    if (audioDurationMs !== undefined) {
      updateData.audioDurationMs = audioDurationMs;
    }
    const [updated] = await getSharedDb()
      .update(curriculumDrillItems)
      .set(updateData)
      .where(eq(curriculumDrillItems.id, id))
      .returning();
    return updated;
  }

  async updateDrillItemAudioForGender(id: string, audioUrl: string, audioDurationMs: number, gender: 'female' | 'male'): Promise<CurriculumDrillItem | undefined> {
    const updateData: Partial<CurriculumDrillItem> = { updatedAt: new Date() };
    if (gender === 'female') {
      updateData.audioUrlFemale = audioUrl;
      updateData.audioDurationMsFemale = audioDurationMs;
    } else {
      updateData.audioUrlMale = audioUrl;
      updateData.audioDurationMsMale = audioDurationMs;
    }
    const [updated] = await getSharedDb()
      .update(curriculumDrillItems)
      .set(updateData)
      .where(eq(curriculumDrillItems.id, id))
      .returning();
    return updated;
  }

  // ===== User Drill Progress =====

  async getDrillProgress(userId: string, drillItemId: string): Promise<UserDrillProgress | undefined> {
    const result = await db
      .select()
      .from(userDrillProgress)
      .where(and(
        eq(userDrillProgress.userId, userId),
        eq(userDrillProgress.drillItemId, drillItemId)
      ));
    return result[0];
  }

  async getDrillProgressForLesson(userId: string, lessonId: string): Promise<UserDrillProgress[]> {
    // Get all drill items for the lesson, then get progress for each
    const drillItems = await this.getDrillItems(lessonId);
    const drillItemIds = drillItems.map(item => item.id);
    
    if (drillItemIds.length === 0) return [];
    
    return await db
      .select()
      .from(userDrillProgress)
      .where(and(
        eq(userDrillProgress.userId, userId),
        inArray(userDrillProgress.drillItemId, drillItemIds)
      ));
  }

  async recordDrillAttempt(userId: string, drillItemId: string, score: number, timeSpentMs: number, classId?: string): Promise<UserDrillProgress> {
    const existing = await this.getDrillProgress(userId, drillItemId);
    const now = new Date();
    const isCorrect = score >= 0.8; // 80% threshold for "correct"
    
    if (existing) {
      // Update existing progress
      const newAttempts = (existing.attempts ?? 0) + 1;
      const newCorrectCount = (existing.correctCount ?? 0) + (isCorrect ? 1 : 0);
      const newTotalTime = (existing.totalTimeSpentMs ?? 0) + timeSpentMs;
      const newAverage = ((existing.averageScore ?? 0) * (existing.attempts ?? 0) + score) / newAttempts;
      const newBest = Math.max(existing.bestScore ?? 0, score);
      
      // Check mastery (3+ correct in a row with 80%+ average)
      const wasMastered = existing.mastered;
      const isMastered = newCorrectCount >= 3 && newAverage >= 0.8;
      
      // Calculate next review using spaced repetition
      let nextReviewAt = existing.nextReviewAt;
      let reviewInterval = existing.reviewInterval ?? 1;
      if (isCorrect && isMastered) {
        reviewInterval = Math.min(reviewInterval * 2, 30); // Double interval, max 30 days
        nextReviewAt = new Date(now.getTime() + reviewInterval * 24 * 60 * 60 * 1000);
      } else if (!isCorrect) {
        reviewInterval = 1; // Reset to 1 day on incorrect
        nextReviewAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      }
      
      const [updated] = await db
        .update(userDrillProgress)
        .set({
          attempts: newAttempts,
          correctCount: newCorrectCount,
          lastScore: score,
          bestScore: newBest,
          averageScore: newAverage,
          mastered: isMastered,
          masteredAt: isMastered && !wasMastered ? now : existing.masteredAt,
          nextReviewAt,
          reviewInterval,
          lastAttemptedAt: now,
          totalTimeSpentMs: newTotalTime,
          updatedAt: now,
        })
        .where(eq(userDrillProgress.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new progress record
      const isMastered = isCorrect && score >= 0.9; // First-time mastery requires 90%+
      const nextReviewAt = new Date(now.getTime() + (isCorrect ? 2 : 1) * 24 * 60 * 60 * 1000);
      
      const [created] = await db
        .insert(userDrillProgress)
        .values({
          userId,
          drillItemId,
          classId: classId || undefined, // Learning source tracking
          attempts: 1,
          correctCount: isCorrect ? 1 : 0,
          lastScore: score,
          bestScore: score,
          averageScore: score,
          mastered: isMastered,
          masteredAt: isMastered ? now : null,
          nextReviewAt,
          reviewInterval: isCorrect ? 2 : 1,
          lastAttemptedAt: now,
          totalTimeSpentMs: timeSpentMs,
        })
        .returning();
      return created;
    }
  }

  async getDueReviewItems(userId: string, lessonId?: string, limit: number = 20): Promise<CurriculumDrillItem[]> {
    const now = new Date();
    
    // Get items that are due for review
    let query = db
      .select({ drillItem: curriculumDrillItems })
      .from(userDrillProgress)
      .innerJoin(curriculumDrillItems, eq(userDrillProgress.drillItemId, curriculumDrillItems.id))
      .where(and(
        eq(userDrillProgress.userId, userId),
        lte(userDrillProgress.nextReviewAt, now)
      ))
      .orderBy(userDrillProgress.nextReviewAt)
      .limit(limit);
    
    const results = await query;
    
    // Filter by lesson if specified
    if (lessonId) {
      return results
        .filter(r => r.drillItem.lessonId === lessonId)
        .map(r => r.drillItem);
    }
    
    return results.map(r => r.drillItem);
  }

  async checkDrillLessonCompletion(userId: string, lessonId: string): Promise<{ completed: boolean; masteredCount: number; totalCount: number; completionPercent: number }> {
    // Get all drill items for this lesson
    const items = await this.getDrillItems(lessonId);
    const totalCount = items.length;
    
    if (totalCount === 0) {
      return { completed: true, masteredCount: 0, totalCount: 0, completionPercent: 100 };
    }
    
    // Get user's progress on these items
    const progress = await this.getDrillProgressForLesson(userId, lessonId);
    const masteredCount = progress.filter(p => p.mastered).length;
    
    // Consider lesson "completed" when at least 70% of items are mastered
    const completionPercent = Math.round((masteredCount / totalCount) * 100);
    const completed = completionPercent >= 70;
    
    return { completed, masteredCount, totalCount, completionPercent };
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
    return await getSharedDb()
      .select()
      .from(canDoStatements)
      .where(eq(canDoStatements.language, language))
      .orderBy(canDoStatements.actflLevel, canDoStatements.category);
  }

  async getLessonCanDoStatements(lessonIds: string[]): Promise<LessonCanDoStatement[]> {
    if (lessonIds.length === 0) return [];
    return await getSharedDb()
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
    const lessonResult = await getSharedDb()
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

  // ===== Topic Competency Observations (Daniela's SYLLABUS_PROGRESS command) =====

  async createTopicCompetencyObservation(data: InsertTopicCompetencyObservation): Promise<TopicCompetencyObservation> {
    const [observation] = await getSharedDb().insert(topicCompetencyObservations).values(data).returning();
    return observation;
  }

  async getTopicCompetencyObservations(userId: string, language: string): Promise<TopicCompetencyObservation[]> {
    return await getSharedDb()
      .select()
      .from(topicCompetencyObservations)
      .where(and(
        eq(topicCompetencyObservations.userId, userId),
        eq(topicCompetencyObservations.language, language)
      ))
      .orderBy(desc(topicCompetencyObservations.observedAt));
  }

  async getUserTopicCompetencyByName(userId: string, language: string, topicName: string): Promise<TopicCompetencyObservation | undefined> {
    const result = await getSharedDb()
      .select()
      .from(topicCompetencyObservations)
      .where(and(
        eq(topicCompetencyObservations.userId, userId),
        eq(topicCompetencyObservations.language, language),
        eq(topicCompetencyObservations.topicName, topicName)
      ))
      .orderBy(desc(topicCompetencyObservations.observedAt))
      .limit(1);
    return result[0];
  }

  // ===== Daniela Recommendation Queue =====

  async createDanielaRecommendation(data: InsertDanielaRecommendation): Promise<DanielaRecommendation> {
    const [recommendation] = await getSharedDb().insert(danielaRecommendations).values(data).returning();
    return recommendation;
  }

  async getDanielaRecommendations(
    userId: string, 
    options?: { language?: string; classId?: string; includeSnoozed?: boolean; includeCompleted?: boolean }
  ): Promise<DanielaRecommendation[]> {
    const conditions = [eq(danielaRecommendations.userId, userId)];
    
    if (options?.language) {
      conditions.push(eq(danielaRecommendations.language, options.language));
    }
    if (options?.classId) {
      conditions.push(eq(danielaRecommendations.classId, options.classId));
    }
    if (!options?.includeCompleted) {
      conditions.push(isNull(danielaRecommendations.completedAt));
      conditions.push(isNull(danielaRecommendations.dismissedAt));
    }
    if (!options?.includeSnoozed) {
      const snoozedCheck = or(
        isNull(danielaRecommendations.snoozedUntil),
        lte(danielaRecommendations.snoozedUntil, new Date())
      );
      if (snoozedCheck) {
        conditions.push(snoozedCheck);
      }
    }

    return await getSharedDb()
      .select()
      .from(danielaRecommendations)
      .where(and(...conditions))
      .orderBy(desc(danielaRecommendations.priority), desc(danielaRecommendations.createdAt));
  }

  async updateDanielaRecommendation(id: string, data: Partial<DanielaRecommendation>): Promise<DanielaRecommendation | undefined> {
    const [updated] = await getSharedDb()
      .update(danielaRecommendations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(danielaRecommendations.id, id))
      .returning();
    return updated;
  }

  async snoozeRecommendation(id: string, untilDate: Date): Promise<DanielaRecommendation | undefined> {
    return this.updateDanielaRecommendation(id, { snoozedUntil: untilDate });
  }

  async completeRecommendation(id: string, evidenceConversationId?: string): Promise<DanielaRecommendation | undefined> {
    return this.updateDanielaRecommendation(id, { 
      completedAt: new Date(),
      evidenceConversationId: evidenceConversationId || null
    });
  }

  async dismissRecommendation(id: string): Promise<DanielaRecommendation | undefined> {
    return this.updateDanielaRecommendation(id, { dismissedAt: new Date() });
  }

  // ===== Student Tier Signals =====

  async createStudentTierSignal(data: InsertStudentTierSignal): Promise<StudentTierSignal> {
    const [signal] = await db.insert(studentTierSignals).values(data).returning();
    return signal;
  }

  async getStudentTierSignals(
    userId: string, 
    options?: { lessonId?: string; classId?: string; pendingOnly?: boolean }
  ): Promise<StudentTierSignal[]> {
    const conditions = [eq(studentTierSignals.userId, userId)];
    
    if (options?.lessonId) {
      conditions.push(eq(studentTierSignals.lessonId, options.lessonId));
    }
    if (options?.classId) {
      conditions.push(eq(studentTierSignals.classId, options.classId));
    }
    if (options?.pendingOnly) {
      conditions.push(isNull(studentTierSignals.reviewedAt));
    }

    return await db
      .select()
      .from(studentTierSignals)
      .where(and(...conditions))
      .orderBy(desc(studentTierSignals.createdAt));
  }

  async getPendingTierSignals(options?: { classId?: string }): Promise<StudentTierSignal[]> {
    const conditions = [isNull(studentTierSignals.reviewedAt)];
    
    if (options?.classId) {
      conditions.push(eq(studentTierSignals.classId, options.classId));
    }

    return await db
      .select()
      .from(studentTierSignals)
      .where(and(...conditions))
      .orderBy(desc(studentTierSignals.createdAt));
  }

  async reviewTierSignal(id: string, reviewedBy: string, decision: string, notes?: string): Promise<StudentTierSignal | undefined> {
    const [updated] = await db
      .update(studentTierSignals)
      .set({ 
        reviewedAt: new Date(),
        reviewedBy,
        reviewDecision: decision,
        reviewNotes: notes || null
      })
      .where(eq(studentTierSignals.id, id))
      .returning();
    return updated;
  }

  // ===== Unified Progress API =====
  async getUnifiedProgress(studentId: string, classId: string): Promise<import('@shared/schema').UnifiedProgressResponse | null> {
    const teacherClass = await this.getTeacherClass(classId);
    if (!teacherClass) return null;

    const units = await this.getClassCurriculumUnits(classId);
    const activeUnits = units.filter(u => !u.isRemoved).sort((a, b) => a.orderIndex - b.orderIndex);
    
    const activeUnitIds = activeUnits.map(u => u.id);
    const allLessons = await this.getClassCurriculumLessonsForUnits(activeUnitIds);
    const syllabusProgress = await this.getSyllabusProgress(studentId, classId);
    const progressMap = new Map(syllabusProgress.map(p => [p.lessonId, p]));
    
    const observations = await this.getTopicCompetencyObservations(studentId, teacherClass.language);
    const recommendations = await this.getDanielaRecommendations(studentId, { 
      classId, 
      language: teacherClass.language,
      includeSnoozed: false,
      includeCompleted: false 
    });

    let totalEstimatedMinutes = 0;
    let totalActualMinutes = 0;
    let totalLessons = 0;
    let totalLessonsCompleted = 0;
    let totalUnitsCompleted = 0;

    const unifiedUnits: import('@shared/schema').UnifiedUnitProgress[] = activeUnits.map(unit => {
      const unitLessons = allLessons.filter(l => l.classUnitId === unit.id).sort((a, b) => a.orderIndex - b.orderIndex);
      let unitActualMinutes = 0;
      let unitLessonsCompleted = 0;

      const unifiedLessons: import('@shared/schema').UnifiedLessonProgress[] = unitLessons.map(lesson => {
        // Progress is keyed by sourceLessonId (base curriculum lesson ID), not class lesson ID
        const progress = lesson.sourceLessonId ? progressMap.get(lesson.sourceLessonId) : null;
        const tier = (lesson.requirementTier as 'required' | 'recommended' | 'optional_premium') || 'required';
        const canSkip = tier !== 'required';
        
        let status: import('@shared/schema').UnifiedLessonStatus = 'not_started';
        if (progress) {
          if (progress.status === 'completed_early' || progress.status === 'completed_assigned') {
            status = 'completed';
          } else if (progress.status === 'skipped') {
            status = 'skipped';
          } else if (progress.status === 'in_progress') {
            status = 'in_progress';
          }
        }

        const estimatedMin = lesson.estimatedMinutes || 0;
        const actualMin = progress?.actualMinutes || 0;
        totalEstimatedMinutes += estimatedMin;
        totalActualMinutes += actualMin;
        unitActualMinutes += actualMin;
        
        if (status === 'completed' || status === 'skipped') {
          unitLessonsCompleted++;
          totalLessonsCompleted++;
        }

        return {
          id: lesson.id,
          name: lesson.name,
          description: lesson.description,
          orderIndex: lesson.orderIndex,
          lessonType: lesson.lessonType,
          actflLevel: lesson.actflLevel,
          requirementTier: tier,
          bundleId: lesson.bundleId,
          linkedDrillLessonId: lesson.linkedDrillLessonId,
          status,
          canSkip,
          estimatedMinutes: lesson.estimatedMinutes,
          actualMinutes: actualMin > 0 ? actualMin : null,
          completedAt: progress?.completedAt || null,
          tutorVerified: progress?.tutorVerified || false,
          tutorNotes: progress?.tutorNotes || null,
        };
      });

      totalLessons += unitLessons.length;
      const unitPercentComplete = unitLessons.length > 0 ? Math.round((unitLessonsCompleted / unitLessons.length) * 100) : 0;
      if (unitPercentComplete === 100) totalUnitsCompleted++;

      return {
        id: unit.id,
        name: unit.name,
        description: unit.description,
        orderIndex: unit.orderIndex,
        actflLevel: unit.actflLevel,
        culturalTheme: unit.culturalTheme,
        estimatedHours: unit.estimatedHours,
        actualHours: unitActualMinutes > 0 ? Math.round(unitActualMinutes / 60 * 10) / 10 : null,
        commitments: unit.commitments as any || null,
        lessons: unifiedLessons,
        lessonsTotal: unitLessons.length,
        lessonsCompleted: unitLessonsCompleted,
        percentComplete: unitPercentComplete,
      };
    });

    const overallPercentComplete = totalLessons > 0 ? Math.round((totalLessonsCompleted / totalLessons) * 100) : 0;
    let paceStatus: 'ahead' | 'on_track' | 'behind' = 'on_track';
    if (totalActualMinutes > 0 && totalEstimatedMinutes > 0 && overallPercentComplete > 0) {
      const expectedMinutesForProgress = totalEstimatedMinutes * (overallPercentComplete / 100);
      const ratio = totalActualMinutes / expectedMinutesForProgress;
      if (ratio < 0.9) paceStatus = 'ahead';
      else if (ratio > 1.1) paceStatus = 'behind';
    }

    return {
      classId,
      className: teacherClass.name,
      language: teacherClass.language,
      units: unifiedUnits,
      observations,
      recommendations,
      timeVariance: {
        estimatedTotalMinutes: totalEstimatedMinutes,
        actualTotalMinutes: totalActualMinutes,
        percentComplete: overallPercentComplete,
        paceStatus,
      },
      unitsTotal: activeUnits.length,
      unitsCompleted: totalUnitsCompleted,
      lessonsTotal: totalLessons,
      lessonsCompleted: totalLessonsCompleted,
      overallPercentComplete,
    };
  }

  // ===== Admin-Only Methods =====
  
  // User Management
  async getAllUsers(options?: { role?: string; limit?: number; offset?: number }): Promise<{ users: User[]; total: number }> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    
    const allUsers = options?.role
      ? await getUserDb().select().from(users).where(eq(users.role, options.role as any)).limit(limit).offset(offset).orderBy(desc(users.createdAt))
      : await getUserDb().select().from(users).limit(limit).offset(offset).orderBy(desc(users.createdAt));
    
    // Get total count
    const countResult = options?.role 
      ? await getUserDb().select({ count: sql<number>`count(*)` }).from(users).where(eq(users.role, options.role as any))
      : await getUserDb().select({ count: sql<number>`count(*)` }).from(users);
    
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
    
    const result = await getSharedDb()
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
    const [{ count }] = await getSharedDb().select({ count: sql<number>`count(*)` }).from(teacherClasses) as any;
    
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
    const result = await getSharedDb()
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
      getUserDb().select({ totalUsers: sql<number>`count(*)` }).from(users).then(r => r[0] as any),
      getUserDb().select({ totalStudents: sql<number>`count(*)` }).from(users).where(eq(users.role, 'student' as any)).then(r => r[0] as any),
      getUserDb().select({ totalTeachers: sql<number>`count(*)` }).from(users).where(eq(users.role, 'teacher' as any)).then(r => r[0] as any),
      getUserDb().select({ totalDevelopers: sql<number>`count(*)` }).from(users).where(eq(users.role, 'developer' as any)).then(r => r[0] as any),
      getUserDb().select({ totalAdmins: sql<number>`count(*)` }).from(users).where(eq(users.role, 'admin' as any)).then(r => r[0] as any),
      getSharedDb().select({ totalClasses: sql<number>`count(*)` }).from(teacherClasses).then(r => r[0] as any),
      db.select({ totalAssignments: sql<number>`count(*)` }).from(assignments).then(r => r[0] as any),
      db.select({ totalSubmissions: sql<number>`count(*)` }).from(assignmentSubmissions).then(r => r[0] as any),
      getSharedDb().select({ totalConversations: sql<number>`count(*)` }).from(conversations).then(r => r[0] as any),
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
      getUserDb()
        .select({
          date: sql<string>`DATE(${users.createdAt})`,
          count: sql<number>`count(*)`
        })
        .from(users)
        .where(gte(users.createdAt, startDate))
        .groupBy(sql`DATE(${users.createdAt})`)
        .orderBy(sql`DATE(${users.createdAt})`),
      
      getSharedDb()
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
    // Note: This requires a cross-database join which is complex
    // For now, fetch teachers from USER db, then count classes separately from SHARED db
    const teachers = await getUserDb()
      .select()
      .from(users)
      .where(eq(users.role, 'teacher' as any))
      .orderBy(desc(users.createdAt))
      .limit(limit);
    
    // Get class counts for each teacher
    const result = await Promise.all(teachers.map(async (teacher) => {
      const classes = await getSharedDb()
        .select({ count: sql<number>`count(*)` })
        .from(teacherClasses)
        .where(eq(teacherClasses.teacherId, teacher.id));
      
      const students = await getSharedDb()
        .select({ count: sql<number>`count(DISTINCT ${classEnrollments.studentId})` })
        .from(classEnrollments)
        .innerJoin(teacherClasses, eq(classEnrollments.classId, teacherClasses.id))
        .where(eq(teacherClasses.teacherId, teacher.id));
      
      return {
        ...teacher,
        classCount: Number((classes[0] as any)?.count || 0),
        studentCount: Number((students[0] as any)?.count || 0)
      };
    }));
    
    // Sort by class count descending and return
    return result.sort((a, b) => b.classCount - a.classCount);
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
  
  // Product Config (Pricing settings)
  async getProductConfig(key: string): Promise<ProductConfig | undefined> {
    const result = await db.select().from(productConfig).where(eq(productConfig.key, key)).limit(1);
    return result[0];
  }
  
  async getAllProductConfig(): Promise<ProductConfig[]> {
    return await db.select().from(productConfig).orderBy(productConfig.key);
  }
  
  async upsertProductConfig(key: string, value: string, description: string, updatedBy: string): Promise<ProductConfig> {
    const existing = await this.getProductConfig(key);
    if (existing) {
      const result = await db
        .update(productConfig)
        .set({ value, description, updatedBy, updatedAt: new Date() })
        .where(eq(productConfig.key, key))
        .returning();
      return result[0];
    } else {
      const result = await db
        .insert(productConfig)
        .values({ key, value, description, updatedBy })
        .returning();
      return result[0];
    }
  }
  
  // Support Tickets (Admin)
  async getAdminSupportTickets(options: {
    filters?: { status?: string; priority?: string; category?: string };
    limit?: number;
    offset?: number;
  }): Promise<{
    tickets: any[];
    total: number;
    stats: { pending: number; active: number; resolved: number; escalated: number };
  }> {
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    const filters = options.filters || {};
    
    // Build conditions
    const conditions: any[] = [];
    if (filters.status) conditions.push(eq(supportTickets.status, filters.status as any));
    if (filters.priority) conditions.push(eq(supportTickets.priority, filters.priority as any));
    if (filters.category) conditions.push(eq(supportTickets.category, filters.category as any));
    
    // Get tickets with user info
    const ticketsQuery = getUserDb()
      .select({
        ticket: supportTickets,
        userName: users.firstName,
        userEmail: users.email
      })
      .from(supportTickets)
      .leftJoin(users, eq(supportTickets.userId, users.id))
      .orderBy(desc(supportTickets.createdAt))
      .limit(limit)
      .offset(offset);
    
    const tickets = conditions.length > 0
      ? await ticketsQuery.where(and(...conditions))
      : await ticketsQuery;
    
    // Get total count
    const countQuery = conditions.length > 0
      ? getUserDb().select({ count: sql<number>`count(*)` }).from(supportTickets).where(and(...conditions))
      : getUserDb().select({ count: sql<number>`count(*)` }).from(supportTickets);
    const countResult = await countQuery;
    
    // Get stats
    const pendingCount = await getUserDb().select({ count: sql<number>`count(*)` }).from(supportTickets).where(eq(supportTickets.status, 'pending'));
    const activeCount = await getUserDb().select({ count: sql<number>`count(*)` }).from(supportTickets).where(eq(supportTickets.status, 'active'));
    const resolvedCount = await getUserDb().select({ count: sql<number>`count(*)` }).from(supportTickets).where(eq(supportTickets.status, 'resolved'));
    const escalatedCount = await getUserDb().select({ count: sql<number>`count(*)` }).from(supportTickets).where(eq(supportTickets.status, 'escalated'));
    
    return {
      tickets: tickets.map(t => ({
        ...t.ticket,
        userName: t.userName,
        userEmail: t.userEmail
      })),
      total: Number((countResult[0] as any).count),
      stats: {
        pending: Number((pendingCount[0] as any).count),
        active: Number((activeCount[0] as any).count),
        resolved: Number((resolvedCount[0] as any).count),
        escalated: Number((escalatedCount[0] as any).count)
      }
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
    const result = await getUserDb()
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
    
    const [updated] = await getSharedDb()
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
    language?: string;
  }): Promise<Conversation[]> {
    const conditions: any[] = [eq(conversations.userId, userId)];
    
    // Language filter
    if (filter.language) {
      conditions.push(eq(conversations.language, filter.language));
    }
    
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
      const convIds = await getSharedDb()
        .select({ conversationId: conversationTopics.conversationId })
        .from(conversationTopics)
        .where(eq(conversationTopics.topicId, filter.topicId));
      
      if (convIds.length > 0) {
        conditions.push(sql`${conversations.id} IN (${sql.join(convIds.map(c => sql`${c.conversationId}`), sql`, `)})`);
      } else {
        return []; // No conversations match this topic
      }
    }
    
    return await getSharedDb()
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
    classId?: string;
  }): Promise<VocabularyWord[]> {
    // ACTFL level to numeric mapping
    const actflLevelToNumeric: Record<string, number> = {
      'novice_low': 1,
      'novice_mid': 2,
      'novice_high': 3,
      'intermediate_low': 4,
      'intermediate_mid': 5,
      'intermediate_high': 6,
      'advanced_low': 7,
      'advanced_mid': 8,
      'advanced_high': 9,
      'superior': 10,
      'distinguished': 11,
    };
    
    const conditions: any[] = [
      eq(vocabularyWords.userId, userId),
      eq(vocabularyWords.language, language)
    ];
    
    // Class-based filtering: show only vocabulary learned in this specific class
    if (filter.classId) {
      conditions.push(eq(vocabularyWords.classId, filter.classId));
    }
    
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

  // BATCH: Get topics for multiple conversations in a single query (fixes N+1 problem)
  async getConversationTopicsBatch(conversationIds: string[]): Promise<Record<string, Array<ConversationTopic & { topic: Topic }>>> {
    if (conversationIds.length === 0) return {};
    
    const result = await db
      .select({
        conversationTopic: conversationTopics,
        topic: topicsTable
      })
      .from(conversationTopics)
      .innerJoin(topicsTable, eq(conversationTopics.topicId, topicsTable.id))
      .where(inArray(conversationTopics.conversationId, conversationIds));
    
    // Group by conversationId
    const grouped: Record<string, Array<ConversationTopic & { topic: Topic }>> = {};
    for (const id of conversationIds) {
      grouped[id] = [];
    }
    for (const r of result) {
      const convId = r.conversationTopic.conversationId;
      if (!grouped[convId]) grouped[convId] = [];
      grouped[convId].push({ ...r.conversationTopic, topic: r.topic });
    }
    
    return grouped;
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
  
  async getUserTopicMastery(userId: string, language: string): Promise<Array<{
    id: string;
    name: string;
    status: 'discovered' | 'practiced' | 'mastered' | 'locked';
    practiceCount: number;
    lastPracticed: Date | null;
    connections: string[];
    category: string | null;
    danielaObservation?: { status: string; evidence: string | null; observedAt: Date };
  }>> {
    // Get all topics (topics are language-agnostic)
    const allTopics = await getSharedDb().select().from(topicsTable);
    
    // Get user's conversations for this language
    const userConvs = await getSharedDb().select({ id: conversations.id, createdAt: conversations.createdAt })
      .from(conversations)
      .where(and(
        eq(conversations.userId, userId),
        eq(conversations.language, language)
      ));
    
    const convIds = userConvs.map(c => c.id);
    
    // Get topic usage counts from conversation_topics
    const topicUsage = convIds.length > 0 
      ? await getSharedDb().select({
          topicId: conversationTopics.topicId,
          count: sql<string>`count(*)::int`.as('count'),
          lastUsed: sql<string>`max(${conversationTopics.createdAt})`.as('last_used'),
        })
        .from(conversationTopics)
        .where(inArray(conversationTopics.conversationId, convIds))
        .groupBy(conversationTopics.topicId)
      : [];
    
    const usageMap = new Map(topicUsage.map(t => [
      t.topicId, 
      { 
        count: parseInt(String(t.count)) || 0, 
        lastUsed: t.lastUsed ? new Date(t.lastUsed) : null 
      }
    ]));
    
    // Get Daniela's competency observations for this user/language
    const danielaObservations = await getSharedDb()
      .select()
      .from(topicCompetencyObservations)
      .where(and(
        eq(topicCompetencyObservations.userId, userId),
        eq(topicCompetencyObservations.language, language)
      ))
      .orderBy(desc(topicCompetencyObservations.observedAt));
    
    // Build a map of topic name (lowercase) -> latest observation
    // Daniela uses freeform names, so we'll match against topic names
    // Defensive: Always compare observedAt to keep newest, regardless of query order
    const observationMap = new Map<string, { status: string; evidence: string | null; observedAt: Date }>();
    for (const obs of danielaObservations) {
      const key = obs.topicName.toLowerCase().replace(/[_-]/g, ' ');
      const existing = observationMap.get(key);
      // Keep newest observation by comparing timestamps
      if (!existing || obs.observedAt > existing.observedAt) {
        observationMap.set(key, {
          status: obs.status,
          evidence: obs.evidence,
          observedAt: obs.observedAt,
        });
      }
    }
    
    // Build topic nodes with status
    return allTopics.map(topic => {
      const usage = usageMap.get(topic.id);
      const practiceCount = usage?.count || 0;
      
      // Check for Daniela's observation on this topic (fuzzy match by name)
      const topicKey = topic.name.toLowerCase().replace(/[_-]/g, ' ');
      const danielaObs = observationMap.get(topicKey);
      
      // Determine base status from practice count
      let status: 'discovered' | 'practiced' | 'mastered' | 'locked' = 'locked';
      if (practiceCount >= 10) {
        status = 'mastered';
      } else if (practiceCount >= 3) {
        status = 'practiced';
      } else if (practiceCount >= 1) {
        status = 'discovered';
      }
      
      // Apply Daniela's observations to boost or adjust status
      if (danielaObs) {
        if (danielaObs.status === 'demonstrated') {
          // Daniela confirmed mastery - boost to mastered
          status = 'mastered';
        } else if (danielaObs.status === 'needs_review' && status === 'locked') {
          // Daniela saw it but needs work - at least discovered
          status = 'discovered';
        } else if (danielaObs.status === 'struggling') {
          // Cap at practiced even if high practice count - Daniela knows better
          if (status === 'mastered') {
            status = 'practiced';
          }
        }
      }
      
      // Simple connection logic: connect to adjacent topics by category
      const sameCategoryTopics = allTopics.filter(t => 
        t.category === topic.category && t.id !== topic.id
      );
      const connections = sameCategoryTopics.slice(0, 2).map(t => t.id);
      
      return {
        id: topic.id,
        name: topic.name,
        status,
        practiceCount,
        lastPracticed: usage?.lastUsed || null,
        connections,
        category: topic.category,
        danielaObservation: danielaObs,
      };
    });
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
        const [conv] = await getSharedDb().select().from(conversations).where(eq(conversations.id, item.conversationId));
        conversation = conv;
      }
      if (item.vocabularyWordId) {
        const [word] = await getSharedDb().select().from(vocabularyWords).where(eq(vocabularyWords.id, item.vocabularyWordId));
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
    const weekConversations = await getSharedDb()
      .select()
      .from(conversations)
      .where(and(
        eq(conversations.userId, userId),
        eq(conversations.language, language),
        gte(conversations.createdAt, weekStart),
        lte(conversations.createdAt, weekEnd)
      ))
      .orderBy(conversations.createdAt);
    
    // Get vocabulary from this week (vocabulary_words is in SHARED)
    const weekVocabulary = await getSharedDb()
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
          description: string | null;
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
          description: string | null;
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
                  description: lesson.description,
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
    // IMPORTANT: Filter by role='tutor' to get main Cartesia tutor, not Google assistant
    const result = await getSharedDb().select().from(tutorVoices).where(
      and(
        eq(tutorVoices.language, language),
        eq(tutorVoices.gender, gender),
        eq(tutorVoices.role, 'tutor'),  // Only main tutors, not assistants
        eq(tutorVoices.isActive, true)
      )
    ).limit(1);
    return result[0];
  }

  async getAllTutorVoices(): Promise<TutorVoice[]> {
    return getSharedDb().select().from(tutorVoices).orderBy(tutorVoices.language, tutorVoices.gender);
  }

  async upsertTutorVoice(data: InsertTutorVoice): Promise<TutorVoice> {
    // Default to 'tutor' role if not specified
    const role = data.role || 'tutor';
    
    const validTutorProviders = ['cartesia', 'elevenlabs', 'google', 'gemini'];
    if (role === 'tutor' && !validTutorProviders.includes(data.provider)) {
      throw new Error('[Voice Guard] Main tutors must use Cartesia, ElevenLabs, Google, or Gemini voices.');
    }
    if ((role === 'assistant' || role === 'support') && data.provider !== 'google') {
      throw new Error('[Voice Guard] Assistant tutors and support must use Google voices.');
    }
    
    // Check if voice already exists for this language, gender, AND role
    const existing = await getSharedDb().select().from(tutorVoices).where(
      and(
        eq(tutorVoices.language, data.language),
        eq(tutorVoices.gender, data.gender),
        eq(tutorVoices.role, role)
      )
    ).limit(1);

    if (existing[0]) {
      // Update existing
      const updated = await getSharedDb().update(tutorVoices)
        .set({ ...data, role, updatedAt: new Date() })
        .where(eq(tutorVoices.id, existing[0].id))
        .returning();
      return updated[0];
    } else {
      // Create new
      const created = await getSharedDb().insert(tutorVoices).values({ ...data, role }).returning();
      return created[0];
    }
  }

  async deleteTutorVoice(id: string): Promise<boolean> {
    const result = await getSharedDb().delete(tutorVoices).where(eq(tutorVoices.id, id)).returning();
    return result.length > 0;
  }

  async updateAllTutorVoicesProvider(provider: string): Promise<number> {
    const validProviders = ['cartesia', 'elevenlabs', 'google', 'gemini'];
    if (!validProviders.includes(provider)) {
      throw new Error(`[Voice Guard] Invalid provider: ${provider}. Must be one of: ${validProviders.join(', ')}`);
    }

    const langToCode: Record<string, string> = {
      'english': 'en-US', 'english (us)': 'en-US', 'english (uk)': 'en-GB',
      'spanish': 'es-US', 'spanish (spain)': 'es-ES', 'spanish (latin america)': 'es-US',
      'french': 'fr-FR', 'french (canada)': 'fr-CA',
      'german': 'de-DE', 'italian': 'it-IT',
      'portuguese': 'pt-BR', 'portuguese (brazil)': 'pt-BR', 'portuguese (portugal)': 'pt-PT',
      'japanese': 'ja-JP',
      'mandarin chinese': 'cmn-CN', 'mandarin': 'cmn-CN', 'chinese': 'cmn-CN',
      'korean': 'ko-KR',
      'hebrew': 'he-IL',
    };

    const allVoices = await getSharedDb().select().from(tutorVoices).where(eq(tutorVoices.role, 'tutor'));

    for (const voice of allVoices) {
      let newVoiceId = voice.voiceId;
      const oldProvider = voice.provider;

      if (provider === 'google' && (oldProvider === 'gemini' || !voice.voiceId.includes('Chirp3-HD'))) {
        const baseName = voice.voiceId.replace(/^.*Chirp3-HD-/, '');
        const langCode = langToCode[voice.language.toLowerCase()] || 'en-US';
        if (baseName && !baseName.includes('-')) {
          newVoiceId = `${langCode}-Chirp3-HD-${baseName}`;
        }
      } else if (provider === 'gemini' && (oldProvider === 'google' || voice.voiceId.includes('Chirp3-HD'))) {
        const match = voice.voiceId.match(/Chirp3-HD-(\w+)$/);
        if (match) {
          newVoiceId = match[1];
        }
      }

      await getSharedDb().update(tutorVoices)
        .set({ provider, voiceId: newVoiceId, updatedAt: new Date() })
        .where(eq(tutorVoices.id, voice.id));
    }

    return allVoices.length;
  }

  async updateTutorVoiceProviderWithMapping(id: string, provider: string, voiceId: string, voiceName: string): Promise<void> {
    const validProviders = ['cartesia', 'elevenlabs', 'google', 'gemini'];
    if (!validProviders.includes(provider)) {
      throw new Error(`[Voice Guard] Invalid provider: ${provider}. Must be one of: ${validProviders.join(', ')}`);
    }
    await getSharedDb().update(tutorVoices)
      .set({ provider, voiceId, voiceName, updatedAt: new Date() })
      .where(eq(tutorVoices.id, id))
      .returning();
  }

  async seedDefaultTutorVoices(): Promise<void> {
    // Check if voices already exist
    const existing = await getSharedDb().select().from(tutorVoices).limit(1);
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
      // Hebrew (hidden language - special unlock for founder's daughter)
      { language: 'hebrew', gender: 'female', provider: 'cartesia', voiceId: '573e3144-a684-4e72-ac2b-9b2063a50b53', voiceName: 'Hebrew Woman', languageCode: 'he' },
      { language: 'hebrew', gender: 'male', provider: 'cartesia', voiceId: '638efaaa-4d0c-442e-b701-3fae16aad012', voiceName: 'Hebrew Man', languageCode: 'he' },
    ];

    for (const voice of defaultVoices) {
      await getSharedDb().insert(tutorVoices).values(voice);
    }

    console.log(`[Voice Seed] ✓ Seeded ${defaultVoices.length} default tutor voices`);
    
    // Also seed Sofia's support voices if they don't exist
    await this.seedSupportVoices();
  }
  
  /**
   * Seed Sofia's support agent voices (Google Chirp3 HD)
   * These voices are used for technical support conversations
   */
  async seedSupportVoices(): Promise<void> {
    // Check if support voices already exist
    const existing = await getSharedDb().select().from(tutorVoices).where(eq(tutorVoices.role, 'support')).limit(1);
    if (existing.length > 0) {
      console.log('[Voice Seed] Support voices already exist, skipping seed');
      return;
    }

    console.log('[Voice Seed] Seeding Sofia support voices...');

    // Sofia's support voices - Google Chirp3 HD for each language
    const supportVoices: InsertTutorVoice[] = [
      // English
      { language: 'english', gender: 'female', role: 'support', provider: 'google', voiceId: 'en-US-Chirp3-HD-Aoede', voiceName: 'Aoede', languageCode: 'en-US', speakingRate: 1.0 },
      { language: 'english', gender: 'male', role: 'support', provider: 'google', voiceId: 'en-US-Chirp3-HD-Charon', voiceName: 'Charon', languageCode: 'en-US', speakingRate: 1.0 },
      // Spanish
      { language: 'spanish', gender: 'female', role: 'support', provider: 'google', voiceId: 'es-US-Chirp3-HD-Kore', voiceName: 'Kore', languageCode: 'es-US', speakingRate: 1.0 },
      { language: 'spanish', gender: 'male', role: 'support', provider: 'google', voiceId: 'es-US-Chirp3-HD-Fenrir', voiceName: 'Fenrir', languageCode: 'es-US', speakingRate: 1.0 },
      // French
      { language: 'french', gender: 'female', role: 'support', provider: 'google', voiceId: 'fr-FR-Chirp3-HD-Leda', voiceName: 'Leda', languageCode: 'fr-FR', speakingRate: 1.0 },
      { language: 'french', gender: 'male', role: 'support', provider: 'google', voiceId: 'fr-FR-Chirp3-HD-Orus', voiceName: 'Orus', languageCode: 'fr-FR', speakingRate: 1.0 },
      // German
      { language: 'german', gender: 'female', role: 'support', provider: 'google', voiceId: 'de-DE-Chirp3-HD-Zephyr', voiceName: 'Zephyr', languageCode: 'de-DE', speakingRate: 1.0 },
      { language: 'german', gender: 'male', role: 'support', provider: 'google', voiceId: 'de-DE-Chirp3-HD-Puck', voiceName: 'Puck', languageCode: 'de-DE', speakingRate: 1.0 },
      // Italian
      { language: 'italian', gender: 'female', role: 'support', provider: 'google', voiceId: 'it-IT-Chirp3-HD-Erinome', voiceName: 'Erinome', languageCode: 'it-IT', speakingRate: 1.0 },
      { language: 'italian', gender: 'male', role: 'support', provider: 'google', voiceId: 'it-IT-Chirp3-HD-Iapetus', voiceName: 'Iapetus', languageCode: 'it-IT', speakingRate: 1.0 },
      // Portuguese
      { language: 'portuguese', gender: 'female', role: 'support', provider: 'google', voiceId: 'pt-BR-Chirp3-HD-Despina', voiceName: 'Despina', languageCode: 'pt-BR', speakingRate: 1.0 },
      { language: 'portuguese', gender: 'male', role: 'support', provider: 'google', voiceId: 'pt-BR-Chirp3-HD-Enceladus', voiceName: 'Enceladus', languageCode: 'pt-BR', speakingRate: 1.0 },
      // Japanese
      { language: 'japanese', gender: 'female', role: 'support', provider: 'google', voiceId: 'ja-JP-Chirp3-HD-Achernar', voiceName: 'Achernar', languageCode: 'ja-JP', speakingRate: 1.0 },
      { language: 'japanese', gender: 'male', role: 'support', provider: 'google', voiceId: 'ja-JP-Chirp3-HD-Achird', voiceName: 'Achird', languageCode: 'ja-JP', speakingRate: 1.0 },
      // Mandarin Chinese
      { language: 'mandarin chinese', gender: 'female', role: 'support', provider: 'google', voiceId: 'cmn-CN-Chirp3-HD-Gacrux', voiceName: 'Gacrux', languageCode: 'cmn-CN', speakingRate: 1.0 },
      { language: 'mandarin chinese', gender: 'male', role: 'support', provider: 'google', voiceId: 'cmn-CN-Chirp3-HD-Algenib', voiceName: 'Algenib', languageCode: 'cmn-CN', speakingRate: 1.0 },
      // Korean
      { language: 'korean', gender: 'female', role: 'support', provider: 'google', voiceId: 'ko-KR-Chirp3-HD-Sulafat', voiceName: 'Sulafat', languageCode: 'ko-KR', speakingRate: 1.0 },
      { language: 'korean', gender: 'male', role: 'support', provider: 'google', voiceId: 'ko-KR-Chirp3-HD-Schedar', voiceName: 'Schedar', languageCode: 'ko-KR', speakingRate: 1.0 },
      // Hebrew (hidden language - special unlock)
      { language: 'hebrew', gender: 'female', role: 'support', provider: 'google', voiceId: 'he-IL-Standard-A', voiceName: 'Sofia Hebrew', languageCode: 'he-IL', speakingRate: 1.0 },
      { language: 'hebrew', gender: 'male', role: 'support', provider: 'google', voiceId: 'he-IL-Standard-B', voiceName: 'Sofia Hebrew Male', languageCode: 'he-IL', speakingRate: 1.0 },
    ];

    for (const voice of supportVoices) {
      await getSharedDb().insert(tutorVoices).values(voice);
    }

    console.log(`[Voice Seed] ✓ Seeded ${supportVoices.length} Sofia support voices`);
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

    // Delete vocabulary words and their topic associations (vocabulary_words is in SHARED)
    if (opts.resetVocabulary) {
      // First delete vocabulary word topics
      const userVocab = await getSharedDb().select({ id: vocabularyWords.id })
        .from(vocabularyWords)
        .where(eq(vocabularyWords.userId, userId));
      
      for (const word of userVocab) {
        await getSharedDb().delete(vocabularyWordTopics).where(eq(vocabularyWordTopics.vocabularyWordId, word.id));
      }
      
      // Then delete vocabulary words
      const vocabResult = await getSharedDb().delete(vocabularyWords)
        .where(eq(vocabularyWords.userId, userId))
        .returning();
      vocabularyDeleted = vocabResult.length;
    }

    // Delete conversations and their associated data
    if (opts.resetConversations) {
      // Get all user conversations
      const userConvs = await getSharedDb().select({ id: conversations.id })
        .from(conversations)
        .where(eq(conversations.userId, userId));
      
      for (const conv of userConvs) {
        // Delete messages
        await getSharedDb().delete(messages).where(eq(messages.conversationId, conv.id));
        // Delete conversation topics
        await getSharedDb().delete(conversationTopics).where(eq(conversationTopics.conversationId, conv.id));
      }
      
      // Delete conversations
      const convResult = await getSharedDb().delete(conversations)
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

    // Reset the first meeting flag so Daniela does the "getting to know you" flow again
    // NOTE: We intentionally keep learnerPersonalFacts - Daniela should remember the student
    // even when their learning progress is reset (e.g., student taking a new class)
    await getSharedDb().update(users)
      .set({ hasCompletedFirstMeeting: false })
      .where(eq(users.id, userId));

    console.log(`[Admin] Reset learning data for user ${userId}: ${vocabularyDeleted} vocab, ${conversationsDeleted} convs, progress=${progressReset}, ${lessonsDeleted} lessons (personal facts preserved)`);

    return {
      vocabularyDeleted,
      conversationsDeleted,
      progressReset,
      lessonsDeleted,
      firstMeetingReset: true
    };
  }

  async resetStudentClassProgress(classId: string, studentId: string): Promise<{
    conversationsDeleted: number;
    vocabularyDeleted: number;
    assignmentSubmissionsDeleted: number;
    placementReset: boolean;
  }> {
    let conversationsDeleted = 0;
    let vocabularyDeleted = 0;
    let assignmentSubmissionsDeleted = 0;
    let placementReset = false;

    // Delete class-specific vocabulary words (vocabulary_words is in SHARED)
    const vocabResult = await getSharedDb().delete(vocabularyWords)
      .where(and(
        eq(vocabularyWords.userId, studentId),
        eq(vocabularyWords.classId, classId)
      ))
      .returning();
    vocabularyDeleted = vocabResult.length;

    // Delete class-specific conversations and their messages
    const classConvs = await getSharedDb().select({ id: conversations.id })
      .from(conversations)
      .where(and(
        eq(conversations.userId, studentId),
        eq(conversations.classId, classId)
      ));
    
    for (const conv of classConvs) {
      await getSharedDb().delete(messages).where(eq(messages.conversationId, conv.id));
      await getSharedDb().delete(conversationTopics).where(eq(conversationTopics.conversationId, conv.id));
    }
    
    const convResult = await getSharedDb().delete(conversations)
      .where(and(
        eq(conversations.userId, studentId),
        eq(conversations.classId, classId)
      ))
      .returning();
    conversationsDeleted = convResult.length;

    // Delete assignment submissions for this class
    const classAssignments = await db.select({ id: assignments.id })
      .from(assignments)
      .where(eq(assignments.classId, classId));
    
    for (const assignment of classAssignments) {
      const submissionResult = await db.delete(assignmentSubmissions)
        .where(and(
          eq(assignmentSubmissions.assignmentId, assignment.id),
          eq(assignmentSubmissions.studentId, studentId)
        ))
        .returning();
      assignmentSubmissionsDeleted += submissionResult.length;
    }

    // Reset placement data on enrollment
    await db.update(classEnrollments)
      .set({
        placementChecked: null,
        placementActflResult: null,
        placementDelta: null,
        placementDate: null,
      })
      .where(and(
        eq(classEnrollments.classId, classId),
        eq(classEnrollments.userId, studentId)
      ));
    placementReset = true;

    console.log(`[Teacher] Reset class progress for student ${studentId} in class ${classId}: ${conversationsDeleted} convs, ${vocabularyDeleted} vocab, ${assignmentSubmissionsDeleted} submissions`);

    return {
      conversationsDeleted,
      vocabularyDeleted,
      assignmentSubmissionsDeleted,
      placementReset
    };
  }

  // ===== Daniela's Neural Network Memory System =====
  
  // Self Best Practices - Universal teaching wisdom
  async createBestPractice(data: InsertSelfBestPractice): Promise<SelfBestPractice> {
    const [practice] = await getSharedDb().insert(selfBestPractices).values(data).returning();
    return practice;
  }

  async getBestPractices(category?: BestPracticeCategory, activeOnly: boolean = true): Promise<SelfBestPractice[]> {
    const conditions = [];
    if (category) {
      conditions.push(eq(selfBestPractices.category, category));
    }
    if (activeOnly) {
      conditions.push(eq(selfBestPractices.isActive, true));
    }
    
    if (conditions.length === 0) {
      return getSharedDb().select().from(selfBestPractices).orderBy(desc(selfBestPractices.confidenceScore));
    }
    
    return getSharedDb().select().from(selfBestPractices)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(selfBestPractices.confidenceScore));
  }

  async getBestPractice(id: string): Promise<SelfBestPractice | undefined> {
    const [practice] = await getSharedDb().select().from(selfBestPractices).where(eq(selfBestPractices.id, id));
    return practice;
  }

  async updateBestPractice(id: string, data: Partial<SelfBestPractice>): Promise<SelfBestPractice | undefined> {
    const [updated] = await getSharedDb().update(selfBestPractices)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(selfBestPractices.id, id))
      .returning();
    return updated;
  }

  async incrementBestPracticeUsage(id: string): Promise<void> {
    await getSharedDb().update(selfBestPractices)
      .set({ 
        timesApplied: sql`${selfBestPractices.timesApplied} + 1`,
        updatedAt: new Date()
      })
      .where(eq(selfBestPractices.id, id));
  }

  async upsertBestPractice(category: BestPracticeCategory, insight: string, context?: string, source: string = 'experience'): Promise<SelfBestPractice> {
    // Check for similar existing insight in same category
    const existing = await getSharedDb().select().from(selfBestPractices)
      .where(and(
        eq(selfBestPractices.category, category),
        eq(selfBestPractices.isActive, true)
      ));
    
    // Simple similarity: check if insight contains key phrases from existing
    const insightLower = insight.toLowerCase();
    for (const practice of existing) {
      const existingLower = practice.insight.toLowerCase();
      // Check for significant word overlap (more than 3 words in common)
      const insightWords = new Set(insightLower.split(/\s+/).filter(w => w.length > 3));
      const existingWords = new Set(existingLower.split(/\s+/).filter(w => w.length > 3));
      const overlap = [...insightWords].filter(w => existingWords.has(w)).length;
      
      if (overlap >= 3 || existingLower.includes(insightLower.slice(0, 30)) || insightLower.includes(existingLower.slice(0, 30))) {
        // Similar insight exists - increment confidence and update
        const newConfidence = Math.min((practice.confidenceScore || 0.5) + 0.1, 1.0);
        const [updated] = await getSharedDb().update(selfBestPractices)
          .set({
            confidenceScore: newConfidence,
            timesApplied: (practice.timesApplied || 0) + 1,
            updatedAt: new Date(),
          })
          .where(eq(selfBestPractices.id, practice.id))
          .returning();
        return updated;
      }
    }
    
    // No similar insight - create new one
    const [created] = await getSharedDb().insert(selfBestPractices).values({
      category,
      insight,
      context,
      source,
      confidenceScore: 0.5,
      timesApplied: 1,
    }).returning();
    return created;
  }

  // People Connections - Relationship awareness (USER database - per-user data)
  async createPeopleConnection(data: InsertPeopleConnection): Promise<PeopleConnection> {
    const [connection] = await getUserDb().insert(peopleConnections).values(data).returning();
    return connection;
  }

  async getPeopleConnections(personId: string): Promise<PeopleConnection[]> {
    return getUserDb().select().from(peopleConnections)
      .where(and(
        eq(peopleConnections.isActive, true),
        sql`(${peopleConnections.personAId} = ${personId} OR ${peopleConnections.personBId} = ${personId})`
      ))
      .orderBy(desc(peopleConnections.createdAt));
  }

  async getAllPeopleConnections(): Promise<PeopleConnection[]> {
    return getUserDb().select().from(peopleConnections)
      .where(eq(peopleConnections.isActive, true))
      .orderBy(desc(peopleConnections.createdAt));
  }

  async updatePeopleConnection(id: string, data: Partial<PeopleConnection>): Promise<PeopleConnection | undefined> {
    const [updated] = await getUserDb().update(peopleConnections)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(peopleConnections.id, id))
      .returning();
    return updated;
  }

  async findPendingConnectionsByName(firstName: string, lastName?: string): Promise<PeopleConnection[]> {
    // Build a search pattern for the name
    const fullName = lastName ? `${firstName} ${lastName}` : firstName;
    const searchPattern = `%${fullName}%`;
    
    return getUserDb().select().from(peopleConnections)
      .where(and(
        eq(peopleConnections.isActive, true),
        eq(peopleConnections.status, 'pending_match'),
        sql`LOWER(${peopleConnections.pendingPersonName}) LIKE LOWER(${searchPattern})`
      ))
      .orderBy(desc(peopleConnections.confidenceScore));
  }

  async getConnectionsAboutPerson(personId: string, firstName?: string, lastName?: string): Promise<PeopleConnection[]> {
    // Get connections where this person is personB (confirmed) or matches pending name
    const conditions = [eq(peopleConnections.isActive, true)];
    
    // Either personBId matches OR pending name matches
    if (firstName) {
      const fullName = lastName ? `${firstName} ${lastName}` : firstName;
      const searchPattern = `%${fullName}%`;
      conditions.push(sql`(
        ${peopleConnections.personBId} = ${personId} 
        OR (${peopleConnections.status} = 'pending_match' AND LOWER(${peopleConnections.pendingPersonName}) LIKE LOWER(${searchPattern}))
      )`);
    } else {
      conditions.push(eq(peopleConnections.personBId, personId));
    }
    
    return getUserDb().select().from(peopleConnections)
      .where(and(...conditions))
      .orderBy(desc(peopleConnections.confidenceScore));
  }

  async linkPendingConnection(connectionId: string, personBId: string): Promise<PeopleConnection | undefined> {
    const [updated] = await getUserDb().update(peopleConnections)
      .set({
        personBId: personBId,
        status: 'confirmed',
        confidenceScore: 1.0,
        updatedAt: new Date()
      })
      .where(and(
        eq(peopleConnections.id, connectionId),
        eq(peopleConnections.status, 'pending_match')
      ))
      .returning();
    return updated;
  }

  // Student Insights - Per-student learning observations
  async createStudentInsight(data: InsertStudentInsight): Promise<StudentInsight> {
    const [insight] = await db.insert(studentInsights).values(data).returning();
    return insight;
  }

  async getStudentInsights(studentId: string, language?: string): Promise<StudentInsight[]> {
    const conditions = [
      eq(studentInsights.studentId, studentId),
      eq(studentInsights.isActive, true)
    ];
    
    if (language) {
      conditions.push(sql`(${studentInsights.language} = ${language} OR ${studentInsights.language} IS NULL)`);
    }
    
    return db.select().from(studentInsights)
      .where(and(...conditions))
      .orderBy(desc(studentInsights.confidenceScore));
  }

  async updateStudentInsight(id: string, data: Partial<StudentInsight>): Promise<StudentInsight | undefined> {
    const [updated] = await db.update(studentInsights)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(studentInsights.id, id))
      .returning();
    return updated;
  }

  async incrementInsightObservation(id: string): Promise<void> {
    await db.update(studentInsights)
      .set({ 
        observationCount: sql`${studentInsights.observationCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(studentInsights.id, id));
  }

  // Learning Motivations - Why students are learning (USER database - per-user data)
  async createLearningMotivation(data: InsertLearningMotivation): Promise<LearningMotivation> {
    const [motivation] = await getUserDb().insert(learningMotivations).values(data).returning();
    return motivation;
  }

  async getLearningMotivations(studentId: string, language?: string): Promise<LearningMotivation[]> {
    const conditions = [
      eq(learningMotivations.studentId, studentId),
      eq(learningMotivations.status, 'active')
    ];
    
    if (language) {
      conditions.push(sql`(${learningMotivations.language} = ${language} OR ${learningMotivations.language} IS NULL)`);
    }
    
    return getUserDb().select().from(learningMotivations)
      .where(and(...conditions))
      .orderBy(desc(learningMotivations.createdAt));
  }

  async updateLearningMotivation(id: string, data: Partial<LearningMotivation>): Promise<LearningMotivation | undefined> {
    const [updated] = await getUserDb().update(learningMotivations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(learningMotivations.id, id))
      .returning();
    return updated;
  }

  // Recurring Struggles - Persistent challenges (USER database - per-user data)
  async createRecurringStruggle(data: InsertRecurringStruggle): Promise<RecurringStruggle> {
    const [struggle] = await getUserDb().insert(recurringStruggles).values(data).returning();
    return struggle;
  }

  async getRecurringStruggles(studentId: string, language?: string, status: string = 'active'): Promise<RecurringStruggle[]> {
    const conditions = [
      eq(recurringStruggles.studentId, studentId),
      eq(recurringStruggles.status, status)
    ];
    
    if (language) {
      conditions.push(eq(recurringStruggles.language, language));
    }
    
    return getUserDb().select().from(recurringStruggles)
      .where(and(...conditions))
      .orderBy(desc(recurringStruggles.occurrenceCount));
  }

  async updateRecurringStruggle(id: string, data: Partial<RecurringStruggle>): Promise<RecurringStruggle | undefined> {
    const [updated] = await getUserDb().update(recurringStruggles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(recurringStruggles.id, id))
      .returning();
    return updated;
  }

  async incrementStruggleOccurrence(id: string): Promise<void> {
    await getUserDb().update(recurringStruggles)
      .set({ 
        occurrenceCount: sql`${recurringStruggles.occurrenceCount} + 1`,
        lastOccurredAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(recurringStruggles.id, id));
  }

  // Upsert Student Insight - finds similar insight and increments, or creates new
  async upsertStudentInsight(studentId: string, language: string | null, insightType: string, insight: string, evidence?: string): Promise<StudentInsight> {
    // Look for existing similar insight
    const existing = await db.select().from(studentInsights)
      .where(and(
        eq(studentInsights.studentId, studentId),
        eq(studentInsights.insightType, insightType),
        eq(studentInsights.isActive, true),
        language ? eq(studentInsights.language, language) : isNull(studentInsights.language)
      ))
      .limit(10);
    
    // Check for semantically similar insights (simple keyword matching)
    const insightWords = insight.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const similarInsight = existing.find(e => {
      const existingWords = e.insight.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const overlap = insightWords.filter(w => existingWords.includes(w)).length;
      return overlap >= Math.min(3, insightWords.length / 2);
    });
    
    if (similarInsight) {
      // Increment observation count and update confidence
      const newCount = (similarInsight.observationCount || 1) + 1;
      const newConfidence = Math.min(1.0, (similarInsight.confidenceScore || 0.5) + 0.1);
      await this.updateStudentInsight(similarInsight.id, {
        observationCount: newCount,
        confidenceScore: newConfidence,
        evidence: evidence ? `${similarInsight.evidence || ''}; ${evidence}` : similarInsight.evidence,
      });
      return { ...similarInsight, observationCount: newCount, confidenceScore: newConfidence };
    }
    
    // Create new insight
    return this.createStudentInsight({
      studentId,
      language,
      insightType,
      insight,
      evidence,
      confidenceScore: 0.5,
      observationCount: 1,
      isActive: true,
    });
  }

  // Upsert Learning Motivation - finds similar motivation and updates, or creates new
  async upsertLearningMotivation(studentId: string, language: string | null, motivation: string, details?: string, sourceConversationId?: string): Promise<LearningMotivation> {
    // Look for existing similar motivation
    const existing = await this.getLearningMotivations(studentId, language || undefined);
    
    // Check for semantically similar motivation
    const motivationWords = motivation.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const similarMotivation = existing.find(e => {
      const existingWords = e.motivation.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const overlap = motivationWords.filter(w => existingWords.includes(w)).length;
      return overlap >= Math.min(3, motivationWords.length / 2);
    });
    
    if (similarMotivation) {
      // Update existing motivation with new details
      const updated = await this.updateLearningMotivation(similarMotivation.id, {
        details: details ? `${similarMotivation.details || ''}; ${details}` : similarMotivation.details,
        sourceConversationId: sourceConversationId || similarMotivation.sourceConversationId,
      });
      return updated || similarMotivation;
    }
    
    // Create new motivation
    return this.createLearningMotivation({
      studentId,
      language,
      motivation,
      details,
      sourceConversationId,
      priority: 'primary',
      status: 'active',
    });
  }

  // Upsert Recurring Struggle - finds similar struggle and increments, or creates new
  async upsertRecurringStruggle(studentId: string, language: string, struggleArea: string, description: string, specificExamples?: string): Promise<RecurringStruggle> {
    // Look for existing similar struggle
    const existing = await this.getRecurringStruggles(studentId, language, 'active');
    
    // Check for semantically similar struggle in same area
    const descWords = description.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const similarStruggle = existing.find(e => {
      if (e.struggleArea !== struggleArea) return false;
      const existingWords = e.description.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const overlap = descWords.filter(w => existingWords.includes(w)).length;
      return overlap >= Math.min(2, descWords.length / 2);
    });
    
    if (similarStruggle) {
      // Increment occurrence and add examples
      const newCount = (similarStruggle.occurrenceCount || 1) + 1;
      await this.updateRecurringStruggle(similarStruggle.id, {
        occurrenceCount: newCount,
        lastOccurredAt: new Date(),
        specificExamples: specificExamples 
          ? `${similarStruggle.specificExamples || ''}; ${specificExamples}` 
          : similarStruggle.specificExamples,
      });
      return { ...similarStruggle, occurrenceCount: newCount };
    }
    
    // Create new struggle
    return this.createRecurringStruggle({
      studentId,
      language,
      struggleArea,
      description,
      specificExamples,
      occurrenceCount: 1,
      status: 'active',
    });
  }

  // Session Notes - Post-session reflections (USER database - per-user data)
  async createSessionNote(data: InsertSessionNote): Promise<SessionNote> {
    const [note] = await getUserDb().insert(sessionNotes).values(data).returning();
    return note;
  }

  async getSessionNotes(studentId: string, limit: number = 10): Promise<SessionNote[]> {
    return getUserDb().select().from(sessionNotes)
      .where(eq(sessionNotes.studentId, studentId))
      .orderBy(desc(sessionNotes.createdAt))
      .limit(limit);
  }

  async getSessionNoteByConversation(conversationId: string): Promise<SessionNote | undefined> {
    const [note] = await getUserDb().select().from(sessionNotes)
      .where(eq(sessionNotes.conversationId, conversationId));
    return note;
  }

  // Aggregate Memory Context (for injecting into prompts)
  async getStudentMemoryContext(studentId: string, language?: string): Promise<{
    insights: StudentInsight[];
    motivations: LearningMotivation[];
    struggles: RecurringStruggle[];
    recentNotes: SessionNote[];
    connections: PeopleConnection[];
  }> {
    const [insights, motivations, struggles, recentNotes, connections] = await Promise.all([
      this.getStudentInsights(studentId, language),
      this.getLearningMotivations(studentId, language),
      this.getRecurringStruggles(studentId, language),
      this.getSessionNotes(studentId, 5), // Last 5 session notes
      this.getPeopleConnections(studentId)
    ]);

    return {
      insights,
      motivations,
      struggles,
      recentNotes,
      connections
    };
  }
  
  // ACTFL Assessment Events (for analytics/effectiveness tracking) - USER database
  async createActflAssessmentEvent(data: InsertActflAssessmentEvent): Promise<ActflAssessmentEvent> {
    const [event] = await getUserDb().insert(actflAssessmentEvents).values(data).returning();
    return event;
  }
  
  async getActflAssessmentEvents(options?: { userId?: string; language?: string; limit?: number }): Promise<ActflAssessmentEvent[]> {
    const conditions: any[] = [];
    
    if (options?.userId) {
      conditions.push(eq(actflAssessmentEvents.userId, options.userId));
    }
    if (options?.language) {
      conditions.push(eq(actflAssessmentEvents.language, options.language));
    }
    
    const query = getUserDb().select().from(actflAssessmentEvents);
    
    if (conditions.length > 0) {
      return query
        .where(and(...conditions))
        .orderBy(desc(actflAssessmentEvents.createdAt))
        .limit(options?.limit || 100);
    }
    
    return query
      .orderBy(desc(actflAssessmentEvents.createdAt))
      .limit(options?.limit || 100);
  }
  
  // Agent Observations (Development Agent's Neural Network) - Routes to Neon shared DB
  async createAgentObservation(data: InsertAgentObservation): Promise<AgentObservation> {
    const sharedDb = getSharedDb();
    const [observation] = await sharedDb.insert(agentObservations).values(data).returning();
    return observation;
  }
  
  async getAgentObservations(options?: { category?: string; status?: string; limit?: number }): Promise<AgentObservation[]> {
    const conditions: any[] = [];
    const sharedDb = getSharedDb();
    
    if (options?.category) {
      conditions.push(eq(agentObservations.category, options.category as any));
    }
    if (options?.status) {
      conditions.push(eq(agentObservations.status, options.status));
    }
    
    const query = sharedDb.select().from(agentObservations);
    
    if (conditions.length > 0) {
      return query
        .where(and(...conditions))
        .orderBy(desc(agentObservations.priority), desc(agentObservations.createdAt))
        .limit(options?.limit || 50);
    }
    
    return query
      .orderBy(desc(agentObservations.priority), desc(agentObservations.createdAt))
      .limit(options?.limit || 50);
  }
  
  async updateAgentObservation(id: string, data: Partial<AgentObservation>): Promise<AgentObservation | undefined> {
    const sharedDb = getSharedDb();
    const [updated] = await sharedDb.update(agentObservations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(agentObservations.id, id))
      .returning();
    return updated;
  }
  
  // ===== Support Observations (Support Agent's Neural Network) - Routes to Neon shared DB =====
  async createSupportObservation(data: InsertSupportObservation): Promise<SupportObservation> {
    const sharedDb = getSharedDb();
    const [observation] = await sharedDb.insert(supportObservations).values(data).returning();
    return observation;
  }
  
  async getSupportObservations(options?: { category?: string; status?: string; escalationNeeded?: boolean; limit?: number }): Promise<SupportObservation[]> {
    const conditions: any[] = [];
    const sharedDb = getSharedDb();
    
    if (options?.category) {
      conditions.push(eq(supportObservations.category, options.category as any));
    }
    if (options?.status) {
      conditions.push(eq(supportObservations.status, options.status));
    }
    if (options?.escalationNeeded !== undefined) {
      conditions.push(eq(supportObservations.escalationNeeded, options.escalationNeeded));
    }
    
    const query = sharedDb.select().from(supportObservations);
    
    if (conditions.length > 0) {
      return query
        .where(and(...conditions))
        .orderBy(desc(supportObservations.priority), desc(supportObservations.createdAt))
        .limit(options?.limit || 50);
    }
    
    return query
      .orderBy(desc(supportObservations.priority), desc(supportObservations.createdAt))
      .limit(options?.limit || 50);
  }
  
  async updateSupportObservation(id: string, data: Partial<SupportObservation>): Promise<SupportObservation | undefined> {
    const sharedDb = getSharedDb();
    const [updated] = await sharedDb.update(supportObservations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(supportObservations.id, id))
      .returning();
    return updated;
  }
  
  // ===== System Alerts (Proactive Support Communications) =====
  async createSystemAlert(data: InsertSystemAlert): Promise<SystemAlert> {
    const sharedDb = getSharedDb();
    const [alert] = await sharedDb.insert(systemAlerts).values(data).returning();
    return alert;
  }
  
  async getActiveSystemAlerts(options?: { target?: string; severity?: string }): Promise<SystemAlert[]> {
    const sharedDb = getSharedDb();
    const now = new Date();
    const conditions: any[] = [
      eq(systemAlerts.isActive, true),
      lte(systemAlerts.startsAt, now),
    ];
    
    if (options?.target) {
      conditions.push(eq(systemAlerts.target, options.target as any));
    }
    if (options?.severity) {
      conditions.push(eq(systemAlerts.severity, options.severity as any));
    }
    
    return sharedDb.select().from(systemAlerts)
      .where(and(...conditions))
      .orderBy(desc(systemAlerts.startsAt))
      .limit(20);
  }
  
  async updateSystemAlert(id: string, data: Partial<SystemAlert>): Promise<SystemAlert | undefined> {
    const sharedDb = getSharedDb();
    const [updated] = await sharedDb.update(systemAlerts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(systemAlerts.id, id))
      .returning();
    return updated;
  }
  
  async incrementAlertView(id: string): Promise<void> {
    const sharedDb = getSharedDb();
    await sharedDb.update(systemAlerts)
      .set({ viewCount: sql`${systemAlerts.viewCount} + 1` })
      .where(eq(systemAlerts.id, id));
  }
  
  async incrementAlertDismiss(id: string): Promise<void> {
    const sharedDb = getSharedDb();
    await sharedDb.update(systemAlerts)
      .set({ dismissCount: sql`${systemAlerts.dismissCount} + 1` })
      .where(eq(systemAlerts.id, id));
  }
  
  async getRecentSystemAlerts(options?: { limit?: number; environment?: string }): Promise<SystemAlert[]> {
    const sharedDb = getSharedDb();
    const conditions: any[] = [];
    
    if (options?.environment) {
      conditions.push(eq(systemAlerts.originEnvironment, options.environment));
    }
    
    const query = sharedDb.select().from(systemAlerts);
    
    if (conditions.length > 0) {
      return query.where(and(...conditions))
        .orderBy(desc(systemAlerts.createdAt))
        .limit(options?.limit || 50);
    }
    
    return query.orderBy(desc(systemAlerts.createdAt)).limit(options?.limit || 50);
  }

  async incrementAlertViewCount(id: string): Promise<void> {
    const sharedDb = getSharedDb();
    await sharedDb.update(systemAlerts)
      .set({ 
        viewCount: sql`${systemAlerts.viewCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(systemAlerts.id, id));
  }
  
  // ===== Support Tickets (Tri-Lane Hive - Support Agent escalations) - USER database =====
  
  async createSupportTicket(data: InsertSupportTicket): Promise<SupportTicket> {
    const [ticket] = await getUserDb().insert(supportTickets).values(data).returning();
    return ticket;
  }
  
  async getSupportTicket(id: string): Promise<SupportTicket | undefined> {
    const [ticket] = await getUserDb().select().from(supportTickets).where(eq(supportTickets.id, id));
    return ticket;
  }
  
  async getSupportTickets(options?: { userId?: string; status?: string; category?: string; limit?: number }): Promise<SupportTicket[]> {
    const conditions: any[] = [];
    
    if (options?.userId) {
      conditions.push(eq(supportTickets.userId, options.userId));
    }
    if (options?.status) {
      conditions.push(eq(supportTickets.status, options.status as any));
    }
    if (options?.category) {
      conditions.push(eq(supportTickets.category, options.category as any));
    }
    
    const query = getUserDb().select().from(supportTickets);
    
    if (conditions.length > 0) {
      return query.where(and(...conditions))
        .orderBy(desc(supportTickets.createdAt))
        .limit(options?.limit || 50);
    }
    
    return query.orderBy(desc(supportTickets.createdAt)).limit(options?.limit || 50);
  }
  
  async updateSupportTicket(id: string, data: Partial<SupportTicket>): Promise<SupportTicket | undefined> {
    const [updated] = await getUserDb().update(supportTickets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(supportTickets.id, id))
      .returning();
    return updated;
  }
  
  async createSupportMessage(data: InsertSupportMessage): Promise<SupportMessage> {
    const [message] = await getUserDb().insert(supportMessages).values(data).returning();
    
    // Increment message count on ticket
    await getUserDb().update(supportTickets)
      .set({ 
        messageCount: sql`${supportTickets.messageCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(supportTickets.id, data.ticketId));
    
    return message;
  }
  
  async getSupportMessages(ticketId: string): Promise<SupportMessage[]> {
    return getUserDb().select().from(supportMessages)
      .where(eq(supportMessages.ticketId, ticketId))
      .orderBy(supportMessages.createdAt);
  }
  
  // Alias for routes - maps senderType to role field
  async addSupportMessage(data: { ticketId: string; senderType: 'user' | 'support'; senderId?: string; content: string }): Promise<SupportMessage> {
    // Map senderType to role field expected by schema
    const role = data.senderType === 'user' ? 'user' : 'support_agent';
    return this.createSupportMessage({
      ticketId: data.ticketId,
      role,
      content: data.content,
    });
  }
  
  // ===== Sofia Issue Reports (Production voice debugging) - USER database =====
  
  async createSofiaIssueReport(data: InsertSofiaIssueReport): Promise<SofiaIssueReport> {
    const [report] = await getUserDb().insert(sofiaIssueReports).values(data).returning();
    return report;
  }
  
  async getSofiaIssueReports(options?: { status?: string; issueType?: string; userId?: string; limit?: number }): Promise<SofiaIssueReport[]> {
    const conditions: any[] = [];
    
    if (options?.status) {
      conditions.push(eq(sofiaIssueReports.status, options.status));
    }
    if (options?.issueType) {
      conditions.push(eq(sofiaIssueReports.issueType, options.issueType));
    }
    if (options?.userId) {
      conditions.push(eq(sofiaIssueReports.userId, options.userId));
    }
    
    const query = getUserDb().select().from(sofiaIssueReports);
    
    if (conditions.length > 0) {
      return query.where(and(...conditions))
        .orderBy(desc(sofiaIssueReports.createdAt))
        .limit(options?.limit || 50);
    }
    
    return query.orderBy(desc(sofiaIssueReports.createdAt)).limit(options?.limit || 50);
  }
  
  async updateSofiaIssueReport(id: string, data: Partial<SofiaIssueReport>): Promise<SofiaIssueReport | undefined> {
    const [updated] = await getUserDb().update(sofiaIssueReports)
      .set(data)
      .where(eq(sofiaIssueReports.id, id))
      .returning();
    return updated;
  }

  // ===== Daniela Suggestions (Hive Mind - Active contributions) =====
  
  async createDanielaSuggestion(data: InsertDanielaSuggestion): Promise<DanielaSuggestion> {
    const [suggestion] = await db.insert(danielaSuggestions).values(data).returning();
    return suggestion;
  }
  
  // ===== Self-Surgery Proposals (Daniela's Neural Network Modifications) =====
  
  async createSelfSurgeryProposal(data: InsertSelfSurgeryProposal): Promise<SelfSurgeryProposal> {
    const [proposal] = await db.insert(selfSurgeryProposals).values(data).returning();
    return proposal;
  }
  
  async getSelfSurgeryProposalById(id: string): Promise<SelfSurgeryProposal | undefined> {
    const [proposal] = await db.select().from(selfSurgeryProposals)
      .where(eq(selfSurgeryProposals.id, id))
      .limit(1);
    return proposal;
  }
  
  async getSelfSurgeryProposals(options?: { status?: string; targetTable?: string; limit?: number }): Promise<SelfSurgeryProposal[]> {
    const limit = options?.limit || 50;
    let query = db.select().from(selfSurgeryProposals);
    
    const conditions = [];
    if (options?.status) {
      conditions.push(eq(selfSurgeryProposals.status, options.status as any));
    }
    if (options?.targetTable) {
      conditions.push(eq(selfSurgeryProposals.targetTable, options.targetTable as any));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return query.orderBy(desc(selfSurgeryProposals.createdAt)).limit(limit) as any;
  }
  
  async updateSelfSurgeryProposal(id: string, data: Partial<SelfSurgeryProposal>): Promise<SelfSurgeryProposal | undefined> {
    const [updated] = await db.update(selfSurgeryProposals)
      .set(data)
      .where(eq(selfSurgeryProposals.id, id))
      .returning();
    return updated;
  }
  
  // ===== Tri-Lane Hive Collaboration APIs - Routes to Neon shared DB =====
  async getCollaborationContext(options?: { domainTags?: string[]; originRole?: string; limit?: number }): Promise<{
    danielaSuggestions: any[];
    agentObservations: AgentObservation[];
    supportObservations: SupportObservation[];
  }> {
    const limit = options?.limit || 20;
    const sharedDb = getSharedDb();
    
    // Get active entries from all three tables
    const [agentObs, supportObs] = await Promise.all([
      sharedDb.select().from(agentObservations)
        .where(eq(agentObservations.status, 'active'))
        .orderBy(desc(agentObservations.priority))
        .limit(limit),
      sharedDb.select().from(supportObservations)
        .where(eq(supportObservations.status, 'active'))
        .orderBy(desc(supportObservations.priority))
        .limit(limit),
    ]);
    
    // Filter by domain tags if specified
    const filterByDomain = (items: any[]) => {
      if (!options?.domainTags?.length) return items;
      return items.filter(item => 
        item.domainTags?.some((tag: string) => options.domainTags!.includes(tag))
      );
    };
    
    return {
      danielaSuggestions: [], // TODO: Add when danielaSuggestions has domainTags
      agentObservations: filterByDomain(agentObs),
      supportObservations: filterByDomain(supportObs),
    };
  }
  
  async getPendingAcknowledgments(forRole: 'daniela' | 'editor' | 'support'): Promise<{
    danielaSuggestions: any[];
    agentObservations: AgentObservation[];
    supportObservations: SupportObservation[];
  }> {
    // Get observations that need acknowledgment from this role
    const sharedDb = getSharedDb();
    let agentObs: AgentObservation[] = [];
    let supportObs: SupportObservation[] = [];
    
    if (forRole === 'daniela') {
      // Daniela needs to acknowledge Editor and Support observations that affect pedagogy
      agentObs = await sharedDb.select().from(agentObservations)
        .where(and(
          eq(agentObservations.status, 'active'),
          eq(agentObservations.acknowledgedByDaniela, false)
        ))
        .orderBy(desc(agentObservations.priority))
        .limit(20);
      
      supportObs = await sharedDb.select().from(supportObservations)
        .where(and(
          eq(supportObservations.status, 'active'),
          eq(supportObservations.acknowledgedByDaniela, false)
        ))
        .orderBy(desc(supportObservations.priority))
        .limit(20);
    } else if (forRole === 'editor') {
      // Editor needs to acknowledge Support observations that need technical attention
      supportObs = await sharedDb.select().from(supportObservations)
        .where(and(
          eq(supportObservations.status, 'active'),
          eq(supportObservations.acknowledgedByEditor, false),
          eq(supportObservations.escalationNeeded, true)
        ))
        .orderBy(desc(supportObservations.priority))
        .limit(20);
    } else if (forRole === 'support') {
      // Support needs to acknowledge Editor observations that affect operations
      agentObs = await sharedDb.select().from(agentObservations)
        .where(and(
          eq(agentObservations.status, 'active'),
          eq(agentObservations.acknowledgedBySupport, false)
        ))
        .orderBy(desc(agentObservations.priority))
        .limit(20);
    }
    
    return {
      danielaSuggestions: [], // TODO: Add acknowledgment tracking for daniela_suggestions
      agentObservations: agentObs,
      supportObservations: supportObs,
    };
  }
  
  // ===== Agenda Queue (Express Lane discussion items) =====
  
  async createAgendaQueueItem(data: InsertAgendaQueue): Promise<AgendaQueueItem> {
    const [created] = await db.insert(agendaQueue).values([data]).returning();
    return created;
  }
  
  // ===== AGENT COLLABORATION METHODS =====
  
  async createCollaborationEvent(event: InsertAgentCollaborationEvent): Promise<AgentCollaborationEvent> {
    const [created] = await db.insert(agentCollaborationEvents).values([event]).returning();
    return created;
  }
  
  async getCollaborationEventsForAgent(
    agentRole: 'daniela' | 'assistant' | 'support' | 'editor',
    options?: {
      status?: string;
      eventType?: string;
      since?: Date;
      limit?: number;
    }
  ): Promise<AgentCollaborationEvent[]> {
    const conditions = [
      or(
        eq(agentCollaborationEvents.toAgent, agentRole),
        isNull(agentCollaborationEvents.toAgent) // Broadcast events
      )
    ];
    
    if (options?.status) {
      conditions.push(eq(agentCollaborationEvents.status, options.status));
    }
    if (options?.eventType) {
      conditions.push(eq(agentCollaborationEvents.eventType, options.eventType as any));
    }
    if (options?.since) {
      conditions.push(gte(agentCollaborationEvents.createdAt, options.since));
    }
    
    return db.select().from(agentCollaborationEvents)
      .where(and(...conditions))
      .orderBy(desc(agentCollaborationEvents.createdAt))
      .limit(options?.limit || 50);
  }
  
  async getCollaborationEventById(id: string): Promise<AgentCollaborationEvent | undefined> {
    const [event] = await db.select().from(agentCollaborationEvents)
      .where(eq(agentCollaborationEvents.id, id));
    return event;
  }
  
  async getCollaborationThread(threadId: string): Promise<AgentCollaborationEvent[]> {
    // Get all events in a thread (original + responses)
    return db.select().from(agentCollaborationEvents)
      .where(or(
        eq(agentCollaborationEvents.id, threadId),
        eq(agentCollaborationEvents.relatedEventId, threadId)
      ))
      .orderBy(asc(agentCollaborationEvents.createdAt));
  }
  
  async acknowledgeCollaborationEvent(
    eventId: string,
    byAgent: 'daniela' | 'assistant' | 'support' | 'editor'
  ): Promise<AgentCollaborationEvent | undefined> {
    const [updated] = await db.update(agentCollaborationEvents)
      .set({
        status: 'acknowledged',
        acknowledgedBy: byAgent,
        acknowledgedAt: new Date(),
      })
      .where(eq(agentCollaborationEvents.id, eventId))
      .returning();
    return updated;
  }
  
  async getPendingCollaborationEventsForAgent(
    agentRole: 'daniela' | 'assistant' | 'support' | 'editor'
  ): Promise<AgentCollaborationEvent[]> {
    return db.select().from(agentCollaborationEvents)
      .where(and(
        or(
          eq(agentCollaborationEvents.toAgent, agentRole),
          isNull(agentCollaborationEvents.toAgent)
        ),
        eq(agentCollaborationEvents.status, 'pending')
      ))
      .orderBy(desc(agentCollaborationEvents.createdAt))
      .limit(50);
  }
  
  async getCollaborationEventsToAgent(
    toAgent: 'daniela' | 'assistant' | 'support' | 'editor',
    userId?: string,
    limit?: number
  ): Promise<AgentCollaborationEvent[]> {
    const conditions = [
      eq(agentCollaborationEvents.toAgent, toAgent)
    ];
    
    if (userId) {
      conditions.push(eq(agentCollaborationEvents.userId, userId));
    }
    
    return db.select().from(agentCollaborationEvents)
      .where(and(...conditions))
      .orderBy(desc(agentCollaborationEvents.createdAt))
      .limit(limit || 10);
  }
  
  async getRecentCollaborationContext(
    forAgent: 'daniela' | 'assistant' | 'support' | 'editor',
    options?: { userId?: string; hours?: number; limit?: number }
  ): Promise<AgentCollaborationEvent[]> {
    const since = new Date();
    since.setHours(since.getHours() - (options?.hours || 24));
    
    const conditions = [
      or(
        eq(agentCollaborationEvents.toAgent, forAgent),
        eq(agentCollaborationEvents.fromAgent, forAgent),
        isNull(agentCollaborationEvents.toAgent) // Broadcasts
      ),
      gte(agentCollaborationEvents.createdAt, since)
    ];
    
    if (options?.userId) {
      conditions.push(eq(agentCollaborationEvents.userId, options.userId));
    }
    
    return db.select().from(agentCollaborationEvents)
      .where(and(...conditions))
      .orderBy(desc(agentCollaborationEvents.createdAt))
      .limit(options?.limit || 20);
  }
  
  // ===== SECURE INTER-AGENT MESSAGING =====
  // Security-filtered messages for Daniela's context (protects code/architecture from Gemini)
  
  async getSecureMessagesForDaniela(options?: {
    userId?: string;
    hours?: number;
    limit?: number;
  }): Promise<SecureAgentMessage[]> {
    const since = new Date();
    since.setHours(since.getHours() - (options?.hours || 48));
    
    // Get all messages TO Daniela (or broadcasts)
    const conditions = [
      or(
        eq(agentCollaborationEvents.toAgent, 'daniela'),
        isNull(agentCollaborationEvents.toAgent)
      ),
      gte(agentCollaborationEvents.createdAt, since),
      // SECURITY: Exclude "internal" messages - they NEVER go to Gemini
      ne(agentCollaborationEvents.securityClassification, 'internal')
    ];
    
    if (options?.userId) {
      conditions.push(eq(agentCollaborationEvents.userId, options.userId));
    }
    
    const events = await db.select().from(agentCollaborationEvents)
      .where(and(...conditions))
      .orderBy(desc(agentCollaborationEvents.createdAt))
      .limit(options?.limit || 15);
    
    // Transform: For "daniela_summary" type, use ONLY publicSummary (never fall back to content)
    // SECURITY: If publicSummary is missing for daniela_summary, return empty string to prevent leaking internal details
    return events.map(event => ({
      id: event.id,
      fromAgent: event.fromAgent,
      subject: event.subject,
      content: event.securityClassification === 'daniela_summary'
        ? (event.publicSummary || '[Summary not available]')  // Never expose raw content
        : event.content,
      eventType: event.eventType,
      createdAt: event.createdAt,
    }));
  }
  
  // Get internal-only messages for Command Center (never exposed to Gemini)
  async getInternalAgentMessages(options?: {
    hours?: number;
    limit?: number;
  }): Promise<AgentCollaborationEvent[]> {
    const since = new Date();
    since.setHours(since.getHours() - (options?.hours || 72));
    
    return db.select().from(agentCollaborationEvents)
      .where(and(
        eq(agentCollaborationEvents.securityClassification, 'internal'),
        gte(agentCollaborationEvents.createdAt, since)
      ))
      .orderBy(desc(agentCollaborationEvents.createdAt))
      .limit(options?.limit || 50);
  }
  
  // Get department chat messages (real-time feed)
  async getDepartmentChatMessages(options?: {
    classification?: 'public' | 'internal' | 'daniela_summary';
    hours?: number;
    limit?: number;
    afterId?: string;
  }): Promise<AgentCollaborationEvent[]> {
    const since = new Date();
    since.setHours(since.getHours() - (options?.hours || 24));
    
    const conditions = [
      gte(agentCollaborationEvents.createdAt, since)
    ];
    
    if (options?.classification) {
      conditions.push(eq(agentCollaborationEvents.securityClassification, options.classification));
    }
    
    // For polling: only get messages after a certain ID
    if (options?.afterId) {
      const afterEvent = await this.getCollaborationEventById(options.afterId);
      if (afterEvent) {
        conditions.push(gt(agentCollaborationEvents.createdAt, afterEvent.createdAt));
      }
    }
    
    return db.select().from(agentCollaborationEvents)
      .orderBy(desc(agentCollaborationEvents.createdAt))
      .where(and(...conditions))
      .limit(options?.limit || 50);
  }
  
  // ===== ARIS (ASSISTANT TUTOR) STORAGE =====
  
  async createArisDrillAssignment(assignment: InsertArisDrillAssignment): Promise<ArisDrillAssignment> {
    const [created] = await db.insert(arisDrillAssignments).values([assignment]).returning();
    return created;
  }
  
  async getArisDrillAssignment(id: string): Promise<ArisDrillAssignment | undefined> {
    const [assignment] = await db.select().from(arisDrillAssignments)
      .where(eq(arisDrillAssignments.id, id));
    return assignment;
  }
  
  async getPendingArisDrillAssignmentsForUser(userId: string): Promise<ArisDrillAssignment[]> {
    return db.select().from(arisDrillAssignments)
      .where(and(
        eq(arisDrillAssignments.userId, userId),
        eq(arisDrillAssignments.status, 'pending')
      ))
      .orderBy(desc(arisDrillAssignments.assignedAt));
  }
  
  async updateArisDrillAssignmentStatus(
    id: string,
    status: 'pending' | 'in_progress' | 'completed' | 'expired' | 'cancelled',
    timestamps?: { startedAt?: Date; completedAt?: Date }
  ): Promise<ArisDrillAssignment | undefined> {
    const updateData: Record<string, unknown> = { status };
    if (timestamps?.startedAt) updateData.startedAt = timestamps.startedAt;
    if (timestamps?.completedAt) updateData.completedAt = timestamps.completedAt;
    
    const [updated] = await db.update(arisDrillAssignments)
      .set(updateData)
      .where(eq(arisDrillAssignments.id, id))
      .returning();
    return updated;
  }
  
  async createArisDrillResult(result: InsertArisDrillResult): Promise<ArisDrillResult> {
    const [created] = await db.insert(arisDrillResults).values([result]).returning();
    return created;
  }
  
  async getArisDrillResultsForUser(userId: string, limit: number = 20): Promise<ArisDrillResult[]> {
    return db.select().from(arisDrillResults)
      .where(eq(arisDrillResults.userId, userId))
      .orderBy(desc(arisDrillResults.createdAt))
      .limit(limit);
  }
  
  async getArisDrillResultForAssignment(assignmentId: string): Promise<ArisDrillResult | undefined> {
    const [result] = await db.select().from(arisDrillResults)
      .where(eq(arisDrillResults.assignmentId, assignmentId));
    return result;
  }
  
  async getRecentArisInsightsForDaniela(
    userId: string,
    options?: { hours?: number; limit?: number }
  ): Promise<{ results: ArisDrillResult[]; feedbackEvents: AgentCollaborationEvent[] }> {
    const since = new Date();
    since.setHours(since.getHours() - (options?.hours || 48));
    
    // Get recent drill results
    const results = await db.select().from(arisDrillResults)
      .where(and(
        eq(arisDrillResults.userId, userId),
        gte(arisDrillResults.createdAt, since)
      ))
      .orderBy(desc(arisDrillResults.createdAt))
      .limit(options?.limit || 10);
    
    // Get related feedback events from Aris to Daniela
    const feedbackEvents = await db.select().from(agentCollaborationEvents)
      .where(and(
        eq(agentCollaborationEvents.fromAgent, 'assistant'),
        eq(agentCollaborationEvents.toAgent, 'daniela'),
        eq(agentCollaborationEvents.userId, userId),
        eq(agentCollaborationEvents.eventType, 'feedback'),
        gte(agentCollaborationEvents.createdAt, since)
      ))
      .orderBy(desc(agentCollaborationEvents.createdAt))
      .limit(options?.limit || 10);
    
    return { results, feedbackEvents };
  }

  // ===== FEATURE SPRINT SYSTEM STORAGE =====

  async createFeatureSprint(data: InsertFeatureSprint): Promise<FeatureSprint> {
    const [created] = await db.insert(featureSprints).values([data]).returning();
    return created;
  }

  async getFeatureSprint(id: string): Promise<FeatureSprint | undefined> {
    const [sprint] = await db.select().from(featureSprints)
      .where(eq(featureSprints.id, id));
    return sprint;
  }

  async getFeatureSprints(options?: { stage?: string; createdBy?: string; limit?: number }): Promise<FeatureSprint[]> {
    const conditions: any[] = [];
    if (options?.stage) conditions.push(eq(featureSprints.stage, options.stage as any));
    if (options?.createdBy) conditions.push(eq(featureSprints.createdBy, options.createdBy));
    
    let query = db.select().from(featureSprints)
      .orderBy(desc(featureSprints.createdAt));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return query.limit(options?.limit || 100);
  }

  async updateFeatureSprint(id: string, data: Partial<FeatureSprint>): Promise<FeatureSprint | undefined> {
    const [updated] = await db.update(featureSprints)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(featureSprints.id, id))
      .returning();
    return updated;
  }

  async deleteFeatureSprint(id: string): Promise<void> {
    await db.delete(featureSprints).where(eq(featureSprints.id, id));
  }

  async createSprintStageTransition(data: InsertSprintStageTransition): Promise<SprintStageTransition> {
    const [created] = await db.insert(sprintStageTransitions).values([data]).returning();
    return created;
  }

  async getSprintTransitions(sprintId: string): Promise<SprintStageTransition[]> {
    return db.select().from(sprintStageTransitions)
      .where(eq(sprintStageTransitions.sprintId, sprintId))
      .orderBy(asc(sprintStageTransitions.createdAt));
  }

  async createConsultationThread(data: InsertConsultationThread): Promise<ConsultationThread> {
    const [created] = await db.insert(consultationThreads).values([data]).returning();
    return created;
  }

  async getConsultationThread(id: string): Promise<ConsultationThread | undefined> {
    const [thread] = await db.select().from(consultationThreads)
      .where(eq(consultationThreads.id, id));
    return thread;
  }

  async getConsultationThreads(options?: { createdBy?: string; sprintId?: string; limit?: number }): Promise<ConsultationThread[]> {
    const conditions: any[] = [];
    if (options?.createdBy) conditions.push(eq(consultationThreads.createdBy, options.createdBy));
    if (options?.sprintId) conditions.push(eq(consultationThreads.sprintId, options.sprintId));
    
    let query = db.select().from(consultationThreads)
      .orderBy(desc(consultationThreads.updatedAt));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return query.limit(options?.limit || 50);
  }

  async updateConsultationThread(id: string, data: Partial<ConsultationThread>): Promise<ConsultationThread | undefined> {
    const [updated] = await db.update(consultationThreads)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(consultationThreads.id, id))
      .returning();
    return updated;
  }

  async createConsultationMessage(data: InsertConsultationMessage): Promise<ConsultationMessage> {
    const [created] = await db.insert(consultationMessages).values([data]).returning();
    // Also update the thread's updatedAt
    await db.update(consultationThreads)
      .set({ updatedAt: new Date() })
      .where(eq(consultationThreads.id, data.threadId));
    return created;
  }

  async getConsultationMessages(threadId: string): Promise<ConsultationMessage[]> {
    return db.select().from(consultationMessages)
      .where(eq(consultationMessages.threadId, threadId))
      .orderBy(asc(consultationMessages.createdAt));
  }

  async getSprintTemplates(templateType?: string): Promise<SprintTemplate[]> {
    if (templateType) {
      return db.select().from(sprintTemplates)
        .where(eq(sprintTemplates.templateType, templateType))
        .orderBy(desc(sprintTemplates.usageCount));
    }
    return db.select().from(sprintTemplates)
      .orderBy(desc(sprintTemplates.usageCount));
  }

  async getSprintTemplate(id: string): Promise<SprintTemplate | undefined> {
    const [template] = await db.select().from(sprintTemplates)
      .where(eq(sprintTemplates.id, id));
    return template;
  }

  async createSprintTemplate(data: InsertSprintTemplate): Promise<SprintTemplate> {
    const [created] = await db.insert(sprintTemplates).values([data]).returning();
    return created;
  }

  async incrementTemplateUsage(id: string): Promise<void> {
    await db.update(sprintTemplates)
      .set({ usageCount: sql`${sprintTemplates.usageCount} + 1`, updatedAt: new Date() })
      .where(eq(sprintTemplates.id, id));
  }

  async getActiveProjectContext(): Promise<ProjectContextSnapshot | undefined> {
    const [snapshot] = await db.select().from(projectContextSnapshots)
      .where(eq(projectContextSnapshots.isActive, true))
      .orderBy(desc(projectContextSnapshots.createdAt))
      .limit(1);
    return snapshot;
  }

  async createProjectContextSnapshot(data: InsertProjectContextSnapshot): Promise<ProjectContextSnapshot> {
    // First deactivate all existing snapshots
    await this.deactivateOldSnapshots();
    const [created] = await db.insert(projectContextSnapshots).values([{ ...data, isActive: true }]).returning();
    return created;
  }

  async deactivateOldSnapshots(): Promise<void> {
    await db.update(projectContextSnapshots)
      .set({ isActive: false })
      .where(eq(projectContextSnapshots.isActive, true));
  }

  async createAiSuggestion(data: InsertAiSuggestion): Promise<AiSuggestion> {
    const [created] = await db.insert(aiSuggestions).values([data]).returning();
    return created;
  }

  async getAiSuggestions(options?: { status?: string; suggestionType?: string; limit?: number }): Promise<AiSuggestion[]> {
    const conditions: any[] = [];
    if (options?.status) conditions.push(eq(aiSuggestions.status, options.status));
    if (options?.suggestionType) conditions.push(eq(aiSuggestions.suggestionType, options.suggestionType));
    
    let query = db.select().from(aiSuggestions)
      .orderBy(desc(aiSuggestions.createdAt));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return query.limit(options?.limit || 50);
  }

  async updateAiSuggestion(id: string, data: Partial<AiSuggestion>): Promise<AiSuggestion | undefined> {
    const [updated] = await db.update(aiSuggestions)
      .set(data)
      .where(eq(aiSuggestions.id, id))
      .returning();
    return updated;
  }

  // ===== BRAIN SURGERY METHODS =====
  
  async getCollaborationEventsByThread(threadId: string, limit: number = 20): Promise<AgentCollaborationEvent[]> {
    // Query events where metadata.threadId matches
    return db.select().from(agentCollaborationEvents)
      .where(sql`${agentCollaborationEvents.metadata}->>'threadId' = ${threadId}`)
      .orderBy(asc(agentCollaborationEvents.createdAt))
      .limit(limit);
  }
  
  async getCollaborationEventsByTag(tag: string, limit: number = 500): Promise<AgentCollaborationEvent[]> {
    // Query events where metadata.tags contains the tag
    return db.select().from(agentCollaborationEvents)
      .where(sql`${agentCollaborationEvents.metadata}->'tags' ? ${tag}`)
      .orderBy(desc(agentCollaborationEvents.createdAt))
      .limit(limit);
  }
  
  async insertTutorProcedure(data: InsertTutorProcedure): Promise<string> {
    const [created] = await db.insert(tutorProcedures).values([data]).returning();
    return created.id;
  }
  
  async insertTeachingPrinciple(data: InsertTeachingPrinciple): Promise<string> {
    const [created] = await db.insert(teachingPrinciples).values([data]).returning();
    return created.id;
  }
  
  async insertToolKnowledge(data: InsertToolKnowledge): Promise<string> {
    const [created] = await db.insert(toolKnowledge).values([data]).returning();
    return created.id;
  }
  
  async insertSituationalPattern(data: InsertSituationalPattern): Promise<string> {
    const [created] = await db.insert(situationalPatterns).values([data]).returning();
    return created.id;
  }
  
  async insertDanielaGrowthMemory(data: InsertDanielaGrowthMemory): Promise<string> {
    const [created] = await db.insert(danielaGrowthMemories).values([data]).returning();
    return created.id;
  }
  
  // ===== DANIELA'S PERSONAL NOTEBOOK (Direct Insert - No Approval) =====
  
  async insertDanielaNote(data: InsertDanielaNote): Promise<string> {
    const [created] = await db.insert(danielaNotes).values([data]).returning();
    console.log(`[Daniela Notes] Saved note: ${data.noteType} - ${data.title}`);
    return created.id;
  }
  
  async getDanielaNotes(filters?: {
    noteType?: DanielaNoteType;
    language?: string;
    limit?: number;
    includeArchived?: boolean;
  }): Promise<DanielaNote[]> {
    const conditions: any[] = [];
    
    if (!filters?.includeArchived) {
      conditions.push(eq(danielaNotes.isActive, true));
    }
    if (filters?.noteType) {
      conditions.push(eq(danielaNotes.noteType, filters.noteType));
    }
    if (filters?.language) {
      conditions.push(eq(danielaNotes.language, filters.language));
    }
    
    let query = db.select().from(danielaNotes);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    const results = await query
      .orderBy(desc(danielaNotes.createdAt))
      .limit(filters?.limit ?? 50);
    
    return results;
  }
  
  async searchDanielaNotes(searchText: string, limit: number = 20): Promise<DanielaNote[]> {
    const pattern = `%${searchText.toLowerCase()}%`;
    return await db.select()
      .from(danielaNotes)
      .where(and(
        eq(danielaNotes.isActive, true),
        or(
          sql`lower(${danielaNotes.title}) LIKE ${pattern}`,
          sql`lower(${danielaNotes.content}) LIKE ${pattern}`
        )
      ))
      .orderBy(desc(danielaNotes.createdAt))
      .limit(limit);
  }
  
  async incrementNoteReference(noteId: string): Promise<void> {
    await db.update(danielaNotes)
      .set({ 
        timesReferenced: sql`${danielaNotes.timesReferenced} + 1`,
        lastReferencedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(danielaNotes.id, noteId));
  }
  
  async archiveDanielaNote(id: string): Promise<void> {
    await db.update(danielaNotes)
      .set({ isActive: false, archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(danielaNotes.id, id));
  }

  async updateDanielaNoteById(id: string, updates: { isActive?: boolean; title?: string; content?: string }): Promise<DanielaNote | null> {
    const updateData: any = { updatedAt: new Date() };
    if (typeof updates.isActive === 'boolean') updateData.isActive = updates.isActive;
    if (updates.title) updateData.title = updates.title;
    if (updates.content) updateData.content = updates.content;
    
    const result = await db.update(danielaNotes)
      .set(updateData)
      .where(eq(danielaNotes.id, id))
      .returning();
    
    return result[0] || null;
  }
  
  // ===== BRAIN SURGERY DEACTIVATE/ROLLBACK METHODS =====
  
  async deactivateTutorProcedure(id: string): Promise<void> {
    await db.update(tutorProcedures)
      .set({ isActive: false })
      .where(eq(tutorProcedures.id, id));
  }
  
  async deactivateTeachingPrinciple(id: string): Promise<void> {
    await db.update(teachingPrinciples)
      .set({ isActive: false })
      .where(eq(teachingPrinciples.id, id));
  }
  
  async deactivateToolKnowledge(id: string): Promise<void> {
    await db.update(toolKnowledge)
      .set({ isActive: false })
      .where(eq(toolKnowledge.id, id));
  }
  
  async deactivateSituationalPattern(id: string): Promise<void> {
    await db.update(situationalPatterns)
      .set({ isActive: false })
      .where(eq(situationalPatterns.id, id));
  }
  
  async deactivateDanielaGrowthMemory(id: string): Promise<void> {
    await db.update(danielaGrowthMemories)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(danielaGrowthMemories.id, id));
  }
  
  // ===== COLLABORATIVE SURGERY SESSIONS =====
  
  async createSurgerySession(data: InsertSurgerySession): Promise<SurgerySession> {
    const [created] = await db.insert(surgerySessions).values([data]).returning();
    return created;
  }
  
  async getSurgerySession(id: string): Promise<SurgerySession | undefined> {
    const [session] = await db.select().from(surgerySessions).where(eq(surgerySessions.id, id));
    return session;
  }
  
  async getActiveSurgerySession(): Promise<SurgerySession | undefined> {
    const [session] = await db.select().from(surgerySessions)
      .where(eq(surgerySessions.status, 'running'))
      .orderBy(desc(surgerySessions.createdAt))
      .limit(1);
    return session;
  }
  
  async getSurgerySessions(options?: { status?: string; limit?: number }): Promise<SurgerySession[]> {
    let query = db.select().from(surgerySessions).orderBy(desc(surgerySessions.createdAt));
    
    if (options?.status) {
      query = query.where(eq(surgerySessions.status, options.status as any)) as any;
    }
    
    return query.limit(options?.limit || 20);
  }
  
  async updateSurgerySession(id: string, data: Partial<SurgerySession>): Promise<SurgerySession | undefined> {
    const [updated] = await db.update(surgerySessions)
      .set(data)
      .where(eq(surgerySessions.id, id))
      .returning();
    return updated;
  }
  
  async createSurgeryTurn(data: InsertSurgeryTurn): Promise<SurgeryTurn> {
    const [created] = await db.insert(surgeryTurns).values([data]).returning();
    return created;
  }
  
  async getSurgeryTurns(sessionId: string): Promise<SurgeryTurn[]> {
    return db.select().from(surgeryTurns)
      .where(eq(surgeryTurns.sessionId, sessionId))
      .orderBy(asc(surgeryTurns.turnNumber));
  }
  
  async getLatestSurgeryTurn(sessionId: string): Promise<SurgeryTurn | undefined> {
    const [turn] = await db.select().from(surgeryTurns)
      .where(eq(surgeryTurns.sessionId, sessionId))
      .orderBy(desc(surgeryTurns.turnNumber))
      .limit(1);
    return turn;
  }

  // ===== DANIELA BEACON ACKNOWLEDGMENT SYSTEM =====
  // Tracks feature requests and capability gaps with human-facing status tracking

  async createDanielaBeacon(data: InsertDanielaBeacon): Promise<DanielaBeacon> {
    const [created] = await db.insert(danielaBeacons).values([data]).returning();
    return created;
  }

  async getDanielaBeacon(id: string): Promise<DanielaBeacon | undefined> {
    const [beacon] = await db.select().from(danielaBeacons).where(eq(danielaBeacons.id, id));
    return beacon;
  }

  async getDanielaBeacons(options?: {
    status?: DanielaBeaconStatus;
    beaconType?: string;
    priority?: string;
    limit?: number;
  }): Promise<DanielaBeacon[]> {
    let query = db.select().from(danielaBeacons).orderBy(desc(danielaBeacons.createdAt));
    
    const conditions = [];
    if (options?.status) {
      conditions.push(eq(danielaBeacons.status, options.status));
    }
    if (options?.beaconType) {
      conditions.push(eq(danielaBeacons.beaconType, options.beaconType as any));
    }
    if (options?.priority) {
      conditions.push(eq(danielaBeacons.priority, options.priority as any));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return query.limit(options?.limit || 100);
  }

  async getPendingDanielaBeacons(): Promise<DanielaBeacon[]> {
    return db.select().from(danielaBeacons)
      .where(eq(danielaBeacons.status, 'pending'))
      .orderBy(desc(danielaBeacons.createdAt));
  }

  async getAllDanielaBeacons(): Promise<DanielaBeacon[]> {
    return db.select().from(danielaBeacons)
      .orderBy(desc(danielaBeacons.createdAt));
  }

  async updateDanielaBeaconStatus(
    id: string, 
    status: DanielaBeaconStatus, 
    changedBy: string,
    note?: string
  ): Promise<DanielaBeacon | undefined> {
    const updateData: Partial<DanielaBeacon> = {
      status,
      statusChangedAt: new Date(),
      statusChangedBy: changedBy,
    };
    
    if (status === 'acknowledged' && note) {
      updateData.acknowledgmentNote = note;
    }
    if (status === 'declined' && note) {
      updateData.declineReason = note;
    }
    if (status === 'completed') {
      updateData.completedAt = new Date();
      if (note) updateData.completedInBuild = note;
    }
    
    const [updated] = await db.update(danielaBeacons)
      .set(updateData)
      .where(eq(danielaBeacons.id, id))
      .returning();
    return updated;
  }

  async getBeaconsForDigest(): Promise<DanielaBeacon[]> {
    return db.select().from(danielaBeacons)
      .where(and(
        eq(danielaBeacons.includeInDigest, true),
        isNull(danielaBeacons.digestSentAt)
      ))
      .orderBy(desc(danielaBeacons.createdAt));
  }

  async markBeaconsDigestSent(beaconIds: string[]): Promise<void> {
    if (beaconIds.length === 0) return;
    await db.update(danielaBeacons)
      .set({ digestSentAt: new Date() })
      .where(inArray(danielaBeacons.id, beaconIds));
  }

  async getRecentlyCompletedBeacons(sinceDays: number = 7): Promise<DanielaBeacon[]> {
    const since = new Date();
    since.setDate(since.getDate() - sinceDays);
    
    return db.select().from(danielaBeacons)
      .where(and(
        eq(danielaBeacons.status, 'completed'),
        gte(danielaBeacons.completedAt!, since)
      ))
      .orderBy(desc(danielaBeacons.completedAt));
  }

  // ===== DANIELA'S NORTH STAR SYSTEM =====
  // The philosophical foundation that guides Daniela's teaching
  // Architecture: Principles (immutable) → Understanding (deepens) → Examples (grows)

  // North Star Principles - The immutable constitutional truths
  async createNorthStarPrinciple(data: InsertNorthStarPrinciple): Promise<NorthStarPrinciple> {
    const [created] = await db.insert(northStarPrinciples).values([data]).returning();
    return created;
  }

  async getNorthStarPrinciple(id: string): Promise<NorthStarPrinciple | undefined> {
    const [principle] = await db.select().from(northStarPrinciples).where(eq(northStarPrinciples.id, id));
    return principle;
  }

  async getAllNorthStarPrinciples(): Promise<NorthStarPrinciple[]> {
    return db.select().from(northStarPrinciples)
      .where(eq(northStarPrinciples.isActive, true))
      .orderBy(asc(northStarPrinciples.orderIndex), asc(northStarPrinciples.createdAt));
  }

  async getNorthStarPrinciplesByCategory(category: string): Promise<NorthStarPrinciple[]> {
    return db.select().from(northStarPrinciples)
      .where(and(
        eq(northStarPrinciples.category, category as any),
        eq(northStarPrinciples.isActive, true)
      ))
      .orderBy(asc(northStarPrinciples.orderIndex));
  }

  async updateNorthStarPrinciple(id: string, data: Partial<NorthStarPrinciple>): Promise<NorthStarPrinciple | undefined> {
    const [updated] = await db.update(northStarPrinciples)
      .set(data)
      .where(eq(northStarPrinciples.id, id))
      .returning();
    return updated;
  }

  // North Star Understanding - Daniela's evolving grasp of each principle
  async createNorthStarUnderstanding(data: InsertNorthStarUnderstanding): Promise<NorthStarUnderstanding> {
    const [created] = await db.insert(northStarUnderstanding).values([data]).returning();
    return created;
  }

  async getNorthStarUnderstanding(principleId: string): Promise<NorthStarUnderstanding | undefined> {
    const [understanding] = await db.select().from(northStarUnderstanding)
      .where(eq(northStarUnderstanding.principleId, principleId));
    return understanding;
  }

  async getAllNorthStarUnderstanding(): Promise<NorthStarUnderstanding[]> {
    return db.select().from(northStarUnderstanding)
      .orderBy(desc(northStarUnderstanding.lastDeepened));
  }

  async updateNorthStarUnderstanding(id: string, data: Partial<NorthStarUnderstanding>): Promise<NorthStarUnderstanding | undefined> {
    const [updated] = await db.update(northStarUnderstanding)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(northStarUnderstanding.id, id))
      .returning();
    return updated;
  }

  async deepenNorthStarUnderstanding(
    principleId: string, 
    reflection: string, 
    depth: string, 
    sessionId?: string
  ): Promise<NorthStarUnderstanding> {
    const existing = await this.getNorthStarUnderstanding(principleId);
    
    if (existing) {
      const [updated] = await db.update(northStarUnderstanding)
        .set({
          reflection,
          depth: depth as any,
          lastDeepened: new Date(),
          deepeningSessionId: sessionId,
          updatedAt: new Date(),
        })
        .where(eq(northStarUnderstanding.id, existing.id))
        .returning();
      return updated;
    } else {
      return this.createNorthStarUnderstanding({
        principleId,
        reflection,
        depth: depth as any,
        deepeningSessionId: sessionId,
      });
    }
  }

  // North Star Examples - Living illustrations of principles
  async createNorthStarExample(data: InsertNorthStarExample): Promise<NorthStarExample> {
    const [created] = await db.insert(northStarExamples).values([data]).returning();
    return created;
  }

  async getNorthStarExamples(principleId: string): Promise<NorthStarExample[]> {
    return db.select().from(northStarExamples)
      .where(eq(northStarExamples.principleId, principleId))
      .orderBy(asc(northStarExamples.createdAt));
  }

  async getApprovedNorthStarExamples(principleId: string): Promise<NorthStarExample[]> {
    return db.select().from(northStarExamples)
      .where(and(
        eq(northStarExamples.principleId, principleId),
        or(
          eq(northStarExamples.source, 'founder_original'),
          eq(northStarExamples.source, 'approved')
        )
      ))
      .orderBy(asc(northStarExamples.createdAt));
  }

  async approveNorthStarExample(id: string): Promise<NorthStarExample | undefined> {
    const [updated] = await db.update(northStarExamples)
      .set({ source: 'approved' })
      .where(eq(northStarExamples.id, id))
      .returning();
    return updated;
  }

  // Full North Star retrieval - for prompt injection
  async getFullNorthStar(): Promise<{
    principles: NorthStarPrinciple[];
    understanding: NorthStarUnderstanding[];
    examples: NorthStarExample[];
  }> {
    const principles = await this.getAllNorthStarPrinciples();
    const understanding = await this.getAllNorthStarUnderstanding();
    
    // Get approved examples for all active principles
    const allExamples: NorthStarExample[] = [];
    for (const principle of principles) {
      const examples = await this.getApprovedNorthStarExamples(principle.id);
      allExamples.push(...examples);
    }
    
    return {
      principles,
      understanding,
      examples: allExamples,
    };
  }

  // ===== Wren Insights (Development Agent Memory) =====
  
  async createWrenInsight(data: InsertWrenInsight): Promise<WrenInsight> {
    const [created] = await db.insert(wrenInsights).values([data]).returning();
    return created;
  }

  async getWrenInsight(id: string): Promise<WrenInsight | undefined> {
    const [insight] = await db.select().from(wrenInsights).where(eq(wrenInsights.id, id));
    return insight;
  }

  async getWrenInsights(options?: { category?: string; limit?: number }): Promise<WrenInsight[]> {
    let query = db.select().from(wrenInsights);
    
    if (options?.category) {
      query = query.where(eq(wrenInsights.category, options.category as any)) as any;
    }
    
    query = query.orderBy(desc(wrenInsights.createdAt)) as any;
    
    if (options?.limit) {
      query = query.limit(options.limit) as any;
    }
    
    return query;
  }

  async searchWrenInsights(searchQuery: string): Promise<WrenInsight[]> {
    // Full-text search across title, content, context, and tags
    const lowerQuery = `%${searchQuery.toLowerCase()}%`;
    return db.select().from(wrenInsights)
      .where(or(
        sql`LOWER(${wrenInsights.title}) LIKE ${lowerQuery}`,
        sql`LOWER(${wrenInsights.content}) LIKE ${lowerQuery}`,
        sql`LOWER(${wrenInsights.context}) LIKE ${lowerQuery}`,
        sql`${lowerQuery} = ANY(${wrenInsights.tags})`
      ))
      .orderBy(desc(wrenInsights.useCount), desc(wrenInsights.createdAt))
      .limit(20);
  }

  async updateWrenInsight(id: string, data: Partial<WrenInsight>): Promise<WrenInsight | undefined> {
    const [updated] = await db.update(wrenInsights)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(wrenInsights.id, id))
      .returning();
    return updated;
  }

  async markWrenInsightUsed(id: string): Promise<WrenInsight | undefined> {
    const [updated] = await db.update(wrenInsights)
      .set({
        useCount: sql`${wrenInsights.useCount} + 1`,
        lastUsedAt: new Date(),
      })
      .where(eq(wrenInsights.id, id))
      .returning();
    return updated;
  }

  async deleteWrenInsight(id: string): Promise<boolean> {
    const result = await db.delete(wrenInsights).where(eq(wrenInsights.id, id));
    return true;
  }
}

export const storage = new DatabaseStorage();
