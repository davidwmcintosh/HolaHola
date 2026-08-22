/**
 * Tool Manifest Service — Gap E (Contextual Tool Manifest / 64-Tool Router)
 *
 * Selects which tools Daniela gets based on:
 *   1. Core tools (30): always present regardless of language or goal
 *   2. Dynamic slots (34): selected from the Pathfinder advisory + target language context
 *
 * Why this matters: Gemini Flash has 169 tools in the registry. Dumping all 169 into
 * every session bloats the system prompt by ~14K tokens, crowds the dispatcher, and
 * makes tool selection noisier. Scoping to 64 relevant tools improves signal clarity
 * and reduces "generic tool soup" choices.
 *
 * The manifest does NOT remove tools from the function registry — it shapes which
 * declarations are highlighted in the dispatcher system prompt as "available this session."
 * The underlying registry remains the source of truth for all tool metadata.
 *
 * Usage: call getSessionToolManifest(session) at GL session start.
 * Returns a ToolManifest with coreTool names + dynamicTool names + a log-friendly summary.
 */

export interface ToolManifest {
  /** Tools always available — core language learning + session management */
  coreTools: string[];
  /** Tools selected dynamically based on language and Pathfinder goal */
  dynamicTools: string[];
  /** All selected tools combined */
  allTools: string[];
  /** Human-readable selection rationale for logging */
  selectionSummary: string;
}

/** Tools that should be present in EVERY session regardless of language or goal */
const CORE_TOOLS: string[] = [
  // Memory and student understanding
  'commit_to_memory',
  'introspect',
  'get_student_pulse',
  'search_knowledge_base',
  'read_full_memory',

  // Session management
  'set_mission_objective',
  'end_session',
  'request_tutor_switch',

  // Core teaching tools
  'show_image',
  'whiteboard_widget',
  'classroom_widget',
  'show_vocabulary_image',
  'start_flashcard_session',
  'show_word_map',
  'show_sentence_breakdown',

  // Grammar and language tools
  'show_comparison_widget',
  'show_grammar_diagram',
  'show_sentence_table',

  // Feedback and assessment
  'show_pronunciation_score',
  'show_grammar_flag',
  'mark_lesson_covered',
  'commit_coverage_flag',
  'commit_knowledge_domain_flag',

  // Navigation
  'start_textbook_page',
  'show_vocab_grid',
  'request_text_input',

  // Communication
  'save_to_notebook',
  'send_lesson_note',
  'request_sprint',
];

/** Language-specific dynamic tools */
const LANGUAGE_TOOL_MAP: Record<string, string[]> = {
  japanese: [
    'show_kanji_breakdown',
    'show_hiragana_chart',
    'show_katakana_chart',
    'show_jlpt_card',
    'show_kanji_stroke_order',
    'show_furigana_widget',
    'show_pitch_accent_widget',
  ],
  mandarin: [
    'show_hanzi_breakdown',
    'show_pinyin_chart',
    'show_tone_diagram',
    'show_hsk_card',
    'show_stroke_order',
    'show_radical_widget',
  ],
  korean: [
    'show_hangul_chart',
    'show_honorific_chart',
    'show_particle_map',
  ],
  arabic: [
    'show_arabic_script_widget',
    'show_arabic_vowels_chart',
    'show_root_word_map',
  ],
  russian: [
    'show_cyrillic_chart',
    'show_case_table',
    'show_aspect_pair_widget',
  ],
};

/** Goal-specific dynamic tools based on Pathfinder advisory */
const GOAL_TOOL_MAP: Record<string, string[]> = {
  // Travel and practical communication
  travel: [
    'show_scenario_map',
    'show_menu_widget',
    'show_transport_phrases',
    'start_role_play',
    'show_cultural_context',
  ],
  restaurant: [
    'show_menu_widget',
    'show_ordering_phrases',
    'start_role_play',
    'show_cultural_context',
  ],
  business: [
    'show_formal_register_guide',
    'show_meeting_phrases',
    'start_role_play',
    'show_email_template',
  ],
  conversation: [
    'start_role_play',
    'show_conversation_starters',
    'show_filler_phrases',
    'show_cultural_context',
  ],
  exam: [
    'show_grammar_flag',
    'show_quiz',
    'show_conjugation_table',
    'show_error_pattern',
    'commit_knowledge_domain_flag',
  ],
  grammar: [
    'show_conjugation_table',
    'show_grammar_diagram',
    'show_error_pattern',
    'show_quiz',
    'show_sentence_breakdown',
  ],
  reading: [
    'show_text_passage',
    'show_vocabulary_image',
    'show_word_map',
    'show_cultural_context',
  ],
};

