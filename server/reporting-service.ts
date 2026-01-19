import { getUserDb, getSharedDb } from "./db";
import {
  users,
  userProgress,
  progressHistory,
  conversations,
  vocabularyWords,
  studentCanDoProgress,
  canDoStatements,
  classEnrollments,
  teacherClasses,
  assignments,
  assignmentSubmissions,
} from "@shared/schema";
import { eq, and, gte, sql, desc } from "drizzle-orm";
import { toExternalActflLevel } from "./actfl-utils";

// Helper to get user's full name
function getUserFullName(user: any): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  if (user.firstName) return user.firstName;
  if (user.lastName) return user.lastName;
  return user.email || "Student";
}

/**
 * Reporting Service for HolaHola
 * Generates student progress reports, class summaries, and parent/guardian reports
 */

export interface StudentProgressReport {
  student: {
    id: string;
    name: string;
    email: string | null;
    targetLanguage: string | null;
    nativeLanguage: string | null;
    currentActflLevel: string;
    subscriptionTier: string;
  };
  overallProgress: {
    wordsLearned: number;
    practiceMinutes: number;
    totalHours: number;
    conversationsCompleted: number;
    currentStreak: number;
    longestStreak: number;
    totalPracticeDays: number;
  };
  proficiencyTrajectory: {
    startLevel: string;
    currentLevel: string;
    nextLevel: string;
    progressPercent: number;
    timeInCurrentLevel: number; // days
  };
  recentActivity: {
    last7Days: {
      practiceMinutes: number;
      conversationsCount: number;
      wordsLearned: number;
    };
    last30Days: {
      practiceMinutes: number;
      conversationsCount: number;
      wordsLearned: number;
    };
  };
  canDoAchievements: {
    total: number;
    selfAssessed: number;
    teacherVerified: number;
    aiDetected: number;
    byCategory: {
      interpersonal: number;
      interpretive: number;
      presentational: number;
    };
  };
  strengths: string[];
  areasForImprovement: string[];
  recommendations: string[];
  generatedAt: Date;
}

export interface ClassSummaryReport {
  class: {
    id: string;
    name: string;
    language: string;
    teacherName: string;
    studentCount: number;
  };
  proficiencyDistribution: {
    [level: string]: number; // ACTFL level → count of students
  };
  engagementMetrics: {
    averagePracticeMinutes: number;
    averageWordsLearned: number;
    averageConversations: number;
    activeStudentsLast7Days: number;
    activeStudentsLast30Days: number;
  };
  topPerformers: Array<{
    studentName: string;
    actflLevel: string | null;
    practiceMinutes: number;
    wordsLearned: number;
  }>;
  studentsNeedingSupport: Array<{
    studentName: string;
    lastActiveDate: string;
    practiceMinutes: number;
  }>;
  assignmentCompletion: {
    totalAssignments: number;
    averageCompletionRate: number;
    averageScore: number;
  };
  generatedAt: Date;
}

export interface ParentGuardianReport {
  student: {
    name: string;
    targetLanguage: string;
    currentActflLevel: string;
  };
  summary: {
    totalPracticeTime: string; // "12 hours 30 minutes"
    proficiencyGrowth: string; // "Novice Low → Novice Mid"
    wordsLearned: number;
    streakDays: number;
  };
  achievements: string[];
  recentMilestones: string[];
  nextSteps: string[];
  parentTips: string[];
  generatedAt: Date;
}

/**
 * Generate comprehensive student progress report
 */
