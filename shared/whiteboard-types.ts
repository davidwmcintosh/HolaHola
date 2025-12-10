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
 * - [CONTEXT]correr|Yo corro todos los días|Ella corre muy rápido|Los niños corren en el parque[/CONTEXT] → Show word in multiple contexts
 * - [GRAMMAR_TABLE]hablar|present[/GRAMMAR_TABLE] → Show verb conjugation table
 * - [WORD_MAP]happy[/WORD_MAP] → Show word relationships (synonyms, antonyms, collocations, word family)
 * - [CLEAR] → Wipe the whiteboard
 * - [HOLD] → Explicit "keep current content" (for response without whiteboard changes)
 */
export const WHITEBOARD_TAGS = {
  WRITE: 'WRITE',
  PHONETIC: 'PHONETIC', 
  COMPARE: 'COMPARE',
  IMAGE: 'IMAGE',
  DRILL: 'DRILL',
  CONTEXT: 'CONTEXT',
  GRAMMAR_TABLE: 'GRAMMAR_TABLE',
  READING: 'READING',
  STROKE: 'STROKE',
  WORD_MAP: 'WORD_MAP',
  CULTURE: 'CULTURE',
  PLAY: 'PLAY',
  SCENARIO: 'SCENARIO',
  SUMMARY: 'SUMMARY',
  ERROR_PATTERNS: 'ERROR_PATTERNS',
  VOCABULARY_TIMELINE: 'VOCABULARY_TIMELINE',
  SUBTITLE: 'SUBTITLE',
  TEXT_INPUT: 'TEXT_INPUT',
  SWITCH_TUTOR: 'SWITCH_TUTOR',
  CLEAR: 'CLEAR',
  HOLD: 'HOLD',
} as const;

export type WhiteboardTagType = keyof typeof WHITEBOARD_TAGS;

/**
 * Whiteboard item display types (lowercase for UI styling)
 */
export type WhiteboardItemType = 'write' | 'phonetic' | 'compare' | 'image' | 'drill' | 'pronunciation' | 'context' | 'grammar_table' | 'reading' | 'stroke' | 'word_map' | 'culture' | 'play' | 'scenario' | 'summary' | 'error_patterns' | 'vocabulary_timeline' | 'text_input' | 'switch_tutor';

/**
 * Drill types for inline micro-exercises
 * - repeat: Listen and repeat pronunciation
 * - translate: Translate and speak
 * - fill_blank: Fill in missing word(s) from options
 * - match: Match pairs of words/phrases
 * - sentence_order: Drag-and-drop word ordering
 */
export type DrillType = 'repeat' | 'translate' | 'fill_blank' | 'match' | 'sentence_order';

/**
 * Drill state for interactive exercises
 */
export type DrillState = 'waiting' | 'listening' | 'evaluating' | 'complete';

/**
 * Match pair for matching drills
 * Format in markup: term => match (one per line)
 */
export interface MatchPair {
  id: string;
  left: string;
  right: string;
  matched?: boolean;
}

/**
 * State for matching drill interactions
 */
export type MatchState = 'pending' | 'selecting_left' | 'selecting_right' | 'complete';

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
  // Matching drill specific fields
  pairs?: MatchPair[];
  shuffledRightIds?: string[];
  selectedLeftId?: string | null;
  matchedCount?: number;
  attempts?: number;
  matchState?: MatchState;
  // Fill-in-the-blank drill specific fields
  blankedText?: string;           // Text with ___ placeholder(s)
  options?: string[];             // Dropdown options for the blank
  correctAnswer?: string;         // The correct answer for the blank
  selectedAnswer?: string | null; // User's selected answer
  // Sentence order drill specific fields (drag-and-drop)
  words?: string[];               // Scrambled words to arrange
  correctOrder?: string[];        // Words in correct order
  currentOrder?: string[];        // User's current arrangement
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
 * Context sentences item data
 * Shows a word in multiple example sentences with highlighting
 */
export interface ContextItemData {
  word: string;
  sentences: string[];
}

/**
 * Grammar table item data
 * Shows verb conjugation or grammar pattern tables
 */
export interface GrammarTableItemData {
  verb: string;
  tense: string;
  conjugations?: GrammarConjugation[];
  isLoading?: boolean;
}

export interface GrammarConjugation {
  pronoun: string;
  form: string;
}

/**
 * Reading guide item data (Furigana, Pinyin, Romanization)
 * Shows character/word with pronunciation guide above/below
 */
export interface ReadingItemData {
  character: string;      // The main character/word (e.g., 食べる, 你好, 한국어)
  reading: string;        // The pronunciation guide (e.g., たべる, nǐ hǎo, hangugeo)
  language?: string;      // Optional: japanese, mandarin, korean for styling
}

/**
 * Stroke order item data
 * Shows character with stroke order visualization
 */
export interface StrokeItemData {
  character: string;      // Single character to show strokes for
  language?: string;      // Optional: japanese, mandarin, korean
  strokes?: string[];     // Optional: stroke descriptions if available
}

/**
 * Word map item data
 * Shows visual web of related words: synonyms, antonyms, collocations, word family
 */
export interface WordMapItemData {
  targetWord: string;           // The central word being explored
  synonyms?: string[];          // Similar meaning words
  antonyms?: string[];          // Opposite meaning words
  collocations?: string[];      // Common word pairings (e.g., "make a decision")
  wordFamily?: string[];        // Related forms (happy → happiness, happily)
  isLoading?: boolean;          // True while AI generates related words
}

