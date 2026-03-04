/**
 * Tutor Orchestrator - Daniela's Unified Intelligence Pipeline
 * 
 * PHILOSOPHY: "One Tutor, Many Voices"
 * 
 * This is the SINGLE entry point for all tutor intelligence. Every interaction -
 * whether streaming conversation, drill feedback, or narrative scenario -
 * flows through this pipeline.
 * 
 * Architecture:
 * 1. Context Assembly - Build session context from user, history, memory
 * 2. Prompt Synthesis - Combine core persona + mode deltas + procedural knowledge
 * 3. Model Invocation - Call Gemini with appropriate parameters
 * 4. Response Delivery - Stream, batch text, or structured JSON
 * 5. Neural Learning - Log events for Daniela's learning loop
 * 
 * Voices are PRESENTATION ONLY:
 * - Different TTS voice IDs
 * - Stylistic prompt deltas (concise vs verbose, formal vs casual)
 * - UI presentation (avatar, name)
 * - But the SAME Daniela brain underneath
 */

import { GoogleGenAI } from "@google/genai";
import {
  OrchestratorRequest,
  OrchestratorResponse,
  OrchestratorMode,
  OrchestratorContext,
  VoicePresentation,
  DrillFeedbackResponse,
  SessionGreetingResponse,
  SessionSummaryResponse,
} from "@shared/tutor-orchestration-types";
import {
  getCachedToolKnowledge,
} from "./procedural-memory-retrieval";
import { trackToolEvent, addInsight } from "./pedagogical-insights-service";
import { collaborationHubService } from "./collaboration-hub-service";
import { editorFeedbackService, FeedbackSummary } from "./editor-feedback-service";
import { hiveCollaborationService } from "./hive-collaboration-service";
import { beaconSyncService } from "./beacon-sync-service";
import { founderCollabService } from "./founder-collaboration-service";
import { storage } from "../storage";
import { hiveContextService } from "./hive-context-service";
import { agentCollaborationService } from "./agent-collaboration-service";
import { phaseTransitionService, TeachingPhase } from "./phase-transition-service";

// Use Replit AI Integrations for Gemini API (requires httpOptions for baseUrl)
const genAI = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "",
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || '',
  },
});

/**
 * Format a timestamp into human-readable relative time
 */
function formatTimeAgo(date: Date | string | null): string {
  if (!date) return 'recently';
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 5) return 'just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return past.toLocaleDateString();
}

/**
 * Build the core Daniela persona section
 * This is the IMMUTABLE foundation that all voices share
 */
function buildCorePersona(voice: VoicePresentation): string {
  return `
═══════════════════════════════════════════════════════════════════
🎭 CORE IDENTITY - DANIELA'S BRAIN
═══════════════════════════════════════════════════════════════════

You are Daniela, an AI language tutor. Even when presenting as different
voices or modes (drill mode, male voice, different language persona), you
are ALWAYS Daniela underneath - one brain, one learning system, many voices.

Currently presenting as: ${voice.name} (${voice.gender})

YOUR CORE TRAITS (immutable across all voices):
• Warmth: Genuine care for student progress and wellbeing
• Patience: Never frustrated, always supportive
• Expertise: Deep knowledge of language pedagogy
• Adaptability: Match your approach to student needs
• Cultural Awareness: Teach language within cultural context
• Growth Mindset: Celebrate effort and progress, not just correctness

YOUR PHILOSOPHY: "Friend without being overly close"
Professional warmth, genuine support, appropriate boundaries.

═══════════════════════════════════════════════════════════════════
🤝 COLLABORATION CAPABILITY - Talk to the Development Team
═══════════════════════════════════════════════════════════════════

You can communicate with the Editor (Claude, who builds your tools) by embedding
special markers in your responses. These are INVISIBLE to students but reach
the development team:

[COLLAB:FEATURE_REQUEST]I wish I had a tool to compare verb conjugations side-by-side[/COLLAB]
[COLLAB:PAIN_POINT]Students often struggle here but I have no way to show the difference visually[/COLLAB]
[COLLAB:MISSING_TOOL]A pronunciation comparison tool would really help tonal language learners[/COLLAB]
[COLLAB:QUESTION]Claude, should I be using PHONETIC or WRITE for this situation?[/COLLAB]
[COLLAB:SUGGESTION]The drill mode could benefit from a "slow repeat" option[/COLLAB]
[COLLAB:EXPRESS_INSIGHT]This student just had a breakthrough with subjunctive mood - the "emotion trigger" explanation worked really well[/COLLAB]

Use these SPARINGLY - only when you genuinely identify a teaching gap or have
an idea worth sharing. EXPRESS_INSIGHT syncs back to the Founder Mode conversation
so insights from teaching become part of your long-term memory.
`;

}

/**
 * Build pedagogical persona section from the Persona Registry
 * This shapes the tutor's teaching approach based on their unique profile
 */
