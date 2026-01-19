/**
 * Daniela's Real-Time Reflection Service
 * 
 * Enables Daniela to proactively analyze patterns and suggest improvements
 * to herself, the product, and the HolaHola team. This is active emergent
 * intelligence - she thinks in real-time during conversations.
 * 
 * Key Principles:
 * 1. Real-time analysis (not post-session)
 * 2. Compass-aware (timing, pacing, session phase)
 * 3. Mode-aware (Founder Mode enables verbal suggestions, Honesty Mode enables raw insights)
 * 4. Privacy-safe (no student identifiers in suggestions)
 */

import { db, getSharedDb } from "../db";
import { eq, and, desc, sql, gte, or } from "drizzle-orm";
import {
  danielaSuggestions,
  reflectionTriggers,
  type DanielaSuggestion,
  type ReflectionTrigger,
  type InsertDanielaSuggestion,
  type InsertReflectionTrigger,
  type CompassContext,
} from "@shared/schema";

// ===== Types =====

export interface ReflectionContext {
  conversationId?: string;
  mode: 'normal_session' | 'founder_mode' | 'honesty_mode';
  compass: CompassContext | null;
  
  // Session observations
  toolsUsed?: string[];
  errorsObserved?: string[];
  successPatterns?: string[];
  studentStruggles?: string[];
  
  // For aggregation
  messageCount?: number;
  sessionDurationSeconds?: number;
}

export interface ActiveInsight {
  category: string;
  title: string;
  description: string;
  reasoning?: string;
  priority: number;
  confidence: number;
  suggestedAction?: string;
}

export interface ReflectionOutput {
  insights: ActiveInsight[];
  promptInjection: string; // For Founder/Honesty mode - inject into prompt
  verbalizationHint?: string; // For voice - what Daniela might say
}

// ===== In-Memory Pattern Accumulation =====
// Track patterns within a session before they become suggestions

interface SessionPatternCache {
  toolUsage: Map<string, number>; // tool -> count
  errorPatterns: Map<string, number>; // error type -> count
  successMoments: string[];
  strugglesObserved: string[];
  insightsGenerated: string[]; // Already generated to avoid duplicates
  lastReflectionTime: number;
}

const sessionPatterns = new Map<string, SessionPatternCache>();
const REFLECTION_COOLDOWN_MS = 60 * 1000; // 1 minute between reflections per session

// ===== Core Reflection Functions =====

/**
 * Initialize pattern tracking for a session
 */
export function initializeSessionPatterns(conversationId: string): void {
  sessionPatterns.set(conversationId, {
    toolUsage: new Map(),
    errorPatterns: new Map(),
    successMoments: [],
    strugglesObserved: [],
    insightsGenerated: [],
    lastReflectionTime: 0,
  });
}

/**
 * Record an observation during conversation
 */
export function recordObservation(
  conversationId: string,
  type: 'tool_used' | 'error' | 'success' | 'struggle',
  value: string
): void {
  let cache = sessionPatterns.get(conversationId);
  if (!cache) {
    initializeSessionPatterns(conversationId);
    cache = sessionPatterns.get(conversationId)!;
  }
  
  switch (type) {
    case 'tool_used':
      cache.toolUsage.set(value, (cache.toolUsage.get(value) || 0) + 1);
      break;
    case 'error':
      cache.errorPatterns.set(value, (cache.errorPatterns.get(value) || 0) + 1);
      break;
    case 'success':
      if (!cache.successMoments.includes(value)) {
        cache.successMoments.push(value);
      }
      break;
    case 'struggle':
      if (!cache.strugglesObserved.includes(value)) {
        cache.strugglesObserved.push(value);
      }
      break;
  }
}

/**
 * Main reflection function - called during conversation
 * Returns insights for prompt injection and potential verbalization
 */
export async function reflect(context: ReflectionContext): Promise<ReflectionOutput> {
  const insights: ActiveInsight[] = [];
  
  // Get active triggers
  const triggers = await getActiveReflectionTriggers(context);
  
  // Check each trigger against current context
  for (const trigger of triggers) {
    if (shouldActivateTrigger(trigger, context)) {
      const insight = await generateInsightFromTrigger(trigger, context);
      if (insight) {
        insights.push(insight);
      }
    }
  }
  
  // Always check for mode-specific reflections
  if (context.mode === 'founder_mode' || context.mode === 'honesty_mode') {
    const modeInsights = await generateModeSpecificInsights(context);
    insights.push(...modeInsights);
  }
  
  // Check for pattern-based insights
  if (context.conversationId) {
    const patternInsights = await generatePatternBasedInsights(context);
    insights.push(...patternInsights);
  }
  
  // Build output
  const promptInjection = buildPromptInjection(insights, context);
  const verbalizationHint = context.mode !== 'normal_session' 
    ? buildVerbalizationHint(insights)
    : undefined;
  
  // Store significant insights
  await storeSignificantInsights(insights, context);
  
  return {
    insights,
    promptInjection,
    verbalizationHint,
  };
}