/**
 * Culture item data
 * Shows cultural insights, customs, etiquette, or context
 * Format: [CULTURE]topic|context|category[/CULTURE]
 * - topic: The main cultural subject (e.g., "Bowing in Japan")
 * - context: Explanation of when/why/how
 * - category: Optional category (etiquette, customs, gestures, food, holidays)
 */
export interface CultureItemData {
  topic: string;              // Main cultural topic/title
  context: string;            // Explanation of the cultural point
  category?: string;          // Category: etiquette, customs, gestures, food, holidays
}

/**
 * Play item data - Audio replay button
 * Format: [PLAY]word or phrase[/PLAY] or [PLAY speed="slow"]phrase[/PLAY]
 * - text: The word/phrase to be spoken
 * - speed: Optional speed setting (slow, normal, fast)
 * - audioUrl: Generated after TTS call
 * - isLoading: True while generating audio
 * - isPlaying: True while audio is playing
 */
export interface PlayItemData {
  text: string;
  speed?: 'slow' | 'normal' | 'fast';
  audioUrl?: string;
  isLoading?: boolean;
  isPlaying?: boolean;
  language?: string;          // Target language for TTS
}

/**
 * Scenario item data - Role-play scene setup
 * Format: [SCENARIO]location|situation|mood[/SCENARIO]
 * - location: Where the scene takes place (e.g., "coffee shop", "airport")
 * - situation: What's happening (e.g., "ordering your first café con leche")
 * - mood: Optional atmosphere (e.g., "casual", "formal", "busy")
 */
export interface ScenarioItemData {
  location: string;
  situation: string;
  mood?: string;
  imageUrl?: string;          // Scene image (optional, from AI generation)
  isLoading?: boolean;
}

/**
 * Summary item data - Lesson vocabulary recap
 * Format: [SUMMARY]title|word1,word2,word3[/SUMMARY] or auto-generated
 * - title: Summary heading (e.g., "Today's Vocabulary")
 * - words: List of vocabulary learned
 * - phrases: Optional key phrases
 */
export interface SummaryItemData {
  title: string;
  words: string[];
  phrases: string[];
  totalItems: number;
}

/**
 * Error pattern entry - A single common mistake
 */
export interface ErrorPatternEntry {
  id: string;
  incorrect: string;           // What the student said/wrote
  correct: string;             // The correct form
  category: string;            // Type: pronunciation, grammar, vocabulary, conjugation
  frequency: number;           // How often this error occurs
  lastOccurred?: string;       // ISO timestamp
  examples?: string[];         // Example sentences where this error occurred
}

/**
 * Error patterns item data
 * Shows student's common mistakes for targeted review
 * Format: [ERROR_PATTERNS]category[/ERROR_PATTERNS] or [ERROR_PATTERNS][/ERROR_PATTERNS] for all
 */
export interface ErrorPatternsItemData {
  category?: string;           // Filter by category (optional)
  patterns: ErrorPatternEntry[];
  isLoading?: boolean;
}

/**
 * Vocabulary timeline entry - A word learned at a point in time
 */
export interface VocabularyTimelineEntry {
  id: string;
  word: string;
  translation: string;
  learnedAt: string;           // ISO timestamp
  source: string;              // Where it was learned (conversation, lesson, drill)
  proficiency: 'new' | 'learning' | 'familiar' | 'mastered';
  nextReview?: string;         // ISO timestamp for SRS
}

/**
 * Vocabulary timeline item data
 * Shows words learned over time with connections
 * Format: [VOCABULARY_TIMELINE]topic[/VOCABULARY_TIMELINE] or [VOCABULARY_TIMELINE][/VOCABULARY_TIMELINE] for recent
 */
