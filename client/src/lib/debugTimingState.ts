/**
 * Debug Timing State Store
 * 
 * Provides a way to expose StreamingAudioPlayer's internal timing state
 * to React components for visual debugging when console logs aren't available.
 * 
 * ENHANCED (Dec 3, 2025): Added word-level tracking, timing drift, and event logging
 * 
 * CRITICAL: State and listeners are stored on window to prevent Vite bundler
 * duplicate module issue. Without this, one module copy updates state while
 * another copy's listeners never receive updates.
 */

// Forward declaration for window storage (defined after DebugTimingState interface)
declare global {
  interface Window {
    __debugTimingState?: DebugTimingState;
    __debugTimingListeners?: Set<(state: DebugTimingState) => void>;
  }
}

export interface SentenceScheduleEntry {
  sentenceIndex: number;
  startCtxTime: number;
  totalDuration: number;
  endCtxTime?: number;
  started: boolean;
  ended: boolean;
}

/**
 * Word schedule entry with absolute AudioContext times
 */
export interface WordScheduleEntry {
  sentenceIndex: number;
  wordIndex: number;
  word: string;
  absoluteStartTime: number;
  absoluteEndTime: number;
}

/**
 * Active word info from word-based matching
 */
export interface ActiveWordInfo {
  sentenceIndex: number;
  wordIndex: number;
  word: string;
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
  audioContextState: 'suspended' | 'running' | 'closed' | 'unknown';  // NEW: AudioContext.state
  audioContextId: string;  // NEW: Debug ID for tracking which context
  activeSentenceIndex: number;
  sentenceSchedule: SentenceScheduleEntry[];
  lastOnSentenceStartFired: number;
  lastOnSentenceEndFired: number;
  loopTickCount: number;
  isPlaying: boolean;
  lastUpdateTime: number;
  
  // Player instance tracking - to verify singleton pattern
  playerInstanceId: string;
  playerInstanceSetCount: number;  // How many times the player ID was set (should be 1)
  
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
  // Changed from string[] to sentence-aware structure to prevent word overwriting across sentences
  receivedWords: Array<{ sentenceIndex: number; wordIndex: number; word: string }>;
  
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
  
  // NEW: Word-based timing system
  wordSchedule: WordScheduleEntry[];          // All registered words with absolute times
  activeWord: ActiveWordInfo | null;          // Currently matched word from findActiveWord()
  wordScheduleSize: number;                   // Number of words in schedule
  lastWordMatchTime: number;                  // Last time a word was successfully matched
  
  // NEW: Timing loop frame logs (first 5 frames for debugging)
  tickFrameLogs: string[];                    // Logs from first 5 frames of timing loop
  loopStartTime: number;                      // When the timing loop started (Date.now())
  
  // NEW: Timing race condition tracking (per-sentence for first few sentences)
  timingRace: {
    // Current/latest sentence
    currentSentence: number;
    firstTimingAt: number;                    // Timestamp when first timing delta arrived
    playbackStartAt: number;                  // Timestamp when startPlayback was called
    timingsAtStart: number;                   // How many timings existed at startPlayback
    timingsArrivedFirst: boolean;             // True if timings arrived before playback started
    
    // History of first 4 sentences for comparison
    history: Array<{
      sentence: number;
      firstTimingAt: number;
      playbackStartAt: number;
      timingsAtStart: number;
      timingsArrivedFirst: boolean;
    }>;
  };
}

// Maximum number of word events to keep in log
const MAX_WORD_EVENTS = 20;

/**
 * Get or create the singleton debug state from window storage.
 * CRITICAL: Prevents Vite duplicate module issue.
 */
