/**
 * Tutor Whiteboard System - Types & Markup Definitions
 * 
 * Philosophy: "We provide tools, the tutor teaches."
 * The whiteboard is a flexible visual channel the AI tutor can use strategically.
 * Content persists until the tutor explicitly clears it (Option B persistence).
 * 
 * Architecture:
 * 1. Tutor includes markup in response text
 * 2. Server strips markup before TTS (audio stays natural)
 * 3. Client renders marked content in whiteboard modal
 * 4. Content persists across messages until [CLEAR]
 */

/**
 * Whiteboard markup tags
 * 
 * Usage examples:
 * - [WRITE]Hola[/WRITE] → Display "Hola" on whiteboard
 * - [PHONETIC]OH-lah[/PHONETIC] → Show pronunciation guide  
 * - [COMPARE]NOT "Hola" → "Ola" ✓[/COMPARE] → Show correction
 * - [CLEAR] → Wipe the whiteboard
 * - [HOLD] → Explicit "keep current content" (for response without whiteboard changes)
 */
export const WHITEBOARD_TAGS = {
  WRITE: 'WRITE',
  PHONETIC: 'PHONETIC', 
  COMPARE: 'COMPARE',
  CLEAR: 'CLEAR',
  HOLD: 'HOLD',
} as const;

export type WhiteboardTagType = keyof typeof WHITEBOARD_TAGS;

/**
 * Whiteboard item display types (lowercase for UI styling)
 */
export type WhiteboardItemType = 'write' | 'phonetic' | 'compare';

/**
 * Individual whiteboard item (one marked section)
 */
export interface WhiteboardItem {
  type: WhiteboardItemType;
  content: string;
  timestamp?: number;
}

/**
 * Whiteboard state (what's currently displayed)
 */
export interface WhiteboardState {
  items: WhiteboardItem[];
  isVisible: boolean;
  lastUpdated: number;
}

/**
 * Result of parsing a tutor response for whiteboard content
 */
export interface WhiteboardParseResult {
  cleanText: string;
  whiteboardItems: WhiteboardItem[];
  shouldClear: boolean;
  shouldHold: boolean;
}

/**
 * Regex patterns for extracting whiteboard markup
 * Non-greedy matching to handle multiple tags in one response
 */
export const WHITEBOARD_PATTERNS = {
  WRITE: /\[WRITE\]([\s\S]*?)\[\/WRITE\]/gi,
  PHONETIC: /\[PHONETIC\]([\s\S]*?)\[\/PHONETIC\]/gi,
  COMPARE: /\[COMPARE\]([\s\S]*?)\[\/COMPARE\]/gi,
  CLEAR: /\[CLEAR\]/gi,
  HOLD: /\[HOLD\]/gi,
} as const;

/**
 * All whiteboard markup pattern (for stripping)
 */
export const ALL_WHITEBOARD_MARKUP_PATTERN = 
  /\[(WRITE|PHONETIC|COMPARE)\]([\s\S]*?)\[\/\1\]|\[(CLEAR|HOLD)\]/gi;

/**
 * Parse tutor response for whiteboard content
 * Extracts marked items and returns clean text for TTS
 */
export function parseWhiteboardMarkup(text: string): WhiteboardParseResult {
  const now = Date.now();
  const items: WhiteboardItem[] = [];
  
  let shouldClear = false;
  let shouldHold = false;

  if (WHITEBOARD_PATTERNS.CLEAR.test(text)) {
    shouldClear = true;
  }
  WHITEBOARD_PATTERNS.CLEAR.lastIndex = 0;

  if (WHITEBOARD_PATTERNS.HOLD.test(text)) {
    shouldHold = true;
  }
  WHITEBOARD_PATTERNS.HOLD.lastIndex = 0;

  let match;

  WHITEBOARD_PATTERNS.WRITE.lastIndex = 0;
  while ((match = WHITEBOARD_PATTERNS.WRITE.exec(text)) !== null) {
    items.push({
      type: 'write',
      content: match[1].trim(),
      timestamp: now,
    });
  }

  WHITEBOARD_PATTERNS.PHONETIC.lastIndex = 0;
  while ((match = WHITEBOARD_PATTERNS.PHONETIC.exec(text)) !== null) {
    items.push({
      type: 'phonetic',
      content: match[1].trim(),
      timestamp: now,
    });
  }

  WHITEBOARD_PATTERNS.COMPARE.lastIndex = 0;
  while ((match = WHITEBOARD_PATTERNS.COMPARE.exec(text)) !== null) {
    items.push({
      type: 'compare',
      content: match[1].trim(),
      timestamp: now,
    });
  }

  const cleanText = text
    .replace(ALL_WHITEBOARD_MARKUP_PATTERN, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return {
    cleanText,
    whiteboardItems: items,
    shouldClear,
    shouldHold,
  };
}

/**
 * Strip all whiteboard markup from text (for TTS)
 * Use this before sending text to Cartesia/Google TTS
 */
export function stripWhiteboardMarkup(text: string): string {
  ALL_WHITEBOARD_MARKUP_PATTERN.lastIndex = 0;
  const result = text
    .replace(ALL_WHITEBOARD_MARKUP_PATTERN, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  ALL_WHITEBOARD_MARKUP_PATTERN.lastIndex = 0;
  return result;
}

/**
 * Check if text contains any whiteboard markup
 */
export function hasWhiteboardMarkup(text: string): boolean {
  ALL_WHITEBOARD_MARKUP_PATTERN.lastIndex = 0;
  const result = ALL_WHITEBOARD_MARKUP_PATTERN.test(text);
  ALL_WHITEBOARD_MARKUP_PATTERN.lastIndex = 0;
  return result;
}

/**
 * Create whiteboard markup helpers (for system prompt examples)
 */
export const whiteboardExamples = {
  write: (content: string) => `[WRITE]${content}[/WRITE]`,
  phonetic: (content: string) => `[PHONETIC]${content}[/PHONETIC]`,
  compare: (content: string) => `[COMPARE]${content}[/COMPARE]`,
  clear: '[CLEAR]',
  hold: '[HOLD]',
};
