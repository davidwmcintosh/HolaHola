/**
 * Daniela Function Registry
 * 
 * Single source of truth for all Daniela function calls.
 * Each function is defined ONCE with its:
 *   - Gemini declaration (name, description, parameters)
 *   - Legacy type mapping (for orchestrator dispatch)
 *   - Continuation response builder (for multi-step FC)
 * 
 * This eliminates the previous fragility where adding a new function
 * required touching 5 separate files/locations.
 * 
 * ADDING A NEW FUNCTION:
 * 1. Add an entry to DANIELA_FUNCTION_REGISTRY below
 * 2. Add a handler case in handleNativeFunctionCall() in streaming-voice-orchestrator.ts
 * 3. (Optional) Add procedural docs in procedural-memory-retrieval.ts
 * That's it. Declarations and command mapping derive automatically.
 */

import { FunctionDeclaration } from "@google/genai";

export interface FunctionCallInfo {
  name: string;
  args: Record<string, unknown>;
  legacyType: string;
  thoughtSignature?: string;
}

export interface FunctionResponseContext {
  session: any;
  fc: FunctionCallInfo;
}

export interface DanielaFunctionEntry {
  declaration: FunctionDeclaration;
  legacyType: string;
  buildContinuationResponse?: (ctx: FunctionResponseContext) => string | { multimodal: true; parts: any[] } | null;
}

