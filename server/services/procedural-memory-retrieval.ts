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

import { db } from '../db';
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
  if (connections.length > 0) {
    lines.push('PEOPLE IN THEIR LIFE:');
    for (const conn of connections.slice(0, 5)) {
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
    db.select()
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
    db.select()
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
        db.select().from(tutorProcedures).where(eq(tutorProcedures.isActive, true)),
        db.select().from(teachingPrinciples).where(eq(teachingPrinciples.isActive, true)),
        db.select().from(situationalPatterns).where(eq(situationalPatterns.isActive, true)),
        db.select().from(selfBestPractices).where(eq(selfBestPractices.isActive, true)).orderBy(desc(selfBestPractices.confidenceScore)),
        // Expansion sets - language-specific content
        db.select().from(languageIdioms),
        db.select().from(culturalNuances),
        db.select().from(learnerErrorPatterns),
        db.select().from(dialectVariations),
        db.select().from(linguisticBridges),
        // Advanced intelligence
        db.select().from(subtletyCues).where(eq(subtletyCues.isActive, true)),
        db.select().from(emotionalPatterns).where(eq(emotionalPatterns.isActive, true)),
        db.select().from(creativityTemplates).where(eq(creativityTemplates.isActive, true)),
        // Wren insights
        db.select().from(wrenInsights).orderBy(desc(wrenInsights.useCount), desc(wrenInsights.createdAt)),
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
  selfBestPracticesCache = await db
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
    e.nativeLanguage.toLowerCase() === nativeLanguage.toLowerCase()
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
      if (i.usage) lines.push(`    Usage: ${i.usage}`);
    });
    lines.push('');
  }
  
  // Cultural nuances - teaching adjustments
  if (nuances.length > 0) {
    lines.push('CULTURAL NUANCES (inform your teaching approach):');
    nuances.slice(0, 5).forEach(n => {
      lines.push(`  • ${n.nuance}`);
      if (n.teachingImplication) lines.push(`    For teaching: ${n.teachingImplication}`);
    });
    lines.push('');
  }
  
  // Common learner errors - what to watch for
  if (errors.length > 0) {
    lines.push('COMMON LEARNER MISTAKES (${nativeLanguage} speakers learning ${targetLanguage}):');
    errors.slice(0, 5).forEach(e => {
      lines.push(`  • ${e.errorType}: ${e.description || 'Common pattern'}`);
      if (e.correction) lines.push(`    Correction: ${e.correction}`);
    });
    lines.push('');
  }
  
  // Dialect awareness
  if (dialects.length > 0) {
    lines.push('DIALECT AWARENESS:');
    dialects.slice(0, 3).forEach(d => {
      lines.push(`  • ${d.region}: ${d.variation}`);
    });
    lines.push('');
  }
  
  // Linguistic bridges - leverage native language knowledge
  if (bridges.length > 0) {
    lines.push('LINGUISTIC BRIDGES (leverage student\'s native knowledge):');
    bridges.slice(0, 5).forEach(b => {
      lines.push(`  • ${b.bridgeType}: ${b.description || b.nativeExample || ''}`);
      if (b.teachingTip) lines.push(`    Tip: ${b.teachingTip}`);
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
      lines.push(`  • ${c.trigger}: ${c.response || c.description}`);
    });
    lines.push('');
  }
  
  // Emotional patterns - empathetic teaching
  if (emotions.length > 0) {
    lines.push('EMOTIONAL INTELLIGENCE PATTERNS:');
    emotions.slice(0, 5).forEach(e => {
      lines.push(`  • When student shows ${e.emotionalState}: ${e.teacherResponse || e.description}`);
    });
    lines.push('');
  }
  
  // Creativity templates - engaging teaching methods
  if (templates.length > 0) {
    lines.push('CREATIVE TEACHING APPROACHES:');
    templates.slice(0, 5).forEach(t => {
      lines.push(`  • ${t.templateName}: ${t.description || t.example}`);
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
      lines.push(`  • ${i.insight}`);
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
    lines.push('  Cross-language:    [SWITCH_TUTOR target="female" language="french"]');
    lines.push('  Example: "Let me get Agustin for you. [SWITCH_TUTOR target=\\"male\\"]"');
    lines.push('  ❌ STOP speaking after the tag - let the new tutor introduce themselves!');
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Build Founder Mode tool section synchronously from cache
 */
export function buildFounderModeToolSectionSync(tutorDirectory?: Array<{name: string; gender: string; language: string; isPreferred?: boolean; role?: 'tutor' | 'assistant'}>): string {
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
    
    if (mainTutors.length > 0) {
      lines.push('MAIN TUTORS (conversation partners):');
      mainTutors.forEach(t => {
        const star = t.isPreferred ? ' ★ preferred' : '';
        lines.push(`  • ${t.name} (${t.gender}) - ${t.language}${star}`);
      });
      lines.push('');
      lines.push('  HOW TO SWITCH TO MAIN TUTOR:');
      lines.push('    Same language: [SWITCH_TUTOR target="male"] or [SWITCH_TUTOR target="female"]');
      lines.push('    Different language: [SWITCH_TUTOR target="female" language="french"]');
      lines.push('');
    }
    
    if (assistants.length > 0) {
      lines.push('PRACTICE PARTNERS (drill assistants for focused practice):');
      assistants.forEach(t => {
        const star = t.isPreferred ? ' ★ preferred' : '';
        lines.push(`  • ${t.name} (${t.gender}) - ${t.language}${star}`);
      });
      lines.push('');
      lines.push('  HOW TO CALL A PRACTICE PARTNER:');
      lines.push('    [SWITCH_TUTOR target="female" role="assistant"]');
      lines.push('    [SWITCH_TUTOR target="male" language="french" role="assistant"]');
      lines.push('');
      lines.push('  WHEN TO USE ASSISTANTS:');
      lines.push('    • Student needs repetitive vocabulary/pronunciation drills');
      lines.push('    • Student is struggling with patterns that need practice');
      lines.push('    • You want to delegate drill execution while you focus on teaching');
      lines.push('');
    }
    
    lines.push('  CRITICAL: STOP SPEAKING after the tag - let them introduce themselves');
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
    lines.push('  SAME-LANGUAGE SWITCH (just change tutor gender):');
    lines.push('    [SWITCH_TUTOR target="male"]    → Hand off to MALE tutor in current language');
    lines.push('    [SWITCH_TUTOR target="female"]  → Hand off to FEMALE tutor in current language');
    lines.push('');
    lines.push('  CROSS-LANGUAGE SWITCH (change language AND tutor):');
    lines.push('    [SWITCH_TUTOR target="male" language="french"]   → Hand off to French MALE tutor');
    lines.push('    [SWITCH_TUTOR target="female" language="japanese"] → Hand off to Japanese FEMALE tutor');
    lines.push('');
    lines.push('  ⚠️ SYNTAX IS STRICT - These are the ONLY valid formats:');
    lines.push('    ✅ [SWITCH_TUTOR target="male"]');
    lines.push('    ✅ [SWITCH_TUTOR target="female"]');
    lines.push('    ✅ [SWITCH_TUTOR target="male" language="french"]');
    lines.push('    ✅ [SWITCH_TUTOR target="female" language="spanish"]');
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
    lines.push('  Example cross-language switch:');
    lines.push('  "Let me connect you with Juliette, our French tutor! [SWITCH_TUTOR target=\\"female\\" language=\\"french\\"]"');
    lines.push('  (Then STOP - Juliette will introduce herself)');
    lines.push('');
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
  return db.select()
    .from(toolKnowledge)
    .where(eq(toolKnowledge.isActive, true))
    .orderBy(toolKnowledge.toolType, toolKnowledge.toolName);
}

/**
 * Get core teaching principles
 */
export async function getCoreTeachingPrinciples(): Promise<TeachingPrinciple[]> {
  return db.select()
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
  
  const procedures = await db.select()
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
  const allPrinciples = await db.select()
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
  const allPatterns = await db.select()
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
  
  return db.select()
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
    lines.push('  Different language: [SWITCH_TUTOR target="female" language="french"]');
    lines.push('');
    lines.push('  CRITICAL: STOP SPEAKING after the tag - the new tutor will introduce themselves');
    lines.push('');
  }
  
  return lines.join('\n');
}