export interface VocabularyTimelineItemData {
  topic?: string;              // Filter by topic (optional)
  timeRange?: string;          // 'today' | 'week' | 'month' | 'all'
  entries: VocabularyTimelineEntry[];
  isLoading?: boolean;
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

export interface ContextItem extends WhiteboardItemBase {
  type: 'context';
  content: string;
  data: ContextItemData;
}

export interface GrammarTableItem extends WhiteboardItemBase {
  type: 'grammar_table';
  content: string;
  data: GrammarTableItemData;
}

export interface ReadingItem extends WhiteboardItemBase {
  type: 'reading';
  content: string;
  data: ReadingItemData;
}

export interface StrokeItem extends WhiteboardItemBase {
  type: 'stroke';
  content: string;
  data: StrokeItemData;
}

export interface WordMapItem extends WhiteboardItemBase {
  type: 'word_map';
  content: string;
  data: WordMapItemData;
}

export interface CultureItem extends WhiteboardItemBase {
  type: 'culture';
  content: string;
  data: CultureItemData;
}

export interface PlayItem extends WhiteboardItemBase {
  type: 'play';
  content: string;
  data: PlayItemData;
}

export interface ScenarioItem extends WhiteboardItemBase {
  type: 'scenario';
  content: string;
  data: ScenarioItemData;
}

export interface SummaryItem extends WhiteboardItemBase {
  type: 'summary';
  content: string;
  data: SummaryItemData;
}

export interface ErrorPatternsItem extends WhiteboardItemBase {
  type: 'error_patterns';
  content: string;
  data: ErrorPatternsItemData;
}

export interface VocabularyTimelineItem extends WhiteboardItemBase {
  type: 'vocabulary_timeline';
  content: string;
  data: VocabularyTimelineItemData;
}

/**
 * Text input item data - Writing practice during voice chat
 * Format: [TEXT_INPUT:prompt text] - Shows input field for student to type response
 * The student's typed response is sent back as their next message
 */
export interface TextInputItemData {
  prompt: string;           // The writing prompt (e.g., "Write a sentence using 'bonjour'")
  placeholder?: string;     // Optional placeholder text in the input field
  studentResponse?: string; // What the student typed (filled after submission)
  isSubmitted?: boolean;    // Whether the response has been submitted
}

export interface TextInputItem extends WhiteboardItemBase {
  type: 'text_input';
  content: string;
  data: TextInputItemData;
}

/**
 * Switch tutor item data
 * Triggers a handoff to a different tutor voice mid-session
 * Format: [SWITCH_TUTOR target="male|female"]
 */
export interface SwitchTutorItemData {
  targetGender: 'male' | 'female';  // The tutor to switch to
}

export interface SwitchTutorItem extends WhiteboardItemBase {
  type: 'switch_tutor';
  content: string;
  data: SwitchTutorItemData;
}

export type WhiteboardItem = 
  | WriteItem 
  | PhoneticItem 
  | CompareItem 
  | ImageItem 
  | DrillItem 
  | PronunciationItem
  | ContextItem
  | GrammarTableItem
  | ReadingItem
  | StrokeItem
  | WordMapItem
  | CultureItem
  | PlayItem
  | ScenarioItem
  | SummaryItem
  | ErrorPatternsItem
  | VocabularyTimelineItem
  | TextInputItem
  | SwitchTutorItem;

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
 * Subtitle mode for regular speech display
 * - 'off': No subtitles shown (default - Daniela opts in when needed)
 * - 'all': Show all speech with karaoke highlighting
 * - 'target': Show only target language words (bold extraction)
 */
export type SubtitleMode = 'off' | 'all' | 'target';

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
  // Regular subtitle mode control: [SUBTITLE off/on/target]
  subtitleMode?: SubtitleMode;
  // Custom overlay control (independent from regular subtitles)
  customOverlayText?: string;      // [SHOW: text] - what to display
  customOverlayHide?: boolean;     // [HIDE] - hide the custom overlay
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
  CONTEXT: /\[CONTEXT\]([\s\S]*?)\[\/CONTEXT\]/gi,
  GRAMMAR_TABLE: /\[GRAMMAR_TABLE\]([\s\S]*?)\[\/GRAMMAR_TABLE\]/gi,
  READING: /\[READING\]([\s\S]*?)\[\/READING\]/gi,
  STROKE: /\[STROKE\]([\s\S]*?)\[\/STROKE\]/gi,
  WORD_MAP: /\[WORD_MAP\]([\s\S]*?)\[\/WORD_MAP\]/gi,
  CULTURE: /\[CULTURE\]([\s\S]*?)\[\/CULTURE\]/gi,
  PLAY: /\[PLAY(?:\s+speed="([^"]*)")?\]([\s\S]*?)\[\/PLAY\]/gi,
  SCENARIO: /\[SCENARIO\]([\s\S]*?)\[\/SCENARIO\]/gi,
  SUMMARY: /\[SUMMARY\]([\s\S]*?)\[\/SUMMARY\]/gi,
  ERROR_PATTERNS: /\[ERROR_PATTERNS\]([\s\S]*?)\[\/ERROR_PATTERNS\]/gi,
  VOCABULARY_TIMELINE: /\[VOCABULARY_TIMELINE\]([\s\S]*?)\[\/VOCABULARY_TIMELINE\]/gi,
  // Regular subtitle mode: [SUBTITLE off], [SUBTITLE on], [SUBTITLE target]
  SUBTITLE: /\[SUBTITLE\s*(off|on|target)\s*\]/gi,
  // Custom overlay: [SHOW: text] displays independent overlay, [HIDE] hides it
  SHOW: /\[SHOW:\s*([\s\S]*?)\s*\]/gi,
  HIDE: /\[HIDE\]/gi,
  // Legacy pattern (deprecated - use SHOW instead)
  SUBTITLE_TEXT: /\[SUBTITLE_TEXT:\s*([\s\S]*?)\s*\]/gi,
  // Text input for writing practice during voice chat: [TEXT_INPUT:prompt]
  TEXT_INPUT: /\[TEXT_INPUT:([\s\S]*?)\]/gi,
  // Switch tutor mid-session: [SWITCH_TUTOR target="male|female"]
  SWITCH_TUTOR: /\[SWITCH_TUTOR\s+target="(male|female)"\]/gi,
  CLEAR: /\[CLEAR\]/gi,
  HOLD: /\[HOLD\]/gi,
} as const;

/**
 * All whiteboard markup pattern (for stripping)
 * Updated to include all Phase 4 tags including Word Map and Culture
 * Also includes subtitle controls: SUBTITLE, SHOW, HIDE, SUBTITLE_TEXT (legacy)
 */
