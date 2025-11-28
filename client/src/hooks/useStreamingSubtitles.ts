/**
 * Streaming Subtitles Hook
 * 
 * Manages progressive subtitle display for streaming voice mode.
 * Handles sentence-by-sentence text arrival with karaoke-style word highlighting.
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { WordTiming } from '../../../shared/streaming-voice-types';

/**
 * Sentence with its word timings
 */
export interface SubtitleSentence {
  index: number;
  text: string;
  targetLanguageText?: string;  // Target language only (for subtitle filtering)
  wordTimings: WordTiming[];
  expectedDurationMs?: number;  // Expected duration from server (for rescaling)
  actualDurationMs?: number;    // Actual audio duration (for rescaling)
  isComplete: boolean;
}

/**
 * Subtitle display state
 */
export interface StreamingSubtitleState {
  sentences: SubtitleSentence[];
  currentSentenceIndex: number;
  currentWordIndex: number;
  visibleWordCount: number;
  isPlaying: boolean;
  fullText: string;
  targetFullText: string;  // Target language only (for subtitle mode filtering)
  currentSentenceText: string;  // Current sentence text for karaoke display
  currentSentenceTargetText: string;  // Current sentence target text for subtitle mode
}

/**
 * Return type for the hook
 */
export interface UseStreamingSubtitlesReturn {
  state: StreamingSubtitleState;
  addSentence: (index: number, text: string, targetLanguageText?: string) => void;
  setWordTimings: (sentenceIndex: number, timings: WordTiming[], expectedDurationMs?: number) => void;
  startPlayback: (sentenceIndex: number) => void;
  updatePlaybackTime: (currentTime: number, actualDuration?: number) => void;
  stopPlayback: () => void;
  completeSentence: (sentenceIndex: number) => void;
  reset: () => void;
  getCurrentWordTimings: () => WordTiming[];
}

/**
 * Hook for managing streaming subtitles with karaoke highlighting
 */