function getDebugState(): DebugTimingState {
  if (!window.__debugTimingState) {
    console.log('[DebugTimingState] Creating singleton state on window');
    window.__debugTimingState = {
      isLoopRunning: false,
      currentCtxTime: 0,
      audioContextState: 'unknown',
      audioContextId: '',
      activeSentenceIndex: -1,
      sentenceSchedule: [],
      lastOnSentenceStartFired: -1,
      lastOnSentenceEndFired: -1,
      loopTickCount: 0,
      isPlaying: false,
      lastUpdateTime: 0,
      
      // Player instance tracking
      playerInstanceId: '',
      playerInstanceSetCount: 0,
      
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
      receivedWords: [],  // Now stores { sentenceIndex, wordIndex, word } objects
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
      
      // Word-based timing system
      wordSchedule: [],
      activeWord: null,
      wordScheduleSize: 0,
      lastWordMatchTime: 0,
      
      // Timing loop frame logs
      tickFrameLogs: [],
      loopStartTime: 0,
      
      // Timing race condition tracking
      timingRace: {
        currentSentence: -1,
        firstTimingAt: 0,
        playbackStartAt: 0,
        timingsAtStart: 0,
        timingsArrivedFirst: false,
        history: [],
      },
    };
  }
  return window.__debugTimingState;
}

/**
 * Get or create the singleton listeners set from window storage.
 * CRITICAL: Prevents Vite duplicate module issue.
 */
type DebugStateListener = (state: DebugTimingState) => void;
function getListeners(): Set<DebugStateListener> {
  if (!window.__debugTimingListeners) {
    console.log('[DebugTimingState] Creating singleton listeners on window');
    window.__debugTimingListeners = new Set();
  }
  return window.__debugTimingListeners;
}

export function updateDebugTimingState(update: Partial<DebugTimingState>): void {
  const currentState = getDebugState();
  const newState = {
    ...currentState,
    ...update,
    lastUpdateTime: Date.now(),
  };
  window.__debugTimingState = newState;
  
  // Notify all listeners
  getListeners().forEach(listener => listener(newState));
}

/**
 * Add a word timing event to the log (auto-manages circular buffer)
 */
export function addWordTimingEvent(event: Omit<WordTimingEvent, 'timestamp'>): void {
  const currentState = getDebugState();
  const fullEvent: WordTimingEvent = {
    ...event,
    timestamp: Date.now(),
  };
  
  const newEvents = [...currentState.recentWordEvents, fullEvent];
  
  // Keep only the last MAX_WORD_EVENTS
  if (newEvents.length > MAX_WORD_EVENTS) {
    newEvents.shift();
  }
  
  // Update receivedWords list for word comparison
  // Handle both 'delta' and 'final' events to capture all words
  // Use sentence-aware structure to prevent word overwriting across sentences
  const newReceivedWords = [...currentState.receivedWords];
  
  // Check if this word already exists (same sentence and word index)
  const existingIdx = newReceivedWords.findIndex(
    w => w.sentenceIndex === event.sentenceIndex && w.wordIndex === event.wordIndex
  );
  const wordEntry = { 
    sentenceIndex: event.sentenceIndex, 
    wordIndex: event.wordIndex, 
    word: event.word 
  };
  if (existingIdx >= 0) {
    newReceivedWords[existingIdx] = wordEntry;
  } else {
    newReceivedWords.push(wordEntry);
  }
  
  // Sort by sentence index first, then word index for deterministic ordering
  newReceivedWords.sort((a, b) => {
    if (a.sentenceIndex !== b.sentenceIndex) {
      return a.sentenceIndex - b.sentenceIndex;
    }
    return a.wordIndex - b.wordIndex;
  });
  
  updateDebugTimingState({
    recentWordEvents: newEvents,
    receivedWords: newReceivedWords,
  });
}

/**
 * Register a player instance ID - used to verify singleton pattern
 * Should only be called once per page load, increments count each time
 */