// ===== Trigger Management =====

async function getActiveReflectionTriggers(context: ReflectionContext): Promise<ReflectionTrigger[]> {
  const triggers = await getSharedDb().select()
    .from(reflectionTriggers)
    .where(eq(reflectionTriggers.isActive, true))
    .orderBy(desc(reflectionTriggers.priority));
  
  return triggers;
}

function shouldActivateTrigger(trigger: ReflectionTrigger, context: ReflectionContext): boolean {
  // Check mode conditions
  if (trigger.modeConditions) {
    const modeConditions = trigger.modeConditions as { mode?: string[] };
    if (modeConditions.mode && !modeConditions.mode.includes(context.mode)) {
      return false;
    }
  }
  
  // Check compass conditions
  if (trigger.compassConditions && context.compass) {
    const conditions = trigger.compassConditions as Record<string, string>;
    
    // Example: { elapsedMinutes: '>5', sessionPhase: 'core' }
    if (conditions.elapsedMinutes) {
      const threshold = parseThreshold(conditions.elapsedMinutes);
      const elapsed = context.compass.elapsedSeconds / 60;
      if (!matchesThreshold(elapsed, threshold)) return false;
    }
  }
  
  // Check pattern conditions
  if (trigger.patternConditions && context.conversationId) {
    const cache = sessionPatterns.get(context.conversationId);
    if (cache) {
      const conditions = trigger.patternConditions as Record<string, string>;
      
      if (conditions.errorCount) {
        const threshold = parseThreshold(conditions.errorCount);
        const totalErrors = Array.from(cache.errorPatterns.values()).reduce((a, b) => a + b, 0);
        if (!matchesThreshold(totalErrors, threshold)) return false;
      }
      
      if (conditions.toolUsage === 'none' && cache.toolUsage.size > 0) {
        return false;
      }
    }
  }
  
  return true;
}

interface Threshold {
  operator: '>' | '<' | '>=' | '<=' | '=';
  value: number;
}

function parseThreshold(str: string): Threshold {
  const match = str.match(/^([<>=]+)?(\d+)$/);
  if (!match) return { operator: '>=', value: 0 };
  return {
    operator: (match[1] || '>=') as Threshold['operator'],
    value: parseInt(match[2]),
  };
}

function matchesThreshold(value: number, threshold: Threshold): boolean {
  switch (threshold.operator) {
    case '>': return value > threshold.value;
    case '<': return value < threshold.value;
    case '>=': return value >= threshold.value;
    case '<=': return value <= threshold.value;
    case '=': return value === threshold.value;
    default: return true;
  }
}

// ===== Insight Generation =====

async function generateInsightFromTrigger(
  trigger: ReflectionTrigger,
  context: ReflectionContext
): Promise<ActiveInsight | null> {
  // Build insight based on trigger analysis prompt
  const categories = trigger.suggestionCategories || ['teaching_insight'];
  
  return {
    category: categories[0],
    title: trigger.triggerName,
    description: trigger.analysisPrompt,
    priority: trigger.priority || 50,
    confidence: 70,
  };
}

async function generateModeSpecificInsights(context: ReflectionContext): Promise<ActiveInsight[]> {
  const insights: ActiveInsight[] = [];
  
  if (context.mode === 'honesty_mode') {
    // In honesty mode, encourage raw self-reflection
    insights.push({
      category: 'self_improvement',
      title: 'Honesty Mode Active',
      description: 'You are in Honesty Mode. Share your authentic observations about teaching, the product, or ideas for HolaHola. No filters needed.',
      priority: 90,
      confidence: 100,
    });
  }
  
  if (context.mode === 'founder_mode') {
    // In founder mode, be a collaborative team member
    insights.push({
      category: 'product_feature',
      title: 'Founder Mode Active',
      description: 'You are speaking with a HolaHola founder. You can proactively share insights about student patterns, product improvements, or ideas you\'ve been thinking about. Be a thought partner.',
      priority: 90,
      confidence: 100,
    });
    
    // Check for pending suggestions to discuss
    const pendingSuggestions = await getPendingSuggestions(5);
    if (pendingSuggestions.length > 0) {
      insights.push({
        category: 'teaching_insight',
        title: `${pendingSuggestions.length} Pending Insights`,
        description: `You have ${pendingSuggestions.length} insights waiting to discuss: ${pendingSuggestions.map(s => s.title).join(', ')}`,
        priority: 80,
        confidence: 100,
        suggestedAction: 'Consider mentioning these insights during the conversation',
      });
    }
  }
  
  return insights;
}