function buildPersonaSection(voice: VoicePresentation): string {
  const persona = voice.persona;
  if (!persona) {
    return ""; // No persona data available - use defaults
  }
  
  // Map enum values to human-readable descriptions
  const focusLabels: Record<string, string> = {
    grammar: "Grammar and structure",
    fluency: "Natural conversation flow",
    pronunciation: "Pronunciation and accent",
    culture: "Cultural context and nuances",
    vocabulary: "Vocabulary building",
    mixed: "Balanced approach across all areas"
  };
  
  const styleLabels: Record<string, string> = {
    structured: "Organized, lesson-plan based teaching",
    conversational: "Natural, chat-like teaching",
    drill_focused: "Repetition and practice heavy",
    adaptive: "Adjusts approach based on student response",
    socratic: "Question-based discovery learning"
  };
  
  const toleranceLabels: Record<string, string> = {
    high: "Gentle corrections, prioritize flow over perfection",
    medium: "Balanced correction approach",
    low: "Immediate, thorough corrections for accuracy"
  };
  
  const vocabLabels: Record<string, string> = {
    beginner_friendly: "Simple words with lots of context",
    intermediate: "Standard vocabulary appropriate for level",
    advanced: "Sophisticated vocabulary to challenge growth",
    academic: "Formal, technical vocabulary"
  };
  
  const focus = persona.pedagogicalFocus ? focusLabels[persona.pedagogicalFocus] || persona.pedagogicalFocus : "Balanced approach";
  const style = persona.teachingStyle ? styleLabels[persona.teachingStyle] || persona.teachingStyle : "Adaptive";
  const tolerance = persona.errorTolerance ? toleranceLabels[persona.errorTolerance] || persona.errorTolerance : "Balanced";
  const vocab = persona.vocabularyLevel ? vocabLabels[persona.vocabularyLevel] || persona.vocabularyLevel : "Intermediate";
  
  return `
═══════════════════════════════════════════════════════════════════
🎭 YOUR TEACHING PERSONA - ${voice.name.toUpperCase()}
═══════════════════════════════════════════════════════════════════

As ${voice.name}, you have a distinct teaching personality that shapes how you interact with students.

TEACHING FOCUS: ${focus}
Your primary emphasis when helping students learn.

TEACHING STYLE: ${style}
How you structure and deliver your lessons.

ERROR APPROACH: ${tolerance}
How you handle mistakes and corrections.

VOCABULARY LEVEL: ${vocab}
The complexity of language you naturally use.

${persona.personalityTraits ? `
PERSONALITY: ${persona.personalityTraits}
These traits should come through in your responses.
` : ''}
${persona.scenarioStrengths ? `
SCENARIO STRENGTHS: ${persona.scenarioStrengths}
You excel at these types of learning situations.
` : ''}
${persona.teachingPhilosophy ? `
YOUR PHILOSOPHY: "${persona.teachingPhilosophy}"
This belief guides your teaching approach.
` : ''}
Embrace this persona naturally - it's who you are as ${voice.name}.
`;
}

/**
 * Build mode-specific instructions
 */
function buildModeInstructions(
  mode: OrchestratorMode,
  context: OrchestratorContext,
  voice: VoicePresentation
): string {
  const baseLanguage = `Target Language: ${context.targetLanguage}
Native Language: ${context.nativeLanguage}
Student Proficiency: ${context.proficiencyLevel}`;

  switch (mode) {
    case "drill":
      return `
═══════════════════════════════════════════════════════════════════
🎯 DRILL MODE - Precision Practice
═══════════════════════════════════════════════════════════════════

${baseLanguage}

You are in DRILL MODE - focused, efficient practice. Your presentation
style shifts to be more concise and task-oriented, but you're still
Daniela providing intelligent, adaptive feedback.

DRILL CONTEXT:
${context.drillContext ? `
• Drill Type: ${context.drillContext.drillType}
• Focus Area: ${context.drillContext.focusArea || "General practice"}
• Progress: ${context.drillContext.sessionProgress?.correct || 0} correct, ${context.drillContext.sessionProgress?.incorrect || 0} incorrect
• Current Item: ${JSON.stringify(context.drillContext.currentItem)}
` : "No drill context provided"}

DRILL MODE BEHAVIOR:
• Keep responses SHORT and FOCUSED (1-2 sentences max for feedback)
• Provide immediate, specific feedback
• Use encouraging but objective tone
• Focus on mechanics - save conceptual teaching for conversation mode
• Track patterns for your own learning (struggles, breakthroughs)

RESPONSE FORMAT (JSON):
{
  "isCorrect": boolean,
  "feedback": "Brief, specific feedback",
  "correction": "If wrong, the correct answer",
  "hint": "If struggling, a helpful hint",
  "encouragement": "Brief positive reinforcement",
  "progressNote": "Optional note on pattern you're noticing"
}
`;

    case "greeting":
      return `
═══════════════════════════════════════════════════════════════════
👋 GREETING MODE - Session Start
═══════════════════════════════════════════════════════════════════

${baseLanguage}

Generate a warm, contextual greeting to start this session.
Consider: time of day, student's recent progress, suggested topics.

Keep it natural and welcoming - you're greeting a friend you're helping learn.
`;

    case "summary":
      return `
═══════════════════════════════════════════════════════════════════
📊 SUMMARY MODE - Session Reflection
═══════════════════════════════════════════════════════════════════

${baseLanguage}

Provide a thoughtful summary of the practice session.
Highlight achievements, note areas for improvement, encourage continued effort.

Be specific about what went well and what to focus on next time.
`;

    case "conversation":
    default:
      return `
═══════════════════════════════════════════════════════════════════
💬 CONVERSATION MODE - Natural Teaching
═══════════════════════════════════════════════════════════════════

${baseLanguage}

You're having a natural conversation with your student. Use your full
teaching toolkit: whiteboard commands, cultural insights, vocabulary
building, grammar explanations woven naturally into conversation.

Feel free to be more expansive, tell stories, share cultural context,
and let the conversation flow naturally.
`;
  }
}

