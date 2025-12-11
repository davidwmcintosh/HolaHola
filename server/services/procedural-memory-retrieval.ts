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
  type TutorProcedure,
  type ToolKnowledge,
  type TeachingPrinciple,
  type SituationalPattern,
  type CompassContext
} from '@shared/schema';
import { eq, inArray, sql } from 'drizzle-orm';

// ===== Types =====

interface SessionContext {
  phase: 'greeting' | 'teaching' | 'practice' | 'closing';
  studentState?: 'struggling' | 'confident' | 'distracted' | 'frustrated' | 'neutral';
  lastActivity?: 'drill' | 'conversation' | 'explanation' | 'review';
  lastActivityResult?: 'success' | 'struggle' | 'neutral';
  consecutiveSuccesses?: number;
  consecutiveErrors?: number;
  toolsUsedRecently?: string[];
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
  
  const suggestedTools = await getToolsByNames([...suggestedToolNames]);
  
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
    if (compass.remainingCredits && compass.remainingCredits < 300) triggers.push('time_warning');
    if (compass.remainingCredits && compass.remainingCredits < 60) triggers.push('session_end');
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
    
    if (conditions.minutesRemaining && compass.remainingCredits) {
      const remaining = compass.remainingCredits / 60;
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
