/**
 * Syllabus Analytics Service
 * 
 * Provides time tracking analytics for syllabus progress:
 * - Expected vs actual time per lesson/unit
 * - Student pacing insights
 * - Credit consumption per lesson
 */

import { getUserDb } from "../db";
import { 
  syllabusProgress, 
  curriculumLessons, 
  curriculumUnits,
  voiceSessions, 
  conversations,
  classCurriculumUnits,
  classCurriculumLessons,
  teacherClasses
} from "@shared/schema";
import { eq, and, sql, desc, inArray, isNotNull } from "drizzle-orm";

export interface LessonTimeData {
  lessonId: string;
  lessonName: string;
  unitId: string;
  unitName: string;
  expectedMinutes: number | null;
  actualMinutes: number;
  status: string;
  completedAt: Date | null;
  paceIndicator: 'ahead' | 'on_track' | 'behind' | 'not_started';
}

export interface UnitTimeData {
  unitId: string;
  unitName: string;
  orderIndex: number;
  expectedMinutes: number;
  actualMinutes: number;
  lessonsTotal: number;
  lessonsCompleted: number;
  lessonsInProgress: number;
  paceIndicator: 'ahead' | 'on_track' | 'behind' | 'not_started';
  lessons: LessonTimeData[];
}

export interface StudentSyllabusTimeData {
  studentId: string;
  classId: string;
  className: string;
  language: string;
  totalExpectedMinutes: number;
  totalActualMinutes: number;
  overallPace: 'ahead' | 'on_track' | 'behind';
  units: UnitTimeData[];
}

export interface CreditBalanceDisplay {
  remainingMinutes: number;
  estimatedSessionsLeft: number;
  isLow: boolean;
  source: 'unlimited' | 'class_allocation' | 'purchased';
}

