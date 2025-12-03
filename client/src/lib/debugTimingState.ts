/**
 * Debug Timing State Store
 * 
 * Provides a way to expose StreamingAudioPlayer's internal timing state
 * to React components for visual debugging when console logs aren't available.
 * 
 * ENHANCED (Dec 3, 2025): Added word-level tracking, timing drift, and event logging
 */

export interface SentenceScheduleEntry {
  sentenceIndex: number;
  startCtxTime: number;
  totalDuration: number;
  endCtxTime?: number;
  started: boolean;
  ended: boolean;
}

/**
 * Match info for a single sentence - shows WHY it matched or didn't match
 */
export interface SentenceMatchInfo {
  sentenceIndex: number;
  startCtxTime: number;
  endCtxTime: number | undefined;
  isStreaming: boolean;    // endCtxTime === undefined
  computedEndTime: number; // endCtxTime ?? (startCtxTime + totalDuration)
  nowTime: number;         // Current ctx time when evaluated
  matches: boolean;        // Did this sentence match?
  reason: string;          // Human-readable explanation
}

/**
 * Individual word timing event for the debug log
 */
export interface WordTimingEvent {
  timestamp: number;
  sentenceIndex: number;
  wordIndex: number;
  word: string;
  startTime: number;
  endTime: number;
  type: 'delta' | 'final';
}

/**
 * Schedule operation event for tracking schedule modifications
 */
export interface ScheduleEvent {
  timestamp: number;
  type: 'clear' | 'add' | 'remove';
  sentenceIndex?: number;
  entriesCleared?: number;
  scheduleSizeAfter: number;
  sentencesInSchedule: number[];
}

/**
 * Timing comparison for current word
 */
export interface TimingComparison {
  audioCurrentTime: number;      // Current playback time
  expectedWordStartTime: number; // When word should start
  expectedWordEndTime: number;   // When word should end
  drift: number;                 // audioCurrentTime - expectedWordStartTime
  isOnTime: boolean;             // Within 100ms threshold
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
  
  // NEW: Enhanced word-level tracking
  currentWordText: string;           // The currently highlighted word
  expectedWordText: string;          // The word expected from timings at current time
  currentSentenceText: string;       // Full sentence text being played
  currentTargetText: string;         // Target language text (if any)
  
  // NEW: Word list from timings (for comparison display)
  receivedWords: string[];           // All words received via word_timing_delta
  
  // NEW: Timing comparison
  timingComparison: TimingComparison | null;
  
  // NEW: Recent word timing events (circular buffer, max 20)
  recentWordEvents: WordTimingEvent[];
  
  // NEW: Connection status
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'streaming' | 'error';
  
  // NEW: Mismatch detection
  wordMismatchCount: number;         // Count of times highlighted word != expected word
  
  // NEW: Empty chunk and sentence transition tracking
  emptyChunksProcessed: number;      // Count of empty (isLast=true) chunks handled
  lastEmptyChunkSentence: number;    // Last sentence that received empty chunk
  sentenceEndTimesSet: number[];     // Sentences where endCtxTime was successfully set
  sentenceTransitions: string[];     // Log of sentence transitions (max 10)
  
  // NEW: Audio chunk tracking per sentence
  audioChunksReceived: { [sentenceIndex: number]: number };  // Count of audio chunks per sentence
  totalAudioChunksReceived: number;                          // Total audio chunks received
  lastAudioChunkSentence: number;                            // Last sentence that received audio chunk
  
  // NEW: Sentence match info - shows WHY each sentence matched or didn't
  sentenceMatchInfo: SentenceMatchInfo[];
  
  // NEW: Schedule events log - tracks clear/add/remove operations
  scheduleEvents: ScheduleEvent[];
}

// Maximum number of word events to keep in log
const MAX_WORD_EVENTS = 20;

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
  
  // Enhanced fields
  currentWordText: '',
  expectedWordText: '',
  currentSentenceText: '',
  currentTargetText: '',
  receivedWords: [],
  timingComparison: null,
  recentWordEvents: [],
  connectionStatus: 'disconnected',
  wordMismatchCount: 0,
  
  // Empty chunk and sentence transition tracking
  emptyChunksProcessed: 0,
  lastEmptyChunkSentence: -1,
  sentenceEndTimesSet: [],
  sentenceTransitions: [],
  
  // Audio chunk tracking per sentence
  audioChunksReceived: {},
  totalAudioChunksReceived: 0,
  lastAudioChunkSentence: -1,
  
  // Sentence match info
  sentenceMatchInfo: [],
  
  // Schedule events
  scheduleEvents: [],
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

/**
 * Add a word timing event to the log (auto-manages circular buffer)
 */
