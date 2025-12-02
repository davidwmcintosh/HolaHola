/**
 * Streaming Subtitles Hook (v2 - Server-Driven Architecture)
 * 
 * NEW ARCHITECTURE: Server is the single source of truth for subtitle state.
 * - turnId: Monotonic ID for each assistant response (prevents phantom subtitles)
 * - hasTargetContent: Explicit flag from server - if false, hide subtitles immediately
 * - No client-side fallback logic - eliminates all race conditions
 * 
 * The client is a "dumb renderer" that simply displays what the server says.
 * Old packets (with older turnId) are discarded to prevent stale data.
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { WordTiming } from '../../../shared/streaming-voice-types';
import { 
  getSubtitlePolicy, 
  getWordHighlightOffset, 
  shouldRevealProgressively,
  shouldShowFullSentenceBeforeAudio,
  logTimingEvent,
  difficultyToProficiencyBand
} from '../lib/subtitlePolicies';

/**
 * A contiguous block of target language words
 * Used to show encouragement vs teaching phrases separately
 */
export interface TargetBlock {
  displayStartIndex: number;   // First display word index in this block
  displayEndIndex: number;     // Last display word index in this block
  targetStartIndex: number;    // First target word index in this block
  targetEndIndex: number;      // Last target word index in this block
  text: string;                // The target text for this block
  isTeachingBlock: boolean;    // True if this is the last block (teaching target)
}

/**
 * Sentence with its word timings and server-driven metadata
 */
export interface SubtitleSentence {
  index: number;
  turnId: number;           // Server-assigned turn ID for packet ordering
  text: string;
  hasTargetContent: boolean;  // Server explicitly says if this has target language
  targetLanguageText?: string;
  wordMapping?: Map<number, number>;
  targetBlocks?: TargetBlock[];  // Computed blocks for block-based rendering
  wordTimings: WordTiming[];
  expectedDurationMs?: number;
  actualDurationMs?: number;
  isComplete: boolean;
}

/**
 * Subtitle display state
 */
export interface StreamingSubtitleState {
  sentences: SubtitleSentence[];
  currentSentenceIndex: number;
  currentWordIndex: number;
  currentTargetWordIndex: number;
  visibleWordCount: number;
  isPlaying: boolean;
  isWaitingForContent: boolean;
  fullText: string;
  targetFullText: string;
  currentSentenceText: string;
  currentSentenceTargetText: string;
  currentTurnId: number;        // Current turn being rendered
  hasTargetContent: boolean;    // Whether current sentence has target content (server truth)
  visibleTargetText: string;
  
  // Block-based rendering for target mode
  currentTargetBlocks: TargetBlock[];      // All blocks in current sentence
  activeBlockIndex: number;                 // Which block is currently being spoken (-1 if none)
  activeBlockText: string;                  // Text of the currently active block
  teachingBlockText: string;                // Text of the teaching block (persists until turn ends)
  hasShownTeachingBlock: boolean;           // Whether teaching block has been spoken
}

/**
 * Return type for the hook
 */
export interface UseStreamingSubtitlesReturn {
  state: StreamingSubtitleState;
  addSentence: (index: number, text: string, turnId: number, hasTargetContent: boolean, targetLanguageText?: string, wordMapping?: [number, number][]) => void;
  setWordTimings: (sentenceIndex: number, turnId: number, timings: WordTiming[], expectedDurationMs?: number) => void;
  // PROGRESSIVE STREAMING: Incremental word timing updates
  addProgressiveWordTiming: (sentenceIndex: number, turnId: number, wordIndex: number, word: string, startTime: number, endTime: number, estimatedTotalDuration?: number) => void;
  finalizeWordTimings: (sentenceIndex: number, turnId: number, words: WordTiming[], actualDurationMs: number) => void;
  startPlayback: (sentenceIndex: number, turnId: number) => void;
  updatePlaybackTime: (currentTime: number, actualDuration?: number) => void;
  stopPlayback: () => void;
  completeSentence: (sentenceIndex: number, turnId: number) => void;
  reset: () => void;
  setCurrentTurnId: (turnId: number) => void;  // Called when processing message arrives with new turnId
  getCurrentWordTimings: () => WordTiming[];
  getIsWaitingForContent: () => boolean;
}

/**
 * Compute target blocks from word mapping
 * Groups contiguous display word indices into blocks with their corresponding target text
 * 
 * Example: If wordMapping has displayIndex 0 → target 0, displayIndex 22 → target 1, displayIndex 23 → target 2
 * This creates two blocks: Block 1 (display 0, "¡Excelente!"), Block 2 (display 22-23, "Buenas tardes")
 */
