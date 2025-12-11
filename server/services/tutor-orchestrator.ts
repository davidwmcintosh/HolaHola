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

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

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
 * Build the complete system prompt for this request
 */
async function buildSystemPrompt(
  request: OrchestratorRequest
): Promise<string> {
  const { mode, context, voice } = request;

  // 1. Core persona (always Daniela underneath)
  const corePersona = buildCorePersona(voice);

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

  // 5. Additional context if provided
  const additionalContext = request.additionalPromptContext
    ? `
═══════════════════════════════════════════════════════════════════
📝 ADDITIONAL CONTEXT
═══════════════════════════════════════════════════════════════════

${request.additionalPromptContext}
`
    : "";

  return [
    corePersona,
    modeInstructions,
    voiceStyle,
    proceduralSection,
    additionalContext,
  ]
    .filter(Boolean)
    .join("\n");
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
    // 1. Build the system prompt
    const systemPrompt = await buildSystemPrompt(request);

    // 2. Determine model and parameters based on mode
    const modelName = "gemini-2.0-flash";
    const temperature =
      request.options?.temperature ??
      (request.mode === "drill" ? 0.3 : 0.7);
    const maxTokens =
      request.options?.maxTokens ??
      (request.mode === "drill" ? 200 : 1000);

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

      const responseText = result.text || "";
      const latencyMs = Date.now() - startTime;

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

    const responseText = result.text || "";
    const latencyMs = Date.now() - startTime;

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