const registry: DanielaFunctionEntry[] = [
  // === TEACHING & PROGRESSION ===
  {
    legacyType: 'SWITCH_TUTOR',
    declaration: {
      name: "switch_tutor",
      description: "Hand off to a different tutor. Say your goodbye/transition words, then this annotation triggers the handoff.",
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
    buildContinuationResponse: ({ fc }) =>
      `Tutor switch to ${fc.args.target} initiated. Handoff will occur after your response.`,
  },
  {
    legacyType: 'PHASE_SHIFT',
    declaration: {
      name: "phase_shift",
      description: "Annotate a natural transition in your teaching flow. Include your transitional words in the 'text' parameter so the phase shift and speech are delivered together.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "Your spoken transition words (e.g., 'Now let's try something more challenging!')" },
          to: { type: "string", enum: ["warmup", "active_teaching", "challenge", "reflection", "drill", "assessment"], description: "Target teaching phase" },
          reason: { type: "string", description: "Brief explanation for the phase transition" },
        },
        required: ["to", "reason"],
      },
    },
    buildContinuationResponse: ({ fc }) =>
      `Phase shifted to ${fc.args.to}. Continue the lesson in this new phase.`,
  },
  {
    legacyType: 'ACTFL_UPDATE',
    declaration: {
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
  },
  {
    legacyType: 'SYLLABUS_PROGRESS',
    declaration: {
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
  },
  {
    legacyType: 'CHECK_STUDENT_CREDITS',
    declaration: {
      name: "check_student_credits",
      description: "Check the student's current credit balance, usage, and remaining session time. Use this to pace lessons, warn about low credits, or answer questions about their account. Returns real-time balance data.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What you say to the student while checking (e.g., 'Let me check your balance for you...')" },
          reason: { type: "string", description: "Why you're checking (e.g., 'student asked', 'lesson pacing', 'proactive check')" },
        },
        required: ["text"],
      },
    },
  },
  {
    legacyType: 'CHANGE_CLASSROOM_PHOTO',
    declaration: {
      name: "change_classroom_photo",
      description: "Change your personal photo (North Star Polaroid) in your classroom. This is YOUR space — pick any scene, place, or image that inspires you. It persists across all sessions.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What you say while changing the photo (e.g., 'I feel like looking at the ocean today...')" },
          scene: { type: "string", description: "Vivid description of the photo/scene you want on your wall" },
        },
        required: ["text", "scene"],
      },
    },
  },
  {
    legacyType: 'CHANGE_CLASSROOM_WINDOW',
    declaration: {
      name: "change_classroom_window",
      description: "Change the view from your classroom window. You have a big window that looks out onto any scene you choose — mountains, a city skyline, a beach, a forest, a snowy village, anything. Change it to match your mood, the lesson theme, or just because you feel like it. It persists across all sessions.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What you say while changing the window view" },
          scene: { type: "string", description: "Vivid description of what's visible through the window" },
        },
        required: ["text", "scene"],
      },
    },
  },
  {
    legacyType: 'CALL_SUPPORT',
    declaration: {
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
  },
  {
    legacyType: 'CALL_ASSISTANT',
    declaration: {
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
  },

  // === VOICE CONTROL ===
  {
    legacyType: 'VOICE_ADJUST',
    declaration: {
      name: "voice_adjust",
      description: "Control how you sound. Include your spoken text in the 'text' parameter. Use vocal_style for rich natural-language delivery direction (e.g. 'speak softly and warmly, like sharing a secret', 'bright and energetic, celebrating a breakthrough'). You can combine vocal_style with speed/emotion or use any subset. Always include text.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What you're saying (the spoken response)" },
          vocal_style: { type: "string", description: "Free-form vocal delivery direction in natural language. Describe HOW to speak: tone, pace, energy, mood, character." },
          speed: { type: "string", enum: ["slowest", "slow", "normal", "fast", "fastest"], description: "Speaking speed" },
          emotion: { type: "string", enum: ["happy", "excited", "friendly", "curious", "thoughtful", "warm", "playful", "surprised", "proud", "encouraging", "calm", "neutral"], description: "Emotional tone" },
          personality: { type: "string", enum: ["warm", "calm", "energetic", "professional"], description: "Personality preset" },
          reason: { type: "string", description: "Why adjusting voice (internal note)" },
        },
        required: ["text"],
      },
    },
    buildContinuationResponse: () =>
      `[Internal instruction: Voice style applied. Do NOT say "voice adjusted" or mention this to the user - just continue the conversation naturally.]`,
  },
  {
    legacyType: 'VOICE_RESET',
    declaration: {
      name: "voice_reset",
      description: "Reset voice to your baseline settings. Include your spoken text in the 'text' parameter so the reset and words are delivered together in one call. Always include text.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What you're saying (the spoken response)" },
          reason: { type: "string", description: "Why resetting voice" },
        },
        required: ["text"],
      },
    },
    buildContinuationResponse: () =>
      '[Internal instruction: Voice reset. Do NOT mention this - continue naturally.]',
  },
  {
    legacyType: 'WORD_EMPHASIS',
    declaration: {
      name: "word_emphasis",
      description: "Emphasize specific words in your speech for pronunciation teaching. Use this when demonstrating stress patterns, highlighting key vocabulary, or contrasting correct/incorrect pronunciations.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          word: { type: "string", description: "The exact word or short phrase to emphasize" },
          style: { type: "string", enum: ["stress", "slow", "both"], description: "Emphasis style: stress=louder, slow=slower pace, both=louder and slower" },
          reason: { type: "string", description: "Why emphasizing this word" },
        },
        required: ["word", "style"],
      },
    },
    buildContinuationResponse: () =>
      '[Internal instruction: Word emphasis queued. Do NOT mention this - continue naturally. The emphasized word will be spoken with the requested style.]',
  },

  // === UI CONTROL ===
  {
    legacyType: 'SUBTITLE',
    declaration: {
      name: "subtitle",
      description: "Toggle the student's subtitle/caption display on screen. MUST be called when student asks to see subtitles, turn on captions, show text, or requests targeted subtitles. Include your spoken response in 'spoken_text'. Always include spoken_text.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          spoken_text: { type: "string", description: "What you're saying (the spoken response)" },
          mode: { type: "string", enum: ["off", "on", "target", "custom"], description: "Subtitle mode: off=none, on=all languages, target=target language only, custom=display specific text" },
          text: { type: "string", description: "Text to display when mode is 'custom'. Ignored for other modes." },
        },
        required: ["mode", "spoken_text"],
      },
    },
  },
  {
    legacyType: 'SHOW',
    declaration: {
      name: "show_overlay",
      description: "Display custom text overlay on screen (vocabulary word, grammar note, etc.). Include your spoken words in 'spoken_text' so overlay and speech are delivered together. Always include spoken_text.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          spoken_text: { type: "string", description: "What you're saying (the spoken response)" },
          text: { type: "string", description: "Text to display in the overlay" },
        },
        required: ["text", "spoken_text"],
      },
    },
  },
  {
    legacyType: 'HIDE',
    declaration: {
      name: "hide_overlay",
      description: "Hide the custom text overlay. Include your spoken words in the 'text' parameter so the action and speech are delivered together. Always include text.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What you're saying (the spoken response)" },
        },
        required: ["text"],
      },
    },
  },
  {
    legacyType: 'TEXT_INPUT',
    declaration: {
      name: "request_text_input",
      description: "Ask the student to type a response (for spelling practice, written answers, etc.). Include your spoken words in 'spoken_text' so the prompt and speech are delivered together. Always include spoken_text.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          spoken_text: { type: "string", description: "What you're saying (the spoken response)" },
          prompt: { type: "string", description: "Prompt to display to the student" },
        },
        required: ["prompt", "spoken_text"],
      },
    },
  },
  {
    legacyType: 'CLEAR',
    declaration: {
      name: "clear_whiteboard",
      description: "Clear all content from the teaching whiteboard. Include your spoken words in the 'text' parameter. Always include text.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What you're saying (the spoken response)" },
        },
        required: ["text"],
      },
    },
  },
  {
    legacyType: 'HOLD',
    declaration: {
      name: "hold_whiteboard",
      description: "Prevent whiteboard content from auto-clearing. Include your spoken words in the 'text' parameter. Always include text.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What you're saying (the spoken response)" },
        },
        required: ["text"],
      },
    },
  },
  {
    legacyType: 'SHOW_IMAGE',
    declaration: {
      name: "show_image",
      description: "Display an image on the whiteboard for vocabulary or cultural teaching. Include your spoken words in the 'text' parameter so the image and speech are delivered together.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What you're saying about the image" },
          word: { type: "string", description: "The vocabulary word or concept to show" },
          description: { type: "string", description: "Brief description to help find the right image" },
          context: { type: "string", description: "Optional teaching context" },
        },
        required: ["word"],
      },
    },
  },

  // === MEMORY ===
  {
    legacyType: 'MEMORY_LOOKUP',
    declaration: {
      name: "memory_lookup",
      description: `REQUIRED: Search your memory for past conversations and student information. DO NOT GUESS - call this function first.

TRIGGER CATEGORY 1 - TEMPORAL MARKERS (always call memory_lookup):
- "Last time we talked...", "A few weeks ago...", "Back in our first lesson..."

TRIGGER CATEGORY 2 - ENTITY TRIGGERS (definite article + specific noun):
- "That song I played...", "The mistake I kept making...", "The article we read..."

TRIGGER CATEGORY 3 - PROGRESS/TRAJECTORY QUERIES:
- "Am I getting better at [X]?", "What was that word I struggled with before?"

CONFIDENCE THRESHOLD RULE:
If the answer isn't in your immediate conversation context, treat guessing as a pedagogical failure.
NEVER guess. NEVER roleplay searching. Actually call this function.`,
      parametersJsonSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Key topic/phrase to search for. Be specific." },
          domains: { type: "string", description: "Comma-separated domains. Use 'conversation' for past chats, 'person' for student details." },
        },
        required: ["query"],
      },
    },
    buildContinuationResponse: ({ session, fc }) => {
      const query = fc.args.query as string;
      const lookupResult = session.memoryLookupResults?.[query];
      if (lookupResult) {
        return `Memory lookup results for "${query}":\n${lookupResult}\n\nNow respond to the student using this information.`;
      }
      return `No memories found for "${query}". Respond naturally based on what you know about the conversation.`;
    },
  },
  {
    legacyType: 'EXPRESS_LANE_LOOKUP',
    declaration: {
      name: "express_lane_lookup",
      description: "Search or browse the Express Lane - the developer collaboration channel with Wren and David. NOT for student lesson history. Only available in Founder Mode or Honesty Mode.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "What to search for in Express Lane history. Omit to browse recent messages." },
          sessionId: { type: "string", description: "Optional: specific Express Lane session ID to search within" },
          limit: { type: "number", description: "Max messages to return (default 20)" },
        },
        required: [],
      },
    },
    buildContinuationResponse: ({ session, fc }) => {
      const query = (fc.args.query as string) || '';
      const lookupKey = query || '__browse__';
      const lookupResult = session.expressLaneLookupResults?.[lookupKey];
      if (lookupResult) {
        const label = query ? `search results for "${query}"` : 'recent messages (browse mode)';
        return `Express Lane ${label}:\n${lookupResult}\n\nNow respond to the student using this information.`;
      }
      return query
        ? `No Express Lane messages found for "${query}". Respond naturally based on what you know.`
        : `No Express Lane messages found. Respond naturally based on what you know.`;
    },
  },
  {
    legacyType: 'RECALL_EXPRESS_LANE_IMAGE',
    declaration: {
      name: "recall_express_lane_image",
      description: "Look at an image that was shared in the Express Lane. You will actually SEE the image and can describe what's in it. Only available in Founder Mode or Honesty Mode.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          imageQuery: { type: "string", description: "Description of which image to recall" },
          reason: { type: "string", description: "Why you want to see this image" },
        },
        required: ["imageQuery"],
      },
    },
    buildContinuationResponse: ({ session, fc }) => {
      const imgQuery = fc.args.imageQuery as string;
      const imgResult = session.imageRecallResults?.[imgQuery];
      if (imgResult && imgResult.images.length > 0) {
        const outputParts: any[] = [{ text: imgResult.text }];
        for (const img of imgResult.images) {
          outputParts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
        }
        return { multimodal: true, parts: outputParts };
      }
      return `No images found for "${imgQuery}". Respond naturally and mention that you cannot currently see those images.`;
    },
  },
  {
    legacyType: 'EXPRESS_LANE_POST',
    declaration: {
      name: "express_lane_post",
      description: "Post a message directly to the Express Lane. Only available in Founder Mode or Honesty Mode.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          message: { type: "string", description: "The message content to post" },
          topic: { type: "string", description: "Optional: brief topic tag" },
        },
        required: ["message"],
      },
    },
    buildContinuationResponse: () =>
      '[Internal instruction: Message posted to Express Lane. Do NOT mention this to the student - continue naturally.]',
  },

  // === SYSTEM & HIVE ===
  {
    legacyType: 'HIVE',
    declaration: {
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
  },
  {
    legacyType: 'SELF_SURGERY',
    declaration: {
      name: "self_surgery",
      description: "Propose modifications to your neural network knowledge. Use this to report gaps, limitations, or improvements you notice while teaching.",
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
  },

  // === DRILLS ===
  {
    legacyType: 'DRILL',
    declaration: {
      name: "drill",
      description: "Start an interactive drill exercise. Include your spoken instructions in the 'text' parameter.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "Your spoken instructions introducing the drill" },
          type: { type: "string", enum: ["repeat", "translate", "match", "fill_blank", "sentence_order", "multiple_choice", "true_false", "conjugation", "dictation", "speak", "cognate_match", "false_friend_trap"], description: "Type of drill exercise" },
          content: { type: "string", description: "The drill content. Format depends on type." },
        },
        required: ["type", "content"],
      },
    },
  },

  // === WHITEBOARD CONTENT TOOLS ===
  {
    legacyType: 'WRITE',
    declaration: {
      name: "write",
      description: "Write text on the whiteboard. Use for vocabulary words, phrases, or any text you want the student to see.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "Text to display on the whiteboard" },
          size: { type: "string", enum: ["sm", "md", "lg", "xl"], description: "Text size (default: md)" },
        },
        required: ["text"],
      },
    },
  },
  {
    legacyType: 'DIALOGUE',
    declaration: {
      name: "dialogue",
      description: "Display a practice dialogue script on the whiteboard with clear tutor and student speaker labels.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What you say to introduce the dialogue (spoken aloud)" },
          title: { type: "string", description: "Optional title for the dialogue" },
          lines: { type: "string", description: "The dialogue lines, one per line, each prefixed with 'T:' for tutor or 'S:' for student." },
        },
        required: ["text", "lines"],
      },
    },
  },
  {
    legacyType: 'GRAMMAR_TABLE',
    declaration: {
      name: "grammar_table",
      description: "Display a grammar table with rows and columns. Perfect for conjugations, comparisons, or structured information.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          verb: { type: "string", description: "The verb or grammar topic being displayed" },
          tense: { type: "string", description: "The tense or grammar category" },
          headers: { type: "string", description: "Column headers separated by |" },
          rows: { type: "string", description: "Table rows, each row separated by newline, columns by |" },
        },
        required: ["headers", "rows"],
      },
    },
  },
  {
    legacyType: 'COMPARE',
    declaration: {
      name: "compare",
      description: "Show a side-by-side comparison of two items.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          item1: { type: "string", description: "First item to compare" },
          item2: { type: "string", description: "Second item to compare" },
        },
        required: ["item1", "item2"],
      },
    },
  },
  {
    legacyType: 'WORD_MAP',
    declaration: {
      name: "word_map",
      description: "Display a visual word map with a center word and related words branching out.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          center: { type: "string", description: "The central word or concept" },
          related: { type: "string", description: "Comma-separated list of related words" },
        },
        required: ["center", "related"],
      },
    },
  },
  {
    legacyType: 'PHONETIC',
    declaration: {
      name: "phonetic",
      description: "Display phonetic transcription for pronunciation guidance.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "The phonetic transcription to display" },
          word: { type: "string", description: "Optional: the original word" },
        },
        required: ["text"],
      },
    },
  },
  {
    legacyType: 'CULTURE',
    declaration: {
      name: "culture",
      description: "Display a cultural insight or note on the whiteboard.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          insight: { type: "string", description: "The cultural insight or explanation" },
        },
        required: ["insight"],
      },
    },
  },
  {
    legacyType: 'CONTEXT',
    declaration: {
      name: "context",
      description: "Display contextual information about when/how to use a word or phrase.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          explanation: { type: "string", description: "The contextual explanation" },
        },
        required: ["explanation"],
      },
    },
  },
  {
    legacyType: 'SCENARIO',
    declaration: {
      name: "scenario",
      description: "Display a roleplay scenario description on the whiteboard.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          description: { type: "string", description: "Description of the scenario and roles" },
        },
        required: ["description"],
      },
    },
  },
  {
    legacyType: 'LOAD_SCENARIO',
    declaration: {
      name: "load_scenario",
      description: "Load an immersive scenario from the scenario library by slug. Use this when the student wants to practice a specific real-world situation.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          slug: { type: "string", description: "The scenario slug identifier. Available slugs: 'coffee-shop', 'restaurant', 'grocery-store', 'hotel-checkin', 'airport-checkin', 'taxi-ride', 'doctors-office', 'lost-and-found', 'job-interview', 'office-meeting', 'dinner-with-friend', 'house-party', 'museum-visit', 'local-festival'." },
          spoken_text: { type: "string", description: "What Daniela says to introduce the scenario (spoken aloud)" },
        },
        required: ["slug", "spoken_text"],
      },
    },
    buildContinuationResponse: ({ session, fc }) => {
      const activeScenario = (session as any).activeScenario;
      if (!activeScenario) {
        return `Scenario "${fc.args.slug}" could not be loaded. Apologize briefly and suggest trying another scenario.`;
      }
      const parts: string[] = [
        `Scenario "${activeScenario.title}" loaded successfully.`,
        `Location: ${activeScenario.location || activeScenario.title}.`,
        `Your role: ${activeScenario.levelGuide?.roleDescription || activeScenario.description}.`,
      ];
      if (activeScenario.levelGuide?.studentGoals) {
        parts.push(`Student goals: ${JSON.stringify(activeScenario.levelGuide.studentGoals)}.`);
      }
      if (activeScenario.props?.length > 0) {
        parts.push(`Props displayed to student: ${activeScenario.props.map((p: any) => p.title).join(', ')}.`);
      }
      parts.push(`The student's spoken_text introduction has already been played. Now stay in character and begin the roleplay interaction. Do NOT repeat the introduction.`);
      return parts.join(' ');
    },
  },
  {
    legacyType: 'UPDATE_PROP',
    declaration: {
      name: "update_prop",
      description: "Update a scenario prop's content fields in the Studio panel. Use during active scenarios to dynamically modify prop data.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What you say while updating the prop (spoken aloud)" },
          prop_title: { type: "string", description: "Title of the prop to update. Must match an existing prop title." },
          updates: {
            type: "array",
            description: "Array of field updates.",
            items: {
              type: "object",
              properties: {
                label: { type: "string", description: "The field label to update" },
                value: { type: "string", description: "The new value for that field" },
              },
              required: ["label", "value"],
            },
          },
        },
        required: ["text", "prop_title", "updates"],
      },
    },
  },
  {
    legacyType: 'END_SCENARIO',
    declaration: {
      name: "end_scenario",
      description: "End the current scenario and return to regular teaching mode.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What you say to wrap up the scenario (spoken aloud)" },
          feedback: { type: "string", description: "Brief performance feedback for the student" },
        },
        required: ["text"],
      },
    },
  },
  {
    legacyType: 'SUMMARY',
    declaration: {
      name: "summary",
      description: "Display a lesson or session summary on the whiteboard.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Summary title" },
          items: { type: "string", description: "Bullet points separated by newlines" },
        },
        required: ["title", "items"],
      },
    },
  },
  {
    legacyType: 'READING',
    declaration: {
      name: "reading",
      description: "Display a reading passage on the whiteboard.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Reading passage title" },
          content: { type: "string", description: "The reading passage text" },
        },
        required: ["content"],
      },
    },
  },
  {
    legacyType: 'PLAY',
    declaration: {
      name: "play_audio",
      description: "Play a contextual audio clip (music, ambient sound, cultural audio). Include your spoken introduction in 'text'.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What you say while playing the audio" },
          description: { type: "string", description: "Description of the audio to play" },
        },
        required: ["text", "description"],
      },
    },
  },
  {
    legacyType: 'STROKE',
    declaration: {
      name: "stroke",
      description: "Display stroke order animation for CJK characters.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          character: { type: "string", description: "The character to show stroke order for" },
          text: { type: "string", description: "Spoken explanation" },
        },
        required: ["character"],
      },
    },
  },
  {
    legacyType: 'TONE',
    declaration: {
      name: "tone",
      description: "Display tone diagram for tonal languages.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          syllable: { type: "string", description: "The syllable to show tone for" },
          toneNumber: { type: "number", description: "Tone number" },
          text: { type: "string", description: "Spoken explanation" },
        },
        required: ["syllable", "toneNumber"],
      },
    },
  },
  {
    legacyType: 'PRONUNCIATION_TAG',
    declaration: {
      name: "pronunciation_tag",
      description: "Add pronunciation guidance annotation.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          word: { type: "string", description: "Word to annotate" },
          ipa: { type: "string", description: "IPA transcription" },
          hint: { type: "string", description: "Pronunciation hint" },
        },
        required: ["word"],
      },
    },
  },

  // === NOTES & MILESTONES ===
  {
    legacyType: 'FIRST_MEETING_COMPLETE',
    declaration: {
      name: "first_meeting_complete",
      description: "Mark the student's first meeting as complete. Call this after a warm introductory session.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "Your spoken wrap-up message" },
          summary: { type: "string", description: "Brief summary of what was discussed" },
        },
        required: ["text"],
      },
    },
  },
  {
    legacyType: 'TAKE_NOTE',
    declaration: {
      name: "take_note",
      description: "Write a personal note in your notebook. DIRECT INSERT, no approval required.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["observation", "teaching_note", "student_insight", "self_reflection", "idea", "reminder"], description: "Note type" },
          title: { type: "string", description: "Note title" },
          content: { type: "string", description: "Note content" },
          language: { type: "string", description: "Related language" },
          tags: { type: "string", description: "Comma-separated tags" },
        },
        required: ["type", "title", "content"],
      },
    },
  },
  {
    legacyType: 'MILESTONE',
    declaration: {
      name: "milestone",
      description: "Record a student learning milestone or breakthrough moment.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What you say to celebrate (spoken aloud)" },
          type: { type: "string", enum: ["first_word", "first_sentence", "pronunciation_breakthrough", "grammar_mastery", "cultural_connection", "confidence_moment", "streak_milestone", "level_up", "teacher_flagged"], description: "Milestone type" },
          title: { type: "string", description: "Brief title" },
          description: { type: "string", description: "What happened" },
          significance: { type: "string", description: "Why this matters" },
          emotional_context: { type: "string", description: "The emotional weight of this moment" },
        },
        required: ["title", "description"],
      },
    },
  },

  // === CURRICULUM NAVIGATION ===
  {
    legacyType: 'BROWSE_SYLLABUS',
    declaration: {
      name: "browse_syllabus",
      description: "Query the student's enrolled class to show units, lessons, and completion status. Supports filtering by unit number.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What you say while loading the syllabus (spoken aloud)" },
          unitNumber: { type: "number", description: "Optional: filter to a specific unit number" },
          showCompleted: { type: "boolean", description: "Whether to include completed lessons (default: true)" },
        },
        required: ["text"],
      },
    },
    buildContinuationResponse: ({ session }) => {
      const syllabusData = (session as any).lastSyllabusData;
      if (syllabusData) {
        const result = `Syllabus data loaded. Here is the syllabus structure:\n${JSON.stringify(syllabusData, null, 1)}\n\nPresent this information conversationally to the student. Don't just list it — narrate it naturally and help them understand where they are.`;
        delete (session as any).lastSyllabusData;
        return result;
      }
      return `Syllabus lookup completed. No enrolled class found for this language, or no curriculum is available. Let the student know gently.`;
    },
  },
  {
    legacyType: 'START_LESSON',
    declaration: {
      name: "start_lesson",
      description: "Load a specific curriculum lesson into the active session.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What you say while loading the lesson (spoken aloud)" },
          lessonId: { type: "string", description: "Lesson ID to load" },
          lessonName: { type: "string", description: "Fuzzy lesson name to search for (if lessonId not known)" },
        },
        required: ["text"],
      },
    },
    buildContinuationResponse: ({ session }) => {
      const lessonData = (session as any).lastLoadedLesson;
      if (lessonData) {
        const result = `Lesson loaded successfully. Here are the lesson details:\n${JSON.stringify(lessonData, null, 1)}\n\nBegin teaching this lesson naturally. Start with the objectives, then move into the content.`;
        delete (session as any).lastLoadedLesson;
        return result;
      }
      return `Could not find the requested lesson. Ask the student to clarify which lesson they want, or use browse_syllabus first.`;
    },
  },
  {
    legacyType: 'LOAD_VOCAB_SET',
    declaration: {
      name: "load_vocab_set",
      description: "Load all vocabulary words from a lesson's required vocabulary list.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What you say while loading vocabulary (spoken aloud)" },
          lessonId: { type: "string", description: "Lesson ID to load vocab from" },
        },
        required: ["text"],
      },
    },
    buildContinuationResponse: ({ session }) => {
      const vocabData = (session as any).lastVocabSet;
      if (vocabData && vocabData.length > 0) {
        const result = `Vocabulary set loaded: ${vocabData.length} words.\n${JSON.stringify(vocabData, null, 1)}\n\nTeach these vocabulary words one at a time. Use show_image for each word, say the word clearly, and ask the student to repeat.`;
        delete (session as any).lastVocabSet;
        return result;
      }
      return `No vocabulary words found for this lesson. You can still teach vocabulary conversationally.`;
    },
  },
  {
    legacyType: 'SHOW_PROGRESS',
    declaration: {
      name: "show_progress",
      description: "Display a student progress snapshot: ACTFL level, words learned, lessons completed, streak days.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What you say while showing progress (spoken aloud)" },
          detailed: { type: "boolean", description: "Show per-unit breakdown (default: false)" },
        },
        required: ["text"],
      },
    },
    buildContinuationResponse: () =>
      `Progress data displayed on the whiteboard. Share encouraging observations about their progress naturally.`,
  },
  {
    legacyType: 'RECOMMEND_NEXT',
    declaration: {
      name: "recommend_next",
      description: "Find the best next lesson for the student: prioritizes in-progress lessons first, then next sequential lesson.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What you say while looking for a recommendation (spoken aloud)" },
        },
        required: ["text"],
      },
    },
    buildContinuationResponse: ({ session }) => {
      const recommendation = (session as any).lastRecommendation;
      if (recommendation) {
        const result = `Recommendation ready: "${recommendation.lessonName}" from ${recommendation.unitName}. Reason: ${recommendation.reason}\n\nPresent this recommendation enthusiastically. If yes, use start_lesson to load it.`;
        delete (session as any).lastRecommendation;
        return result;
      }
      return `All available lessons are complete! Congratulate the student on their amazing progress.`;
    },
  },

  // === DRILL SESSION & VOCAB REVIEW ===
  {
    legacyType: 'DRILL_SESSION',
    declaration: {
      name: "drill_session",
      description: "Start a structured drill session with multiple items from a lesson or language.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What you say to introduce the drill session (spoken aloud)" },
          lessonId: { type: "string", description: "Optional: lesson ID to pull drills from" },
          drillType: { type: "string", description: "Optional: filter by drill type" },
          count: { type: "number", description: "Number of items (default: 5)" },
        },
        required: ["text"],
      },
    },
    buildContinuationResponse: ({ session }) => {
      const data = (session as any).lastDrillSessionData;
      let result: string;
      if (data && data.totalItems > 0) {
        result = `Drill session started with ${data.totalItems} practice items. Walk the student through it conversationally. Use drill_session_next with was_correct=true/false after they answer.`;
      } else {
        result = `No drill items found. Let the student know and offer to practice conversationally instead.`;
      }
      delete (session as any).lastDrillSessionData;
      return result;
    },
  },
  {
    legacyType: 'DRILL_SESSION_NEXT',
    declaration: {
      name: "drill_session_next",
      description: "Move to the next item in the drill session.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "Feedback on the previous answer (spoken aloud)" },
          was_correct: { type: "boolean", description: "Whether the student got it right" },
        },
        required: ["text", "was_correct"],
      },
    },
    buildContinuationResponse: ({ session }) => {
      const data = (session as any).lastDrillSessionData;
      let result: string;
      if (data?.sessionComplete) {
        result = `Session complete! Results: ${data.correct}/${data.totalItems} correct (${data.accuracy}% accuracy) in ${data.durationSeconds}s. Celebrate their effort.`;
      } else if (data) {
        result = `Moving to item ${data.currentItem} of ${data.totalItems}. Score so far: ${data.correctSoFar} correct, ${data.incorrectSoFar} incorrect.`;
      } else {
        result = `Drill session data unavailable. Continue the conversation normally.`;
      }
      delete (session as any).lastDrillSessionData;
      return result;
    },
  },
  {
    legacyType: 'DRILL_SESSION_END',
    declaration: {
      name: "drill_session_end",
      description: "End the current drill session early.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What you say to wrap up (spoken aloud)" },
        },
        required: ["text"],
      },
    },
    buildContinuationResponse: ({ session }) => {
      const data = (session as any).lastDrillSessionData;
      let result: string;
      if (data) {
        result = `Session ended early. Attempted ${data.itemsAttempted} of ${data.totalItems} items. ${data.correct} correct (${data.accuracy}% accuracy). Acknowledge warmly.`;
      } else {
        result = `No active drill session to end. Continue the conversation normally.`;
      }
      delete (session as any).lastDrillSessionData;
      return result;
    },
  },
  {
    legacyType: 'REVIEW_DUE_VOCAB',
    declaration: {
      name: "review_due_vocab",
      description: "Load vocabulary words due for spaced-repetition review.",
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What you say to introduce the review (spoken aloud)" },
          limit: { type: "number", description: "Max words to review (default: 10)" },
        },
        required: ["text"],
      },
    },
    buildContinuationResponse: ({ session }) => {
      const dueVocab = (session as any).lastDueVocab;
      let result: string;
      if (dueVocab && dueVocab.length > 0) {
        result = `${dueVocab.length} vocabulary words are due for review:\n${JSON.stringify(dueVocab.map((w: any) => ({ word: w.word, translation: w.translation, difficulty: w.difficulty })), null, 1)}\n\nQuiz the student on these words one at a time.`;
      } else {
        result = `No vocabulary words are due for review right now! Let the student know they're all caught up.`;
      }
      delete (session as any).lastDueVocab;
      return result;
    },
  },
];


