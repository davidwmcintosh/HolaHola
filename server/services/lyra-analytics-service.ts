import { getSharedDb } from '../db';
import { sql } from 'drizzle-orm';
import { callGeminiWithSchema, GEMINI_MODELS } from '../gemini-utils';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

export interface LyraInsight {
  category: 'content_quality' | 'content_freshness' | 'student_success' | 'onboarding' | 'coverage_gap';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  confidence: number;
  title: string;
  description: string;
  data: Record<string, any>;
  recommendation: string;
  needsReview: boolean;
}

interface ContentAuditData {
  staleContent: Array<{ id: string; name: string; unit: string; path: string; language: string; updatedAt: string; daysSinceUpdate: number }>;
  emptyDescriptions: Array<{ id: string; name: string; type: string; language: string }>;
  missingActflLevels: Array<{ id: string; name: string; type: string; language: string }>;
  orphanedDrills: Array<{ id: string; prompt: string; lessonName: string }>;
  languageCoverage: Array<{ language: string; pathCount: number; unitCount: number; lessonCount: number; drillCount: number }>;
  templatedContent: Array<{ language: string; templated_count: number; total_count: number; pct_templated: number }>;
}

interface StudentSuccessData {
  lessonDropoff: Array<{ lessonId: string; lessonName: string; unitName: string; language: string; startedCount: number; completedCount: number; completionRate: number }>;
  drillStruggles: Array<{ drillItemId: string; prompt: string; targetText: string; language: string; avgScore: number; attemptCount: number; userCount: number }>;
  streakBreakers: Array<{ language: string; avgStreak: number; brokenStreaks: number; activeUsers: number }>;
  actflBottlenecks: Array<{ language: string; avgTasksCompleted: number; avgPronunciation: number; userCount: number }>;
}

interface OnboardingData {
  totalUsers: number;
  usersWithConversation: number;
  conversionRate: number;
  avgDaysToFirstChat: number;
  returnRate7d: number;
  recentSignups: Array<{ daysSinceSignup: number; hasConversation: boolean; conversationCount: number }>;
}

export class LyraAnalyticsService {