class SyllabusAnalyticsService {
  /**
   * Get student's syllabus time data for a specific class
   * Includes expected vs actual time per lesson and unit
   */
  async getStudentSyllabusTime(
    studentId: string, 
    classId: string
  ): Promise<StudentSyllabusTimeData | null> {
    try {
      // Get class info
      const classInfo = await getUserDb()
        .select({
          id: teacherClasses.id,
          name: teacherClasses.name,
          language: teacherClasses.language,
        })
        .from(teacherClasses)
        .where(eq(teacherClasses.id, classId))
        .limit(1);

      if (!classInfo[0]) {
        console.error(`[SyllabusAnalytics] Class not found: ${classId}`);
        return null;
      }

      // Get class syllabus structure (units and lessons)
      const syllabusUnits = await getUserDb()
        .select({
          unitId: classCurriculumUnits.id,
          unitName: classCurriculumUnits.name,
          orderIndex: classCurriculumUnits.orderIndex,
        })
        .from(classCurriculumUnits)
        .where(
          and(
            eq(classCurriculumUnits.classId, classId),
            eq(classCurriculumUnits.isRemoved, false)
          )
        )
        .orderBy(classCurriculumUnits.orderIndex);

      if (syllabusUnits.length === 0) {
        // No syllabus configured for this class
        return {
          studentId,
          classId,
          className: classInfo[0].name,
          language: classInfo[0].language,
          totalExpectedMinutes: 0,
          totalActualMinutes: 0,
          overallPace: 'on_track',
          units: [],
        };
      }

      const unitIds = syllabusUnits.map(u => u.unitId);

      // Get lessons for all units with their progress
      const lessonsWithProgress = await getUserDb()
        .select({
          lessonId: classCurriculumLessons.id,
          lessonName: classCurriculumLessons.name,
          unitId: classCurriculumLessons.classUnitId,
          expectedMinutes: classCurriculumLessons.estimatedMinutes,
          orderIndex: classCurriculumLessons.orderIndex,
          sourceLessonId: classCurriculumLessons.sourceLessonId,
          // Progress data
          progressStatus: syllabusProgress.status,
          completedAt: syllabusProgress.completedAt,
          evidenceConversationId: syllabusProgress.evidenceConversationId,
        })
        .from(classCurriculumLessons)
        .leftJoin(
          syllabusProgress,
          and(
            eq(syllabusProgress.lessonId, classCurriculumLessons.sourceLessonId),
            eq(syllabusProgress.studentId, studentId),
            eq(syllabusProgress.classId, classId)
          )
        )
        .where(
          and(
            inArray(classCurriculumLessons.classUnitId, unitIds),
            eq(classCurriculumLessons.isRemoved, false)
          )
        )
        .orderBy(classCurriculumLessons.orderIndex);

      // Get actual time spent from voice sessions linked to evidence conversations
      const conversationIds = lessonsWithProgress
        .filter(l => l.evidenceConversationId)
        .map(l => l.evidenceConversationId as string);

      let conversationTimes: Map<string, number> = new Map();
      if (conversationIds.length > 0) {
        const sessionTimes = await getUserDb()
          .select({
            conversationId: voiceSessions.conversationId,
            totalSeconds: sql<number>`SUM(COALESCE(${voiceSessions.durationSeconds}, 0))`.as('total_seconds'),
          })
          .from(voiceSessions)
          .where(inArray(voiceSessions.conversationId, conversationIds))
          .groupBy(voiceSessions.conversationId);

        for (const st of sessionTimes) {
          if (st.conversationId) {
            conversationTimes.set(st.conversationId, st.totalSeconds);
          }
        }
      }

      // Build units with lessons
      const units: UnitTimeData[] = [];
      let totalExpectedMinutes = 0;
      let totalActualMinutes = 0;

      for (const unit of syllabusUnits) {
        const unitLessons = lessonsWithProgress.filter(l => l.unitId === unit.unitId);
        
        let unitExpected = 0;
        let unitActual = 0;
        let lessonsCompleted = 0;
        let lessonsInProgress = 0;

        const lessons: LessonTimeData[] = unitLessons.map(lesson => {
          const expected = lesson.expectedMinutes || 0;
          const actualSeconds = lesson.evidenceConversationId 
            ? (conversationTimes.get(lesson.evidenceConversationId) || 0)
            : 0;
          const actualMinutes = Math.round(actualSeconds / 60);

          unitExpected += expected;
          unitActual += actualMinutes;

          const status = lesson.progressStatus || 'not_started';
          if (status === 'completed_early' || status === 'completed_assigned') {
            lessonsCompleted++;
          } else if (status === 'in_progress') {
            lessonsInProgress++;
          }

          // Calculate pace indicator
          let paceIndicator: LessonTimeData['paceIndicator'] = 'not_started';
          if (status !== 'not_started' && status !== 'skipped') {
            if (expected > 0) {
              const ratio = actualMinutes / expected;
              if (ratio < 0.8) paceIndicator = 'ahead';
              else if (ratio <= 1.2) paceIndicator = 'on_track';
              else paceIndicator = 'behind';
            } else {
              paceIndicator = 'on_track';
            }
          }

          return {
            lessonId: lesson.lessonId,
            lessonName: lesson.lessonName,
            unitId: unit.unitId,
            unitName: unit.unitName,
            expectedMinutes: expected,
            actualMinutes,
            status,
            completedAt: lesson.completedAt,
            paceIndicator,
          };
        });

        // Calculate unit pace indicator
        let unitPace: UnitTimeData['paceIndicator'] = 'not_started';
        if (lessonsCompleted > 0 || lessonsInProgress > 0) {
          if (unitExpected > 0) {
            const ratio = unitActual / unitExpected;
            if (ratio < 0.8) unitPace = 'ahead';
            else if (ratio <= 1.2) unitPace = 'on_track';
            else unitPace = 'behind';
          } else {
            unitPace = 'on_track';
          }
        }

        units.push({
          unitId: unit.unitId,
          unitName: unit.unitName,
          orderIndex: unit.orderIndex,
          expectedMinutes: unitExpected,
          actualMinutes: unitActual,
          lessonsTotal: unitLessons.length,
          lessonsCompleted,
          lessonsInProgress,
          paceIndicator: unitPace,
          lessons,
        });

        totalExpectedMinutes += unitExpected;
        totalActualMinutes += unitActual;
      }

      // Calculate overall pace
      let overallPace: StudentSyllabusTimeData['overallPace'] = 'on_track';
      if (totalExpectedMinutes > 0) {
        const ratio = totalActualMinutes / totalExpectedMinutes;
        if (ratio < 0.8) overallPace = 'ahead';
        else if (ratio > 1.2) overallPace = 'behind';
      }

      return {
        studentId,
        classId,
        className: classInfo[0].name,
        language: classInfo[0].language,
        totalExpectedMinutes,
        totalActualMinutes,
        overallPace,
        units,
      };
    } catch (error) {
      console.error('[SyllabusAnalytics] Failed to get student syllabus time:', error);
      return null;
    }
  }