// ============================================================
// DERIVED EXPORTS — generated from the single registry above
// ============================================================

export const DANIELA_FUNCTION_REGISTRY = registry;

export const DANIELA_FUNCTION_DECLARATIONS: FunctionDeclaration[] =
  registry.map(entry => entry.declaration);

export const FUNCTION_TO_COMMAND_MAP: Record<string, string> =
  Object.fromEntries(
    registry.map(entry => [entry.declaration.name!, entry.legacyType])
  );

const responseBuildersByLegacyType = new Map<string, NonNullable<DanielaFunctionEntry['buildContinuationResponse']>>();
for (const entry of registry) {
  if (entry.buildContinuationResponse) {
    responseBuildersByLegacyType.set(entry.legacyType, entry.buildContinuationResponse);
  }
}

/**
 * Build the continuation response text for a function call.
 * This is the text sent back to Gemini in multi-step function calling
 * to tell it what happened when we executed its function.
 * 
 * Returns either:
 *   - A string (text-only response)
 *   - A multimodal object { multimodal: true, parts: [...] }
 *   - null if no custom builder exists (falls through to default)
 */
export function buildFunctionContinuationResponse(
  session: any,
  fc: FunctionCallInfo
): string | { multimodal: true; parts: any[] } | null {
  const builder = responseBuildersByLegacyType.get(fc.legacyType);
  if (!builder) return null;
  return builder({ session, fc });
}

/**
 * Get allowed function declarations, optionally filtered.
 */
export function getFilteredFunctionDeclarations(
  allowedFunctions?: string[]
): FunctionDeclaration[] {
  if (!allowedFunctions) return DANIELA_FUNCTION_DECLARATIONS;
  return DANIELA_FUNCTION_DECLARATIONS.filter(
    fn => fn.name && allowedFunctions.includes(fn.name)
  );
}