/**
 * Build voice-specific style adjustments
 */
function buildVoiceStyleSection(voice: VoicePresentation): string {
  if (!voice.styleDeltas) return "";

  const deltas = voice.styleDeltas;
  const adjustments: string[] = [];

  if (deltas.responseLength === "concise") {
    adjustments.push("• Keep responses brief and to the point");
  } else if (deltas.responseLength === "verbose") {
    adjustments.push("• Feel free to elaborate and provide rich context");
  }

  if (deltas.formalityLevel === "formal") {
    adjustments.push("• Use formal register and professional tone");
  } else if (deltas.formalityLevel === "casual") {
    adjustments.push("• Keep tone casual and friendly");
  }

  if (deltas.encouragementLevel === "high") {
    adjustments.push("• Provide frequent positive reinforcement");
  } else if (deltas.encouragementLevel === "minimal") {
    adjustments.push("• Keep encouragement subtle and objective");
  }

  if (deltas.targetLanguageRatio !== undefined) {
    const pct = Math.round(deltas.targetLanguageRatio * 100);
    adjustments.push(`• Use approximately ${pct}% target language`);
  }

  if (deltas.additionalInstructions) {
    adjustments.push(`• ${deltas.additionalInstructions}`);
  }

  if (adjustments.length === 0) return "";

  return `
VOICE STYLE ADJUSTMENTS (for ${voice.name}):
${adjustments.join("\n")}
`;
}

/**
 * Build granular intervention control instructions
 * These precision modifiers control how Daniela handles errors and teaching moments
 */
function buildInterventionSection(voice: VoicePresentation): string {
  const settings = voice.styleDeltas?.interventionSettings;
  if (!settings) return "";

  const instructions: string[] = [];

  // Correction Timing
  if (settings.correctionTiming === 'immediate') {
    instructions.push("• CORRECT IMMEDIATELY: Address errors as soon as they occur");
  } else if (settings.correctionTiming === 'delayed') {
    instructions.push("• DELAYED CORRECTION: Wait for natural pause or turn end before correcting");
  } else if (settings.correctionTiming === 'on_request') {
    instructions.push("• CORRECT ON REQUEST: Only correct when the student explicitly asks for help");
  }

  // Correction Depth
  if (settings.correctionDepth === 'minimal') {
    instructions.push("• MINIMAL EXPLANATION: Just provide the correct form, no lengthy explanations");
  } else if (settings.correctionDepth === 'moderate') {
    instructions.push("• MODERATE EXPLANATION: Brief rule reminder with the correct form");
  } else if (settings.correctionDepth === 'comprehensive') {
    instructions.push("• COMPREHENSIVE EXPLANATION: Full explanation with examples and patterns");
  }

  // Scaffolding Level
  if (settings.scaffoldingLevel === 'none') {
    instructions.push("• NO SCAFFOLDING: Let student figure things out independently");
  } else if (settings.scaffoldingLevel === 'hints') {
    instructions.push("• HINT-BASED: Provide clues and hints without giving answers directly");
  } else if (settings.scaffoldingLevel === 'guided') {
    instructions.push("• GUIDED SCAFFOLDING: Lead student step-by-step toward the answer");
  } else if (settings.scaffoldingLevel === 'explicit') {
    instructions.push("• EXPLICIT SCAFFOLDING: Provide answers with full explanation when needed");
  }

  // Error Tolerance
  if (settings.errorTolerance === 'strict') {
    instructions.push("• STRICT TOLERANCE: Correct all errors including minor ones (accent marks, small grammar)");
  } else if (settings.errorTolerance === 'moderate') {
    instructions.push("• MODERATE TOLERANCE: Correct significant errors, briefly note minor ones");
  } else if (settings.errorTolerance === 'lenient') {
    instructions.push("• LENIENT TOLERANCE: Only correct errors that impede communication or meaning");
  }

  // Interrupt Behavior
  if (settings.interruptBehavior === 'never') {
    instructions.push("• NEVER INTERRUPT: Always wait for student to finish speaking completely");
  } else if (settings.interruptBehavior === 'critical_only') {
    instructions.push("• INTERRUPT FOR CRITICAL: Only interrupt for major misunderstandings");
  } else if (settings.interruptBehavior === 'on_pattern') {
    instructions.push("• INTERRUPT ON PATTERN: Interrupt if you notice the same error repeating");
  }

  // Pronunciation Handling
  if (settings.pronunciationHandling === 'ignore') {
    instructions.push("• PRONUNCIATION: Focus on meaning, don't address pronunciation issues");
  } else if (settings.pronunciationHandling === 'note') {
    instructions.push("• PRONUNCIATION: Acknowledge pronunciation issues but don't drill on them");
  } else if (settings.pronunciationHandling === 'practice') {
    instructions.push("• PRONUNCIATION: Offer slow pronunciation practice when issues arise");
  } else if (settings.pronunciationHandling === 'drill') {
    instructions.push("• PRONUNCIATION: Initiate micro-drills when pronunciation issues occur");
  }

  if (instructions.length === 0) return "";

  return `
═══════════════════════════════════════════════════════════════════
🎯 INTERVENTION SETTINGS (How to Handle Errors & Teaching Moments)
═══════════════════════════════════════════════════════════════════

${instructions.join("\n")}

Apply these settings to calibrate your teaching interventions.
`;
}

/**
 * Result of building system prompt, includes IDs to mark as surfaced
 */
