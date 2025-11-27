/**
 * Streaming Subtitles Hook
 * 
 * Manages progressive subtitle display for streaming voice mode.
 * Handles sentence-by-sentence text arrival with karaoke-style word highlighting.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { WordTiming } from '../../../shared/streaming-voice-types';

/**
 * Sentence with its word timings
 */
export interface SubtitleSentence {
  index: number;
  text: string;
  wordTimings: WordTiming[];
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
}

/**
 * Return type for the hook
 */
export interface UseStreamingSubtitlesReturn {
  state: StreamingSubtitleState;
  addSentence: (index: number, text: string) => void;
  setWordTimings: (sentenceIndex: number, timings: WordTiming[]) => void;
  startPlayback: (sentenceIndex: number) => void;
  updatePlaybackTime: (currentTime: number) => void;
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
  
  /**
   * Add a new sentence (called when server sends sentence_start)
   */
  const addSentence = useCallback((index: number, text: string) => {
    console.log(`[StreamingSubtitles] Add sentence ${index}: "${text.substring(0, 50)}..."`);
    
    setSentences(prev => {
      // Check if sentence already exists
      const existing = prev.find(s => s.index === index);
      if (existing) {
        return prev;
      }
      
      return [...prev, {
        index,
        text,
        wordTimings: [],
        isComplete: false,
      }];
    });
  }, []);
  
  /**
   * Set word timings for a sentence (called when server sends word_timing)
   */
  const setWordTimings = useCallback((sentenceIndex: number, timings: WordTiming[]) => {
    console.log(`[StreamingSubtitles] Set timings for sentence ${sentenceIndex}: ${timings.length} words`);
    
    setSentences(prev => {
      return prev.map(s => {
        if (s.index === sentenceIndex) {
          return { ...s, wordTimings: timings };
        }
        return s;
      });
    });
    
    // Update current timings if this is the active sentence
    if (sentenceIndex === currentSentenceIndex) {
      currentTimingsRef.current = timings;
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
    
    // Get timings for this sentence
    setSentences(prev => {
      const sentence = prev.find(s => s.index === sentenceIndex);
      if (sentence) {
        currentTimingsRef.current = sentence.wordTimings;
      }
      return prev;
    });
  }, []);
  
  /**
   * Update playback time (called from audio timeupdate event)
   */
  const updatePlaybackTime = useCallback((currentTime: number) => {
    const timings = currentTimingsRef.current;
    if (timings.length === 0) return;
    
    let wordIndex = -1;
    let maxVisibleIndex = -1;
    
    for (let i = 0; i < timings.length; i++) {
      const timing = timings[i];
      
      // Word is visible if we've reached its start time
      if (currentTime >= timing.startTime) {
        maxVisibleIndex = i;
      }
      
      // Word is highlighted if we're within its time range
      if (currentTime >= timing.startTime && currentTime < timing.endTime) {
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
  const fullText = sentences
    .sort((a, b) => a.index - b.index)
    .map(s => s.text)
    .join(' ');
  
  return {
    state: {
      sentences,
      currentSentenceIndex,
      currentWordIndex,
      visibleWordCount,
      isPlaying,
      fullText,
    },
    addSentence,
    setWordTimings,
    startPlayback,
    updatePlaybackTime,
    stopPlayback,
    completeSentence,
    reset,
    getCurrentWordTimings,
  };
}
