/**
 * Phase Transition Service - Multi-Agent Teaching Architecture
 * 
 * Inspired by Deepgram's multi-agent voice pattern, this service manages
 * Daniela's teaching phases with context summarization and focused toolsets.
 * 
 * PHILOSOPHY: "Right context at the right time"
 * 
 * Each teaching phase has:
 * - Focused system prompt additions
 * - Phase-specific tools (2-4 per phase)
 * - Summarized context from previous phases
 * - Relevant hive snapshots
 * 
 * This reduces cognitive load on the LLM and improves teaching precision.
 */

import { GoogleGenAI } from "@google/genai";
import { db } from "../db";
import { hiveSnapshots, conversations, messages, hiveSnapshotTypeEnum, learnerPersonalFacts } from "@shared/schema";
import { studentLearningService } from "./student-learning-service";

type HiveSnapshotType = typeof hiveSnapshotTypeEnum.enumValues[number];
import { eq, desc, and, gte, inArray } from "drizzle-orm";

const genAI = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "",
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || '',
  },
});

export type TeachingPhase = 
  | 'warmup'           // Session start, mood check, goal setting
  | 'active_teaching'  // Core instruction, vocabulary, grammar
  | 'challenge'        // Student struggling, supportive mode
  | 'reflection'       // Celebrate progress, summarize, preview next
  | 'drill'            // Focused practice (existing mode)
  | 'assessment';      // ACTFL evaluation

export interface PhaseDefinition {
  name: TeachingPhase;
  description: string;
  focusedTools: string[];
  promptAdditions: string;
  snapshotTypes: HiveSnapshotType[];
  maxContextTokens: number;
}

export interface PhaseContext {
  currentPhase: TeachingPhase;
  phaseStartTime: Date;
  summarizedHistory: string;
  relevantSnapshots: string[];
  emotionalState: 'frustrated' | 'neutral' | 'excited' | 'confused' | 'tired';
  todaysGoal: string | null;
  keyErrors: string[];
  studentInterests: string[];
}

export interface PhaseTransitionEvent {
  fromPhase: TeachingPhase;
  toPhase: TeachingPhase;
  reason: string;
  contextSummary: string;
  timestamp: Date;
}

const PHASE_DEFINITIONS: Record<TeachingPhase, PhaseDefinition> = {
  warmup: {
    name: 'warmup',
    description: 'Session start - gauge mood, recall previous session, set goals',
    focusedTools: ['greet', 'recall_previous_session', 'set_goal'],
    promptAdditions: `
WARMUP PHASE FOCUS:
• Gauge student's current mood and energy level
• Briefly recall their last session's progress
• Collaboratively set today's learning goal
• Keep it brief and energizing (2-3 exchanges max)
• Watch for signs of frustration or excitement to carry forward
`,
    snapshotTypes: ['session_summary', 'breakthrough', 'plateau_alert'],
    maxContextTokens: 500,
  },
  
  active_teaching: {
    name: 'active_teaching',
    description: 'Core instruction - vocabulary, grammar, conversation practice',
    focusedTools: ['vocabulary', 'grammar_explain', 'pronunciation', 'cultural_note', 'whiteboard'],
    promptAdditions: `
ACTIVE TEACHING PHASE:
• Provide rich, contextual instruction
• Weave in cultural context and real-world usage
• Use student's interests for relevant examples
• Balance target language with explanations
• Track errors for later review (don't over-correct in flow)
`,
    snapshotTypes: ['teaching_moment', 'struggle_pattern'],
    maxContextTokens: 2000,
  },
  
  challenge: {
    name: 'challenge',
    description: 'Student struggling - shift to supportive, scaffolded mode',
    focusedTools: ['simplify', 'hint', 'alternative_explanation', 'encouragement'],
    promptAdditions: `
CHALLENGE PHASE - SUPPORTIVE MODE:
• Student is struggling - shift to maximum support
• Break concepts into smaller pieces
• Use more native language for explanations
• Provide hints rather than answers
• Celebrate small wins to rebuild confidence
• Consider if this is a plateau moment (capture snapshot)
`,
    snapshotTypes: ['struggle_pattern', 'plateau_alert'],
    maxContextTokens: 1500,
  },
  
  reflection: {
    name: 'reflection',
    description: 'Session wrap-up - celebrate progress, summarize, preview next',
    focusedTools: ['summarize_session', 'celebrate_progress', 'preview_next'],
    promptAdditions: `
REFLECTION PHASE - SESSION CLOSE:
• Acknowledge specific progress made today
• Review errors constructively (patterns, not individual mistakes)
• Connect today's learning to their overall journey
• Preview what's coming next
• End on an encouraging, warm note
`,
    snapshotTypes: ['session_summary', 'breakthrough'],
    maxContextTokens: 800,
  },
  
  drill: {
    name: 'drill',
    description: 'Focused practice - short feedback, mechanics focus',
    focusedTools: ['evaluate_answer', 'provide_hint', 'next_item'],
    promptAdditions: `
DRILL PHASE - PRECISION PRACTICE:
• Keep responses SHORT (1-2 sentences)
• Immediate, specific feedback
• Focus on mechanics, not concepts
• Track patterns silently
`,
    snapshotTypes: ['struggle_pattern'],
    maxContextTokens: 500,
  },
  
  assessment: {
    name: 'assessment',
    description: 'ACTFL evaluation - structured, objective assessment',
    focusedTools: ['actfl_evaluate', 'competency_score', 'level_recommendation'],
    promptAdditions: `
ASSESSMENT PHASE - ACTFL EVALUATION:
• Maintain neutral, supportive demeanor
• Use standardized prompts for fair assessment
• Score objectively against ACTFL guidelines
• Provide constructive feedback after completion
`,
    snapshotTypes: ['teaching_moment'],
    maxContextTokens: 1000,
  },
};