function computeTargetBlocks(
  wordMapping: Map<number, number> | undefined,
  targetText: string | undefined
): TargetBlock[] {
  if (!wordMapping || wordMapping.size === 0 || !targetText) {
    return [];
  }
  
  const targetWords = targetText.split(/\s+/).filter(w => w.length > 0);
  if (targetWords.length === 0) {
    return [];
  }
  
  // Sort display indices
  const displayIndices = Array.from(wordMapping.keys()).sort((a, b) => a - b);
  
  // Group into contiguous blocks
  const blocks: TargetBlock[] = [];
  let blockStart = displayIndices[0];
  let prevDisplayIdx = displayIndices[0];
  
  for (let i = 1; i <= displayIndices.length; i++) {
    const currentDisplayIdx = displayIndices[i];
    
    // Check if we hit a gap (non-consecutive) or end of array
    const isGap = i < displayIndices.length && currentDisplayIdx - prevDisplayIdx > 1;
    const isEnd = i === displayIndices.length;
    
    if (isGap || isEnd) {
      // End the current block
      const blockEnd = prevDisplayIdx;
      const targetStart = wordMapping.get(blockStart)!;
      const targetEnd = wordMapping.get(blockEnd)!;
      
      // Extract text for this block
      const blockTargetWords = targetWords.slice(targetStart, targetEnd + 1);
      const blockText = blockTargetWords.join(' ');
      
      blocks.push({
        displayStartIndex: blockStart,
        displayEndIndex: blockEnd,
        targetStartIndex: targetStart,
        targetEndIndex: targetEnd,
        text: blockText,
        isTeachingBlock: false,  // Will mark last block as teaching below
      });
      
      // Start new block if there's more to process
      if (i < displayIndices.length) {
        blockStart = currentDisplayIdx;
      }
    }
    
    prevDisplayIdx = currentDisplayIdx;
  }
  
  // Mark the last block as the teaching block (it should persist)
  if (blocks.length > 0) {
    blocks[blocks.length - 1].isTeachingBlock = true;
  }
  
  console.log(`[TargetBlocks] Computed ${blocks.length} block(s) from "${targetText}":`, 
    blocks.map(b => `"${b.text}" (display ${b.displayStartIndex}-${b.displayEndIndex}, ${b.isTeachingBlock ? 'TEACHING' : 'encouragement'})`));
  
  return blocks;
}

/**
 * Configuration for the streaming subtitles hook
 */
export interface UseStreamingSubtitlesConfig {
  difficultyLevel?: string;
}

/**
 * Hook for managing streaming subtitles with server-driven state
 * Now supports ACTFL-level-aware timing policies
 */