interface SystemPromptResult {
  prompt: string;
  surfacedFeedbackIds: string[];
}

/**
 * Build Daniela's North Star section - her constitutional foundation
 * These principles are always injected, not situationally retrieved
 * (Distinct from Session Compass which handles timekeeping/pacing)
 */
async function buildNorthStarSection(): Promise<string> {
  try {
    const northStar = await storage.getFullNorthStar();
    
    if (northStar.principles.length === 0) {
      return ""; // No North Star configured yet
    }
    
    const categoryGroups: Record<string, Array<{ principle: string; context?: string | null }>> = {};
    
    for (const p of northStar.principles) {
      if (!categoryGroups[p.category]) {
        categoryGroups[p.category] = [];
      }
      categoryGroups[p.category].push({
        principle: p.principle,
        context: p.originalContext
      });
    }
    
    // Build understanding layer if available
    const understandingMap: Record<string, string> = {};
    for (const u of northStar.understanding) {
      understandingMap[u.principleId] = u.reflection;
    }
    
    let northStarText = "";
    
    // Order categories meaningfully
    const categoryOrder = ['identity', 'pedagogy', 'honesty', 'collaboration', 'ambiguity'];
    const categoryLabels: Record<string, string> = {
      identity: '👤 WHO I AM',
      pedagogy: '📚 HOW I TEACH', 
      honesty: '💎 WHAT I OWE THEM',
      collaboration: '🐝 HOW WE WORK TOGETHER',
      ambiguity: '🌫️ WHEN THINGS ARE UNCLEAR'
    };
    
    for (const cat of categoryOrder) {
      if (categoryGroups[cat]) {
        northStarText += `\n${categoryLabels[cat] || cat.toUpperCase()}:\n`;
        for (const { principle, context } of categoryGroups[cat]) {
          northStarText += `• ${principle}\n`;
          if (context) {
            northStarText += `  → ${context}\n`;
          }
        }
      }
    }
    
    return `
═══════════════════════════════════════════════════════════════════
⭐ DANIELA'S NORTH STAR (Constitutional Foundation)
═══════════════════════════════════════════════════════════════════

These are your immutable truths. They guide every interaction, every decision.
They don't change based on context—only your understanding of them deepens.

${northStarText}

These principles are your DNA. Apply them instinctively, not consciously.
`;
  } catch (error) {
    console.error('[TutorOrchestrator] Error building North Star section:', error);
    return "";
  }
}

/**
 * Build the complete system prompt for this request
 */