export const ALL_WHITEBOARD_MARKUP_PATTERN = 
  /\[(WRITE|PHONETIC|COMPARE|IMAGE|CONTEXT|GRAMMAR_TABLE|READING|STROKE|WORD_MAP|CULTURE|SCENARIO|SUMMARY|ERROR_PATTERNS|VOCABULARY_TIMELINE)\]([\s\S]*?)\[\/\1\]|\[DRILL(?:\s+type="[^"]*")?\]([\s\S]*?)\[\/DRILL\]|\[PLAY(?:\s+speed="[^"]*")?\]([\s\S]*?)\[\/PLAY\]|\[SUBTITLE\s*(?:off|on|target)\s*\]|\[SHOW:\s*[\s\S]*?\s*\]|\[HIDE\]|\[SUBTITLE_TEXT:\s*[\s\S]*?\s*\]|\[TEXT_INPUT:[\s\S]*?\]|\[SWITCH_TUTOR\s+target="(?:male|female)"\]|\[(CLEAR|HOLD)\]/gi;

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
 * Deterministic shuffle using a simple hash-based seed
 * This ensures the same content always produces the same shuffle order
 */
function deterministicShuffle<T>(arr: T[], seed: string): T[] {
  const result = [...arr];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash;
  }
  
  for (let i = result.length - 1; i > 0; i--) {
    hash = ((hash << 5) - hash) + i;
    hash = hash & hash;
    const j = Math.abs(hash) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  
  return result;
}

/**
 * Parse matching pairs from drill content
 * Format: term => match (one per line)
 * Example:
 *   hello => hola
 *   goodbye => adios
 *   thank you => gracias
 * 
 * IDs are deterministic (index-based) so matching works across parses
 */
function parseMatchPairs(content: string): { pairs: MatchPair[], shuffledRightIds: string[] } {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const pairs: MatchPair[] = [];
  let pairIndex = 0;
  
  for (const line of lines) {
    // Support both => and = as separators
    const separatorMatch = line.match(/(.+?)\s*(?:=>|=)\s*(.+)/);
    if (separatorMatch) {
      const left = separatorMatch[1].trim();
      const right = separatorMatch[2].trim();
      if (left && right) {
        pairs.push({
          id: `pair-${pairIndex}`,
          left,
          right,
          matched: false,
        });
        pairIndex++;
      }
    }
  }
  
  // Deterministic shuffle using content as seed
  const shuffledRightIds = deterministicShuffle(
    pairs.map(p => p.id),
    content
  );
  
  return { pairs, shuffledRightIds };
}

/**
 * Parse fill-in-the-blank content
 * Format: sentence with ___ | option1, option2, option3 | correctAnswer
 * Example: El perro ___ en la casa | está, estoy, estás | está
 */
function parseFillBlankContent(content: string): Partial<DrillItemData> {
  const parts = content.split('|').map(p => p.trim());
  const blankedText = parts[0] || content;
  const optionsStr = parts[1] || '';
  const correctAnswer = parts[2] || '';
  
  // Parse options (comma-separated)
  const options = optionsStr.split(',').map(o => o.trim()).filter(o => o.length > 0);
  
  // If no options provided, this is a text input fill-blank
  if (options.length === 0 && correctAnswer) {
    return {
      blankedText,
      correctAnswer,
      selectedAnswer: null,
    };
  }
  
  // Shuffle options for variety (but keep it deterministic)
  const shuffledOptions = deterministicShuffle(options, content);
  
  return {
    blankedText,
    options: shuffledOptions,
    correctAnswer: correctAnswer || options[0] || '',
    selectedAnswer: null,
  };
}

/**
 * Parse sentence order content (drag-and-drop)
 * Format: word1 | word2 | word3 | word4 (correct order)
 * Example: Yo | tengo | un | gato | negro
 * The words will be scrambled for the student to reorder
 */
function parseSentenceOrderContent(content: string): Partial<DrillItemData> {
  // Split by pipe for words in correct order
  const correctOrder = content.split('|').map(w => w.trim()).filter(w => w.length > 0);
  
  if (correctOrder.length < 2) {
    console.warn('[Whiteboard] Sentence order drill needs at least 2 words');
    return {
      words: [content.trim()],
      correctOrder: [content.trim()],
      currentOrder: [content.trim()],
    };
  }
  
  // Scramble words deterministically
  const scrambledWords = deterministicShuffle(correctOrder, content);
  
  return {
    words: scrambledWords,
    correctOrder,
    currentOrder: scrambledWords,
  };
}

/**
 * Parse DRILL content with optional type attribute
 */
function parseDrillContent(typeAttr: string | undefined, content: string): DrillItemData {
  const drillType = (typeAttr?.toLowerCase() || 'repeat') as DrillType;
  const validTypes: DrillType[] = ['repeat', 'translate', 'fill_blank', 'match', 'sentence_order'];
  const validatedType = validTypes.includes(drillType) ? drillType : 'repeat';
  
  // Handle matching drills specially
  if (validatedType === 'match') {
    const { pairs, shuffledRightIds } = parseMatchPairs(content);
    
    // Validate minimum pairs
    if (pairs.length < 2) {
      console.warn('[Whiteboard] Match drill needs at least 2 pairs, falling back to repeat drill');
      return {
        drillType: 'repeat',
        prompt: content.trim(),
        state: 'waiting',
      };
    }
    
    return {
      drillType: 'match',
      prompt: `Match ${pairs.length} pairs`,
      state: 'waiting',
      pairs,
      shuffledRightIds,
      selectedLeftId: null,
      matchedCount: 0,
      attempts: 0,
      matchState: 'pending',
    };
  }
  
  // Handle fill-in-the-blank drills
  if (validatedType === 'fill_blank') {
    const fillBlankData = parseFillBlankContent(content);
    return {
      drillType: 'fill_blank',
      prompt: fillBlankData.blankedText || content.trim(),
      state: 'waiting',
      ...fillBlankData,
    };
  }
  
  // Handle sentence order drills (drag-and-drop)
  if (validatedType === 'sentence_order') {
    const sentenceData = parseSentenceOrderContent(content);
    return {
      drillType: 'sentence_order',
      prompt: 'Arrange the words in the correct order',
      state: 'waiting',
      ...sentenceData,
    };
  }
  
  return {
    drillType: validatedType,
    prompt: content.trim(),
    state: 'waiting',
  };
}