export function useStreamingSubtitles(config?: UseStreamingSubtitlesConfig): UseStreamingSubtitlesReturn {
  const [sentences, setSentences] = useState<SubtitleSentence[]>([]);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(-1);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [visibleWordCount, setVisibleWordCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTurnId, setCurrentTurnId] = useState(0);
  const [maxTargetWordIndex, setMaxTargetWordIndex] = useState(-1);
  
  // Server-driven: track if current sentence has target content
  const [hasTargetContent, setHasTargetContent] = useState(false);
  
  // Track if teaching block has been shown (for persistence)
  const [hasShownTeachingBlock, setHasShownTeachingBlock] = useState(false);
  
  // Ref + state for waiting flag
  const isWaitingForContentRef = useRef(false);
  const [isWaitingForContent, setIsWaitingForContent] = useState(false);
  
  // ACTFL-level-aware timing: store difficulty for policy lookups
  const difficultyRef = useRef<string>(config?.difficultyLevel || 'beginner');
  
  // Refs for animation and timing
  const currentTimingsRef = useRef<WordTiming[]>([]);
  const currentWordMappingRef = useRef<Map<number, number> | undefined>(undefined);
  const animationFrameRef = useRef<number | null>(null);
  const playbackStartTimeRef = useRef<number>(0);
  const expectedDurationRef = useRef<number | undefined>(undefined);
  const actualDurationRef = useRef<number | undefined>(undefined);
  
  // Timing cache for immediate access during streaming
  const timingsBySentenceRef = useRef<Map<number, { timings: WordTiming[]; expectedDurationMs?: number }>>(new Map());
  
  // PROGRESSIVE STREAMING: Sparse map accumulator for out-of-order word timing delivery
  // Stores all received word timings by sentence, then by word index
  // Converted to dense array up to the highest contiguous index for state updates
  const progressiveWordMapRef = useRef<Map<number, Map<number, WordTiming>>>(new Map());
  
  // RACE CONDITION FIX: Track the currently playing sentence with a ref
  // This is updated synchronously in startPlayback and checked in addProgressiveWordTiming
  // React state updates are async, so this ref ensures we always know which sentence is active
  const activeSentenceRef = useRef<number>(-1);
  
  // Update difficulty ref when config changes
  if (config?.difficultyLevel && config.difficultyLevel !== difficultyRef.current) {
    difficultyRef.current = config.difficultyLevel;
  }
  
  /**
   * Set the current turn ID (called when 'processing' message arrives)
   * This prepares the hook to accept only packets with this turnId or newer
   * CRITICAL: Only clear state when turnId is STRICTLY GREATER than current
   * to avoid resetting mid-turn when processing messages repeat for same turn
   */
  const setTurnId = useCallback((turnId: number) => {
    // ONLY reset state for a NEW (strictly greater) turn
    // This prevents clearing state when the same turnId is received multiple times
    if (turnId <= currentTurnId) {
      console.log(`[StreamingSubtitles v2] setTurnId(${turnId}) - same or older turn (current: ${currentTurnId}), skipping reset`);
      return;
    }
    
    console.log(`[StreamingSubtitles v2] ═══════════════════════════════════════════`);
    console.log(`[StreamingSubtitles v2] NEW TURN: ${turnId} (previous: ${currentTurnId})`);
    console.log(`[StreamingSubtitles v2] Clearing all state and refs...`);
    
    // Clear ALL state for new turn - prevents stale data from persisting
    setCurrentTurnId(turnId);
    setHasTargetContent(false);  // CRITICAL: Force immediate hiding of target subtitles
    setHasShownTeachingBlock(false);  // Reset teaching block persistence
    setSentences([]);
    setCurrentSentenceIndex(-1);
    setCurrentWordIndex(-1);
    setVisibleWordCount(0);
    setMaxTargetWordIndex(-1);
    setIsPlaying(false);  // Also stop playback to prevent stale timing
    
    // Clear ALL refs to prevent stale data
    timingsBySentenceRef.current.clear();
    progressiveWordMapRef.current.clear();  // PROGRESSIVE STREAMING: Clear sparse accumulator to prevent cross-turn contamination
    currentTimingsRef.current = [];
    currentWordMappingRef.current = undefined;  // Clear word mapping to prevent stale target highlighting
    expectedDurationRef.current = undefined;
    actualDurationRef.current = undefined;
    playbackStartTimeRef.current = 0;
    activeSentenceRef.current = -1;  // RACE CONDITION FIX: Reset active sentence tracking
    
    // Set waiting flag
    isWaitingForContentRef.current = true;
    setIsWaitingForContent(true);
    
    console.log(`[StreamingSubtitles v2] State cleared: hasTargetContent=false, sentences=[], isWaitingForContent=true`);
    console.log(`[StreamingSubtitles v2] ═══════════════════════════════════════════`);
  }, [currentTurnId]);
  
  /**
   * Add a new sentence (called when server sends sentence_start)
   * Now includes turnId and hasTargetContent from server
   */
  const addSentence = useCallback((
    index: number, 
    text: string, 
    turnId: number,
    hasTarget: boolean,
    targetLanguageText?: string, 
    wordMappingArray?: [number, number][]
  ) => {
    // STALE PACKET FILTER: Ignore packets from old turns
    if (turnId < currentTurnId) {
      console.log(`[StreamingSubtitles v2] ⚠ DROPPING stale sentence (turnId ${turnId} < current ${currentTurnId})`);
      return;
    }
    
    const wordMapping = wordMappingArray && wordMappingArray.length > 0
      ? new Map<number, number>(wordMappingArray)
      : undefined;
    
    console.log(`[StreamingSubtitles v2] ───────────────────────────────────────────`);
    console.log(`[StreamingSubtitles v2] ADD SENTENCE ${index} (turn ${turnId})`);
    console.log(`[StreamingSubtitles v2]   hasTarget: ${hasTarget}`);
    console.log(`[StreamingSubtitles v2]   targetText: "${targetLanguageText || '(none)'}"`);
    console.log(`[StreamingSubtitles v2]   wordMapping: ${wordMappingArray ? JSON.stringify(wordMappingArray) : '(none)'}`);
    console.log(`[StreamingSubtitles v2]   displayText: "${text.substring(0, 60)}..."`);
    
    // NOTE: Do NOT clear isWaitingForContent here!
    // The waiting flag should only be cleared in startPlayback when the sentence ACTUALLY starts playing
    // Clearing it here creates a race condition: isWaiting=false but streamingText is still empty
    // because currentSentenceIndex hasn't been updated yet (that happens in startPlayback)
    // This gap allows the fallback path in ImmersiveTutor to show OLD message text as phantom!
    
    // NOTE: Do NOT update hasTargetContent here!
    // hasTargetContent should only be updated in startPlayback when the sentence ACTUALLY starts playing
    // Setting it here causes race conditions where sentence N+1's hasTarget value is applied
    // while sentence N is still playing, causing phantom subtitles
    
    // Compute target blocks for block-based rendering
    const targetBlocks = hasTarget 
      ? computeTargetBlocks(wordMapping, targetLanguageText)
      : [];
    
    if (targetBlocks.length > 0) {
      console.log(`[StreamingSubtitles v2]   TargetBlocks:`, targetBlocks);
    }
    
    setSentences(prev => {
      // Check if sentence already exists
      const existing = prev.find(s => s.index === index && s.turnId === turnId);
      if (existing) {
        console.log(`[StreamingSubtitles v2]   Sentence already exists, skipping`);
        return prev;
      }
      
      console.log(`[StreamingSubtitles v2]   Adding to sentences array (now ${prev.length + 1} sentences)`);
      return [...prev, {
        index,
        turnId,
        text,
        hasTargetContent: hasTarget,
        targetLanguageText: hasTarget ? targetLanguageText : undefined,
        wordMapping: hasTarget ? wordMapping : undefined,
        targetBlocks: targetBlocks.length > 0 ? targetBlocks : undefined,
        wordTimings: [],
        isComplete: false,
      }];
    });
    console.log(`[StreamingSubtitles v2] ───────────────────────────────────────────`);
  }, [currentTurnId]);
  
  /**
   * Set word timings for a sentence (called when server sends word_timing)
   */
  const setWordTimings = useCallback((sentenceIndex: number, turnId: number, timings: WordTiming[], expectedDurationMs?: number) => {
    // STALE PACKET FILTER
    if (turnId < currentTurnId) {
      console.log(`[StreamingSubtitles v2] Ignoring stale timings (turnId ${turnId} < current ${currentTurnId})`);
      return;
    }
    
    console.log(`[StreamingSubtitles v2] Set timings for sentence ${sentenceIndex} (turn ${turnId}): ${timings.length} words`);
    
    // Store in ref for immediate access
    timingsBySentenceRef.current.set(sentenceIndex, { timings, expectedDurationMs });
    
    // Update React state
    setSentences(prev => {
      return prev.map(s => {
        if (s.index === sentenceIndex && s.turnId === turnId) {
          return { ...s, wordTimings: timings, expectedDurationMs };
        }
        return s;
      });
    });
    
    // Update refs if this is the active sentence
    if (sentenceIndex === currentSentenceIndex) {
      currentTimingsRef.current = timings;
      expectedDurationRef.current = expectedDurationMs;
    }
  }, [currentTurnId, currentSentenceIndex]);
  
  /**
   * Convert sparse word map to dense array up to highest contiguous index
   * Example: {0: w0, 1: w1, 3: w3} → [w0, w1] (stops at gap)
   * This ensures no null/placeholder entries in the output array
   */
  const sparseToDenseTimings = (wordMap: Map<number, WordTiming>): WordTiming[] => {
    const result: WordTiming[] = [];
    let nextExpected = 0;
    
    // Iterate through expected indices until we hit a gap
    while (wordMap.has(nextExpected)) {
      result.push(wordMap.get(nextExpected)!);
      nextExpected++;
    }
    
    return result;
  };
  
  /**
   * PROGRESSIVE STREAMING: Add a single word timing incrementally
   * These arrive as words are timestamped during progressive TTS synthesis.
   * 
   * Design: Store all received timings in a sparse Map, then convert to dense array
   * for state updates. This ensures:
   * - No words are lost (all stored in Map)
   * - Array has no gaps or placeholders (dense conversion)
   * - Out-of-order delivery is handled gracefully (gaps filled when missing words arrive)
   */
  const addProgressiveWordTiming = useCallback((
    sentenceIndex: number,
    turnId: number,
    wordIndex: number,
    word: string,
    startTime: number,
    endTime: number,
    estimatedTotalDuration?: number
  ) => {
    // STALE PACKET FILTER
    if (turnId < currentTurnId) {
      console.log(`[StreamingSubtitles v2] Ignoring stale progressive timing (turnId ${turnId} < current ${currentTurnId})`);
      return;
    }
    
    console.log(`[StreamingSubtitles v2] Progressive timing: sentence ${sentenceIndex}, word ${wordIndex} "${word}" ${startTime.toFixed(3)}-${endTime.toFixed(3)}s`);
    
    // Build word timing object
    const newTiming: WordTiming = { word, startTime, endTime };
    
    // Get or create sparse Map for this sentence
    if (!progressiveWordMapRef.current.has(sentenceIndex)) {
      progressiveWordMapRef.current.set(sentenceIndex, new Map());
    }
    const wordMap = progressiveWordMapRef.current.get(sentenceIndex)!;
    
    // Store timing at its index (Map handles sparse storage naturally)
    wordMap.set(wordIndex, newTiming);
    
    // Convert sparse map to dense array (up to highest contiguous index)
    const timings = sparseToDenseTimings(wordMap);
    
    // Log if we have out-of-order delivery (stored but not yet in dense array)
    if (wordIndex >= timings.length && wordMap.size > timings.length) {
      console.log(`[StreamingSubtitles v2] Out-of-order word stored (index ${wordIndex}), awaiting earlier indices. Dense: ${timings.length}, Stored: ${wordMap.size}`);
    }
    
    const existing = timingsBySentenceRef.current.get(sentenceIndex);
    const newEstimatedDuration = estimatedTotalDuration ? estimatedTotalDuration * 1000 : existing?.expectedDurationMs;
    
    // Update ref for immediate access (dense array only)
    timingsBySentenceRef.current.set(sentenceIndex, {
      timings,
      expectedDurationMs: newEstimatedDuration
    });
    
    // Update React state for progressive karaoke highlighting
    setSentences(prev => {
      return prev.map(s => {
        if (s.index === sentenceIndex && s.turnId === turnId) {
          return {
            ...s,
            wordTimings: timings,
            expectedDurationMs: newEstimatedDuration ?? s.expectedDurationMs
          };
        }
        return s;
      });
    });
    
    // RACE CONDITION FIX: Use activeSentenceRef instead of currentSentenceIndex state
    // The ref is updated synchronously in startPlayback, while state updates are async
    // This ensures progressive timings arriving after startPlayback correctly update currentTimingsRef
    if (sentenceIndex === activeSentenceRef.current) {
      currentTimingsRef.current = timings;
      if (newEstimatedDuration) {
        expectedDurationRef.current = newEstimatedDuration;
      }
      
      // ACTFL policy fix: For non-progressive reveal policies (intermediate/advanced),
      // immediately update visibleWordCount so subtitles show as timings arrive.
      // Progressive reveal (novice) waits for updatePlaybackTime to control visibility.
      const useProgressiveReveal = shouldRevealProgressively(difficultyRef.current);
      if (!useProgressiveReveal) {
        setVisibleWordCount(timings.length);
      }
    }
  }, [currentTurnId]);
  
  /**
   * PROGRESSIVE STREAMING: Finalize word timings with authoritative data
   * Called when sentence synthesis completes. This corrects any timing drift
   * from the incremental delta messages and provides the final word count.
   */
  const finalizeWordTimings = useCallback((
    sentenceIndex: number,
    turnId: number,
    words: WordTiming[],
    actualDurationMs: number
  ) => {
    // STALE PACKET FILTER
    if (turnId < currentTurnId) {
      console.log(`[StreamingSubtitles v2] Ignoring stale final timings (turnId ${turnId} < current ${currentTurnId})`);
      return;
    }
    
    console.log(`[StreamingSubtitles v2] Finalize timings for sentence ${sentenceIndex} (turn ${turnId}): ${words.length} words, ${actualDurationMs}ms`);
    
    // Clear progressive word map for this sentence (no longer needed)
    progressiveWordMapRef.current.delete(sentenceIndex);
    
    // Update ref with authoritative data (overwrites any progressive deltas)
    timingsBySentenceRef.current.set(sentenceIndex, {
      timings: words,
      expectedDurationMs: actualDurationMs
    });
    
    // Update React state with authoritative word timings
    setSentences(prev => {
      return prev.map(s => {
        if (s.index === sentenceIndex && s.turnId === turnId) {
          return {
            ...s,
            wordTimings: words,
            expectedDurationMs: actualDurationMs,
            actualDurationMs: actualDurationMs
          };
        }
        return s;
      });
    });
    
    // Update refs if this is the active sentence
    if (sentenceIndex === currentSentenceIndex) {
      currentTimingsRef.current = words;
      expectedDurationRef.current = actualDurationMs;
      actualDurationRef.current = actualDurationMs;
    }
  }, [currentTurnId, currentSentenceIndex]);
  
  /**
   * Start playback for a sentence
   * CRITICAL: All state updates must happen synchronously to prevent race conditions
   * 
   * ACTFL-level-aware text reveal:
   * - Novice: Progressive reveal (words appear one by one as audio plays)
   * - Intermediate: Full sentence visible before audio, highlighting moves through
   * - Advanced: Full sentence visible, natural rhythm highlighting
   */
  const startPlayback = useCallback((sentenceIndex: number, turnId: number) => {
    // STALE PACKET FILTER
    if (turnId < currentTurnId) {
      console.log(`[StreamingSubtitles v2] ⚠ DROPPING stale playback start (turnId ${turnId} < current ${currentTurnId})`);
      return;
    }
    
    console.log(`[StreamingSubtitles v2] ▶ START PLAYBACK sentence ${sentenceIndex} (turn ${turnId})`);
    
    // RACE CONDITION FIX: Set active sentence ref IMMEDIATELY (synchronous)
    // This allows addProgressiveWordTiming to update currentTimingsRef for this sentence
    // even before the React state update completes
    activeSentenceRef.current = sentenceIndex;
    
    // CRITICAL: Clear waiting flag NOW, at playback start, not in addSentence
    // This ensures isWaiting stays true until streamingText will actually have content
    // (streamingText depends on currentSentenceIndex which is set below)
    isWaitingForContentRef.current = false;
    setIsWaitingForContent(false);
    
    // Get timings from cache
    const storedTimings = timingsBySentenceRef.current.get(sentenceIndex);
    if (storedTimings) {
      currentTimingsRef.current = storedTimings.timings;
      expectedDurationRef.current = storedTimings.expectedDurationMs;
      console.log(`[StreamingSubtitles v2] ▶ LOADED ${storedTimings.timings.length} timings for sentence ${sentenceIndex}`);
    } else {
      currentTimingsRef.current = [];
      expectedDurationRef.current = undefined;
      console.log(`[StreamingSubtitles v2] ▶ NO CACHED timings for sentence ${sentenceIndex} (activeSentence ref set to ${activeSentenceRef.current})`);
    }
    
    // ACTFL-level-aware text reveal policy
    // - If progressiveReveal is false, show all words immediately
    // - If showFullSentenceBeforeAudio is true, also show all words
    // This allows intermediate/advanced learners to see full context
    const useProgressiveReveal = shouldRevealProgressively(difficultyRef.current);
    const showFullSentence = shouldShowFullSentenceBeforeAudio(difficultyRef.current);
    
    // Determine initial visible word count based on policy
    const initialVisibleCount = (!useProgressiveReveal || showFullSentence) 
      ? currentTimingsRef.current.length 
      : 0;
    
    console.log(`[StreamingSubtitles v2]   Policy: progressive=${useProgressiveReveal}, fullSentence=${showFullSentence}, initialVisible=${initialVisibleCount}`);
    
    // CRITICAL FIX: Look up sentence data SYNCHRONOUSLY before any state updates
    // This prevents race conditions where hasTargetContent updates async inside setSentences
    setSentences(prev => {
      const sentence = prev.find(s => s.index === sentenceIndex && s.turnId === turnId);
      if (sentence) {
        currentWordMappingRef.current = sentence.wordMapping;
        
        // Log the transition for debugging
        console.log(`[StreamingSubtitles v2]   Sentence ${sentenceIndex} hasTarget: ${sentence.hasTargetContent}`);
        console.log(`[StreamingSubtitles v2]   Sentence ${sentenceIndex} targetText: "${sentence.targetLanguageText || '(none)'}"`);
        
        // CRITICAL: Update hasTargetContent FIRST, BEFORE returning from setSentences
        // This ensures hasTargetContent is in sync with the sentence being played
        // Previously this was a race condition because setHasTargetContent was async
        setHasTargetContent(sentence.hasTargetContent);
        
        // Also update sentence index and other state in same batch
        setCurrentSentenceIndex(sentenceIndex);
        setIsPlaying(true);
        // ACTFL-aware initial visibility: show all words for non-progressive modes
        setVisibleWordCount(initialVisibleCount);
        setCurrentWordIndex(-1);
        setMaxTargetWordIndex(-1);
        // CRITICAL: Reset teaching block tracking per sentence
        // Prevents previous sentence's teaching block from showing before it's reached in new sentence
        setHasShownTeachingBlock(false);
      } else {
        console.warn(`[StreamingSubtitles v2] ⚠ Sentence ${sentenceIndex} (turn ${turnId}) not found in sentences array!`);
        console.warn(`[StreamingSubtitles v2]   Available sentences:`, prev.map(s => ({ idx: s.index, turnId: s.turnId })));
        
        // CRITICAL: Set hasTargetContent to FALSE when sentence not found
        // This prevents stale hasTargetContent=true from causing phantom subtitles
        setHasTargetContent(false);
        currentWordMappingRef.current = undefined;
        
        // Still update sentence index even if sentence not found
        setCurrentSentenceIndex(sentenceIndex);
        setIsPlaying(true);
        setVisibleWordCount(0);
        setCurrentWordIndex(-1);
        setMaxTargetWordIndex(-1);
        setHasShownTeachingBlock(false);
      }
      return prev;
    });
    
    playbackStartTimeRef.current = Date.now();
    actualDurationRef.current = undefined;
    
    // Log telemetry for playback start
    logTimingEvent({
      event: 'playback_start',
      turnId,
      sentenceIndex,
      audioTime: 0,
      wallClockTime: Date.now(),
      timingSource: 'perf',
      difficulty: difficultyRef.current,
      proficiencyBand: difficultyToProficiencyBand(difficultyRef.current),
    });
  }, [currentTurnId]);
  
  /**
   * Update playback time (called from high-precision timing loop)
   * 
   * ACTFL-level-aware timing:
   * - Novice: 100ms offset (words appear slightly before audio for processing time)
   * - Intermediate: 50ms offset (faster processing, less lead time needed)
   * - Advanced: 0ms offset (natural rhythm, no artificial delay)
   * 
   * ACTFL-level-aware text reveal:
   * - Progressive reveal: Words become visible as timing reaches them
   * - Non-progressive: All words visible, only highlighting moves
   * 
   * CRITICAL: currentTime now comes directly from audio.currentTime,
   * ensuring subtitles stay locked to actual playback position.
   */
  const updatePlaybackTime = useCallback((currentTime: number, actualDuration?: number) => {
    const timings = currentTimingsRef.current;
    if (timings.length === 0) {
      // DEBUG: Log when timings are empty
      console.log(`[StreamingSubtitles v2] updatePlaybackTime: NO TIMINGS (activeSentence=${activeSentenceRef.current}, currentSentence=${currentSentenceIndex})`);
      return;
    }
    
    // ACTFL-level-aware timing offset
    // Lower levels get more lead time to process text before hearing it
    const policyOffset = getWordHighlightOffset(difficultyRef.current);
    const adjustedTime = Math.max(0, currentTime - policyOffset);
    
    // Store actual duration for rescaling server estimates
    const isValidDuration = actualDuration !== undefined && actualDuration > 0 && Number.isFinite(actualDuration);
    const needsUpdate = actualDurationRef.current === undefined || !Number.isFinite(actualDurationRef.current);
    
    if (isValidDuration && needsUpdate) {
      actualDurationRef.current = actualDuration * 1000;
    }
    
    // Calculate rescaling factor to recalibrate server estimates with actual duration
    // This corrects for discrepancies between estimated and actual audio length
    let scaleFactor = 1;
    const expected = expectedDurationRef.current;
    const actual = actualDurationRef.current;
    
    if (expected && actual && expected > 0 && Number.isFinite(actual)) {
      scaleFactor = actual / expected;
      // Only apply rescaling if difference is significant (>5%)
      if (Math.abs(scaleFactor - 1) < 0.05) scaleFactor = 1;
    }
    
    let wordIndex = -1;
    let maxVisibleIndex = -1;
    
    for (let i = 0; i < timings.length; i++) {
      const timing = timings[i];
      const scaledStartTime = timing.startTime * scaleFactor;
      const scaledEndTime = timing.endTime * scaleFactor;
      
      if (adjustedTime >= scaledStartTime) maxVisibleIndex = i;
      if (adjustedTime >= scaledStartTime && adjustedTime < scaledEndTime) wordIndex = i;
    }
    
    // ACTFL-level-aware text reveal:
    // - Progressive mode (novice): Update visibleWordCount based on timing for word-by-word reveal
    // - Non-progressive mode (intermediate/advanced): Always show all available words immediately
    const useProgressiveReveal = shouldRevealProgressively(difficultyRef.current);
    if (useProgressiveReveal) {
      setVisibleWordCount(maxVisibleIndex + 1);
    } else {
      // PROGRESSIVE STREAMING FIX: For non-progressive policies, ensure visibleWordCount
      // stays synced with timings.length so subtitles show immediately as words arrive.
      // This handles race conditions where state batching causes currentSentenceIndex to lag.
      setVisibleWordCount(timings.length);
    }
    // Always update the current word highlight (for karaoke effect)
    setCurrentWordIndex(prevIndex => {
      // Only log telemetry when word index changes
      if (prevIndex !== wordIndex && wordIndex >= 0) {
        const timing = timings[wordIndex];
        const scaledStartTime = timing.startTime * scaleFactor;
        // CRITICAL: Use adjustedTime for drift calculation, not raw currentTime
        // This accounts for the ACTFL-level-aware offset, so drift=0 means perfect sync
        const drift = adjustedTime - scaledStartTime;
        
        logTimingEvent({
          event: 'word_highlight',
          turnId: currentTurnId,
          sentenceIndex: currentSentenceIndex,
          audioTime: currentTime,
          wallClockTime: Date.now(),
          timingSource: 'audio',
          wordIndex,
          wordText: timing.word,
          expectedTime: scaledStartTime,
          drift,
          difficulty: difficultyRef.current,
          proficiencyBand: difficultyToProficiencyBand(difficultyRef.current),
        });
      }
      return wordIndex;
    });
  }, [currentTurnId, currentSentenceIndex]);
  
  /**
   * Stop playback
   */
  const stopPlayback = useCallback(() => {
    console.log('[StreamingSubtitles v2] Stop playback');
    setIsPlaying(false);
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);
  
  /**
   * Mark sentence as complete
   */
  const completeSentence = useCallback((sentenceIndex: number, turnId: number) => {
    // STALE PACKET FILTER
    if (turnId < currentTurnId) return;
    
    // Log telemetry for sentence completion
    logTimingEvent({
      event: 'sentence_complete',
      turnId,
      sentenceIndex,
      audioTime: actualDurationRef.current ? actualDurationRef.current / 1000 : 0,
      wallClockTime: Date.now(),
      timingSource: 'perf',
      difficulty: difficultyRef.current,
      proficiencyBand: difficultyToProficiencyBand(difficultyRef.current),
    });
    
    // Clean up timing cache
    timingsBySentenceRef.current.delete(sentenceIndex);
    
    setSentences(prev => {
      return prev.map(s => {
        if (s.index === sentenceIndex && s.turnId === turnId) {
          return { ...s, isComplete: true };
        }
        return s;
      });
    });
  }, [currentTurnId]);
  
  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    console.log('[StreamingSubtitles v2] Reset');
    
    isWaitingForContentRef.current = true;
    activeSentenceRef.current = -1;  // RACE CONDITION FIX: Reset active sentence tracking
    
    setIsWaitingForContent(true);
    setSentences([]);
    setCurrentSentenceIndex(-1);
    setCurrentWordIndex(-1);
    setVisibleWordCount(0);
    setIsPlaying(false);
    setMaxTargetWordIndex(-1);
    setHasTargetContent(false);
    // Don't reset currentTurnId - let setCurrentTurnId handle that
    
    currentTimingsRef.current = [];
    expectedDurationRef.current = undefined;
    actualDurationRef.current = undefined;
    timingsBySentenceRef.current.clear();
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);
  
  /**
   * Get current word timings
   */
  const getCurrentWordTimings = useCallback(() => {
    return currentTimingsRef.current;
  }, []);
  
  /**
   * Get synchronous waiting flag
   */
  const getIsWaitingForContent = useCallback(() => {
    return isWaitingForContentRef.current;
  }, []);
  
  // Compute full text from all sentences
  const fullText = useMemo(() => 
    sentences
      .sort((a, b) => a.index - b.index)
      .map(s => s.text)
      .join(' '),
    [sentences]
  );
  
  // Compute target-language-only full text
  const targetFullText = useMemo(() => 
    sentences
      .filter(s => s.hasTargetContent)  // Only sentences server marked as having target content
      .sort((a, b) => a.index - b.index)
      .map(s => s.targetLanguageText || '')
      .filter(t => t.length > 0)
      .join(' '),
    [sentences]
  );
  
  // Compute visible target text - only from completed sentences with target content
  const visibleTargetText = useMemo(() => {
    return sentences
      .filter(s => s.isComplete && s.hasTargetContent)
      .sort((a, b) => a.index - b.index)
      .map(s => s.targetLanguageText || '')
      .filter(t => t.length > 0)
      .join(' ');
  }, [sentences]);
  
  // Get current sentence for karaoke display
  // CRITICAL: Must match BOTH index AND turnId to prevent cross-turn contamination
  const currentSentence = useMemo(() => {
    const found = sentences.find(s => s.index === currentSentenceIndex && s.turnId === currentTurnId);
    
    // Debug: Log if we can't find the sentence (indicates potential bug)
    if (!found && sentences.length > 0 && currentSentenceIndex >= 0) {
      console.warn(`[StreamingSubtitles v2] ⚠️ Sentence not found: idx=${currentSentenceIndex}, turnId=${currentTurnId}`);
      console.warn(`[StreamingSubtitles v2]   Available:`, sentences.map(s => ({ idx: s.index, turnId: s.turnId })));
    }
    
    return found;
  }, [sentences, currentSentenceIndex, currentTurnId]);
  
  const currentSentenceText = currentSentence?.text || '';
  
  // SERVER-DRIVEN: Gate target text on hasTargetContent flag
  // This ensures immediate hiding when server says no target content, 
  // preventing stale text from persisting during React state batching
  const currentSentenceTargetText = (hasTargetContent && currentSentence?.hasTargetContent)
    ? (currentSentence?.targetLanguageText || '')
    : '';
  
  // DEBUG: Log any time target text changes - especially catch duplicates!
  if (currentSentenceTargetText) {
    const wordCount = currentSentenceTargetText.split(/\s+/).filter(w => w.length > 0).length;
    console.log(`[StreamingSubtitles v2] TARGET TEXT: "${currentSentenceTargetText}" (sentence ${currentSentenceIndex}, ${wordCount} words, hasTarget=${hasTargetContent})`);
    
    // CRITICAL: Flag multi-word targets - this is where duplicates might originate
    if (wordCount > 1) {
      console.warn(`[StreamingSubtitles v2] ⚠️ MULTI-WORD TARGET DETECTED: "${currentSentenceTargetText}"`);
      console.warn(`[StreamingSubtitles v2]   currentSentence.targetLanguageText: "${currentSentence?.targetLanguageText}"`);
      console.warn(`[StreamingSubtitles v2]   currentTurnId: ${currentTurnId}`);
      console.warn(`[StreamingSubtitles v2]   sentences array:`, sentences.map(s => ({ 
        idx: s.index, 
        turnId: s.turnId,  // CRITICAL: Include turnId to detect cross-turn contamination
        target: s.targetLanguageText, 
        hasTarget: s.hasTargetContent 
      })));
    }
  }
  
  // Compute current target word index from word mapping
  const instantTargetWordIndex = useMemo(() => {
    if (currentWordIndex < 0) return -1;
    
    const mapping = currentSentence?.wordMapping;
    if (!mapping) return -1;
    
    return mapping.get(currentWordIndex) ?? -1;
  }, [currentWordIndex, currentSentence?.wordMapping]);
  
  // Progressive reveal for target words
  const currentTargetWordIndex = useMemo(() => {
    if (instantTargetWordIndex > maxTargetWordIndex) {
      console.log(`[StreamingSubtitles v2] TargetWordIndex: instant=${instantTargetWordIndex} > max=${maxTargetWordIndex}, returning instant`);
      setTimeout(() => setMaxTargetWordIndex(instantTargetWordIndex), 0);
      return instantTargetWordIndex;
    }
    console.log(`[StreamingSubtitles v2] TargetWordIndex: instant=${instantTargetWordIndex} <= max=${maxTargetWordIndex}, returning max`);
    return maxTargetWordIndex;
  }, [instantTargetWordIndex, maxTargetWordIndex]);
  
  // Block-based rendering: Get target blocks for current sentence
  const currentTargetBlocks = useMemo(() => {
    return currentSentence?.targetBlocks || [];
  }, [currentSentence?.targetBlocks]);
  
  // Determine which block is currently active based on display word index
  const activeBlockIndex = useMemo(() => {
    if (currentWordIndex < 0 || currentTargetBlocks.length === 0) return -1;
    
    const blockIdx = currentTargetBlocks.findIndex(block => 
      currentWordIndex >= block.displayStartIndex && currentWordIndex <= block.displayEndIndex
    );
    
    return blockIdx;
  }, [currentWordIndex, currentTargetBlocks]);
  
  // Get the text of the currently active block
  const activeBlockText = useMemo(() => {
    if (activeBlockIndex < 0 || !currentTargetBlocks[activeBlockIndex]) return '';
    return currentTargetBlocks[activeBlockIndex].text;
  }, [activeBlockIndex, currentTargetBlocks]);
  
  // Get the teaching block text (last block in the sentence)
  const teachingBlock = useMemo(() => {
    const teaching = currentTargetBlocks.find(b => b.isTeachingBlock);
    return teaching;
  }, [currentTargetBlocks]);
  
  const teachingBlockText = teachingBlock?.text || '';
  
  // Track when teaching block has been reached (for persistence)
  // Once shown, it stays until turn ends
  useMemo(() => {
    if (teachingBlock && currentWordIndex >= teachingBlock.displayStartIndex) {
      if (!hasShownTeachingBlock) {
        console.log(`[StreamingSubtitles v2] 📌 Teaching block reached: "${teachingBlockText}" - will persist`);
        setTimeout(() => setHasShownTeachingBlock(true), 0);
      }
    }
  }, [currentWordIndex, teachingBlock, hasShownTeachingBlock, teachingBlockText]);
  
  // Log block transitions for debugging
  useMemo(() => {
    if (currentTargetBlocks.length > 0) {
      console.log(`[StreamingSubtitles v2] BLOCK STATE: wordIdx=${currentWordIndex}, activeBlock=${activeBlockIndex}, activeText="${activeBlockText}", teaching="${teachingBlockText}", shownTeaching=${hasShownTeachingBlock}`);
    }
  }, [currentWordIndex, activeBlockIndex, activeBlockText, teachingBlockText, hasShownTeachingBlock, currentTargetBlocks.length]);
  
  return useMemo(() => ({
    state: {
      sentences,
      currentSentenceIndex,
      currentWordIndex,
      currentTargetWordIndex,
      visibleWordCount,
      isPlaying,
      isWaitingForContent,
      fullText,
      targetFullText,
      currentSentenceText,
      currentSentenceTargetText,
      currentTurnId,
      hasTargetContent,  // SERVER-DRIVEN: Whether current sentence has target content
      visibleTargetText,
      // Block-based rendering for target mode
      currentTargetBlocks,
      activeBlockIndex,
      activeBlockText,
      teachingBlockText,
      hasShownTeachingBlock,
    },
    addSentence,
    setWordTimings,
    addProgressiveWordTiming,
    finalizeWordTimings,
    startPlayback,
    updatePlaybackTime,
    stopPlayback,
    completeSentence,
    reset,
    setCurrentTurnId: setTurnId,
    getCurrentWordTimings,
    getIsWaitingForContent,
  }), [
    sentences,
    currentSentenceIndex,
    currentWordIndex,
    currentTargetWordIndex,
    visibleWordCount,
    isPlaying,
    isWaitingForContent,
    fullText,
    targetFullText,
    currentSentenceText,
    currentSentenceTargetText,
    currentTurnId,
    hasTargetContent,
    visibleTargetText,
    currentTargetBlocks,
    activeBlockIndex,
    activeBlockText,
    teachingBlockText,
    hasShownTeachingBlock,
    addSentence,
    setWordTimings,
    addProgressiveWordTiming,
    finalizeWordTimings,
    startPlayback,
    updatePlaybackTime,
    stopPlayback,
    completeSentence,
    reset,
    setTurnId,
    getCurrentWordTimings,
    getIsWaitingForContent,
  ]);
}