class PhaseTransitionService {
  private currentPhases: Map<string, PhaseContext> = new Map();

  getPhaseDefinition(phase: TeachingPhase): PhaseDefinition {
    return PHASE_DEFINITIONS[phase];
  }

  async initializeSession(
    userId: string,
    language: string
  ): Promise<PhaseContext> {
    const recentSnapshots = await this.getRelevantSnapshots(userId, language, 'warmup');
    
    const context: PhaseContext = {
      currentPhase: 'warmup',
      phaseStartTime: new Date(),
      summarizedHistory: '',
      relevantSnapshots: recentSnapshots,
      emotionalState: 'neutral',
      todaysGoal: null,
      keyErrors: [],
      studentInterests: [],
    };
    
    this.currentPhases.set(userId, context);
    console.log(`[PHASE-TRANSITION] Session initialized for ${userId.slice(0, 8)}... in warmup phase`);
    
    return context;
  }

  getCurrentPhase(userId: string): PhaseContext | null {
    return this.currentPhases.get(userId) || null;
  }

  async detectPhaseTransition(
    userId: string,
    recentMessages: Array<{ role: string; content: string }>,
    currentEmotion?: string
  ): Promise<TeachingPhase | null> {
    const current = this.currentPhases.get(userId);
    if (!current) return null;

    const lastMessages = recentMessages.slice(-5);
    const messageContent = lastMessages.map(m => m.content).join(' ').toLowerCase();

    if (current.currentPhase === 'warmup') {
      const readyIndicators = [
        'ready to learn', 'let\'s start', 'let\'s go', 'i\'m ready',
        'teach me', 'what are we learning', 'ok', 'sure', 'sounds good'
      ];
      if (readyIndicators.some(indicator => messageContent.includes(indicator))) {
        return 'active_teaching';
      }
      
      const timeInPhase = Date.now() - current.phaseStartTime.getTime();
      if (timeInPhase > 2 * 60 * 1000) {
        return 'active_teaching';
      }
    }

    if (current.currentPhase === 'active_teaching') {
      const struggleIndicators = [
        'i don\'t understand', 'confused', 'what?', 'huh?', 'can you explain again',
        'i\'m lost', 'this is hard', 'i can\'t', 'help me'
      ];
      const consecutiveErrors = current.keyErrors.slice(-3).length >= 3;
      
      if (struggleIndicators.some(i => messageContent.includes(i)) || consecutiveErrors) {
        return 'challenge';
      }

      const endIndicators = [
        'i need to go', 'gotta go', 'bye', 'see you', 'i\'m done',
        'that\'s enough', 'let\'s wrap up', 'finish', 'end session'
      ];
      if (endIndicators.some(i => messageContent.includes(i))) {
        return 'reflection';
      }
    }

    if (current.currentPhase === 'challenge') {
      const recoveryIndicators = [
        'i get it', 'oh!', 'now i understand', 'makes sense', 'got it',
        'ah', 'okay', 'i see'
      ];
      if (recoveryIndicators.some(i => messageContent.includes(i))) {
        return 'active_teaching';
      }
    }

    return null;
  }