export function useStreamingSubtitles(): UseStreamingSubtitlesReturn {
  const [sentences, setSentences] = useState<SubtitleSentence[]>([]);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(-1);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [visibleWordCount, setVisibleWordCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Ref for current timings (avoids closure issues in animation frame)
  const currentTimingsRef = useRef<WordTiming[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const playbackStartTimeRef = useRef<number>(0);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const expectedDurationRef = useRef<number | undefined>(undefined);
  const actualDurationRef = useRef<number | undefined>(undefined);
  
  /**
   * Add a new sentence (called when server sends sentence_start)
   */
  const addSentence = useCallback((index: number, text: string, targetLanguageText?: string) => {
    console.log(`[StreamingSubtitles] Add sentence ${index}: "${text.substring(0, 50)}..." (target: ${targetLanguageText?.substring(0, 30) || 'none'})`);
    
    setSentences(prev => {
      // Check if sentence already exists
      const existing = prev.find(s => s.index === index);
      if (existing) {
        return prev;
      }
      
      return [...prev, {
        index,
        text,
        targetLanguageText,
        wordTimings: [],
        isComplete: false,
      }];
    });
  }, []);
  
  /**
   * Set word timings for a sentence (called when server sends word_timing)
   */
  const setWordTimings = useCallback((sentenceIndex: number, timings: WordTiming[], expectedDurationMs?: number) => {
    console.log(`[StreamingSubtitles] Set timings for sentence ${sentenceIndex}: ${timings.length} words, expected ${expectedDurationMs}ms`);
    
    setSentences(prev => {
      return prev.map(s => {
        if (s.index === sentenceIndex) {
          return { 
            ...s, 
            wordTimings: timings,
            expectedDurationMs,
          };
        }
        return s;
      });
    });
    
    // Update current timings if this is the active sentence
    if (sentenceIndex === currentSentenceIndex) {
      currentTimingsRef.current = timings;
      expectedDurationRef.current = expectedDurationMs;
    }
  }, [currentSentenceIndex]);
  
  /**
   * Start playback for a sentence
   */
  const startPlayback = useCallback((sentenceIndex: number) => {
    console.log(`[StreamingSubtitles] Start playback for sentence ${sentenceIndex}`);
    
    setCurrentSentenceIndex(sentenceIndex);
    setIsPlaying(true);
    setVisibleWordCount(0);
    setCurrentWordIndex(-1);
    playbackStartTimeRef.current = Date.now();
    actualDurationRef.current = undefined; // Reset actual duration
    
    // Get timings for this sentence
    setSentences(prev => {
      const sentence = prev.find(s => s.index === sentenceIndex);
      if (sentence) {
        currentTimingsRef.current = sentence.wordTimings;
        expectedDurationRef.current = sentence.expectedDurationMs;
      }
      return prev;
    });
  }, []);
  
  /**
   * Update playback time (called from audio timeupdate event)
   * Supports rescaling when actual audio duration differs from expected
   */
  const updatePlaybackTime = useCallback((currentTime: number, actualDuration?: number) => {
    const timings = currentTimingsRef.current;
    if (timings.length === 0) return;
    
    // Store actual duration for rescaling calculations
    // Only store if it's a valid, finite number (duration can be NaN before metadata loads)
    const isValidDuration = actualDuration !== undefined && actualDuration > 0 && Number.isFinite(actualDuration);
    const needsUpdate = actualDurationRef.current === undefined || !Number.isFinite(actualDurationRef.current);
    
    if (isValidDuration && needsUpdate) {
      actualDurationRef.current = actualDuration * 1000; // Convert to ms
      console.log(`[StreamingSubtitles] Captured actual duration: ${actualDuration.toFixed(2)}s (expected: ${expectedDurationRef.current?.toFixed(0)}ms)`);
    }
    
    // Calculate rescaling factor if we have both expected and actual duration
    let scaleFactor = 1;
    const expected = expectedDurationRef.current;
    const actual = actualDurationRef.current;
    
    if (expected && actual && expected > 0 && Number.isFinite(actual)) {
      scaleFactor = actual / expected;
      // Only apply rescaling if the difference is significant (> 5%)
      if (Math.abs(scaleFactor - 1) >= 0.05) {
        console.log(`[StreamingSubtitles] Rescaling: expected=${expected.toFixed(0)}ms, actual=${actual.toFixed(0)}ms, factor=${scaleFactor.toFixed(3)}`);
      } else {
        scaleFactor = 1;
      }
    }
    
    let wordIndex = -1;
    let maxVisibleIndex = -1;
    
    for (let i = 0; i < timings.length; i++) {
      const timing = timings[i];
      
      // Apply rescaling to timing values
      const scaledStartTime = timing.startTime * scaleFactor;
      const scaledEndTime = timing.endTime * scaleFactor;
      
      // Word is visible if we've reached its start time
      if (currentTime >= scaledStartTime) {
        maxVisibleIndex = i;
      }
      
      // Word is highlighted if we're within its time range
      if (currentTime >= scaledStartTime && currentTime < scaledEndTime) {
        wordIndex = i;
      }
    }
    
    setVisibleWordCount(maxVisibleIndex + 1);
    setCurrentWordIndex(wordIndex);
  }, []);
  
  /**
   * Stop playback
   */
  const stopPlayback = useCallback(() => {
    console.log('[StreamingSubtitles] Stop playback');
    setIsPlaying(false);
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);
  
  /**
   * Mark sentence as complete
   */
  const completeSentence = useCallback((sentenceIndex: number) => {
    setSentences(prev => {
      return prev.map(s => {
        if (s.index === sentenceIndex) {
          return { ...s, isComplete: true };
        }
        return s;
      });
    });
  }, []);
  
  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    console.log('[StreamingSubtitles] Reset');
    setSentences([]);
    setCurrentSentenceIndex(-1);
    setCurrentWordIndex(-1);
    setVisibleWordCount(0);
    setIsPlaying(false);
    currentTimingsRef.current = [];
    expectedDurationRef.current = undefined;
    actualDurationRef.current = undefined;
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);
  
  /**
   * Get current word timings for the playing sentence
   */
  const getCurrentWordTimings = useCallback(() => {
    return currentTimingsRef.current;
  }, []);
  
  // Compute full text from all sentences
  const fullText = useMemo(() => 
    sentences
      .sort((a, b) => a.index - b.index)
      .map(s => s.text)
      .join(' '),
    [sentences]
  );
  
  // Compute target-language-only full text (for subtitle mode filtering)
  const targetFullText = useMemo(() => 
    sentences
      .sort((a, b) => a.index - b.index)
      .map(s => s.targetLanguageText || '')
      .filter(t => t.length > 0)
      .join(' '),
    [sentences]
  );
  
  // Get current sentence text for karaoke display (word index is relative to this)
  const currentSentence = useMemo(() => 
    sentences.find(s => s.index === currentSentenceIndex),
    [sentences, currentSentenceIndex]
  );
  
  const currentSentenceText = currentSentence?.text || '';
  const currentSentenceTargetText = currentSentence?.targetLanguageText || '';
  
  // Memoize the return value to prevent infinite re-render loops
  // when this hook's return value is used as a dependency in other hooks
  return useMemo(() => ({
    state: {
      sentences,
      currentSentenceIndex,
      currentWordIndex,
      visibleWordCount,
      isPlaying,
      fullText,
      targetFullText,
      currentSentenceText,
      currentSentenceTargetText,
    },
    addSentence,
    setWordTimings,
    startPlayback,
    updatePlaybackTime,
    stopPlayback,
    completeSentence,
    reset,
    getCurrentWordTimings,
  }), [
    sentences,
    currentSentenceIndex,
    currentWordIndex,
    visibleWordCount,
    isPlaying,
    fullText,
    targetFullText,
    currentSentenceText,
    currentSentenceTargetText,
    addSentence,
    setWordTimings,
    startPlayback,
    updatePlaybackTime,
    stopPlayback,
    completeSentence,
    reset,
    getCurrentWordTimings,
  ]);
}
