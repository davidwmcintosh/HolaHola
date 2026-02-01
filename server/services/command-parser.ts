/**
 * Command Parser Service
 * 
 * Phase 2 implementation of the Daniela-Wren hybrid solution:
 * Robust parsing of ACTION_TRIGGERS from Daniela's output.
 * 
 * Architecture:
 * - Primary: Parse structured JSON within <ACTION_TRIGGERS> tags
 * - Fallback: Parse legacy [TAG attr="value"] bracketed syntax
 * - Validation: Schema-based command validation
 * 
 * The hybrid approach combines:
 * - Daniela's need for a clear, non-negotiable section for system commands
 * - Wren's need for robust, machine-readable command extraction
 */

import { WhiteboardItem, WHITEBOARD_TAGS, WHITEBOARD_PATTERNS } from "@shared/whiteboard-types";

/**
 * Supported command types that trigger backend actions
 * 
 * UNIFIED COMMAND REGISTRY: All actionable tags must be defined here.
 * The whiteboard parser handles VISUAL CONTENT only (WRITE, PHONETIC, etc.)
 * The command parser handles ALL ACTION COMMANDS (processed exactly once).
 */
export type ActionCommandType = 
  // === TEACHING & PROGRESSION ===
  | 'SWITCH_TUTOR'      // Hand off to different tutor (gender/language/role)
  | 'PHASE_SHIFT'       // Transition teaching phase
  | 'ACTFL_UPDATE'      // Update student's proficiency level
  | 'SYLLABUS_PROGRESS' // Track topic competency
  | 'CALL_SUPPORT'      // Hand off to Sofia support agent
  | 'CALL_SOFIA'        // Alias for CALL_SUPPORT
  | 'CALL_ASSISTANT'    // Delegate drill practice to assistant tutor
  // === SYSTEM & HIVE ===
  | 'HIVE'              // Daniela's contribution to hive mind
  | 'SELF_SURGERY'      // Neural network modifications (Founder Mode)
  // === MEMORY ===
  | 'MEMORY_LOOKUP'     // On-demand search of neural memory for people, topics, etc.
  | 'TAKE_NOTE'         // Daniela's personal notebook - direct insert, no approval
  | 'MILESTONE'         // Record a learning milestone/breakthrough moment
  | 'FIRST_MEETING_COMPLETE' // Mark that Daniela knows the student well enough
  // === VOICE CONTROL ===
  | 'VOICE_ADJUST'      // Real-time voice adjustment (speed, emotion)
  | 'VOICE_RESET'       // Reset voice to baseline
  | 'WORD_EMPHASIS'     // Emphasize specific words for pronunciation teaching
  // === UI CONTROL ===
  | 'SUBTITLE'          // Toggle subtitle mode (off/on/target)
  | 'SHOW'              // Display custom overlay text
  | 'HIDE'              // Hide custom overlay
  | 'TEXT_INPUT'        // Request text input from student
  | 'CLEAR'             // Clear whiteboard
  | 'HOLD'              // Prevent whiteboard auto-clear

/**
 * Parsed command with type and parameters
 */
export interface ParsedCommand {
  type: ActionCommandType;
  params: Record<string, string | number | boolean>;
  rawMatch: string;
  source: 'json' | 'bracketed';
}

/**
 * Result of parsing ACTION_TRIGGERS from text
 */
export interface CommandParseResult {
  commands: ParsedCommand[];
  hasActionTriggers: boolean;
  jsonParseSuccess: boolean;
  fallbackUsed: boolean;
  errors: string[];
}

/**
 * Valid enum values for command parameters (early validation)
 * Exported for use in orchestrator validation if needed
 */