export function addWordTimingEvent(event: Omit<WordTimingEvent, 'timestamp'>): void {
  const fullEvent: WordTimingEvent = {
    ...event,
    timestamp: Date.now(),
  };
  
  const newEvents = [...debugState.recentWordEvents, fullEvent];
  
  // Keep only the last MAX_WORD_EVENTS
  if (newEvents.length > MAX_WORD_EVENTS) {
    newEvents.shift();
  }
  
  // Also update receivedWords list for word comparison
  const newReceivedWords = [...debugState.receivedWords];
  if (event.type === 'delta') {
    // Ensure array is large enough
    while (newReceivedWords.length <= event.wordIndex) {
      newReceivedWords.push('');
    }
    newReceivedWords[event.wordIndex] = event.word;
  }
  
  updateDebugTimingState({
    recentWordEvents: newEvents,
    receivedWords: newReceivedWords,
  });
}

/**
 * Update timing comparison for drift detection
 */
export function updateTimingComparison(
  audioCurrentTime: number,
  expectedWordStartTime: number,
  expectedWordEndTime: number
): void {
  const drift = audioCurrentTime - expectedWordStartTime;
  const isOnTime = Math.abs(drift) < 0.1; // Within 100ms
  
  updateDebugTimingState({
    timingComparison: {
      audioCurrentTime,
      expectedWordStartTime,
      expectedWordEndTime,
      drift,
      isOnTime,
    },
  });
}

/**
 * Check for word mismatch and increment counter if needed
 */
export function checkWordMismatch(highlightedWord: string, expectedWord: string): void {
  if (highlightedWord && expectedWord && highlightedWord !== expectedWord) {
    updateDebugTimingState({
      wordMismatchCount: debugState.wordMismatchCount + 1,
    });
  }
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
    
    // Enhanced fields
    currentWordText: '',
    expectedWordText: '',
    currentSentenceText: '',
    currentTargetText: '',
    receivedWords: [],
    timingComparison: null,
    recentWordEvents: [],
    connectionStatus: 'disconnected',
    wordMismatchCount: 0,
    
    // Empty chunk and sentence transition tracking
    emptyChunksProcessed: 0,
    lastEmptyChunkSentence: -1,
    sentenceEndTimesSet: [],
    sentenceTransitions: [],
    
    // Audio chunk tracking per sentence
    audioChunksReceived: {},
    totalAudioChunksReceived: 0,
    lastAudioChunkSentence: -1,
    
    // Schedule events
    scheduleEvents: [],
  };
  listeners.forEach(listener => listener(debugState));
}

/**
 * Clear just the word-related state (useful between sentences)
 */
export function clearWordState(): void {
  updateDebugTimingState({
    currentWordText: '',
    expectedWordText: '',
    receivedWords: [],
    timingComparison: null,
    deltasReceived: 0,
    finalWordCount: 0,
  });
}

/**
 * Log empty chunk processing
 */
export function logEmptyChunkProcessed(sentenceIndex: number, endCtxTimeSet: boolean): void {
  const currentEndTimes = [...debugState.sentenceEndTimesSet];
  if (endCtxTimeSet && !currentEndTimes.includes(sentenceIndex)) {
    currentEndTimes.push(sentenceIndex);
  }
  
  updateDebugTimingState({
    emptyChunksProcessed: debugState.emptyChunksProcessed + 1,
    lastEmptyChunkSentence: sentenceIndex,
    sentenceEndTimesSet: currentEndTimes,
  });
}

/**
 * Log a sentence transition event
 */
export function logSentenceTransition(fromSentence: number, toSentence: number, reason: string): void {
  const transition = `s${fromSentence}→s${toSentence}: ${reason}`;
  const newTransitions = [...debugState.sentenceTransitions, transition];
  
  // Keep only the last 10 transitions
  if (newTransitions.length > 10) {
    newTransitions.shift();
  }
  
  updateDebugTimingState({
    sentenceTransitions: newTransitions,
  });
}

/**
 * Log an audio chunk received from useStreamingVoice hook
 */
export function logAudioChunkReceived(sentenceIndex: number): void {
  const newChunksReceived = { ...debugState.audioChunksReceived };
  newChunksReceived[sentenceIndex] = (newChunksReceived[sentenceIndex] || 0) + 1;
  
  updateDebugTimingState({
    audioChunksReceived: newChunksReceived,
    totalAudioChunksReceived: debugState.totalAudioChunksReceived + 1,
    lastAudioChunkSentence: sentenceIndex,
  });
}

// Maximum number of schedule events to keep
const MAX_SCHEDULE_EVENTS = 15;

/**
 * Log a schedule operation (clear, add, or remove)
 */
export function logScheduleEvent(
  type: 'clear' | 'add' | 'remove',
  sentencesInSchedule: number[],
  sentenceIndex?: number,
  entriesCleared?: number
): void {
  const event: ScheduleEvent = {
    timestamp: Date.now(),
    type,
    sentenceIndex,
    entriesCleared,
    scheduleSizeAfter: sentencesInSchedule.length,
    sentencesInSchedule: [...sentencesInSchedule],
  };
  
  const newEvents = [...debugState.scheduleEvents, event];
  
  // Keep only the last MAX_SCHEDULE_EVENTS
  while (newEvents.length > MAX_SCHEDULE_EVENTS) {
    newEvents.shift();
  }
  
  updateDebugTimingState({
    scheduleEvents: newEvents,
  });
}
