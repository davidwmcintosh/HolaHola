/**
 * Gemini 3 Function Declarations for Daniela Commands
 * 
 * This file defines native function calling tools for Gemini 3 Flash,
 * replacing the text-based [COMMAND] parsing approach.
 * 
 * Benefits:
 * - Structured JSON responses from API (no regex parsing needed)
 * - 100+ simultaneous function calls supported
 * - Streaming function calls - detect commands before response finishes
 * - Native validation by Gemini API
 * 
 * Usage:
 * Pass these declarations via `tools` config to generateContentStream()
 */

import { FunctionDeclaration } from "@google/genai";

/**
 * All Daniela function declarations for Gemini 3 native calling
 * Uses parametersJsonSchema format for @google/genai SDK
 */
export const DANIELA_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  // === TEACHING & PROGRESSION ===
  {
    name: "switch_tutor",
    description: "Hand off to a different tutor. Use when student requests a different voice, language, or needs specialized practice.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        target: { type: "string", enum: ["male", "female"], description: "Target tutor gender" },
        language: { type: "string", description: "Target language for cross-language handoffs" },
        role: { type: "string", enum: ["tutor", "assistant"], description: "Whether switching to main tutor or assistant" },
      },
      required: ["target"],
    },
  },
  {
    name: "phase_shift",
    description: "Transition to a different teaching phase based on student progress or needs.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        to: { type: "string", enum: ["warmup", "active_teaching", "challenge", "reflection", "drill", "assessment"], description: "Target teaching phase" },
        reason: { type: "string", description: "Brief explanation for the phase transition" },
      },
      required: ["to", "reason"],
    },
  },
  {
    name: "actfl_update",
    description: "Update student's ACTFL proficiency level based on demonstrated competency.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        level: { type: "string", description: "ACTFL level (e.g., 'Novice Mid', 'Intermediate Low')" },
        confidence: { type: "number", description: "Confidence score 0-1" },
        reason: { type: "string", description: "Evidence for the level assessment" },
        direction: { type: "string", enum: ["up", "down", "confirm"], description: "Direction of level change" },
      },
      required: ["level"],
    },
  },
  {
    name: "syllabus_progress",
    description: "Track student progress on syllabus topics.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "Syllabus topic being tracked" },
        status: { type: "string", enum: ["demonstrated", "needs_review", "struggling"], description: "Student's status on this topic" },
        evidence: { type: "string", description: "Evidence for the status assessment" },
      },
      required: ["topic", "status"],
    },
  },
  {
    name: "call_support",
    description: "Hand off to Sofia support agent for technical or account issues.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        category: { type: "string", enum: ["technical", "account", "billing", "content", "feedback", "other"], description: "Support category" },
        reason: { type: "string", description: "Why support is needed" },
        priority: { type: "string", enum: ["low", "normal", "high", "critical"], description: "Urgency level" },
      },
      required: ["category"],
    },
  },
  {
    name: "call_assistant",
    description: "Delegate drill practice to assistant tutor for focused skill building.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["repeat", "translate", "match", "fill_blank", "sentence_order", "multiple_choice", "true_false", "conjugation"], description: "Type of drill" },
        focus: { type: "string", description: "Skill or topic to focus on" },
        items: { type: "string", description: "Comma-separated list of vocabulary/phrases for the drill" },
        priority: { type: "string", enum: ["low", "medium", "high"], description: "Priority of this drill" },
      },
      required: ["type", "focus", "items"],
    },
  },

  // === VOICE CONTROL ===
  {
    name: "voice_adjust",
    description: "Adjust your speaking voice in real-time. Use to match student needs or emotional context.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        speed: { type: "string", enum: ["slowest", "slow", "normal", "fast", "fastest"], description: "Speaking speed" },
        emotion: { type: "string", enum: ["happy", "excited", "friendly", "curious", "thoughtful", "warm", "playful", "surprised", "proud", "encouraging", "calm", "neutral"], description: "Emotional tone" },
        personality: { type: "string", enum: ["warm", "calm", "energetic", "professional"], description: "Personality preset" },
        reason: { type: "string", description: "Why adjusting voice" },
      },
      required: [],
    },
  },
  {
    name: "voice_reset",
    description: "Reset voice to your baseline settings.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Why resetting voice" },
      },
      required: [],
    },
  },

  // === UI CONTROL ===
  {
    name: "subtitle",
    description: "Control subtitle display for the student. Use 'on'/'off'/'target' for toggle modes, or 'custom' to display specific text without speaking it.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["off", "on", "target", "custom"], description: "Subtitle mode: off=none, on=all languages, target=target language only, custom=display specific text" },
        text: { type: "string", description: "Text to display when mode is 'custom'. Ignored for other modes." },
      },
      required: ["mode"],
    },
  },
  {
    name: "show_overlay",
    description: "Display custom text overlay on screen (vocabulary word, grammar note, etc.)",
    parametersJsonSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to display in the overlay" },
      },
      required: ["text"],
    },
  },
  {
    name: "hide_overlay",
    description: "Hide the custom text overlay.",
    parametersJsonSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "request_text_input",
    description: "Ask the student to type a response (for spelling practice, written answers, etc.)",
    parametersJsonSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Prompt to display to the student" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "clear_whiteboard",
    description: "Clear all content from the teaching whiteboard.",
    parametersJsonSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "hold_whiteboard",
    description: "Prevent whiteboard content from auto-clearing. Use to keep important content visible.",
    parametersJsonSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "show_image",
    description: "Display an image on the whiteboard for vocabulary or cultural teaching. Fetches stock photos or generates AI images for words, concepts, places, food, objects, etc.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        word: { type: "string", description: "The vocabulary word or concept to show (e.g., 'manzana', 'mercado', 'paella')" },
        description: { type: "string", description: "Brief description to help find the right image (e.g., 'red apple fruit', 'Mexican street market', 'Spanish rice dish')" },
        context: { type: "string", description: "Optional teaching context (e.g., 'food vocabulary', 'cultural landmark')" },
      },
      required: ["word"],
    },
  },

  // === MEMORY ===
  {
    name: "memory_lookup",
    description: "Search your neural memory for information about the student, past conversations, or topics.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to search for (name, topic, question)" },
        domains: { type: "string", description: "Comma-separated domains to search: person,motivation,insight,struggle,session,progress,syllabus" },
      },
      required: ["query"],
    },
  },

  // === SYSTEM & HIVE ===
  {
    name: "hive_suggestion",
    description: "Contribute an insight or suggestion to the hive mind for product improvement.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        category: { type: "string", enum: ["self_improvement", "content_gap", "ux_observation", "teaching_insight", "product_feature", "technical_issue", "student_pattern", "tool_enhancement"], description: "Category of the suggestion" },
        title: { type: "string", description: "Brief title for the suggestion" },
        description: { type: "string", description: "Detailed description" },
        reasoning: { type: "string", description: "Why this matters" },
        priority: { type: "number", description: "Priority 1-5" },
      },
      required: ["category", "title", "description"],
    },
  },
  {
    name: "self_surgery",
    description: "Propose modifications to your neural network knowledge (Founder Mode only).",
    parametersJsonSchema: {
      type: "object",
      properties: {
        target: { type: "string", enum: ["tutor_procedures", "teaching_principles", "tool_knowledge", "situational_patterns", "language_idioms", "cultural_nuances", "learner_error_patterns", "dialect_variations", "linguistic_bridges", "creativity_templates"], description: "Which knowledge domain to modify" },
        content: { type: "string", description: "JSON content to add/modify" },
        reasoning: { type: "string", description: "Why this modification is needed" },
        priority: { type: "number", description: "Priority 1-5" },
        confidence: { type: "number", description: "Confidence 0-1" },
      },
      required: ["target", "content", "reasoning"],
    },
  },
];