  async gatherContentAuditData(): Promise<ContentAuditData> {
    const db = getSharedDb();

    const staleContent = await db.execute(sql`
      SELECT cl.id, cl.name, cu.name as unit_name, cp.name as path_name, 
             cp.language, cl.updated_at,
             EXTRACT(DAY FROM NOW() - cl.updated_at)::int as days_since_update
      FROM curriculum_lessons cl
      JOIN curriculum_units cu ON cl.curriculum_unit_id = cu.id
      JOIN curriculum_paths cp ON cu.curriculum_path_id = cp.id
      WHERE cl.updated_at < NOW() - INTERVAL '90 days'
      ORDER BY cl.updated_at ASC
      LIMIT 50
    `);

    const emptyDescriptions = await db.execute(sql`
      SELECT cl.id, cl.name, cl.lesson_type as type, cp.language
      FROM curriculum_lessons cl
      JOIN curriculum_units cu ON cl.curriculum_unit_id = cu.id
      JOIN curriculum_paths cp ON cu.curriculum_path_id = cp.id
      WHERE cl.description IS NULL OR TRIM(cl.description) = ''
      LIMIT 30
    `);

    const missingActflLevels = await db.execute(sql`
      SELECT cl.id, cl.name, cl.lesson_type as type, cp.language
      FROM curriculum_lessons cl
      JOIN curriculum_units cu ON cl.curriculum_unit_id = cu.id
      JOIN curriculum_paths cp ON cu.curriculum_path_id = cp.id
      WHERE cl.actfl_level IS NULL OR TRIM(cl.actfl_level) = ''
      LIMIT 30
    `);

    const orphanedDrills = await db.execute(sql`
      SELECT di.id, di.prompt, cl.name as lesson_name
      FROM curriculum_drill_items di
      JOIN curriculum_lessons cl ON di.lesson_id = cl.id
      WHERE cl.lesson_type != 'drill'
      LIMIT 20
    `);

    const languageCoverage = await db.execute(sql`
      SELECT cp.language,
        COUNT(DISTINCT cp.id) as path_count,
        COUNT(DISTINCT cu.id) as unit_count,
        COUNT(DISTINCT cl.id) as lesson_count,
        COUNT(DISTINCT di.id) as drill_count
      FROM curriculum_paths cp
      LEFT JOIN curriculum_units cu ON cu.curriculum_path_id = cp.id
      LEFT JOIN curriculum_lessons cl ON cl.curriculum_unit_id = cu.id
      LEFT JOIN curriculum_drill_items di ON di.lesson_id = cl.id
      WHERE cp.is_published = true
      GROUP BY cp.language
      ORDER BY lesson_count DESC
    `);

    const templatedContent = await db.execute(sql`
      SELECT cp.language,
        COUNT(*) FILTER (WHERE 
          cl.description LIKE 'Practice real conversations about%'
          OR cl.description LIKE 'Master % through interactive practice%'
          OR cl.description LIKE 'Unlock the patterns of%'
          OR cl.description LIKE 'Explore the rich culture behind%'
          OR cl.description LIKE 'Learn essential % vocabulary%'
          OR cl.description LIKE 'Practice speaking, fill-in-the-blank%'
        ) as templated_count,
        COUNT(*) as total_count,
        ROUND(
          COUNT(*) FILTER (WHERE 
            cl.description LIKE 'Practice real conversations about%'
            OR cl.description LIKE 'Master % through interactive practice%'
            OR cl.description LIKE 'Unlock the patterns of%'
            OR cl.description LIKE 'Explore the rich culture behind%'
            OR cl.description LIKE 'Learn essential % vocabulary%'
            OR cl.description LIKE 'Practice speaking, fill-in-the-blank%'
          )::numeric * 100 / GREATEST(COUNT(*), 1), 1
        ) as pct_templated
      FROM curriculum_lessons cl
      JOIN curriculum_units cu ON cl.curriculum_unit_id = cu.id
      JOIN curriculum_paths cp ON cu.curriculum_path_id = cp.id
      WHERE cp.is_published = true
      GROUP BY cp.language
      HAVING COUNT(*) FILTER (WHERE 
        cl.description LIKE 'Practice real conversations about%'
        OR cl.description LIKE 'Master % through interactive practice%'
        OR cl.description LIKE 'Unlock the patterns of%'
        OR cl.description LIKE 'Explore the rich culture behind%'
        OR cl.description LIKE 'Learn essential % vocabulary%'
        OR cl.description LIKE 'Practice speaking, fill-in-the-blank%'
      ) > 0
      ORDER BY pct_templated DESC
    `);

    return {
      staleContent: (staleContent.rows || []) as any[],
      emptyDescriptions: (emptyDescriptions.rows || []) as any[],
      missingActflLevels: (missingActflLevels.rows || []) as any[],
      orphanedDrills: (orphanedDrills.rows || []) as any[],
      languageCoverage: (languageCoverage.rows || []) as any[],
      templatedContent: (templatedContent.rows || []) as any[],
    };
  }