export const VALID_ENUM_VALUES = {
  SWITCH_TUTOR_TARGET: ['male', 'female'],
  SWITCH_TUTOR_ROLE: ['tutor', 'assistant'],
  PHASE_SHIFT_TO: ['warmup', 'active_teaching', 'challenge', 'reflection', 'drill', 'assessment'],
  SYLLABUS_PROGRESS_STATUS: ['demonstrated', 'needs_review', 'struggling'],
  ACTFL_UPDATE_DIRECTION: ['up', 'down', 'confirm'],
  CALL_SUPPORT_CATEGORY: ['technical', 'account', 'billing', 'content', 'feedback', 'other'],
  CALL_SUPPORT_PRIORITY: ['low', 'normal', 'high', 'critical'],
  // CALL_ASSISTANT: Delegate drill practice to assistant tutor
  CALL_ASSISTANT_TYPE: ['repeat', 'translate', 'match', 'fill_blank', 'sentence_order', 'multiple_choice', 'true_false', 'conjugation'],
  CALL_ASSISTANT_PRIORITY: ['low', 'medium', 'high'],
  HIVE_CATEGORY: ['self_improvement', 'content_gap', 'ux_observation', 'teaching_insight', 'product_feature', 'technical_issue', 'student_pattern', 'tool_enhancement'],
  SELF_SURGERY_TARGET: ['tutor_procedures', 'teaching_principles', 'tool_knowledge', 'situational_patterns', 'language_idioms', 'cultural_nuances', 'learner_error_patterns', 'dialect_variations', 'linguistic_bridges', 'creativity_templates'],
  // Voice adjustment options - Cartesia TTS supports these emotions and speed modifiers
  VOICE_ADJUST_SPEED: ['slowest', 'slow', 'normal', 'fast', 'fastest'],
  // Cartesia Sonic-3 emotions - these map directly to TTS output
  VOICE_ADJUST_EMOTION: ['happy', 'excited', 'friendly', 'curious', 'thoughtful', 'warm', 'playful', 'surprised', 'proud', 'encouraging', 'calm', 'neutral'],
  // Legacy emotion names (will be mapped by orchestrator) - kept for backwards compatibility
  VOICE_ADJUST_EMOTION_LEGACY: ['positivity', 'curiosity', 'surprise', 'anger', 'sadness'],
  // Personality presets that determine baseline emotion and allowed emotion range
  VOICE_ADJUST_PERSONALITY: ['warm', 'calm', 'energetic', 'professional'],
  // Word emphasis styles
  WORD_EMPHASIS_STYLE: ['stress', 'slow', 'both'],
  // Learning milestone types
  MILESTONE_TYPE: ['breakthrough', 'first_success', 'plateau_overcome', 'connection_made', 'confidence_boost', 'teacher_flagged', 'vocabulary_milestone', 'grammar_milestone', 'fluency_marker'],
  // UI Control commands
  SUBTITLE_MODE: ['off', 'on', 'target'],
  // Memory lookup domains - includes both student data AND self-knowledge (Daniela's brain)
  MEMORY_LOOKUP_DOMAINS: [
    // Student data domains
    'person', 'motivation', 'insight', 'struggle', 'session', 'progress', 'conversation', 'syllabus',
    // Self-knowledge domains (Daniela's neural network / brain)
    'principles',          // → teachingPrinciples (her North Star - core beliefs)
    'growth',              // → danielaGrowthMemories (her learning journey)
    'tools',               // → toolKnowledge (her capabilities)
    'procedures',          // → tutorProcedures (how she teaches)
    'patterns',            // → situationalPatterns (when to do what)
    'notes',               // → danielaNotes (her personal notebook)
    // Language-specific knowledge
    'idiom', 'cultural', 'error-pattern',
    // Advanced intelligence
    'subtlety-cue', 'emotional-pattern', 'creativity-template'
  ],
  // Daniela's personal notebook - direct insert, no approval required
  TAKE_NOTE_TYPE: [
    'tool_experiment',      // Notes about tool usage (whiteboard, subtitles, etc.)
    'teaching_rhythm',      // Pacing, energy, engagement observations
    'session_reflection',   // Post-session thoughts
    'language_insight',     // Language-specific discoveries
    'student_pattern',      // Patterns observed across students
    'idea_to_try',          // Things to experiment with
    'what_worked',          // Successful approaches worth remembering
    'what_didnt_work',      // Failed approaches to avoid
    'question_for_founder', // Things she wants to ask about
    'self_affirmation'      // Self-authored reminders - permissions granted, truths affirmed
  ],
};

/**
 * Schema definitions for command validation
 */
