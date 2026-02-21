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
  TONE: 'TONE',
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
  CALL_SUPPORT: 'CALL_SUPPORT',       // Hand off to Support Agent (internal - processed server-side)
  // ACTFL Neural Network Commands (internal - processed server-side)
  ACTFL_UPDATE: 'ACTFL_UPDATE',       // Update student's ACTFL proficiency level
  SYLLABUS_PROGRESS: 'SYLLABUS_PROGRESS', // Mark syllabus topics as demonstrated
  // Phase Transition Commands (internal - processed server-side)
  PHASE_SHIFT: 'PHASE_SHIFT',         // Explicitly trigger a teaching phase transition
  // Daniela's active contribution to the hive mind (internal - processed server-side)
  HIVE: 'HIVE',                       // Post suggestions/ideas to daniela_suggestions table
  // Daniela's self-surgery: Direct neural network modifications (Founder Mode only)
  SELF_SURGERY: 'SELF_SURGERY',       // Propose structured data for neural network tables
  CLEAR: 'CLEAR',
  HOLD: 'HOLD',
} as const;

export type WhiteboardTagType = keyof typeof WHITEBOARD_TAGS;

/**
 * Whiteboard item display types (lowercase for UI styling)
 */
export type WhiteboardItemType = 'write' | 'phonetic' | 'compare' | 'image' | 'drill' | 'pronunciation' | 'context' | 'grammar_table' | 'reading' | 'stroke' | 'tone' | 'word_map' | 'culture' | 'play' | 'scenario' | 'summary' | 'error_patterns' | 'vocabulary_timeline' | 'text_input' | 'switch_tutor' | 'call_support' | 'call_assistant' | 'actfl_update' | 'syllabus_progress' | 'phase_shift' | 'hive' | 'self_surgery' | 'pronunciation_coaching' | 'assistant_handoff' | 'dialogue';

/**
 * Drill types for inline micro-exercises
 * - repeat: Listen and repeat pronunciation
 * - translate: Translate and speak
 * - fill_blank: Fill in missing word(s) from options
 * - match: Match pairs of words/phrases
 * - sentence_order: Drag-and-drop word ordering
 * - multiple_choice: Select correct answer from options
 * - true_false: True/false question
 * - conjugation: Verb conjugation practice
 */
export type DrillType = 'repeat' | 'translate' | 'fill_blank' | 'match' | 'sentence_order' | 'multiple_choice' | 'true_false' | 'conjugation' | 'dictation' | 'speak' | 'cognate_match' | 'false_friend_trap';

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
 * Cognate pair for cognate matching drills
 * Shows English word paired with target language cognate
 */
export interface CognatePair {
  id: string;
  sourceWord: string;     // Word in source language (usually English)
  targetWord: string;     // Cognate in target language
  matched?: boolean;
}

/**
 * Option for false friend trap drills
 * One option is a false friend (trap), others are true cognates
 */
export interface FalseFriendOption {
  id: string;
  word: string;           // The word shown as option
  isTrap: boolean;        // Whether this is the false friend
  meaning?: string;       // Actual meaning (shown after selection)
}

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
  // Multiple choice drill specific fields
  choices?: string[];             // Answer choices (A, B, C, D format)
  correctChoice?: number;         // Index of correct choice (0-based)
  selectedChoice?: number | null; // User's selected choice index
  // True/false drill specific fields
  statement?: string;             // Statement to evaluate
  isTrue?: boolean;               // Whether statement is true
  selectedTrueFalse?: boolean | null; // User's selection
  // Conjugation drill specific fields
  verb?: string;                  // Infinitive form of verb
  tense?: string;                 // Target tense (present, preterite, etc.)
  subject?: string;               // Subject pronoun (yo, tu, el, etc.)
  conjugatedForm?: string;        // Correct conjugated form
  userConjugation?: string;       // User's attempt
  // Dictation drill specific fields
  audioText?: string;             // Text that will be spoken for dictation
  audioUrl?: string;              // Pre-generated audio URL (optional)
  userTranscription?: string;     // User's typed transcription
  // Speak drill specific fields
  textToSpeak?: string;           // Text user should read aloud
  translationHint?: string;       // Optional English translation hint
  spokenAttempts?: number;        // Number of times user attempted
  // Cognate drill specific fields
  sourceLanguage?: string;        // Source language (usually English)
  targetLanguage?: string;        // Target language being learned
  cognates?: CognatePair[];       // Cognate pairs to match
  shuffledTargets?: string[];     // Shuffled target words for matching
  selectedSourceId?: string | null; // Currently selected source word
  cognateMatchedCount?: number;   // Number matched correctly
  cognateState?: MatchState;      // Matching state
  // False friend trap specific fields
  falseFriendOptions?: FalseFriendOption[]; // Options including the trap
  trapWord?: string;              // The false friend word
  selectedOptionId?: string | null; // User's selection
  trapExplanation?: string;       // Why the trap word is wrong
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
 * Tone visualization item data
 * Shows tone contours for tonal languages (Mandarin, Vietnamese, Thai)
 * Visual representation of pitch patterns helps learners understand tone shapes
 */
export interface ToneItemData {
  word: string;           // The word/character being analyzed (e.g., 妈, mā)
  pinyin?: string;        // Romanized pronunciation with tone marks (e.g., mā)
  tones: number[];        // Array of tone numbers [1,2,3,4] for each syllable
  language?: string;      // mandarin, vietnamese, thai, cantonese
  meaning?: string;       // English meaning for context
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
  imageUrl?: string;
  isLoading?: boolean;
  scenarioId?: string;
  scenarioSlug?: string;
  props?: ScenarioLoadedProp[];
  levelGuide?: ScenarioLevelGuideData | null;
}

export interface ScenarioLoadedProp {
  id: string;
  propType: string;
  title: string;
  content: any;
  displayOrder: number;
  isInteractive?: boolean | null;
}