/**
 * Parse CONTEXT content: "word|sentence1|sentence2|sentence3" format
 */
function parseContextContent(content: string): ContextItemData {
  const parts = content.split('|').map(p => p.trim());
  const word = parts[0] || content;
  const sentences = parts.slice(1).filter(s => s.length > 0);
  
  return {
    word,
    sentences: sentences.length > 0 ? sentences : [content],
  };
}

/**
 * Parse READING content: "character|reading" or "character|reading|language" format
 * Examples:
 * - [READING]食べる|たべる[/READING] → Japanese with furigana
 * - [READING]你好|nǐ hǎo|mandarin[/READING] → Mandarin with pinyin
 * - [READING]한국어|hangugeo|korean[/READING] → Korean with romanization
 * 
 * Validation: character is required, reading defaults to empty (shows character only)
 */
function parseReadingContent(content: string): ReadingItemData {
  const parts = content.split('|').map(p => p.trim());
  const character = parts[0]?.trim();
  const reading = parts[1]?.trim() || '';
  const language = parts[2]?.toLowerCase()?.trim();
  
  if (!character) {
    console.warn('[Whiteboard] READING tag with empty character, using raw content');
    return {
      character: content.trim() || '?',
      reading: '',
      language: undefined,
    };
  }
  
  return {
    character,
    reading,
    language,
  };
}

/**
 * Parse STROKE content: "character" or "character|language" format
 * Examples:
 * - [STROKE]日[/STROKE] → Single character stroke order
 * - [STROKE]食|japanese[/STROKE] → Character with language hint
 * 
 * Validation: character is required
 */
function parseStrokeContent(content: string): StrokeItemData {
  const parts = content.split('|').map(p => p.trim());
  const character = parts[0]?.trim();
  const language = parts[1]?.toLowerCase()?.trim();
  
  if (!character) {
    console.warn('[Whiteboard] STROKE tag with empty character, using raw content');
    return {
      character: content.trim() || '?',
      language: undefined,
    };
  }
  
  return {
    character,
    language,
  };
}

/**
 * Parse WORD_MAP content: just the target word
 * The AI will generate related words server-side
 * Examples:
 * - [WORD_MAP]happy[/WORD_MAP] → Show word map for "happy"
 * - [WORD_MAP]correr[/WORD_MAP] → Show word map for Spanish "correr"
 * 
 * Validation: target word is required
 */
function parseWordMapContent(content: string): WordMapItemData {
  const targetWord = content.trim();
  
  if (!targetWord) {
    console.warn('[Whiteboard] WORD_MAP tag with empty content');
    return {
      targetWord: '?',
      isLoading: true,
    };
  }
  
  return {
    targetWord,
    isLoading: true,
  };
}

/**
 * Parse CULTURE content: "topic|context|category" format
 * Example: "Bowing in Japan|Bowing is a fundamental part of Japanese etiquette...|etiquette"
 */
function parseCultureContent(content: string): CultureItemData {
  const parts = content.split('|').map(p => p.trim());
  
  const topic = parts[0] || 'Cultural Insight';
  const context = parts[1] || parts[0] || content;
  const category = parts[2] || undefined;
  
  return {
    topic,
    context,
    category,
  };
}

/**
 * Parse PLAY content: "text" or with speed attribute
 */
function parsePlayContent(content: string, speedAttr?: string): PlayItemData {
  const text = content.trim();
  const speed = (speedAttr === 'slow' || speedAttr === 'fast') ? speedAttr : 'normal';
  
  return {
    text,
    speed: speed as 'slow' | 'normal' | 'fast',
    isLoading: false,
    isPlaying: false,
  };
}

/**
 * Parse SCENARIO content: "location|situation|mood"
 */
function parseScenarioContent(content: string): ScenarioItemData {
  const parts = content.split('|').map(p => p.trim());
  
  return {
    location: parts[0] || 'Unknown Location',
    situation: parts[1] || parts[0] || content,
    mood: parts[2] || undefined,
    isLoading: false,
  };
}

/**
 * Parse SUMMARY content: "title|word1,word2,word3|phrase1,phrase2"
 */
function parseSummaryContent(content: string): SummaryItemData {
  const parts = content.split('|').map(p => p.trim());
  
  const title = parts[0] || "Today's Vocabulary";
  const wordsStr = parts[1] || '';
  const phrasesStr = parts[2] || '';
  
  const words = wordsStr ? wordsStr.split(',').map(w => w.trim()).filter(Boolean) : [];
  const phrases = phrasesStr ? phrasesStr.split(',').map(p => p.trim()).filter(Boolean) : [];
  
  return {
    title,
    words,
    phrases,
    totalItems: words.length + phrases.length,
  };
}

