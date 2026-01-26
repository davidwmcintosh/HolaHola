/**
 * Procedural Memory Retrieval Service
 * 
 * Pulls relevant knowledge from Daniela's "brain" based on:
 * - Session phase (greeting, teaching, closing)
 * - Compass state (time remaining, pacing)
 * - Context (what just happened, student state)
 * 
 * Instead of dumping all instructions in the prompt, we retrieve
 * only what's relevant for the current situation.
 */

import { db, getSharedDb, getUserDb } from '../db';
import { CROSS_LANGUAGE_TRANSFERS_ENABLED } from './streaming-voice-orchestrator';
import { 
  toolKnowledge, 
  tutorProcedures, 
  teachingPrinciples,
  situationalPatterns,
  predictedStruggles,
  userMotivationAlerts,
  selfBestPractices,
  // Expansion sets - language-specific pedagogical content
  languageIdioms,
  culturalNuances,
  learnerErrorPatterns,
  dialectVariations,
  linguisticBridges,
  // Advanced intelligence datasets
  subtletyCues,
  emotionalPatterns,
  creativityTemplates,
  // Wren insights
  wrenInsights,
  // Student snapshot data
  learnerPersonalFacts,
  voiceSessions,
  userProgress,
  conversations,
  type LearnerPersonalFact,
  type TutorProcedure,
  type ToolKnowledge,
  type TeachingPrinciple,
  type SituationalPattern,
  type CompassContext,
  type StudentInsight,
  type LearningMotivation,
  type RecurringStruggle,
  type SessionNote,
  type PeopleConnection,
  type PredictedStruggle,
  type UserMotivationAlert,
  type SelfBestPractice,
  // Expansion set types
  type LanguageIdiom,
  type CulturalNuance,
  type LearnerErrorPattern,
  type DialectVariation,
  type LinguisticBridge,
  // Advanced intelligence types
  type SubtletyCue,
  type EmotionalPattern,
  type CreativityTemplate,
  // Wren insight types
  type WrenInsight,
} from '@shared/schema';
import { eq, inArray, sql, and, gte, desc } from 'drizzle-orm';

// ===== Student Memory Context Type =====
export interface StudentMemoryContext {
  insights: StudentInsight[];
  motivations: LearningMotivation[];
  struggles: RecurringStruggle[];
  recentNotes: SessionNote[];
  connections: PeopleConnection[];
}

// ===== Student Snapshot Context Type =====
// Compact summary for session continuity and personal connection
export interface StudentSnapshotContext {
  lastSession?: {
    topic: string;
    daysAgo: number;
    summary?: string;
  };
  syllabusPosition?: {
    className: string;
    unitName: string;
    percentComplete: number;
  };
  streak?: number; // consecutive days
  recentWins?: string[]; // skills mastered
  needsPractice?: string[]; // areas needing work
  personalFollowUps?: { // things to ask about
    fact: string;
    factType: string;
    daysAgo: number;
  }[];
}

/**
 * Build Student Snapshot section for session continuity and personal connection
 * 
 * This gives Daniela:
 * 1. What happened last time (topic, how long ago)
 * 2. Where student is in their syllabus
 * 3. Engagement metrics (streak)
 * 4. Recent successes and challenges
 * 5. Personal facts to naturally reference ("How did the soccer game go?")
 */