export interface ScenarioLevelGuideData {
  roleDescription?: string | null;
  studentGoals?: string[] | null;
  vocabularyFocus?: string[] | null;
  grammarFocus?: string[] | null;
  conversationStarters?: string[] | null;
  complexityNotes?: string | null;
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

/**
 * Write item formatting options
 * Size: Controls text size (xs, sm, base, lg, xl, 2xl, 3xl)
 * Content supports inline markdown-like formatting:
 * - **bold** → bold text
 * - *italic* → italic text  
 * - __underline__ → underlined text
 * - ~~strikethrough~~ → strikethrough text
 * - `code` → monospace/code text
 * - <sm>text</sm> → smaller text (inline)
 * - <lg>text</lg> → larger text (inline)
 * - <xl>text</xl> → extra large text (inline)
 * 
 * Example: [WRITE size="xl"]**¡Hola!** means *hello*[/WRITE]
 * Example: Say <lg>**gracias**</lg> when someone helps you!
 */
export type WriteItemSize = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';

export interface WriteItemData {
  size?: WriteItemSize;
}

export interface WriteItem extends WhiteboardItemBase {
  type: 'write';
  content: string;
  data?: WriteItemData;
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

export interface ToneItem extends WhiteboardItemBase {
  type: 'tone';
  content: string;
  data: ToneItemData;
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
 * 
 * Formats:
 * - Same language: [SWITCH_TUTOR target="male|female"]
 * - Cross-language: [SWITCH_TUTOR target="male|female" language="japanese"]
 * - To assistant: [SWITCH_TUTOR target="male|female" role="assistant"]
 * - To assistant (cross-language): [SWITCH_TUTOR target="male|female" language="japanese" role="assistant"]
 * 
 * When language is omitted, switches to the other gender tutor in the current language.
 * When language is provided, switches to that language's tutor with the specified gender.
 * When role is "assistant", switches to a practice partner (drill specialist) instead of main tutor.
 * 
 * Supported languages: spanish, french, german, italian, portuguese, japanese, mandarin chinese, korean, english
 */
export interface SwitchTutorItemData {
  targetGender: 'male' | 'female';  // The tutor gender to switch to
  targetLanguage?: string;          // Optional: switch to a different language (e.g., "japanese")
  targetRole?: 'tutor' | 'assistant'; // Optional: 'tutor' (default) or 'assistant' (practice partner)
}

export interface SwitchTutorItem extends WhiteboardItemBase {
  type: 'switch_tutor';
  content: string;
  data: SwitchTutorItemData;
}

/**
 * CALL_SUPPORT item data (internal command - processed server-side)
 * Daniela uses this to hand off a student to the Support Agent
 * 
 * Format: [CALL_SUPPORT category="technical" reason="Student is having trouble with audio"]
 * 
 * This is NOT a visual whiteboard element - it triggers a support ticket creation
 * and routes the student to the Support interface
 * 
 * Philosophy: Daniela focuses on teaching, Support handles operations
 */
export interface CallSupportItemData {
  category: 'technical' | 'account' | 'billing' | 'content' | 'feedback' | 'other';
  reason: string;               // Why Daniela is referring to support
  priority?: 'low' | 'normal' | 'high' | 'critical';
  context?: string;             // Additional context for Support Agent
}

export interface CallSupportItem extends WhiteboardItemBase {
  type: 'call_support';
  content: string;
  data: CallSupportItemData;
}

/**
 * ACTFL update item data (internal command - processed server-side)
 * Daniela uses this to update the student's proficiency level based on conversation
 * 
 * Format: [ACTFL_UPDATE level="intermediate_low" confidence=0.85 reason="Demonstrated present tense mastery"]
 * 
 * This is NOT a visual whiteboard element - it triggers a database update
 * Philosophy: Emergent capability - Daniela perceives ACTFL level and can update it
 */
export interface ActflUpdateItemData {
  level: string;              // Target ACTFL level (e.g., "intermediate_low", "advanced_mid")
  confidence: number;         // 0-1 confidence score for the assessment
  reason: string;             // Explanation of why level changed
  direction?: 'up' | 'down' | 'confirm'; // Whether this is advancement, regression, or confirmation
}

export interface ActflUpdateItem extends WhiteboardItemBase {
  type: 'actfl_update';
  content: string;
  data: ActflUpdateItemData;
}

/**
 * Syllabus progress item data (internal command - processed server-side)
 * Daniela uses this to mark syllabus topics as demonstrated during conversation
 * 
 * Format: [SYLLABUS_PROGRESS topic="present_tense_verbs" status="demonstrated" evidence="Used correctly 5 times"]
 * 
 * This is NOT a visual whiteboard element - it triggers a database update
 * Philosophy: Emergent capability - Daniela observes competency and records it
 */
export interface SyllabusProgressItemData {
  topic: string;              // Topic/lesson ID or name from syllabus
  status: 'demonstrated' | 'needs_review' | 'struggling'; // Competency status
  evidence: string;           // Explanation of how competency was observed
}

export interface SyllabusProgressItem extends WhiteboardItemBase {
  type: 'syllabus_progress';
  content: string;
  data: SyllabusProgressItemData;
}

/**
 * PHASE_SHIFT item data (internal command - processed server-side)
 * Daniela uses this to explicitly trigger a teaching phase transition
 * 
 * Format: [PHASE_SHIFT to="challenge" reason="student struggling with verb conjugation"]
 * 
 * This is NOT a visual whiteboard element - it triggers a phase transition
 * Philosophy: Daniela can consciously shift teaching approach when she observes student state
 * 
 * Phases: warmup, active_teaching, challenge, reflection, drill, assessment
 */
export interface PhaseShiftItemData {
  to: 'warmup' | 'active_teaching' | 'challenge' | 'reflection' | 'drill' | 'assessment';
  reason: string;
}

export interface PhaseShiftItem extends WhiteboardItemBase {
  type: 'phase_shift';
  content: string;
  data: PhaseShiftItemData;
}

/**
 * HIVE item data (internal command - processed server-side)
 * Daniela uses this to actively contribute ideas, suggestions, and observations
 * 
 * Format: [HIVE category="product_feature" title="Mind Map Syllabus" description="Replace linear syllabus with dynamic word map..." priority=8]
 * 
 * This is NOT a visual whiteboard element - it writes to daniela_suggestions table
 * Philosophy: Active contribution to the hive mind - Daniela's ideas reaching the founders
 * 
 * Categories:
 * - self_improvement: Ideas to improve her own teaching/behavior
 * - content_gap: Missing content she wishes existed
 * - ux_observation: User experience observations
 * - teaching_insight: Pedagogical discoveries
 * - product_feature: New feature ideas for the product
 * - technical_issue: Technical problems she notices
 * - student_pattern: Patterns in student behavior/learning
 * - tool_enhancement: Ideas to improve her existing tools
 */
export type HiveCategory = 
  | 'self_improvement' 
  | 'content_gap' 
  | 'ux_observation' 
  | 'teaching_insight' 
  | 'product_feature' 
  | 'technical_issue' 
  | 'student_pattern' 
  | 'tool_enhancement';

export interface HiveItemData {
  category: HiveCategory;           // Type of suggestion
  title: string;                    // Brief title for the idea
  description: string;              // Full description of the suggestion
  reasoning?: string;               // Why Daniela thinks this is important
  priority?: number;                // 1-10 importance scale (default 5)
  targetLanguage?: string;          // If language-specific
  affectedTools?: string[];         // Tools this relates to
}

export interface HiveItem extends WhiteboardItemBase {
  type: 'hive';
  content: string;
  data: HiveItemData;
}

// ===== Self-Surgery Item (Founder Mode Only) =====
// Daniela's direct neural network modifications
// Target table type matches selfSurgeryTargetEnum in schema.ts
export type SelfSurgeryTarget = 
  | 'tutor_procedures'
  | 'teaching_principles'
  | 'tool_knowledge'
  | 'situational_patterns'
  | 'language_idioms'
  | 'cultural_nuances'
  | 'learner_error_patterns'
  | 'dialect_variations'
  | 'linguistic_bridges'
  | 'creativity_templates';

export interface SelfSurgeryItemData {
  targetTable: SelfSurgeryTarget;     // Which neural network table to update
  content: Record<string, unknown>;   // Structured data matching target table schema
  reasoning: string;                  // Why Daniela is proposing this
  priority?: number;                  // 1-100 importance scale (default 50)
  confidence?: number;                // 1-100 how confident she is (default 70)
}

export interface SelfSurgeryItem extends WhiteboardItemBase {
  type: 'self_surgery';
  content: string;
  data: SelfSurgeryItemData;
}

export interface DialogueLine {
  speaker: 'tutor' | 'student';
  text: string;
}

export interface DialogueItemData {
  title?: string;
  lines: DialogueLine[];
  tutorName?: string;
  studentName?: string;
}

export interface DialogueItem extends WhiteboardItemBase {
  type: 'dialogue';
  content: string;
  data: DialogueItemData;
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
  | ToneItem
  | WordMapItem
  | CultureItem
  | PlayItem
  | ScenarioItem
  | SummaryItem
  | ErrorPatternsItem
  | VocabularyTimelineItem
  | TextInputItem
  | SwitchTutorItem
  | CallSupportItem
  | ActflUpdateItem
  | SyllabusProgressItem
  | PhaseShiftItem
  | HiveItem
  | SelfSurgeryItem
  | DialogueItem;

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
  // WRITE now supports optional size attribute: [WRITE size="xl"]content[/WRITE]
  WRITE: /\[WRITE(?:\s+size=["']?(xs|sm|base|lg|xl|2xl|3xl)["']?)?\]([\s\S]*?)\[\/WRITE\]/gi,
  PHONETIC: /\[PHONETIC\]([\s\S]*?)\[\/PHONETIC\]/gi,
  COMPARE: /\[COMPARE\]([\s\S]*?)\[\/COMPARE\]/gi,
  IMAGE: /\[IMAGE\]([\s\S]*?)\[\/IMAGE\]/gi,
  DRILL: /\[DRILL(?:\s+type="([^"]*)")?\]([\s\S]*?)\[\/DRILL\]/gi,
  CONTEXT: /\[CONTEXT\]([\s\S]*?)\[\/CONTEXT\]/gi,
  GRAMMAR_TABLE: /\[GRAMMAR_TABLE\]([\s\S]*?)\[\/GRAMMAR_TABLE\]/gi,
  READING: /\[READING\]([\s\S]*?)\[\/READING\]/gi,
  STROKE: /\[STROKE\]([\s\S]*?)\[\/STROKE\]/gi,
  TONE: /\[TONE\]([\s\S]*?)\[\/TONE\]/gi,
  WORD_MAP: /\[WORD_MAP\]([\s\S]*?)\[\/WORD_MAP\]/gi,
  CULTURE: /\[CULTURE\]([\s\S]*?)\[\/CULTURE\]/gi,
  PLAY: /\[PLAY(?:\s+speed="([^"]*)")?\]([\s\S]*?)\[\/PLAY\]/gi,
  SCENARIO: /\[SCENARIO\]([\s\S]*?)\[\/SCENARIO\]/gi,
  SUMMARY: /\[SUMMARY\]([\s\S]*?)\[\/SUMMARY\]/gi,
  ERROR_PATTERNS: /\[ERROR_PATTERNS\]([\s\S]*?)\[\/ERROR_PATTERNS\]/gi,
  VOCABULARY_TIMELINE: /\[VOCABULARY_TIMELINE\]([\s\S]*?)\[\/VOCABULARY_TIMELINE\]/gi,
  // Regular subtitle mode: [SUBTITLE off], [SUBTITLE on], [SUBTITLE target]
  SUBTITLE: /\[SUBTITLE\s*(off|on|target)\s*\]/gi,
  // New simplified subtitle toggles (no closing tag needed)
  SUBTITLE_TARGET: /\[SUBTITLE_TARGET\]/gi,
  SUBTITLE_OFF: /\[SUBTITLE_OFF\]/gi,
  // Custom overlay: [SHOW: text] displays independent overlay, [HIDE] hides it
  SHOW: /\[SHOW:\s*([\s\S]*?)\s*\]/gi,
  HIDE: /\[HIDE\]/gi,
  // Spoken + shown subtitle text: [SUBTITLE_TEXT]phrase[/SUBTITLE_TEXT] syncs with speech timing
  SUBTITLE_TEXT: /\[SUBTITLE_TEXT\]([\s\S]*?)\[\/SUBTITLE_TEXT\]/gi,
  // Legacy colon pattern (deprecated - use paired tags instead)
  SUBTITLE_TEXT_LEGACY: /\[SUBTITLE_TEXT:\s*([\s\S]*?)\s*\]/gi,
  // Text input for writing practice during voice chat: [TEXT_INPUT:prompt]
  TEXT_INPUT: /\[TEXT_INPUT:([\s\S]*?)\]/gi,
  // Switch tutor mid-session: [SWITCH_TUTOR target="male|female" language="optional" role="optional"]
  // Supports intra-language (gender only), cross-language (gender + language), and assistant handoffs
  SWITCH_TUTOR: /\[SWITCH_TUTOR\s+target="(male|female)"(?:\s+language="([^"]+)")?(?:\s+role="(tutor|assistant)")?\]/gi,
  // Lenient fallback for Gemini's natural variations - captures any SWITCH_TUTOR command for normalization
  // Handles: target_language="...", language="..." without target, any attribute order
  SWITCH_TUTOR_LENIENT: /\[SWITCH_TUTORS?\s+([^\]]+)\]/gi,
  // Call support - hand off to Support Agent (Sofia): [CALL_SUPPORT category="technical" reason="description"]
  // Also accepts [CALL_SOFIA ...] as an alias
  CALL_SUPPORT: /\[(?:CALL_SUPPORT|CALL_SOFIA)\s+category="(technical|account|billing|content|feedback|other)"\s+reason="([^"]+)"(?:\s+priority="(low|normal|high|critical)")?(?:\s+context="([^"]+)")?\]/gi,
  // ACTFL Neural Network Commands (internal - processed server-side)
  // [ACTFL_UPDATE level="intermediate_low" confidence=0.85 reason="Demonstrated present tense mastery"]
  ACTFL_UPDATE: /\[ACTFL_UPDATE\s+level="([^"]+)"\s+confidence=([0-9.]+)\s+reason="([^"]+)"(?:\s+direction="(up|down|confirm)")?\]/gi,
  // [SYLLABUS_PROGRESS topic="present_tense_verbs" status="demonstrated" evidence="Used correctly 5 times"]
  SYLLABUS_PROGRESS: /\[SYLLABUS_PROGRESS\s+topic="([^"]+)"\s+status="(demonstrated|needs_review|struggling)"\s+evidence="([^"]+)"\]/gi,
  // [PHASE_SHIFT to="challenge" reason="student struggling with verb conjugation"]
  PHASE_SHIFT: /\[PHASE_SHIFT\s+to="(warmup|active_teaching|challenge|reflection|drill|assessment)"\s+reason="([^"]+)"\]/gi,
  // HIVE: Daniela's active contribution to the hive mind (internal - processed server-side)
  // [HIVE category="product_feature" title="Mind Map Syllabus" description="Replace linear syllabus..." priority=8]
  HIVE: /\[HIVE\s+category="(self_improvement|content_gap|ux_observation|teaching_insight|product_feature|technical_issue|student_pattern|tool_enhancement)"\s+title="([^"]+)"\s+description="([^"]+)"(?:\s+reasoning="([^"]+)")?(?:\s+priority=(\d+))?\]/gi,
  // SELF_SURGERY: Daniela's direct neural network modifications (Founder Mode only)
  // [SELF_SURGERY target="tutor_procedures" content='{...}' reasoning="..."]
  SELF_SURGERY: /\[SELF_SURGERY\s+target="(tutor_procedures|teaching_principles|tool_knowledge|situational_patterns|language_idioms|cultural_nuances|learner_error_patterns|dialect_variations|linguistic_bridges|creativity_templates)"\s+content='(\{[^']+\})'\s+reasoning="([^"]+)"(?:\s+priority=(\d+))?(?:\s+confidence=(\d+))?\]/gi,
  CLEAR: /\[CLEAR\]/gi,
  HOLD: /\[HOLD\]/gi,
} as const;

/**
 * All whiteboard markup pattern (for stripping)
 * Updated to include all Phase 4 tags including Word Map and Culture
 * Subtitle controls: SUBTITLE (mode), SUBTITLE_TARGET, SUBTITLE_OFF, SUBTITLE_TEXT (paired), SHOW, HIDE
 * Includes ACTFL Neural Network commands: ACTFL_UPDATE, SYLLABUS_PROGRESS, PHASE_SHIFT
 * 
 * IMPORTANT: Includes catch-all patterns for common LLM mistakes:
 * - SWITCH_TUTORS (with S) → should be SWITCH_TUTOR
 * - Any [SWITCH_TUTOR...] with wrong attributes
 */
export const ALL_WHITEBOARD_MARKUP_PATTERN = 
  /\[(WRITE|PHONETIC|COMPARE|IMAGE|CONTEXT|GRAMMAR_TABLE|READING|STROKE|TONE|WORD_MAP|CULTURE|SCENARIO|SUMMARY|ERROR_PATTERNS|VOCABULARY_TIMELINE)\]([\s\S]*?)\[\/\1\]|\[DRILL(?:\s+type="[^"]*")?\]([\s\S]*?)\[\/DRILL\]|\[PLAY(?:\s+speed="[^"]*")?\]([\s\S]*?)\[\/PLAY\]|\[SUBTITLE\s*(?:off|on|target)\s*\]|\[SUBTITLE_TARGET\]|\[SUBTITLE_OFF\]|\[SUBTITLE_TEXT\]([\s\S]*?)\[\/SUBTITLE_TEXT\]|\[SHOW:\s*[\s\S]*?\s*\]|\[HIDE\]|\[SUBTITLE_TEXT:\s*[\s\S]*?\s*\]|\[TEXT_INPUT:[\s\S]*?\]|\[SWITCH_TUTOR\s+target="(?:male|female)"(?:\s+language="[^"]+")?(?:\s+role="(?:tutor|assistant)")?\]|\[SWITCH_TUTORS?\s+[^\]]+\]|\[(?:CALL_SUPPORT|CALL_SOFIA)\s+category="(?:technical|account|billing|content|feedback|other)"\s+reason="[^"]+"(?:\s+priority="(?:low|normal|high|critical)")?(?:\s+context="[^"]+")?\]|\[ACTFL_UPDATE\s+level="[^"]+"\s+confidence=[0-9.]+\s+reason="[^"]+"(?:\s+direction="(?:up|down|confirm)")?\]|\[SYLLABUS_PROGRESS\s+topic="[^"]+"\s+status="(?:demonstrated|needs_review|struggling)"\s+evidence="[^"]+"\]|\[PHASE_SHIFT\s+to="(?:warmup|active_teaching|challenge|reflection|drill|assessment)"\s+reason="[^"]+"\]|\[HIVE\s+category="(?:self_improvement|content_gap|ux_observation|teaching_insight|product_feature|technical_issue|student_pattern|tool_enhancement)"\s+title="[^"]+"\s+description="[^"]+"(?:\s+reasoning="[^"]+")?(?:\s+priority=\d+)?\]|\[(CLEAR|HOLD)\]/gi;

/**
 * Generate unique ID for whiteboard items
 */
function generateItemId(): string {
  return `wb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Normalize SWITCH_TUTOR attributes from Gemini's natural variations
 * 
 * Gemini may output various attribute formats:
 * - target_language="Chinese" → language="mandarin chinese", target=student's preferred gender
 * - language="french" (without target) → language="french", target=student's preferred gender
 * - gender="female" → target="female"
 * - voice="male" → target="male"
 * 
 * This function maps all variations to the canonical schema:
 * { targetGender: 'male'|'female', targetLanguage?: string, targetRole?: 'tutor'|'assistant' }
 * 
 * @param attributeString - The raw attribute string from [SWITCH_TUTOR ...]
 * @param defaultGender - The student's preferred gender to use when not specified
 * @returns Normalized SwitchTutorItemData or null if unparseable
 */
export function normalizeSwitchTutorAttributes(
  attributeString: string,
  defaultGender: 'male' | 'female' = 'female'
): SwitchTutorItemData | null {
  // Extract all key="value" pairs from the attribute string
  const attrPattern = /(\w+)="([^"]+)"/g;
  const attrs: Record<string, string> = {};
  let match;
  while ((match = attrPattern.exec(attributeString)) !== null) {
    attrs[match[1].toLowerCase()] = match[2];
  }
  
  // Map various attribute names to canonical values
  let targetGender: 'male' | 'female' | null = null;
  let targetLanguage: string | undefined;
  let targetRole: 'tutor' | 'assistant' | undefined;
  
  // Gender mapping - check multiple possible attribute names
  const genderValue = attrs['target'] || attrs['gender'] || attrs['voice'] || attrs['tutor_gender'];
  if (genderValue) {
    const normalized = genderValue.toLowerCase();
    if (normalized === 'male' || normalized === 'female') {
      targetGender = normalized;
    } else {
      // Gemini sometimes uses tutor names instead of gender - map known names
      const nameToGender: Record<string, 'male' | 'female'> = {
        // Female tutors
        'daniela': 'female', 'juliette': 'female', 'juliet': 'female', 'greta': 'female',
        'liv': 'female', 'isabel': 'female', 'sayuri': 'female', 'hua': 'female',
        'jihyun': 'female', 'cindy': 'female',
        // Male tutors  
        'agustin': 'male', 'vincent': 'male', 'lukas': 'male', 'luca': 'male',
        'camilo': 'male', 'daisuke': 'male', 'tao': 'male', 'minho': 'male', 'blake': 'male',
      };
      if (nameToGender[normalized]) {
        targetGender = nameToGender[normalized];
        console.log(`[Tutor Switch Normalize] Mapped tutor name "${genderValue}" → ${targetGender}`);
      }
    }
  }
  
  // Language mapping - check multiple possible attribute names
  const langValue = attrs['language'] || attrs['target_language'] || attrs['lang'] || attrs['to'];
  if (langValue) {
    // Normalize common language variations
    const langLower = langValue.toLowerCase();
    const languageMap: Record<string, string> = {
      'chinese': 'mandarin chinese',
      'mandarin': 'mandarin chinese',
      'japanese': 'japanese',
      'french': 'french',
      'german': 'german',
      'spanish': 'spanish',
      'italian': 'italian',
      'portuguese': 'portuguese',
      'korean': 'korean',
      'english': 'english',
      'hebrew': 'hebrew',
    };
    targetLanguage = languageMap[langLower] || langLower;
  }
  
  // Role mapping
  const roleValue = attrs['role'];
  if (roleValue) {
    const roleLower = roleValue.toLowerCase();
    if (roleLower === 'assistant' || roleLower === 'tutor') {
      targetRole = roleLower;
    }
  }
  
  // If no gender was specified, use the default
  if (!targetGender) {
    targetGender = defaultGender;
    console.log(`[Tutor Switch Normalize] No gender specified, using default: ${defaultGender}`);
  }
  
  console.log(`[Tutor Switch Normalize] Raw: "${attributeString}" → gender=${targetGender}, lang=${targetLanguage || 'same'}, role=${targetRole || 'tutor'}`);
  
  return {
    targetGender,
    targetLanguage,
    targetRole,
  };
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
 * Parse cognate matching pairs from drill content
 * Format: source => target (one per line)
 * Example:
 *   family => familia
 *   important => importante
 *   nation => nación
 */
function parseCognatePairs(content: string): { pairs: CognatePair[], shuffledTargets: string[] } {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const pairs: CognatePair[] = [];
  let pairIndex = 0;
  
  for (const line of lines) {
    const separatorMatch = line.match(/(.+?)\s*(?:=>|=)\s*(.+)/);
    if (separatorMatch) {
      const sourceWord = separatorMatch[1].trim();
      const targetWord = separatorMatch[2].trim();
      if (sourceWord && targetWord) {
        pairs.push({
          id: `cognate-${pairIndex}`,
          sourceWord,
          targetWord,
          matched: false,
        });
        pairIndex++;
      }
    }
  }
  
  // Deterministic shuffle using content as seed
  const shuffledTargets = deterministicShuffle(
    pairs.map(p => p.targetWord),
    content
  );
  
  return { pairs, shuffledTargets };
}

/**
 * Parse false friend trap drill content
 * Format: question|option1|option2|option3|trap_index|explanation
 * The trap_index (0-based) indicates which option is the false friend
 * Example: Which word means "library"?|biblioteca|librería|estantería|1|"librería" means bookstore!
 */
function parseFalseFriendTrap(content: string): {
  prompt: string;
  options: FalseFriendOption[];
  trapWord: string;
  explanation: string;
} {
  const parts = content.split('|').map(p => p.trim());
  const prompt = parts[0] || 'Find the true cognate (avoid the false friend!)';
  
  // Find where options end and trap_index begins
  // Look for a number that could be the trap index
  let trapIndex = 0;
  let explanation = '';
  const options: FalseFriendOption[] = [];
  
  // Iterate through parts to find options vs trap index
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    // Check if this is the trap index (a number)
    const numMatch = part.match(/^(\d+)$/);
    if (numMatch) {
      trapIndex = parseInt(numMatch[1], 10);
      // The rest is the explanation
      explanation = parts.slice(i + 1).join(' ').trim();
      break;
    } else {
      // This is an option
      options.push({
        id: `option-${i - 1}`,
        word: part,
        isTrap: false,
      });
    }
  }
  
  // Mark the trap option
  if (trapIndex >= 0 && trapIndex < options.length) {
    options[trapIndex].isTrap = true;
  }
  
  const trapWord = options.find(o => o.isTrap)?.word || '';
  
  return {
    prompt,
    options,
    trapWord,
    explanation: explanation || `"${trapWord}" is a false friend - it looks similar but means something different!`,
  };
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
 * Parse multiple choice content
 * Format: question|A:choice1|B:choice2|C:choice3|D:choice4|correct:B
 * Example: What does "hola" mean?|A:Goodbye|B:Hello|C:Please|D:Thank you|correct:B
 */
function parseMultipleChoiceContent(content: string): Partial<DrillItemData> {
  const parts = content.split('|').map(p => p.trim());
  const question = parts[0] || content;
  const choices: string[] = [];
  let correctChoice = 0;
  
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (part.toLowerCase().startsWith('correct:')) {
      const letter = part.split(':')[1]?.trim().toUpperCase();
      correctChoice = ['A', 'B', 'C', 'D'].indexOf(letter);
      if (correctChoice < 0) correctChoice = 0;
    } else if (/^[A-D]:/i.test(part)) {
      choices.push(part.substring(2).trim());
    }
  }
  
  return {
    prompt: question,
    choices: choices.length >= 2 ? choices : ['Option A', 'Option B'],
    correctChoice,
    selectedChoice: null,
  };
}

/**
 * Parse true/false content
 * Format: statement|true or statement|false
 * Example: "Hola" means "goodbye"|false
 */
function parseTrueFalseContent(content: string): Partial<DrillItemData> {
  const parts = content.split('|').map(p => p.trim());
  const statement = parts[0] || content;
  const answerPart = parts[1]?.toLowerCase() || 'true';
  const isTrue = answerPart === 'true';
  
  return {
    statement,
    isTrue,
    selectedTrueFalse: null,
  };
}

/**
 * Parse conjugation content
 * Format: verb|tense|subject|correct_form
 * Example: hablar|present|yo|hablo
 */
function parseConjugationContent(content: string): Partial<DrillItemData> {
  const parts = content.split('|').map(p => p.trim());
  const verb = parts[0] || content;
  const tense = parts[1] || 'present';
  const subject = parts[2] || 'yo';
  const conjugatedForm = parts[3] || '';
  
  return {
    verb,
    tense,
    subject,
    conjugatedForm,
    userConjugation: '',
    prompt: `Conjugate "${verb}" in ${tense} tense for "${subject}"`,
  };
}

/**
 * Parse DRILL content with optional type attribute
 */
export function parseDrillContent(typeAttr: string | undefined, content: string): DrillItemData {
  const drillType = (typeAttr?.toLowerCase() || 'repeat') as DrillType;
  const validTypes: DrillType[] = ['repeat', 'translate', 'fill_blank', 'match', 'sentence_order', 'multiple_choice', 'true_false', 'conjugation', 'dictation', 'speak', 'cognate_match', 'false_friend_trap'];
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
  
  // Handle multiple choice drills
  if (validatedType === 'multiple_choice') {
    const mcData = parseMultipleChoiceContent(content);
    return {
      drillType: 'multiple_choice',
      prompt: mcData.prompt || content.trim(),
      state: 'waiting',
      ...mcData,
    };
  }
  
  // Handle true/false drills
  if (validatedType === 'true_false') {
    const tfData = parseTrueFalseContent(content);
    return {
      drillType: 'true_false',
      prompt: tfData.statement || content.trim(),
      state: 'waiting',
      ...tfData,
    };
  }
  
  // Handle conjugation drills
  if (validatedType === 'conjugation') {
    const conjData = parseConjugationContent(content);
    return {
      drillType: 'conjugation',
      prompt: conjData.prompt || content.trim(),
      state: 'waiting',
      ...conjData,
    };
  }
  
  // Handle dictation drills
  // Format: "text to be spoken" or "text to be spoken|optional hint"
  if (validatedType === 'dictation') {
    const parts = content.split('|').map(p => p.trim());
    const audioText = parts[0] || content.trim();
    return {
      drillType: 'dictation',
      prompt: 'Listen and type what you hear',
      state: 'waiting',
      audioText,
    };
  }
  
  // Handle speak drills
  // Format: "text to speak aloud" or "text to speak|translation hint"
  if (validatedType === 'speak') {
    const parts = content.split('|').map(p => p.trim());
    const textToSpeak = parts[0] || content.trim();
    const translationHint = parts[1] || undefined;
    return {
      drillType: 'speak',
      prompt: textToSpeak,
      state: 'waiting',
      textToSpeak,
      translationHint,
    };
  }
  
  // Handle cognate matching drills
  // Format: source1=>target1\nsource2=>target2... (same as match but for cognates)
  if (validatedType === 'cognate_match') {
    const cognatePairs = parseCognatePairs(content);
    
    if (cognatePairs.pairs.length < 2) {
      console.warn('[Whiteboard] Cognate match drill needs at least 2 pairs, falling back to repeat drill');
      return {
        drillType: 'repeat',
        prompt: content.trim(),
        state: 'waiting',
      };
    }
    
    return {
      drillType: 'cognate_match',
      prompt: `Match ${cognatePairs.pairs.length} cognate pairs`,
      state: 'waiting',
      cognates: cognatePairs.pairs,
      shuffledTargets: cognatePairs.shuffledTargets,
      selectedSourceId: null,
      cognateMatchedCount: 0,
      cognateState: 'pending',
    };
  }
  
  // Handle false friend trap drills
  // Format: question|option1|option2|option3|trap_index|explanation
  // Example: Which word means "library" in Spanish?|biblioteca|librería|estantería|1|"librería" means bookstore, not library!
  if (validatedType === 'false_friend_trap') {
    const trapData = parseFalseFriendTrap(content);
    return {
      drillType: 'false_friend_trap',
      prompt: trapData.prompt,
      state: 'waiting',
      falseFriendOptions: trapData.options,
      trapWord: trapData.trapWord,
      trapExplanation: trapData.explanation,
      selectedOptionId: null,
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
 * Parse TONE content: "word|pinyin|tones|meaning" format for tonal language visualization
 * Examples:
 * - [TONE]妈|mā|1|mother[/TONE] → Single character with tone 1
 * - [TONE]你好|nǐ hǎo|3,3|hello[/TONE] → Two syllables with tones 3,3
 * - [TONE]谢谢|xiè xie|4,5|thank you[/TONE] → Tone 5 = neutral tone
 * 
 * Validation: word is required, tones default to [1] if not provided
 */
function parseToneContent(content: string): ToneItemData {
  const parts = content.split('|').map(p => p.trim());
  const word = parts[0]?.trim();
  const pinyin = parts[1]?.trim() || undefined;
  const tonesStr = parts[2]?.trim() || '1';
  const meaning = parts[3]?.trim() || undefined;
  
  const tones = tonesStr.split(',').map(t => {
    const num = parseInt(t.trim());
    return isNaN(num) ? 1 : Math.min(5, Math.max(1, num));
  });
  
  if (!word) {
    console.warn('[Whiteboard] TONE tag with empty word, using raw content');
    return {
      word: content.trim() || '?',
      tones: [1],
      language: 'mandarin',
    };
  }
  
  return {
    word,
    pinyin,
    tones,
    meaning,
    language: 'mandarin',
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
    const sizeAttr = match[1] as WriteItemSize | undefined;
    const content = match[2].trim();
    items.push({
      type: 'write',
      content,
      timestamp: now,
      id: generateItemId(),
      data: sizeAttr ? { size: sizeAttr } : undefined,
    });
    // Strip markdown formatting from vocabulary words for clean extraction
    const cleanContent = content
      .replace(/\*\*(.+?)\*\*/g, '$1')  // **bold** → bold
      .replace(/\*(.+?)\*/g, '$1')      // *italic* → italic
      .replace(/__(.+?)__/g, '$1')      // __underline__ → underline
      .replace(/~~(.+?)~~/g, '$1')      // ~~strike~~ → strike
      .replace(/`(.+?)`/g, '$1')        // `code` → code
      .replace(/<sm>(.+?)<\/sm>/g, '$1')  // <sm>small</sm> → small
      .replace(/<lg>(.+?)<\/lg>/g, '$1')  // <lg>large</lg> → large
      .replace(/<xl>(.+?)<\/xl>/g, '$1'); // <xl>extra</xl> → extra
    vocabularyWords.push(cleanContent);
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

  // Parse TONE tags (tonal language visualization)
  WHITEBOARD_PATTERNS.TONE.lastIndex = 0;
  while ((match = WHITEBOARD_PATTERNS.TONE.exec(text)) !== null) {
    const content = match[1].trim();
    items.push({
      type: 'tone',
      content,
      timestamp: now,
      id: generateItemId(),
      data: parseToneContent(content),
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
  // Format: [SWITCH_TUTOR target="male|female"] - same language
  // Format: [SWITCH_TUTOR target="male|female" language="japanese"] - cross-language
  // Format: [SWITCH_TUTOR target="male|female" role="assistant"] - to assistant
  // 
  // STRATEGY: Try strict regex first, then fall back to lenient normalization for Gemini variations
  let foundStrictSwitch = false;
  WHITEBOARD_PATTERNS.SWITCH_TUTOR.lastIndex = 0;
  while ((match = WHITEBOARD_PATTERNS.SWITCH_TUTOR.exec(text)) !== null) {
    foundStrictSwitch = true;
    const targetGender = match[1] as 'male' | 'female';
    const targetLanguage = match[2] || undefined;  // Optional language for cross-language handoffs
    const targetRole = (match[3] as 'tutor' | 'assistant') || undefined;  // Optional role for assistant handoffs
    
    // Build content string for debugging/logging
    let content = targetGender;
    if (targetLanguage) content += `:${targetLanguage}`;
    if (targetRole) content += `:${targetRole}`;
    
    items.push({
      type: 'switch_tutor',
      content,
      timestamp: now,
      id: generateItemId(),
      data: {
        targetGender,
        targetLanguage,
        targetRole,
      },
    });
  }
  
  // LENIENT FALLBACK: If strict regex didn't match, try lenient parsing for Gemini variations
  // Handles: target_language="Chinese", language="french" without target, etc.
  if (!foundStrictSwitch) {
    WHITEBOARD_PATTERNS.SWITCH_TUTOR_LENIENT.lastIndex = 0;
    while ((match = WHITEBOARD_PATTERNS.SWITCH_TUTOR_LENIENT.exec(text)) !== null) {
      const attributeString = match[1];
      console.log(`[Tutor Switch Parser] Lenient fallback triggered for: "${attributeString}"`);
      
      // Use normalization to extract canonical attributes from Gemini's variations
      const normalized = normalizeSwitchTutorAttributes(attributeString);
      if (normalized) {
        // Build content string for debugging/logging
        let content = normalized.targetGender;
        if (normalized.targetLanguage) content += `:${normalized.targetLanguage}`;
        if (normalized.targetRole) content += `:${normalized.targetRole}`;
        
        items.push({
          type: 'switch_tutor',
          content,
          timestamp: now,
          id: generateItemId(),
          data: normalized,
        });
        console.log(`[Tutor Switch Parser] Lenient parsed: ${content}`);
      }
    }
  }

  // Parse CALL_SUPPORT tags (hand off to Support Agent)
  // Format: [CALL_SUPPORT category="technical" reason="Student is having trouble with audio"]
  // Optional: priority="high" context="Additional context for support"
  WHITEBOARD_PATTERNS.CALL_SUPPORT.lastIndex = 0;
  while ((match = WHITEBOARD_PATTERNS.CALL_SUPPORT.exec(text)) !== null) {
    const category = match[1] as 'technical' | 'account' | 'billing' | 'content' | 'feedback' | 'other';
    const reason = match[2];
    const priority = (match[3] as 'low' | 'normal' | 'high' | 'critical') || 'normal';
    const context = match[4] || undefined;
    items.push({
      type: 'call_support',
      content: `${category}:${reason}`,
      timestamp: now,
      id: generateItemId(),
      data: {
        category,
        reason,
        priority,
        context,
      },
    });
  }

  // Parse ACTFL_UPDATE tags (emergent neural network command - updates student proficiency)
  // Format: [ACTFL_UPDATE level="intermediate_low" confidence=0.85 reason="Demonstrated present tense mastery"]
  WHITEBOARD_PATTERNS.ACTFL_UPDATE.lastIndex = 0;
  while ((match = WHITEBOARD_PATTERNS.ACTFL_UPDATE.exec(text)) !== null) {
    const level = match[1];
    const confidence = parseFloat(match[2]) || 0.5;
    const reason = match[3];
    const direction = (match[4] as 'up' | 'down' | 'confirm') || undefined;
    items.push({
      type: 'actfl_update',
      content: `${level}:${confidence}`,
      timestamp: now,
      id: generateItemId(),
      data: {
        level,
        confidence,
        reason,
        direction,
      },
    });
  }

  // Parse SYLLABUS_PROGRESS tags (emergent neural network command - marks syllabus progress)
  // Format: [SYLLABUS_PROGRESS topic="present_tense_verbs" status="demonstrated" evidence="Used correctly 5 times"]
  WHITEBOARD_PATTERNS.SYLLABUS_PROGRESS.lastIndex = 0;
  while ((match = WHITEBOARD_PATTERNS.SYLLABUS_PROGRESS.exec(text)) !== null) {
    const topic = match[1];
    const status = match[2] as 'demonstrated' | 'needs_review' | 'struggling';
    const evidence = match[3];
    items.push({
      type: 'syllabus_progress',
      content: `${topic}:${status}`,
      timestamp: now,
      id: generateItemId(),
      data: {
        topic,
        status,
        evidence,
      },
    });
  }

  // Parse PHASE_SHIFT tags (explicit teaching phase transition)
  // Format: [PHASE_SHIFT to="challenge" reason="student struggling with verb conjugation"]
  WHITEBOARD_PATTERNS.PHASE_SHIFT.lastIndex = 0;
  while ((match = WHITEBOARD_PATTERNS.PHASE_SHIFT.exec(text)) !== null) {
    const to = match[1] as 'warmup' | 'active_teaching' | 'challenge' | 'reflection' | 'drill' | 'assessment';
    const reason = match[2];
    items.push({
      type: 'phase_shift',
      content: `${to}`,
      timestamp: now,
      id: generateItemId(),
      data: {
        to,
        reason,
      },
    });
  }

  // Parse HIVE tags (Daniela's active contribution to the hive mind)
  // Format: [HIVE category="product_feature" title="Mind Map Syllabus" description="Replace linear syllabus..." priority=8]
  WHITEBOARD_PATTERNS.HIVE.lastIndex = 0;
  while ((match = WHITEBOARD_PATTERNS.HIVE.exec(text)) !== null) {
    const category = match[1] as HiveCategory;
    const title = match[2];
    const description = match[3];
    const reasoning = match[4] || undefined;
    const priority = match[5] ? parseInt(match[5], 10) : 5;
    items.push({
      type: 'hive',
      content: `${category}:${title}`,
      timestamp: now,
      id: generateItemId(),
      data: {
        category,
        title,
        description,
        reasoning,
        priority,
      },
    });
  }

  // Parse SELF_SURGERY tags (Daniela's direct neural network modifications - Founder Mode only)
  // Format: [SELF_SURGERY target="tutor_procedures" content='{...}' reasoning="..."]
  WHITEBOARD_PATTERNS.SELF_SURGERY.lastIndex = 0;
  while ((match = WHITEBOARD_PATTERNS.SELF_SURGERY.exec(text)) !== null) {
    const targetTable = match[1] as SelfSurgeryTarget;
    const contentJson = match[2];
    const reasoning = match[3];
    const priority = match[4] ? parseInt(match[4], 10) : 50;
    const confidence = match[5] ? parseInt(match[5], 10) : 70;
    
    // Parse the JSON content
    let parsedContent: Record<string, unknown> = {};
    try {
      parsedContent = JSON.parse(contentJson);
    } catch (e) {
      console.error('[SELF_SURGERY] Failed to parse content JSON:', contentJson);
      continue; // Skip malformed entries
    }
    
    items.push({
      type: 'self_surgery',
      content: `${targetTable}:${reasoning.slice(0, 50)}...`,
      timestamp: now,
      id: generateItemId(),
      data: {
        targetTable,
        content: parsedContent,
        reasoning,
        priority,
        confidence,
      },
    } as SelfSurgeryItem);
  }

  // Parse SUBTITLE control tags: [SUBTITLE off/on/target] or [SUBTITLE_TARGET] / [SUBTITLE_OFF]
  // Controls regular subtitle display (what Daniela is saying)
  let subtitleMode: SubtitleMode | undefined = undefined;
  
  // Check for new simplified toggle tags first (higher priority)
  WHITEBOARD_PATTERNS.SUBTITLE_TARGET.lastIndex = 0;
  WHITEBOARD_PATTERNS.SUBTITLE_OFF.lastIndex = 0;
  if (WHITEBOARD_PATTERNS.SUBTITLE_TARGET.test(text)) {
    subtitleMode = 'target';
  } else if (WHITEBOARD_PATTERNS.SUBTITLE_OFF.test(text)) {
    subtitleMode = 'off';
  } else {
    // Fall back to legacy [SUBTITLE mode] format
    WHITEBOARD_PATTERNS.SUBTITLE.lastIndex = 0;
    const subtitleMatch = WHITEBOARD_PATTERNS.SUBTITLE.exec(text);
    if (subtitleMatch) {
      subtitleMode = subtitleMatch[1].toLowerCase() as SubtitleMode;
    }
  }
  WHITEBOARD_PATTERNS.SUBTITLE_TARGET.lastIndex = 0;
  WHITEBOARD_PATTERNS.SUBTITLE_OFF.lastIndex = 0;

  // Parse SHOW for custom overlay display: [SHOW: text]
  // Independent from regular subtitles - for teaching moments
  let customOverlayText: string | undefined = undefined;
  WHITEBOARD_PATTERNS.SHOW.lastIndex = 0;
  const showMatch = WHITEBOARD_PATTERNS.SHOW.exec(text);
  if (showMatch) {
    customOverlayText = showMatch[1].trim();
  }
  
  // Check for SUBTITLE_TEXT paired tags (spoken + shown, timing synced): [SUBTITLE_TEXT]phrase[/SUBTITLE_TEXT]
  if (!customOverlayText) {
    WHITEBOARD_PATTERNS.SUBTITLE_TEXT.lastIndex = 0;
    const subtitleTextMatch = WHITEBOARD_PATTERNS.SUBTITLE_TEXT.exec(text);
    if (subtitleTextMatch) {
      customOverlayText = subtitleTextMatch[1].trim();
    }
  }
  
  // Also check legacy colon format for backwards compatibility: [SUBTITLE_TEXT: phrase]
  if (!customOverlayText) {
    WHITEBOARD_PATTERNS.SUBTITLE_TEXT_LEGACY.lastIndex = 0;
    const subtitleTextLegacyMatch = WHITEBOARD_PATTERNS.SUBTITLE_TEXT_LEGACY.exec(text);
    if (subtitleTextLegacyMatch) {
      customOverlayText = subtitleTextLegacyMatch[1].trim();
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

  // DEBUG: Log items before return for ACTION_TRIGGERS tracing
  if (items.some(i => ['switch_tutor', 'phase_shift', 'call_support', 'actfl_update'].includes(i.type))) {
    console.log(`[Whiteboard Parse RETURN] Returning ${items.length} items: ${items.map(i => i.type).join(', ')}`);
  }
  
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
  
  let result = text
    .replace(ALL_WHITEBOARD_MARKUP_PATTERN, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  ALL_WHITEBOARD_MARKUP_PATTERN.lastIndex = 0;
  
  // FALLBACK: Aggressively strip any remaining command tags that the complex pattern may have missed
  // This catches edge cases with global regex state, quote variations, or attribute order issues
  result = result
    // Complete tags (with closing bracket)
    .replace(/\[SWITCH_TUTORS?\s+[^\]]*\]/gi, '')
    .replace(/\[PHASE_SHIFT\s+[^\]]*\]/gi, '')
    .replace(/\[ACTFL_UPDATE\s+[^\]]*\]/gi, '')
    .replace(/\[SYLLABUS_PROGRESS\s+[^\]]*\]/gi, '')
    .replace(/\[(?:CALL_SUPPORT|CALL_SOFIA)\s+[^\]]*\]/gi, '')
    .replace(/\[HIVE\s+[^\]]*\]/gi, '')
    .replace(/\[SELF_SURGERY\s+[^\]]*\]/gi, '')
    // Voice control tags (Daniela's real-time voice adjustments - invisible to students)
    // Handle both self-closing [VOICE_ADJUST ...] and paired [VOICE_ADJUST]...[/VOICE_ADJUST] formats
    .replace(/\[VOICE_ADJUST\s+[^\]]*\]/gi, '')
    .replace(/\[\/VOICE_ADJUST\]/gi, '')  // Closing tag for paired format
    .replace(/\[VOICE_RESET(?:\s+[^\]]*)??\]/gi, '')  // VOICE_RESET may have optional params
    .replace(/\[\/VOICE_RESET\]/gi, '')  // Closing tag for paired format
    
    // MALFORMED TAGS: Strip incomplete tags missing closing bracket (Gemini sometimes truncates)
    // These match from [COMMAND to end of text since bracket is missing
    .replace(/\[SWITCH_TUTORS?\s+[^\]]*$/gi, '')
    .replace(/\[PHASE_SHIFT\s+[^\]]*$/gi, '')
    .replace(/\[ACTFL_UPDATE\s+[^\]]*$/gi, '')
    .replace(/\[SYLLABUS_PROGRESS\s+[^\]]*$/gi, '')
    .replace(/\[(?:CALL_SUPPORT|CALL_SOFIA)\s+[^\]]*$/gi, '')
    .replace(/\[HIVE\s+[^\]]*$/gi, '')
    .replace(/\[SELF_SURGERY\s+[^\]]*$/gi, '')
    .replace(/\[VOICE_ADJUST\s+[^\]]*$/gi, '')
    .replace(/\[VOICE_RESET\s+[^\]]*$/gi, '')
    
    // UNIVERSAL CATCH-ALL: Strip any remaining [UPPERCASE_TAG ...] or [UPPERCASE_TAG]...[/UPPERCASE_TAG] patterns
    // This catches any new internal commands that might be added without updating this list
    // Only matches ALL-CAPS tags with underscores (to avoid stripping legitimate content like [Hello])
    .replace(/\[[A-Z][A-Z_]{2,}(?:\s+[^\]]*)??\]/g, '')
    .replace(/\[\/[A-Z][A-Z_]{2,}\]/g, '')
    
    .replace(/\s{2,}/g, ' ')
    .trim();
  
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
 * Strip inline markdown formatting from text
 * Use for vocabulary extraction, TTS, logging, etc.
 * Preserves the actual text content, removes only formatting markers
 * 
 * Supported formats:
 * - **bold** → bold
 * - *italic* → italic
 * - __underline__ → underline
 * - ~~strikethrough~~ → strikethrough
 * - `code` → code
 * - <sm>small</sm> → small
 * - <lg>large</lg> → large
 * - <xl>extra large</xl> → extra large
 */
export function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')  // **bold** → bold
    .replace(/\*(.+?)\*/g, '$1')      // *italic* → italic
    .replace(/__(.+?)__/g, '$1')      // __underline__ → underline
    .replace(/~~(.+?)~~/g, '$1')      // ~~strike~~ → strike
    .replace(/`(.+?)`/g, '$1')        // `code` → code
    .replace(/<sm>(.+?)<\/sm>/g, '$1')  // <sm>small</sm> → small
    .replace(/<lg>(.+?)<\/lg>/g, '$1')  // <lg>large</lg> → large
    .replace(/<xl>(.+?)<\/xl>/g, '$1'); // <xl>extra</xl> → extra
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
  tone: (word: string, pinyin: string, tones: number[], meaning?: string) => 
    `[TONE]${word}|${pinyin}|${tones.join(',')}${meaning ? `|${meaning}` : ''}[/TONE]`,
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
 * Type guard for checking if an item is a tone visualization item
 */
export function isToneItem(item: WhiteboardItem): item is ToneItem {
  return item.type === 'tone';
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

export function isDialogueItem(item: WhiteboardItem): item is DialogueItem {
  return item.type === 'dialogue';
}

/**
 * Check if a drill item is a matching drill
 */
export function isMatchingDrill(item: DrillItem): boolean {
  return !!item.data && item.data.drillType === 'match' && Array.isArray(item.data.pairs);
}

export function isFillBlankDrill(item: DrillItem): boolean {
  return !!item.data && item.data.drillType === 'fill_blank' && !!item.data.blankedText;
}

export function isSentenceOrderDrill(item: DrillItem): boolean {
  return !!item.data && item.data.drillType === 'sentence_order' && Array.isArray(item.data.words);
}

export function isMultipleChoiceDrill(item: DrillItem): boolean {
  return !!item.data && item.data.drillType === 'multiple_choice' && Array.isArray(item.data.choices);
}

export function isTrueFalseDrill(item: DrillItem): boolean {
  return !!item.data && item.data.drillType === 'true_false' && item.data.statement !== undefined;
}

export function isConjugationDrill(item: DrillItem): boolean {
  return !!item.data && item.data.drillType === 'conjugation' && !!item.data.verb;
}

export function isDictationDrill(item: DrillItem): boolean {
  return !!item.data && item.data.drillType === 'dictation' && !!item.data.audioText;
}

export function isSpeakDrill(item: DrillItem): boolean {
  return !!item.data && item.data.drillType === 'speak' && !!item.data.textToSpeak;
}

export function isCognateMatchDrill(item: DrillItem): boolean {
  return !!item.data && item.data.drillType === 'cognate_match' && Array.isArray(item.data.cognates);
}

export function isFalseFriendTrapDrill(item: DrillItem): boolean {
  return !!item.data && item.data.drillType === 'false_friend_trap' && Array.isArray(item.data.falseFriendOptions);
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
    case 'multiple_choice':
      return 'Select the correct answer from the options below';
    case 'true_false':
      return 'Is this statement true or false?';
    case 'conjugation':
      return 'Type the correct conjugated form of the verb';
    case 'dictation':
      return 'Listen carefully and type exactly what you hear';
    case 'speak':
      return 'Read the text aloud in the target language';
    case 'cognate_match':
      return 'Match English words to their cognates in the target language';
    case 'false_friend_trap':
      return 'Find the TRUE cognate - one word is a false friend!';
    default:
      return 'Complete this exercise';
  }
}