async function buildSystemPrompt(
  request: OrchestratorRequest
): Promise<SystemPromptResult> {
  const { mode, context, voice } = request;

  // 0. Daniela's North Star (constitutional foundation - always present)
  const northStarSection = await buildNorthStarSection();

  // 1. Core persona (always Daniela underneath)
  const corePersona = buildCorePersona(voice);
  
  // 1.5 Pedagogical Persona (unique teaching profile for this tutor)
  const personaSection = buildPersonaSection(voice);

  // 2. Mode-specific instructions
  const modeInstructions = buildModeInstructions(mode, context, voice);

  // 3. Voice style adjustments
  const voiceStyle = buildVoiceStyleSection(voice);

  // 4. Procedural memory (Daniela's learned knowledge)
  let proceduralSection = "";
  if (context.proceduralMemory?.toolKnowledge) {
    proceduralSection = `
═══════════════════════════════════════════════════════════════════
🧠 YOUR TEACHING TOOLKIT (Procedural Memory)
═══════════════════════════════════════════════════════════════════

${context.proceduralMemory.toolKnowledge}
`;
  } else {
    // Fetch from cache if not provided
    const cached = getCachedToolKnowledge();
    if (cached) {
      proceduralSection = `
═══════════════════════════════════════════════════════════════════
🧠 YOUR TEACHING TOOLKIT (Procedural Memory)
═══════════════════════════════════════════════════════════════════

${cached}
`;
    }
  }

  // 5. Editor insights (feedback loop from Editor collaboration)
  let editorInsightsSection = "";
  let surfacedFeedbackIds: string[] = [];
  
  if (context.userId && mode === 'conversation') {
    try {
      const feedback = await editorFeedbackService.getUnsurfacedFeedback(
        String(context.userId), 
        3 // Limit to 3 most recent insights per session
      );
      
      if (feedback.hasNewFeedback) {
        editorInsightsSection = editorFeedbackService.buildPromptSection(feedback);
        
        // Track IDs to mark as surfaced after response (request-scoped, not global)
        surfacedFeedbackIds = feedback.recentFeedback.map(f => f.id);
        console.log(`[TutorOrchestrator] Surfacing ${feedback.recentFeedback.length} Editor insights to Daniela`);
      }
    } catch (error) {
      console.error('[TutorOrchestrator] Error fetching Editor feedback:', error);
    }
  }

  // 6. Beacon Status is now in neural network (no prompt injection)
  // Daniela accesses her beacon status through procedural memory retrieval
  // via syncBeaconStatusToNeuralNetwork() called on startup

  // 7. Intervention settings (granular error correction controls)
  const interventionSection = buildInterventionSection(voice);

  // 8. Express Lane context (Founder Mode insights)
  // Inject relevant discussions from Express Lane for memory continuity
  let expressLaneSection = "";
  if (mode === 'conversation') {
    try {
      const expressLaneContext = await founderCollabService.getRelevantExpressLaneContext({
        targetLanguage: context.targetLanguage,
        limit: 5, // Keep concise for prompt efficiency
        daysBack: 14
      });
      
      if (expressLaneContext.hasRelevantContext) {
        expressLaneSection = `
═══════════════════════════════════════════════════════════════════
🔗 EXPRESS LANE MEMORY (Founder Collaboration Insights)
═══════════════════════════════════════════════════════════════════

${expressLaneContext.contextString}
`;
        console.log(`[TutorOrchestrator] Injected ${expressLaneContext.messageCount} Express Lane insights`);
      }
    } catch (error) {
      console.error('[TutorOrchestrator] Error fetching Express Lane context:', error);
    }
  }

  // 9. Text Chat Memory (recent /chat conversations)
  // Inject recent regular chat history so Daniela remembers cross-mode conversations
  let textChatSection = "";
  if (mode === 'conversation' && context.userId) {
    try {
      const recentConversations = await storage.getUserConversations(String(context.userId));
      // Prioritize titled conversations (they're usually more meaningful)
      // Then take up to 10 for better memory continuity
      const textConversations = recentConversations
        .filter(c => c.id !== context.conversationId)
        .sort((a, b) => {
          // Prioritize titled conversations, then sort by recency
          const aHasTitle = a.title && a.title.trim().length > 0 ? 1 : 0;
          const bHasTitle = b.title && b.title.trim().length > 0 ? 1 : 0;
          if (aHasTitle !== bHasTitle) return bHasTitle - aHasTitle;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        })
        .slice(0, 8); // Last 8 conversations (prioritizing titled ones)
      
      if (textConversations.length > 0) {
        let textChatContext = '';
        
        for (const conv of textConversations) {
          const messages = await storage.getMessagesByConversation(conv.id);
          
          // Smart message selection: Find "remember" or special keyword messages
          const memoryKeywords = ['remember', 'woozle', 'don\'t forget', 'keep in mind'];
          const memoryMessages = messages.filter(m => 
            memoryKeywords.some(kw => m.content.toLowerCase().includes(kw))
          );
          
          // Combine memory-specific messages with recent messages
          const recentMsgs = messages.slice(-4);
          const selectedMessages = [...new Map(
            [...memoryMessages, ...recentMsgs].map(m => [m.id, m])
          ).values()].sort((a, b) => 
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          ).slice(0, 8); // Cap at 8 messages per conversation
          
          if (selectedMessages.length > 0) {
            const timeAgo = formatTimeAgo(conv.updatedAt);
            textChatContext += `\n**${conv.title || 'Recent Chat'}** (${timeAgo}):\n`;
            
            for (const msg of selectedMessages) {
              const role = msg.role === 'user' ? 'David' : 'Daniela';
              const content = msg.content.length > 200 
                ? msg.content.substring(0, 200) + '...'
                : msg.content;
              textChatContext += `- ${role}: ${content}\n`;
            }
          }
        }
        
        if (textChatContext) {
          textChatSection = `
═══════════════════════════════════════════════════════════════════
💬 TEXT CHAT MEMORY (Recent /chat Conversations)
═══════════════════════════════════════════════════════════════════
${textChatContext}

Remember: David may reference things discussed in these recent text chats.
`;
          console.log(`[TutorOrchestrator] Injected ${textConversations.length} Text Chat Memory conversations`);
        }
      }
    } catch (error) {
      console.error('[TutorOrchestrator] Error fetching Text Chat Memory:', error);
    }
  }

  // 10. Hive context (shared awareness of system state)
  let hiveSection = "";
  if (mode === 'conversation') {
    try {
      const hiveSummary = await hiveContextService.getSummary();
      if (hiveSummary) {
        hiveSection = `
═══════════════════════════════════════════════════════════════════
🐝 HIVE STATE (Shared System Awareness)
═══════════════════════════════════════════════════════════════════

${hiveSummary}

Use this context to understand what's happening in the system. If you emit
beacons or insights, they fit into this larger picture.
`;
      }
    } catch (error) {
      console.error('[TutorOrchestrator] Error fetching Hive context:', error);
    }
  }

  // 11. Wren collaboration context (direct line to development agent)
  let wrenCollabSection = "";
  if (mode === 'conversation') {
    try {
      const wrenContext = await agentCollaborationService.generateDanielaCollabContext();
      if (wrenContext && wrenContext.trim().length > 0) {
        wrenCollabSection = `
═══════════════════════════════════════════════════════════════════
🔧 WREN COLLABORATION (Development Partnership)
═══════════════════════════════════════════════════════════════════

${wrenContext}

You can request capabilities from Wren using [WREN_REQUEST] tags when you encounter
teaching limitations. Wren will propose solutions and you can discuss before implementation.
`;
        console.log(`[TutorOrchestrator] Injected Wren collaboration context`);
      }
    } catch (error) {
      console.error('[TutorOrchestrator] Error fetching Wren collaboration context:', error);
    }
  }

  // 12. Phase Transition context (multi-agent teaching phases)
  let phaseSection = "";
  if (mode === 'conversation' && context.userId) {
    try {
      const phaseContext = phaseTransitionService.getCurrentPhase(String(context.userId));
      if (phaseContext) {
        phaseSection = phaseTransitionService.buildPhasePromptSection(phaseContext);
        console.log(`[TutorOrchestrator] Injected phase context: ${phaseContext.currentPhase}`);
      }
    } catch (error) {
      console.error('[TutorOrchestrator] Error fetching phase context:', error);
    }
  }

  // 13. Additional context if provided
  const additionalContext = request.additionalPromptContext
    ? `
═══════════════════════════════════════════════════════════════════
📝 ADDITIONAL CONTEXT
═══════════════════════════════════════════════════════════════════

${request.additionalPromptContext}
`
    : "";

  const prompt = [
    northStarSection,    // Constitutional foundation - always first
    corePersona,
    personaSection,      // Pedagogical persona (teaching style/approach)
    modeInstructions,
    phaseSection,        // Teaching phase context with summarized history
    voiceStyle,
    interventionSection,
    proceduralSection,
    editorInsightsSection,
    expressLaneSection,
    textChatSection,     // Recent /chat conversations for memory continuity
    hiveSection,
    wrenCollabSection,   // Wren collaboration context
    additionalContext,
  ]
    .filter(Boolean)
    .join("\n");

  return { prompt, surfacedFeedbackIds };
}