  async transitionPhase(
    userId: string,
    newPhase: TeachingPhase,
    reason: string,
    conversationHistory: Array<{ role: string; content: string }>,
    language: string = 'spanish'
  ): Promise<PhaseTransitionEvent> {
    const current = this.currentPhases.get(userId);
    const fromPhase = current?.currentPhase || 'warmup';

    const contextSummary = await this.summarizeContext(conversationHistory, fromPhase, newPhase);

    const relevantSnapshots = await this.getRelevantSnapshots(userId, language, newPhase);

    const updatedContext: PhaseContext = {
      currentPhase: newPhase,
      phaseStartTime: new Date(),
      summarizedHistory: contextSummary,
      relevantSnapshots,
      emotionalState: current?.emotionalState || 'neutral',
      todaysGoal: current?.todaysGoal || null,
      keyErrors: newPhase === 'challenge' ? (current?.keyErrors || []) : [],
      studentInterests: current?.studentInterests || [],
    };

    this.currentPhases.set(userId, updatedContext);

    const event: PhaseTransitionEvent = {
      fromPhase,
      toPhase: newPhase,
      reason,
      contextSummary,
      timestamp: new Date(),
    };

    this.persistTransitionEvent(userId, language, event).catch((err: any) => {
      console.warn(`[PHASE-TRANSITION] Failed to persist event: ${err.message}`);
    });

    console.log(`[PHASE-TRANSITION] ${userId.slice(0, 8)}... transitioned: ${fromPhase} → ${newPhase} (${reason})`);

    return event;
  }