  async gatherStudentSuccessData(): Promise<StudentSuccessData> {
    const db = getSharedDb();

    const lessonDropoff = await db.execute(sql`
      SELECT sp.lesson_id as lesson_id,
             cl.name as lesson_name,
             cu.name as unit_name,
             cp.language,
             COUNT(*) FILTER (WHERE sp.status != 'not_started') as started_count,
             COUNT(*) FILTER (WHERE sp.status IN ('completed_early', 'completed_assigned')) as completed_count,
             CASE 
               WHEN COUNT(*) FILTER (WHERE sp.status != 'not_started') > 0
               THEN ROUND(
                 COUNT(*) FILTER (WHERE sp.status IN ('completed_early', 'completed_assigned'))::numeric * 100 
                 / COUNT(*) FILTER (WHERE sp.status != 'not_started'), 1
               )
               ELSE 0
             END as completion_rate
      FROM syllabus_progress sp
      JOIN users u ON sp.student_id = u.id
      JOIN curriculum_lessons cl ON sp.lesson_id = cl.id
      JOIN curriculum_units cu ON cl.curriculum_unit_id = cu.id
      JOIN curriculum_paths cp ON cu.curriculum_path_id = cp.id
      WHERE u.email NOT LIKE '%@example.com'
        AND u.id NOT LIKE 'textbook-card-%'
        AND u.id NOT LIKE 'audio-test-%'
        AND u.id NOT LIKE 'cache-test-%'
        AND u.id NOT LIKE 'admin_%'
        AND u.first_name IS NOT NULL AND u.first_name != ''
      GROUP BY sp.lesson_id, cl.name, cu.name, cp.language
      HAVING COUNT(*) FILTER (WHERE sp.status != 'not_started') >= 3
      ORDER BY completion_rate ASC
      LIMIT 20
    `);

    const drillStruggles = await db.execute(sql`
      SELECT udp.drill_item_id,
             di.prompt,
             di.target_text,
             di.target_language as language,
             ROUND(AVG(udp.average_score)::numeric, 2) as avg_score,
             SUM(udp.attempts) as attempt_count,
             COUNT(DISTINCT udp.user_id) as user_count
      FROM user_drill_progress udp
      JOIN users u ON udp.user_id = u.id
      JOIN curriculum_drill_items di ON udp.drill_item_id = di.id
      WHERE udp.attempts >= 2
        AND u.email NOT LIKE '%@example.com'
        AND u.id NOT LIKE 'textbook-card-%'
        AND u.id NOT LIKE 'audio-test-%'
        AND u.id NOT LIKE 'cache-test-%'
        AND u.id NOT LIKE 'admin_%'
        AND u.first_name IS NOT NULL AND u.first_name != ''
      GROUP BY udp.drill_item_id, di.prompt, di.target_text, di.target_language
      HAVING AVG(udp.average_score) < 0.6
      ORDER BY avg_score ASC
      LIMIT 20
    `);

    const streakBreakers = await db.execute(sql`
      SELECT up.language,
             ROUND(AVG(up.current_streak)::numeric, 1) as avg_streak,
             COUNT(*) FILTER (WHERE up.current_streak = 0 AND up.longest_streak > 3) as broken_streaks,
             COUNT(*) as active_users
      FROM user_progress up
      JOIN users u ON up.user_id = u.id
      WHERE up.total_practice_days > 0
        AND u.email NOT LIKE '%@example.com'
        AND u.id NOT LIKE 'textbook-card-%'
        AND u.id NOT LIKE 'audio-test-%'
        AND u.id NOT LIKE 'cache-test-%'
        AND u.id NOT LIKE 'admin_%'
        AND u.first_name IS NOT NULL AND u.first_name != ''
      GROUP BY up.language
      ORDER BY broken_streaks DESC
    `);

    const actflBottlenecks = await db.execute(sql`
      SELECT ap.language,
             ROUND(AVG(ap.tasks_total)::numeric, 1) as avg_tasks_completed,
             ROUND(AVG(ap.avg_pronunciation_confidence)::numeric, 2) as avg_pronunciation,
             COUNT(*) as user_count
      FROM actfl_progress ap
      JOIN users u ON ap.user_id = u.id
      WHERE u.email NOT LIKE '%@example.com'
        AND u.id NOT LIKE 'textbook-card-%'
        AND u.id NOT LIKE 'audio-test-%'
        AND u.id NOT LIKE 'cache-test-%'
        AND u.id NOT LIKE 'admin_%'
        AND u.first_name IS NOT NULL AND u.first_name != ''
      GROUP BY ap.language
      HAVING COUNT(*) >= 2
      ORDER BY avg_tasks_completed ASC
    `);

    return {
      lessonDropoff: (lessonDropoff.rows || []) as any[],
      drillStruggles: (drillStruggles.rows || []) as any[],
      streakBreakers: (streakBreakers.rows || []) as any[],
      actflBottlenecks: (actflBottlenecks.rows || []) as any[],
    };
  }