/** Detect goal category from Pathfinder advisory text */
function detectGoalCategory(pathfinderAdvisory?: string): string | null {
  if (!pathfinderAdvisory) return null;
  const lower = pathfinderAdvisory.toLowerCase();
  if (lower.includes('travel') || lower.includes('trip') || lower.includes('airport')) return 'travel';
  if (lower.includes('restaurant') || lower.includes('food') || lower.includes('menu') || lower.includes('order')) return 'restaurant';
  if (lower.includes('business') || lower.includes('work') || lower.includes('professional') || lower.includes('meeting')) return 'business';
  if (lower.includes('conversation') || lower.includes('speak') || lower.includes('fluent') || lower.includes('chat')) return 'conversation';
  if (lower.includes('exam') || lower.includes('test') || lower.includes('jlpt') || lower.includes('dele') || lower.includes('delf') || lower.includes('hsk')) return 'exam';
  if (lower.includes('grammar') || lower.includes('conjugat') || lower.includes('tense') || lower.includes('verb')) return 'grammar';
  if (lower.includes('read') || lower.includes('text') || lower.includes('passage') || lower.includes('article')) return 'reading';
  return null;
}

/** Normalize language name to a key for the tool map */
function normalizeLanguage(language: string): string {
  const lower = language.toLowerCase();
  if (lower.includes('japanese') || lower === 'japanese') return 'japanese';
  if (lower.includes('mandarin') || lower.includes('chinese') || lower === 'mandarin') return 'mandarin';
  if (lower.includes('korean') || lower === 'korean') return 'korean';
  if (lower.includes('arabic') || lower === 'arabic') return 'arabic';
  if (lower.includes('russian') || lower === 'russian') return 'russian';
  return 'default';
}

/**
 * Build a contextual tool manifest for a GL session.
 *
 * @param context Session context used for manifest selection
 * @returns ToolManifest with core + dynamic tool lists and selection summary
 */
export function getSessionToolManifest(context: {
  targetLanguage?: string;
  pathfinderAdvisory?: string;
  studentActflLevel?: string;
}): ToolManifest {
  const { targetLanguage = 'Spanish', pathfinderAdvisory, studentActflLevel } = context;

  const coreTools = [...CORE_TOOLS];
  const dynamicTools: string[] = [];
  const reasons: string[] = [];

  // 1. Language-specific tools
  const langKey = normalizeLanguage(targetLanguage);
  const langTools = LANGUAGE_TOOL_MAP[langKey];
  if (langTools) {
    dynamicTools.push(...langTools);
    reasons.push(`${targetLanguage} script/system tools`);
  }

  // 2. Goal-specific tools from Pathfinder advisory
  const goalCategory = detectGoalCategory(pathfinderAdvisory);
  if (goalCategory) {
    const goalTools = GOAL_TOOL_MAP[goalCategory] || [];
    // Avoid duplicates
    goalTools.forEach(t => { if (!dynamicTools.includes(t)) dynamicTools.push(t); });
    reasons.push(`${goalCategory} goal tools`);
  }

  // 3. Level-based tool additions
  if (studentActflLevel && (studentActflLevel.startsWith('advanced') || studentActflLevel === 'superior')) {
    // Advanced learners: add nuanced tools if not already there
    const advancedTools = ['show_error_pattern', 'show_formal_register_guide', 'commit_knowledge_domain_flag'];
    advancedTools.forEach(t => { if (!dynamicTools.includes(t)) dynamicTools.push(t); });
    reasons.push('advanced-level tools');
  }

  // Cap dynamic tools at 34
  const cappedDynamic = dynamicTools.slice(0, 34);

  const allTools = [...new Set([...coreTools, ...cappedDynamic])];

  const selectionSummary = [
    `${coreTools.length} core + ${cappedDynamic.length} dynamic = ${allTools.length} total tools`,
    `Language: ${targetLanguage} (${langKey})`,
    goalCategory ? `Goal: ${goalCategory}` : 'Goal: general',
    reasons.length > 0 ? `Selected: ${reasons.join(', ')}` : 'No dynamic additions',
  ].join(' | ');

  return { coreTools, dynamicTools: cappedDynamic, allTools, selectionSummary };
}

/**
 * Build the session-start tool manifest log line for the system prompt.
 * Injected as a compact note in the dispatcher section so Daniela knows
 * which tools are most relevant this session — without bloating the prompt.
 */
export function buildToolManifestNote(manifest: ToolManifest): string {
  const dynamicSummary = manifest.dynamicTools.length > 0
    ? `Dynamic tools this session: ${manifest.dynamicTools.slice(0, 10).join(', ')}${manifest.dynamicTools.length > 10 ? ` (+${manifest.dynamicTools.length - 10} more)` : ''}.`
    : '';
  return dynamicSummary
    ? `[Session tool manifest: ${manifest.allTools.length} tools available. ${dynamicSummary}]`
    : `[Session tool manifest: ${manifest.allTools.length} core tools available.]`;
}