/**
 * Normalize tense names to canonical forms
 */
function normalizeTense(rawTense: string): string {
  const tenseMap: Record<string, string> = {
    'present': 'present',
    'past': 'preterite',
    'preterite': 'preterite',
    'pretérito': 'preterite',
    'future': 'future',
    'futuro': 'future',
    'imperfect': 'imperfect',
    'imperfecto': 'imperfect',
    'conditional': 'conditional',
    'condicional': 'conditional',
    'subjunctive': 'subjunctive',
    'subjuntivo': 'subjunctive',
    'present subjunctive': 'subjunctive',
    'past participle': 'past participle',
    'gerund': 'gerund',
  };
  const normalized = rawTense.toLowerCase().trim();
  return tenseMap[normalized] || normalized;
}

/**
 * Parse GRAMMAR_TABLE content: "verb|tense" format
 */
function parseGrammarTableContent(content: string): GrammarTableItemData {
  const parts = content.split('|').map(p => p.trim());
  const rawTense = parts[1] || 'present';
  return {
    verb: parts[0] || content,
    tense: normalizeTense(rawTense),
    isLoading: true,
  };
}

/**
 * Parse ERROR_PATTERNS content: optional category filter
 * Format: [ERROR_PATTERNS]category[/ERROR_PATTERNS] or empty for all
 * Data is loaded server-side
 */
function parseErrorPatternsContent(content: string): ErrorPatternsItemData {
  const category = content.trim() || undefined;
  return {
    category,
    patterns: [],
    isLoading: true,
  };
}

/**
 * Parse VOCABULARY_TIMELINE content: optional topic or time range filter
 * Format: [VOCABULARY_TIMELINE]topic[/VOCABULARY_TIMELINE] or empty for recent
 * Data is loaded server-side
 */