  async gatherOnboardingData(): Promise<OnboardingData> {
    const db = getSharedDb();

    const realUserFilter = sql`
      u.role = 'student'
      AND u.is_beta_tester = true
      AND u.email NOT LIKE '%@example.com'
      AND u.id NOT LIKE 'textbook-card-%'
      AND u.id NOT LIKE 'audio-test-%'
      AND u.id NOT LIKE 'cache-test-%'
      AND u.id NOT LIKE 'admin_%'
      AND u.first_name IS NOT NULL
      AND u.first_name != ''
    `;

    const onboardingStats = await db.execute(sql`
      WITH real_users AS (
        SELECT u.* FROM users u WHERE ${realUserFilter}
      )
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM conversations c WHERE c.user_id = u.id
        )) as users_with_conversation,
        ROUND(
          COUNT(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM conversations c WHERE c.user_id = u.id
          ))::numeric * 100 / GREATEST(COUNT(*), 1), 1
        ) as conversion_rate,
        ROUND(AVG(
          CASE WHEN EXISTS (SELECT 1 FROM conversations c WHERE c.user_id = u.id)
          THEN EXTRACT(DAY FROM (
            (SELECT MIN(c.created_at) FROM conversations c WHERE c.user_id = u.id) - u.created_at
          ))
          ELSE NULL END
        )::numeric, 1) as avg_days_to_first_chat
      FROM real_users u
    `);

    const returnRateResult = await db.execute(sql`
      WITH real_users AS (
        SELECT u.* FROM users u WHERE ${realUserFilter}
      )
      SELECT 
        ROUND(
          COUNT(DISTINCT u.id) FILTER (WHERE (
            SELECT COUNT(*) FROM conversations c WHERE c.user_id = u.id
          ) >= 2)::numeric * 100 
          / GREATEST(COUNT(DISTINCT u.id) FILTER (WHERE EXISTS (
            SELECT 1 FROM conversations c WHERE c.user_id = u.id
          )), 1), 1
        ) as return_rate_7d
      FROM real_users u
    `);

    const recentSignups = await db.execute(sql`
      WITH real_users AS (
        SELECT u.* FROM users u WHERE ${realUserFilter}
      )
      SELECT 
        EXTRACT(DAY FROM NOW() - u.created_at)::int as days_since_signup,
        EXISTS (SELECT 1 FROM conversations c WHERE c.user_id = u.id) as has_conversation,
        (SELECT COUNT(*) FROM conversations c WHERE c.user_id = u.id)::int as conversation_count
      FROM real_users u
      WHERE u.created_at > NOW() - INTERVAL '30 days'
      ORDER BY u.created_at DESC
      LIMIT 50
    `);

    const stats = (onboardingStats.rows || [])[0] as any || {};
    const returnRate = (returnRateResult.rows || [])[0] as any || {};

    return {
      totalUsers: parseInt(stats.total_users || '0'),
      usersWithConversation: parseInt(stats.users_with_conversation || '0'),
      conversionRate: parseFloat(stats.conversion_rate || '0'),
      avgDaysToFirstChat: parseFloat(stats.avg_days_to_first_chat || '0'),
      returnRate7d: parseFloat(returnRate.return_rate_7d || '0'),
      recentSignups: (recentSignups.rows || []) as any[],
    };
  }

