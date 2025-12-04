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
 * 
 * Phase 2 Extensions:
 * - [IMAGE] - Show contextual vocabulary images
 * - [DRILL] - Inline micro-exercises
 * - Pronunciation feedback overlay
 * - Auto-vocabulary extraction from [WRITE] tags
 */

/**
 * Whiteboard markup tags
 * 
 * Usage examples:
 * - [WRITE]Hola[/WRITE] → Display "Hola" on whiteboard
 * - [PHONETIC]OH-lah[/PHONETIC] → Show pronunciation guide  
 * - [COMPARE]NOT "Hola" → "Ola" ✓[/COMPARE] → Show correction
 * - [IMAGE]gato|A cute cat[/IMAGE] → Show image with word and description
 * - [DRILL type="repeat"]Buenos días[/DRILL] → Quick pronunciation drill
 * - [CLEAR] → Wipe the whiteboard
 * - [HOLD] → Explicit "keep current content" (for response without whiteboard changes)
 */
export const WHITEBOARD_TAGS = {
  WRITE: 'WRITE',
  PHONETIC: 'PHONETIC', 
  COMPARE: 'COMPARE',
  IMAGE: 'IMAGE',
  DRILL: 'DRILL',
  CLEAR: 'CLEAR',
  HOLD: 'HOLD',
} as const;

export type WhiteboardTagType = keyof typeof WHITEBOARD_TAGS;

/**
 * Whiteboard item display types (lowercase for UI styling)
 */
export type WhiteboardItemType = 'write' | 'phonetic' | 'compare' | 'image' | 'drill' | 'pronunciation';

/**
 * Drill types for inline micro-exercises
 */
export type DrillType = 'repeat' | 'translate' | 'fill_blank';

/**
 * Drill state for interactive exercises
 */
export type DrillState = 'waiting' | 'listening' | 'evaluating' | 'complete';

/**
 * Image item metadata
 */
export interface ImageItemData {
  word: string;
  description: string;
  imageUrl?: string;
  isLoading?: boolean;
}

/**
 * Drill item metadata
 */
export interface DrillItemData {
  drillType: DrillType;
  prompt: string;
  expectedAnswer?: string;
  state: DrillState;
  studentResponse?: string;
  isCorrect?: boolean;
  feedback?: string;
}

/**
 * Pronunciation feedback data (from server analysis)
 */
export interface PronunciationFeedbackData {
  score: number;
  feedback: string;
  phoneticIssues: string[];
  strengths: string[];
  transcript: string;
}

/**
 * Individual whiteboard item (one marked section)
 * Discriminated union for type-safe rendering
 */
export interface WhiteboardItemBase {
  timestamp?: number;
  id?: string;
}

export interface WriteItem extends WhiteboardItemBase {
  type: 'write';
  content: string;
}

export interface PhoneticItem extends WhiteboardItemBase {
  type: 'phonetic';
  content: string;
}

export interface CompareItem extends WhiteboardItemBase {
  type: 'compare';
  content: string;
}

export interface ImageItem extends WhiteboardItemBase {
  type: 'image';
  content: string;
  data: ImageItemData;
}

export interface DrillItem extends WhiteboardItemBase {
  type: 'drill';
  content: string;
  data: DrillItemData;
}

export interface PronunciationItem extends WhiteboardItemBase {
  type: 'pronunciation';
  content: string;
  data: PronunciationFeedbackData;
}

export type WhiteboardItem = 
  | WriteItem 
  | PhoneticItem 
  | CompareItem 
  | ImageItem 
  | DrillItem 
  | PronunciationItem;

/**
 * Legacy interface for backward compatibility
 */
export interface LegacyWhiteboardItem {
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
  activeDrill?: DrillItem;
}

/**
 * Result of parsing a tutor response for whiteboard content
 */
export interface WhiteboardParseResult {
  cleanText: string;
  whiteboardItems: WhiteboardItem[];
  shouldClear: boolean;
  shouldHold: boolean;
  hasNewVocabulary: boolean;
  vocabularyWords: string[];
}

/**
 * Regex patterns for extracting whiteboard markup
 * Non-greedy matching to handle multiple tags in one response
 */
export const WHITEBOARD_PATTERNS = {
  WRITE: /\[WRITE\]([\s\S]*?)\[\/WRITE\]/gi,
  PHONETIC: /\[PHONETIC\]([\s\S]*?)\[\/PHONETIC\]/gi,
  COMPARE: /\[COMPARE\]([\s\S]*?)\[\/COMPARE\]/gi,
  IMAGE: /\[IMAGE\]([\s\S]*?)\[\/IMAGE\]/gi,
  DRILL: /\[DRILL(?:\s+type="([^"]*)")?\]([\s\S]*?)\[\/DRILL\]/gi,
  CLEAR: /\[CLEAR\]/gi,
  HOLD: /\[HOLD\]/gi,
} as const;

/**
 * All whiteboard markup pattern (for stripping)
 * Updated to include IMAGE and DRILL tags
 */