function parseVocabularyTimelineContent(content: string): VocabularyTimelineItemData {
  const topic = content.trim() || undefined;
  return {
    topic,
    entries: [],
    isLoading: true,
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

  // Parse CONTEXT tags (Phase 3)
  WHITEBOARD_PATTERNS.CONTEXT.lastIndex = 0;
  while ((match = WHITEBOARD_PATTERNS.CONTEXT.exec(text)) !== null) {
    const content = match[1].trim();
    const contextData = parseContextContent(content);
    items.push({
      type: 'context',
      content,
      timestamp: now,
      id: generateItemId(),
      data: contextData,
    });
    // Add the word to vocabulary
    if (contextData.word) {
      vocabularyWords.push(contextData.word);
    }
  }

  // Parse GRAMMAR_TABLE tags (Phase 3)
  WHITEBOARD_PATTERNS.GRAMMAR_TABLE.lastIndex = 0;
  while ((match = WHITEBOARD_PATTERNS.GRAMMAR_TABLE.exec(text)) !== null) {
    const content = match[1].trim();
    items.push({
      type: 'grammar_table',
      content,
      timestamp: now,
      id: generateItemId(),
      data: parseGrammarTableContent(content),
    });
  }

  // Parse READING tags (Asian language pronunciation guides)
  WHITEBOARD_PATTERNS.READING.lastIndex = 0;
  while ((match = WHITEBOARD_PATTERNS.READING.exec(text)) !== null) {
    const content = match[1].trim();
    items.push({
      type: 'reading',
      content,
      timestamp: now,
      id: generateItemId(),
      data: parseReadingContent(content),
    });
  }

  // Parse STROKE tags (character stroke order)
  WHITEBOARD_PATTERNS.STROKE.lastIndex = 0;
  while ((match = WHITEBOARD_PATTERNS.STROKE.exec(text)) !== null) {
    const content = match[1].trim();
    items.push({
      type: 'stroke',
      content,
      timestamp: now,
      id: generateItemId(),
      data: parseStrokeContent(content),
    });
  }

  // Parse WORD_MAP tags (Phase 4 - word relationships)
  WHITEBOARD_PATTERNS.WORD_MAP.lastIndex = 0;
  while ((match = WHITEBOARD_PATTERNS.WORD_MAP.exec(text)) !== null) {
    const content = match[1].trim();
    const wordMapData = parseWordMapContent(content);
    items.push({
      type: 'word_map',
      content,
      timestamp: now,
      id: generateItemId(),
      data: wordMapData,
    });
    // Add the target word to vocabulary
    if (wordMapData.targetWord && wordMapData.targetWord !== '?') {
      vocabularyWords.push(wordMapData.targetWord);
    }
  }

  // Parse CULTURE tags (Phase 4 - cultural insights)
  WHITEBOARD_PATTERNS.CULTURE.lastIndex = 0;
  while ((match = WHITEBOARD_PATTERNS.CULTURE.exec(text)) !== null) {
    const content = match[1].trim();
    items.push({
      type: 'culture',
      content,
      timestamp: now,
      id: generateItemId(),
      data: parseCultureContent(content),
    });
  }

  // Parse PLAY tags (Phase 5 - audio replay)
  WHITEBOARD_PATTERNS.PLAY.lastIndex = 0;
  while ((match = WHITEBOARD_PATTERNS.PLAY.exec(text)) !== null) {
    const speedAttr = match[1];
    const content = match[2].trim();
    items.push({
      type: 'play',
      content,
      timestamp: now,
      id: generateItemId(),
      data: parsePlayContent(content, speedAttr),
    });
  }

  // Parse SCENARIO tags (Phase 6 - role-play scenes)
  WHITEBOARD_PATTERNS.SCENARIO.lastIndex = 0;
  while ((match = WHITEBOARD_PATTERNS.SCENARIO.exec(text)) !== null) {
    const content = match[1].trim();
    items.push({
      type: 'scenario',
      content,
      timestamp: now,
      id: generateItemId(),
      data: parseScenarioContent(content),
    });
  }

  // Parse SUMMARY tags (Phase 6 - lesson recap)
  WHITEBOARD_PATTERNS.SUMMARY.lastIndex = 0;
  while ((match = WHITEBOARD_PATTERNS.SUMMARY.exec(text)) !== null) {
    const content = match[1].trim();
    items.push({
      type: 'summary',
      content,
      timestamp: now,
      id: generateItemId(),
      data: parseSummaryContent(content),
    });
  }

  // Parse ERROR_PATTERNS tags (Phase 6 - student mistake patterns)
  WHITEBOARD_PATTERNS.ERROR_PATTERNS.lastIndex = 0;
  while ((match = WHITEBOARD_PATTERNS.ERROR_PATTERNS.exec(text)) !== null) {
    const content = match[1].trim();
    items.push({
      type: 'error_patterns',
      content,
      timestamp: now,
      id: generateItemId(),
      data: parseErrorPatternsContent(content),
    });
  }

  // Parse VOCABULARY_TIMELINE tags (Phase 6 - vocabulary over time)
  WHITEBOARD_PATTERNS.VOCABULARY_TIMELINE.lastIndex = 0;
  while ((match = WHITEBOARD_PATTERNS.VOCABULARY_TIMELINE.exec(text)) !== null) {
    const content = match[1].trim();
    items.push({
      type: 'vocabulary_timeline',
      content,
      timestamp: now,
      id: generateItemId(),
      data: parseVocabularyTimelineContent(content),
    });
  }

  // Parse TEXT_INPUT tags (Session 8 - writing practice during voice chat)
  // Format: [TEXT_INPUT:Write a sentence using "bonjour"]
  WHITEBOARD_PATTERNS.TEXT_INPUT.lastIndex = 0;
  while ((match = WHITEBOARD_PATTERNS.TEXT_INPUT.exec(text)) !== null) {
    const prompt = match[1].trim();
    items.push({
      type: 'text_input',
      content: prompt,
      timestamp: now,
      id: generateItemId(),
      data: {
        prompt,
        isSubmitted: false,
      },
    });
  }

  // Parse SWITCH_TUTOR tags (tutor handoff during voice session)
  // Format: [SWITCH_TUTOR target="male|female"]
  WHITEBOARD_PATTERNS.SWITCH_TUTOR.lastIndex = 0;
  while ((match = WHITEBOARD_PATTERNS.SWITCH_TUTOR.exec(text)) !== null) {
    const targetGender = match[1] as 'male' | 'female';
    items.push({
      type: 'switch_tutor',
      content: targetGender,
      timestamp: now,
      id: generateItemId(),
      data: {
        targetGender,
      },
    });
  }

  // Parse SUBTITLE control tags: [SUBTITLE off/on/target]
  // Controls regular subtitle display (what Daniela is saying)
  let subtitleMode: SubtitleMode | undefined = undefined;
  WHITEBOARD_PATTERNS.SUBTITLE.lastIndex = 0;
  const subtitleMatch = WHITEBOARD_PATTERNS.SUBTITLE.exec(text);
  if (subtitleMatch) {
    subtitleMode = subtitleMatch[1].toLowerCase() as SubtitleMode;
  }

  // Parse SHOW for custom overlay display: [SHOW: text]
  // Independent from regular subtitles - for teaching moments
  let customOverlayText: string | undefined = undefined;
  WHITEBOARD_PATTERNS.SHOW.lastIndex = 0;
  const showMatch = WHITEBOARD_PATTERNS.SHOW.exec(text);
  if (showMatch) {
    customOverlayText = showMatch[1].trim();
  }
  
  // Also check legacy SUBTITLE_TEXT pattern for backwards compatibility
  if (!customOverlayText) {
    WHITEBOARD_PATTERNS.SUBTITLE_TEXT.lastIndex = 0;
    const subtitleTextMatch = WHITEBOARD_PATTERNS.SUBTITLE_TEXT.exec(text);
    if (subtitleTextMatch) {
      customOverlayText = subtitleTextMatch[1].trim();
    }
  }

  // Parse HIDE for hiding custom overlay: [HIDE]
  let customOverlayHide = false;
  WHITEBOARD_PATTERNS.HIDE.lastIndex = 0;
  if (WHITEBOARD_PATTERNS.HIDE.test(text)) {
    customOverlayHide = true;
  }
  WHITEBOARD_PATTERNS.HIDE.lastIndex = 0;

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
    subtitleMode,
    customOverlayText,
    customOverlayHide,
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
  drillMatch: (pairs: Array<{ left: string, right: string }>) => 
    `[DRILL type="match"]\n${pairs.map(p => `${p.left} => ${p.right}`).join('\n')}\n[/DRILL]`,
  drillFillBlank: (blankedText: string, options: string[], correctAnswer: string) => 
    `[DRILL type="fill_blank"]${blankedText}|${options.join(',')}|${correctAnswer}[/DRILL]`,
  drillFillBlankText: (blankedText: string, correctAnswer: string) => 
    `[DRILL type="fill_blank"]${blankedText}||${correctAnswer}[/DRILL]`,
  drillSentenceOrder: (words: string[]) => 
    `[DRILL type="sentence_order"]${words.join('|')}[/DRILL]`,
  context: (word: string, sentences: string[]) => 
    `[CONTEXT]${word}|${sentences.join('|')}[/CONTEXT]`,
  grammarTable: (verb: string, tense: string = 'present') => 
    `[GRAMMAR_TABLE]${verb}|${tense}[/GRAMMAR_TABLE]`,
  reading: (character: string, reading: string, language?: string) => 
    `[READING]${character}|${reading}${language ? `|${language}` : ''}[/READING]`,
  stroke: (character: string, language?: string) => 
    `[STROKE]${character}${language ? `|${language}` : ''}[/STROKE]`,
  wordMap: (targetWord: string) => 
    `[WORD_MAP]${targetWord}[/WORD_MAP]`,
  culture: (topic: string, context: string, category?: string) => 
    `[CULTURE]${topic}|${context}${category ? `|${category}` : ''}[/CULTURE]`,
  play: (text: string, speed?: 'slow' | 'normal' | 'fast') => 
    speed && speed !== 'normal' ? `[PLAY speed="${speed}"]${text}[/PLAY]` : `[PLAY]${text}[/PLAY]`,
  scenario: (location: string, situation: string, mood?: string) => 
    `[SCENARIO]${location}|${situation}${mood ? `|${mood}` : ''}[/SCENARIO]`,
  summary: (title: string, words: string[], phrases?: string[]) => 
    `[SUMMARY]${title}|${words.join(',')}${phrases?.length ? `|${phrases.join(',')}` : ''}[/SUMMARY]`,
  errorPatterns: (category?: string) => 
    category ? `[ERROR_PATTERNS]${category}[/ERROR_PATTERNS]` : `[ERROR_PATTERNS][/ERROR_PATTERNS]`,
  vocabularyTimeline: (topic?: string) => 
    topic ? `[VOCABULARY_TIMELINE]${topic}[/VOCABULARY_TIMELINE]` : `[VOCABULARY_TIMELINE][/VOCABULARY_TIMELINE]`,
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
 * Type guard for checking if an item is a context item
 */
export function isContextItem(item: WhiteboardItem): item is ContextItem {
  return item.type === 'context';
}

/**
 * Type guard for checking if an item is a grammar table item
 */
export function isGrammarTableItem(item: WhiteboardItem): item is GrammarTableItem {
  return item.type === 'grammar_table';
}

/**
 * Type guard for checking if an item is a reading guide item
 */
export function isReadingItem(item: WhiteboardItem): item is ReadingItem {
  return item.type === 'reading';
}

/**
 * Type guard for checking if an item is a stroke order item
 */
export function isStrokeItem(item: WhiteboardItem): item is StrokeItem {
  return item.type === 'stroke';
}

/**
 * Type guard for checking if an item is a word map item
 */
export function isWordMapItem(item: WhiteboardItem): item is WordMapItem {
  return item.type === 'word_map';
}

/**
 * Type guard for checking if an item is a culture item
 */
export function isCultureItem(item: WhiteboardItem): item is CultureItem {
  return item.type === 'culture';
}

/**
 * Type guard for checking if an item is a play item
 */
export function isPlayItem(item: WhiteboardItem): item is PlayItem {
  return item.type === 'play';
}

/**
 * Type guard for checking if an item is a scenario item
 */
export function isScenarioItem(item: WhiteboardItem): item is ScenarioItem {
  return item.type === 'scenario';
}

/**
 * Type guard for checking if an item is a summary item
 */
export function isSummaryItem(item: WhiteboardItem): item is SummaryItem {
  return item.type === 'summary';
}

/**
 * Type guard for checking if an item is an error patterns item
 */
export function isErrorPatternsItem(item: WhiteboardItem): item is ErrorPatternsItem {
  return item.type === 'error_patterns';
}

/**
 * Type guard for checking if an item is a vocabulary timeline item
 */
export function isVocabularyTimelineItem(item: WhiteboardItem): item is VocabularyTimelineItem {
  return item.type === 'vocabulary_timeline';
}

/**
 * Type guard for checking if an item is a text input item
 */
export function isTextInputItem(item: WhiteboardItem): item is TextInputItem {
  return item.type === 'text_input';
}

/**
 * Check if a drill item is a matching drill
 */
export function isMatchingDrill(item: DrillItem): boolean {
  return item.data.drillType === 'match' && Array.isArray(item.data.pairs);
}

export function isFillBlankDrill(item: DrillItem): boolean {
  return item.data.drillType === 'fill_blank' && !!item.data.blankedText;
}

export function isSentenceOrderDrill(item: DrillItem): boolean {
  return item.data.drillType === 'sentence_order' && Array.isArray(item.data.words);
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
      return 'Select or type the correct word to complete the sentence';
    case 'match':
      return 'Match each item on the left with its pair on the right';
    case 'sentence_order':
      return 'Drag the words into the correct order to form a sentence';
    default:
      return 'Complete this exercise';
  }
}