const COMMAND_SCHEMAS: Record<ActionCommandType, { required: string[]; optional: string[]; enums?: Record<string, string[]> }> = {
  SWITCH_TUTOR: {
    required: ['target'],
    optional: ['language', 'role'],
    enums: { target: VALID_ENUM_VALUES.SWITCH_TUTOR_TARGET, role: VALID_ENUM_VALUES.SWITCH_TUTOR_ROLE },
  },
  PHASE_SHIFT: {
    required: ['to', 'reason'],
    optional: [],
    enums: { to: VALID_ENUM_VALUES.PHASE_SHIFT_TO },
  },
  ACTFL_UPDATE: {
    required: ['level'],
    optional: ['confidence', 'reason', 'direction'],
    enums: { direction: VALID_ENUM_VALUES.ACTFL_UPDATE_DIRECTION },
  },
  SYLLABUS_PROGRESS: {
    required: ['topic', 'status'],
    optional: ['evidence'],
    enums: { status: VALID_ENUM_VALUES.SYLLABUS_PROGRESS_STATUS },
  },
  CALL_SUPPORT: {
    required: ['category'],
    optional: ['reason', 'priority', 'context'],
    enums: { category: VALID_ENUM_VALUES.CALL_SUPPORT_CATEGORY, priority: VALID_ENUM_VALUES.CALL_SUPPORT_PRIORITY },
  },
  CALL_SOFIA: {
    required: ['category'],
    optional: ['reason', 'priority', 'context'],
    enums: { category: VALID_ENUM_VALUES.CALL_SUPPORT_CATEGORY, priority: VALID_ENUM_VALUES.CALL_SUPPORT_PRIORITY },
  },
  CALL_ASSISTANT: {
    required: ['type', 'focus', 'items'],  // type=drill_type, focus=skill_focus, items=comma-separated list
    optional: ['priority'],
    enums: { type: VALID_ENUM_VALUES.CALL_ASSISTANT_TYPE, priority: VALID_ENUM_VALUES.CALL_ASSISTANT_PRIORITY },
  },
  HIVE: {
    required: ['category', 'title', 'description'],
    optional: ['reasoning', 'priority'],
    enums: { category: VALID_ENUM_VALUES.HIVE_CATEGORY },
  },
  SELF_SURGERY: {
    required: ['target', 'content', 'reasoning'],
    optional: ['priority', 'confidence'],
    enums: { target: VALID_ENUM_VALUES.SELF_SURGERY_TARGET },
  },
  VOICE_ADJUST: {
    required: [],  // All params optional - can adjust just speed, just emotion, personality, or any combination
    optional: ['speed', 'emotion', 'personality', 'reason'],
    // Note: emotion accepts both Cartesia emotions (happy, excited) and legacy names (positivity, curiosity)
    // Legacy names are mapped in the orchestrator
    enums: { 
      speed: VALID_ENUM_VALUES.VOICE_ADJUST_SPEED,
      personality: VALID_ENUM_VALUES.VOICE_ADJUST_PERSONALITY,
    },
  },
  VOICE_RESET: {
    required: [],  // No params needed - resets to tutor's baseline voice settings
    optional: ['reason'],
    enums: {},
  },
  WORD_EMPHASIS: {
    required: ['word', 'style'],  // Word to emphasize and emphasis style
    optional: ['reason'],
    enums: { style: VALID_ENUM_VALUES.WORD_EMPHASIS_STYLE },
  },
  // === UI CONTROL COMMANDS ===
  SUBTITLE: {
    required: ['mode'],  // mode: off|on|target
    optional: [],
    enums: { mode: VALID_ENUM_VALUES.SUBTITLE_MODE },
  },
  SHOW: {
    required: ['text'],  // Text to display in overlay
    optional: [],
    enums: {},
  },
  HIDE: {
    required: [],  // No params - just hide the overlay
    optional: [],
    enums: {},
  },
  TEXT_INPUT: {
    required: ['prompt'],  // Prompt to show for text input
    optional: [],
    enums: {},
  },
  CLEAR: {
    required: [],  // No params - clear whiteboard
    optional: [],
    enums: {},
  },
  HOLD: {
    required: [],  // No params - prevent whiteboard auto-clear
    optional: [],
    enums: {},
  },
  // === MEMORY ===
  MEMORY_LOOKUP: {
    required: ['query'],  // The search query (name, topic, question)
    optional: ['domains'],  // Comma-separated domains to search (person,motivation,insight,struggle,session,progress)
    enums: {},  // domains validated separately since it's comma-separated
  },
  TAKE_NOTE: {
    required: ['type', 'title', 'content'],  // Note type, short title, full content
    optional: ['language', 'tags'],  // Optional language context and freeform tags
    enums: { type: VALID_ENUM_VALUES.TAKE_NOTE_TYPE },
  },
  FIRST_MEETING_COMPLETE: {
    required: [],  // No required params - just the command itself is the signal
    optional: ['summary'],  // Optional summary of what Daniela learned about the student
  },
};