export async function generateStudentProgressReport(
  userId: string
): Promise<StudentProgressReport> {
  // Fetch user data
  const [user] = await getUserDb().select().from(users).where(eq(users.id, userId));
  if (!user) {
    throw new Error("User not found");
  }

  // Fetch language-specific progress
  const [progress] = await getUserDb()
    .select()
    .from(userProgress)
    .where(
      and(
        eq(userProgress.userId, userId),
        eq(userProgress.language, user.targetLanguage || "spanish")
      )
    );

  // Fetch conversations for overall count
  const userConversations = await getUserDb()
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId));

  // Fetch Can-Do achievements
  const canDoProgress = await getUserDb()
    .select({
      id: studentCanDoProgress.id,
      selfAssessed: studentCanDoProgress.selfAssessed,
      teacherVerified: studentCanDoProgress.teacherVerified,
      aiDetected: studentCanDoProgress.aiDetected,
      category: canDoStatements.category,
    })
    .from(studentCanDoProgress)
    .leftJoin(
      canDoStatements,
      eq(studentCanDoProgress.canDoStatementId, canDoStatements.id)
    )
    .where(eq(studentCanDoProgress.userId, userId));

  // Calculate recent activity (last 7 and 30 days)
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const recentHistory = await getUserDb()
    .select()
    .from(progressHistory)
    .where(
      and(
        eq(progressHistory.userId, userId),
        gte(progressHistory.date, thirtyDaysAgo)
      )
    )
    .orderBy(desc(progressHistory.date));

  const last7DaysHistory = recentHistory.filter(
    (h) => new Date(h.date) >= sevenDaysAgo
  );

  const last7DaysActivity = {
    practiceMinutes: last7DaysHistory.reduce(
      (sum, h) => sum + h.practiceMinutes,
      0
    ),
    conversationsCount: last7DaysHistory.reduce(
      (sum, h) => sum + h.conversationsCount,
      0
    ),
    wordsLearned: last7DaysHistory.reduce((sum, h) => sum + h.wordsLearned, 0),
  };

  const last30DaysActivity = {
    practiceMinutes: recentHistory.reduce((sum, h) => sum + h.practiceMinutes, 0),
    conversationsCount: recentHistory.reduce(
      (sum, h) => sum + h.conversationsCount,
      0
    ),
    wordsLearned: recentHistory.reduce((sum, h) => sum + h.wordsLearned, 0),
  };

  // Can-Do achievements breakdown
  const canDoByCategory = {
    interpersonal: canDoProgress.filter((c) => c.category === "interpersonal")
      .length,
    interpretive: canDoProgress.filter((c) => c.category === "interpretive")
      .length,
    presentational: canDoProgress.filter((c) => c.category === "presentational")
      .length,
  };

  // Calculate proficiency trajectory
  const actflLevels = [
    "novice_low",
    "novice_mid",
    "novice_high",
    "intermediate_low",
    "intermediate_mid",
    "intermediate_high",
    "advanced_low",
    "advanced_mid",
    "advanced_high",
  ];

  const currentLevel = user.actflLevel || "novice_low";
  const currentIndex = actflLevels.indexOf(currentLevel);
  const nextLevel =
    currentIndex < actflLevels.length - 1
      ? actflLevels[currentIndex + 1]
      : currentLevel;

  // Generate AI-powered insights
  const strengths = generateStrengths(progress, canDoProgress);
  const areasForImprovement = generateAreasForImprovement(progress);
  const recommendations = generateRecommendations(
    user,
    progress,
    last7DaysActivity
  );

  return {
    student: {
      id: user.id,
      name: getUserFullName(user),
      email: user.email || "",
      targetLanguage: user.targetLanguage || "",
      nativeLanguage: user.nativeLanguage || "english",
      currentActflLevel: toExternalActflLevel(user.actflLevel || "novice_low"),
      subscriptionTier: user.subscriptionTier || "free",
    },
    overallProgress: {
      wordsLearned: progress?.wordsLearned || 0,
      practiceMinutes: progress?.practiceMinutes || 0,
      totalHours: Math.round((progress?.practiceMinutes || 0) / 60),
      conversationsCompleted: userConversations.length,
      currentStreak: progress?.currentStreak || 0,
      longestStreak: progress?.longestStreak || 0,
      totalPracticeDays: progress?.totalPracticeDays || 0,
    },
    proficiencyTrajectory: {
      startLevel: "Novice Low", // TODO: track actual start level
      currentLevel: toExternalActflLevel(currentLevel),
      nextLevel: toExternalActflLevel(nextLevel),
      progressPercent: calculateProgressPercent(currentLevel),
      timeInCurrentLevel: progress?.totalPracticeDays || 0,
    },
    recentActivity: {
      last7Days: last7DaysActivity,
      last30Days: last30DaysActivity,
    },
    canDoAchievements: {
      total: canDoProgress.length,
      selfAssessed: canDoProgress.filter((c) => c.selfAssessed).length,
      teacherVerified: canDoProgress.filter((c) => c.teacherVerified).length,
      aiDetected: canDoProgress.filter((c) => c.aiDetected).length,
      byCategory: canDoByCategory,
    },
    strengths,
    areasForImprovement,
    recommendations,
    generatedAt: new Date(),
  };
}