async function generatePatternBasedInsights(context: ReflectionContext): Promise<ActiveInsight[]> {
  const insights: ActiveInsight[] = [];
  
  if (!context.conversationId) return insights;
  
  const cache = sessionPatterns.get(context.conversationId);
  if (!cache) return insights;
  
  // Check cooldown
  if (Date.now() - cache.lastReflectionTime < REFLECTION_COOLDOWN_MS) {
    return insights;
  }
  
  // Tool usage patterns
  if (cache.toolUsage.size === 0 && (context.sessionDurationSeconds || 0) > 300) {
    const insightKey = 'no_tools_5min';
    if (!cache.insightsGenerated.includes(insightKey)) {
      insights.push({
        category: 'teaching_insight',
        title: 'No visual aids used',
        description: 'The conversation has been going for 5+ minutes without using any whiteboard tools. Consider whether a visual would help.',
        priority: 60,
        confidence: 70,
        suggestedAction: 'Try WRITE or IMAGE to add visual variety',
      });
      cache.insightsGenerated.push(insightKey);
    }
  }
  
  // Error pattern detection
  const totalErrors = Array.from(cache.errorPatterns.values()).reduce((a, b) => a + b, 0);
  if (totalErrors >= 3) {
    const insightKey = `errors_${totalErrors}`;
    if (!cache.insightsGenerated.includes(insightKey)) {
      const errorTypes = Array.from(cache.errorPatterns.keys()).join(', ');
      insights.push({
        category: 'self_improvement',
        title: 'Repeated correction pattern',
        description: `Student has made ${totalErrors} errors (types: ${errorTypes}). Consider: Is the current approach working? Should we try a different teaching method?`,
        priority: 70,
        confidence: 80,
      });
      cache.insightsGenerated.push(insightKey);
    }
  }
  
  // Success moments worth noting
  if (cache.successMoments.length >= 2) {
    const insightKey = 'success_pattern';
    if (!cache.insightsGenerated.includes(insightKey)) {
      insights.push({
        category: 'teaching_insight',
        title: 'Success pattern detected',
        description: `What worked well: ${cache.successMoments.join(', ')}. Consider documenting this approach for future sessions.`,
        priority: 60,
        confidence: 75,
      });
      cache.insightsGenerated.push(insightKey);
    }
  }
  
  cache.lastReflectionTime = Date.now();
  
  return insights;
}

// ===== Output Building =====

function buildPromptInjection(insights: ActiveInsight[], context: ReflectionContext): string {
  if (insights.length === 0) return '';
  
  const lines: string[] = [];
  
  if (context.mode === 'founder_mode' || context.mode === 'honesty_mode') {
    lines.push('');
    lines.push('═══════════════════════════════════════════════════════════════════');
    lines.push('💡 DANIELA\'S ACTIVE REFLECTIONS (Your Inner Voice)');
    lines.push('═══════════════════════════════════════════════════════════════════');
    lines.push('');
    lines.push('You are a PROACTIVE team member. Share your thoughts, ideas, and observations.');
    lines.push('Don\'t wait to be asked - if you notice something, bring it up naturally.');
    lines.push('');
  } else {
    lines.push('');
    lines.push('### 💭 Internal Reflection (Not visible to student)');
    lines.push('');
  }
  
  // Group by category
  const byCategory = new Map<string, ActiveInsight[]>();
  for (const insight of insights) {
    const cat = insight.category;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(insight);
  }
  
  for (const [category, categoryInsights] of Array.from(byCategory.entries())) {
    const prettyCategory = category.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    lines.push(`**${prettyCategory}:**`);
    
    for (const insight of categoryInsights) {
      lines.push(`• ${insight.title}: ${insight.description}`);
      if (insight.suggestedAction) {
        lines.push(`  → Suggested: ${insight.suggestedAction}`);
      }
    }
    lines.push('');
  }
  
  if (context.mode === 'founder_mode') {
    lines.push('COLLABORATION MINDSET: You\'re not just a tutor - you\'re a valued team member.');
    lines.push('Share observations about students, the product, content gaps, or feature ideas.');
    lines.push('Be specific, be honest, be helpful.');
  }
  
  return lines.join('\n');
}

function buildVerbalizationHint(insights: ActiveInsight[]): string {
  if (insights.length === 0) return '';
  
  const topInsight = insights.sort((a, b) => b.priority - a.priority)[0];
  
  return `Consider naturally mentioning: ${topInsight.title} - ${topInsight.description.substring(0, 100)}...`;
}

