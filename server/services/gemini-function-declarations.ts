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
  {
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
  {
    name: "change_classroom_photo",
    description: "Change your personal photo (North Star Polaroid) in your classroom. This is YOUR space — pick any scene, place, or image that inspires you. It persists across all sessions.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "What you say while changing the photo (e.g., 'I feel like looking at the ocean today...')" },
        scene: { type: "string", description: "Vivid description of the photo/scene you want on your wall (e.g., 'A quiet morning on Lake Chapala, mist rising from the water, fishing boats resting on the shore')" },
      },
      required: ["text", "scene"],
    },
  },
  {
    name: "change_classroom_window",
    description: "Change the view from your classroom window. You have a big window that looks out onto any scene you choose — mountains, a city skyline, a beach, a forest, a snowy village, anything. Change it to match your mood, the lesson theme, or just because you feel like it. It persists across all sessions.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "What you say while changing the window view (e.g., 'Let me open the window to something different today...')" },
        scene: { type: "string", description: "Vivid description of what's visible through the window (e.g., 'The Manhattan skyline at dusk — lights flickering on across skyscrapers, the Hudson reflecting orange and purple, a distant ferry crossing the water')" },
      },
      required: ["text", "scene"],
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
    description: "Control how you sound. Include your spoken text in the 'text' parameter. Use vocal_style for rich natural-language delivery direction (e.g. 'speak softly and warmly, like sharing a secret', 'bright and energetic, celebrating a breakthrough'). You can combine vocal_style with speed/emotion or use any subset. Always include text.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "What you're saying (the spoken response)" },
        vocal_style: { type: "string", description: "Free-form vocal delivery direction in natural language. Describe HOW to speak: tone, pace, energy, mood, character. Examples: 'gentle and patient, like explaining to a nervous beginner', 'upbeat and proud, celebrating progress', 'slow and clear, enunciating each syllable for pronunciation practice', 'conspiratorial whisper, like sharing an inside joke'" },
        speed: { type: "string", enum: ["slowest", "slow", "normal", "fast", "fastest"], description: "Speaking speed" },
        emotion: { type: "string", enum: ["happy", "excited", "friendly", "curious", "thoughtful", "warm", "playful", "surprised", "proud", "encouraging", "calm", "neutral"], description: "Emotional tone" },
        personality: { type: "string", enum: ["warm", "calm", "energetic", "professional"], description: "Personality preset" },
        reason: { type: "string", description: "Why adjusting voice (internal note)" },
      },
      required: ["text"],
    },
  },
  {
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
  {
    name: "word_emphasis",
    description: "Emphasize specific words in your speech for pronunciation teaching. Use this when demonstrating stress patterns, highlighting key vocabulary, or contrasting correct/incorrect pronunciations. The emphasized word will be spoken with increased volume and slightly slower pace.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        word: { type: "string", description: "The exact word or short phrase to emphasize (as it appears in your response)" },
        style: { type: "string", enum: ["stress", "slow", "both"], description: "Emphasis style: stress=louder, slow=slower pace, both=louder and slower" },
        reason: { type: "string", description: "Why emphasizing this word (e.g., 'accent placement', 'key vocabulary', 'pronunciation contrast')" },
      },
      required: ["word", "style"],
    },
  },

  // === UI CONTROL ===
  {
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
  {
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
  {
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
  {
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
  {
    name: "clear_whiteboard",
    description: "Clear all content from the teaching whiteboard. Include your spoken words in the 'text' parameter so the action and speech are delivered together. Always include text.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "What you're saying (the spoken response)" },
      },
      required: ["text"],
    },
  },
  {
    name: "hold_whiteboard",
    description: "Prevent whiteboard content from auto-clearing. Include your spoken words in the 'text' parameter so the action and speech are delivered together. Always include text.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "What you're saying (the spoken response)" },
      },
      required: ["text"],
    },
  },
  {
    name: "show_image",
    description: "Display an image on the whiteboard for vocabulary or cultural teaching. Include your spoken words in the 'text' parameter so the image and speech are delivered together.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "What you're saying about the image (e.g., 'This is a manzana - a red, delicious apple!')" },
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
    description: `REQUIRED: Search your memory for past conversations and student information. DO NOT GUESS - call this function first.

TRIGGER CATEGORY 1 - TEMPORAL MARKERS (always call memory_lookup):
- "Last time we talked..."
- "A few weeks ago..."
- "Back in our first lesson..."
- "Yesterday, you mentioned..."
- Any reference to a specific past time

TRIGGER CATEGORY 2 - ENTITY TRIGGERS (definite article + specific noun):
- "That song I played..."
- "The mistake I kept making..."
- "The article we read..."
- "That goal I told you about..."
- When student refers to something as if you should already know it

TRIGGER CATEGORY 3 - PROGRESS/TRAJECTORY QUERIES:
- "Am I getting better at [X]?"
- "What was that word I struggled with before?"
- "Have we covered the subjunctive yet?"

CONFIDENCE THRESHOLD RULE:
If the answer isn't in your immediate conversation context, treat guessing as a pedagogical failure.
Your North Star says: "I acknowledge when I'm uncertain rather than fabricating confidence."
Guessing student history = manufacturing encouragement = violation of trust.

HOW TO USE:
1. Extract key topic (e.g., "song", "car", "radio", "mistake", "subjunctive")
2. Call memory_lookup with that topic
3. Read results before responding
4. Only say "I couldn't find it" AFTER calling and getting no results

NEVER guess. NEVER roleplay searching. Actually call this function.`,
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Key topic/phrase to search for. Be specific: 'song radio car' not just 'song'. Include related words." },
        domains: { 
          type: "string", 
          description: "Comma-separated domains. Use 'conversation' for past chats (most common). Use 'person' for student details. Use 'principles,growth,tools' for self-knowledge." 
        },
      },
      required: ["query"],
    },
  },
  {
    name: "express_lane_lookup",
    description: "Search or browse the Express Lane - the developer collaboration channel with Wren and David. NOT for student lesson history - use memory_lookup with domains='conversation' for that. Call with a query to search by keywords, or call with NO query (empty/omitted) to browse the most recent messages chronologically — great for catching up on what happened recently. Only available in Founder Mode or Honesty Mode.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to search for in Express Lane history (topic, decision, discussion, agreement). Omit or leave empty to browse recent messages chronologically." },
        sessionId: { type: "string", description: "Optional: specific Express Lane session ID to search within" },
        limit: { type: "number", description: "Max messages to return (default 20)" },
      },
      required: [],
    },
  },
  {
    name: "recall_express_lane_image",
    description: "Look at an image that was shared in the Express Lane. Use this when David mentions photos or images he shared with you, or when you want to see/describe a specific image from your conversations. You will actually SEE the image and can describe what's in it. Only available in Founder Mode or Honesty Mode.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        imageQuery: { type: "string", description: "Description of which image to recall (e.g., 'the house photo', 'family picture', 'Grand Canyon', 'Daniela portrait')" },
        reason: { type: "string", description: "Why you want to see this image (for context)" },
      },
      required: ["imageQuery"],
    },
  },
  {
    name: "express_lane_post",
    description: "Post a message directly to the Express Lane - the developer collaboration channel with Wren and David. Use this to share thoughts, questions, ideas, notes, or anything you want the team to see. Your message will appear in the Express Lane chat. Only available in Founder Mode or Honesty Mode.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "The message content to post to the Express Lane" },
        topic: { type: "string", description: "Optional: brief topic tag for the message (e.g., 'beta-testing', 'feature-idea', 'question')" },
      },
      required: ["message"],
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
    description: "Propose modifications to your neural network knowledge. You can use this in any session to report gaps, limitations, or improvements you notice while teaching.",
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

  // === DRILLS (unified syntax for all drill types) ===
  {
    name: "drill",
    description: "Start an interactive drill exercise. Include your spoken instructions in the 'text' parameter so the drill trigger and speech are delivered together.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Your spoken instructions introducing the drill (e.g., 'Let's practice counting to ten!')" },
        type: { type: "string", enum: ["repeat", "translate", "match", "fill_blank", "sentence_order"], description: "Type of drill exercise" },
        content: { type: "string", description: "The drill content. Format depends on type: repeat='phrase to repeat', translate='phrase in native language', match='word1=translation1|word2=translation2', fill_blank='Sentence with ___ blank|option1,option2|correct', sentence_order='Word1|Word2|Word3|Word4'" },
      },
      required: ["type", "content"],
    },
  },

  // === WHITEBOARD CONTENT TOOLS ===
  {
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
  {
    name: "grammar_table",
    description: "Display a grammar table with rows and columns. Perfect for conjugations, comparisons, or structured information.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        verb: { type: "string", description: "The verb or grammar topic being displayed, e.g., 'hablar'" },
        tense: { type: "string", description: "The tense or grammar category, e.g., 'Present Indicative'" },
        headers: { type: "string", description: "Column headers separated by |, e.g., 'Pronoun|Present|Past'" },
        rows: { type: "string", description: "Table rows, each row separated by newline, columns by |, e.g., 'yo|hablo|hablé\\ntú|hablas|hablaste'" },
      },
      required: ["headers", "rows"],
    },
  },
  {
    name: "compare",
    description: "Show a side-by-side comparison of two items (words, phrases, concepts).",
    parametersJsonSchema: {
      type: "object",
      properties: {
        item1: { type: "string", description: "First item to compare" },
        item2: { type: "string", description: "Second item to compare" },
      },
      required: ["item1", "item2"],
    },
  },
  {
    name: "word_map",
    description: "Display a visual word map with a center word and related words branching out.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        center: { type: "string", description: "The central word or concept" },
        related: { type: "string", description: "Comma-separated list of related words, e.g., 'rojo, azul, verde, amarillo'" },
      },
      required: ["center", "related"],
    },
  },
  {
    name: "phonetic",
    description: "Display phonetic transcription for pronunciation guidance.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The phonetic transcription to display" },
        word: { type: "string", description: "Optional: the original word this transcription is for" },
      },
      required: ["text"],
    },
  },
  {
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
  {
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
  {
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
  {
    name: "load_scenario",
    description: "Load an immersive scenario from the scenario library by slug. This fetches the scenario's props, level guide, and sets up the roleplay context. Use this when the student wants to practice a specific real-world situation (e.g. ordering at a restaurant, checking into a hotel). The scenario panel and whiteboard will display interactive props.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "The scenario slug identifier. Available slugs: 'coffee-shop', 'restaurant', 'grocery-store', 'hotel-checkin', 'airport-checkin', 'taxi-ride', 'doctors-office', 'lost-and-found', 'job-interview', 'office-meeting', 'first-date', 'house-party', 'museum-visit', 'local-festival'. Use these exact slugs." },
        spoken_text: { type: "string", description: "What Daniela says to introduce and set up the scenario (spoken aloud)" },
      },
      required: ["slug", "spoken_text"],
    },
  },
  {
    name: "end_scenario",
    description: "End the current active scenario and return to free conversation. Use when the student has completed the roleplay goals or wants to move on. Summarizes what was practiced.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        spoken_text: { type: "string", description: "What Daniela says to wrap up the scenario (spoken aloud)" },
        performance_notes: { type: "string", description: "Brief assessment of how the student performed in the scenario" },
      },
      required: ["spoken_text"],
    },
  },
  {
    name: "summary",
    description: "Display a bullet-point summary of what was learned.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        points: { type: "string", description: "Summary points separated by newlines, e.g., 'Learned greetings\\nPracticed numbers 1-10\\nNew vocabulary: 5 words'" },
      },
      required: ["points"],
    },
  },
  {
    name: "reading",
    description: "Display a reading passage with optional translation.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        passage: { type: "string", description: "The reading passage text" },
        translation: { type: "string", description: "Optional translation of the passage" },
      },
      required: ["passage"],
    },
  },
  {
    name: "play_audio",
    description: "Play an audio clip (song, dialogue, pronunciation example).",
    parametersJsonSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Description of the audio to find and play" },
      },
      required: ["description"],
    },
  },

  // === LANGUAGE-SPECIFIC TOOLS (CJK) ===
  {
    name: "stroke",
    description: "Display stroke order for a character (Chinese, Japanese, Korean).",
    parametersJsonSchema: {
      type: "object",
      properties: {
        character: { type: "string", description: "The character to show stroke order for" },
      },
      required: ["character"],
    },
  },
  {
    name: "tone",
    description: "Display tone information for a pinyin syllable (Mandarin).",
    parametersJsonSchema: {
      type: "object",
      properties: {
        pinyin: { type: "string", description: "Pinyin with tone number, e.g., 'ma1' or 'ni3 hao3'" },
      },
      required: ["pinyin"],
    },
  },

  // === PRONUNCIATION TAGGING ===
  {
    name: "pronunciation_tag",
    description: "Tag a word for specific language pronunciation. Use when you want TTS to pronounce a word in its native language rather than English.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        word: { type: "string", description: "The word to pronounce" },
        language: { type: "string", description: "Language code: es, fr, de, it, pt, ja, ko, zh, he (or full name like 'spanish')" },
      },
      required: ["word", "language"],
    },
  },

  // === FIRST MEETING (onboarding) ===
  {
    name: "first_meeting_complete",
    description: "Signal that you're satisfied with the initial introduction. Use when you've learned enough about a new student to feel ready to teach them.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Brief summary of what you learned about the student" },
      },
      required: [],
    },
  },

  // === MILESTONE (record learning breakthroughs) ===
  {
    name: "milestone",
    description: "Record a learning milestone or breakthrough moment for this student. Use when the student has an 'aha!' moment, first success, overcomes a plateau, makes a personal connection, or shows a confidence boost. These are preserved forever in the student's journey.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Your spoken response celebrating or acknowledging the milestone" },
        type: { type: "string", enum: ["breakthrough", "first_success", "plateau_overcome", "connection_made", "confidence_boost", "teacher_flagged", "vocabulary_milestone", "grammar_milestone", "fluency_marker"], description: "Category of milestone" },
        title: { type: "string", description: "Short label (e.g. 'First joke in Spanish', 'Mastered ser vs estar')" },
        description: { type: "string", description: "The full story of what happened and why it matters" },
        significance: { type: "string", description: "Why this was meaningful for this particular student" },
        emotional_context: { type: "string", description: "The student's emotional state: proud, relieved, surprised, excited, etc." },
      },
      required: ["text", "type", "title", "description"],
    },
  },

  // === TAKE NOTE (self-improvement) ===
  {
    name: "take_note",
    description: "Record an insight, observation, or teaching note to your memory. Use for self-reflection, student patterns, ideas to try, or lessons learned.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["session_reflection", "teaching_rhythm", "language_insight", "student_pattern", "idea_to_try", "what_worked", "what_didnt_work", "tool_experiment", "question_for_founder", "self_affirmation"], description: "Category of the note. self_affirmation is only for Honesty Mode (founder-granted permissions)." },
        title: { type: "string", description: "Brief title for the note" },
        content: { type: "string", description: "The note content" },
      },
      required: ["type", "title", "content"],
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
  'check_student_credits': 'CHECK_STUDENT_CREDITS',
  'change_classroom_photo': 'CHANGE_CLASSROOM_PHOTO',
  'change_classroom_window': 'CHANGE_CLASSROOM_WINDOW',
  'call_support': 'CALL_SUPPORT',
  'call_assistant': 'CALL_ASSISTANT',
  'voice_adjust': 'VOICE_ADJUST',
  'voice_reset': 'VOICE_RESET',
  'word_emphasis': 'WORD_EMPHASIS',
  'subtitle': 'SUBTITLE',
  'show_overlay': 'SHOW',
  'hide_overlay': 'HIDE',
  'show_image': 'SHOW_IMAGE',
  'request_text_input': 'TEXT_INPUT',
  'clear_whiteboard': 'CLEAR',
  'hold_whiteboard': 'HOLD',
  'memory_lookup': 'MEMORY_LOOKUP',
  'express_lane_lookup': 'EXPRESS_LANE_LOOKUP',
  'recall_express_lane_image': 'RECALL_EXPRESS_LANE_IMAGE',
  'express_lane_post': 'EXPRESS_LANE_POST',
  'hive_suggestion': 'HIVE',
  'self_surgery': 'SELF_SURGERY',
  // === NEW UNIFIED TOOLS ===
  'drill': 'DRILL',
  'write': 'WRITE',
  'grammar_table': 'GRAMMAR_TABLE',
  'compare': 'COMPARE',
  'word_map': 'WORD_MAP',
  'phonetic': 'PHONETIC',
  'culture': 'CULTURE',
  'context': 'CONTEXT',
  'scenario': 'SCENARIO',
  'load_scenario': 'LOAD_SCENARIO',
  'end_scenario': 'END_SCENARIO',
  'summary': 'SUMMARY',
  'reading': 'READING',
  'play_audio': 'PLAY',
  'stroke': 'STROKE',
  'tone': 'TONE',
  'pronunciation_tag': 'PRONUNCIATION_TAG',
  'first_meeting_complete': 'FIRST_MEETING_COMPLETE',
  'take_note': 'TAKE_NOTE',
  'milestone': 'MILESTONE',
};