/**
 * Generate class summary report for teachers
 */
export async function generateClassSummaryReport(
  classId: string,
  teacherId: string
): Promise<ClassSummaryReport> {
  // Verify teacher owns this class
  const [teacherClass] = await getUserDb()
    .select()
    .from(teacherClasses)
    .where(
      and(
        eq(teacherClasses.id, classId),
        eq(teacherClasses.teacherId, teacherId)
      )
    );

  if (!teacherClass) {
    throw new Error("Class not found or unauthorized");
  }

  // Fetch teacher info
  const [teacher] = await getUserDb()
    .select()
    .from(users)
    .where(eq(users.id, teacherId));

  // Fetch all enrolled students
  const enrollments = await getUserDb()
    .select({
      studentId: classEnrollments.studentId,
      student: users,
    })
    .from(classEnrollments)
    .leftJoin(users, eq(classEnrollments.studentId, users.id))
    .where(
      and(
        eq(classEnrollments.classId, classId),
        eq(classEnrollments.isActive, true)
      )
    );

  // Fetch progress for all students
  const studentProgresses = await Promise.all(
    enrollments.map(async (enrollment) => {
      if (!enrollment.student) return null;
      const [progress] = await getUserDb()
        .select()
        .from(userProgress)
        .where(
          and(
            eq(userProgress.userId, enrollment.student.id),
            eq(userProgress.language, teacherClass.language)
          )
        );
      return { student: enrollment.student, progress };
    })
  );

  const validProgresses = studentProgresses.filter((p) => p !== null);

  // Calculate proficiency distribution
  const proficiencyDistribution: { [level: string]: number } = {};
  validProgresses.forEach((p) => {
    const actflLevel = p!.student.actflLevel || "novice_low";
    const level = toExternalActflLevel(actflLevel);
    if (level) {
      proficiencyDistribution[level] = (proficiencyDistribution[level] || 0) + 1;
    }
  });

  // Calculate engagement metrics
  const averagePracticeMinutes =
    validProgresses.reduce(
      (sum, p) => sum + (p!.progress?.practiceMinutes || 0),
      0
    ) / validProgresses.length;

  const averageWordsLearned =
    validProgresses.reduce(
      (sum, p) => sum + (p!.progress?.wordsLearned || 0),
      0
    ) / validProgresses.length;

  const averageConversations =
    validProgresses.reduce(
      (sum, p) => sum + (p!.student.totalConversations || 0),
      0
    ) / validProgresses.length;

  // Find top performers (by practice time)
  const topPerformers = validProgresses
    .sort(
      (a, b) =>
        (b!.progress?.practiceMinutes || 0) -
        (a!.progress?.practiceMinutes || 0)
    )
    .slice(0, 5)
    .map((p) => ({
      studentName: getUserFullName(p!.student),
      actflLevel: toExternalActflLevel(p!.student.actflLevel || "novice_low"),
      practiceMinutes: p!.progress?.practiceMinutes || 0,
      wordsLearned: p!.progress?.wordsLearned || 0,
    }));

  // Find students needing support (inactive for 7+ days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const studentsNeedingSupport = validProgresses
    .filter(
      (p) =>
        !p!.progress?.lastPracticeDate ||
        new Date(p!.progress.lastPracticeDate) < sevenDaysAgo
    )
    .map((p) => ({
      studentName: getUserFullName(p!.student),
      lastActiveDate: p!.progress?.lastPracticeDate
        ? new Date(p!.progress.lastPracticeDate).toLocaleDateString()
        : "Never",
      practiceMinutes: p!.progress?.practiceMinutes || 0,
    }));

  // Fetch assignment completion stats
  const classAssignments = await getUserDb()
    .select()
    .from(assignments)
    .where(eq(assignments.classId, classId));

  let totalSubmissions = 0;
  let totalPossible = 0;
  let totalScore = 0;
  let scoredSubmissions = 0;

  for (const assignment of classAssignments) {
    const submissionsForAssignment = await getUserDb()
      .select()
      .from(assignmentSubmissions)
      .where(eq(assignmentSubmissions.assignmentId, assignment.id));

    totalSubmissions += submissionsForAssignment.length;
    totalPossible += enrollments.length;

    submissionsForAssignment.forEach((sub) => {
      if (sub.teacherScore !== null) {
        totalScore += sub.teacherScore;
        scoredSubmissions++;
      }
    });
  }

  const averageCompletionRate =
    totalPossible > 0 ? (totalSubmissions / totalPossible) * 100 : 0;
  const averageScore = scoredSubmissions > 0 ? totalScore / scoredSubmissions : 0;

  return {
    class: {
      id: teacherClass.id,
      name: teacherClass.name,
      language: teacherClass.language,
      teacherName: teacher ? getUserFullName(teacher) : "Teacher",
      studentCount: enrollments.length,
    },
    proficiencyDistribution,
    engagementMetrics: {
      averagePracticeMinutes: Math.round(averagePracticeMinutes),
      averageWordsLearned: Math.round(averageWordsLearned),
      averageConversations: Math.round(averageConversations),
      activeStudentsLast7Days: validProgresses.filter(
        (p) =>
          p!.progress?.lastPracticeDate &&
          new Date(p!.progress.lastPracticeDate) >= sevenDaysAgo
      ).length,
      activeStudentsLast30Days: validProgresses.filter(
        (p) => p!.progress?.lastPracticeDate
      ).length,
    },
    topPerformers,
    studentsNeedingSupport,
    assignmentCompletion: {
      totalAssignments: classAssignments.length,
      averageCompletionRate: Math.round(averageCompletionRate),
      averageScore: Math.round(averageScore),
    },
    generatedAt: new Date(),
  };
}