  /**
   * Get summary stats for a student's learning pace
   * Used for dashboard cards and quick insights
   */
  async getStudentPaceSummary(
    studentId: string,
    classId?: string
  ): Promise<{
    totalLessonsCompleted: number;
    totalMinutesLearned: number;
    averageMinutesPerLesson: number;
    weeklyMinutes: number[];
    streakDays: number;
  } | null> {
    try {
      // Get completed lessons count
      const completedQuery = getUserDb()
        .select({
          count: sql<number>`COUNT(*)`.as('count'),
        })
        .from(syllabusProgress)
        .where(
          and(
            eq(syllabusProgress.studentId, studentId),
            inArray(syllabusProgress.status, ['completed_early', 'completed_assigned']),
            classId ? eq(syllabusProgress.classId, classId) : undefined
          )
        );

      const completed = await completedQuery;
      const totalLessonsCompleted = completed[0]?.count || 0;

      // Get total minutes from voice sessions
      const sessionsQuery = await getUserDb()
        .select({
          totalSeconds: sql<number>`SUM(COALESCE(${voiceSessions.durationSeconds}, 0))`.as('total'),
        })
        .from(voiceSessions)
        .where(
          and(
            eq(voiceSessions.userId, studentId),
            classId ? eq(voiceSessions.classId, classId) : undefined
          )
        );

      const totalMinutesLearned = Math.round((sessionsQuery[0]?.totalSeconds || 0) / 60);
      const averageMinutesPerLesson = totalLessonsCompleted > 0 
        ? Math.round(totalMinutesLearned / totalLessonsCompleted)
        : 0;

      // Get weekly minutes (last 8 weeks)
      const weeklyData = await getUserDb()
        .select({
          weekStart: sql<Date>`DATE_TRUNC('week', ${voiceSessions.startedAt})`.as('week_start'),
          minutes: sql<number>`ROUND(SUM(COALESCE(${voiceSessions.durationSeconds}, 0)) / 60)`.as('minutes'),
        })
        .from(voiceSessions)
        .where(
          and(
            eq(voiceSessions.userId, studentId),
            sql`${voiceSessions.startedAt} >= NOW() - INTERVAL '8 weeks'`,
            classId ? eq(voiceSessions.classId, classId) : undefined
          )
        )
        .groupBy(sql`DATE_TRUNC('week', ${voiceSessions.startedAt})`)
        .orderBy(sql`DATE_TRUNC('week', ${voiceSessions.startedAt})`);

      const weeklyMinutes = weeklyData.map(w => w.minutes);

      // Simple streak calculation (days with any activity in last 30 days)
      const streakData = await getUserDb()
        .select({
          activityDate: sql<Date>`DATE(${voiceSessions.startedAt})`.as('activity_date'),
        })
        .from(voiceSessions)
        .where(
          and(
            eq(voiceSessions.userId, studentId),
            sql`${voiceSessions.startedAt} >= NOW() - INTERVAL '30 days'`
          )
        )
        .groupBy(sql`DATE(${voiceSessions.startedAt})`)
        .orderBy(desc(sql`DATE(${voiceSessions.startedAt})`));

      // Count consecutive days from today
      let streakDays = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      for (const row of streakData) {
        const activityDate = new Date(row.activityDate);
        activityDate.setHours(0, 0, 0, 0);
        const expectedDate = new Date(today);
        expectedDate.setDate(expectedDate.getDate() - streakDays);
        
        if (activityDate.getTime() === expectedDate.getTime()) {
          streakDays++;
        } else {
          break;
        }
      }

      return {
        totalLessonsCompleted,
        totalMinutesLearned,
        averageMinutesPerLesson,
        weeklyMinutes,
        streakDays,
      };
    } catch (error) {
      console.error('[SyllabusAnalytics] Failed to get pace summary:', error);
      return null;
    }
  }
}

export const syllabusAnalyticsService = new SyllabusAnalyticsService();