/**
 * Regex patterns for robust bracketed tag extraction
 * These are more lenient than the strict patterns in whiteboard-types.ts
 * to catch common LLM output variations
 * 
 * NOTE: CALL_SUPPORT and CALL_SOFIA are handled specially to avoid duplication
 */
const ROBUST_TAG_PATTERNS: Record<ActionCommandType, RegExp> = {
  // === TEACHING & PROGRESSION ===
  SWITCH_TUTOR: /\[SWITCH_TUTOR[S]?\s+([^\]]+)\]/gi,
  PHASE_SHIFT: /\[PHASE_SHIFT\s+([^\]]+)\]/gi,
  ACTFL_UPDATE: /\[ACTFL_UPDATE\s+([^\]]+)\]/gi,
  SYLLABUS_PROGRESS: /\[SYLLABUS_PROGRESS\s+([^\]]+)\]/gi,
  CALL_SUPPORT: /\[CALL_SUPPORT\s+([^\]]+)\]/gi,
  CALL_SOFIA: /\[CALL_SOFIA\s+([^\]]+)\]/gi,
  CALL_ASSISTANT: /\[CALL_ASSISTANT\s+([^\]]+)\]/gi,
  // === SYSTEM & HIVE ===
  HIVE: /\[HIVE\s+([^\]]+)\]/gi,
  SELF_SURGERY: /\[SELF_SURGERY\s+([^\]]+)\]/gi,
  // === VOICE CONTROL ===
  VOICE_ADJUST: /\[VOICE_ADJUST\s+([^\]]+)\]/gi,
  VOICE_RESET: /\[VOICE_RESET(?:\s+([^\]]*))?\]/gi,
  // WORD_EMPHASIS captures: [WORD_EMPHASIS word="..." style="..."] or malformed without bracket
  WORD_EMPHASIS: /\[?WORD_EMPHASIS\s+([^\]]+)\]?/gi,
  // === UI CONTROL ===
  // SUBTITLE captures: [SUBTITLE off], [SUBTITLE on], [SUBTITLE target]
  // The mode value is captured in group 1
  SUBTITLE: /\[SUBTITLE\s+(off|on|target)\s*\]/gi,
  // SHOW captures multiple formats:
  // - [SHOW: text to display] (colon format - group 1 captures text)
  // - [SHOW text="..."] (attribute format - group 2 captures quoted text)
  // - SHOW text="..."] (malformed without opening bracket)
  SHOW: /\[?SHOW(?::\s*([^\]]+)|(?:\s+text\s*=\s*"([^"]*)"\s*\]?))/gi,
  // HIDE is a simple flag (with or without opening bracket for malformed output)
  HIDE: /\[?HIDE\s*\]?/gi,
  // TEXT_INPUT captures: [TEXT_INPUT:prompt text]
  TEXT_INPUT: /\[TEXT_INPUT:\s*([^\]]+)\]/gi,
  // CLEAR and HOLD are simple flags
  CLEAR: /\[CLEAR\]/gi,
  HOLD: /\[HOLD\]/gi,
  // === MEMORY ===
  // More lenient pattern: matches with or without brackets, handles malformed quotes
  // Matches: [MEMORY_LOOKUP ...], MEMORY_LOOKUP query="..." domains="...", etc.
  MEMORY_LOOKUP: /\[?MEMORY_LOOKUP\s+([^\]\n]+)\]?/gi,
  TAKE_NOTE: /\[TAKE_NOTE\s+([^\]]+)\]/gi,
};

/**
 * Parse attribute string into key-value pairs
 * Handles: key="value", key='value', key=value, key=123
 */