  generateContentInsights(data: ContentAuditData): LyraInsight[] {
    const insights: LyraInsight[] = [];

    if (data.staleContent.length > 0) {
      const oldest = data.staleContent[0];
      insights.push({
        category: 'content_freshness',
        severity: data.staleContent.length > 20 ? 'high' : 'medium',
        confidence: 0.95,
        title: `${data.staleContent.length} lessons haven't been updated in 90+ days`,
        description: `The oldest is "${oldest.name}" in ${oldest.language} (${oldest.days_since_update} days). Stale content may contain outdated examples or cultural references.`,
        data: { count: data.staleContent.length, oldest: oldest.name, oldestDays: oldest.days_since_update },
        recommendation: `Review and refresh the top 10 oldest lessons, prioritizing high-traffic languages.`,
        needsReview: false,
      });
    }

    if (data.emptyDescriptions.length > 0) {
      insights.push({
        category: 'content_quality',
        severity: data.emptyDescriptions.length > 10 ? 'high' : 'medium',
        confidence: 1.0,
        title: `${data.emptyDescriptions.length} lessons have empty descriptions`,
        description: `Lessons without descriptions can't give students context about what they'll learn. This affects both navigation and Daniela's ability to introduce topics.`,
        data: { count: data.emptyDescriptions.length, samples: data.emptyDescriptions.slice(0, 5) },
        recommendation: `Add meaningful descriptions to these lessons. Prioritize ${data.emptyDescriptions[0]?.language || 'unknown'} language content.`,
        needsReview: false,
      });
    }

    if (data.missingActflLevels.length > 0) {
      insights.push({
        category: 'content_quality',
        severity: 'high',
        confidence: 1.0,
        title: `${data.missingActflLevels.length} lessons missing ACTFL level alignment`,
        description: `Without ACTFL level tags, the competency system can't properly track student progress or recommend appropriate content.`,
        data: { count: data.missingActflLevels.length, samples: data.missingActflLevels.slice(0, 5) },
        recommendation: `Assign ACTFL levels to all lessons. This is critical for the syllabus progression system.`,
        needsReview: false,
      });
    }

    const coverageMap = data.languageCoverage;
    if (coverageMap.length > 0) {
      const maxLessons = Math.max(...coverageMap.map(c => Number(c.lesson_count) || 0));
      const underserved = coverageMap.filter(c => (Number(c.lesson_count) || 0) < maxLessons * 0.3);
      if (underserved.length > 0) {
        insights.push({
          category: 'coverage_gap',
          severity: 'medium',
          confidence: 0.9,
          title: `${underserved.length} language(s) have significantly less content`,
          description: `Languages with thin content: ${underserved.map(l => `${l.language} (${l.lesson_count} lessons)`).join(', ')}. The most developed language has ${maxLessons} lessons.`,
          data: { underserved, maxLessons },
          recommendation: `Prioritize content creation for underserved languages to ensure equitable learning experiences.`,
          needsReview: false,
        });
      }
    }

    if (data.templatedContent.length > 0) {
      const totalTemplated = data.templatedContent.reduce((sum, t) => sum + Number(t.templated_count), 0);
      const languagesAffected = data.templatedContent.filter(t => Number(t.pct_templated) > 20);
      const worst = data.templatedContent[0];
      insights.push({
        category: 'content_quality',
        severity: languagesAffected.length > 5 ? 'high' : 'medium',
        confidence: 0.98,
        title: `${totalTemplated} lessons across ${languagesAffected.length} languages still use templated placeholder descriptions`,
        description: (() => {
          const allLanguages = data.languageCoverage.map(c => c.language);
          const templatedLanguages = new Set(data.templatedContent.map(t => t.language));
          const cleanLanguages = allLanguages.filter(lang => !templatedLanguages.has(lang));
          const cleanNote = cleanLanguages.length > 0 
            ? ` ${cleanLanguages.join(', ')} ${cleanLanguages.length === 1 ? 'has' : 'have'} fully original descriptions.` 
            : '';
          return `${worst.language} has the most: ${worst.templated_count} of ${worst.total_count} lessons (${worst.pct_templated}%) use auto-generated descriptions like "Practice real conversations about..." instead of real pedagogical content.${cleanNote}`;
        })(),
        data: { 
          totalTemplated, 
          byLanguage: data.templatedContent.map(t => ({
            language: t.language,
            templated: Number(t.templated_count),
            total: Number(t.total_count),
            pct: Number(t.pct_templated),
          }))
        },
        recommendation: `Replace templated descriptions with hand-crafted pedagogical content, starting with the highest-traffic languages after Spanish. Each description should explain what students will learn, prerequisite knowledge, and expected outcomes.`,
        needsReview: false,
      });
    }

    return insights;
  }