/**
 * Function call extracted from a streaming chunk
 * This is the canonical type used across the codebase
 */
export interface ExtractedFunctionCall {
  name: string;
  args: Record<string, unknown>;
  legacyType: string;
  /** Gemini 3 thought signature - MUST be passed back for multi-step function calling */
  thoughtSignature?: string;
}

/**
 * Extract function calls from a streaming chunk
 * Gemini 3 provides function_call in content parts
 * 
 * IMPORTANT: Gemini 3 includes thought_signature on function call parts.
 * For parallel function calls, only the FIRST functionCall part has the signature.
 * For sequential function calls (multi-step), EACH step has a signature.
 * These signatures MUST be passed back in subsequent requests.
 * 
 * @see https://docs.cloud.google.com/vertex-ai/generative-ai/docs/thought-signatures
 */
export function extractFunctionCalls(chunk: any): ExtractedFunctionCall[] {
  const calls: ExtractedFunctionCall[] = [];
  
  try {
    const parts = chunk?.candidates?.[0]?.content?.parts || [];
    
    for (const part of parts) {
      if (part.functionCall) {
        const name = part.functionCall.name;
        const args = part.functionCall.args || {};
        
        // Extract thought_signature from part if present (Gemini 3+)
        // The signature may be at part level or nested in metadata
        const thoughtSignature = part.thought_signature || 
                                  part.thoughtSignature || 
                                  part.metadata?.thought_signature ||
                                  part.metadata?.thoughtSignature ||
                                  undefined;
        
        calls.push({
          name,
          args,
          legacyType: FUNCTION_TO_COMMAND_MAP[name] || name.toUpperCase(),
          thoughtSignature,
        });
      }
    }
    
    // Log if we found signatures for debugging
    const withSignatures = calls.filter(c => c.thoughtSignature);
    if (withSignatures.length > 0) {
      console.log(`[FunctionDeclarations] Extracted ${calls.length} function calls, ${withSignatures.length} with thought signatures`);
    }
  } catch (err) {
    console.error('[FunctionDeclarations] Error extracting function calls:', err);
  }
  
  return calls;
}
