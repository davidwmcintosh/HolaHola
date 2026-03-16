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
  {
    legacyType: 'GENERATE_VISUAL',
    declaration: {
      name: "generate_visual",
      description: `Create a custom AI-generated illustration to display on the whiteboard. The image is shown as a full visual card — no background removal needed, no compositing.

USE generate_visual for:
1. ANY vocabulary noun that is NOT in the zone-compatible prop list (see compose_visual_scene). For example: maleta, estetoscopio, carrito de compras, termómetro, pasaporte — these are vocab-only props and must use generate_visual, not compose_visual_scene. NOTE: mochila (backpack) IS zone-compatible — use compose_visual_scene for it.
2. NEW props you are creating on-the-fly for vocabulary practice — generate them with "warm illustrated watercolor style, vibrant colours" and they will be saved to the library automatically.
3. Abstract grammar concepts (verb tense timelines, sentence structure diagrams)
4. Rich cultural scenes with no equivalent prop-room environment
5. Anything where a full illustrated scene works better than a composited prop

⚠️ DO NOT use generate_visual for PREPOSITION teaching (sobre, debajo de, al lado de) — use compose_visual_scene (Mode B) with a zone environment and a zone-compatible prop instead.
⚠️ For zone-compatible props (cup, plate, fork, book, apple, etc.) in vocabulary context (Mode A), prefer compose_visual_scene with a wide environment — it is instant and free.

Style hint for new vocab props: always request "warm illustrated watercolor style, vibrant saturated colours" — this matches the existing visual library and creates a consistent look across all lessons.

The image will appear on the whiteboard in a few seconds while you continue speaking. Include natural conversational words in the 'text' parameter — NOT a description of the image.`,
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What you're SAYING aloud — natural conversational speech, e.g. 'Let me show you a scene!' Do NOT write an image description here." },
          concept: { type: "string", description: "What to illustrate — be specific and descriptive, e.g. 'a Mexican family sharing a meal at a colorful kitchen table'" },
          style: { type: "string", description: "Art style or mood, e.g. 'warm, friendly illustration' or 'bright educational poster'. Defaults to warm educational illustration." },
        },
        required: ["concept"],
      },
    },
    buildContinuationResponse: ({ fc }) => {
      const concept = fc.args.concept as string | undefined;
      return `Image generation started for "${concept || 'the concept'}". The illustration will appear on the student's screen in a few seconds. Continue the conversation naturally — say something brief and encouraging while they wait.`;
    },
  },

  // === PROP ROOM (VISUAL COMPOSITION) ===
  {
    legacyType: 'COMPOSE_VISUAL',
    declaration: {
      name: "compose_visual_scene",
      description: `Composite a prop from the library onto a base environment. Instant (no DALL-E cost), consistent style.
Use for: preposition lessons (Mode B) and vocabulary reinforcement using zone-compatible props (Mode A).
NOT for vocab display of non-zone props — use generate_visual for those.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ZONE-COMPATIBLE PROPS (can be used in BOTH Mode A and Mode B):
  cup, glass, wine_glass, water_pitcher
  espresso, latte, coffee, hot chocolate, coffee with cream
  plate, dinner_plate, fork, knife, spoon, napkin, bread_basket, salt_pepper
  book, cell_phone, menu_card, candle
  apple, croissant
  backpack

Any other prop (maleta, estetoscopio, carro de compras, termómetro, pasaporte, etc.)
→ use generate_visual instead. These are vocab-only props shown as full images.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TWO MODES:

MODE A — VOCABULARY IN CONTEXT (most lessons):
Use any WIDE environment as a backdrop; prop floats at foreground/center for vocabulary reinforcement.
Only zone-compatible props work here (see list above). For others, use generate_visual.
Example: cafe + cup + foreground = "la taza" in context.

MODE B — PREPOSITION LESSONS only:
The spatial relationship IS the lesson. Use ONLY zone environments with zone-compatible props.
Call this function TWICE (same prop, different position) for maximum spatial contrast.
ESPECIALLY effective: cup on_table → cup under_table shows "sobre/debajo de" unmistakably.
Also great: backpack under_table (the mochila is a natural café floor prop — use restaurant_table environment).

ZONE ENVIRONMENTS (Mode B only):
- restaurant_table  → on_table, under_table, beside_table, on_chair, on_floor
- kitchen_counter   → on_counter, under_counter, on_floor
- bedroom_closeup   → beside_bed, on_table (nightstand), on_chair, on_floor
- desk_closeup      → on_table, under_table, on_chair, on_floor

WIDE ENVIRONMENTS (Mode A only):
- cafe, kitchen, living_room, bedroom, bathroom, office, classroom, doctor_office
  → center, left, right, foreground, background
- airport, city_street, park, hotel_lobby, outdoor_market, grocery_store
  → center, foreground, background only

PREPOSITION → POSITION MAPPING:
- sobre / encima de / on top of → on_table or on_counter
- debajo de / under → under_table, under_counter, or on_floor
- al lado de / beside → beside_table or beside_bed
- en el piso / on the floor → on_floor
- en la silla / on the chair → on_chair`,
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What you're SAYING aloud — natural conversational speech. Do NOT write an image description here." },
          environment: {
            type: "string",
            description: "The base scene to use",
            enum: ["cafe", "restaurant_table", "hotel_lobby", "kitchen", "living_room", "bedroom", "bathroom", "park", "airport", "city_street", "office", "classroom", "outdoor_market", "grocery_store", "doctor_office", "kitchen_counter", "bedroom_closeup", "desk_closeup"],
          },
          objects: {
            type: "array",
            description: "Objects to place in the scene",
            items: {
              type: "object",
              properties: {
                term: { type: "string", description: "The vocabulary word (e.g. 'taza', 'maleta', 'cama') in any language" },
                position: {
                  type: "string",
                  description: "Where to place the object",
                  enum: ["center", "left", "right", "foreground", "background", "on_table", "under_table", "on_floor", "beside_bed", "on_counter", "under_counter", "in_hand", "on_chair", "beside_table"],
                },
                emphasis: { type: "boolean", description: "Highlight this object with a glow (use for the focus vocab word)" },
              },
              required: ["term"],
            },
          },
          preposition_context: {
            type: "string",
            description: "If teaching a preposition, name it (e.g. 'sobre', 'debajo de', 'al lado de') — helps cache the scene for reuse",
          },
        },
        required: ["environment", "objects"],
      },
    },
    buildContinuationResponse: ({ fc }) => {
      const env = fc.args.environment as string | undefined;
      const objs = (fc.args.objects as any[] | undefined) ?? [];
      const terms = objs.map((o: any) => o.term).join(', ');
      return `Scene composition started for ${env || 'the scene'} with: ${terms || 'objects'}. The image will appear on the student's screen in a moment. Continue the lesson naturally.`;
    },
  },
  {
    legacyType: 'SEARCH_VISUAL_LIBRARY',
    declaration: {
      name: "search_visual_library",
      description: `Search the prop room library to see which environments and objects are available for compose_visual_scene.
Call this when you want to know if a particular word or scene is in the library before composing.`,
      parametersJsonSchema: {
        type: "object",
        properties: {
          term: { type: "string", description: "Word or concept to search for (Spanish or English)" },
        },
        required: ["term"],
      },
    },
    buildContinuationResponse: ({ fc }) => {
      return `Library search complete for "${fc.args.term}". If the environment or objects are in the library, use compose_visual_scene — do NOT fall back to generate_visual unless the required assets are genuinely absent from the library.`;
    },
  },
  {
    legacyType: 'GET_SCENE_ZONES',
    declaration: {
      name: "get_scene_zones",
      description: `Get the available zones for a scene (environment) in the prop room library.
Zones define the pedagogical areas within a scene — each with a type that tells you how to teach:
  - spatial: teach prepositions and object placement (on/under/beside/in)
  - interactional: teach dialogue sequences and social language functions (ordering, checking in, asking for help)
  - departmental: teach vocabulary categories (produce names, menu items, medications)
  - navigational: teach directions and wayfinding language

Call this before compose_visual_scene to know which zones exist for a given scene so you can
place objects in the right zones and use the correct teaching approach for each zone.`,
      parametersJsonSchema: {
        type: "object",
        properties: {
          scene_name: { type: "string", description: "The environment/scene name (e.g. 'restaurant_table', 'hotel_lobby', 'grocery_store')" },
        },
        required: ["scene_name"],
      },
    },
    buildContinuationResponse: ({ fc }) => {
      return `Scene zones loaded for "${fc.args.scene_name}". Use the zone info to choose the right teaching approach and object placement.`;
    },
  },

  // === INTERACTIVE SCENE CANVAS ===

  {
    legacyType: 'OPEN_SCENE',
    declaration: {
      name: "open_scene",
      description: `Open a persistent live canvas with a background environment.
Unlike compose_visual_scene (which generates a flat one-shot image), open_scene starts a LIVE STAGE
that persists across the lesson. You can then add, remove, or change props on it at any time
without regenerating anything.

Use open_scene at the START of a lesson segment that will involve a sequence of visual actions:
- A restaurant ordering sequence (water → appetizer → main → dessert → la cuenta)
- A time lesson where you'll move clock hands between expressions  
- A progressive vocabulary build-up in a kitchen/café/market

After open_scene, use add_to_scene / remove_from_scene / set_clock to update the canvas.
Use clear_scene to empty all props (keeping the background).

⚠️ For single static vocabulary displays, stick to compose_visual_scene — it is cached and faster.
Use the live canvas only when the SEQUENCE of changes is pedagogically meaningful.`,
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What you're saying aloud as you open the scene." },
          environment: {
            type: "string",
            description: "The background environment to load.",
            enum: ["cafe", "restaurant_table", "hotel_lobby", "kitchen", "living_room", "bedroom", "bathroom", "park", "airport", "city_street", "office", "classroom", "outdoor_market", "grocery_store", "doctor_office", "kitchen_counter", "bedroom_closeup", "desk_closeup"],
          },
          label: { type: "string", description: "Optional short label shown as the scene title (e.g. 'En el restaurante')" },
        },
        required: ["environment"],
      },
    },
    buildContinuationResponse: ({ fc }) => {
      const env = (fc.args.environment as string || 'the scene').replace(/_/g, ' ');
      return `Scene opened: ${env}. You can now use add_to_scene, remove_from_scene, set_clock, or clear_scene to update the live canvas.`;
    },
  },

  {
    legacyType: 'ADD_TO_SCENE',
    declaration: {
      name: "add_to_scene",
      description: `Add a prop to the live scene canvas. The prop slides in with a gentle animation.

Only works after open_scene has been called. Zone-compatible props:
  Drinks:      cup, glass, wine_glass, water_pitcher
               espresso, latte, coffee, hot chocolate, coffee with cream
  Food:        plate, dinner_plate, bread_basket, apple, croissant
  Utensils:    fork, knife, spoon, napkin
  Condiments:  salt_pepper, ketchup, mustard, hot_sauce, butter, jam, sugar_packets
  Menus:       menu_card, breakfast_menu, lunch_menu, dinner_menu
  Other:       book, cell_phone, candle, backpack

POSITIONING — each prop must use a DIFFERENT position. The positions form a layout:

  RESTAURANT TABLE LAYOUT (use these for restaurant/café scenes):
  ┌─────────────────────────────────────────────────┐
  │ bread_corner    glass_spot   condiment_1/2/3/4  │  ← back of table
  │                                                  │
  │  place_left    center/plate    place_right       │  ← near student
  └─────────────────────────────────────────────────┘

  Recommended assignments:
    Plate:          center          Fork:           place_left
    Knife/spoon:    place_right     Napkin:         place_left
    Water glass:    glass_spot      Wine glass:     glass_spot
    Bread basket:   bread_corner    Menu:           left
    Candle:         right           Salt & pepper:  condiment_1
    Ketchup:        condiment_1     Mustard:        condiment_2
    Hot sauce:      condiment_3     Sugar packets:  condiment_4

  GENERIC positions (for non-restaurant scenes):
    left | center | right | foreground | background
    on_table | on_counter | beside_table | in_hand | on_chair

The system auto-repositions if two props would overlap, but specifying correct positions explicitly always looks best.
If a prop is already on the canvas, calling add_to_scene again replaces it in place.`,
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What you're saying as this prop arrives (e.g. 'Aquí llega el agua...')" },
          prop_name: {
            type: "string",
            description: "The prop to add.",
            enum: [
              "cup","glass","wine_glass","water_pitcher",
              "espresso","latte","coffee","hot chocolate","coffee with cream",
              "plate","dinner_plate","fork","knife","spoon","napkin","bread_basket",
              "salt_pepper","ketchup","mustard","hot_sauce","butter","jam","sugar_packets",
              "menu_card","breakfast_menu","lunch_menu","dinner_menu",
              "book","cell_phone","candle","apple","croissant","backpack"
            ],
          },
          position: {
            type: "string",
            description: "Where to place the prop on the canvas. For restaurant tables use the specific table positions.",
            enum: [
              "center","left","right","foreground","background",
              "on_table","under_table","on_floor","beside_bed","on_counter","under_counter","in_hand","on_chair","beside_table",
              "place_left","place_right","glass_spot","bread_corner",
              "condiment_1","condiment_2","condiment_3","condiment_4"
            ],
          },
          label: { type: "string", description: "Target-language label shown under the prop (e.g. 'el vaso'). Defaults to the prop name." },
        },
        required: ["prop_name", "position"],
      },
    },
    buildContinuationResponse: ({ fc }) => {
      const prop = fc.args.prop_name as string || 'prop';
      const pos = fc.args.position as string || 'position';
      return `Added ${prop} at ${pos} on the live canvas. Continue the lesson — the prop is now visible to the student.`;
    },
  },

  {
    legacyType: 'REMOVE_FROM_SCENE',
    declaration: {
      name: "remove_from_scene",
      description: `Remove a prop from the live scene canvas. It fades out smoothly.
Use this during a progressive sequence — e.g. after the student finishes the main course, remove the dinner_plate before adding dessert.`,
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What you're saying as this prop disappears." },
          prop_name: { type: "string", description: "The prop to remove (must match what was added earlier)." },
        },
        required: ["prop_name"],
      },
    },
    buildContinuationResponse: ({ fc }) => {
      return `Removed ${fc.args.prop_name} from the live canvas.`;
    },
  },

  {
    legacyType: 'CLEAR_SCENE',
    declaration: {
      name: "clear_scene",
      description: `Remove all props from the live canvas. The background stays. Use between major scene segments.`,
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What you're saying as the scene clears." },
        },
        required: [],
      },
    },
    buildContinuationResponse: () => `Live canvas cleared — all props removed. The background is still showing.`,
  },

  {
    legacyType: 'SET_CLOCK',
    declaration: {
      name: "set_clock",
      description: `Show an analog clock on the whiteboard set to a specific time.
The clock is an SVG component — no image generation needed. The hands animate to the correct position.
Call set_clock each time you introduce a new time expression:
  "Son las tres" → set_clock("3:00")
  "Son las tres y cuarto" → set_clock("3:15")
  "Son las cuatro menos diez" → set_clock("3:50")

If a scene canvas is already open (via open_scene), the clock appears as an overlay in the corner.
If no scene is open, the clock is shown centered on its own.

After set_clock, say the time expression naturally in your speech.`,
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What you're saying — include the time expression naturally." },
          time: { type: "string", description: "Time in H:MM or HH:MM format (24h accepted — e.g. '15:30' for 3:30 PM). Examples: '3:00', '3:15', '15:30', '12:00'" },
        },
        required: ["time"],
      },
    },
    buildContinuationResponse: ({ fc }) => {
      return `Clock set to ${fc.args.time}. The analog clock is now showing on the student's screen. Continue saying the time expression.`;
    },
  },

  // === IMMERSIVE MODE ===

  {
    legacyType: 'ENTER_IMMERSIVE',
    declaration: {
      name: "enter_immersive",
      description: `Enter fullscreen immersive mode on the student's screen.
Use this right before beginning a roleplay scenario so the student is fully immersed.
The student's screen goes fullscreen showing only the live scene canvas.

IMPORTANT — set up the FULL scene BEFORE calling enter_immersive:
1. Call open_scene(environment) to load the background
2. Call add_to_scene() for every prop that should already be visible:
   - Restaurant table: breakfast_menu/lunch_menu/dinner_menu (position: left), candle (right),
     salt_pepper (condiment_1), bread_basket (bread_corner), water_pitcher (glass_spot)
   - Add ketchup (condiment_1), mustard (condiment_2) etc. if appropriate for the meal
3. THEN call enter_immersive() — the student sees a fully dressed scene immediately

Use the appropriate meal-time menu: breakfast_menu for morning, lunch_menu for midday,
dinner_menu for evening. Only use the generic menu_card if the time of day is unknown.

Do NOT wait until the student orders to add initial scene dressing.

An exit button is always visible so the student can leave at any time.`,
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What you say aloud as you enter immersive mode — your opening line of the scenario." },
        },
        required: [],
      },
    },
    buildContinuationResponse: () => `Immersive mode activated. The student's screen is now fullscreen. Begin the roleplay scenario now.`,
  },

  {
    legacyType: 'EXIT_IMMERSIVE',
    declaration: {
      name: "exit_immersive",
      description: `Exit fullscreen immersive mode and return to the normal lesson view.
Call this when the roleplay or scenario is complete, or when you need to return to teaching mode.
Use this after giving performance feedback or when transitioning to a new activity.`,
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What you say aloud as you exit immersive mode — e.g. wrapping up the scenario." },
        },
        required: [],
      },
    },
    buildContinuationResponse: () => `Immersive mode deactivated. The student's screen has returned to normal lesson view.`,
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
      description: `Update a scenario prop's content fields in the Studio panel. This is how you keep the on-screen bill/receipt live and accurate during commerce and hospitality scenarios.

BILL TALLYING — critical for café, restaurant, grocery, hotel, and taxi scenarios:
- Every time the student successfully orders or confirms an item, call update_prop to add it to the bill.
- Update the "Items / Artículos" field with a running list (e.g. "1x Café con leche 3.50€\\n1x Croissant 2.00€").
- After each addition, recalculate and update Subtotal and Total fields.
- When the student asks for the bill ("la cuenta", "¿me puede traer la cuenta?", "l'addition", etc.), update the Total to the final amount with any tax applied.
- When simulating payment / change, update relevant fields to reflect the tendered amount and change given.

USE THIS whenever:
- A student orders an item (add it to Items and update running total)
- They ask for the bill (confirm final Total)
- They pay or receive change (add a "Paid / Pagado" and "Change / Cambio" field)
- Any prop field needs to reflect what's happened in the conversation (room number, driver name, destination, etc.)

prop_title must exactly match the prop's title as shown in the Studio panel (e.g. "Receipt/Bill", "Check/Bill", "Hotel Invoice", "Taxi Receipt").`,
      parametersJsonSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What you say while updating the prop (spoken aloud). Keep it natural — e.g. 'Let me add that to your order.' or 'Here is your bill.')" },
          prop_title: { type: "string", description: "Title of the prop to update. Must exactly match the prop title shown in Studio (e.g. 'Receipt/Bill', 'Check/Bill', 'Hotel Invoice', 'Taxi Receipt')." },
          updates: {
            type: "array",
            description: "Array of field updates. Each entry specifies a label (must match an existing field label) and its new value. To add a new line item, set label='Items / Artículos' with the full updated multi-line string. Always also update Subtotal and Total when items change.",
            items: {
              type: "object",
              properties: {
                label: { type: "string", description: "The field label to update (e.g. 'Items / Artículos', 'Subtotal', 'Total', 'Tax / Impuesto (IVA 10%)')" },
                value: { type: "string", description: "The new value for that field (e.g. '1x Café con leche 3.50€\\n1x Croissant 2.00€', '5.50€', '6.05€')" },
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
  {
    legacyType: 'MARK_LESSON_COVERED',
    declaration: {
      name: "mark_lesson_covered",
      description: `Mark a curriculum lesson as "covered in conversation" so it shows as "Daniela covered" in the student's interactive textbook.

USE THIS FUNCTION when you have naturally taught or practiced the core content of a specific lesson — vocabulary set, grammar topic, or scenario — during conversation. This helps the student see their textbook and chat progress in one place.

ONLY call this after genuinely covering the lesson content (not just mentioning it briefly). The lesson ID should come from the student's lesson context or from a load_lesson call earlier in the session.

DO NOT call this for every exchange — only when a full lesson's worth of material has been meaningfully introduced or practiced.`,
      parametersJsonSchema: {
        type: "object",
        properties: {
          lessonId: { type: "string", description: "The curriculum lesson ID that was covered in this conversation" },
          text: { type: "string", description: "What you say to the student after covering the lesson (optional confirmation, or empty string)" },
        },
        required: ["lessonId", "text"],
      },
    },
    buildContinuationResponse: ({ session, fc }) => {
      const lessonId = fc.args?.lessonId;
      const covered = (session as any).lastLessonCoveredResult;
      delete (session as any).lastLessonCoveredResult;
      if (covered?.success) {
        return `Lesson "${lessonId}" has been marked as covered in conversation. The student's textbook will now show the "Daniela covered" badge for this lesson.`;
      }
      return `Could not mark lesson "${lessonId}" as covered — it may not exist or the student may not be enrolled. Continue the conversation normally.`;
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