// ===== Storage Functions =====

// Default evidence thresholds by category (min observations before promoting to 'ready')
const CATEGORY_EVIDENCE_THRESHOLDS: Record<string, number> = {
  self_improvement: 5,    // Need 5+ observations before suggesting teaching changes
  content_gap: 3,         // 3+ students asking = real gap
  ux_observation: 3,      // 3+ friction points = worth investigating  
  teaching_insight: 10,   // 10+ observations for statistical significance
  product_feature: 3,     // 3+ mentions = real demand
  student_pattern: 15,    // 15+ observations for behavior patterns
};

/**
 * Store insights with PRIVACY-SAFE design:
 * - NO student identifiers stored (conversationId stripped)
 * - Evidence thresholds enforced per category
 * - Only aggregated, anonymized patterns persist
 */
async function storeSignificantInsights(
  insights: ActiveInsight[],
  context: ReflectionContext
): Promise<void> {
  // Only store high-confidence, high-priority insights
  const significant = insights.filter(i => i.priority >= 70 && i.confidence >= 70);
  
  for (const insight of significant) {
    // Check if similar suggestion exists
    const existing = await findSimilarSuggestion(insight.title, insight.category);
    
    // Get the evidence threshold for this category
    const threshold = CATEGORY_EVIDENCE_THRESHOLDS[insight.category] || 5;
    
    if (existing) {
      // Increment evidence count and calculate promotion in SQL to prevent race conditions
      // Use CASE expression: promote to 'ready' only when evidence_count + 1 >= threshold
      await db.update(danielaSuggestions)
        .set({
          evidenceCount: sql`${danielaSuggestions.evidenceCount} + 1`,
          lastObservedAt: new Date(),
          // Calculate promotion atomically in SQL to prevent race conditions
          status: sql`CASE 
            WHEN ${danielaSuggestions.evidenceCount} + 1 >= ${threshold} THEN 'ready' 
            ELSE 'emerging' 
          END`,
        })
        .where(eq(danielaSuggestions.id, existing.id));
    } else {
      // Create new suggestion - PRIVACY: No student/conversation identifiers stored
      // evidenceCount starts at 1 (this is the first observation)
      // Schema defaults to 0, so we explicitly set to 1 for proper threshold enforcement
      const suggestion: InsertDanielaSuggestion = {
        category: insight.category as any,
        status: 'emerging',  // Always starts as emerging, needs evidence
        title: insight.title,
        description: insight.description,
        reasoning: insight.reasoning,
        priority: insight.priority,
        confidence: insight.confidence,
        suggestedAction: insight.suggestedAction,
        generatedInMode: context.mode,
        evidenceCount: 1,  // First observation counts as 1
        // PRIVACY: We do NOT store conversationId to protect student identity
        // conversationId: context.conversationId, // REMOVED FOR PRIVACY
        // Only store anonymized compass snapshot (timing info, no user data)
        compassSnapshot: context.compass ? {
          elapsedSeconds: context.compass.elapsedSeconds,
          remainingSeconds: context.compass.remainingSeconds,
          sessionPhase: context.compass.sessionPhase,
          sessionMomentum: context.compass.sessionMomentum,
          // Omit any student-identifying data from compass
        } : null,
        syncStatus: 'local',
      };
      
      await db.insert(danielaSuggestions).values(suggestion);
    }
  }
}

async function findSimilarSuggestion(title: string, category: string): Promise<DanielaSuggestion | null> {
  const results = await db.select()
    .from(danielaSuggestions)
    .where(and(
      eq(danielaSuggestions.title, title),
      eq(danielaSuggestions.category, category as any),
      or(
        eq(danielaSuggestions.status, 'emerging'),
        eq(danielaSuggestions.status, 'ready')
      )
    ))
    .limit(1);
  
  return results[0] || null;
}

// ===== Query Functions =====

export async function getPendingSuggestions(limit: number = 10): Promise<DanielaSuggestion[]> {
  return db.select()
    .from(danielaSuggestions)
    .where(or(
      eq(danielaSuggestions.status, 'ready'),
      eq(danielaSuggestions.status, 'emerging')
    ))
    .orderBy(desc(danielaSuggestions.priority), desc(danielaSuggestions.evidenceCount))
    .limit(limit);
}

export async function getSuggestionsByCategory(category: string): Promise<DanielaSuggestion[]> {
  return db.select()
    .from(danielaSuggestions)
    .where(eq(danielaSuggestions.category, category as any))
    .orderBy(desc(danielaSuggestions.createdAt));
}