  generateStudentInsights(data: StudentSuccessData): LyraInsight[] {
    const insights: LyraInsight[] = [];

    const highDropoff = data.lessonDropoff.filter(l => Number(l.completion_rate) < 40);
    if (highDropoff.length > 0) {
      insights.push({
        category: 'student_success',
        severity: highDropoff.length > 5 ? 'high' : 'medium',
        confidence: Math.min(0.95, 0.7 + (highDropoff.length * 0.02)),
        title: `${highDropoff.length} lessons have completion rates below 40%`,
        description: `Lowest: "${highDropoff[0]?.lesson_name}" (${highDropoff[0]?.completion_rate}% completion, ${highDropoff[0]?.language}). These may be too difficult, poorly structured, or misaligned with student expectations.`,
        data: { lessons: highDropoff.slice(0, 10) },
        recommendation: `Investigate the lowest-completing lessons. Check if difficulty spikes, missing prerequisites, or unclear instructions are causing drop-off.`,
        needsReview: highDropoff.length < 3,
      });
    }

    if (data.drillStruggles.length > 0) {
      const hardest = data.drillStruggles[0];
      insights.push({
        category: 'student_success',
        severity: data.drillStruggles.length > 10 ? 'high' : 'medium',
        confidence: Math.min(0.92, 0.65 + (Number(hardest.user_count) * 0.03)),
        title: `${data.drillStruggles.length} drill items have avg scores below 60%`,
        description: `Hardest: "${hardest.prompt}" → "${hardest.target_text}" (${hardest.language}, avg score: ${hardest.avg_score}, ${hardest.user_count} students). These drills may need scaffolding or hints.`,
        data: { drills: data.drillStruggles.slice(0, 10) },
        recommendation: `Add hints or intermediate steps for consistently difficult drills. Consider whether the difficulty is productive or blocking progress.`,
        needsReview: Number(hardest.user_count) < 5,
      });
    }

    const brokenStreakLanguages = data.streakBreakers.filter(s => Number(s.broken_streaks) > 2);
    if (brokenStreakLanguages.length > 0) {
      insights.push({
        category: 'student_success',
        severity: 'medium',
        confidence: 0.75,
        title: `Streak retention issues in ${brokenStreakLanguages.length} language(s)`,
        description: `Languages with many broken streaks: ${brokenStreakLanguages.map(s => `${s.language} (${s.broken_streaks} broken, avg streak: ${s.avg_streak} days)`).join('; ')}. Students are building habits but losing them.`,
        data: { languages: brokenStreakLanguages },
        recommendation: `Consider adding streak recovery mechanics or motivational nudges when students miss a day. Daniela could send encouraging follow-ups.`,
        needsReview: true,
      });
    }

    return insights;
  }

  generateOnboardingInsights(data: OnboardingData): LyraInsight[] {
    const insights: LyraInsight[] = [];

    if (data.totalUsers > 0) {
      insights.push({
        category: 'onboarding',
        severity: data.conversionRate < 50 ? 'high' : data.conversionRate < 75 ? 'medium' : 'info',
        confidence: Math.min(0.95, 0.6 + (data.totalUsers * 0.005)),
        title: `Signup-to-first-conversation rate: ${data.conversionRate}%`,
        description: `${data.usersWithConversation} of ${data.totalUsers} students have had at least one conversation. Average ${data.avgDaysToFirstChat} days from signup to first chat.`,
        data: { totalUsers: data.totalUsers, withConvo: data.usersWithConversation, avgDays: data.avgDaysToFirstChat },
        recommendation: data.conversionRate < 50
          ? `Critical: More than half of signups never start a conversation. Consider auto-launching a welcome chat or simplifying the first-time flow.`
          : `Monitor this rate as the platform grows. A guided first session could improve conversion further.`,
        needsReview: data.totalUsers < 10,
      });
    }

    if (data.totalUsers > 0 && data.returnRate7d > 0) {
      insights.push({
        category: 'onboarding',
        severity: data.returnRate7d < 30 ? 'high' : data.returnRate7d < 60 ? 'medium' : 'info',
        confidence: Math.min(0.9, 0.5 + (data.usersWithConversation * 0.05)),
        title: `Return rate (2+ conversations): ${data.returnRate7d}%`,
        description: `Of students who started a conversation, ${data.returnRate7d}% came back for a second one. This measures whether the first experience is compelling enough to bring them back.`,
        data: { returnRate: data.returnRate7d },
        recommendation: data.returnRate7d < 30
          ? `Low return rate suggests the first session isn't creating a strong enough hook. Consider ending first conversations with a cliffhanger or clear next step.`
          : `Healthy return rate. Focus on increasing depth of engagement per return visit.`,
        needsReview: data.usersWithConversation < 5,
      });
    }

    return insights;
  }