function parseAttributes(attrString: string): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  
  // Match key="value" or key='value' or key=value patterns
  const attrPattern = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+))/g;
  let match;
  
  while ((match = attrPattern.exec(attrString)) !== null) {
    const key = match[1];
    const value = match[2] ?? match[3] ?? match[4];
    
    // Try to parse numbers
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && value === numValue.toString()) {
      result[key] = numValue;
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Validate a command against its schema
 * Returns: { errors: string[], warnings: string[] }
 * - errors: Missing required fields (blocks execution)
 * - warnings: Unexpected enum values (logged but command still executes)
 */
function validateCommand(type: ActionCommandType, params: Record<string, any>): { errors: string[]; warnings: string[] } {
  const schema = COMMAND_SCHEMAS[type];
  if (!schema) {
    return { errors: [`Unknown command type: ${type}`], warnings: [] };
  }
  
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check required parameters (blocking errors)
  for (const required of schema.required) {
    if (!(required in params) || params[required] === undefined || params[required] === '') {
      errors.push(`${type}: Missing required parameter "${required}"`);
    }
  }
  
  // Check enum values (non-blocking warnings for observability)
  // Commands still execute even with unexpected values to support production flexibility
  if (schema.enums) {
    for (const [param, validValues] of Object.entries(schema.enums)) {
      const value = params[param];
      if (value !== undefined && value !== '' && !validValues.includes(String(value).toLowerCase())) {
        warnings.push(`${type}: Unexpected value "${value}" for "${param}" (known: ${validValues.join(', ')})`);
      }
    }
  }
  
  return { errors, warnings };
}

/**
 * Extract JSON commands from <ACTION_TRIGGERS> section
 */
function parseActionTriggersJSON(text: string): { commands: ParsedCommand[]; errors: string[] } | null {
  // Look for <ACTION_TRIGGERS> section
  const actionTriggersPattern = /<ACTION_TRIGGERS>\s*([\s\S]*?)\s*<\/ACTION_TRIGGERS>/i;
  const match = actionTriggersPattern.exec(text);
  
  if (!match) {
    return null;
  }
  
  const jsonContent = match[1].trim();
  const commands: ParsedCommand[] = [];
  const errors: string[] = [];
  
  try {
    const parsed = JSON.parse(jsonContent);
    
    // Handle { "commands": [...] } format
    const commandArray = parsed.commands || (Array.isArray(parsed) ? parsed : [parsed]);
    
    for (const cmd of commandArray) {
      if (!cmd.type) {
        errors.push('Command missing "type" field');
        continue;
      }
      
      const type = cmd.type.toUpperCase() as ActionCommandType;
      
      // Extract params without mutating original object
      const rawParams = cmd.details || cmd.params;
      let params: Record<string, any>;
      
      if (rawParams && typeof rawParams === 'object') {
        // Use provided details/params, clone to avoid mutation
        params = { ...rawParams };
      } else {
        // Fallback: extract all fields except 'type' from cmd
        params = {};
        for (const [key, value] of Object.entries(cmd)) {
          if (key !== 'type') {
            params[key] = value;
          }
        }
      }
      
      // Validate the command type is known
      if (!(type in COMMAND_SCHEMAS)) {
        errors.push(`Unknown command type: ${type}`);
        continue;
      }
      
      const validation = validateCommand(type, params);
      if (validation.errors.length > 0) {
        errors.push(...validation.errors);
        continue;
      }
      // Log warnings but don't block command execution
      if (validation.warnings.length > 0) {
        console.log(`[CommandParser] Validation warnings: ${validation.warnings.join('; ')}`);
      }
      
      commands.push({
        type,
        params,
        rawMatch: JSON.stringify(cmd),
        source: 'json',
      });
    }
  } catch (e) {
    errors.push(`JSON parse error in ACTION_TRIGGERS: ${(e as Error).message}`);
  }
  
  return { commands, errors };
}

/**
 * Special parameter extraction for UI control commands that don't use key="value" syntax
 * Maps regex capture groups to the expected parameter names
 */
function extractSpecialParams(type: ActionCommandType, match: RegExpExecArray): Record<string, string | number> | null {
  switch (type) {
    case 'SUBTITLE':
      // [SUBTITLE off/on/target] - group 1 is the mode
      return match[1] ? { mode: match[1].toLowerCase() } : null;
    case 'SHOW':
      // [SHOW: text] - group 1 is colon format text
      // [SHOW text="..."] - group 2 is attribute format text
      const showText = match[1] || match[2];
      return showText ? { text: showText.trim() } : null;
    case 'HIDE':
      // [HIDE] - no params needed
      return {};
    case 'TEXT_INPUT':
      // [TEXT_INPUT: prompt] - group 1 is the prompt
      return match[1] ? { prompt: match[1].trim() } : null;
    case 'CLEAR':
      // [CLEAR] - no params needed
      return {};
    case 'HOLD':
      // [HOLD] - no params needed
      return {};
    default:
      return null; // Use standard key="value" parsing
  }
}

/**
 * Extract commands using bracketed [TAG ...] syntax (fallback)
 */
function parseBracketedCommands(text: string): { commands: ParsedCommand[]; errors: string[] } {
  const commands: ParsedCommand[] = [];
  const errors: string[] = [];
  
  for (const [type, pattern] of Object.entries(ROBUST_TAG_PATTERNS)) {
    pattern.lastIndex = 0;
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      const commandType = type as ActionCommandType;
      
      // Try special parameter extraction first (for UI control commands)
      const specialParams = extractSpecialParams(commandType, match);
      
      // If not a special command, use standard key="value" parsing
      const params: Record<string, string | number> = specialParams !== null
        ? specialParams
        : parseAttributes(match[1] || '');
      
      const validation = validateCommand(commandType, params);
      
      // Only block on missing required fields
      if (validation.errors.length > 0) {
        errors.push(...validation.errors);
        // Don't include commands with missing required fields
        continue;
      }
      // Log warnings but don't block command execution
      if (validation.warnings.length > 0) {
        console.log(`[CommandParser] Validation warnings: ${validation.warnings.join('; ')}`);
      }
      
      commands.push({
        type: commandType,
        params,
        rawMatch: match[0],
        source: 'bracketed',
      });
    }
  }
  
  // Deduplicate CALL_SUPPORT and CALL_SOFIA (they match the same patterns)
  const seen = new Set<string>();
  const deduped = commands.filter(cmd => {
    const key = `${cmd.type}:${cmd.rawMatch}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  return { commands: deduped, errors };
}

/**
 * Create a deduplication key for a command based on type and key parameters
 */
function getCommandDedupeKey(cmd: ParsedCommand): string {
  // Build key from type + primary parameters that define uniqueness
  const keyParams: string[] = [cmd.type];
  
  switch (cmd.type) {
    case 'SWITCH_TUTOR':
      keyParams.push(String(cmd.params.target || ''));
      keyParams.push(String(cmd.params.language || ''));
      break;
    case 'PHASE_SHIFT':
      keyParams.push(String(cmd.params.to || ''));
      break;
    case 'ACTFL_UPDATE':
      keyParams.push(String(cmd.params.level || ''));
      break;
    case 'SYLLABUS_PROGRESS':
      keyParams.push(String(cmd.params.topic || ''));
      keyParams.push(String(cmd.params.status || ''));
      break;
    case 'CALL_SUPPORT':
    case 'CALL_SOFIA':
      keyParams.push(String(cmd.params.category || ''));
      break;
  }
  
  return keyParams.join(':').toLowerCase();
}

/**
 * Main parsing function - parses BOTH JSON and bracketed syntax, deduplicates
 * This ensures commands fire exactly once regardless of format used
 */
export function parseActionCommands(text: string): CommandParseResult {
  const result: CommandParseResult = {
    commands: [],
    hasActionTriggers: false,
    jsonParseSuccess: false,
    fallbackUsed: false,
    errors: [],
  };
  
  const allCommands: ParsedCommand[] = [];
  
  // Parse JSON from <ACTION_TRIGGERS> section
  const jsonResult = parseActionTriggersJSON(text);
  
  if (jsonResult) {
    result.hasActionTriggers = true;
    
    if (jsonResult.commands.length > 0) {
      allCommands.push(...jsonResult.commands);
      result.jsonParseSuccess = true;
      console.log(`[CommandParser] Parsed ${jsonResult.commands.length} commands from ACTION_TRIGGERS JSON`);
    }
    
    result.errors.push(...jsonResult.errors);
  }
  
  // ALWAYS parse bracketed syntax too for comprehensive detection
  // This catches commands outside ACTION_TRIGGERS blocks
  const bracketResult = parseBracketedCommands(text);
  
  if (bracketResult.commands.length > 0) {
    allCommands.push(...bracketResult.commands);
    // Only mark as fallback if JSON parsing failed or wasn't present
    if (!result.jsonParseSuccess) {
      result.fallbackUsed = true;
    }
    result.errors.push(...bracketResult.errors);
    console.log(`[CommandParser] Parsed ${bracketResult.commands.length} commands from bracketed syntax`);
  }
  
  // Deduplicate: prefer JSON over bracketed for same command
  const seen = new Map<string, ParsedCommand>();
  
  for (const cmd of allCommands) {
    const key = getCommandDedupeKey(cmd);
    const existing = seen.get(key);
    
    // If no existing or this is JSON (preferred), use this command
    if (!existing || (cmd.source === 'json' && existing.source === 'bracketed')) {
      seen.set(key, cmd);
    }
  }
  
  result.commands = Array.from(seen.values());
  
  if (result.commands.length > 0) {
    console.log(`[CommandParser] Total unique commands after dedup: ${result.commands.length}`);
  }
  
  return result;
}

/**
 * Check if text contains any action commands (quick check)
 */
export function hasActionCommands(text: string): boolean {
  // Check for ACTION_TRIGGERS section
  if (/<ACTION_TRIGGERS>/i.test(text)) {
    return true;
  }
  
  // Check for any bracketed command tags
  for (const pattern of Object.values(ROBUST_TAG_PATTERNS)) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Normalize a command to standard format
 * Converts variations like SWITCH_TUTORS → SWITCH_TUTOR
 */
export function normalizeCommandType(type: string): ActionCommandType | null {
  const normalized = type.toUpperCase().replace(/S$/, ''); // Remove trailing 's'
  
  if (normalized === 'CALL_SOFIA') {
    return 'CALL_SUPPORT'; // Normalize to single type
  }
  
  if (normalized in COMMAND_SCHEMAS) {
    return normalized as ActionCommandType;
  }
  
  return null;
}

/**
 * Build a standardized command string from parsed command
 * Useful for logging and debugging
 */
export function formatCommand(cmd: ParsedCommand): string {
  const params = Object.entries(cmd.params)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
  
  return `[${cmd.type} ${params}]`;
}

/**
 * Detect and log unknown/unhandled tags for telemetry
 * This helps identify new command patterns that Daniela is using
 */
export function detectUnknownTags(text: string): string[] {
  const unknownTags: string[] = [];
  
  // Pattern to detect any [TAG ...] format that looks like a command
  // (i.e., starts with uppercase letters, may have params)
  const tagPattern = /\[([A-Z][A-Z0-9_]*)\s*[^\]]*\]/gi;
  let match;
  
  // Known visual-only tags that whiteboard parser handles (should not be flagged)
  const knownVisualTags = new Set([
    'WRITE', 'PHONETIC', 'WORD', 'HIGHLIGHT', 'TRANSLATION', 'EXAMPLE',
    'CONJUGATION', 'CULTURAL_NOTE', 'AUDIO_CLIP', 'DRILL', 'HANZI', 'WORD_MAP'
  ]);
  
  while ((match = tagPattern.exec(text)) !== null) {
    const tagName = match[1].toUpperCase();
    
    // Skip known action commands (handled by this parser)
    if (tagName in COMMAND_SCHEMAS) continue;
    
    // Skip known visual tags (handled by whiteboard parser)
    if (knownVisualTags.has(tagName)) continue;
    
    // Skip obvious false positives (e.g., markdown, URLs)
    if (tagName.length < 3) continue;
    
    unknownTags.push(match[0]);
  }
  
  if (unknownTags.length > 0) {
    console.log(`[CommandParser - TELEMETRY] Unknown tags detected: ${unknownTags.join(', ')}`);
  }
  
  return unknownTags;
}

/**
 * Service singleton for command parsing
 */
class CommandParserService {
  parse(text: string): CommandParseResult {
    const result = parseActionCommands(text);
    
    // Run telemetry to detect unknown tags (non-blocking)
    const unknownTags = detectUnknownTags(text);
    if (unknownTags.length > 0) {
      // Attach unknown tags to result for observability
      (result as any).unknownTags = unknownTags;
    }
    
    return result;
  }
  
  hasCommands(text: string): boolean {
    return hasActionCommands(text);
  }
  
  formatCommand(cmd: ParsedCommand): string {
    return formatCommand(cmd);
  }
  
  normalizeType(type: string): ActionCommandType | null {
    return normalizeCommandType(type);
  }
  
  /**
   * Expose telemetry for external use
   */
  detectUnknownTags(text: string): string[] {
    return detectUnknownTags(text);
  }
}

export const commandParserService = new CommandParserService();