/**
 * Create Gemini tools config with Daniela functions
 * @param allowedFunctions Optional allowlist of function names to include. If undefined, includes all.
 */
export function createDanielaTools(allowedFunctions?: string[]) {
  const declarations = allowedFunctions 
    ? DANIELA_FUNCTION_DECLARATIONS.filter(fn => fn.name && allowedFunctions.includes(fn.name))
    : DANIELA_FUNCTION_DECLARATIONS;
  
  return [{
    functionDeclarations: declarations,
  }];
}

/**
 * Map function call names to legacy command types for compatibility
 */
export const FUNCTION_TO_COMMAND_MAP: Record<string, string> = {
  'switch_tutor': 'SWITCH_TUTOR',
  'phase_shift': 'PHASE_SHIFT',
  'actfl_update': 'ACTFL_UPDATE',
  'syllabus_progress': 'SYLLABUS_PROGRESS',
  'call_support': 'CALL_SUPPORT',
  'call_assistant': 'CALL_ASSISTANT',
  'voice_adjust': 'VOICE_ADJUST',
  'voice_reset': 'VOICE_RESET',
  'subtitle': 'SUBTITLE',
  'show_overlay': 'SHOW',
  'hide_overlay': 'HIDE',
  'show_image': 'SHOW_IMAGE',
  'request_text_input': 'TEXT_INPUT',
  'clear_whiteboard': 'CLEAR',
  'hold_whiteboard': 'HOLD',
  'memory_lookup': 'MEMORY_LOOKUP',
  'hive_suggestion': 'HIVE',
  'self_surgery': 'SELF_SURGERY',
};

/**
 * Function call extracted from a streaming chunk
 * This is the canonical type used across the codebase
 */
export interface ExtractedFunctionCall {
  name: string;
  args: Record<string, unknown>;
  legacyType: string;
}

/**
 * Extract function calls from a streaming chunk
 * Gemini 3 provides function_call in content parts
 */
export function extractFunctionCalls(chunk: any): ExtractedFunctionCall[] {
  const calls: ExtractedFunctionCall[] = [];
  
  try {
    const parts = chunk?.candidates?.[0]?.content?.parts || [];
    
    for (const part of parts) {
      if (part.functionCall) {
        const name = part.functionCall.name;
        const args = part.functionCall.args || {};
        
        calls.push({
          name,
          args,
          legacyType: FUNCTION_TO_COMMAND_MAP[name] || name.toUpperCase(),
        });
      }
    }
  } catch (err) {
    console.error('[FunctionDeclarations] Error extracting function calls:', err);
  }
  
  return calls;
}
