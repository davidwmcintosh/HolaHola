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
 */
export type ActionCommandType = 
  | 'SWITCH_TUTOR'
  | 'PHASE_SHIFT'
  | 'ACTFL_UPDATE'
  | 'SYLLABUS_PROGRESS'
  | 'CALL_SUPPORT'
  | 'CALL_SOFIA'
  | 'HIVE'
  | 'SELF_SURGERY';

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
 * Schema definitions for command validation
 */
const COMMAND_SCHEMAS: Record<ActionCommandType, { required: string[]; optional: string[] }> = {
  SWITCH_TUTOR: {
    required: ['target'],
    optional: ['language', 'role'],
  },
  PHASE_SHIFT: {
    required: ['to', 'reason'],
    optional: [],
  },
  ACTFL_UPDATE: {
    required: ['level'],
    optional: ['confidence', 'reason', 'direction'],
  },
  SYLLABUS_PROGRESS: {
    required: ['topic', 'status'],
    optional: ['evidence'],
  },
  CALL_SUPPORT: {
    required: ['category'],
    optional: ['reason', 'priority', 'context'],
  },
  CALL_SOFIA: {
    required: ['category'],
    optional: ['reason', 'priority', 'context'],
  },
  HIVE: {
    required: ['category', 'title', 'description'],
    optional: ['reasoning', 'priority'],
  },
  SELF_SURGERY: {
    required: ['target', 'content', 'reasoning'],
    optional: ['type', 'expectedBehavior', 'verificationMethod'],
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
  SWITCH_TUTOR: /\[SWITCH_TUTOR[S]?\s+([^\]]+)\]/gi,
  PHASE_SHIFT: /\[PHASE_SHIFT\s+([^\]]+)\]/gi,
  ACTFL_UPDATE: /\[ACTFL_UPDATE\s+([^\]]+)\]/gi,
  SYLLABUS_PROGRESS: /\[SYLLABUS_PROGRESS\s+([^\]]+)\]/gi,
  CALL_SUPPORT: /\[CALL_SUPPORT\s+([^\]]+)\]/gi,
  CALL_SOFIA: /\[CALL_SOFIA\s+([^\]]+)\]/gi,
  HIVE: /\[HIVE\s+([^\]]+)\]/gi,
  SELF_SURGERY: /\[SELF_SURGERY\s+([^\]]+)\]/gi,
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
 */
function validateCommand(type: ActionCommandType, params: Record<string, any>): string[] {
  const schema = COMMAND_SCHEMAS[type];
  if (!schema) {
    return [`Unknown command type: ${type}`];
  }
  
  const errors: string[] = [];
  
  for (const required of schema.required) {
    if (!(required in params) || params[required] === undefined || params[required] === '') {
      errors.push(`${type}: Missing required parameter "${required}"`);
    }
  }
  
  return errors;
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
      
      const validationErrors = validateCommand(type, params);
      if (validationErrors.length > 0) {
        errors.push(...validationErrors);
        continue;
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
 * Extract commands using bracketed [TAG ...] syntax (fallback)
 */
function parseBracketedCommands(text: string): { commands: ParsedCommand[]; errors: string[] } {
  const commands: ParsedCommand[] = [];
  const errors: string[] = [];
  
  for (const [type, pattern] of Object.entries(ROBUST_TAG_PATTERNS)) {
    pattern.lastIndex = 0;
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      const attrString = match[1];
      const params = parseAttributes(attrString);
      
      const commandType = type as ActionCommandType;
      const validationErrors = validateCommand(commandType, params);
      
      if (validationErrors.length > 0) {
        errors.push(...validationErrors);
        // Still include the command but note it has validation issues
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
 * Main parsing function - tries JSON first, falls back to bracketed syntax
 */
export function parseActionCommands(text: string): CommandParseResult {
  const result: CommandParseResult = {
    commands: [],
    hasActionTriggers: false,
    jsonParseSuccess: false,
    fallbackUsed: false,
    errors: [],
  };
  
  // First try JSON parsing from <ACTION_TRIGGERS> section
  const jsonResult = parseActionTriggersJSON(text);
  
  if (jsonResult) {
    result.hasActionTriggers = true;
    
    if (jsonResult.commands.length > 0) {
      result.commands = jsonResult.commands;
      result.jsonParseSuccess = true;
      result.errors = jsonResult.errors;
      
      console.log(`[CommandParser] Parsed ${jsonResult.commands.length} commands from ACTION_TRIGGERS JSON`);
      return result;
    }
    
    // JSON section exists but no valid commands - add errors and try fallback
    result.errors.push(...jsonResult.errors);
  }
  
  // Fallback to bracketed syntax parsing
  const bracketResult = parseBracketedCommands(text);
  
  if (bracketResult.commands.length > 0) {
    result.commands = bracketResult.commands;
    result.fallbackUsed = true;
    result.errors.push(...bracketResult.errors);
    
    console.log(`[CommandParser] Parsed ${bracketResult.commands.length} commands from bracketed syntax (fallback)`);
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
 * Service singleton for command parsing
 */
class CommandParserService {
  parse(text: string): CommandParseResult {
    return parseActionCommands(text);
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
}

export const commandParserService = new CommandParserService();