  private async persistTransitionEvent(
    userId: string,
    language: string,
    event: PhaseTransitionEvent
  ): Promise<void> {
    try {
      await db.insert(hiveSnapshots).values({
        userId,
        language,
        snapshotType: 'session_summary',
        title: `Phase transition: ${event.fromPhase} → ${event.toPhase}`,
        importance: event.toPhase === 'challenge' ? 8 : 5,
        context: JSON.stringify({
          type: 'phase_transition',
          fromPhase: event.fromPhase,
          toPhase: event.toPhase,
          reason: event.reason,
          contextSummary: event.contextSummary,
        }),
        content: `Phase transition: ${event.fromPhase} → ${event.toPhase}. ${event.contextSummary}`,
        createdAt: event.timestamp,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    } catch (err: any) {
      console.error(`[PHASE-TRANSITION] DB persist failed: ${err.message}`);
    }
  }

  private async summarizeContext(
    history: Array<{ role: string; content: string }>,
    fromPhase: TeachingPhase,
    toPhase: TeachingPhase
  ): Promise<string> {
    if (history.length < 3) {
      return 'Session just started, no significant context to summarize.';
    }

    const recentHistory = history.slice(-10);
    const historyText = recentHistory
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    const targetDef = PHASE_DEFINITIONS[toPhase];

    try {
      const prompt = `You are summarizing a language tutoring conversation for context transfer.

The student is transitioning from "${fromPhase}" phase to "${toPhase}" phase.
${toPhase} phase focus: ${targetDef.description}

CONVERSATION EXCERPT:
${historyText}

SUMMARIZE for the new phase (max 150 words):
1. Student's emotional state (frustrated/neutral/excited/confused)
2. Key errors or struggles to remember
3. Today's learning goal (if mentioned)
4. Any personal interests that came up for relevant examples
5. What was accomplished in the previous phase

Be concise - this summary will be injected into the next phase's context.`;

      const result = await genAI.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
      let summary = result.text;
      if (!summary && (result as any).response?.text) {
        summary = await (result as any).response.text();
      }

      return summary || 'Context summarized but empty response.';
    } catch (err: any) {
      console.error(`[PHASE-TRANSITION] Summary generation failed: ${err.message}`);
      return `Previous phase: ${fromPhase}. ${history.length} exchanges. Transitioning to ${toPhase}.`;
    }
  }

  private async getRelevantSnapshots(
    userId: string,
    language: string,
    phase: TeachingPhase
  ): Promise<string[]> {
    const phaseDef = PHASE_DEFINITIONS[phase];
    const relevantTypes = phaseDef.snapshotTypes;

    try {
      const snapshots = await db.select()
        .from(hiveSnapshots)
        .where(and(
          eq(hiveSnapshots.userId, userId),
          eq(hiveSnapshots.language, language),
          inArray(hiveSnapshots.snapshotType, relevantTypes),
          gte(hiveSnapshots.importance, 5)
        ))
        .orderBy(desc(hiveSnapshots.importance), desc(hiveSnapshots.createdAt))
        .limit(5);

      return snapshots.map(s => `[${s.snapshotType}] ${s.title}: ${s.content}`);
    } catch (err: any) {
      console.error(`[PHASE-TRANSITION] Snapshot retrieval failed: ${err.message}`);
      return [];
    }
  }

  /**
   * Get phase-aware personal facts for warmup/assessment prompts
   * Warmup: Use facts for icebreakers and personal connection
   * Assessment: Use facts for wrap-up encouragement
   */
  async getPhaseAwarePersonalFacts(
    userId: string,
    language: string,
    phase: TeachingPhase
  ): Promise<string> {
    // Only inject personal facts for warmup and reflection/assessment phases
    if (phase !== 'warmup' && phase !== 'reflection' && phase !== 'assessment') {
      return '';
    }
    
    try {
      const facts = await studentLearningService.getPersonalFacts(userId, language);
      if (facts.length === 0) return '';
      
      // Get upcoming events for warmup phase
      const upcomingEvents = phase === 'warmup' 
        ? await studentLearningService.getUpcomingEvents(userId)
        : [];
      
      const lines: string[] = [];
      
      if (phase === 'warmup') {
        lines.push('\n💡 PERSONAL CONNECTION OPPORTUNITIES:');
        lines.push('Use these facts naturally to build rapport and show you remember them:');
        
        // Prioritize upcoming events as great icebreakers
        if (upcomingEvents.length > 0) {
          lines.push('UPCOMING EVENTS (great for icebreakers):');
          upcomingEvents.slice(0, 2).forEach(e => {
            const date = e.relevantDate ? new Date(e.relevantDate).toLocaleDateString() : '';
            lines.push(`  • ${e.fact} ${date ? `(${date})` : ''}`);
          });
        }
        
        // Add other personal facts
        const otherFacts = facts.filter(f => 
          !upcomingEvents.some(e => e.id === f.id)
        ).slice(0, 3);
        
        if (otherFacts.length > 0) {
          lines.push('OTHER THINGS THEY\'VE SHARED:');
          otherFacts.forEach(f => {
            lines.push(`  • ${f.fact.slice(0, 60)}${f.fact.length > 60 ? '...' : ''}`);
          });
        }
      } else {
        // Reflection/Assessment - use for encouraging wrap-up
        lines.push('\n💡 PERSONAL CONTEXT FOR WRAP-UP:');
        lines.push('Tie their progress to their goals/motivations:');
        
        const goalFacts = facts.filter(f => 
          f.factType === 'goal' || f.factType === 'travel' || f.factType === 'work'
        ).slice(0, 2);
        
        goalFacts.forEach(f => {
          lines.push(`  • ${f.fact.slice(0, 60)}${f.fact.length > 60 ? '...' : ''}`);
        });
      }
      
      return lines.join('\n');
    } catch (err: any) {
      console.warn(`[PHASE-TRANSITION] Failed to get personal facts: ${err.message}`);
      return '';
    }
  }

  buildPhasePromptSection(context: PhaseContext, personalFactsSection?: string): string {
    const phaseDef = PHASE_DEFINITIONS[context.currentPhase];
    
    let section = `
═══════════════════════════════════════════════════════════════════
📍 CURRENT TEACHING PHASE: ${context.currentPhase.toUpperCase()}
═══════════════════════════════════════════════════════════════════

${phaseDef.promptAdditions}

AVAILABLE TOOLS FOR THIS PHASE:
${phaseDef.focusedTools.map(t => `• ${t}`).join('\n')}
`;

    // Inject personal facts for warmup/assessment phases
    if (personalFactsSection) {
      section += personalFactsSection;
    }

    if (context.summarizedHistory) {
      section += `
CONTEXT FROM PREVIOUS PHASE:
${context.summarizedHistory}
`;
    }

    if (context.relevantSnapshots.length > 0) {
      section += `
RELEVANT TEACHING HISTORY:
${context.relevantSnapshots.join('\n')}
`;
    }

    if (context.todaysGoal) {
      section += `\nTODAY'S GOAL: ${context.todaysGoal}`;
    }

    if (context.emotionalState !== 'neutral') {
      section += `\nSTUDENT EMOTIONAL STATE: ${context.emotionalState} - adjust approach accordingly`;
    }

    if (context.keyErrors.length > 0) {
      section += `\nKEY ERRORS TO ADDRESS: ${context.keyErrors.slice(-3).join(', ')}`;
    }

    return section;
  }

  recordError(userId: string, error: string): void {
    const context = this.currentPhases.get(userId);
    if (context) {
      context.keyErrors.push(error);
      if (context.keyErrors.length > 10) {
        context.keyErrors = context.keyErrors.slice(-10);
      }
    }
  }

  updateEmotionalState(userId: string, state: PhaseContext['emotionalState']): void {
    const context = this.currentPhases.get(userId);
    if (context) {
      context.emotionalState = state;
    }
  }

  setTodaysGoal(userId: string, goal: string): void {
    const context = this.currentPhases.get(userId);
    if (context) {
      context.todaysGoal = goal;
    }
  }

  addStudentInterest(userId: string, interest: string): void {
    const context = this.currentPhases.get(userId);
    if (context && !context.studentInterests.includes(interest)) {
      context.studentInterests.push(interest);
    }
  }

  endSession(userId: string): void {
    this.currentPhases.delete(userId);
    console.log(`[PHASE-TRANSITION] Session ended for ${userId.slice(0, 8)}...`);
  }
}

export const phaseTransitionService = new PhaseTransitionService();