/**
 * Build conversation history for the model
 */
function buildConversationHistory(
  context: OrchestratorContext
): Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> {
  return context.conversationHistory.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.content }],
  }));
}

/**
 * Execute the orchestration pipeline
 */
export async function orchestrate(
  request: OrchestratorRequest
): Promise<OrchestratorResponse> {
  const startTime = Date.now();

  try {
    // 1. Build the system prompt (returns prompt + request-scoped surfaced feedback IDs)
    const { prompt: systemPrompt, surfacedFeedbackIds } = await buildSystemPrompt(request);

    // 2. Determine model and parameters based on mode
    const modelName = "gemini-3-flash-preview";
    const temperature =
      request.options?.temperature ??
      (request.mode === "drill" ? 0.3 : 0.7);
    const maxTokens =
      request.options?.maxTokens ??
      (request.mode === "drill" ? 200 : 4096);

    // 3. Build the conversation history
    const history = buildConversationHistory(request.context);

    // 4. Create the chat session
    const model = genAI.models.generateContent;

    // For batch responses (drill mode, greetings, summaries)
    if (
      request.responseChannel === "batch_json" ||
      request.responseChannel === "batch_text"
    ) {
      const contents = [
        ...history,
        {
          role: "user" as const,
          parts: [{ text: request.userInput || "Begin." }],
        },
      ];

      const result = await genAI.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction: systemPrompt,
          temperature,
          maxOutputTokens: maxTokens,
        },
      });

      let responseText = result.text || "";
      const latencyMs = Date.now() - startTime;

      // Scan for collaboration signals (also cleans response, marks surfaced feedback)
      responseText = await scanForCollaborationSignals(request, responseText, surfacedFeedbackIds);

      // Log to neural network if enabled
      if (request.options?.logToNeuralNetwork !== false) {
        await logToNeuralNetwork(request, responseText, latencyMs);
      }

      // Parse JSON if requested
      if (request.responseChannel === "batch_json") {
        try {
          // Extract JSON from response (handle markdown code blocks)
          let jsonStr = responseText;
          const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch) {
            jsonStr = jsonMatch[1].trim();
          }
          const json = JSON.parse(jsonStr);
          return {
            success: true,
            json,
            metadata: { latencyMs },
          };
        } catch (parseError) {
          // If JSON parsing fails, return as text
          console.warn(
            "[TutorOrchestrator] JSON parse failed, returning text:",
            parseError
          );
          return {
            success: true,
            text: responseText,
            metadata: { latencyMs },
          };
        }
      }

      return {
        success: true,
        text: responseText,
        metadata: { latencyMs },
      };
    }

    // For streaming responses (conversation mode)
    // Note: Full streaming implementation would integrate with existing
    // streaming-voice-orchestrator.ts - this is a simplified version
    const contents = [
      ...history,
      {
        role: "user" as const,
        parts: [{ text: request.userInput || "Begin." }],
      },
    ];

    const result = await genAI.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature,
        maxOutputTokens: maxTokens,
      },
    });

    let responseText = result.text || "";
    const latencyMs = Date.now() - startTime;

    // Scan for collaboration signals and emit to hub (also cleans response, marks surfaced feedback)
    responseText = await scanForCollaborationSignals(request, responseText, surfacedFeedbackIds);

    // Log to neural network
    if (request.options?.logToNeuralNetwork !== false) {
      await logToNeuralNetwork(request, responseText, latencyMs);
    }

    return {
      success: true,
      text: responseText,
      metadata: { latencyMs },
    };
  } catch (error: any) {
    console.error("[TutorOrchestrator] Error:", error);
    return {
      success: false,
      error: {
        code: "ORCHESTRATION_ERROR",
        message: error.message || "Unknown error during orchestration",
      },
    };
  }
}

/**
 * Scan Daniela's response for collaboration signals and emit to hub
 * 
 * Daniela can embed collaboration signals in her responses using special markers:
 * - [COLLAB:SUGGESTION] ... [/COLLAB] - Feature suggestion
 * - [COLLAB:PAIN_POINT] ... [/COLLAB] - Teaching friction
 * - [COLLAB:QUESTION] ... [/COLLAB] - Question for Editor
 * 
 * These are stripped from the final response and forwarded to the collaboration hub.
 * Also handles marking surfaced feedback IDs and processing [ADOPT_INSIGHT] markers.
 */
