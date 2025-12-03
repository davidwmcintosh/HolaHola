/**
 * Debug Timing State Store
 * 
 * Provides a way to expose StreamingAudioPlayer's internal timing state
 * to React components for visual debugging when console logs aren't available.
 */

export interface SentenceScheduleEntry {
  sentenceIndex: number;
  startCtxTime: number;
  totalDuration: number;
  endCtxTime?: number;
  started: boolean;
  ended: boolean;
}

export interface DebugTimingState {
  isLoopRunning: boolean;
  currentCtxTime: number;
  activeSentenceIndex: number;
  sentenceSchedule: SentenceScheduleEntry[];
  lastOnSentenceStartFired: number;
  lastOnSentenceEndFired: number;
  loopTickCount: number;
  isPlaying: boolean;
  lastUpdateTime: number;
  // Word timing debug info (per active sentence)
  wordTimingCount: number;
  visibleWordCount: number;
  currentWordIndex: number;
  deltasReceived: number;
  finalWordCount: number;
  // Cumulative totals across all sentences
  totalDeltasReceived: number;
  totalFinalsReceived: number;
  lastDeltaSentence: number;
}

// Global debug state - updated by StreamingAudioPlayer
let debugState: DebugTimingState = {
  isLoopRunning: false,
  currentCtxTime: 0,
  activeSentenceIndex: -1,
  sentenceSchedule: [],
  lastOnSentenceStartFired: -1,
  lastOnSentenceEndFired: -1,
  loopTickCount: 0,
  isPlaying: false,
  lastUpdateTime: 0,
  wordTimingCount: 0,
  visibleWordCount: 0,
  currentWordIndex: -1,
  deltasReceived: 0,
  finalWordCount: 0,
  totalDeltasReceived: 0,
  totalFinalsReceived: 0,
  lastDeltaSentence: -1,
};

// Listeners for React components
type DebugStateListener = (state: DebugTimingState) => void;
const listeners: Set<DebugStateListener> = new Set();

export function updateDebugTimingState(update: Partial<DebugTimingState>): void {
  debugState = {
    ...debugState,
    ...update,
    lastUpdateTime: Date.now(),
  };
  
  // Notify all listeners
  listeners.forEach(listener => listener(debugState));
}

export function getDebugTimingState(): DebugTimingState {
  return debugState;
}

export function subscribeToDebugTimingState(listener: DebugStateListener): () => void {
  listeners.add(listener);
  // Immediately call with current state
  listener(debugState);
  
  // Return unsubscribe function
  return () => {
    listeners.delete(listener);
  };
}

export function resetDebugTimingState(): void {
  debugState = {
    isLoopRunning: false,
    currentCtxTime: 0,
    activeSentenceIndex: -1,
    sentenceSchedule: [],
    lastOnSentenceStartFired: -1,
    lastOnSentenceEndFired: -1,
    loopTickCount: 0,
    isPlaying: false,
    lastUpdateTime: 0,
    wordTimingCount: 0,
    visibleWordCount: 0,
    currentWordIndex: -1,
    deltasReceived: 0,
    finalWordCount: 0,
    totalDeltasReceived: 0,
    totalFinalsReceived: 0,
    lastDeltaSentence: -1,
  };
  listeners.forEach(listener => listener(debugState));
}
