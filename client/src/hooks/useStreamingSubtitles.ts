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
}

/**
 * Return type for the hook
 */
export interface UseStreamingSubtitlesReturn {
  state: StreamingSubtitleState;
  addSentence: (index: number, text: string, turnId: number, hasTargetContent: boolean, targetLanguageText?: string, wordMapping?: [number, number][]) => void;
  setWordTimings: (sentenceIndex: number, turnId: number, timings: WordTiming[], expectedDurationMs?: number) => void;
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
 * Hook for managing streaming subtitles with server-driven state
 */
export function useStreamingSubtitles(): UseStreamingSubtitlesReturn {
  const [sentences, setSentences] = useState<SubtitleSentence[]>([]);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(-1);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [visibleWordCount, setVisibleWordCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTurnId, setCurrentTurnId] = useState(0);
  const [maxTargetWordIndex, setMaxTargetWordIndex] = useState(-1);
  
  // Server-driven: track if current sentence has target content
  const [hasTargetContent, setHasTargetContent] = useState(false);
  
  // Ref + state for waiting flag
  const isWaitingForContentRef = useRef(false);
  const [isWaitingForContent, setIsWaitingForContent] = useState(false);
  
  // Refs for animation and timing
  const currentTimingsRef = useRef<WordTiming[]>([]);
  const currentWordMappingRef = useRef<Map<number, number> | undefined>(undefined);
  const animationFrameRef = useRef<number | null>(null);
  const playbackStartTimeRef = useRef<number>(0);
  const expectedDurationRef = useRef<number | undefined>(undefined);
  const actualDurationRef = useRef<number | undefined>(undefined);
  
  // Timing cache for immediate access during streaming
  const timingsBySentenceRef = useRef<Map<number, { timings: WordTiming[]; expectedDurationMs?: number }>>(new Map());
  
  /**
   * Set the current turn ID (called when 'processing' message arrives)
   * This prepares the hook to accept only packets with this turnId or newer
   * CRITICAL: All refs and state MUST be cleared to prevent stale data from persisting
   */
  const setTurnId = useCallback((turnId: number) => {
    console.log(`[StreamingSubtitles v2] ═══════════════════════════════════════════`);
    console.log(`[StreamingSubtitles v2] NEW TURN: ${turnId} (previous: ${currentTurnId})`);
    console.log(`[StreamingSubtitles v2] Clearing all state and refs...`);
    
    // Clear ALL state for new turn - prevents stale data from persisting
    setCurrentTurnId(turnId);
    setHasTargetContent(false);  // CRITICAL: Force immediate hiding of target subtitles
    setSentences([]);
    setCurrentSentenceIndex(-1);
    setCurrentWordIndex(-1);
    setVisibleWordCount(0);
    setMaxTargetWordIndex(-1);
    setIsPlaying(false);  // Also stop playback to prevent stale timing
    
    // Clear ALL refs to prevent stale data
    timingsBySentenceRef.current.clear();
    currentTimingsRef.current = [];
    currentWordMappingRef.current = undefined;  // Clear word mapping to prevent stale target highlighting
    expectedDurationRef.current = undefined;
    actualDurationRef.current = undefined;
    playbackStartTimeRef.current = 0;
    
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
    
    // Clear waiting flag when first sentence arrives
    isWaitingForContentRef.current = false;
    setIsWaitingForContent(false);
    
    // NOTE: Do NOT update hasTargetContent here!
    // hasTargetContent should only be updated in startPlayback when the sentence ACTUALLY starts playing
    // Setting it here causes race conditions where sentence N+1's hasTarget value is applied
    // while sentence N is still playing, causing phantom subtitles
    
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
   * Start playback for a sentence
   * CRITICAL: All state updates must happen synchronously to prevent race conditions
   */
  const startPlayback = useCallback((sentenceIndex: number, turnId: number) => {
    // STALE PACKET FILTER
    if (turnId < currentTurnId) {
      console.log(`[StreamingSubtitles v2] ⚠ DROPPING stale playback start (turnId ${turnId} < current ${currentTurnId})`);
      return;
    }
    
    console.log(`[StreamingSubtitles v2] ▶ START PLAYBACK sentence ${sentenceIndex} (turn ${turnId})`);
    
    // Get timings from cache
    const storedTimings = timingsBySentenceRef.current.get(sentenceIndex);
    if (storedTimings) {
      currentTimingsRef.current = storedTimings.timings;
      expectedDurationRef.current = storedTimings.expectedDurationMs;
    } else {
      currentTimingsRef.current = [];
      expectedDurationRef.current = undefined;
    }
    
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
        setVisibleWordCount(0);
        setCurrentWordIndex(-1);
        setMaxTargetWordIndex(-1);
      } else {
        console.warn(`[StreamingSubtitles v2] ⚠ Sentence ${sentenceIndex} not found in sentences array!`);
        // Still update sentence index even if sentence not found
        setCurrentSentenceIndex(sentenceIndex);
        setIsPlaying(true);
        setVisibleWordCount(0);
        setCurrentWordIndex(-1);
        setMaxTargetWordIndex(-1);
      }
      return prev;
    });
    
    playbackStartTimeRef.current = Date.now();
    actualDurationRef.current = undefined;
  }, [currentTurnId]);
  
  /**
   * Update playback time (called from high-precision timing loop)
   */
  const updatePlaybackTime = useCallback((currentTime: number, actualDuration?: number) => {
    const timings = currentTimingsRef.current;
    if (timings.length === 0) return;
    
    // Pedagogical timing offset - words appear slightly before audio
    const SUBTITLE_OFFSET = 0.18;
    const adjustedTime = Math.max(0, currentTime - SUBTITLE_OFFSET);
    
    // Store actual duration for rescaling
    const isValidDuration = actualDuration !== undefined && actualDuration > 0 && Number.isFinite(actualDuration);
    const needsUpdate = actualDurationRef.current === undefined || !Number.isFinite(actualDurationRef.current);
    
    if (isValidDuration && needsUpdate) {
      actualDurationRef.current = actualDuration * 1000;
    }
    
    // Calculate rescaling factor
    let scaleFactor = 1;
    const expected = expectedDurationRef.current;
    const actual = actualDurationRef.current;
    
    if (expected && actual && expected > 0 && Number.isFinite(actual)) {
      scaleFactor = actual / expected;
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
    
    setVisibleWordCount(maxVisibleIndex + 1);
    setCurrentWordIndex(wordIndex);
  }, []);
  
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
      console.warn(`[StreamingSubtitles v2]   sentences array:`, sentences.map(s => ({ idx: s.index, target: s.targetLanguageText, hasTarget: s.hasTargetContent })));
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
    },
    addSentence,
    setWordTimings,
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
    addSentence,
    setWordTimings,
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
