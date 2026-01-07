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

import { FunctionDeclaration, Type, Schema } from "@google/genai";

/**
 * All Daniela function declarations for Gemini 3 native calling
 */
export const DANIELA_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  // === TEACHING & PROGRESSION ===
  {
    name: "switch_tutor",
    description: "Hand off to a different tutor. Use when student requests a different voice, language, or needs specialized practice.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        target: {
          type: Type.STRING,
          enum: ["male", "female"],
          description: "Target tutor gender",
        },
        language: {
          type: Type.STRING,
          description: "Target language for cross-language handoffs (e.g., 'japanese', 'spanish')",
        },
        role: {
          type: Type.STRING,
          enum: ["tutor", "assistant"],
          description: "Whether switching to main tutor or assistant for drill practice",
        },
      },
      required: ["target"],
    },
  },
  {
    name: "phase_shift",
    description: "Transition to a different teaching phase based on student progress or needs.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        to: {
          type: Type.STRING,
          enum: ["warmup", "active_teaching", "challenge", "reflection", "drill", "assessment"],
          description: "Target teaching phase",
        },
        reason: {
          type: Type.STRING,
          description: "Brief explanation for the phase transition",
        },
      },
      required: ["to", "reason"],
    },
  },
  {
    name: "actfl_update",
    description: "Update student's ACTFL proficiency level based on demonstrated competency.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        level: {
          type: Type.STRING,
          description: "ACTFL level (e.g., 'Novice Mid', 'Intermediate Low')",
        },
        confidence: {
          type: Type.NUMBER,
          description: "Confidence score 0-1",
        },
        reason: {
          type: Type.STRING,
          description: "Evidence for the level assessment",
        },
        direction: {
          type: Type.STRING,
          enum: ["up", "down", "confirm"],
          description: "Direction of level change",
        },
      },
      required: ["level"],
    },
  },
  {
    name: "syllabus_progress",
    description: "Track student progress on syllabus topics.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        topic: {
          type: Type.STRING,
          description: "Syllabus topic being tracked",
        },
        status: {
          type: Type.STRING,
          enum: ["demonstrated", "needs_review", "struggling"],
          description: "Student's status on this topic",
        },
        evidence: {
          type: Type.STRING,
          description: "Evidence for the status assessment",
        },
      },
      required: ["topic", "status"],
    },
  },
  {
    name: "call_support",
    description: "Hand off to Sofia support agent for technical or account issues.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: {
          type: Type.STRING,
          enum: ["technical", "account", "billing", "content", "feedback", "other"],
          description: "Support category",
        },
        reason: {
          type: Type.STRING,
          description: "Why support is needed",
        },
        priority: {
          type: Type.STRING,
          enum: ["low", "normal", "high", "critical"],
          description: "Urgency level",
        },
      },
      required: ["category"],
    },
  },
  {
    name: "call_assistant",
    description: "Delegate drill practice to assistant tutor for focused skill building.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        type: {
          type: Type.STRING,
          enum: ["repeat", "translate", "match", "fill_blank", "sentence_order", "multiple_choice", "true_false", "conjugation"],
          description: "Type of drill",
        },
        focus: {
          type: Type.STRING,
          description: "Skill or topic to focus on",
        },
        items: {
          type: Type.STRING,
          description: "Comma-separated list of vocabulary/phrases for the drill",
        },
        priority: {
          type: Type.STRING,
          enum: ["low", "medium", "high"],
          description: "Priority of this drill",
        },
      },
      required: ["type", "focus", "items"],
    },
  },

  // === VOICE CONTROL ===
  {
    name: "voice_adjust",
    description: "Adjust your speaking voice in real-time. Use to match student needs or emotional context.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        speed: {
          type: Type.STRING,
          enum: ["slowest", "slow", "normal", "fast", "fastest"],
          description: "Speaking speed",
        },
        emotion: {
          type: Type.STRING,
          enum: ["happy", "excited", "friendly", "curious", "thoughtful", "warm", "playful", "surprised", "proud", "encouraging", "calm", "neutral"],
          description: "Emotional tone",
        },
        personality: {
          type: Type.STRING,
          enum: ["warm", "calm", "energetic", "professional"],
          description: "Personality preset",
        },
        reason: {
          type: Type.STRING,
          description: "Why adjusting voice",
        },
      },
      required: [],
    },
  },
  {
    name: "voice_reset",
    description: "Reset voice to your baseline settings.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        reason: {
          type: Type.STRING,
          description: "Why resetting voice",
        },
      },
      required: [],
    },
  },

  // === UI CONTROL ===
  {
    name: "subtitle",
    description: "Control subtitle display for the student. Turn on for visual reinforcement, off for listening focus.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        mode: {
          type: Type.STRING,
          enum: ["off", "on", "target"],
          description: "Subtitle mode: off=none, on=all languages, target=target language only",
        },
      },
      required: ["mode"],
    },
  },
  {
    name: "show_overlay",
    description: "Display custom text overlay on screen (vocabulary word, grammar note, etc.)",
    parameters: {
      type: Type.OBJECT,
      properties: {
        text: {
          type: Type.STRING,
          description: "Text to display in the overlay",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "hide_overlay",
    description: "Hide the custom text overlay.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
      required: [],
    },
  },
  {
    name: "request_text_input",
    description: "Ask the student to type a response (for spelling practice, written answers, etc.)",
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: {
          type: Type.STRING,
          description: "Prompt to display to the student",
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "clear_whiteboard",
    description: "Clear all content from the teaching whiteboard.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
      required: [],
    },
  },
  {
    name: "hold_whiteboard",
    description: "Prevent whiteboard content from auto-clearing. Use to keep important content visible.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
      required: [],
    },
  },

  // === MEMORY ===
  {
    name: "memory_lookup",
    description: "Search your neural memory for information about the student, past conversations, or topics.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "What to search for (name, topic, question)",
        },
        domains: {
          type: Type.STRING,
          description: "Comma-separated domains to search: person,motivation,insight,struggle,session,progress,syllabus",
        },
      },
      required: ["query"],
    },
  },

  // === SYSTEM & HIVE ===
  {
    name: "hive_suggestion",
    description: "Contribute an insight or suggestion to the hive mind for product improvement.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: {
          type: Type.STRING,
          enum: ["self_improvement", "content_gap", "ux_observation", "teaching_insight", "product_feature", "technical_issue", "student_pattern", "tool_enhancement"],
          description: "Category of the suggestion",
        },
        title: {
          type: Type.STRING,
          description: "Brief title for the suggestion",
        },
        description: {
          type: Type.STRING,
          description: "Detailed description",
        },
        reasoning: {
          type: Type.STRING,
          description: "Why this matters",
        },
        priority: {
          type: Type.NUMBER,
          description: "Priority 1-5",
        },
      },
      required: ["category", "title", "description"],
    },
  },
  {
    name: "self_surgery",
    description: "Propose modifications to your neural network knowledge (Founder Mode only).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        target: {
          type: Type.STRING,
          enum: ["tutor_procedures", "teaching_principles", "tool_knowledge", "situational_patterns", "language_idioms", "cultural_nuances", "learner_error_patterns", "dialect_variations", "linguistic_bridges", "creativity_templates"],
          description: "Which knowledge domain to modify",
        },
        content: {
          type: Type.STRING,
          description: "JSON content to add/modify",
        },
        reasoning: {
          type: Type.STRING,
          description: "Why this modification is needed",
        },
        priority: {
          type: Type.NUMBER,
          description: "Priority 1-5",
        },
        confidence: {
          type: Type.NUMBER,
          description: "Confidence 0-1",
        },
      },
      required: ["target", "content", "reasoning"],
    },
  },
];

/**
 * Create Gemini tools config with all Daniela functions
 */
export function createDanielaTools() {
  return [{
    functionDeclarations: DANIELA_FUNCTION_DECLARATIONS,
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
  'request_text_input': 'TEXT_INPUT',
  'clear_whiteboard': 'CLEAR',
  'hold_whiteboard': 'HOLD',
  'memory_lookup': 'MEMORY_LOOKUP',
  'hive_suggestion': 'HIVE',
  'self_surgery': 'SELF_SURGERY',
};

/**
 * Extract function calls from a streaming chunk
 * Gemini 3 provides function_call in content parts
 */
export interface ExtractedFunctionCall {
  name: string;
  args: Record<string, unknown>;
  legacyType: string;
}

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