/**
 * Generate parent/guardian report (student-friendly summary)
 */
export async function generateParentReport(
  userId: string
): Promise<ParentGuardianReport> {
  const fullReport = await generateStudentProgressReport(userId);

  // Convert practice time to human-readable format
  const hours = Math.floor(fullReport.overallProgress.practiceMinutes / 60);
  const minutes = fullReport.overallProgress.practiceMinutes % 60;
  const totalPracticeTime = `${hours} hour${hours !== 1 ? "s" : ""} ${minutes} minute${minutes !== 1 ? "s" : ""}`;

  // Generate achievements list
  const achievements = [
    `Learned ${fullReport.overallProgress.wordsLearned} new words`,
    `Completed ${fullReport.overallProgress.conversationsCompleted} conversation${fullReport.overallProgress.conversationsCompleted !== 1 ? "s" : ""}`,
    `Maintained a ${fullReport.overallProgress.currentStreak}-day practice streak`,
    `Achieved ${fullReport.canDoAchievements.total} Can-Do statement${fullReport.canDoAchievements.total !== 1 ? "s" : ""}`,
  ];

  // Recent milestones
  const milestones = [
    ...(fullReport.canDoAchievements.teacherVerified > 0
      ? [`${fullReport.canDoAchievements.teacherVerified} teacher-verified skill${fullReport.canDoAchievements.teacherVerified !== 1 ? "s" : ""}`]
      : []),
    ...(fullReport.overallProgress.longestStreak >= 7
      ? [`Longest streak: ${fullReport.overallProgress.longestStreak} days`]
      : []),
  ];

  // Parent tips
  const parentTips = [
    "Encourage daily practice, even if just 10 minutes",
    "Ask your child to teach you a few words in their target language",
    "Celebrate milestones and progress, not just test scores",
    "Consider using the target language during family meals or activities",
  ];

  return {
    student: {
      name: fullReport.student.name,
      targetLanguage: fullReport.student.targetLanguage,
      currentActflLevel: fullReport.student.currentActflLevel,
    },
    summary: {
      totalPracticeTime,
      proficiencyGrowth: `${fullReport.proficiencyTrajectory.startLevel} → ${fullReport.proficiencyTrajectory.currentLevel}`,
      wordsLearned: fullReport.overallProgress.wordsLearned,
      streakDays: fullReport.overallProgress.currentStreak,
    },
    achievements,
    recentMilestones: milestones,
    nextSteps: fullReport.recommendations,
    parentTips,
    generatedAt: new Date(),
  };
}