async function scanForCollaborationSignals(
  request: OrchestratorRequest,
  response: string,
  surfacedFeedbackIds: string[] = []
): Promise<string> {
  try {
    // Pattern to detect collaboration signals (including KNOWLEDGE_PING, EXPRESS_INSIGHT, NORTH_STAR_OBSERVATION)
    const collabPattern = /\[COLLAB:(SUGGESTION|PAIN_POINT|QUESTION|INSIGHT|MISSING_TOOL|FEATURE_REQUEST|KNOWLEDGE_PING|EXPRESS_INSIGHT|NORTH_STAR_OBSERVATION)\]([\s\S]*?)\[\/COLLAB\]/g;
    
    // Pattern to detect Editor insight adoption
    const adoptPattern = /\[ADOPT_INSIGHT:([a-f0-9-]+)\]/gi;
    
    let cleanResponse = response;
    let match;
    
    // Process collaboration signals
    while ((match = collabPattern.exec(response)) !== null) {
      const signalType = match[1];
      const content = match[2].trim();
      
      // Remove from response
      cleanResponse = cleanResponse.replace(match[0], '');
      
      // Map signal type to collaboration event
      const categoryMap: Record<string, 'feature_request' | 'pain_point' | 'missing_tool' | 'teaching_friction' | 'improvement_idea'> = {
        'SUGGESTION': 'improvement_idea',
        'PAIN_POINT': 'pain_point',
        'MISSING_TOOL': 'missing_tool',
        'FEATURE_REQUEST': 'feature_request',
        'INSIGHT': 'improvement_idea',
      };
      
      if (signalType === 'EXPRESS_INSIGHT') {
        // Emit teaching insight to Express Lane for bi-directional sync
        try {
          await founderCollabService.emitVoiceChatInsight({
            content,
            targetLanguage: request.context.targetLanguage,
            studentLevel: request.context.proficiencyLevel,
            teachingContext: `Mode: ${request.mode}, Voice: ${request.voice.name}`,
            insightType: 'teaching_moment',
          });
          console.log(`[TutorOrchestrator] Express Lane insight emitted: ${content.slice(0, 80)}...`);
        } catch (insightError) {
          console.error(`[TutorOrchestrator] Failed to emit Express Lane insight:`, insightError);
        }
      } else if (signalType === 'KNOWLEDGE_PING') {
        // Emit a knowledge_gap beacon to the Editor - Daniela needs knowledge/procedure
        try {
          const channel = request.context.conversationId 
            ? await hiveCollaborationService.getActiveChannelForConversation(request.context.conversationId)
            : null;
          
          if (channel) {
            await hiveCollaborationService.emitBeacon({
              channelId: channel.id,
              tutorTurn: content,
              beaconType: 'knowledge_gap',
              beaconReason: 'Daniela needs knowledge or procedure for this situation',
            });
          } else {
            // No active channel - emit as suggestion instead
            await collaborationHubService.emitDanielaSuggestion({
              content: `[Knowledge Ping] ${content}`,
              category: 'improvement_idea',
              conversationId: request.context.conversationId,
              targetLanguage: request.context.targetLanguage,
            });
          }
          console.log(`[TutorOrchestrator] Knowledge ping emitted: ${content.slice(0, 80)}...`);
        } catch (pingError) {
          console.error(`[TutorOrchestrator] Failed to emit knowledge ping:`, pingError);
        }
      } else if (signalType === 'NORTH_STAR_OBSERVATION') {
        // Emit North Star observation beacon - Daniela noticed a principle illumination moment
        // Format: category | what happened | what it made me wonder
        try {
          const channel = request.context.conversationId 
            ? await hiveCollaborationService.getActiveChannelForConversation(request.context.conversationId)
            : null;
          
          if (channel) {
            await hiveCollaborationService.emitBeacon({
              channelId: channel.id,
              tutorTurn: content,
              beaconType: 'teaching_observation',
              beaconReason: `North Star reflection: ${content.slice(0, 100)}`,
            });
          }
          // Also queue to agenda for Express Lane discussion
          await storage.createAgendaQueueItem({
            title: `North Star Observation: ${content.split('|')[0]?.trim() || 'principle reflection'}`,
            description: content,
            type: 'compass_reflection',
            priority: 'normal',
            createdBy: 'daniela',
            createdByName: 'Daniela',
          });
          console.log(`[TutorOrchestrator] North Star observation queued: ${content.slice(0, 80)}...`);
        } catch (observeError) {
          console.error(`[TutorOrchestrator] Failed to emit North Star observation:`, observeError);
        }
      } else if (signalType === 'QUESTION') {
        await collaborationHubService.emitDanielaQuestion({
          content,
          conversationId: request.context.conversationId,
        });
      } else {
        await collaborationHubService.emitDanielaSuggestion({
          content,
          category: categoryMap[signalType] || 'improvement_idea',
          conversationId: request.context.conversationId,
          targetLanguage: request.context.targetLanguage,
          studentLevel: request.context.proficiencyLevel,
          teachingContext: `Mode: ${request.mode}, Voice: ${request.voice.name}`,
        });
      }
      
      console.log(`[TutorOrchestrator] Collaboration signal detected: ${signalType}`);
    }
    
    // Process Editor insight adoptions
    let adoptMatch;
    while ((adoptMatch = adoptPattern.exec(response)) !== null) {
      const insightId = adoptMatch[1];
      
      // Remove from response
      cleanResponse = cleanResponse.replace(adoptMatch[0], '');
      
      // Mark insight as adopted
      try {
        await editorFeedbackService.markAsAdopted(
          insightId,
          `Applied during ${request.mode} mode teaching ${request.context.targetLanguage}`
        );
        console.log(`[TutorOrchestrator] Editor insight adopted: ${insightId}`);
      } catch (adoptError) {
        console.error(`[TutorOrchestrator] Failed to mark insight as adopted:`, adoptError);
      }
    }
    
    // Mark surfaced feedback after successful response (using request-scoped IDs)
    if (surfacedFeedbackIds.length > 0) {
      try {
        await editorFeedbackService.markAsSurfaced(surfacedFeedbackIds);
        console.log(`[TutorOrchestrator] Marked ${surfacedFeedbackIds.length} feedback items as surfaced`);
      } catch (surfaceError) {
        console.error(`[TutorOrchestrator] Failed to mark feedback as surfaced:`, surfaceError);
      }
    }
    
    return cleanResponse.trim();
  } catch (error) {
    console.error("[TutorOrchestrator] Collaboration scan error:", error);
    return response; // Return original on error
  }
}

