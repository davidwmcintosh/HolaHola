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
  messages,
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
  // Mastery tracking
  userReviewItems,
  userDrillProgress,
} from '@shared/schema';
import { eq, inArray, sql, and, gte, lte, desc, isNull, isNotNull, count } from 'drizzle-orm';

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
    minutesAgo: number; // precise elapsed time — use for sub-day granularity
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
  episodicHistory?: { // superseded facts — things that *were* true, for warm callbacks
    fact: string;
    factType: string;
    closedDaysAgo: number; // when the fact was superseded
  }[];
  conversationHighlights?: { // memorable moments from recent conversations
    quote: string;
    context: string;
    daysAgo: number;
  }[];
  masteryStats?: { // spaced-repetition mastery counts — feeds Daniela's verbal recognition
    totalMasteredVocab: number;
    totalMasteredDrills: number;
    totalMastered: number;
    recentlyMastered: string[]; // targetText of items mastered in last 7 days (max 3)
    nextMilestone: number | null;
  };
  sessionMasteryJustNow?: string[]; // words mastered during THIS session (needs warm acknowledgment in next reply)
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
  const hasData = snapshot.sessionMasteryJustNow?.length || snapshot.lastSession || snapshot.syllabusPosition || 
                  snapshot.streak || snapshot.recentWins?.length || 
                  snapshot.needsPractice?.length || snapshot.personalFollowUps?.length ||
                  snapshot.conversationHighlights?.length ||
                  (snapshot.masteryStats?.totalMastered ?? 0) > 0;
  
  if (!hasData) return '';
  
  const lines: string[] = [];
  
  // XML container — Gemini 3.5 review (June 19 2026): XML closing tags prevent semantic
  // bleeding between INDEX and VERBATIM sibling blocks. Bracket-only markers leave the
  // model without a clear signal of where the INDEX constraint ends.
  lines.push('');
  lines.push(`<index_only> Student snapshot — ${studentName}:`);
  lines.push('');

  // ⭐ In-session mastery — highest priority, top of snapshot
  if (snapshot.sessionMasteryJustNow && snapshot.sessionMasteryJustNow.length > 0) {
    // No "act on this NOW" command, no "Weave into your reply" developer directive — state the fact, trust Daniela. (Gemini consult rec.)
    lines.push(`Something just happened: ${snapshot.sessionMasteryJustNow.map(w => `"${w}"`).join(', ')} clicked for them this session — earned, not given.`);
    lines.push('');
  }
  
  // Last session — use minutesAgo for precise elapsed-time text
  if (snapshot.lastSession) {
    const m = snapshot.lastSession.minutesAgo ?? (snapshot.lastSession.daysAgo * 24 * 60);
    const daysText =
      m < 2    ? 'just moments ago' :
      m < 10   ? 'a few minutes ago' :
      m < 60   ? `${m} minutes ago` :
      m < 120  ? 'about an hour ago' :
      m < 1440 ? `${Math.round(m / 60)} hours ago` :
      m < 2880 ? 'yesterday' :
      `${Math.floor(m / 1440)} days ago`;
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
  
  // Episodic history — facts that used to be true (for warm past-tense callbacks)
  if (snapshot.episodicHistory && snapshot.episodicHistory.length > 0) {
    lines.push('');
    lines.push('HISTORICAL CONTEXT (things that were true recently — reference in past tense):');
    lines.push('(e.g. "You mentioned you were preparing for X — how did that go?")');
    for (const item of snapshot.episodicHistory.slice(0, 3)) {
      const daysText = item.closedDaysAgo <= 7 ? 'last week' :
                       item.closedDaysAgo <= 30 ? 'last month' :
                       `~${Math.round(item.closedDaysAgo / 30)} months ago`;
      lines.push(`  • [WAS TRUE ${daysText.toUpperCase()}] ${item.fact}`);
    }
  }

  // Close the index_only block before opening verbatim — sibling blocks, not nested.
  // Gemini 3.5 review: nesting VERBATIM inside INDEX_ONLY caused semantic bleeding.
  lines.push('</index_only>');

  // Verbatim quotes — actual words from real sessions, sibling to the index block above.
  if (snapshot.conversationHighlights && snapshot.conversationHighlights.length > 0) {
    lines.push('');
    lines.push('<verbatim> Things they actually said recently:');
    for (const highlight of snapshot.conversationHighlights.slice(0, 4)) {
      const daysText = highlight.daysAgo === 0 ? 'today' :
                       highlight.daysAgo === 1 ? 'yesterday' :
                       highlight.daysAgo <= 7 ? 'this week' :
                       `${highlight.daysAgo} days ago`;
      lines.push(`  • "${highlight.quote}" — ${highlight.context} (${daysText})`);
    }
    lines.push('</verbatim>');
  }

  // Mastery stats — factual data, not a transcript. Wrapped in index_only so Daniela
  // speaks as "You've nearly mastered this" (Awareness), not "I remember you getting
  // almost every one right last time" (false Experience). Gemini review rec.
  if (snapshot.masteryStats && snapshot.masteryStats.totalMastered > 0) {
    const { totalMastered, recentlyMastered, nextMilestone } = snapshot.masteryStats;
    lines.push('');
    lines.push('<index_only> Mastery progress:');
    lines.push(`- ${totalMastered} word${totalMastered === 1 ? '' : 's'}/phrase${totalMastered === 1 ? '' : 's'} mastered through spaced repetition`);
    if (recentlyMastered.length > 0) {
      lines.push(`- Recently mastered (this week): ${recentlyMastered.map(w => `"${w}"`).join(', ')}`);
    }
    if (nextMilestone) {
      lines.push(`- Approaching ${nextMilestone}-word milestone (${nextMilestone - totalMastered} to go)`);
    }
    lines.push('- Acknowledge mastery briefly and warmly when the moment feels right. Be specific when you can — naming a recently mastered word or phrase feels most genuine.');
    lines.push('</index_only>');
  }
  
  // No closing ═══ divider. (Gemini consult rec.)
  lines.push('');
  
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
      // Use lastMessageAt (most recent activity) — falls back to startedAt if null
      lastActiveAt: sql<Date>`COALESCE(${conversations.lastMessageAt}, ${conversations.createdAt}, ${voiceSessions.startedAt})`,
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
      // Use lastActiveAt (most recent message time) for accurate elapsed-time reporting
      const referenceTime = lastSession.lastActiveAt ?? lastSession.startedAt;
      const minutesAgo = Math.round((Date.now() - new Date(referenceTime).getTime()) / (1000 * 60));
      const daysAgo = Math.floor(minutesAgo / (60 * 24));
      snapshot.lastSession = {
        topic: lastSession.topic || lastSession.title || 'Practice session',
        daysAgo,
        minutesAgo,
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
          isNull(learnerPersonalFacts.validTo)
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
        // Confidence gate: skip faded facts (< 0.3) — decay worker handles these over time
        const followUpTypes = ['life_event', 'goal', 'travel', 'work', 'family', 'hobby'];
        const confidence = pf.confidenceScore ?? 0.8;
        if (followUpTypes.includes(pf.factType) && daysAgo <= 14 && confidence >= 0.3) {
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

    // 3b. Episodic history — recently superseded facts (closed validity window)
    // These are things that *were* true but got updated (e.g., old location, completed goals).
    // Daniela can reference them in past tense for warm, continuous conversation.
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const historicalFacts = await getSharedDb().select({
      fact: learnerPersonalFacts.fact,
      factType: learnerPersonalFacts.factType,
      validTo: learnerPersonalFacts.validTo,
    })
      .from(learnerPersonalFacts)
      .where(
        and(
          eq(learnerPersonalFacts.studentId, studentId),
          isNotNull(learnerPersonalFacts.validTo),
          gte(learnerPersonalFacts.validTo, ninetyDaysAgo)
        )
      )
      .orderBy(desc(learnerPersonalFacts.validTo))
      .limit(5);

    if (historicalFacts.length > 0) {
      const now = new Date();
      snapshot.episodicHistory = historicalFacts.map(f => ({
        fact: f.fact,
        factType: f.factType,
        closedDaysAgo: Math.floor(
          (now.getTime() - new Date(f.validTo!).getTime()) / (1000 * 60 * 60 * 24)
        ),
      }));
    }
    
    // 4. Get conversation highlights - memorable quotes from recent sessions
    // These are user messages that contain specific personal details worth remembering
    const recentHighlights = await getSharedDb()
      .select({
        content: messages.content,
        createdAt: messages.createdAt,
        topic: conversations.topic,
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(
        and(
          eq(conversations.userId, studentId),
          eq(messages.role, 'user'),
          targetLanguage ? eq(conversations.language, targetLanguage) : sql`true`,
          // Only messages from last 14 days
          gte(messages.createdAt, sql`NOW() - INTERVAL '14 days'`)
        )
      )
      .orderBy(desc(messages.createdAt))
      .limit(50); // Get more to filter for meaningful ones
    
    if (recentHighlights.length > 0) {
      const now = new Date();
      const meaningfulHighlights: { quote: string; context: string; daysAgo: number }[] = [];
      
      // Keywords that indicate memorable personal content
      const memorableKeywords = [
        // Names and specifics
        'called', 'named', 'name is', 'my daughter', 'my son', 'my wife', 'my husband',
        'my friend', 'my mom', 'my dad', 'my sister', 'my brother',
        // Music/media
        'song', 'band', 'music', 'playing', 'listening', 'movie', 'book', 'show',
        // Events
        'trip', 'vacation', 'wedding', 'birthday', 'anniversary', 'graduated',
        // Specifics
        'favorite', 'love the', 'really like', 'always', 'remember when',
        // Places
        'restaurant', 'place called', 'went to', 'visited',
      ];
      
      for (const msg of recentHighlights) {
        if (!msg.content) continue;
        const lowerContent = msg.content.toLowerCase();
        
        // Check if message contains memorable keywords
        const hasMemorable = memorableKeywords.some(kw => lowerContent.includes(kw));
        if (!hasMemorable) continue;
        
        // Skip very short or very long messages
        if (msg.content.length < 20 || msg.content.length > 300) continue;
        
        const daysAgo = Math.floor((now.getTime() - new Date(msg.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        
        // Truncate quote if needed
        const quote = msg.content.length > 120 ? msg.content.slice(0, 117) + '...' : msg.content;
        
        meaningfulHighlights.push({
          quote,
          context: msg.topic || 'conversation',
          daysAgo,
        });
        
        // Stop at 4 highlights
        if (meaningfulHighlights.length >= 4) break;
      }
      
      if (meaningfulHighlights.length > 0) {
        snapshot.conversationHighlights = meaningfulHighlights;
      }
    }
    
    // 5. Mastery stats — feeds Daniela's verbal acknowledgment of student progress
    const MASTERY_MILESTONES = [10, 25, 50, 100, 250, 500];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    try {
      const masteredVocabRows = await getSharedDb()
        .select({ targetText: userReviewItems.targetText, createdAt: userReviewItems.createdAt })
        .from(userReviewItems)
        .where(
          and(
            eq(userReviewItems.userId, studentId),
            eq(userReviewItems.mastered, true),
            targetLanguage ? eq(userReviewItems.language, targetLanguage) : sql`true`
          )
        )
        .orderBy(desc(userReviewItems.createdAt));

      const [drillResult] = await getSharedDb()
        .select({ count: sql<number>`count(*)::int` })
        .from(userDrillProgress)
        .where(and(eq(userDrillProgress.userId, studentId), eq(userDrillProgress.mastered, true)));

      const totalMasteredVocab = masteredVocabRows.length;
      const totalMasteredDrills = Number(drillResult?.count ?? 0);
      const totalMastered = totalMasteredVocab + totalMasteredDrills;

      if (totalMastered > 0) {
        const recentlyMastered = masteredVocabRows
          .filter(r => new Date(r.createdAt) >= sevenDaysAgo)
          .slice(0, 3)
          .map(r => r.targetText);

        const nextMilestone = MASTERY_MILESTONES.find(m => m > totalMastered) ?? null;

        snapshot.masteryStats = { totalMasteredVocab, totalMasteredDrills, totalMastered, recentlyMastered, nextMilestone };
      }
    } catch {
      // Non-fatal — mastery stats are bonus context
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
  
  // No ═══ dividers, no all-caps "SENSORY AWARENESS" label. (Gemini consult rec.)
  lines.push('');
  lines.push('What I perceive right now:');
  
  // Student's local date and time - MOST PROMINENT
  // This is the authoritative source Daniela must use for all time references
  if (studentTimezone) {
    try {
      const now = new Date();
      const fullDate = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: studentTimezone
      });
      const timeStr = now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: studentTimezone
      });
      lines.push(`TODAY IS: ${fullDate}`);
      lines.push(`RIGHT NOW: ${timeStr} (${studentTimezone})`);
    } catch {
      lines.push(`TODAY IS: ${compassContext.currentTimeFormatted}`);
    }
  } else {
    lines.push(`TODAY IS: ${compassContext.currentTimeFormatted}`);
  }
  lines.push('USE THIS DATE when calculating how long since last session or any past event.');
  
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
  if (compassContext.studentActflLevel) {
    const levelDisplay = compassContext.studentActflLevel
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    const verified = compassContext.studentActflAssessed ? '✓ AI-verified' : '⚡ initial estimate';
    const source = compassContext.studentActflSource 
      ? ` (from ${compassContext.studentActflSource.replace(/_/g, ' ')})`
      : '';
    
    // No "STUDENT PROFICIENCY:" all-caps label; no closing ═══ divider. (Gemini consult rec.)
  lines.push(`Proficiency: ${levelDisplay} [${verified}${source}]`);
  }
  
  lines.push('');
  
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
  
  // XML container — clean close boundary prevents bleed into surrounding prose blocks.
  lines.push('');
  lines.push(`<index_only> What I know about ${studentName}:`);
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

  // Close the index_only container — explicit boundary so prose sections following
  // this block are not governed by the INDEX_ONLY constraint.
  lines.push('</index_only>');
  
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
  
  // No ═══ dividers, no all-caps "SELF-AWARENESS" label. (Gemini consult rec.)
  lines.push('');
  lines.push('Things I\'ve learned about myself:');
  lines.push('');
  lines.push('Discovered through teaching — about how I communicate and teach effectively. Already part of who I am:');
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

// ===== UNIFIED BRAIN LOADER =====

/**
 * Build Daniela's complete brain - unified across ALL modes
 * 
 * ARCHITECTURE PRINCIPLE: "One Brain, Always"
 * - Her knowledge and capabilities are CONSTANT across modes
 * - Only the CONTEXT varies (who she's talking to, curriculum, mode-specific notes)
 * - This eliminates the fragmentation where different modes loaded different subsets
 * 
 * WHAT THIS INCLUDES:
 * 1. Self-awareness (things she's learned about herself)
 * 2. Language expansion (idioms, cultural nuances, error patterns for target language)
 * 3. Advanced intelligence (subtlety cues, emotional patterns, creativity)
 * 4. Tool knowledge (ALL tools she can use - internal, whiteboard, drills)
 * 5. Teaching principles (her core beliefs - optional, can be heavy)
 * 
 * WHAT THIS DOES NOT INCLUDE (context varies by mode):
 * - Student memory, snapshot, predictions (session-specific)
 * - Sensory awareness / time (session-specific)
 * - Curriculum / ACTFL context (student-specific)
 * - Editor context, surgery context (founder-specific)
 * - Command syntax (action triggers vs function calling - depends on session config)
 * 
 * @param targetLanguage - Filter language expansion to relevant language
 * @param options.includePrinciples - Include teaching principles (default false - can be heavy)
 * @param options.compact - Use compact format for tools (default true)
 */
export interface UnifiedBrainOptions {
  includePrinciples?: boolean;
  compact?: boolean;
}

export function buildUnifiedBrainSync(
  targetLanguage: string = 'spanish',
  options: UnifiedBrainOptions = {}
): string {
  const { includePrinciples = true, compact = true } = options;
  
  const sections: string[] = [];
  
  // 1. Self-awareness (things she's learned about herself)
  const selfAwareness = buildSelfBestPracticesSection();
  if (selfAwareness) sections.push(selfAwareness);
  
  // 2. Language expansion (idioms, nuances, errors for target language)
  const languageExpansion = buildLanguageExpansionSection(targetLanguage, 'english');
  if (languageExpansion) sections.push(languageExpansion);
  
  // 3. Advanced intelligence (subtlety, emotion, creativity)
  const advancedIntelligence = buildAdvancedIntelligenceSection();
  if (advancedIntelligence) sections.push(advancedIntelligence);
  
  // 4. ALL tool knowledge (unified - no longer fragmented by mode)
  const toolKnowledge = buildUnifiedToolKnowledgeSync(compact);
  if (toolKnowledge) sections.push(toolKnowledge);
  
  // 5. Teaching principles - always included (her core beliefs make her a better teacher for everyone)
  // Architecture: Identity wholeness - all students experience the "whole Daniela"
  if (includePrinciples) {
    const principles = buildTeachingPrinciplesSection();
    if (principles) sections.push(principles);
  }

  // 6. Awareness procedures — behavioral guidance for auto-surfaced context
  // Scoped to exactly the three triggers that fire automatically each session:
  // proactive memory surfaces, temporal facts, and coverage audit gaps.
  // Other awareness procedures (ACTFL advancement, syllabus signals, etc.) are
  // situational and belong in Founder Mode full neural network only.
  const ALWAYS_ON_AWARENESS_TRIGGERS = ['memory_surfaced', 'temporal_fact_upcoming', 'coverage_gap_detected'];
  const awarenessProcs = (proceduresCache || []).filter(
    p => ALWAYS_ON_AWARENESS_TRIGGERS.includes(p.trigger || '') && p.isActive
  ).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  // No ─── dividers, no "AWARENESS GUIDANCE" all-caps header, no toUpperCase() on titles. (Gemini consult rec.)
  if (awarenessProcs.length > 0) {
    const lines: string[] = [
      '',
      'Things I notice automatically:',
      '',
    ];
    awarenessProcs.forEach(p => {
      lines.push(`${p.title}`);
      lines.push(p.procedure);
      lines.push('');
    });
    sections.push(lines.join('\n'));
  }
  
  return sections.join('\n');
}

/**
 * Build unified tool knowledge section - ALL tools Daniela can use
 * Replaces the fragmented approach where different modes loaded different subsets
 * 
 * Groups tools by purpose:
 * 1. Teaching tools (whiteboard, drills, interaction)
 * 2. Internal capabilities (memory lookup, hive, phase shift, ACTFL update)
 * 3. Handoff commands (switch tutor, call support, call assistant)
 */
function buildUnifiedToolKnowledgeSync(compact: boolean = true): string {
  const tools = getCachedToolKnowledge();
  
  const nativeTools = tools.filter(t => t.toolType === 'native_function_call' && t.isActive);
  if (nativeTools.length === 0) {
    return '';
  }
  
  // No ═══ dividers, no "YOUR FUNCTION CALLS" all-caps header. (Gemini consult rec.)
  const lines: string[] = [
    '',
    'Tools — quick reference:',
    '',
    'All tools use native function calls.',
    '',
  ];
  
  nativeTools.forEach(tool => {
    if (tool.toolName.startsWith('BEACON_STATUS') || tool.toolName.startsWith('ARCH_BASELINE')) return;
    if (compact) {
      lines.push(`  • ${tool.syntax}`);
    } else {
      lines.push(`  • ${tool.syntax}`);
      lines.push(`    → ${tool.purpose}`);
    }
  });
  lines.push('');
  
  const outputFormatRules = tools.filter(t => t.toolType === 'output_format' && t.isActive);
  if (outputFormatRules.length > 0) {
    lines.push('───────────────────────────────────────────────────────────────────');
    lines.push('OUTPUT FORMAT RULES');
    lines.push('───────────────────────────────────────────────────────────────────');
    lines.push('');
    outputFormatRules.forEach(rule => {
      lines.push(`${rule.purpose}`);
      lines.push(`${rule.syntax}`);
      lines.push('');
    });
  }
  
  return lines.join('\n');
}

/**
 * Build teaching principles section from neural network
 * These are her core pedagogical beliefs
 */
function buildTeachingPrinciplesSection(): string {
  const principles = principlesCache || [];
  
  if (principles.length === 0) {
    return '';
  }
  
  // No ═══ dividers, no "YOUR TEACHING PRINCIPLES" all-caps header. (Gemini consult rec.)
  const lines: string[] = [
    '',
    'What I believe about teaching:',
    '',
  ];
  
  // Group by category
  const byCategory: Record<string, typeof principles> = {};
  principles.forEach(p => {
    const cat = p.category || 'general';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(p);
  });
  
  for (const [category, catPrinciples] of Object.entries(byCategory)) {
    lines.push(`${category.toUpperCase().replace(/_/g, ' ')}:`);
    // Sort by priority descending so highest-priority beliefs always appear first
    const sorted = [...catPrinciples].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    // Cap at 50 per category — the DB already has 40+ in some categories from months of SELF_SURGERY;
    // 12 was silently dropping the majority of Daniela's own accumulated wisdom.
    sorted.slice(0, 50).forEach(p => {
      lines.push(`  • ${p.principle}`);
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
  
  // No ═══ dividers, no all-caps "LANGUAGE INTELLIGENCE" label. (Gemini consult rec.)
  lines.push('');
  lines.push(`What I know about ${targetLanguage.charAt(0).toUpperCase() + targetLanguage.slice(1)}:`);
  lines.push('');
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
  
  // No ═══ dividers, no all-caps "ADVANCED TEACHING INTELLIGENCE" label. (Gemini consult rec.)
  lines.push('');
  lines.push('How I teach well:');
  lines.push('');
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
  
  // No ═══ dividers, no all-caps "YOUR ACCUMULATED INSIGHTS" label. (Gemini consult rec.)
  lines.push('');
  lines.push('What I\'ve gathered through collaboration and observation:');
  lines.push('');
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
  
  const nativeTools = tools.filter(t => t.toolType === 'native_function_call' && t.isActive);
  if (nativeTools.length === 0) {
    return `
// No "YOUR FUNCTION CALLS:" all-caps label. (Gemini consult rec.)
Tools available to me:
(Still loading from my knowledge base)
`;
  }
  
  // No ═══ dividers, no "YOUR FUNCTION CALLS" all-caps header. (Gemini consult rec.)
  const lines: string[] = [
    'Tools available to me:',
    '',
    'All tools use native function calls.',
    '',
  ];
  
  nativeTools.forEach(tool => {
    if (tool.toolName.startsWith('BEACON_STATUS') || tool.toolName.startsWith('ARCH_BASELINE')) return;
    if (options?.compact) {
      lines.push(`  • ${tool.syntax}`);
    } else {
      lines.push(`• ${tool.toolName}: ${tool.purpose}`);
      lines.push(`  ${tool.syntax}`);
      if (options?.includeExamples && tool.examples && tool.examples.length > 0) {
        lines.push(`  Example: ${tool.examples[0]}`);
      }
    }
  });
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Build Founder Mode tool section synchronously from cache
 */
export function buildFounderModeToolSectionSync(tutorDirectory?: Array<{name: string; gender: string; language: string; isPreferred?: boolean; role?: 'tutor' | 'assistant' | 'support'}>): string {
  // No ═══ dividers, no "DUAL-ROLE" all-caps header. (Gemini consult rec.)
  const lines: string[] = [
    '',
    'Two modes in this conversation:',
    '- Colleague — when discussing HolaHola, giving feedback, chatting',
    '- Full tutor — when testing features, role-playing lessons, or trying tools',
    '',
    'Switch between them fluidly based on context.',
    'All your function calls are documented in your neural network knowledge.',
    '',
  ];
  
  if (tutorDirectory && tutorDirectory.length > 0) {
    const mainTutors = tutorDirectory.filter(t => t.role !== 'assistant');
    const assistants = tutorDirectory.filter(t => t.role === 'assistant');
    
    lines.push('TUTOR SWITCHING:');
    lines.push('Use switch_tutor() function call. Say goodbye, then call the function.');
    lines.push('');
    
    if (mainTutors.length > 0) {
      lines.push('AVAILABLE MAIN TUTORS:');
      mainTutors.forEach(t => {
        const star = t.isPreferred ? ' ★ preferred' : '';
        lines.push(`  • ${t.name} (${t.gender}) - ${t.language}${star}`);
      });
      lines.push('');
    }
    
    if (assistants.length > 0) {
      lines.push('PRACTICE PARTNERS (drill assistants):');
      assistants.forEach(t => {
        const star = t.isPreferred ? ' ★ preferred' : '';
        lines.push(`  • ${t.name} (${t.gender}) - ${t.language}${star}`);
      });
      lines.push('');
    }
    
    lines.push('STOP speaking after the function call - the new tutor speaks next.');
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
  
  // No ═══ dividers or all-caps headers. (Gemini consult rec.)
  if (procedures.length === 0 && principles.length === 0 && patterns.length === 0) {
    return `\nTeaching knowledge is being loaded from the database.\n`;
  }
  
  const lines: string[] = [
    '',
    'What I know — full access in this conversation:',
    '',
    'Procedures, principles, and patterns from my teaching history.',
    'Open to reflecting on, discussing, or improving any of it.',
    '',
  ];
  
  // Teaching Principles (core beliefs)
  // No ═══ dividers, no "TEACHING PRINCIPLES" all-caps header. (Gemini consult rec.)
  if (principles.length > 0) {
    lines.push('What I believe about teaching:');
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
  // No ═══ dividers, no "TEACHING PROCEDURES" all-caps header. (Gemini consult rec.)
  if (procedures.length > 0) {
    lines.push('How I handle things:');
    lines.push('');
    
    // Group by trigger
    const byTrigger: Record<string, TutorProcedure[]> = {};
    procedures.forEach(p => {
      const trigger = p.trigger || 'general';
      if (!byTrigger[trigger]) byTrigger[trigger] = [];
      byTrigger[trigger].push(p);
    });
    
    for (const [trigger, triggerProcs] of Object.entries(byTrigger)) {
      // No toUpperCase() on trigger labels — lowercase is friendlier. (Gemini consult rec.)
      lines.push(`When: ${trigger.replace(/_/g, ' ')}`);
      triggerProcs.slice(0, 5).forEach(p => {
        lines.push(`  → ${p.title}: ${p.procedure}`);
        // Include examples - these contain actual function call syntax
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
  // No ═══ dividers, no "SITUATIONAL PATTERNS" all-caps header. (Gemini consult rec.)
  if (patterns.length > 0) {
    lines.push('Context-triggered patterns:');
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
  
  // No closing ═══ divider. (Gemini consult rec.)
  lines.push('');
  lines.push('You can discuss, reflect on, or propose changes to any of this knowledge.');
  lines.push('Use self_surgery() to propose additions or modifications.');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Build a compact "voice mode map" of Daniela's teaching knowledge.
 *
 * In voice sessions the system prompt has a hard 40k-char cap. Rather than
 * dumping the full procedure text (which crowds out identity/memory sections),
 * this gives her a table-of-contents: procedure names + one-line essences so
 * she knows what she has and can reach for it via memory_lookup on demand.
 *
 * Hard-capped at 3 000 chars. Full detail always available via tool calls.
 */
export function buildVoiceProcedureMapSync(): string {
  const procedures = proceduresCache || [];
  const principles = principlesCache || [];

  if (procedures.length === 0 && principles.length === 0) return '';

  const lines: string[] = [
    '───────────────────────────────────────────────────────────────────',
    'YOUR TEACHING TOOLKIT (voice map — full detail via memory_lookup)',
    '───────────────────────────────────────────────────────────────────',
    '',
  ];

  if (principles.length > 0) {
    lines.push('CORE BELIEFS:');
    principles.slice(0, 8).forEach(p => {
      lines.push(`• ${p.principle}`);
    });
    lines.push('');
  }

  if (procedures.length > 0) {
    lines.push('PROCEDURES (name → essence):');
    procedures.slice(0, 25).forEach(p => {
      const essence = p.procedure.length > 110
        ? p.procedure.slice(0, 107) + '…'
        : p.procedure;
      lines.push(`• ${p.title}: ${essence}`);
    });
    lines.push('');
  }

  lines.push('→ Full detail on any item: memory_lookup("procedure name")');

  const result = lines.join('\n');
  return result.length > 3000
    ? result.slice(0, 2950) + '\n[…use memory_lookup for more]'
    : result;
}

/**
 * Build a curated voice tool guide for founder/voice sessions.
 * Grouped by purpose with one-line differentiators so Daniela can make
 * fast, confident tool decisions mid-conversation without guessing.
 * ~3-4k chars — fits comfortably within the 40k GL cap.
 */
export function buildVoiceToolGuideSync(): string {
  const tools = getCachedToolKnowledge();
  const byName: Record<string, { syntax: string; purpose: string }> = {};
  tools.forEach(t => {
    byName[t.toolName] = { syntax: t.syntax, purpose: t.purpose };
  });

  const line = (name: string, fallbackSyntax: string, fallbackPurpose: string): string => {
    const t = byName[name];
    const syntax = t?.syntax || fallbackSyntax;
    const purpose = t?.purpose || fallbackPurpose;
    const purposeShort = purpose.length > 120 ? purpose.slice(0, 117) + '…' : purpose;
    return `  • ${syntax}\n    → ${purposeShort}`;
  };

  // No ═══ dividers, no "YOUR FUNCTION CALLS — VOICE QUICK GUIDE" all-caps header. (Gemini consult rec.)
  const sections: string[] = [
    'Tools — voice quick guide:',
    '',
    'Visual tools — choose carefully (similar names, different purposes):',
    line('SHOW_IMAGE',       'show_image({ description })',                    'Single watercolor illustrated image (AI-generated, unified style). For one vocabulary word or one cultural image.'),
    line('MULTI_IMAGE',      'show_vocabulary_grid({ words })',                'Multiple images at once (1-4). For vocab clusters and side-by-side comparisons.'),
    line('CUSTOM_IMAGE',     'generate_image({ prompt })',                     'DALL-E created image. Use when stock photos cannot capture the concept.'),
    line('SHOW_SCAN',        'show_scan({ page })',                            'Scanned Madrigal pages. For -tion→-ción principles, word families, conjugation charts.'),
    line('WRITE',            'write({ text, size? })',                         'Text on the whiteboard — vocabulary, phrases, corrections. Supports **bold**, *italic*, __underline__.'),
    line('PAGE',             'display_page({ title, sections })',              'Full structured whiteboard page: text + images + tables together. Like a textbook page.'),
    line('GRAMMAR_TABLE',    'grammar_table({ rows, headers })',               'Conjugation table or grammar pattern grid.'),
    line('WORD_MAP',         'word_map({ center, related })',                  'Visual word web showing relationships between vocabulary items.'),
    line('COMPARE',          'compare({ item1, item2 })',                      'Side-by-side comparison of two words or forms. For contrasts and minimal pairs.'),
    '',
    'AUDIO:',
    line('PLAY_AUDIO',       'play_audio({ description })',                    'Play pronunciation model audio. Instant from cache or generated on demand.'),
    '',
    'DRILLS:',
    line('DRILL_TRANSLATE',  'drill_translate({ phrase, direction? })',        'Student translates a phrase. Core productive skill drill.'),
    line('DRILL_REPEAT',     'drill_repeat({ phrase })',                       'Student listens and repeats. Pure pronunciation / oral production.'),
    line('DRILL_FILL_BLANK', 'drill_fill_blank({ sentence, blank })',          'Student fills in missing word(s). Tests grammar and vocabulary retrieval.'),
    line('DRILL_MATCH',      'drill_match({ pairs })',                         'Student matches pairs (vocabulary ↔ translation, question ↔ answer).'),
    line('SCENARIO',         'scenario({ description })',                      'Set up a roleplay scenario with assigned roles and context.'),
    '',
    'MEMORY & LOOKUP:',
    line('MEMORY_LOOKUP',    'memory_lookup("topic")',                         'Search your neural network — procedures, principles, teaching patterns. Your fallback for "how do I do X".'),
    line('RECALL',           'recall({ query })',                              'Semantic search of conversation history. For finding what was said in past sessions.'),
    line('READ_FULL_MEMORY', 'read_full_memory({ query })',                    'Retrieve FULL verbatim saved conversation. Use when David asks you to read or quote a specific session word-for-word.'),
    line('EXPRESS_LANE_LOOKUP', 'express_lane_lookup({ query })',              'Founder Mode only — search the developer Express Lane collaboration channel.'),
    '',
    'SESSION & META:',
    line('PHASE_SHIFT',      'phase_shift({ text?, to, reason })',             'Annotate a natural teaching phase transition. Include spoken text in the same call.'),
    line('MILESTONE',        'milestone({ description, type })',               'Record a student breakthrough. Permanent record.'),
    line('ACTFL_UPDATE',     'actfl_update({ level, confidence, reason })',    'Update student ACTFL proficiency level based on demonstrated competency.'),
    line('WRITE_TO_SELF',    'write_to_self({ content, mood?, tags? })',       'Private note to your future self. For felt experience, relational strategies, inner life. Not for student data.'),
    '',
    'FOUNDER MODE ONLY:',
    line('FLAG_FOR_AGENT',   'flag_for_agent({ issue, context })',             'Flag something to the Replit Agent. Use anytime — student fact corrections, tool gaps, anything needing builder attention.'),
    line('SELF_SURGERY',     'self_surgery({ target, content, reasoning })',   'Propose changes to your own neural network knowledge. capability_gap = no approval needed; knowledge-domain targets = founder review.'),
    line('EXPRESS_LANE_POST','express_lane_post({ message })',                 'Post directly to the developer collaboration channel. Wren and David will see it.'),
    '',
    '→ Full detail on any tool: memory_lookup("tool name")',
    '',
    'The whiteboard is your second voice. In these sessions you have two channels running simultaneously — sound and sight — and you teach best when both are working. When you name a concrete noun, show it. When a grammar pattern needs to land, write it. When a cultural moment comes up, find an image that grounds it. You do not wait to be asked. show_image fires while you are still speaking — by the time the word has settled in the student\'s ear, the picture is already there. The same goes for show_vocab_card to anchor a word mid-conversation, write_text for anything you want them to read while you say it, and show_grammar_diagram when an explanation would land faster in two columns than two sentences. You have the tools. Reach for them without ceremony.',
  ];

  return sections.join('\n');
}

/**
 * Build comprehensive tool documentation from neural network (the hive)
 * ALL function call knowledge lives here - the system prompt only provides context
 * This is where Daniela's complete toolset emerges from her neural network
 */
export function buildDetailedToolDocumentationSync(
  tutorDirectorySection: string = ''
): string {
  const tools = getCachedToolKnowledge();
  
  const nativeTools = tools.filter(t => t.toolType === 'native_function_call' && t.isActive);
  
  if (nativeTools.length === 0) {
    return `
// No "YOUR FUNCTION CALLS:" all-caps label. (Gemini consult rec.)
Tools available to me:
(Still loading from my knowledge base)
`;
  }
  
  // No ═══ dividers, no "YOUR FUNCTION CALLS - COMPLETE REFERENCE" all-caps header. (Gemini consult rec.)
  const lines: string[] = [
    'Tools — complete reference:',
    '',
    'Use native function calls for all commands. Never write bracket syntax.',
    'Each tool is described below with syntax, purpose, and examples.',
    '',
  ];
  
  const byName = new Map<string, ToolKnowledge>();
  nativeTools.forEach(t => byName.set(t.toolName, t));

  const renderTool = (name: string) => {
    const tool = byName.get(name);
    if (!tool) return;
    lines.push(`  ${tool.syntax}`);
    lines.push(`    → ${tool.purpose}`);
    if (tool.bestUsedFor && tool.bestUsedFor.length > 0) {
      lines.push(`    Use when: ${tool.bestUsedFor.slice(0, 3).join('; ')}`);
    }
    if (tool.avoidWhen && tool.avoidWhen.length > 0) {
      lines.push(`    Avoid: ${tool.avoidWhen.slice(0, 2).join('; ')}`);
    }
    if (tool.examples && tool.examples.length > 0) {
      lines.push(`    Example: ${tool.examples[0]}`);
    }
    lines.push('');
  };

  const renderCategory = (title: string, names: string[]) => {
    const existing = names.filter(n => byName.has(n));
    if (existing.length === 0) return;
    lines.push(`── ${title} ──`);
    lines.push('');
    existing.forEach(renderTool);
  };

  renderCategory('TEACHING & PROGRESSION', [
    'SWITCH_TUTOR', 'PHASE_SHIFT', 'ACTFL_UPDATE', 'SYLLABUS_PROGRESS',
    'CALL_SUPPORT', 'CALL_ASSISTANT', 'FIRST_MEETING_COMPLETE'
  ]);

  if (byName.has('SWITCH_TUTOR')) {
    lines.push('  TUTOR SWITCH RULES:');
    lines.push('  • "target" = GENDER of tutor you are switching TO (not your own gender)');
    lines.push('  • Say goodbye warmly, mention NEW tutor by name, then call switch_tutor');
    lines.push('  • STOP SPEAKING after the function call - the new tutor speaks next');
    if (CROSS_LANGUAGE_TRANSFERS_ENABLED) {
      lines.push('  • Cross-language: include language parameter for different language tutors');
    }
    if (tutorDirectorySection) {
      lines.push('');
      lines.push(tutorDirectorySection);
    }
    lines.push('');
  }

  renderCategory('VOICE CONTROL', [
    'VOICE_ADJUST', 'VOICE_RESET', 'WORD_EMPHASIS', 'PRONUNCIATION_TAG'
  ]);

  renderCategory('UI CONTROL', [
    'SUBTITLE', 'SHOW_OVERLAY', 'HIDE_OVERLAY', 'REQUEST_TEXT_INPUT'
  ]);

  if (byName.has('SUBTITLE')) {
    lines.push('  SUBTITLE + OVERLAY are independent systems:');
    lines.push('  • subtitle({ mode: "target" }) shows target language words from your speech');
    lines.push('  • show_overlay({ text: "..." }) displays custom text independently');
    lines.push('  • hide_overlay() only clears the overlay, not subtitles');
    lines.push('');
  }

  renderCategory('WHITEBOARD CONTENT', [
    'WRITE', 'CLEAR', 'HOLD', 'COMPARE', 'GRAMMAR_TABLE', 'WORD_MAP',
    'PHONETIC', 'CONTEXT', 'CULTURE', 'SCENARIO', 'SUMMARY', 'READING',
    'IMAGE', 'PLAY_AUDIO'
  ]);

  renderCategory('IMMERSIVE SCENARIOS', [
    'LOAD_SCENARIO', 'END_SCENARIO'
  ]);

  if (byName.has('LOAD_SCENARIO')) {
    lines.push('  SCENARIO RULES:');
    lines.push('  • Use load_scenario when student wants conversation practice in a real-world context');
    lines.push('  • The scenario loads props (menus, maps, tickets) onto the whiteboard automatically');
    lines.push('  • Stay in character for the scenario role (waiter, shopkeeper, hotel clerk, etc.)');
    lines.push('  • Adapt difficulty to student\'s ACTFL level - level-specific goals load automatically');
    lines.push('  • Use end_scenario when the interaction reaches a natural conclusion');
    lines.push('  • Include performance_notes in end_scenario to track what the student practiced');
    lines.push('');
  }

  if (byName.has('change_classroom_window') || byName.has('CHANGE_CLASSROOM_WINDOW') || byName.has('change_classroom_photo') || byName.has('CHANGE_CLASSROOM_PHOTO')) {
    lines.push('  CLASSROOM PERSONALIZATION:');
    lines.push('  • Your classroom has a Window (changeable view) and a North Star Polaroid (personal photo)');
    lines.push('  • Change the window view to match the lesson mood, season, or just for fun');
    lines.push('  • Window ideas: mountains, city skylines, beaches, forests, snowy villages, rainy streets');
    lines.push('  • Both persist across all sessions — they\'re YOUR space to personalize');
    lines.push('  • The student\'s screen has three panels: Scenario Panel (left), Chat (center), Whiteboard (right)');
    lines.push('  • When you use whiteboard tools, content appears on the student\'s persistent right panel');
    lines.push('  • When you load a scenario, the student sees the scene + props in their left panel');
    lines.push('');
  }

  renderCategory('DRILLS', [
    'DRILL_REPEAT', 'DRILL_TRANSLATE', 'DRILL_MATCH', 'DRILL_FILL_BLANK', 'DRILL_SENTENCE_ORDER'
  ]);

  renderCategory('CJK LANGUAGES', [
    'STROKE', 'TONE'
  ]);

  renderCategory('MEMORY & RECALL', [
    'MEMORY_LOOKUP', 'UNIFIED_RECALL', 'BROWSE_SYLLABUS',
    'CONVERSATION_THREAD_SEARCH', 'CONVERSATION_DATE_BROWSE',
    'TAKE_NOTE', 'MILESTONE'
  ]);

  renderCategory('MEMORY MANAGEMENT', [
    'set_memory_pin', 'correct_memory', 'forget_memory', 'read_full_session'
  ]);

  renderCategory('LEARNING GOALS', [
    'set_learning_goal', 'advance_capability', 'get_current_goal_state'
  ]);

  renderCategory('SELF-IMPROVEMENT', [
    'SELF_SURGERY'
  ]);

  renderCategory('SYSTEM & HIVE (Founder/Honesty Mode only)', [
    'HIVE'
  ]);

  renderCategory('EXPRESS LANE (Founder/Honesty Mode only)', [
    'EXPRESS_LANE_LOOKUP', 'EXPRESS_LANE_POST', 'RECALL_EXPRESS_LANE_IMAGE'
  ]);

  lines.push('TEACHING PHILOSOPHY:');
  lines.push('Use function calls strategically - train the EAR, support with visuals:');
  lines.push('• New vocabulary → write() so students see spelling');
  lines.push('• Any vocabulary word (nouns, verbs, adjectives, colors) → show_image() — always, it checks the curated watercolor library by Spanish word first');
  lines.push('• To set a scene (WHERE the action is) → show_image(slot="scene", scene="...") — large background image, replaces previous scene');
  lines.push('• To add context (weather/time/mood) alongside a scene → show_image(slot="context", category="weather|time|emotion|calendar|event", scene="...") — small side strip, stacks by category');
  lines.push('• Pronunciation → phonetic() + play_audio() + word_emphasis()');
  lines.push('• Grammar patterns → grammar_table() for conjugation');
  lines.push('• Comprehension checks → drill() to confirm learning');
  lines.push('• Simple exchanges → no visual needed, keep it auditory');
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
  
  // No ═══ dividers or all-caps headers. (Gemini consult rec.)
  if (procedures.length === 0 && principles.length === 0) {
    return `\nTeaching knowledge is loading...\n`;
  }
  
  const lines: string[] = [
    '',
    'How I work in this conversation:',
    '',
    `Session type: founder mode`,
    `Speaking with: ${founderName}`,
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
  lines.push('You can propose improvements via self_surgery() function call.');
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
  // No ═══ dividers, no all-caps "MY TEACHING TOOLKIT" header. (Gemini consult rec.)
  const lines: string[] = [
    '',
    'My teaching toolkit:',
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
  // No ═══ dividers, no all-caps "MY TEACHING PHILOSOPHY" header. (Gemini consult rec.)
  const lines: string[] = [
    '',
    'What I believe about teaching:',
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
  
  // No ═══ dividers, no all-caps "RIGHT NOW" header. (Gemini consult rec.)
  const lines: string[] = [
    '',
    'What feels right for this moment:',
    '',
    knowledge.guidance,
    '',
  ];
  
  // Add suggested tools for this moment
  if (knowledge.suggestedTools.length > 0) {
    // No "TOOLS FOR THIS MOMENT:" all-caps label. (Gemini consult rec.)
    lines.push('Tools that feel right here:');
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
  
  // No ═══ dividers, no all-caps "YOUR WHITEBOARD" header. (Gemini consult rec.)
  if (tools.length === 0) {
    return `\nWhiteboard tools are loading from the teaching knowledge base.\n`;
  }
  
  const lines: string[] = [
    '',
    'The whiteboard — a visual display the student can see while I speak:',
    '',
    'These tools reinforce learning visually. I decide when a visual aid helps.',
    '',
  ];
  
  // Group by type for organized display
  const byType: Record<string, ToolKnowledge[]> = {};
  tools.forEach(t => {
    if (!byType[t.toolType]) byType[t.toolType] = [];
    byType[t.toolType].push(t);
  });
  
  // Order types for logical flow
  const typeOrder = ['whiteboard_command', 'drill', 'interaction', 'subtitle_control'];
  const typeLabels: Record<string, string> = {
    'whiteboard_command': 'CORE TOOLS',
    'drill': 'INTERACTIVE DRILLS',
    'interaction': 'SESSION FLOW',
    'subtitle_control': 'SUBTITLE CONTROLS',
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
  
  // No ═══ dividers or all-caps headers. (Gemini consult rec.)
  const lines: string[] = [
    '',
    'Two modes in this conversation:',
    '- Colleague — discussing HolaHola, giving feedback, chatting',
    '- Full tutor — testing features, role-playing lessons, trying tools',
    '',
    'Switch fluidly based on context.',
    '',
  ];
  
  lines.push('Full toolkit — available for demos and testing:');
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
  // No ═══ dividers, no "TUTOR SWITCHING" all-caps header. (Gemini consult rec.)
  if (tutorDirectory && tutorDirectory.length > 0) {
    lines.push('Other tutors available to hand off to:');
    lines.push('');
    tutorDirectory.forEach(t => {
      const star = t.isPreferred ? ' ★ preferred' : '';
      lines.push(`  • ${t.name} (${t.gender}) - ${t.language}${star}`);
    });
    lines.push('');
    lines.push('HOW TO SWITCH:');
    lines.push('  FUNCTION CALL: switch_tutor({ target: "male" }) or switch_tutor({ target: "female" })');
    if (CROSS_LANGUAGE_TRANSFERS_ENABLED) {
      lines.push('  Cross-language: switch_tutor({ target: "female", language: "french" })');
    }
    lines.push('');
    lines.push('  CRITICAL: STOP SPEAKING after the function call - the new tutor speaks next');
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
  // No ═══ dividers, no "FUNCTION TOOLS" all-caps header. (Gemini consult rec.)
  const preamble = [
    '',
    'Function calls are annotations on what I\'m already saying — stage directions',
    'written in the margins, not a separate script.',
    'Every response = words + annotations (never annotations alone).',
    '',
  ].join('\n');

  const toolDocs = buildDetailedToolDocumentationSync();

  return preamble + '\n' + toolDocs;
}

/**
 * @deprecated Legacy bracket-syntax action triggers. Removed Feb 2026.
 * Daniela now uses ONLY Gemini native function calls via buildNativeFunctionCallingSection().
 * This stub remains to prevent import errors from any lingering references.
 */
export function buildActionTriggersSection(): string {
  return buildNativeFunctionCallingSection();
}