// Helper functions

function generateStrengths(progress: any, canDoProgress: any[]): string[] {
  const strengths = [];

  if (progress?.practiceMinutes > 300) {
    strengths.push("Consistent practice schedule");
  }

  if (progress?.wordsLearned > 100) {
    strengths.push("Strong vocabulary retention");
  }

  if (canDoProgress.filter((c) => c.aiDetected).length > 5) {
    strengths.push("Demonstrates skills in real conversations");
  }

  if (progress?.currentStreak >= 7) {
    strengths.push("Excellent practice consistency");
  }

  return strengths.length > 0
    ? strengths
    : ["Building foundational skills"];
}

function generateAreasForImprovement(progress: any): string[] {
  const areas = [];

  if (!progress || progress.practiceMinutes < 60) {
    areas.push("Increase weekly practice time");
  }

  if (!progress || progress.wordsLearned < 20) {
    areas.push("Focus on vocabulary acquisition");
  }

  if (!progress || progress.currentStreak < 3) {
    areas.push("Build a consistent daily practice habit");
  }

  return areas.length > 0 ? areas : ["Continue current progress"];
}

function generateRecommendations(
  user: any,
  progress: any,
  recentActivity: any
): string[] {
  const recommendations = [];

  if (recentActivity.practiceMinutes < 60) {
    recommendations.push(
      "Aim for at least 15 minutes of practice per day this week"
    );
  }

  if (!progress || progress.wordsLearned < 50) {
    recommendations.push(
      "Review vocabulary flashcards after each conversation"
    );
  }

  if (recentActivity.conversationsCount < 3) {
    recommendations.push(
      "Try practicing with different conversation topics to build versatility"
    );
  }

  recommendations.push(
    "Keep up the great work and maintain your practice streak!"
  );

  return recommendations;
}

function calculateProgressPercent(actflLevel: string): number {
  const levels = [
    "novice_low",
    "novice_mid",
    "novice_high",
    "intermediate_low",
    "intermediate_mid",
    "intermediate_high",
    "advanced_low",
    "advanced_mid",
    "advanced_high",
  ];

  const index = levels.indexOf(actflLevel);
  if (index === -1) return 0;

  return Math.round((index / (levels.length - 1)) * 100);
}

/**
 * Export report to CSV format
 */
export function exportReportToCSV(report: StudentProgressReport): string {
  const rows = [
    ["Student Progress Report"],
    ["Generated", report.generatedAt.toLocaleDateString()],
    [""],
    ["Student Information"],
    ["Name", report.student.name],
    ["Email", report.student.email],
    ["Target Language", report.student.targetLanguage],
    ["Current Proficiency", report.student.currentActflLevel],
    [""],
    ["Overall Progress"],
    ["Words Learned", report.overallProgress.wordsLearned.toString()],
    [
      "Total Practice Time",
      `${report.overallProgress.totalHours} hours`,
    ],
    [
      "Conversations Completed",
      report.overallProgress.conversationsCompleted.toString(),
    ],
    ["Current Streak", `${report.overallProgress.currentStreak} days`],
    [
      "Longest Streak",
      `${report.overallProgress.longestStreak} days`,
    ],
    [""],
    ["Recent Activity (Last 7 Days)"],
    [
      "Practice Minutes",
      report.recentActivity.last7Days.practiceMinutes.toString(),
    ],
    [
      "Conversations",
      report.recentActivity.last7Days.conversationsCount.toString(),
    ],
    [
      "Words Learned",
      report.recentActivity.last7Days.wordsLearned.toString(),
    ],
    [""],
    ["Can-Do Achievements"],
    ["Total Achieved", report.canDoAchievements.total.toString()],
    [
      "Teacher Verified",
      report.canDoAchievements.teacherVerified.toString(),
    ],
    ["AI Detected", report.canDoAchievements.aiDetected.toString()],
  ];

  return rows.map((row) => row.join(",")).join("\n");
}