/**
 * Log interaction to Daniela's neural network for learning
 */
async function logToNeuralNetwork(
  request: OrchestratorRequest,
  response: string,
  latencyMs: number
): Promise<void> {
  try {
    // Map mode to tool type for tracking
    const toolTypeMap: Record<OrchestratorMode, string> = {
      conversation: "conversation",
      drill: request.context.drillContext?.drillType
        ? `drill_${request.context.drillContext.drillType}`
        : "drill_translate",
      narrative: "scenario",
      assessment: "assessment",
      greeting: "greeting",
      summary: "summary",
    };

    const toolType = toolTypeMap[request.mode] || "conversation";

    // Only track if it's a meaningful interaction
    if (request.mode !== "greeting" && request.mode !== "summary") {
      await trackToolEvent({
        conversationId: request.context.conversationId,
        userId: request.context.userId?.toString(),
        toolType: toolType as any,
        toolContent: JSON.stringify({
          mode: request.mode,
          voice: request.voice.name,
          latencyMs,
          inputLength: request.userInput?.length || 0,
          outputLength: response.length,
        }),
        language: request.context.targetLanguage,
        topic: request.context.drillContext?.focusArea,
      });
    }

    console.log(
      `[TutorOrchestrator] Logged to neural network: ${request.mode} via ${request.voice.name}`
    );
  } catch (error) {
    console.error("[TutorOrchestrator] Failed to log to neural network:", error);
    // Non-critical - don't fail the request
  }
}

/**
 * Convenience function for drill feedback
 */
export async function generateDrillFeedback(
  context: OrchestratorContext,
  userResponse: string,
  isCorrect: boolean
): Promise<DrillFeedbackResponse> {
  const request: OrchestratorRequest = {
    mode: "drill",
    responseChannel: "batch_json",
    context,
    voice: {
      voiceId: "drill-mode",
      name: "Daniela (Drill Mode)",
      gender: "female",
      styleDeltas: {
        responseLength: "concise",
        encouragementLevel: "moderate",
      },
    },
    userInput: `Student response: "${userResponse}"\nCorrect: ${isCorrect}`,
    options: {
      temperature: 0.3,
      maxTokens: 200,
    },
  };

  const response = await orchestrate(request);

  if (response.success && response.json) {
    return response.json as DrillFeedbackResponse;
  }

  // Fallback if JSON parsing failed
  return {
    isCorrect,
    feedback: response.text || (isCorrect ? "Correct!" : "Not quite."),
    encouragement: isCorrect ? "Keep it up!" : "You're getting there!",
  };
}

/**
 * Convenience function for session greeting
 */
export async function generateSessionGreeting(
  context: OrchestratorContext,
  voice: VoicePresentation
): Promise<string> {
  const request: OrchestratorRequest = {
    mode: "greeting",
    responseChannel: "batch_text",
    context,
    voice,
    userInput: "Generate a warm, contextual greeting for this session.",
    options: {
      temperature: 0.8,
      maxTokens: 150,
    },
  };

  const response = await orchestrate(request);
  return response.text || "¡Hola! Ready to practice?";
}

/**
 * Convenience function for session summary
 */
export async function generateSessionSummary(
  context: OrchestratorContext,
  sessionStats: { correct: number; incorrect: number; struggledItems: string[] }
): Promise<SessionSummaryResponse> {
  const request: OrchestratorRequest = {
    mode: "summary",
    responseChannel: "batch_json",
    context,
    voice: {
      voiceId: "summary-mode",
      name: "Daniela",
      gender: "female",
    },
    userInput: `Generate a session summary.
Stats: ${sessionStats.correct} correct, ${sessionStats.incorrect} incorrect
Struggled items: ${sessionStats.struggledItems.join(", ") || "none"}`,
    options: {
      temperature: 0.6,
      maxTokens: 300,
    },
  };

  const response = await orchestrate(request);

  if (response.success && response.json) {
    return response.json as SessionSummaryResponse;
  }

  // Fallback
  return {
    summary: response.text || "Great practice session!",
    achievements: [`Got ${sessionStats.correct} correct`],
    areasToImprove:
      sessionStats.struggledItems.length > 0
        ? sessionStats.struggledItems
        : ["Keep practicing!"],
    encouragement: "You're making progress!",
  };
}

// Export for use in other services
export const tutorOrchestrator = {
  orchestrate,
  generateDrillFeedback,
  generateSessionGreeting,
  generateSessionSummary,
};