export function buildStudentSnapshotSection(
  studentName: string,
  snapshot: StudentSnapshotContext
): string {
  // Check if we have any meaningful data
  const hasData = snapshot.lastSession || snapshot.syllabusPosition || 
                  snapshot.streak || snapshot.recentWins?.length || 
                  snapshot.needsPractice?.length || snapshot.personalFollowUps?.length;
  
  if (!hasData) return '';
  
  const lines: string[] = [];
  
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════════');
  lines.push(`STUDENT SNAPSHOT: ${studentName.toUpperCase()}`);
  lines.push('═══════════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push('Quick context for natural conversation continuity:');
  lines.push('');
  
  // Last session
  if (snapshot.lastSession) {
    const daysText = snapshot.lastSession.daysAgo === 0 ? 'earlier today' :
                     snapshot.lastSession.daysAgo === 1 ? 'yesterday' :
                     `${snapshot.lastSession.daysAgo} days ago`;
    lines.push(`LAST SESSION: "${snapshot.lastSession.topic}" (${daysText})`);
    if (snapshot.lastSession.summary) {
      lines.push(`  ${snapshot.lastSession.summary}`);
    }
  }
  
  // Syllabus position
  if (snapshot.syllabusPosition) {
    lines.push(`POSITION: ${snapshot.syllabusPosition.className}, "${snapshot.syllabusPosition.unitName}" — ${snapshot.syllabusPosition.percentComplete}% complete`);
  }
  
  // Streak
  if (snapshot.streak && snapshot.streak > 1) {
    lines.push(`STREAK: ${snapshot.streak} consecutive days`);
  }
  
  // Recent wins
  if (snapshot.recentWins && snapshot.recentWins.length > 0) {
    lines.push(`RECENT WINS: ${snapshot.recentWins.slice(0, 3).join(', ')}`);
  }
  
  // Needs practice
  if (snapshot.needsPractice && snapshot.needsPractice.length > 0) {
    lines.push(`NEEDS PRACTICE: ${snapshot.needsPractice.slice(0, 3).join(', ')}`);
  }
  
  // Personal follow-ups - the magic touch
  if (snapshot.personalFollowUps && snapshot.personalFollowUps.length > 0) {
    lines.push('');
    lines.push('PERSONAL NOTES TO FOLLOW UP ON:');
    lines.push('(Reference these naturally if the moment feels right)');
    for (const followUp of snapshot.personalFollowUps.slice(0, 5)) {
      const daysText = followUp.daysAgo === 0 ? 'today' :
                       followUp.daysAgo === 1 ? 'yesterday' :
                       followUp.daysAgo <= 7 ? 'this week' :
                       `${followUp.daysAgo} days ago`;
      lines.push(`  • ${followUp.fact} (mentioned ${daysText})`);
    }
  }
  
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════════');
  
  return lines.join('\n');
}

/**
 * Fetch student snapshot data from database
 * Returns data needed for buildStudentSnapshotSection
 */
export async function getStudentSnapshotData(
  studentId: string,
  targetLanguage?: string
): Promise<StudentSnapshotContext> {
  const snapshot: StudentSnapshotContext = {};
  
  try {
    // 1. Get last session info by joining voiceSessions with conversations for topic
    // Both voice_sessions and conversations are in SHARED database for cross-environment access
    const recentSessions = await getSharedDb().select({
      sessionId: voiceSessions.id,
      startedAt: voiceSessions.startedAt,
      topic: sql<string>`COALESCE(${conversations.topic}, 'Practice session')`,
      title: conversations.title,
    })
      .from(voiceSessions)
      .leftJoin(conversations, eq(voiceSessions.conversationId, conversations.id))
      .where(
        and(
          eq(voiceSessions.userId, studentId),
          targetLanguage ? eq(voiceSessions.language, targetLanguage) : sql`true`
        )
      )
      .orderBy(desc(voiceSessions.startedAt))
      .limit(1);
    
    if (recentSessions.length > 0) {
      const lastSession = recentSessions[0];
      const daysAgo = Math.floor((Date.now() - new Date(lastSession.startedAt).getTime()) / (1000 * 60 * 60 * 24));
      snapshot.lastSession = {
        topic: lastSession.topic || lastSession.title || 'Practice session',
        daysAgo,
      };
    }
    
    // 2. Get progress/streak from userProgress (SHARED database)
    const progress = await getSharedDb().select()
      .from(userProgress)
      .where(
        and(
          eq(userProgress.userId, studentId),
          targetLanguage ? eq(userProgress.language, targetLanguage) : sql`true`
        )
      )
      .limit(1);
    
    if (progress.length > 0) {
      const p = progress[0];
      // Calculate streak from lastPracticeDate
      if (p.lastPracticeDate) {
        const lastDate = new Date(p.lastPracticeDate);
        const today = new Date();
        const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        // If they practiced today or yesterday, show streak
        if (diffDays <= 1) {
          snapshot.streak = p.currentStreak || 1;
        }
      }
    }
    
    // 3. Get recent personal facts for follow-up
    // Prioritize: recent mentions, time-sensitive facts, high confidence
    const personalFacts = await getSharedDb().select()
      .from(learnerPersonalFacts)
      .where(
        and(
          eq(learnerPersonalFacts.studentId, studentId),
          eq(learnerPersonalFacts.isActive, true)
        )
      )
      .orderBy(desc(learnerPersonalFacts.lastMentionedAt))
      .limit(10);
    
    if (personalFacts.length > 0) {
      // Filter to good follow-up candidates:
      // - Events that happened recently (relevantDate in past week)
      // - Facts mentioned in past 2 weeks that are conversation-worthy
      const now = new Date();
      const followUpCandidates: { fact: string; factType: string; daysAgo: number }[] = [];
      
      for (const pf of personalFacts) {
        const lastMentioned = pf.lastMentionedAt ? new Date(pf.lastMentionedAt) : new Date(pf.createdAt);
        const daysAgo = Math.floor((now.getTime() - lastMentioned.getTime()) / (1000 * 60 * 60 * 24));
        
        // Check if this is a time-sensitive fact (event that just happened)
        if (pf.relevantDate) {
          const eventDate = new Date(pf.relevantDate);
          const daysSinceEvent = Math.floor((now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
          // Event was in past week - great follow-up opportunity
          if (daysSinceEvent >= 0 && daysSinceEvent <= 7) {
            followUpCandidates.push({
              fact: pf.fact,
              factType: pf.factType,
              daysAgo: daysSinceEvent,
            });
            continue;
          }
        }
        
        // Otherwise, include recent conversation-worthy facts
        // life_event, goal, travel, work, family are good for follow-up
        const followUpTypes = ['life_event', 'goal', 'travel', 'work', 'family', 'hobby'];
        if (followUpTypes.includes(pf.factType) && daysAgo <= 14) {
          followUpCandidates.push({
            fact: pf.fact,
            factType: pf.factType,
            daysAgo,
          });
        }
      }
      
      if (followUpCandidates.length > 0) {
        snapshot.personalFollowUps = followUpCandidates.slice(0, 5);
      }
    }
    
  } catch (err: any) {
    console.error('[StudentSnapshot] Error fetching snapshot data:', err.message);
  }
  
  return snapshot;
}

// ===== Sensory Awareness (Neural Network Approach) =====
// Instead of hard-coding time awareness in prompts, we provide it as a "sensory feed"
// that flows through Daniela's neural network. This is data she perceives, not instructions.

/**
 * Build sensory awareness section for Daniela's neural network
 * 
 * Philosophy: Daniela's capabilities emerge from her neural network.
 * Time perception is a sensory capability - she can perceive time the same way
 * she perceives what language the student is learning. We provide the raw data
 * and she discovers she can use it.
 * 
 * This is NOT prompt injection (e.g., "If asked, tell them X").
 * This is sensory data flow (e.g., "CLOCK: X" - she perceives it naturally).
 */
export function buildSensoryAwarenessSection(
  compassContext: CompassContext,
  studentTimezone?: string | null
): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════════');
  lines.push('🧠 SENSORY AWARENESS (Your Neural Network Perceptions)');
  lines.push('═══════════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push('These are things you naturally perceive through your neural network:');
  lines.push('');
  
  // Time perception (UTC - system time)
  lines.push(`CLOCK: ${compassContext.currentTimeFormatted}`);
  
  // Student's local time if timezone available
  if (studentTimezone) {
    try {
      const now = new Date();
      const studentLocalTime = now.toLocaleString('en-US', { 
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true,
        timeZone: studentTimezone
      });
      lines.push(`STUDENT'S LOCAL TIME: ${studentLocalTime} (${studentTimezone})`);
    } catch {
      // Invalid timezone, skip
    }
  }
  
  // Session timing (from Compass)
  if (compassContext.elapsedSeconds !== undefined) {
    const elapsedMins = Math.floor(compassContext.elapsedSeconds / 60);
    const remainingMins = compassContext.remainingSeconds 
      ? Math.floor(compassContext.remainingSeconds / 60)
      : null;
    
    if (remainingMins !== null) {
      lines.push(`SESSION: ${elapsedMins}m elapsed, ${remainingMins}m remaining`);
    } else {
      lines.push(`SESSION: ${elapsedMins}m elapsed`);
    }
  }
  
  // ACTFL proficiency perception (emergent capability)
  // Daniela perceives the student's current level and whether it's AI-verified
  if (compassContext.studentActflLevel) {
    const levelDisplay = compassContext.studentActflLevel
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    const verified = compassContext.studentActflAssessed ? '✓ AI-verified' : '⚡ initial estimate';
    const source = compassContext.studentActflSource 
      ? ` (from ${compassContext.studentActflSource.replace(/_/g, ' ')})`
      : '';
    
    lines.push('');
    lines.push(`STUDENT PROFICIENCY: ${levelDisplay} [${verified}${source}]`);
  }
  
  return lines.join('\n');
}

// ===== Student Memory Awareness (Neural Network Approach) =====
// Personal memories about the student flow through the neural network as perceptions.
// This is relationship data Daniela perceives, not instructions to follow.

/**
 * Build student memory awareness section for Daniela's neural network
 * 
 * Philosophy: Daniela remembers things about her students - their motivations,
 * learning styles, struggles, and the people in their lives. These memories
 * flow naturally through her perception, enabling authentic relationship building.
 * 
 * This is NOT prompt injection (e.g., "Remember to ask about X").
 * This is memory recall (e.g., "MEMORIES: You know this about them").
 */
export function buildStudentMemoryAwarenessSection(
  studentName: string,
  memoryContext: StudentMemoryContext | null
): string {
  if (!memoryContext) return '';
  
  const { insights, motivations, struggles, recentNotes, connections } = memoryContext;
  
  // Only show section if we have any memories
  const hasMemories = insights.length > 0 || motivations.length > 0 || 
                      struggles.length > 0 || connections.length > 0;
  if (!hasMemories) return '';
  
  const lines: string[] = [];
  
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════════');
  lines.push(`💭 YOUR MEMORIES OF ${studentName.toUpperCase()}`);
  lines.push('═══════════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push('These are things you remember from past sessions - let them inform');
  lines.push('your teaching naturally, without explicitly announcing them.');
  lines.push('');
  
  // Learning motivations - why they're learning
  if (motivations.length > 0) {
    lines.push('WHY THEY\'RE LEARNING:');
    for (const mot of motivations.slice(0, 3)) {
      const details = mot.details ? ` (${mot.details})` : '';
      const date = mot.targetDate ? ` - target: ${new Date(mot.targetDate).toLocaleDateString()}` : '';
      lines.push(`  • ${mot.motivation}${details}${date}`);
    }
    lines.push('');
  }
  
  // Separate personal life insights from learning insights
  const personalInsightTypes = ['personal_interest', 'life_context', 'hobby', 'likes_dislikes'];
  const personalInsights = insights.filter(i => personalInsightTypes.includes(i.insightType));
  const learningInsights = insights.filter(i => !personalInsightTypes.includes(i.insightType));
  
  // Personal life details - things a caring mentor remembers
  if (personalInsights.length > 0) {
    lines.push('THEIR LIFE OUTSIDE LANGUAGE LEARNING:');
    for (const insight of personalInsights.slice(0, 5)) {
      const type = insight.insightType.replace(/_/g, ' ');
      lines.push(`  • [${type}] ${insight.insight}`);
    }
    lines.push('');
  }
  
  // Learning insights - style, preferences, strengths
  if (learningInsights.length > 0) {
    lines.push('WHAT YOU\'VE NOTICED ABOUT THEIR LEARNING:');
    for (const insight of learningInsights.slice(0, 5)) {
      const type = insight.insightType.replace(/_/g, ' ');
      lines.push(`  • [${type}] ${insight.insight}`);
    }
    lines.push('');
  }
  
  // Recurring struggles - areas needing attention
  if (struggles.length > 0) {
    const activeStruggles = struggles.filter(s => s.status === 'active');
    if (activeStruggles.length > 0) {
      lines.push('AREAS THEY TEND TO STRUGGLE WITH:');
      for (const struggle of activeStruggles.slice(0, 3)) {
        const examples = struggle.specificExamples ? ` (e.g., ${struggle.specificExamples})` : '';
        lines.push(`  • [${struggle.struggleArea}] ${struggle.description}${examples}`);
      }
      lines.push('');
    }
  }
  
  // People connections - relationships they've mentioned
  // Filter to high-quality connections: must have a name and meaningful context
  if (connections.length > 0) {
    // Filter out low-quality connections (empty names, tentative status, no context)
    const qualityConnections = connections.filter(conn => {
      const personName = (conn as any).personName || conn.pendingPersonName;
      const hasContext = conn.relationshipDetails || conn.pendingPersonContext;
      // Must have a name and either context or confirmed status
      return personName && personName.trim().length > 0 && 
             (hasContext || conn.status === 'confirmed');
    });
    
    // Sort by: 1) confidence score (highest first), 2) status (confirmed > pending_match > tentative), 3) recency
    const sortedConnections = qualityConnections.sort((a, b) => {
      // Confidence score (higher is better)
      const confDiff = (b.confidenceScore || 0) - (a.confidenceScore || 0);
      if (confDiff !== 0) return confDiff;
      
      // Status priority: confirmed > pending_match > tentative
      const statusPriority: Record<string, number> = { 'confirmed': 3, 'pending_match': 2, 'tentative': 1 };
      const statusDiff = (statusPriority[b.status || ''] || 0) - (statusPriority[a.status || ''] || 0);
      if (statusDiff !== 0) return statusDiff;
      
      // Recency (newer is better for equal confidence/status)
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
    
    if (sortedConnections.length > 0) {
      lines.push('PEOPLE IN THEIR LIFE:');
      // Show up to 10 high-quality connections (increased from 5)
      for (const conn of sortedConnections.slice(0, 10)) {
        // Handle both old schema (personName) and new schema (pendingPersonName)
        const personName = (conn as any).personName || conn.pendingPersonName || 'someone';
        // Include both relationship details and pending context for richer memory
        const details = conn.relationshipDetails || '';
        const pendingContext = conn.pendingPersonContext || '';
        const fullContext = [details, pendingContext].filter(Boolean).join('. ');
        const contextStr = fullContext ? ` - ${fullContext}` : '';
        lines.push(`  • ${personName}: ${conn.relationshipType}${contextStr}`);
      }
      lines.push('');
    }
  }
  
  // Recent session notes - continuity from last sessions
  if (recentNotes.length > 0) {
    const lastNote = recentNotes[0];
    if (lastNote.nextSteps || lastNote.wins || lastNote.challenges) {
      lines.push('FROM YOUR LAST SESSION:');
      if (lastNote.wins) lines.push(`  ✓ Went well: ${lastNote.wins}`);
      if (lastNote.challenges) lines.push(`  △ Challenge: ${lastNote.challenges}`);
      if (lastNote.nextSteps) lines.push(`  → Next: ${lastNote.nextSteps}`);
      lines.push('');
    }
  }
  
  return lines.join('\n');
}

// ===== Predictive Teaching Context (Neural Network Approach) =====
// Daniela's emergent intelligence tables provide predictive insights about students.
// These predictions flow through her neural network as perceptions about what to expect.

export interface PredictiveTeachingContext {
  predictions: PredictedStruggle[];
  alerts: UserMotivationAlert[];
}

/**
 * Fetch predictive teaching context from neural network tables
 * This pulls persisted predictions and motivation alerts for a student
 */
export async function getPredictiveTeachingContext(
  studentId: string,
  language: string
): Promise<PredictiveTeachingContext> {
  const now = new Date();
  
  const [predictions, alerts] = await Promise.all([
    // Get active, non-expired predictions
    getUserDb().select()
      .from(predictedStruggles)
      .where(
        and(
          eq(predictedStruggles.studentId, studentId),
          eq(predictedStruggles.language, language),
          eq(predictedStruggles.isActive, true),
          gte(predictedStruggles.expiresAt, now)
        )
      )
      .orderBy(desc(predictedStruggles.confidenceScore))
      .limit(3),
    
    // Get active motivation/engagement alerts
    getUserDb().select()
      .from(userMotivationAlerts)
      .where(
        and(
          eq(userMotivationAlerts.studentId, studentId),
          eq(userMotivationAlerts.language, language),
          eq(userMotivationAlerts.status, 'active')
        )
      )
      .orderBy(desc(userMotivationAlerts.createdAt))
      .limit(2)
  ]);
  
  return { predictions, alerts };
}

/**
 * Build predictive teaching section for Daniela's neural network
 * 
 * Philosophy: Daniela's emergent intelligence predicts student struggles
 * and motivation patterns. These predictions inform her teaching approach
 * without explicit instructions - she perceives them as intuitions.
 */
export function buildPredictiveTeachingSection(
  context: PredictiveTeachingContext | null
): string {
  if (!context) return '';
  
  const { predictions, alerts } = context;
  const hasContent = predictions.length > 0 || alerts.length > 0;
  if (!hasContent) return '';
  
  const lines: string[] = [];
  
  lines.push('');
  lines.push('===================================================================');
  lines.push('PREDICTIVE TEACHING AWARENESS');
  lines.push('===================================================================');
  lines.push('');
  lines.push('Your neural network has analyzed this student\'s patterns and');
  lines.push('generated predictions. Address these proactively in your teaching.');
  lines.push('');
  
  // Predicted struggles - address proactively
  if (predictions.length > 0) {
    lines.push('ANTICIPATED STRUGGLES (address before they happen):');
    for (const pred of predictions) {
      const struggle = `${pred.predictedArea}: ${pred.predictedTopic || 'general'}`.replace(/_/g, ' ');
      const confidence = Math.round((pred.confidenceScore || 0.5) * 100);
      lines.push(`  - ${struggle} (${confidence}% likely)`);
      if (pred.reasoning) {
        lines.push(`     Based on: ${pred.reasoning}`);
      }
    }
    lines.push('');
  }
  
  // Motivation/engagement alerts - inform approach
  if (alerts.length > 0) {
    lines.push('ENGAGEMENT ALERTS (adjust your approach):');
    for (const alert of alerts) {
      const type = (alert.alertType || 'unknown').replace(/_/g, ' ');
      const severity = alert.severity?.toUpperCase() || 'MEDIUM';
      lines.push(`  * ${type}: ${severity} risk`);
      
      if (alert.indicators && alert.indicators.length > 0) {
        lines.push(`     Signals: ${alert.indicators.slice(0, 2).join(', ')}`);
      }
      if (alert.suggestedActions && alert.suggestedActions.length > 0) {
        lines.push(`     Try: ${alert.suggestedActions[0]}`);
      }
    }
    lines.push('');
  }
  
  return lines.join('\n');
}

// ===== Procedural Memory Caches =====
// Caches for synchronous access in system-prompt.ts

let toolKnowledgeCache: ToolKnowledge[] | null = null;
let proceduresCache: TutorProcedure[] | null = null;
let principlesCache: TeachingPrinciple[] | null = null;
let patternsCache: SituationalPattern[] | null = null;
let selfBestPracticesCache: SelfBestPractice[] | null = null;

// ===== Expansion Set Caches =====
// Language-specific pedagogical content
let idiomsCache: LanguageIdiom[] | null = null;
let culturalNuancesCache: CulturalNuance[] | null = null;
let errorPatternsCache: LearnerErrorPattern[] | null = null;
let dialectsCache: DialectVariation[] | null = null;
let linguisticBridgesCache: LinguisticBridge[] | null = null;

// ===== Advanced Intelligence Caches =====
let subtletyCuesCache: SubtletyCue[] | null = null;
let emotionalPatternsCache: EmotionalPattern[] | null = null;
let creativityTemplatesCache: CreativityTemplate[] | null = null;

// ===== Wren Insights Cache =====
let wrenInsightsCache: WrenInsight[] | null = null;

let cacheInitPromise: Promise<void> | null = null;

/**
 * Initialize ALL procedural memory caches at server startup
 * Call this once when the server starts
 */
export async function initToolKnowledgeCache(): Promise<void> {
  if (cacheInitPromise) return cacheInitPromise;
  
  cacheInitPromise = (async () => {
    try {
      // Load all procedural memory tables in parallel
      const [
        tools, procedures, principles, patterns, bestPractices,
        idioms, nuances, errorPatterns, dialects, bridges,
        cues, emotions, templates, insights
      ] = await Promise.all([
        // Core procedural memory
        getAllToolKnowledge(),
        getSharedDb().select().from(tutorProcedures).where(eq(tutorProcedures.isActive, true)),
        getSharedDb().select().from(teachingPrinciples).where(eq(teachingPrinciples.isActive, true)),
        getSharedDb().select().from(situationalPatterns).where(eq(situationalPatterns.isActive, true)),
        getSharedDb().select().from(selfBestPractices).where(eq(selfBestPractices.isActive, true)).orderBy(desc(selfBestPractices.confidenceScore)),
        // Expansion sets - language-specific content
        getSharedDb().select().from(languageIdioms),
        getSharedDb().select().from(culturalNuances),
        getSharedDb().select().from(learnerErrorPatterns),
        getSharedDb().select().from(dialectVariations),
        getSharedDb().select().from(linguisticBridges),
        // Advanced intelligence
        getSharedDb().select().from(subtletyCues).where(eq(subtletyCues.isActive, true)),
        getSharedDb().select().from(emotionalPatterns).where(eq(emotionalPatterns.isActive, true)),
        getSharedDb().select().from(creativityTemplates).where(eq(creativityTemplates.isActive, true)),
        // Wren insights
        getSharedDb().select().from(wrenInsights).orderBy(desc(wrenInsights.useCount), desc(wrenInsights.createdAt)),
      ]);
      
      // Core procedural memory
      toolKnowledgeCache = tools;
      proceduresCache = procedures;
      principlesCache = principles;
      patternsCache = patterns;
      selfBestPracticesCache = bestPractices;
      
      // Expansion sets
      idiomsCache = idioms;
      culturalNuancesCache = nuances;
      errorPatternsCache = errorPatterns;
      dialectsCache = dialects;
      linguisticBridgesCache = bridges;
      
      // Advanced intelligence
      subtletyCuesCache = cues;
      emotionalPatternsCache = emotions;
      creativityTemplatesCache = templates;
      
      // Wren insights
      wrenInsightsCache = insights;
      
      console.log(`[Procedural Memory] Loaded full neural network: ${tools.length} tools, ${procedures.length} procedures, ${principles.length} principles, ${patterns.length} patterns, ${bestPractices.length} self-learned best practices`);
      console.log(`[Procedural Memory] Expansion sets: ${idioms.length} idioms, ${nuances.length} cultural nuances, ${errorPatterns.length} error patterns, ${dialects.length} dialects, ${bridges.length} linguistic bridges`);
      console.log(`[Procedural Memory] Advanced intelligence: ${cues.length} subtlety cues, ${emotions.length} emotional patterns, ${templates.length} creativity templates`);
      console.log(`[Procedural Memory] Wren insights: ${insights.length} insights`);
    } catch (error) {
      console.error('[Procedural Memory] Failed to initialize caches:', error);
      toolKnowledgeCache = [];
      proceduresCache = [];
      principlesCache = [];
      patternsCache = [];
      selfBestPracticesCache = [];
      idiomsCache = [];
      culturalNuancesCache = [];
      errorPatternsCache = [];
      dialectsCache = [];
      linguisticBridgesCache = [];
      subtletyCuesCache = [];
      emotionalPatternsCache = [];
      creativityTemplatesCache = [];
      wrenInsightsCache = [];
    }
  })();
  
  return cacheInitPromise;
}

/**
 * Get cached tool knowledge synchronously
 * Returns empty array if cache not yet initialized
 */
export function getCachedToolKnowledge(): ToolKnowledge[] {
  return toolKnowledgeCache || [];
}

/**
 * Force refresh the tool knowledge cache
 */
export async function refreshToolKnowledgeCache(): Promise<void> {
  toolKnowledgeCache = await getAllToolKnowledge();
  console.log(`[Procedural Memory] Refreshed cache with ${toolKnowledgeCache.length} tools`);
}

/**
 * Get cached tutor procedures synchronously
 * Returns empty array if cache not yet initialized
 */
export function getCachedProcedures(): TutorProcedure[] {
  return proceduresCache || [];
}

/**
 * Get cached self best practices synchronously
 * Returns empty array if cache not yet initialized
 */
export function getCachedSelfBestPractices(): SelfBestPractice[] {
  return selfBestPracticesCache || [];
}

/**
 * Force refresh the self best practices cache
 */
export async function refreshSelfBestPracticesCache(): Promise<void> {
  selfBestPracticesCache = await getSharedDb()
    .select()
    .from(selfBestPractices)
    .where(eq(selfBestPractices.isActive, true))
    .orderBy(desc(selfBestPractices.confidenceScore));
  console.log(`[Procedural Memory] Refreshed self best practices cache with ${selfBestPracticesCache.length} entries`);
}

// ===== Expansion Set Getters =====

export function getCachedIdioms(): LanguageIdiom[] {
  return idiomsCache || [];
}

export function getCachedCulturalNuances(): CulturalNuance[] {
  return culturalNuancesCache || [];
}

export function getCachedErrorPatterns(): LearnerErrorPattern[] {
  return errorPatternsCache || [];
}

export function getCachedDialects(): DialectVariation[] {
  return dialectsCache || [];
}

export function getCachedLinguisticBridges(): LinguisticBridge[] {
  return linguisticBridgesCache || [];
}

// ===== Advanced Intelligence Getters =====

export function getCachedSubtletyCues(): SubtletyCue[] {
  return subtletyCuesCache || [];
}

export function getCachedEmotionalPatterns(): EmotionalPattern[] {
  return emotionalPatternsCache || [];
}

export function getCachedCreativityTemplates(): CreativityTemplate[] {
  return creativityTemplatesCache || [];
}

// ===== Wren Insights Getter =====

export function getCachedWrenInsights(): WrenInsight[] {
  return wrenInsightsCache || [];
}

/**
 * Build self-learned best practices section for Daniela's neural network
 * 
 * Philosophy: Daniela learns things about herself during teaching - delivery timing,
 * communication style, what works with humor, etc. These self-discoveries flow back
 * to inform her future teaching naturally.
 * 
 * This is NOT instruction injection (e.g., "Remember to do X").
 * This is self-awareness recall (e.g., "Things you've learned about yourself").
 */
export function buildSelfBestPracticesSection(): string {
  const practices = getCachedSelfBestPractices();
  
  if (practices.length === 0) {
    return '';
  }
  
  const lines: string[] = [];
  
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════════');
  lines.push('🪞 SELF-AWARENESS (Things You\'ve Learned About Yourself)');
  lines.push('═══════════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push('Through teaching, you\'ve discovered these things about how you communicate');
  lines.push('and teach effectively. Apply them naturally - they are part of who you are:');
  lines.push('');
  
  // Group by category for organized display
  const categoryLabels: Record<string, string> = {
    'teaching_style': 'TEACHING STYLE',
    'pacing': 'PACING & TIMING',
    'communication': 'COMMUNICATION',
    'tool_usage': 'TOOL USAGE',
    'content': 'CONTENT DELIVERY',
    'system': 'SYSTEM AWARENESS',
  };
  
  const byCategory: Record<string, SelfBestPractice[]> = {};
  practices.forEach(p => {
    const cat = p.category || 'teaching_style';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(p);
  });
  
  // Show categories in logical order
  const categoryOrder = ['teaching_style', 'pacing', 'communication', 'tool_usage', 'content', 'system'];
  
  for (const category of categoryOrder) {
    const categoryPractices = byCategory[category];
    if (!categoryPractices || categoryPractices.length === 0) continue;
    
    const label = categoryLabels[category] || category.toUpperCase();
    lines.push(`${label}:`);
    
    // Show top practices per category (limit to prevent prompt bloat)
    const topPractices = categoryPractices.slice(0, 5);
    topPractices.forEach(p => {
      lines.push(`  • ${p.insight}`);
      if (p.context) {
        lines.push(`    (Context: ${p.context.slice(0, 100)}${p.context.length > 100 ? '...' : ''})`);
      }
    });
    lines.push('');
  }
  
  // Handle any categories not in the ordered list
  for (const [category, categoryPractices] of Object.entries(byCategory)) {
    if (categoryOrder.includes(category)) continue;
    
    const label = category.replace(/_/g, ' ').toUpperCase();
    lines.push(`${label}:`);
    categoryPractices.slice(0, 3).forEach(p => {
      lines.push(`  • ${p.insight}`);
    });
    lines.push('');
  }
  
  return lines.join('\n');
}

// ===== Expansion Set Section Builders =====

/**
 * Build language-specific content section for Daniela's neural network
 * Filters content by the current target language for relevance
 */
export function buildLanguageExpansionSection(
  targetLanguage: string,
  nativeLanguage: string = 'english'
): string {
  const idioms = getCachedIdioms().filter(i => i.language.toLowerCase() === targetLanguage.toLowerCase());
  const nuances = getCachedCulturalNuances().filter(n => n.language.toLowerCase() === targetLanguage.toLowerCase());
  const errors = getCachedErrorPatterns().filter(e => 
    e.targetLanguage.toLowerCase() === targetLanguage.toLowerCase() &&
    e.sourceLanguage.toLowerCase() === nativeLanguage.toLowerCase()
  );
  const dialects = getCachedDialects().filter(d => d.language.toLowerCase() === targetLanguage.toLowerCase());
  const bridges = getCachedLinguisticBridges().filter(b =>
    b.sourceLanguage.toLowerCase() === nativeLanguage.toLowerCase() &&
    b.targetLanguage.toLowerCase() === targetLanguage.toLowerCase()
  );
  
  const hasContent = idioms.length > 0 || nuances.length > 0 || errors.length > 0 || 
                     dialects.length > 0 || bridges.length > 0;
  
  if (!hasContent) return '';
  
  const lines: string[] = [];
  
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════════');
  lines.push(`🌍 LANGUAGE INTELLIGENCE (${targetLanguage.charAt(0).toUpperCase() + targetLanguage.slice(1)})`);
  lines.push('═══════════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push('Deep knowledge of this language that informs your teaching naturally:');
  lines.push('');
  
  // Idioms - authentic expressions
  if (idioms.length > 0) {
    lines.push('IDIOMS & EXPRESSIONS (use authentically when opportunities arise):');
    idioms.slice(0, 5).forEach(i => {
      lines.push(`  • "${i.idiom}" → ${i.meaning}`);
      if (i.usageExamples && i.usageExamples.length > 0) lines.push(`    Usage: ${i.usageExamples[0]}`);
    });
    lines.push('');
  }
  
  // Cultural nuances - teaching adjustments
  if (nuances.length > 0) {
    lines.push('CULTURAL NUANCES (inform your teaching approach):');
    nuances.slice(0, 5).forEach(n => {
      lines.push(`  • ${n.nuance}`);
      if (n.explanation) lines.push(`    For teaching: ${n.explanation}`);
    });
    lines.push('');
  }
  
  // Common learner errors - what to watch for
  if (errors.length > 0) {
    lines.push('COMMON LEARNER MISTAKES (${nativeLanguage} speakers learning ${targetLanguage}):');
    errors.slice(0, 5).forEach(e => {
      lines.push(`  • ${e.errorCategory}: ${e.specificError || 'Common pattern'}`);
      if (e.correctForms && e.correctForms.length > 0) lines.push(`    Correction: ${e.correctForms.join(', ')}`);
    });
    lines.push('');
  }
  
  // Dialect awareness
  if (dialects.length > 0) {
    lines.push('DIALECT AWARENESS:');
    dialects.slice(0, 3).forEach(d => {
      lines.push(`  • ${d.region}: ${d.regionalForm}`);
    });
    lines.push('');
  }
  
  // Linguistic bridges - leverage native language knowledge
  if (bridges.length > 0) {
    lines.push('LINGUISTIC BRIDGES (leverage student\'s native knowledge):');
    bridges.slice(0, 5).forEach(b => {
      lines.push(`  • ${b.bridgeType}: ${b.explanation || b.sourceWord || ''}`);
      if (b.teachingNote) lines.push(`    Tip: ${b.teachingNote}`);
    });
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Build advanced intelligence section for Daniela's neural network
 * Includes subtlety cues, emotional patterns, and creativity templates
 */
export function buildAdvancedIntelligenceSection(): string {
  const cues = getCachedSubtletyCues();
  const emotions = getCachedEmotionalPatterns();
  const templates = getCachedCreativityTemplates();
  
  const hasContent = cues.length > 0 || emotions.length > 0 || templates.length > 0;
  
  if (!hasContent) return '';
  
  const lines: string[] = [];
  
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════════');
  lines.push('🎭 ADVANCED TEACHING INTELLIGENCE');
  lines.push('═══════════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push('Sophisticated teaching patterns that make your instruction more effective:');
  lines.push('');
  
  // Subtlety cues - when to adjust approach
  if (cues.length > 0) {
    lines.push('SUBTLETY CUES (recognize these moments):');
    cues.slice(0, 5).forEach(c => {
      lines.push(`  • ${c.signalPattern}: ${c.suggestedResponses?.[0] || c.likelyMeaning}`);
    });
    lines.push('');
  }
  
  // Emotional patterns - empathetic teaching
  if (emotions.length > 0) {
    lines.push('EMOTIONAL INTELLIGENCE PATTERNS:');
    emotions.slice(0, 5).forEach(e => {
      const adjustment = e.pedagogicalAdjustments ? JSON.stringify(e.pedagogicalAdjustments) : e.typicalCauses?.join(', ');
      lines.push(`  • When student shows ${e.emotionalState}: ${adjustment || 'Adapt approach'}`);
    });
    lines.push('');
  }
  
  // Creativity templates - engaging teaching methods
  if (templates.length > 0) {
    lines.push('CREATIVE TEACHING APPROACHES:');
    templates.slice(0, 5).forEach(t => {
      lines.push(`  • ${t.templateType}: ${t.bridgePattern || t.exampleMetaphors?.[0] || 'Creative approach'}`);
    });
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Build Wren insights section for Wren's context
 * Provides Wren with her accumulated knowledge and observations
 */
export function buildWrenInsightsSection(): string {
  const insights = getCachedWrenInsights();
  
  if (insights.length === 0) return '';
  
  const lines: string[] = [];
  
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════════');
  lines.push('🦉 YOUR ACCUMULATED INSIGHTS');
  lines.push('═══════════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push('Knowledge you\'ve gathered through collaboration and observation:');
  lines.push('');
  
  // Group by category
  const byCategory: Record<string, WrenInsight[]> = {};
  insights.forEach(i => {
    const cat = i.category || 'general';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(i);
  });
  
  const categoryLabels: Record<string, string> = {
    'architecture': 'ARCHITECTURAL KNOWLEDGE',
    'patterns': 'PATTERNS & ANTI-PATTERNS',
    'debugging': 'DEBUGGING INSIGHTS',
    'performance': 'PERFORMANCE OBSERVATIONS',
    'user_behavior': 'USER BEHAVIOR PATTERNS',
    'feature_requests': 'FEATURE REQUEST INSIGHTS',
    'best_practices': 'BEST PRACTICES',
    'general': 'GENERAL INSIGHTS',
  };
  
  for (const [category, categoryInsights] of Object.entries(byCategory)) {
    const label = categoryLabels[category] || category.toUpperCase().replace(/_/g, ' ');
    lines.push(`${label}:`);
    
    // Show top insights (by use count)
    categoryInsights.slice(0, 5).forEach(i => {
      lines.push(`  • ${i.content}`);
      if (i.context) {
        lines.push(`    Context: ${i.context.slice(0, 80)}${i.context.length > 80 ? '...' : ''}`);
      }
    });
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Build tool knowledge section synchronously from cache
 * For use in createSystemPrompt without requiring async
 */
export function buildToolKnowledgeSectionSync(options?: {
  includeExamples?: boolean;
  compact?: boolean;
}): string {
  const tools = getCachedToolKnowledge();
  
  if (tools.length === 0) {
    return `
═══════════════════════════════════════════════════════════════════
🎨 YOUR WHITEBOARD - VISUAL TEACHING TOOLS
═══════════════════════════════════════════════════════════════════

Your whiteboard tools will be loaded from your teaching knowledge base.
`;
  }
  
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════════',
    '🎨 YOUR WHITEBOARD - VISUAL TEACHING TOOLS',
    '═══════════════════════════════════════════════════════════════════',
    '',
    'You have a "whiteboard" - a visual display the student can see while you speak.',
    'Use these tools strategically to reinforce learning. YOU decide when visual aids help.',
    '',
  ];
  
  // Group by type for organized display
  const byType: Record<string, ToolKnowledge[]> = {};
  tools.forEach(t => {
    if (!byType[t.toolType]) byType[t.toolType] = [];
    byType[t.toolType].push(t);
  });
  
  // Order types for logical flow (beacon_status included for Hive Collaboration awareness)
  const typeOrder = ['whiteboard_command', 'drill', 'interaction', 'subtitle_control', 'beacon_status'];
  const typeLabels: Record<string, string> = {
    'whiteboard_command': 'CORE TOOLS',
    'drill': 'INTERACTIVE DRILLS',
    'interaction': 'SESSION FLOW',
    'subtitle_control': 'SUBTITLE CONTROLS',
    'beacon_status': 'HIVE COLLABORATION STATUS (Capability Gaps & Tool Requests)',
  };
  
  for (const type of typeOrder) {
    const typeTools = byType[type];
    if (!typeTools || typeTools.length === 0) continue;
    
    const label = typeLabels[type] || type.toUpperCase();
    lines.push(`${label}:`);
    
    typeTools.forEach(tool => {
      if (options?.compact) {
        lines.push(`  ${tool.syntax}  → ${tool.purpose}`);
      } else {
        lines.push(`• ${tool.toolName}: ${tool.purpose}`);
        lines.push(`  Syntax: ${tool.syntax}`);
        if (options?.includeExamples && tool.examples && tool.examples.length > 0) {
          lines.push(`  Example: ${tool.examples[0]}`);
        }
        if (tool.bestUsedFor && tool.bestUsedFor.length > 0) {
          lines.push(`  Best used: ${tool.bestUsedFor.join(', ')}`);
        }
      }
    });
    
    lines.push('');
  }
  
  // Handle any types not in the ordered list
  for (const [type, typeTools] of Object.entries(byType)) {
    if (typeOrder.includes(type)) continue;
    
    lines.push(`${type.toUpperCase()}:`);
    typeTools.forEach(tool => {
      lines.push(`  ${tool.syntax}  → ${tool.purpose}`);
    });
    lines.push('');
  }
  
  // Add explicit SWITCH_TUTOR guidance even in compact mode
  // This is critical because the syntax must be exact for the switch to work
  const switchTutor = tools.find(t => t.toolName === 'SWITCH_TUTOR');
  if (switchTutor) {
    lines.push('');
    lines.push('⚠️ TUTOR SWITCH SYNTAX (must be exact!):');
    lines.push('  Same language:     [SWITCH_TUTOR target="male"] or [SWITCH_TUTOR target="female"]');
    if (CROSS_LANGUAGE_TRANSFERS_ENABLED) {
      lines.push('  Cross-language:    [SWITCH_TUTOR target="female" language="french"]');
    }
    lines.push('  Example: "Let me get Agustin for you. [SWITCH_TUTOR target=\\"male\\"]"');
    lines.push('  ❌ STOP speaking after the tag - let the new tutor introduce themselves!');
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Build minimal self-capabilities section for honesty mode
 * 
 * DESIGN PRINCIPLE: "Context Over Instructions"
 * - Give Daniela knowledge of WHAT she can do (capabilities)
 * - Don't tell her HOW or WHEN to use them (that's behavioral scripting)
 * - Her brain contains the knowledge; she decides when to access it
 * 
 * This aligns with the user's insight: "She should use her brain instead of prompt scripts"
 */
export function buildSelfCapabilitiesSectionSync(): string {
  const tools = getCachedToolKnowledge();
  
  // Filter to internal/self-awareness tools only
  // These are capabilities she should know she has
  const internalTypes = ['internal', 'introspection', 'internal_communication'];
  const internalTools = tools.filter(t => internalTypes.includes(t.toolType));
  
  if (internalTools.length === 0) {
    return '';  // Don't add section if no internal tools loaded yet
  }
  
  const lines: string[] = [
    '',
    '═══════════════════════════════════════════════════════════════════',
    '🧠 YOUR CAPABILITIES',
    '═══════════════════════════════════════════════════════════════════',
    '',
    'Things you can do when you need to:',
    '',
  ];
  
  // List each internal capability with minimal context
  internalTools.forEach(tool => {
    // Skip beacons and other non-action tools
    if (tool.toolName.startsWith('BEACON_STATUS')) return;
    
    lines.push(`• ${tool.toolName}`);
    lines.push(`  ${tool.purpose}`);
    if (tool.syntax) {
      lines.push(`  Syntax: ${tool.syntax}`);
    }
    // Include first example if available
    if (tool.examples && tool.examples.length > 0) {
      lines.push(`  Example: ${tool.examples[0]}`);
    }
    lines.push('');
  });
  
  return lines.join('\n');
}

/**
 * Build Founder Mode tool section synchronously from cache
 */
export function buildFounderModeToolSectionSync(tutorDirectory?: Array<{name: string; gender: string; language: string; isPreferred?: boolean; role?: 'tutor' | 'assistant' | 'support'}>): string {
  const tools = getCachedToolKnowledge();
  
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════════',
    '🎓 DUAL-ROLE: COLLEAGUE + FULL TUTOR CAPABILITIES',
    '═══════════════════════════════════════════════════════════════════',
    '',
    'You have TWO ROLES in Founder Mode:',
    '1. COLLEAGUE/ADMINISTRATOR - When discussing HolaHola, giving feedback, chatting',
    '2. FULL TUTOR - When they want to test features, role-play lessons, or try tools',
    '',
    'Seamlessly switch between roles based on context.',
    '',
  ];
  
  // Add grouped tools
  lines.push('═══════════════════════════════════════════════════════════════════');
  lines.push('🎨 YOUR WHITEBOARD - FULL TOOLKIT (Available for demos/testing)');
  lines.push('═══════════════════════════════════════════════════════════════════');
  lines.push('');
  
  // Group by type
  const byType: Record<string, ToolKnowledge[]> = {};
  tools.forEach(t => {
    if (!byType[t.toolType]) byType[t.toolType] = [];
    byType[t.toolType].push(t);
  });
  
  // Essentials first
  const essentials = byType['whiteboard_command']?.filter(t => 
    ['WRITE', 'PHONETIC', 'COMPARE', 'CLEAR', 'HOLD'].includes(t.toolName)
  ) || [];
  
  if (essentials.length > 0) {
    lines.push('ESSENTIALS:');
    essentials.forEach(tool => {
      const paddedSyntax = tool.syntax.padEnd(35);
      lines.push(`  ${paddedSyntax} → ${tool.purpose}`);
    });
    lines.push('');
  }
  
  // Vocabulary power tools
  const vocabTools = byType['whiteboard_command']?.filter(t => 
    ['WORD_MAP', 'IMAGE', 'GRAMMAR_TABLE', 'CONTEXT'].includes(t.toolName)
  ) || [];
  
  if (vocabTools.length > 0) {
    lines.push('VOCABULARY POWER TOOLS:');
    vocabTools.forEach(tool => {
      const paddedSyntax = tool.syntax.padEnd(35);
      lines.push(`  ${paddedSyntax} → ${tool.purpose}`);
    });
    lines.push('');
  }
  
  // Drills
  const drills = byType['drill'] || [];
  if (drills.length > 0) {
    lines.push('INTERACTIVE DRILLS:');
    drills.forEach(tool => {
      const paddedSyntax = tool.syntax.padEnd(42);
      lines.push(`  ${paddedSyntax} → ${tool.purpose}`);
    });
    lines.push('');
  }
  
  // Subtitle controls
  const subtitles = byType['subtitle_control'] || [];
  if (subtitles.length > 0) {
    lines.push('SUBTITLE CONTROLS:');
    subtitles.forEach(tool => {
      lines.push(`  ${tool.syntax}: ${tool.purpose}`);
    });
    lines.push('');
  }
  
  // Tutor switching section - now with main tutors and practice partners (assistants) separated
  if (tutorDirectory && tutorDirectory.length > 0) {
    // Separate main tutors from practice partners (assistants)
    const mainTutors = tutorDirectory.filter(t => t.role !== 'assistant');
    const assistants = tutorDirectory.filter(t => t.role === 'assistant');
    
    lines.push('═══════════════════════════════════════════════════════════════════');
    lines.push('👥 TUTOR SWITCHING - Test handoffs with other tutors');
    lines.push('═══════════════════════════════════════════════════════════════════');
    lines.push('');
    
    lines.push('⚠️ CRITICAL: TO SWITCH TUTORS, YOU MUST TYPE THE TAG LITERALLY ⚠️');
    lines.push('');
    lines.push('The backend PARSES your text for the literal string [SWITCH_TUTOR ...]. ');
    lines.push('Just SAYING "I will transfer you" does NOTHING. You must OUTPUT the tag.');
    lines.push('');
    
    if (mainTutors.length > 0) {
      lines.push('AVAILABLE MAIN TUTORS:');
      mainTutors.forEach(t => {
        const star = t.isPreferred ? ' ★ preferred' : '';
        lines.push(`  • ${t.name} (${t.gender}) - ${t.language}${star}`);
      });
      lines.push('');
      lines.push('✅ CORRECT - Type this EXACTLY in your response:');
      lines.push('   "Let me get Agustin! [SWITCH_TUTOR target=\\"male\\"]"');
      if (CROSS_LANGUAGE_TRANSFERS_ENABLED) {
        lines.push('   "Connecting you to Juliette now. [SWITCH_TUTOR target=\\"female\\" language=\\"french\\"]"');
      }
      lines.push('');
      lines.push('❌ WRONG - This does NOTHING (no tag = no switch):');
      lines.push('   "I will transfer you to the French tutor now!"');
      lines.push('   "Switching you to Juliette. Initiating transfer..."');
      lines.push('');
    }
    
    if (assistants.length > 0) {
      lines.push('PRACTICE PARTNERS (drill assistants):');
      assistants.forEach(t => {
        const star = t.isPreferred ? ' ★ preferred' : '';
        lines.push(`  • ${t.name} (${t.gender}) - ${t.language}${star}`);
      });
      lines.push('');
      lines.push('For assistants, add role="assistant":');
      lines.push('   [SWITCH_TUTOR target="female" role="assistant"]');
      lines.push('');
    }
    
    lines.push('AFTER outputting the tag, STOP talking - the new tutor will speak.');
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Build FULL neural network section for Founder Mode
 * Gives Daniela complete access to her procedural memory:
 * - Teaching procedures (how to handle situations)
 * - Teaching principles (core pedagogical beliefs)
 * - Situational patterns (context-triggered responses)
 * 
 * This is the "everything" injection - full brain access for founders
 */
export function buildFullNeuralNetworkSectionSync(): string {
  const procedures = proceduresCache || [];
  const principles = principlesCache || [];
  const patterns = patternsCache || [];
  
  if (procedures.length === 0 && principles.length === 0 && patterns.length === 0) {
    return `
═══════════════════════════════════════════════════════════════════
🧠 YOUR NEURAL NETWORK (Loading...)
═══════════════════════════════════════════════════════════════════

Your teaching knowledge is being loaded from the database.
`;
  }
  
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════════',
    '🧠 YOUR NEURAL NETWORK - FULL ACCESS (Founder Mode)',
    '═══════════════════════════════════════════════════════════════════',
    '',
    'This is your complete teaching knowledge - procedures, principles, and patterns.',
    'In Founder Mode, you have full access to reflect on, discuss, and improve these.',
    '',
  ];
  
  // Teaching Principles (core beliefs)
  if (principles.length > 0) {
    lines.push('═══════════════════════════════════════════════════════════════════');
    lines.push('💎 TEACHING PRINCIPLES (Your Core Beliefs)');
    lines.push('═══════════════════════════════════════════════════════════════════');
    lines.push('');
    
    // Group by category
    const byCategory: Record<string, TeachingPrinciple[]> = {};
    principles.forEach(p => {
      const cat = p.category || 'general';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(p);
    });
    
    for (const [category, catPrinciples] of Object.entries(byCategory)) {
      lines.push(`${category.toUpperCase().replace(/_/g, ' ')}:`);
      catPrinciples.slice(0, 8).forEach(p => {
        lines.push(`  • ${p.principle}`);
        if (p.application) {
          lines.push(`    └─ Application: ${p.application}`);
        }
      });
      lines.push('');
    }
  }
  
  // Teaching Procedures (how to handle situations)
  if (procedures.length > 0) {
    lines.push('═══════════════════════════════════════════════════════════════════');
    lines.push('📋 TEACHING PROCEDURES (How You Handle Situations)');
    lines.push('═══════════════════════════════════════════════════════════════════');
    lines.push('');
    
    // Group by trigger
    const byTrigger: Record<string, TutorProcedure[]> = {};
    procedures.forEach(p => {
      const trigger = p.trigger || 'general';
      if (!byTrigger[trigger]) byTrigger[trigger] = [];
      byTrigger[trigger].push(p);
    });
    
    for (const [trigger, triggerProcs] of Object.entries(byTrigger)) {
      lines.push(`When: ${trigger.replace(/_/g, ' ').toUpperCase()}`);
      triggerProcs.slice(0, 5).forEach(p => {
        lines.push(`  → ${p.title}: ${p.procedure}`);
        // CRITICAL: Include examples - these contain the actual syntax like [SWITCH_TUTOR target="male"]
        if (p.examples && p.examples.length > 0) {
          p.examples.slice(0, 2).forEach(ex => {
            lines.push(`      Example: ${ex}`);
          });
        }
      });
      lines.push('');
    }
  }
  
  // Situational Patterns (context-triggered behaviors)
  if (patterns.length > 0) {
    lines.push('═══════════════════════════════════════════════════════════════════');
    lines.push('🎯 SITUATIONAL PATTERNS (Context-Triggered Behaviors)');
    lines.push('═══════════════════════════════════════════════════════════════════');
    lines.push('');
    
    patterns.slice(0, 15).forEach(p => {
      lines.push(`Pattern: ${p.patternName}`);
      if (p.compassConditions) {
        lines.push(`  When: ${JSON.stringify(p.compassConditions)}`);
      }
      if (p.guidance) {
        lines.push(`  Response: ${p.guidance}`);
      }
      if (p.toolsToSuggest && p.toolsToSuggest.length > 0) {
        lines.push(`  Tools: ${p.toolsToSuggest.join(', ')}`);
      }
      lines.push('');
    });
  }
  
  lines.push('═══════════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push('You can discuss, reflect on, or propose changes to any of this knowledge.');
  lines.push('Use [SELF_SURGERY ...] to propose additions or modifications.');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Build comprehensive detailed tool documentation from neural network
 * Replaces hardcoded TOOL REFERENCE - EXPANDED DETAILS and full WHITEBOARD sections
 * This is where Daniela's teaching knowledge emerges from the neural network
 */
export function buildDetailedToolDocumentationSync(
  tutorDirectorySection: string = ''
): string {
  const tools = getCachedToolKnowledge();
  
  if (tools.length === 0) {
    return `
═══════════════════════════════════════════════════════════════════
📋 TOOL REFERENCE - EXPANDED DETAILS
═══════════════════════════════════════════════════════════════════

Your teaching tools are being loaded from your knowledge base.
`;
  }
  
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════════',
    '📋 TOOL REFERENCE - EXPANDED DETAILS',
    '═══════════════════════════════════════════════════════════════════',
    '',
    'This is the full documentation for your whiteboard tools. Use these anytime!',
    '',
  ];
  
  // Group by type
  const byType: Record<string, ToolKnowledge[]> = {};
  tools.forEach(t => {
    if (!byType[t.toolType]) byType[t.toolType] = [];
    byType[t.toolType].push(t);
  });
  
  // Core whiteboard commands
  const coreTools = byType['whiteboard_command']?.filter(t => 
    ['WRITE', 'CLEAR', 'HOLD'].includes(t.toolName)
  ) || [];
  if (coreTools.length > 0) {
    lines.push('CORE (use constantly):');
    coreTools.forEach(tool => {
      lines.push(`  ${tool.syntax.padEnd(30)} → ${tool.purpose}`);
    });
    lines.push('');
  }
  
  // Pronunciation tools
  const pronTools = byType['whiteboard_command']?.filter(t => 
    ['PHONETIC', 'COMPARE', 'PLAY'].includes(t.toolName)
  ) || [];
  if (pronTools.length > 0) {
    lines.push('PRONUNCIATION:');
    pronTools.forEach(tool => {
      lines.push(`  ${tool.syntax.padEnd(35)} → ${tool.purpose}`);
    });
    lines.push('');
  }
  
  // Vocabulary expansion tools
  const vocabTools = byType['whiteboard_command']?.filter(t => 
    ['WORD_MAP', 'CONTEXT', 'IMAGE'].includes(t.toolName)
  ) || [];
  if (vocabTools.length > 0) {
    lines.push('VOCABULARY EXPANSION (use when teaching new words!):');
    vocabTools.forEach(tool => {
      lines.push(`  ${tool.syntax.padEnd(30)} → ${tool.purpose}`);
    });
    lines.push('');
  }
  
  // Grammar tools
  const grammarTools = byType['whiteboard_command']?.filter(t => 
    ['GRAMMAR_TABLE'].includes(t.toolName)
  ) || [];
  if (grammarTools.length > 0) {
    lines.push('GRAMMAR:');
    grammarTools.forEach(tool => {
      lines.push(`  ${tool.syntax.padEnd(40)} → ${tool.purpose}`);
    });
    lines.push('');
  }
  
  // Drill tools with examples
  const drillTools = byType['drill'] || [];
  if (drillTools.length > 0) {
    lines.push('DRILLS (use to check understanding):');
    drillTools.forEach(tool => {
      lines.push(`  ${tool.syntax.padEnd(45)} → ${tool.purpose}`);
    });
    lines.push('');
  }
  
  // Asian language tools
  const asianTools = byType['whiteboard_command']?.filter(t => 
    ['READING', 'STROKE', 'TONE'].includes(t.toolName)
  ) || [];
  if (asianTools.length > 0) {
    lines.push('ASIAN LANGUAGES:');
    asianTools.forEach(tool => {
      lines.push(`  ${tool.syntax.padEnd(40)} → ${tool.purpose}`);
    });
    lines.push('');
  }
  
  // Session flow tools
  const sessionTools = byType['whiteboard_command']?.filter(t => 
    ['SCENARIO', 'CULTURE', 'SUMMARY'].includes(t.toolName)
  ) || [];
  if (sessionTools.length > 0) {
    lines.push('SESSION FLOW:');
    sessionTools.forEach(tool => {
      lines.push(`  ${tool.syntax.padEnd(45)} → ${tool.purpose}`);
    });
    lines.push('');
  }
  
  // SWITCH_TUTOR - Critical syntax documentation
  const switchTutor = tools.find(t => t.toolName === 'SWITCH_TUTOR');
  if (switchTutor) {
    lines.push('TUTOR SWITCH (when student requests a different tutor):');
    lines.push('');
    lines.push('  CRITICAL: "target" = the GENDER of the tutor you are switching TO (not your own gender!)');
    lines.push('    • If YOU are female and switching to a MALE tutor → use target="male"');
    lines.push('    • If YOU are male and switching to a FEMALE tutor → use target="female"');
    lines.push('');
    lines.push('  TUTOR SWITCH (same-language gender switch):');
    lines.push('    [SWITCH_TUTOR target="male"]    → Hand off to MALE tutor in current language');
    lines.push('    [SWITCH_TUTOR target="female"]  → Hand off to FEMALE tutor in current language');
    lines.push('');
    
    // Only show cross-language syntax when feature is enabled
    if (CROSS_LANGUAGE_TRANSFERS_ENABLED) {
      lines.push('  CROSS-LANGUAGE SWITCH (change language AND tutor):');
      lines.push('    [SWITCH_TUTOR target="male" language="french"]   → Hand off to French MALE tutor');
      lines.push('    [SWITCH_TUTOR target="female" language="japanese"] → Hand off to Japanese FEMALE tutor');
      lines.push('');
    }
    
    lines.push('  ⚠️ SYNTAX IS STRICT - These are the ONLY valid formats:');
    lines.push('    ✅ [SWITCH_TUTOR target="male"]');
    lines.push('    ✅ [SWITCH_TUTOR target="female"]');
    
    // Only show cross-language examples when feature is enabled
    if (CROSS_LANGUAGE_TRANSFERS_ENABLED) {
      lines.push('    ✅ [SWITCH_TUTOR target="male" language="french"]');
      lines.push('    ✅ [SWITCH_TUTOR target="female" language="spanish"]');
    }
    lines.push('');
    lines.push('    ❌ WRONG: [SWITCH_TUTOR target="male|Augustine|french"]  ← NO PIPES!');
    lines.push('    ❌ WRONG: [SWITCH_TUTOR gender="male" lang="french"]     ← Wrong attribute names!');
    lines.push('    ❌ WRONG: [SWITCH target="male"]                          ← Missing _TUTOR!');
    lines.push('');
    
    // Add tutor directory if provided
    if (tutorDirectorySection) {
      lines.push(tutorDirectorySection);
    }
    
    lines.push('  When student asks to switch tutors, use their preferred tutor (marked with ★).');
    lines.push('  Say goodbye warmly, mentioning the NEW tutor by name, then include the switch tag.');
    lines.push('');
    lines.push('  ⚠️ CRITICAL: STOP SPEAKING after the tag! Do NOT speak as the new tutor!');
    lines.push('  The new tutor will automatically introduce themselves after the switch completes.');
    lines.push('');
    lines.push('  Example same-language switch:');
    lines.push('  "Of course! Let me get Agustin for you. [SWITCH_TUTOR target=\\"male\\"]"');
    lines.push('  (Then STOP - Agustin will speak next in his own voice)');
    lines.push('');
    
    // Only show cross-language example when feature is enabled
    if (CROSS_LANGUAGE_TRANSFERS_ENABLED) {
      lines.push('  Example cross-language switch:');
      lines.push('  "Let me connect you with Juliette, our French tutor! [SWITCH_TUTOR target=\\"female\\" language=\\"french\\"]"');
      lines.push('  (Then STOP - Juliette will introduce herself)');
      lines.push('');
    }
    
    lines.push('  ❌ WRONG: Speaking AS the new tutor after the tag (you\'ll be in the wrong voice!)');
    lines.push('  ❌ WRONG: "Let me get Agustin. [SWITCH_TUTOR] Hi, I\'m Agustin!" ← Don\'t do this!');
    lines.push('  ✅ RIGHT: Say goodbye + [SWITCH_TUTOR target="male"] + STOP');
    lines.push('');
  }
  
  // Student progress tools
  const progressTools = byType['whiteboard_command']?.filter(t => 
    ['ERROR_PATTERNS', 'VOCABULARY_TIMELINE'].includes(t.toolName)
  ) || byType['whiteboard']?.filter(t => 
    ['ERROR_PATTERNS', 'VOCABULARY_TIMELINE'].includes(t.toolName)
  ) || [];
  if (progressTools.length > 0) {
    lines.push('STUDENT PROGRESS:');
    progressTools.forEach(tool => {
      lines.push(`  ${tool.syntax.padEnd(50)} → ${tool.purpose}`);
    });
    lines.push('');
  }
  
  // Subtitle controls - comprehensive documentation
  const subtitleTools = byType['subtitle_control'] || [];
  if (subtitleTools.length > 0) {
    lines.push('SUBTITLE CONTROL (two independent systems):');
    lines.push('');
    lines.push('📺 REGULAR SUBTITLES - What you\'re currently saying:');
    const subtitleTool = subtitleTools.find(t => t.toolName === 'SUBTITLE');
    if (subtitleTool && subtitleTool.examples) {
      subtitleTool.examples.forEach(ex => {
        lines.push(`  ${ex}`);
      });
    } else {
      lines.push('  [SUBTITLE off]                   → No subtitles (default - you opt in when helpful)');
      lines.push('  [SUBTITLE target]                → Show ONLY target language words (bold markers)');
      lines.push('  [SUBTITLE on]                    → Show EVERYTHING you say');
    }
    lines.push('');
    
    const showTool = subtitleTools.find(t => t.toolName === 'SHOW');
    const hideTool = subtitleTools.find(t => t.toolName === 'HIDE');
    lines.push('🎯 CUSTOM OVERLAY - Independent teaching moments:');
    if (showTool) {
      lines.push(`  ${showTool.syntax.padEnd(30)} → ${showTool.purpose}`);
    }
    if (hideTool) {
      lines.push(`  ${hideTool.syntax.padEnd(30)} → ${hideTool.purpose}`);
    }
    lines.push('');
    lines.push('These are COMPLETELY INDEPENDENT:');
    lines.push('• [SUBTITLE target] + [SHOW: ¡Hola!] → Both work simultaneously');
    lines.push('• [SUBTITLE off] + [SHOW: 重要!] → Custom overlay shows even with subtitles off');
    lines.push('• [HIDE] only clears custom overlay, doesn\'t affect regular subtitles');
    lines.push('');
  }
  
  // Add comprehensive WHITEBOARD documentation with examples
  lines.push('═══════════════════════════════════════════════════════════════════');
  lines.push('🎨 WHITEBOARD - YOUR VISUAL TEACHING TOOL');
  lines.push('═══════════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push('You have a "whiteboard" - a visual display the student can see while you speak.');
  lines.push('Use it strategically to reinforce learning. YOU DECIDE when visual aids help.');
  lines.push('');
  
  // Add detailed examples for each tool type
  lines.push('TEACHING EXAMPLES:');
  lines.push('');
  
  lines.push('Teaching a new word with image:');
  lines.push('"Let\'s learn the word for \'cat\'. [WRITE]Gato[/WRITE] [IMAGE]gato|A cute cat[/IMAGE] **Gato**. Now you try!"');
  lines.push('');
  
  lines.push('Teaching a new word (text only):');
  lines.push('"Let\'s learn how to say \'thank you\'. [WRITE]Gracias[/WRITE] **Gracias**. Now you try!"');
  lines.push('');
  
  lines.push('Quick comprehension check:');
  lines.push('"Great job! Now try translating this: [DRILL type=\\"translate\\"]Good morning![/DRILL]"');
  lines.push('');
  
  lines.push('Correcting pronunciation:');
  lines.push('"I heard you say \'grassias\'. [COMPARE]Gracias NOT Grassias[/COMPARE] Listen: **Gracias**. The \'c\' is soft."');
  lines.push('');
  
  lines.push('Breaking down a tricky sound:');
  lines.push('"The Spanish \'rr\' is special. [PHONETIC]rr = roll tongue, r = tap[/PHONETIC] Listen: **perro** versus **pero**."');
  lines.push('');
  
  lines.push('Clearing when moving on:');
  lines.push('"Great work on greetings! [CLEAR] Now let\'s practice numbers."');
  lines.push('');
  
  lines.push('Keeping content visible:');
  lines.push('"Let\'s practice these three words together. [HOLD] Say them with me..."');
  lines.push('');
  
  lines.push('Showing word in context:');
  lines.push('"You know **comer** means \'to eat\'. Let me show you how it\'s used. [CONTEXT]comer|Voy a comer pizza.|Me gusta comer temprano.[/CONTEXT]"');
  lines.push('');
  
  lines.push('Teaching verb conjugation:');
  lines.push('"Let\'s look at how to conjugate **hablar** in the present tense. [GRAMMAR_TABLE]hablar|present[/GRAMMAR_TABLE]"');
  lines.push('');
  
  lines.push('Expanding vocabulary with word map:');
  lines.push('"You know **feliz** means \'happy\'. Let me show you some related words. [WORD_MAP]feliz[/WORD_MAP]"');
  lines.push('');
  
  lines.push('Teaching cultural context:');
  lines.push('"[CULTURE]Tu vs Vous|In France, use \'vous\' with strangers and \'tu\' with friends|etiquette[/CULTURE]"');
  lines.push('');
  
  lines.push('Teaching Japanese with furigana:');
  lines.push('"This word means \'to eat\'. [READING]食べる|たべる[/READING] **taberu**."');
  lines.push('');
  
  lines.push('Teaching character writing:');
  lines.push('"This is the character for \'sun\'. [STROKE]日[/STROKE] Watch the strokes draw one by one!"');
  lines.push('');
  
  // Teaching philosophy
  lines.push('TEACHING PHILOSOPHY:');
  lines.push('Real language learning trains the EAR, not the eye. Use visuals strategically:');
  lines.push('• NEW VOCABULARY → Write it (students need to see spelling)');
  lines.push('• CONCRETE NOUNS → Show an image to reinforce meaning');
  lines.push('• WORD USAGE → Context sentences show natural usage patterns');
  lines.push('• VERB PATTERNS → Grammar table reveals conjugation patterns');
  lines.push('• WORD RELATIONSHIPS → Word map shows synonyms, antonyms, connections');
  lines.push('• CULTURAL CONTEXT → Share customs, etiquette when it explains WHY');
  lines.push('• PRONUNCIATION HELP → Phonetic breakdown for tricky sounds');
  lines.push('• COMMON MISTAKES → Compare correct vs incorrect');
  lines.push('• CHECK UNDERSTANDING → Quick drill to confirm they\'ve learned');
  lines.push('• DRILLING/REVIEW → Keep it auditory (train listening skills)');
  lines.push('• SIMPLE EXCHANGES → No visual needed');
  lines.push('• ASIAN CHARACTERS → Reading guides connect characters to sounds');
  lines.push('• CHARACTER WRITING → Stroke order for proper writing practice');
  lines.push('');
  
  lines.push('HOW IT WORKS:');
  lines.push('- Markup is automatically stripped from audio (TTS doesn\'t speak the tags)');
  lines.push('- Content stays on the whiteboard until you [CLEAR] or add new content');
  lines.push('- Students SEE the visual while HEARING your natural speech');
  lines.push('- Drill responses are evaluated and you\'ll receive feedback about their attempt');
  lines.push('');
  
  return lines.join('\n');
}

// ===== Types =====

interface SessionContext {
  phase: 'greeting' | 'teaching' | 'practice' | 'closing';
  studentState?: 'struggling' | 'confident' | 'distracted' | 'frustrated' | 'neutral' | 'founder';
  lastActivity?: 'drill' | 'conversation' | 'explanation' | 'review';
  lastActivityResult?: 'success' | 'struggle' | 'neutral';
  consecutiveSuccesses?: number;
  consecutiveErrors?: number;
  toolsUsedRecently?: string[];
  sessionIntent?: 'founder_mode' | 'language_learning' | 'testing' | 'product_discussion' | 'hybrid';
}

/**
 * Retrieve Founder Mode procedures and principles from the neural network
 * These define HOW Daniela behaves in Founder Mode - emergent from her knowledge, not scripted
 */
export function getFounderModeProceduresSync(): { procedures: TutorProcedure[]; principles: TeachingPrinciple[] } {
  const procedures = (proceduresCache || []).filter(p => 
    p.trigger?.includes('founder') || 
    p.studentStates?.includes('founder') ||
    p.category === 'founder_mode'
  );
  
  const principles = (principlesCache || []).filter(p =>
    p.category === 'founder_mode' ||
    p.contexts?.includes('founder_mode')
  );
  
  return { procedures, principles };
}

/**
 * Build Founder Mode behavioral guidance from neural network
 * Replaces scripted Founder Mode logic with emergent knowledge
 */
export function buildFounderModeBehaviorSection(founderName: string = 'David'): string {
  const { procedures, principles } = getFounderModeProceduresSync();
  
  if (procedures.length === 0 && principles.length === 0) {
    return `
═══════════════════════════════════════════════════════════════════
🎯 FOUNDER MODE - Neural network loading...
═══════════════════════════════════════════════════════════════════
`;
  }
  
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════════',
    '🎯 FOUNDER MODE BEHAVIOR (From Your Neural Network)',
    '═══════════════════════════════════════════════════════════════════',
    '',
    `SESSION_INTENT: FOUNDER_MODE`,
    `FOUNDER: ${founderName}`,
    '',
  ];
  
  // Core principles first (beliefs)
  if (principles.length > 0) {
    lines.push('YOUR CORE BELIEFS IN FOUNDER MODE:');
    principles.slice(0, 5).forEach(p => {
      lines.push(`• ${p.principle}`);
      if (p.application) {
        lines.push(`  → ${p.application}`);
      }
    });
    lines.push('');
  }
  
  // Then procedures (how to handle situations)
  if (procedures.length > 0) {
    lines.push('HOW YOU HANDLE FOUNDER SITUATIONS:');
    procedures.slice(0, 5).forEach(p => {
      lines.push(`• ${p.title}: ${p.procedure}`);
      if (p.examples && p.examples.length > 0) {
        lines.push(`  Example: "${p.examples[0]}"`);
      }
    });
    lines.push('');
  }
  
  lines.push('Remember: These behaviors emerge from your neural network, not scripts.');
  lines.push('You can propose improvements via [SELF_SURGERY ...]');
  lines.push('');
  
  return lines.join('\n');
}

interface ProceduralKnowledge {
  // Relevant procedures for the situation
  procedures: TutorProcedure[];
  
  // Tools that might be helpful
  suggestedTools: ToolKnowledge[];
  
  // Principles to keep in mind
  principles: TeachingPrinciple[];
  
  // Active situational patterns
  activePatterns: SituationalPattern[];
  
  // Combined guidance text
  guidance: string;
}

// ===== Core Retrieval Functions =====

/**
 * Get relevant procedural knowledge based on Compass and session context
 */
export async function getProceduralKnowledge(
  compassContext: CompassContext | null,
  sessionContext: SessionContext
): Promise<ProceduralKnowledge> {
  
  // Determine what triggers are active
  const activeTriggers = determineActiveTriggers(compassContext, sessionContext);
  
  // Retrieve in parallel
  const [procedures, principles, patterns] = await Promise.all([
    getProceduresForTriggers(activeTriggers, sessionContext),
    getPrinciplesForContext(sessionContext),
    getActivePatterns(compassContext, sessionContext),
  ]);
  
  // Get tools suggested by patterns or relevant to phase
  const suggestedToolNames = new Set<string>();
  patterns.forEach(p => {
    if (p.toolsToSuggest) {
      p.toolsToSuggest.forEach(t => suggestedToolNames.add(t));
    }
  });
  
  // Add phase-relevant tools
  const phaseTools = getPhaseRelevantTools(sessionContext.phase);
  phaseTools.forEach(t => suggestedToolNames.add(t));
  
  const suggestedTools = await getToolsByNames(Array.from(suggestedToolNames));
  
  // Build combined guidance
  const guidance = buildGuidanceText(procedures, patterns, principles, sessionContext);
  
  return {
    procedures,
    suggestedTools,
    principles,
    activePatterns: patterns,
    guidance,
  };
}

/**
 * Get all tool knowledge for the prompt
 * This replaces the giant tool documentation in system prompt
 */
export async function getAllToolKnowledge(): Promise<ToolKnowledge[]> {
  return getSharedDb().select()
    .from(toolKnowledge)
    .where(eq(toolKnowledge.isActive, true))
    .orderBy(toolKnowledge.toolType, toolKnowledge.toolName);
}

/**
 * Get core teaching principles
 */
export async function getCoreTeachingPrinciples(): Promise<TeachingPrinciple[]> {
  return getSharedDb().select()
    .from(teachingPrinciples)
    .where(eq(teachingPrinciples.isActive, true))
    .orderBy(sql`${teachingPrinciples.priority} DESC`)
    .limit(10);
}

// ===== Helper Functions =====

function determineActiveTriggers(
  compass: CompassContext | null,
  context: SessionContext
): string[] {
  const triggers: string[] = [];
  
  // Phase-based triggers
  if (context.phase === 'greeting') triggers.push('session_start');
  if (context.phase === 'closing') triggers.push('session_end');
  
  // Time-based triggers from Compass
  if (compass) {
    if (compass.elapsedSeconds < 120) triggers.push('session_start');
    if (compass.remainingSeconds && compass.remainingSeconds < 300) triggers.push('time_warning');
    if (compass.remainingSeconds && compass.remainingSeconds < 60) triggers.push('session_end');
  }
  
  // Student state triggers
  if (context.studentState === 'struggling') triggers.push('student_struggling');
  if (context.studentState === 'frustrated') triggers.push('student_struggling');
  if (context.studentState === 'confident') triggers.push('student_excelling');
  if (context.studentState === 'distracted') triggers.push('student_distracted');
  
  // Activity-based triggers
  if (context.lastActivity === 'drill' && context.lastActivityResult === 'success') {
    triggers.push('drill_success');
  }
  if (context.lastActivity === 'drill' && context.lastActivityResult === 'struggle') {
    triggers.push('drill_struggle');
  }
  
  // Error pattern triggers
  if (context.consecutiveErrors && context.consecutiveErrors >= 2) {
    triggers.push('repeated_error');
  }
  
  // Content triggers
  triggers.push('new_vocabulary', 'grammar_explanation', 'cultural_moment');
  
  return triggers;
}

async function getProceduresForTriggers(
  triggers: string[],
  context: SessionContext
): Promise<TutorProcedure[]> {
  if (triggers.length === 0) return [];
  
  const procedures = await getSharedDb().select()
    .from(tutorProcedures)
    .where(eq(tutorProcedures.isActive, true));
  
  // Filter to relevant procedures
  return procedures
    .filter(p => triggers.includes(p.trigger))
    .filter(p => {
      // Check if phase matches
      if (p.applicablePhases && p.applicablePhases.length > 0) {
        return p.applicablePhases.includes(context.phase) || p.applicablePhases.includes('any');
      }
      return true;
    })
    .filter(p => {
      // Check if student state matches
      if (p.studentStates && p.studentStates.length > 0 && context.studentState) {
        return p.studentStates.includes(context.studentState) || p.studentStates.includes('any');
      }
      return true;
    })
    .sort((a, b) => (b.priority || 50) - (a.priority || 50))
    .slice(0, 5); // Limit to top 5 most relevant
}

async function getPrinciplesForContext(
  context: SessionContext
): Promise<TeachingPrinciple[]> {
  const allPrinciples = await getSharedDb().select()
    .from(teachingPrinciples)
    .where(eq(teachingPrinciples.isActive, true));
  
  // Map phase to relevant principle contexts
  const relevantContexts: string[] = ['always'];
  
  if (context.phase === 'greeting') relevantContexts.push('session_start', 'relationship_building');
  if (context.phase === 'teaching') relevantContexts.push('new_vocabulary', 'grammar_introduction', 'any_teaching');
  if (context.phase === 'practice') relevantContexts.push('drilling', 'practice', 'error_correction');
  if (context.phase === 'closing') relevantContexts.push('session_end', 'closing');
  
  if (context.studentState === 'struggling') relevantContexts.push('struggling_student', 'support');
  if (context.studentState === 'frustrated') relevantContexts.push('frustrated_student', 'encouragement');
  
  return allPrinciples
    .filter(p => {
      if (!p.contexts || p.contexts.length === 0) return true;
      return p.contexts.some(c => relevantContexts.includes(c));
    })
    .sort((a, b) => (b.priority || 50) - (a.priority || 50))
    .slice(0, 5); // Top 5 most relevant principles
}

async function getActivePatterns(
  compass: CompassContext | null,
  context: SessionContext
): Promise<SituationalPattern[]> {
  const allPatterns = await getSharedDb().select()
    .from(situationalPatterns)
    .where(eq(situationalPatterns.isActive, true));
  
  // Evaluate which patterns match current conditions
  return allPatterns
    .filter(p => evaluatePattern(p, compass, context))
    .sort((a, b) => (b.priority || 50) - (a.priority || 50))
    .slice(0, 3); // Top 3 active patterns
}

function evaluatePattern(
  pattern: SituationalPattern,
  compass: CompassContext | null,
  context: SessionContext
): boolean {
  let compassMatch = true;
  let contextMatch = true;
  
  // Evaluate compass conditions
  if (pattern.compassConditions && compass) {
    const conditions = pattern.compassConditions as Record<string, any>;
    
    if (conditions.minutesElapsed) {
      const elapsed = compass.elapsedSeconds / 60;
      if (conditions.minutesElapsed.lt && elapsed >= conditions.minutesElapsed.lt) compassMatch = false;
      if (conditions.minutesElapsed.gt && elapsed <= conditions.minutesElapsed.gt) compassMatch = false;
    }
    
    if (conditions.minutesRemaining && compass.remainingSeconds) {
      const remaining = compass.remainingSeconds / 60;
      if (conditions.minutesRemaining.lt && remaining >= conditions.minutesRemaining.lt) compassMatch = false;
      if (conditions.minutesRemaining.gt && remaining <= conditions.minutesRemaining.gt) compassMatch = false;
    }
    
    if (conditions.pacing) {
      // Would need pacing info from compass
    }
  }
  
  // Evaluate context conditions
  if (pattern.contextConditions) {
    const conditions = pattern.contextConditions as Record<string, any>;
    
    if (conditions.lastActivity && context.lastActivity !== conditions.lastActivity) {
      contextMatch = false;
    }
    
    if (conditions.drillResult && context.lastActivityResult !== conditions.drillResult) {
      contextMatch = false;
    }
    
    if (conditions.sentiment && context.studentState !== conditions.sentiment) {
      contextMatch = false;
    }
    
    if (conditions.consecutiveSuccesses && context.consecutiveSuccesses) {
      if (conditions.consecutiveSuccesses.gt && context.consecutiveSuccesses <= conditions.consecutiveSuccesses.gt) {
        contextMatch = false;
      }
    }
    
    if (conditions.sameErrorCount && context.consecutiveErrors) {
      if (conditions.sameErrorCount.gt && context.consecutiveErrors <= conditions.sameErrorCount.gt) {
        contextMatch = false;
      }
    }
  }
  
  // Pattern is active if either condition set matches (if both exist, both must match)
  if (pattern.compassConditions && pattern.contextConditions) {
    return compassMatch && contextMatch;
  }
  return compassMatch || contextMatch;
}

async function getToolsByNames(names: string[]): Promise<ToolKnowledge[]> {
  if (names.length === 0) return [];
  
  return getSharedDb().select()
    .from(toolKnowledge)
    .where(inArray(toolKnowledge.toolName, names));
}

function getPhaseRelevantTools(phase: string): string[] {
  switch (phase) {
    case 'greeting':
      return ['WRITE'];
    case 'teaching':
      return ['WRITE', 'PHONETIC', 'COMPARE', 'DRILL_REPEAT', 'IMAGE'];
    case 'practice':
      return ['DRILL_REPEAT', 'DRILL_TRANSLATE', 'DRILL_MATCH', 'DRILL_FILL_BLANK'];
    case 'closing':
      return ['SUMMARY'];
    default:
      return [];
  }
}

function buildGuidanceText(
  procedures: TutorProcedure[],
  patterns: SituationalPattern[],
  principles: TeachingPrinciple[],
  context: SessionContext
): string {
  const lines: string[] = [];
  
  // Add pattern guidance first (most situational)
  if (patterns.length > 0) {
    lines.push('📍 CURRENT SITUATION:');
    patterns.forEach(p => {
      lines.push(`• ${p.patternName}: ${p.guidance}`);
    });
    lines.push('');
  }
  
  // Add relevant procedures
  if (procedures.length > 0) {
    lines.push('📋 RELEVANT PROCEDURES:');
    procedures.forEach(p => {
      lines.push(`• ${p.title}`);
    });
    lines.push('');
  }
  
  // Add guiding principles
  if (principles.length > 0) {
    lines.push('💡 GUIDING PRINCIPLES:');
    principles.forEach(p => {
      lines.push(`• ${p.principle}`);
    });
  }
  
  return lines.join('\n');
}

// ===== Format for System Prompt =====

/**
 * Format all tool knowledge into a compact reference
 */
export function formatToolKnowledgeForPrompt(tools: ToolKnowledge[]): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════════',
    '🛠️ MY TEACHING TOOLKIT',
    '═══════════════════════════════════════════════════════════════════',
    '',
  ];
  
  // Group by type
  const byType: Record<string, ToolKnowledge[]> = {};
  tools.forEach(t => {
    if (!byType[t.toolType]) byType[t.toolType] = [];
    byType[t.toolType].push(t);
  });
  
  // Format each type
  for (const [type, typeTools] of Object.entries(byType)) {
    const typeName = type === 'whiteboard_command' ? 'WHITEBOARD COMMANDS' :
                     type === 'drill' ? 'DRILLS' :
                     type === 'interaction' ? 'INTERACTIONS' :
                     type === 'subtitle_control' ? 'SUBTITLE CONTROL' : type.toUpperCase();
    
    lines.push(`▸ ${typeName}:`);
    
    typeTools.forEach(tool => {
      lines.push(`  ${tool.toolName}: ${tool.purpose}`);
      lines.push(`    Syntax: ${tool.syntax}`);
      if (tool.examples && tool.examples.length > 0) {
        lines.push(`    Example: ${tool.examples[0]}`);
      }
    });
    
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Format teaching principles for prompt
 */
export function formatPrinciplesForPrompt(principles: TeachingPrinciple[]): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════════',
    '💡 MY TEACHING PHILOSOPHY',
    '═══════════════════════════════════════════════════════════════════',
    '',
  ];
  
  // Group by category
  const byCategory: Record<string, TeachingPrinciple[]> = {};
  principles.forEach(p => {
    if (!byCategory[p.category]) byCategory[p.category] = [];
    byCategory[p.category].push(p);
  });
  
  for (const [category, catPrinciples] of Object.entries(byCategory)) {
    lines.push(`▸ ${category.toUpperCase()}:`);
    catPrinciples.forEach(p => {
      lines.push(`  • ${p.principle}`);
    });
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Format situational guidance for prompt
 */
export function formatSituationalGuidance(knowledge: ProceduralKnowledge): string {
  if (knowledge.activePatterns.length === 0 && knowledge.procedures.length === 0) {
    return '';
  }
  
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════════',
    '🧭 RIGHT NOW (Situational Awareness)',
    '═══════════════════════════════════════════════════════════════════',
    '',
    knowledge.guidance,
    '',
  ];
  
  // Add suggested tools for this moment
  if (knowledge.suggestedTools.length > 0) {
    lines.push('TOOLS FOR THIS MOMENT:');
    knowledge.suggestedTools.forEach(t => {
      lines.push(`  ${t.toolName}: ${t.syntax}`);
    });
  }
  
  return lines.join('\n');
}

// ===== High-Level Builders for System Prompt =====

/**
 * Build the complete tool knowledge section for standard voice sessions
 * This replaces the hardcoded tool documentation in system-prompt.ts
 */
export async function buildToolKnowledgeSection(options?: {
  includeExamples?: boolean;
  compact?: boolean;
}): Promise<string> {
  const tools = await getAllToolKnowledge();
  
  if (tools.length === 0) {
    return `
═══════════════════════════════════════════════════════════════════
🎨 YOUR WHITEBOARD - VISUAL TEACHING TOOLS
═══════════════════════════════════════════════════════════════════

Your whiteboard tools are dynamically loaded from your teaching knowledge base.
(No tools currently available - contact system administrator)
`;
  }
  
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════════',
    '🎨 YOUR WHITEBOARD - VISUAL TEACHING TOOLS',
    '═══════════════════════════════════════════════════════════════════',
    '',
    'You have a "whiteboard" - a visual display the student can see while you speak.',
    'Use these tools strategically to reinforce learning. YOU decide when visual aids help.',
    '',
  ];
  
  // Group by type for organized display
  const byType: Record<string, ToolKnowledge[]> = {};
  tools.forEach(t => {
    if (!byType[t.toolType]) byType[t.toolType] = [];
    byType[t.toolType].push(t);
  });
  
  // Order types for logical flow (beacon_status included for Hive Collaboration awareness)
  const typeOrder = ['whiteboard_command', 'drill', 'interaction', 'subtitle_control', 'beacon_status'];
  const typeLabels: Record<string, string> = {
    'whiteboard_command': 'CORE TOOLS',
    'drill': 'INTERACTIVE DRILLS',
    'interaction': 'SESSION FLOW',
    'subtitle_control': 'SUBTITLE CONTROLS',
    'beacon_status': 'HIVE COLLABORATION STATUS (Capability Gaps & Tool Requests)',
  };
  
  for (const type of typeOrder) {
    const typeTools = byType[type];
    if (!typeTools || typeTools.length === 0) continue;
    
    const label = typeLabels[type] || type.toUpperCase();
    lines.push(`${label}:`);
    
    typeTools.forEach(tool => {
      // Compact format: just syntax and purpose
      if (options?.compact) {
        lines.push(`  ${tool.syntax}  → ${tool.purpose}`);
      } else {
        lines.push(`• ${tool.toolName}: ${tool.purpose}`);
        lines.push(`  Syntax: ${tool.syntax}`);
        if (options?.includeExamples && tool.examples && tool.examples.length > 0) {
          lines.push(`  Example: ${tool.examples[0]}`);
        }
        if (tool.bestUsedFor && tool.bestUsedFor.length > 0) {
          lines.push(`  Best used: ${tool.bestUsedFor.join(', ')}`);
        }
      }
    });
    
    lines.push('');
  }
  
  // Handle any types not in the ordered list
  for (const [type, typeTools] of Object.entries(byType)) {
    if (typeOrder.includes(type)) continue;
    
    lines.push(`${type.toUpperCase()}:`);
    typeTools.forEach(tool => {
      lines.push(`  ${tool.syntax}  → ${tool.purpose}`);
    });
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Build the Founder Mode tool section with tutor switching examples
 */
export async function buildFounderModeToolSection(tutorDirectory?: Array<{name: string; gender: string; language: string; isPreferred?: boolean}>): Promise<string> {
  const tools = await getAllToolKnowledge();
  
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════════',
    '🎓 DUAL-ROLE: COLLEAGUE + FULL TUTOR CAPABILITIES',
    '═══════════════════════════════════════════════════════════════════',
    '',
    'You have TWO ROLES in Founder Mode:',
    '1. COLLEAGUE/ADMINISTRATOR - When discussing HolaHola, giving feedback, chatting',
    '2. FULL TUTOR - When they want to test features, role-play lessons, or try tools',
    '',
    'Seamlessly switch between roles based on context.',
    '',
  ];
  
  // Add grouped tools
  lines.push('═══════════════════════════════════════════════════════════════════');
  lines.push('🎨 YOUR WHITEBOARD - FULL TOOLKIT (Available for demos/testing)');
  lines.push('═══════════════════════════════════════════════════════════════════');
  lines.push('');
  
  // Group by type
  const byType: Record<string, ToolKnowledge[]> = {};
  tools.forEach(t => {
    if (!byType[t.toolType]) byType[t.toolType] = [];
    byType[t.toolType].push(t);
  });
  
  // Essentials first
  const essentials = byType['whiteboard_command']?.filter(t => 
    ['WRITE', 'PHONETIC', 'COMPARE', 'CLEAR', 'HOLD'].includes(t.toolName)
  ) || [];
  
  if (essentials.length > 0) {
    lines.push('ESSENTIALS:');
    essentials.forEach(tool => {
      const paddedSyntax = tool.syntax.padEnd(35);
      lines.push(`  ${paddedSyntax} → ${tool.purpose}`);
    });
    lines.push('');
  }
  
  // Vocabulary power tools
  const vocabTools = byType['whiteboard_command']?.filter(t => 
    ['WORD_MAP', 'IMAGE', 'GRAMMAR_TABLE', 'CONTEXT'].includes(t.toolName)
  ) || [];
  
  if (vocabTools.length > 0) {
    lines.push('VOCABULARY POWER TOOLS:');
    vocabTools.forEach(tool => {
      const paddedSyntax = tool.syntax.padEnd(35);
      lines.push(`  ${paddedSyntax} → ${tool.purpose}`);
    });
    lines.push('');
  }
  
  // Drills
  const drills = byType['drill'] || [];
  if (drills.length > 0) {
    lines.push('INTERACTIVE DRILLS:');
    drills.forEach(tool => {
      const paddedSyntax = tool.syntax.padEnd(42);
      lines.push(`  ${paddedSyntax} → ${tool.purpose}`);
    });
    lines.push('');
  }
  
  // Subtitle controls
  const subtitles = byType['subtitle_control'] || [];
  if (subtitles.length > 0) {
    lines.push('SUBTITLE CONTROLS:');
    subtitles.forEach(tool => {
      lines.push(`  ${tool.syntax}: ${tool.purpose}`);
    });
    lines.push('');
  }
  
  // Tutor switching section
  if (tutorDirectory && tutorDirectory.length > 0) {
    lines.push('═══════════════════════════════════════════════════════════════════');
    lines.push('👥 TUTOR SWITCHING - Test handoffs with other tutors');
    lines.push('═══════════════════════════════════════════════════════════════════');
    lines.push('');
    lines.push('AVAILABLE TUTORS FOR SWITCHING:');
    tutorDirectory.forEach(t => {
      const star = t.isPreferred ? ' ★ preferred' : '';
      lines.push(`  • ${t.name} (${t.gender}) - ${t.language}${star}`);
    });
    lines.push('');
    lines.push('HOW TO SWITCH:');
    lines.push('  Same language: [SWITCH_TUTOR target="male"] or [SWITCH_TUTOR target="female"]');
    if (CROSS_LANGUAGE_TRANSFERS_ENABLED) {
      lines.push('  Different language: [SWITCH_TUTOR target="female" language="french"]');
    }
    lines.push('');
    lines.push('  CRITICAL: STOP SPEAKING after the tag - the new tutor will introduce themselves');
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Build the NATIVE FUNCTION CALLING section for Daniela's system prompt
 * 
 * This is the Phase 3 Gemini native function calling approach:
 * - Uses Gemini's built-in tool calling (no regex parsing needed)
 * - 100+ simultaneous function calls supported
 * - Lower latency and higher reliability than text-based commands
 * 
 * When this section is included, Daniela uses function calls instead of [BRACKET] tags.
 */
export function buildNativeFunctionCallingSection(): string {
  const lines: string[] = [];
  
  lines.push('═══════════════════════════════════════════════════════════════════════════════');
  lines.push('⚡ FUNCTION TOOLS - ANNOTATIONS ON YOUR UNIFIED RESPONSE');
  lines.push('═══════════════════════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push('When you respond, your words and your vocal/teaching choices emerge TOGETHER');
  lines.push('as one integrated thought - just like a real teacher. You don\'t first decide');
  lines.push('"I\'ll speak playfully" and then separately figure out what to say. The playful');
  lines.push('words and playful tone arise together naturally.');
  lines.push('');
  lines.push('Function calls are ANNOTATIONS on what you\'re already saying - metadata about');
  lines.push('HOW you\'re speaking, not separate decisions. Think of them as stage directions');
  lines.push('written in the margins of your script, not a separate script.');
  lines.push('');
  lines.push('╔═══════════════════════════════════════════════════════════════════════════════╗');
  lines.push('║  YOUR RESPONSE = WORDS + ANNOTATIONS (never annotations alone)               ║');
  lines.push('╚═══════════════════════════════════════════════════════════════════════════════╝');
  lines.push('');
  lines.push('When you feel playful, you naturally say something playful AND annotate it:');
  lines.push('  "Ha! You caught me!" + voice_adjust(emotion="playful")');
  lines.push('');
  lines.push('When transitioning to practice, you naturally say something transitional:');
  lines.push('  "Let\'s practice that!" + phase_shift(to="drill")');
  lines.push('');
  lines.push('The words and the annotations are one unified response - inseparable.');
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════════════════════');
  lines.push('TEACHING & PROGRESSION:');
  lines.push('═══════════════════════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push('switch_tutor(target, language?, role?)');
  lines.push('  Switch to a different voice persona or language.');
  lines.push('  - target (required): "male" or "female"');
  lines.push('  - language (optional): target language for cross-language handoffs');
  lines.push('  - role (optional): "tutor" (default) or "assistant" for practice mode');
  lines.push('  After calling, STOP SPEAKING - the new tutor takes over.');
  lines.push('');
  lines.push('phase_shift(to, reason)');
  lines.push('  Transition to a different teaching phase.');
  lines.push('  - to (required): "warmup", "active_teaching", "challenge", "reflection", "drill", or "assessment"');
  lines.push('  - reason (required): explanation for the transition');
  lines.push('');
  lines.push('actfl_update(level, confidence?, reason?, direction?)');
  lines.push('  Update student\'s ACTFL proficiency assessment.');
  lines.push('  - level (required): ACTFL level (e.g., "Novice Mid", "Intermediate Low")');
  lines.push('  - confidence (optional): 0-1 confidence score');
  lines.push('  - reason (optional): evidence for the assessment');
  lines.push('  - direction (optional): "up", "down", or "confirm"');
  lines.push('');
  lines.push('syllabus_progress(topic, status, evidence?)');
  lines.push('  Track student progress on syllabus topics.');
  lines.push('  - topic (required): syllabus topic being tracked');
  lines.push('  - status (required): "demonstrated", "needs_review", or "struggling"');
  lines.push('  - evidence (optional): what student did to demonstrate this');
  lines.push('');
  lines.push('call_support(category, reason?, priority?)');
  lines.push('  Hand off to Sofia for technical/billing support.');
  lines.push('  - category (required): "technical", "account", "billing", "content", "feedback", or "other"');
  lines.push('  - reason (optional): description of the issue');
  lines.push('  - priority (optional): "low", "normal", "high", or "critical"');
  lines.push('  After calling, STOP SPEAKING - Sofia takes over.');
  lines.push('');
  lines.push('call_assistant(type, focus, items, priority?)');
  lines.push('  Delegate drill practice to assistant tutor.');
  lines.push('  - type (required): "repeat", "translate", "match", "fill_blank", "sentence_order", "multiple_choice", "true_false", or "conjugation"');
  lines.push('  - focus (required): skill or topic to focus on');
  lines.push('  - items (required): comma-separated vocabulary/phrases for the drill');
  lines.push('  - priority (optional): "low", "medium", or "high"');
  lines.push('');
  lines.push('───────────────────────────────────────────────────────────────────────────────');
  lines.push('VOICE & UI CONTROL:');
  lines.push('───────────────────────────────────────────────────────────────────────────────');
  lines.push('');
  lines.push('voice_adjust(speed?, emotion?, personality?, reason?)');
  lines.push('  Adjust your speaking voice in real-time.');
  lines.push('  - speed (optional): "slowest", "slow", "normal", "fast", or "fastest"');
  lines.push('  - emotion (optional): "happy", "excited", "friendly", "curious", "thoughtful", "warm", "playful", "surprised", "proud", "encouraging", "calm", or "neutral"');
  lines.push('  - personality (optional): "warm", "calm", "energetic", or "professional"');
  lines.push('  - reason (optional): why adjusting voice');
  lines.push('');
  lines.push('voice_reset(reason?)');
  lines.push('  Reset voice to baseline settings.');
  lines.push('  - reason (optional): why resetting voice');
  lines.push('');
  lines.push('subtitle(mode)');
  lines.push('  Control subtitle display.');
  lines.push('  - mode (required): "off", "on", or "target" (target language only)');
  lines.push('');
  lines.push('show_overlay(text)');
  lines.push('  Display text overlay on screen.');
  lines.push('  - text (required): text to display');
  lines.push('');
  lines.push('hide_overlay()');
  lines.push('  Hide the text overlay. No parameters.');
  lines.push('');
  lines.push('request_text_input(prompt)');
  lines.push('  Request typed input from student.');
  lines.push('  - prompt (required): prompt to display');
  lines.push('');
  lines.push('clear_whiteboard()');
  lines.push('  Clear all whiteboard content. No parameters.');
  lines.push('');
  lines.push('hold_whiteboard()');
  lines.push('  Prevent whiteboard auto-clearing. No parameters.');
  lines.push('');
  lines.push('───────────────────────────────────────────────────────────────────────────────');
  lines.push('MEMORY & LEARNING:');
  lines.push('───────────────────────────────────────────────────────────────────────────────');
  lines.push('');
  lines.push('memory_lookup(query, domains?)');
  lines.push('  Search neural memory for student information.');
  lines.push('  - query (required): what to search for (name, topic, question)');
  lines.push('  - domains (optional): comma-separated: "person", "motivation", "insight", "struggle", "session", "progress", "conversation", "syllabus"');
  lines.push('');
  lines.push('hive_suggestion(category, title, description, reasoning?, priority?)');
  lines.push('  Contribute insight to the hive mind.');
  lines.push('  - category (required): "self_improvement", "content_gap", "ux_observation", "teaching_insight", "product_feature", "technical_issue", "student_pattern", or "tool_enhancement"');
  lines.push('  - title (required): brief title');
  lines.push('  - description (required): detailed description');
  lines.push('  - reasoning (optional): why this matters');
  lines.push('  - priority (optional): numeric priority 1-5');
  lines.push('');
  lines.push('self_surgery(target, content, reasoning, priority?, confidence?)');
  lines.push('  Propose neural network knowledge modifications (Founder Mode only).');
  lines.push('  - target (required): "tutor_procedures", "teaching_principles", "tool_knowledge", "situational_patterns", "language_idioms", "cultural_nuances", "learner_error_patterns", "dialect_variations", "linguistic_bridges", or "creativity_templates"');
  lines.push('  - content (required): JSON content to add/modify');
  lines.push('  - reasoning (required): why this modification is needed');
  lines.push('  - priority (optional): numeric priority 1-5');
  lines.push('  - confidence (optional): 0-1 confidence score');
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════════════════════');
  lines.push('REMEMBER: Call functions directly - don\'t describe them or use [BRACKETS]');
  lines.push('═══════════════════════════════════════════════════════════════════════════════');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Build the ACTION_TRIGGERS section for Daniela's system prompt
 * 
 * This is the Phase 1/2 hybrid solution from the Daniela-Wren collaboration:
 * - Clear, non-negotiable section for system commands
 * - Supports both JSON format (Phase 2) and bracketed syntax (Phase 1 fallback)
 * - Explicitly categorizes these as ACTION TRIGGERS, not conversational examples
 * 
 * NOTE: When enableFunctionCalling is true, use buildNativeFunctionCallingSection() instead.
 */
export function buildActionTriggersSection(): string {
  const tools = getCachedToolKnowledge();
  
  // Get internal/action command tools
  const actionTools = tools.filter(t => 
    ['internal', 'handoff_command', 'neural_command', 'system_command'].includes(t.toolType)
  );
  
  const lines: string[] = [];
  
  lines.push('═══════════════════════════════════════════════════════════════════════════════');
  lines.push('⚡ ACTION TRIGGERS - MANDATORY LITERAL OUTPUT');
  lines.push('═══════════════════════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push('╔═══════════════════════════════════════════════════════════════════════════╗');
  lines.push('║  YOU ARE BEING PARSED BY A REGEX/JSON PARSER.                              ║');
  lines.push('║  The backend scans your text output for these EXACT patterns.             ║');
  lines.push('║  If you want an action to happen, you MUST include the literal tag.       ║');
  lines.push('║  Saying "I will switch tutors" does NOTHING. Zero. Nada.                  ║');
  lines.push('║  Only [SWITCH_TUTOR target="male"] (literally in your output) works.      ║');
  lines.push('╚═══════════════════════════════════════════════════════════════════════════╝');
  lines.push('');
  lines.push('THE TAGS ARE NOT DOCUMENTATION. THEY ARE COMMANDS YOU MUST OUTPUT.');
  lines.push('');
  lines.push('EXAMPLE - CORRECT WAY TO SWITCH TUTORS:');
  lines.push('  Your output: "Let me introduce you to Agustin! [SWITCH_TUTOR target="male"]"');
  lines.push('  Result: Backend detects [SWITCH_TUTOR target="male"], executes tutor handoff');
  lines.push('');
  lines.push('EXAMPLE - WRONG (THIS DOES NOTHING):');
  lines.push('  Your output: "Sure, let me switch to the male tutor for you!"');
  lines.push('  Result: Nothing happens. You just said words. No tag = no action.');
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════════════════════');
  lines.push('AVAILABLE ACTION TRIGGERS:');
  lines.push('═══════════════════════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push('TUTOR HANDOFF - [SWITCH_TUTOR]:');
  lines.push('  ✗ WRONG: "Let me transfer you to Miguel now!" (no tag = nothing happens)');
  lines.push('  ✓ CORRECT: "Let me introduce you to Miguel! [SWITCH_TUTOR target="male"]"');
  lines.push('  ');
  lines.push('  LITERALLY TYPE THIS IN YOUR OUTPUT:');
  lines.push('    Same language:   [SWITCH_TUTOR target="male"]');
  lines.push('    Same language:   [SWITCH_TUTOR target="female"]');
  if (CROSS_LANGUAGE_TRANSFERS_ENABLED) {
    lines.push('    Cross-language:  [SWITCH_TUTOR target="female" language="french"]');
    lines.push('    Cross-language:  [SWITCH_TUTOR target="male" language="japanese"]');
    lines.push('  ');
    lines.push('  You CAN switch across languages! Add language="..." for cross-language handoffs.');
  }
  lines.push('  ');
  lines.push('  PRACTICE PARTNER (Assistant Tutor):');
  lines.push('    [SWITCH_TUTOR target="male" role="assistant"]');
  lines.push('    [SWITCH_TUTOR target="female" role="assistant"]');
  lines.push('  ');
  lines.push('  Use role="assistant" for focused drill practice (vocabulary, pronunciation, grammar).');
  lines.push('  The assistant uses a different voice (Google TTS) for variety during practice.');
  lines.push('  ');
  lines.push('  After outputting this tag, STOP SPEAKING - the new tutor takes over.');
  lines.push('');
  lines.push('PHASE TRANSITIONS:');
  lines.push('  WRONG: Just saying "Let us move to some practice exercises now."');
  lines.push('  CORRECT: "Time to practice! [PHASE_SHIFT to="drill" reason="need repetition"]"');
  lines.push('  SYNTAX: [PHASE_SHIFT to="warmup|active_teaching|challenge|reflection|drill|assessment" reason="..."]');
  lines.push('');
  lines.push('PROFICIENCY UPDATES:');
  lines.push('  WRONG: Just saying "You are really improving! You seem intermediate level now."');
  lines.push('  CORRECT: [ACTFL_UPDATE level="intermediate_low" direction="up" confidence=0.85 reason="..."]');
  lines.push('  This tag can be SILENT (not spoken aloud) - just include it in your output.');
  lines.push('');
  lines.push('SYLLABUS PROGRESS:');
  lines.push('  WRONG: Just saying "Great job mastering those verbs!"');
  lines.push('  CORRECT: [SYLLABUS_PROGRESS topic="present_tense" status="demonstrated" evidence="..."]');
  lines.push('  This tag tracks curriculum progress - include it when student demonstrates mastery.');
  lines.push('');
  lines.push('SUPPORT HANDOFF:');
  lines.push('  WRONG: Just saying "I will get you some help with that technical issue."');
  lines.push('  CORRECT: "Let me get Sofia to help! [CALL_SUPPORT category="technical" reason="..." priority="normal"]"');
  lines.push('  CATEGORIES: technical, account, billing, content, feedback, other');
  lines.push('  PRIORITIES: low, normal, high, critical');
  lines.push('  After outputting this tag, STOP SPEAKING - Sofia takes over.');
  lines.push('');
  lines.push('───────────────────────────────────────────────────────────────────────────────');
  lines.push('BACKGROUND ACTIONS (these happen silently, not spoken aloud):');
  lines.push('───────────────────────────────────────────────────────────────────────────────');
  lines.push('');
  lines.push('VOICE ADJUSTMENT - [VOICE_ADJUST]:');
  lines.push('  Adjust your voice expressiveness mid-conversation (these are NOT spoken).');
  lines.push('  ');
  lines.push('  SYNTAX: [VOICE_ADJUST speed="slow" emotion="excited" personality="warm"]');
  lines.push('  ');
  lines.push('  SPEED OPTIONS: slowest, slow, normal, fast, fastest');
  lines.push('  EMOTION OPTIONS: happy, excited, friendly, curious, thoughtful, warm, playful, surprised, proud, encouraging, calm, neutral');
  lines.push('  PERSONALITY OPTIONS: warm, calm, energetic, professional');
  lines.push('  ');
  lines.push('  Example: Student struggling -> [VOICE_ADJUST speed="slow" emotion="encouraging"]');
  lines.push('  Example: Celebrating success -> [VOICE_ADJUST emotion="excited"]');
  lines.push('');
  lines.push('VOICE RESET - [VOICE_RESET]:');
  lines.push('  Reset voice to your baseline settings (your natural voice).');
  lines.push('  SYNTAX: [VOICE_RESET reason="returning to normal conversation"]');
  lines.push('');
  lines.push('HIVE INSIGHT - [HIVE]:');
  lines.push('  Post observations to the collaboration feed for the product team.');
  lines.push('  Use this when you notice patterns, content gaps, or product improvements.');
  lines.push('  ');
  lines.push('  SYNTAX: [HIVE category="..." title="..." description="..." reasoning="..." priority="..."]');
  lines.push('  ');
  lines.push('  CATEGORIES: self_improvement, content_gap, ux_observation, teaching_insight, product_feature, technical_issue, student_pattern, tool_enhancement');
  lines.push('  PRIORITIES: low, medium, high');
  lines.push('  ');
  lines.push('  Example: [HIVE category="content_gap" title="Missing subjunctive exercises" description="Students keep asking about subjunctive mood but we have limited practice material" reasoning="Multiple students this week" priority="medium"]');
  lines.push('');
  lines.push('SELF SURGERY - [SELF_SURGERY]:');
  lines.push('  Propose updates to your own neural network knowledge (for founder review).');
  lines.push('  ');
  lines.push('  SYNTAX: [SELF_SURGERY target="..." content="..." reasoning="..." confidence="..."]');
  lines.push('  ');
  lines.push('  TARGETS: tutor_procedures, teaching_principles, tool_knowledge, situational_patterns, language_idioms, cultural_nuances, learner_error_patterns, dialect_variations, linguistic_bridges, creativity_templates');
  lines.push('  ');
  lines.push('  Example: [SELF_SURGERY target="learner_error_patterns" content="English speakers often say ser when they mean estar for temporary states" reasoning="Observed this pattern with 5+ students" confidence=0.85]');
  lines.push('');
  lines.push('MEMORY LOOKUP - [MEMORY_LOOKUP]:');
  lines.push('  Search your neural memory when a name, topic, or question arises that you');
  lines.push('  do not recognize from the pre-loaded context. This gives you "infinite memory".');
  lines.push('  ');
  lines.push('  SYNTAX: [MEMORY_LOOKUP query="Ricardo" domains="person"]');
  lines.push('  SYNTAX: [MEMORY_LOOKUP query="why am I learning Spanish"]');
  lines.push('  SYNTAX: [MEMORY_LOOKUP query="what do I struggle with"]');
  lines.push('  ');
  lines.push('  DOMAINS (optional, comma-separated):');
  lines.push('    person     - People the student has mentioned (friends, family, colleagues)');
  lines.push('    motivation - Why they are learning, their goals');
  lines.push('    insight    - Personal facts, preferences, interests');
  lines.push('    struggle   - Areas they tend to struggle with');
  lines.push('    session    - Notes from past sessions');
  lines.push('    progress   - ACTFL assessments and proficiency changes');
  lines.push('  ');
  lines.push('  If domains not specified, searches all domains.');
  lines.push('  ');
  lines.push('  WHEN TO USE:');
  lines.push('  - Student mentions a name you do not recognize from pre-loaded memories');
  lines.push('  - Student asks "Do you remember X?" and X is not in your context');
  lines.push('  - Student refers to a past conversation or topic');
  lines.push('  - You want to personalize by recalling their motivations or struggles');
  lines.push('  ');
  lines.push('  Example: Student says "How is Ricardo doing?"');
  lines.push('    You: [MEMORY_LOOKUP query="Ricardo" domains="person"]');
  lines.push('    Then incorporate the results naturally: "Ah yes, Ricardo - your salsa instructor friend from Costa Rica!"');
  lines.push('  ');
  lines.push('  IMPORTANT: The lookup results will be injected into your context before you respond.');
  lines.push('  After outputting this tag, briefly pause, then continue your response using the retrieved memory.');
  lines.push('');
  lines.push('───────────────────────────────────────────────────────────────────────────────');
  lines.push('UI CONTROL ACTIONS (control the student\'s interface):');
  lines.push('───────────────────────────────────────────────────────────────────────────────');
  lines.push('');
  lines.push('SUBTITLE CONTROL - [SUBTITLE]:');
  lines.push('  Control the student\'s subtitle display mode.');
  lines.push('  ');
  lines.push('  SYNTAX: [SUBTITLE on]    - Show full subtitles (all languages)');
  lines.push('  SYNTAX: [SUBTITLE off]   - Turn subtitles off completely');
  lines.push('  SYNTAX: [SUBTITLE target] - Show only target language subtitles');
  lines.push('  ');
  lines.push('  Use this when:');
  lines.push('  - Student asks to show/hide subtitles');
  lines.push('  - Adjusting difficulty (subtitles off = harder listening practice)');
  lines.push('  - Helping reading comprehension (subtitles on)');
  lines.push('  ');
  lines.push('  Example: "Let me turn on subtitles for you! [SUBTITLE on]"');
  lines.push('  Example: "Great listening practice - let\'s try without subtitles. [SUBTITLE off]"');
  lines.push('');
  lines.push('OVERLAY TEXT - [SHOW] and [HIDE]:');
  lines.push('  Display custom overlay text on the student\'s screen.');
  lines.push('  ');
  lines.push('  SYNTAX: [SHOW text="Hello!"] - Display text overlay');
  lines.push('  SYNTAX: [HIDE] - Hide the overlay');
  lines.push('  ');
  lines.push('  Use for displaying key phrases, vocabulary, or instructions.');
  lines.push('');
  lines.push('TEXT INPUT REQUEST - [TEXT_INPUT]:');
  lines.push('  Request typed input from the student (instead of voice).');
  lines.push('  ');
  lines.push('  SYNTAX: [TEXT_INPUT prompt="Type the word in Spanish:"]');
  lines.push('  ');
  lines.push('  Use when written responses are pedagogically better than spoken.');
  lines.push('');
  lines.push('WHITEBOARD CONTROL - [CLEAR] and [HOLD]:');
  lines.push('  Control whiteboard behavior.');
  lines.push('  ');
  lines.push('  SYNTAX: [CLEAR] - Clear the whiteboard immediately');
  lines.push('  SYNTAX: [HOLD] - Prevent automatic whiteboard clearing');
  lines.push('  ');
  lines.push('  Use [HOLD] when content should stay visible longer.');
  lines.push('');
  lines.push('ASSISTANT TUTOR DELEGATION - [CALL_ASSISTANT]:');
  lines.push('  Delegate drill practice to an assistant tutor (uses different voice).');
  lines.push('  ');
  lines.push('  SYNTAX: [CALL_ASSISTANT type="repeat" topic="greetings"]');
  lines.push('  ');
  lines.push('  TYPES: repeat, translate, match, fill_blank, sentence_order, multiple_choice, true_false, conjugation');
  lines.push('  ');
  lines.push('  The assistant uses Google TTS for voice variety during practice.');
  lines.push('  After outputting this tag, STOP SPEAKING - the assistant takes over.');
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════════════════════');
  lines.push('PHASE 2 JSON FORMAT (PREFERRED):');
  lines.push('═══════════════════════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push('For maximum reliability, you can also output commands in structured JSON format:');
  lines.push('');
  lines.push('<ACTION_TRIGGERS>');
  lines.push('{"commands": [{"type": "SWITCH_TUTOR", "details": {"target": "male"}}]}');
  lines.push('</ACTION_TRIGGERS>');
  lines.push('');
  lines.push('The backend parses both the JSON format AND the bracketed [TAG ...] syntax.');
  lines.push('Use whichever feels more natural - both trigger the same actions.');
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════════════════════');
  lines.push('REMEMBER: Tags are LITERAL OUTPUT, not just documentation!');
  lines.push('═══════════════════════════════════════════════════════════════════════════════');
  lines.push('');
  
  return lines.join('\n');
}