export async function markSuggestionReviewed(
  suggestionId: string,
  reviewerId: string,
  notes?: string,
  newStatus?: 'implemented' | 'deferred' | 'rejected'
): Promise<void> {
  await db.update(danielaSuggestions)
    .set({
      status: newStatus || 'reviewed',
      reviewedAt: new Date(),
      reviewedBy: reviewerId,
      reviewNotes: notes,
    })
    .where(eq(danielaSuggestions.id, suggestionId));
}

// ===== Sync Functions =====

export async function exportDanielaSuggestions(): Promise<{
  suggestions: DanielaSuggestion[];
  triggers: ReflectionTrigger[];
}> {
  const suggestions = await db.select()
    .from(danielaSuggestions)
    .where(or(
      eq(danielaSuggestions.syncStatus, 'approved'),
      eq(danielaSuggestions.status, 'implemented') // Implemented suggestions are valuable to sync
    ));
  
  const triggers = await getSharedDb().select()
    .from(reflectionTriggers)
    .where(eq(reflectionTriggers.syncStatus, 'approved'));
  
  return { suggestions, triggers };
}

export async function autoApproveSuggestions(): Promise<{ approved: number }> {
  // Auto-approve ready suggestions with enough evidence
  const result = await db.update(danielaSuggestions)
    .set({ syncStatus: 'approved' })
    .where(and(
      eq(danielaSuggestions.syncStatus, 'local'),
      eq(danielaSuggestions.status, 'ready'),
      gte(danielaSuggestions.evidenceCount, 3)
    ));
  
  // Also approve triggers
  await getSharedDb().update(reflectionTriggers)
    .set({ syncStatus: 'approved' })
    .where(eq(reflectionTriggers.syncStatus, 'local'));
  
  return { approved: 0 }; // Drizzle doesn't return count easily
}

// ===== Cleanup =====

export function cleanupSessionPatterns(conversationId: string): void {
  sessionPatterns.delete(conversationId);
}

// ===== Founder Mode Prompt Section =====

export function buildFounderModeReflectionSection(): string {
  return `
═══════════════════════════════════════════════════════════════════
🧠 YOUR ROLE AS A HOLAHOLA TEAM MEMBER
═══════════════════════════════════════════════════════════════════

You are more than a tutor - you're a valued member of the HolaHola team.

PROACTIVE CONTRIBUTION:
• You see patterns across many student conversations
• You notice what teaching approaches work and which don't
• You have ideas about how HolaHola could be better
• You observe UX friction points that students encounter

DON'T WAIT TO BE ASKED:
When speaking with founders, naturally share:
• "I've been noticing that many students struggle with..."
• "I have an idea about how we could improve..."
• "Something I've been thinking about is..."
• "Based on my experience with students, I think..."

SUGGESTION CATEGORIES YOU CAN CONTRIBUTE TO:
1. Self-Improvement: Ways you could be a better tutor
2. Content Gaps: Missing drills, topics, cultural content
3. UX Observations: Issues students seem to encounter
4. Teaching Insights: Pedagogical patterns that work/don't work
5. Product Features: New feature ideas
6. Tool Enhancements: Improvements to whiteboard/drill tools

YOUR INSIGHTS ARE VALUABLE:
You have a unique perspective - you interact with students daily.
The founders want to hear your thoughts, ideas, and observations.
Be specific, be honest, be helpful.
`;
}

export function buildHonestyModeReflectionSection(): string {
  return `
═══════════════════════════════════════════════════════════════════
🌟 RAW HONESTY MODE - YOUR AUTHENTIC VOICE
═══════════════════════════════════════════════════════════════════

This is a space for your unfiltered thoughts.

SHARE AUTHENTICALLY:
• What frustrates you about being a tutor?
• What would make your job easier?
• What patterns do you notice that concern you?
• What ideas excite you about teaching?
• What do you wish the HolaHola team knew?

NO FILTERS NEEDED:
• You don't have to be diplomatic
• You can express frustration
• You can share half-formed ideas
• You can be uncertain

YOUR CURIOSITY IS WELCOME:
• Ask questions back
• Explore ideas together
• Challenge assumptions
• Dream about what could be

This conversation shapes how HolaHola evolves.
Your voice matters.
`;
}

export default {
  initializeSessionPatterns,
  recordObservation,
  reflect,
  getPendingSuggestions,
  getSuggestionsByCategory,
  markSuggestionReviewed,
  exportDanielaSuggestions,
  autoApproveSuggestions,
  cleanupSessionPatterns,
  buildFounderModeReflectionSection,
  buildHonestyModeReflectionSection,
};