export const ALL_WHITEBOARD_MARKUP_PATTERN = 
  /\[(WRITE|PHONETIC|COMPARE|IMAGE)\]([\s\S]*?)\[\/\1\]|\[DRILL(?:\s+type="[^"]*")?\]([\s\S]*?)\[\/DRILL\]|\[(CLEAR|HOLD)\]/gi;

/**
 * Generate unique ID for whiteboard items
 */
function generateItemId(): string {
  return `wb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Parse IMAGE content: "word|description" format
 */
function parseImageContent(content: string): ImageItemData {
  const parts = content.split('|').map(p => p.trim());
  return {
    word: parts[0] || content,
    description: parts[1] || parts[0] || content,
    isLoading: true,
  };
}

/**
 * Parse DRILL content with optional type attribute
 */
function parseDrillContent(typeAttr: string | undefined, content: string): DrillItemData {
  const drillType = (typeAttr?.toLowerCase() || 'repeat') as DrillType;
  const validTypes: DrillType[] = ['repeat', 'translate', 'fill_blank'];
  
  return {
    drillType: validTypes.includes(drillType) ? drillType : 'repeat',
    prompt: content.trim(),
    state: 'waiting',
  };
}

/**
 * Parse tutor response for whiteboard content
 * Extracts marked items and returns clean text for TTS
 */
export function parseWhiteboardMarkup(text: string): WhiteboardParseResult {
  const now = Date.now();
  const items: WhiteboardItem[] = [];
  const vocabularyWords: string[] = [];
  
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
    const content = match[1].trim();
    items.push({
      type: 'write',
      content,
      timestamp: now,
      id: generateItemId(),
    });
    vocabularyWords.push(content);
  }

  WHITEBOARD_PATTERNS.PHONETIC.lastIndex = 0;
  while ((match = WHITEBOARD_PATTERNS.PHONETIC.exec(text)) !== null) {
    items.push({
      type: 'phonetic',
      content: match[1].trim(),
      timestamp: now,
      id: generateItemId(),
    });
  }

  WHITEBOARD_PATTERNS.COMPARE.lastIndex = 0;
  while ((match = WHITEBOARD_PATTERNS.COMPARE.exec(text)) !== null) {
    items.push({
      type: 'compare',
      content: match[1].trim(),
      timestamp: now,
      id: generateItemId(),
    });
  }

  WHITEBOARD_PATTERNS.IMAGE.lastIndex = 0;
  while ((match = WHITEBOARD_PATTERNS.IMAGE.exec(text)) !== null) {
    const content = match[1].trim();
    items.push({
      type: 'image',
      content,
      timestamp: now,
      id: generateItemId(),
      data: parseImageContent(content),
    });
    const imageData = parseImageContent(content);
    if (imageData.word) {
      vocabularyWords.push(imageData.word);
    }
  }

  WHITEBOARD_PATTERNS.DRILL.lastIndex = 0;
  while ((match = WHITEBOARD_PATTERNS.DRILL.exec(text)) !== null) {
    const typeAttr = match[1];
    const content = match[2].trim();
    items.push({
      type: 'drill',
      content,
      timestamp: now,
      id: generateItemId(),
      data: parseDrillContent(typeAttr, content),
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
    hasNewVocabulary: vocabularyWords.length > 0,
    vocabularyWords,
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
  image: (word: string, description?: string) => 
    `[IMAGE]${word}${description ? `|${description}` : ''}[/IMAGE]`,
  drill: (prompt: string, type: DrillType = 'repeat') => 
    `[DRILL type="${type}"]${prompt}[/DRILL]`,
  clear: '[CLEAR]',
  hold: '[HOLD]',
};

/**
 * Type guard for checking if an item is an image item
 */
export function isImageItem(item: WhiteboardItem): item is ImageItem {
  return item.type === 'image';
}

/**
 * Type guard for checking if an item is a drill item
 */
export function isDrillItem(item: WhiteboardItem): item is DrillItem {
  return item.type === 'drill';
}

/**
 * Type guard for checking if an item is a pronunciation feedback item
 */
export function isPronunciationItem(item: WhiteboardItem): item is PronunciationItem {
  return item.type === 'pronunciation';
}

/**
 * Type guard for text-based items (write, phonetic, compare)
 */
export function isTextItem(item: WhiteboardItem): item is WriteItem | PhoneticItem | CompareItem {
  return item.type === 'write' || item.type === 'phonetic' || item.type === 'compare';
}

/**
 * Create a pronunciation feedback item from analysis results
 */
export function createPronunciationItem(
  transcript: string,
  analysis: { score: number; feedback: string; phoneticIssues: string[]; strengths: string[] }
): PronunciationItem {
  return {
    type: 'pronunciation',
    content: transcript,
    timestamp: Date.now(),
    id: generateItemId(),
    data: {
      ...analysis,
      transcript,
    },
  };
}

/**
 * Update drill item state
 */
export function updateDrillState(
  item: DrillItem,
  updates: Partial<DrillItemData>
): DrillItem {
  return {
    ...item,
    data: {
      ...item.data,
      ...updates,
    },
  };
}

/**
 * Get drill prompt based on type
 */
export function getDrillInstructions(drillType: DrillType): string {
  switch (drillType) {
    case 'repeat':
      return 'Listen carefully, then repeat what you hear';
    case 'translate':
      return 'Translate this into the target language';
    case 'fill_blank':
      return 'Fill in the missing word or phrase';
    default:
      return 'Complete this exercise';
  }
}