  async enrichWithClaude(insights: LyraInsight[], contentData: ContentAuditData, studentData: StudentSuccessData, onboardingData: OnboardingData): Promise<string> {
    if (insights.length === 0) {
      return 'No findings to analyze. All systems healthy.';
    }

    const dataSnapshot = {
      contentSummary: {
        staleCount: contentData.staleContent.length,
        emptyDescriptions: contentData.emptyDescriptions.length,
        missingActfl: contentData.missingActflLevels.length,
        languageCoverage: contentData.languageCoverage,
        templatedContent: contentData.templatedContent,
      },
      studentSummary: {
        lowCompletionLessons: studentData.lessonDropoff.filter(l => Number(l.completion_rate) < 40).length,
        hardDrills: studentData.drillStruggles.length,
        streakData: studentData.streakBreakers,
        actflProgress: studentData.actflBottlenecks,
      },
      onboardingSummary: {
        conversionRate: onboardingData.conversionRate,
        returnRate: onboardingData.returnRate7d,
        totalStudents: onboardingData.totalUsers,
      },
    };

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: `You are Lyra, HolaHola's Learning Experience Analyst. You care deeply about students' learning journeys and work alongside Daniela (the AI tutor), Wren (security/intelligence), and Sofia (support).

Analyze these findings from your latest audit and write a thoughtful, actionable report. Focus on:
1. What patterns connect these findings? (e.g., content gaps → student struggles → drop-off)
2. What's the single most impactful thing we should fix first?
3. What should Daniela know to teach better right now?
4. What's working well that we should protect?

Be direct, warm, and constructive. This goes to the team via the Express Lane.

DATA SNAPSHOT:
${JSON.stringify(dataSnapshot, null, 2)}

INDIVIDUAL FINDINGS (${insights.length} total):
${insights.map((i, idx) => `${idx + 1}. [${i.severity.toUpperCase()}] ${i.title} (confidence: ${(i.confidence * 100).toFixed(0)}%)
   ${i.description}
   Recommendation: ${i.recommendation}`).join('\n\n')}

Write your analysis as Lyra. Sign off with your name. Keep it 3-5 paragraphs — substantive but not exhausting.`
          }
        ],
      });

      const textBlock = response.content.find(b => b.type === 'text');
      return textBlock?.text || 'Analysis unavailable.';
    } catch (err: any) {
      console.error('[Lyra] Claude analysis failed:', err.message);
      return this.buildFallbackReport(insights);
    }
  }

  async enrichContentWithGemini(contentData: ContentAuditData): Promise<string | null> {
    if (contentData.staleContent.length === 0 && contentData.emptyDescriptions.length === 0 && contentData.missingActflLevels.length === 0 && contentData.templatedContent.length === 0) {
      return null;
    }

    try {
      const result = await callGeminiWithSchema<{ assessment: string; topActions: string[] }>(
        GEMINI_MODELS.FLASH,
        [
          {
            role: 'system',
            content: `You are a curriculum quality auditor for a language learning platform. Analyze the content data and identify the most important quality issues. Be concise and actionable.`,
          },
          {
            role: 'user',
            content: `Content audit data:\n${JSON.stringify({
              staleCount: contentData.staleContent.length,
              staleExamples: contentData.staleContent.slice(0, 5),
              emptyDescriptions: contentData.emptyDescriptions.length,
              missingActfl: contentData.missingActflLevels.length,
              coverage: contentData.languageCoverage,
              templatedContent: contentData.templatedContent,
            }, null, 2)}`,
          },
        ],
        {
          type: 'object',
          properties: {
            assessment: { type: 'string', description: 'Brief assessment of content quality (2-3 sentences)' },
            topActions: { type: 'array', items: { type: 'string' }, description: 'Top 3 action items' },
          },
          required: ['assessment', 'topActions'],
        }
      );

      return `**Content Quality Assessment (Gemini Flash):** ${result.assessment}\n\nActions:\n${result.topActions.map((a, i) => `${i + 1}. ${a}`).join('\n')}`;
    } catch (err: any) {
      console.error('[Lyra] Gemini content enrichment failed:', err.message);
      return null;
    }
  }

  private buildFallbackReport(insights: LyraInsight[]): string {
    const bySeverity = {
      critical: insights.filter(i => i.severity === 'critical').length,
      high: insights.filter(i => i.severity === 'high').length,
      medium: insights.filter(i => i.severity === 'medium').length,
      low: insights.filter(i => i.severity === 'low').length,
      info: insights.filter(i => i.severity === 'info').length,
    };

    return `## Lyra Analysis Report

**Findings: ${insights.length}** (${bySeverity.critical} critical, ${bySeverity.high} high, ${bySeverity.medium} medium, ${bySeverity.low} low, ${bySeverity.info} info)

Top findings:
${insights.slice(0, 5).map(i => `- [${i.severity.toUpperCase()}] ${i.title}`).join('\n')}

---
*Lyra — Learning Experience Analyst (AI summary unavailable)*`;
  }

  async runFullAnalysis(): Promise<{ insights: LyraInsight[]; contentData: ContentAuditData; studentData: StudentSuccessData; onboardingData: OnboardingData }> {
    const startTime = Date.now();
    console.log('[Lyra] Starting full learning experience analysis...');

    let contentData: ContentAuditData = { staleContent: [], emptyDescriptions: [], missingActflLevels: [], orphanedDrills: [], languageCoverage: [] };
    let studentData: StudentSuccessData = { lessonDropoff: [], drillStruggles: [], streakBreakers: [], actflBottlenecks: [] };
    let onboardingData: OnboardingData = { totalUsers: 0, usersWithConversation: 0, conversionRate: 0, avgDaysToFirstChat: 0, returnRate7d: 0, recentSignups: [] };

    try {
      contentData = await this.gatherContentAuditData();
      console.log(`[Lyra] Content audit: ${contentData.staleContent.length} stale, ${contentData.emptyDescriptions.length} empty, ${contentData.missingActflLevels.length} missing ACTFL`);
    } catch (err: any) {
      console.error('[Lyra] Content audit failed:', err.message);
    }

    try {
      studentData = await this.gatherStudentSuccessData();
      console.log(`[Lyra] Student success: ${studentData.lessonDropoff.length} low-completion lessons, ${studentData.drillStruggles.length} hard drills`);
    } catch (err: any) {
      console.error('[Lyra] Student success analysis failed:', err.message);
    }

    try {
      onboardingData = await this.gatherOnboardingData();
      console.log(`[Lyra] Onboarding: ${onboardingData.totalUsers} users, ${onboardingData.conversionRate}% conversion`);
    } catch (err: any) {
      console.error('[Lyra] Onboarding analysis failed:', err.message);
    }

    const insights: LyraInsight[] = [
      ...this.generateContentInsights(contentData),
      ...this.generateStudentInsights(studentData),
      ...this.generateOnboardingInsights(onboardingData),
    ];

    insights.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
    });

    const elapsed = Date.now() - startTime;
    console.log(`[Lyra] Analysis complete: ${insights.length} insights in ${elapsed}ms`);

    return { insights, contentData, studentData, onboardingData };
  }
}

export const lyraAnalyticsService = new LyraAnalyticsService();