export function registerPlayerInstance(instanceId: string): void {
  const currentState = getDebugState();
  const newCount = currentState.playerInstanceSetCount + 1;
  
  if (newCount > 1) {
    console.error(`[DebugTimingState] ⚠️ MULTIPLE PLAYER INSTANCES! Count=${newCount} New=${instanceId} Old=${currentState.playerInstanceId}`);
  } else {
    console.log(`[DebugTimingState] ✓ Player registered: ${instanceId}`);
  }
  
  updateDebugTimingState({
    playerInstanceId: instanceId,
    playerInstanceSetCount: newCount,
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
    const currentState = getDebugState();
    updateDebugTimingState({
      wordMismatchCount: currentState.wordMismatchCount + 1,
    });
  }
}

export function getDebugTimingState(): DebugTimingState {
  return getDebugState();
}

export function subscribeToDebugTimingState(listener: DebugStateListener): () => void {
  const listeners = getListeners();
  listeners.add(listener);
  // Immediately call with current state
  listener(getDebugState());
  
  // Return unsubscribe function
  return () => {
    getListeners().delete(listener);
  };
}

export function resetDebugTimingState(): void {
  const newState: DebugTimingState = {
    isLoopRunning: false,
    currentCtxTime: 0,
    audioContextState: 'unknown',
    audioContextId: '',
    activeSentenceIndex: -1,
    sentenceSchedule: [],
    lastOnSentenceStartFired: -1,
    lastOnSentenceEndFired: -1,
    loopTickCount: 0,
    isPlaying: false,
    lastUpdateTime: 0,
    playerInstanceId: '',
    playerInstanceSetCount: 0,
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
    
    // Word-based timing system
    wordSchedule: [],
    activeWord: null,
    wordScheduleSize: 0,
    lastWordMatchTime: 0,
    
    // Timing loop frame logs
    tickFrameLogs: [],
    loopStartTime: 0,
    
    // Timing race condition tracking
    timingRace: {
      currentSentence: -1,
      firstTimingAt: 0,
      playbackStartAt: 0,
      timingsAtStart: 0,
      timingsArrivedFirst: false,
      history: [],
    },
  };
  window.__debugTimingState = newState;
  getListeners().forEach(listener => listener(newState));
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
 * Clear receivedWords for a specific sentence (useful when sentence is cleared/reset)
 */
export function clearReceivedWordsForSentence(sentenceIndex: number): void {
  const currentState = getDebugState();
  const filteredWords = currentState.receivedWords.filter(
    w => w.sentenceIndex !== sentenceIndex
  );
  updateDebugTimingState({
    receivedWords: filteredWords,
  });
}

/**
 * Log empty chunk processing
 */
export function logEmptyChunkProcessed(sentenceIndex: number, endCtxTimeSet: boolean): void {
  const currentState = getDebugState();
  const currentEndTimes = [...currentState.sentenceEndTimesSet];
  if (endCtxTimeSet && !currentEndTimes.includes(sentenceIndex)) {
    currentEndTimes.push(sentenceIndex);
  }
  
  updateDebugTimingState({
    emptyChunksProcessed: currentState.emptyChunksProcessed + 1,
    lastEmptyChunkSentence: sentenceIndex,
    sentenceEndTimesSet: currentEndTimes,
  });
}

/**
 * Log a sentence transition event
 */
export function logSentenceTransition(fromSentence: number, toSentence: number, reason: string): void {
  const currentState = getDebugState();
  const transition = `s${fromSentence}→s${toSentence}: ${reason}`;
  const newTransitions = [...currentState.sentenceTransitions, transition];
  
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
  const currentState = getDebugState();
  const newChunksReceived = { ...currentState.audioChunksReceived };
  newChunksReceived[sentenceIndex] = (newChunksReceived[sentenceIndex] || 0) + 1;
  
  updateDebugTimingState({
    audioChunksReceived: newChunksReceived,
    totalAudioChunksReceived: currentState.totalAudioChunksReceived + 1,
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
  const currentState = getDebugState();
  const event: ScheduleEvent = {
    timestamp: Date.now(),
    type,
    sentenceIndex,
    entriesCleared,
    scheduleSizeAfter: sentencesInSchedule.length,
    sentencesInSchedule: [...sentencesInSchedule],
  };
  
  const newEvents = [...currentState.scheduleEvents, event];
  
  // Keep only the last MAX_SCHEDULE_EVENTS
  while (newEvents.length > MAX_SCHEDULE_EVENTS) {
    newEvents.shift();
  }
  
  updateDebugTimingState({
    scheduleEvents: newEvents,
  });
}
