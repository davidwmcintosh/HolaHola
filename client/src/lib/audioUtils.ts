import { resetDebugTimingState, logEmptyChunkProcessed, logSentenceTransition, logScheduleEvent, updateDebugTimingState, getDebugTimingState, registerPlayerInstance, type SentenceScheduleEntry, type SentenceMatchInfo } from './debugTimingState';

/**
 * WORD TIMING DIAGNOSTICS FEATURE FLAG
 * 
 * When disabled (false): The 60fps timing loop only performs minimal AudioContext health checks.
 * When enabled (true): Full word-level timing, sentence matching, and debug logging runs every frame.
 * 
 * DISABLED FUNCTIONALITY (when false):
 * - Per-frame word schedule scanning (findActiveWord)
 * - Per-frame sentence schedule matching and logging
 * - Debug state updates for timing visualization
 * - Word match logging and callbacks
 * - Sentence transition logging
 * - Frame-by-frame debug console output
 * 
 * PRESERVED FUNCTIONALITY (always runs):
 * - AudioContext suspend detection and auto-resume
 * - Basic isPlaying state management
 * - Sentence start/end callbacks (for audio scheduling only)
 * - The loop itself (so it can be re-enabled without restart)
 * 
 * TO RE-ENABLE: Set this to true, or use DevTools: window.__enableWordTimingDiagnostics = true
 * 
 * FUTURE USE CASES:
 * - Whiteboard PLAY tool with word-level highlighting
 * - Karaoke-style subtitle display
 * - Word-precise visual cues during tutor speech
 */
const ENABLE_WORD_TIMING_DIAGNOSTICS = false;

// Allow runtime override via DevTools console
declare global {
  interface Window {
    __enableWordTimingDiagnostics?: boolean;
  }
}

function isWordTimingEnabled(): boolean {
  return window.__enableWordTimingDiagnostics ?? ENABLE_WORD_TIMING_DIAGNOSTICS;
}

/**
 * CRITICAL: Store StreamingAudioPlayer singleton on window to prevent Vite bundler
 * duplicate module issue. Without this, Vite may create multiple module copies,
 * each with its own instance - one receives audio chunks while another runs the
 * timing loop, causing subtitle synchronization to fail.
 * 
 * Pattern: Same as documented for StreamingVoiceClient in replit.md
 */
declare global {
  interface Window {
    __streamingAudioPlayer?: StreamingAudioPlayer;
  }
}

/**
 * Get or create the singleton StreamingAudioPlayer instance.
 * MUST be used instead of `new StreamingAudioPlayer()` to prevent duplicate instances.
 */
export function getStreamingAudioPlayer(): StreamingAudioPlayer {
  if (!window.__streamingAudioPlayer) {
    const instanceId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    console.log(`[StreamingAudioPlayer] Creating singleton on window.__streamingAudioPlayer (id=${instanceId})`);
    window.__streamingAudioPlayer = new StreamingAudioPlayer();
    
    // Register instance for debug panel visibility
    registerPlayerInstance(instanceId);
  } else {
    console.log('[StreamingAudioPlayer] Reusing existing singleton from window');
  }
  return window.__streamingAudioPlayer;
}

/**
 * Helper to immediately update debug state with current schedule
 * Called when schedule entries are added/modified
 */
function updateDebugSchedule(sentenceSchedule: Map<number, {
  startCtxTime: number;
  totalDuration: number;
  endCtxTime?: number;
  started: boolean;
  ended: boolean;
}>) {
  const scheduleArray: SentenceScheduleEntry[] = Array.from(sentenceSchedule.entries()).map(([idx, e]) => ({
    sentenceIndex: idx,
    startCtxTime: e.startCtxTime,
    totalDuration: e.totalDuration,
    endCtxTime: e.endCtxTime,
    started: e.started,
    ended: e.ended
  }));
  
  updateDebugTimingState({ sentenceSchedule: scheduleArray });
}

// Convert Int16Array PCM to base64 string
export function pcm16ToBase64(pcm16: Int16Array): string {
  const uint8Array = new Uint8Array(pcm16.buffer);
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;

  async startRecording(onDataAvailable: (audioData: ArrayBuffer) => void): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 24000,
        } 
      });

      this.audioContext = new AudioContext({ sampleRate: 24000 });
      const source = this.audioContext.createMediaStreamSource(this.stream);
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      source.connect(processor);
      processor.connect(this.audioContext.destination);

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32Array to Int16Array (PCM16)
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        onDataAvailable(pcm16.buffer);
      };
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }

  stopRecording(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export class AudioPlayer {
  private audioContext: AudioContext;
  private gainNode: GainNode;
  private queue: AudioBuffer[] = [];
  private isPlaying = false;

  constructor() {
    this.audioContext = new AudioContext({ sampleRate: 24000 });
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);
    console.log('[AUDIO PLAYER] AudioPlayer created, initial state:', this.audioContext.state);
  }

  // Public method to resume AudioContext (called on user interaction)
  async resume(): Promise<void> {
    if (this.audioContext.state === 'suspended') {
      console.log('[AUDIO PLAYER] Resuming AudioContext from suspended state...');
      await this.audioContext.resume();
      console.log('[AUDIO PLAYER] ✓ AudioContext resumed! State:', this.audioContext.state);
    } else {
      console.log('[AUDIO PLAYER] AudioContext already running, state:', this.audioContext.state);
    }
  }

  async playAudio(base64Audio: string): Promise<void> {
    try {
      console.log('[AUDIO PLAYER] playAudio called, AudioContext state:', this.audioContext.state);
      
      // CRITICAL: Resume AudioContext if suspended (browser autoplay policy)
      if (this.audioContext.state === 'suspended') {
        console.log('[AUDIO PLAYER] AudioContext is SUSPENDED - attempting to resume...');
        await this.audioContext.resume();
        console.log('[AUDIO PLAYER] AudioContext resumed! New state:', this.audioContext.state);
      } else {
        console.log('[AUDIO PLAYER] AudioContext is already running:', this.audioContext.state);
      }
      
      const audioData = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));
      const pcm16 = new Int16Array(audioData.buffer);
      
      // Convert PCM16 to Float32
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7fff);
      }

      const audioBuffer = this.audioContext.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      this.queue.push(audioBuffer);
      console.log('[AUDIO PLAYER] Audio chunk added to queue. Queue size:', this.queue.length);
      
      if (!this.isPlaying) {
        console.log('[AUDIO PLAYER] Starting playback...');
        this.playNext();
      }
    } catch (error) {
      console.error('[AUDIO PLAYER] Error playing audio:', error);
    }
  }

  private playNext(): void {
    if (this.queue.length === 0) {
      console.log('[AUDIO PLAYER] Queue empty, stopping playback');
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const buffer = this.queue.shift()!;
    console.log('[AUDIO PLAYER] Playing chunk, queue remaining:', this.queue.length);
    
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gainNode);
    
    source.onended = () => {
      console.log('[AUDIO PLAYER] Chunk finished, playing next...');
      this.playNext();
    };

    try {
      source.start();
      console.log('[AUDIO PLAYER] source.start() called successfully');
    } catch (error) {
      console.error('[AUDIO PLAYER] Error calling source.start():', error);
      // Try to recover by moving to next chunk
      this.playNext();
    }
  }

  stop(): void {
    this.queue = [];
    this.isPlaying = false;
  }
}

/**
 * Streaming Audio Player
 * 
 * Optimized for progressive playback of streaming audio chunks.
 * Supports:
 * - MP3 playback via HTMLAudioElement (better browser support)
 * - Raw PCM playback via Web Audio API (lower latency, native timestamps)
 */
export interface StreamingAudioChunk {
  sentenceIndex: number;
  audio: ArrayBuffer;
  durationMs: number;
  isLast: boolean;
  audioFormat?: 'mp3' | 'pcm_f32le';  // Audio format (default: 'mp3')
  sampleRate?: number;  // Sample rate for PCM (default: 24000)
}

export type StreamingPlaybackState = 'idle' | 'buffering' | 'playing' | 'paused';

export interface StreamingPlaybackCallbacks {
  onStateChange?: (state: StreamingPlaybackState) => void;
  onProgress?: (currentTime: number, duration: number) => void;
  onSentenceStart?: (sentenceIndex: number) => void;
  onSentenceEnd?: (sentenceIndex: number) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
  onPendingAudioChange?: (count: number) => void;
}

export class StreamingAudioPlayer {
  private queue: StreamingAudioChunk[] = [];
  private currentAudio: HTMLAudioElement | null = null;
  private currentSentenceIndex = -1;
  private state: StreamingPlaybackState = 'idle';
  private callbacks: StreamingPlaybackCallbacks = {};
  private objectUrls: string[] = [];
  private isPlaying = false;
  private pendingAudioCount = 0;
  
  // Store all audio chunks for replay functionality
  private allAudioChunks: ArrayBuffer[] = [];
  private combinedAudioBlob: Blob | null = null;
  
  // High-precision timing using performance.now()
  private playbackStartTime: number | null = null;
  private rafId: number | null = null;
  private currentDuration = 0;
  
  // Web Audio API for raw PCM playback
  private audioContext: AudioContext | null = null;
  private currentPcmSource: AudioBufferSourceNode | null = null;
  private currentAudioFormat: 'mp3' | 'pcm_f32le' = 'mp3';
  
  // PROGRESSIVE STREAMING: Accumulator for progressive PCM chunks
  private progressiveSentenceIndex = -1;
  private progressiveChunks: Float32Array[] = [];
  private progressiveScheduledTime = 0; // Next scheduled play time in AudioContext
  private progressiveSources: AudioBufferSourceNode[] = []; // Track active sources for cleanup
  private progressiveFirstChunkStarted = false;
  private progressivePlaybackStartCtxTime = 0; // AudioContext.currentTime when first chunk started
  private progressiveTotalDuration = 0; // Total accumulated duration of all chunks
  
  // SENTENCE SCHEDULE: Track all sentences with their scheduled times
  // This allows a unified timing loop to determine which sentence is active
  private sentenceSchedule: Map<number, {
    startCtxTime: number;      // AudioContext time when this sentence starts
    totalDuration: number;     // Accumulated duration of all chunks
    endCtxTime?: number;       // Computed end time (set when last chunk arrives)
    started: boolean;          // Whether onSentenceStart has been fired
    ended: boolean;            // Whether onSentenceEnd has been fired
  }> = new Map();
  
  // WORD SCHEDULE: Track all words with ABSOLUTE AudioContext times
  // This enables direct word matching without needing sentence duration calculations
  private wordSchedule: Map<string, {
    sentenceIndex: number;
    wordIndex: number;
    word: string;
    absoluteStartTime: number;  // AudioContext time when word starts
    absoluteEndTime: number;    // AudioContext time when word ends
  }> = new Map();  // Key: "s{sentenceIndex}_w{wordIndex}"
  
  // Track which sentence the timing loop is currently reporting on
  private activeSentenceInLoop = -1;
  
  // Counter for word matches (for throttled logging)
  private wordMatchCount = 0;
  
  // TURN COMPLETION: Expected sentence count from response_complete message
  // Prevents premature loop termination when not all sentences have arrived yet
  private expectedSentenceCount: number | null = null;
  
  constructor() {
    console.log('[StreamingAudioPlayer] Initialized');
  }
  
  /**
   * Set expected sentence count from response_complete message
   * This signals that no more sentences will arrive for this turn.
   * The timing loop will only stop when all expected sentences have ended.
   */
  setExpectedSentenceCount(count: number): void {
    console.log(`[StreamingAudioPlayer] ⚙️ Expected sentence count set to ${count}`);
    this.expectedSentenceCount = count;
    
    // Update debug panel
    updateDebugTimingState({
      expectedSentenceCount: count,
      sentencesReceived: this.sentenceSchedule.size,
    });
  }
  
  /**
   * Get or create AudioContext for PCM playback
   * Lazy initialization to comply with autoplay policies
   */
  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: 24000 });
      // Assign unique ID for debugging
      (this.audioContext as any).__debugId = `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      console.log(`[StreamingAudioPlayer] Web Audio API initialized, state: ${this.audioContext.state}, ID: ${(this.audioContext as any).__debugId}`);
    }
    return this.audioContext;
  }
  
  /**
   * Resume AudioContext if suspended (required for autoplay policy)
   */
  async resumeAudioContext(): Promise<void> {
    const ctx = this.getAudioContext();
    if (ctx.state === 'suspended') {
      console.log('[StreamingAudioPlayer] Resuming AudioContext...');
      await ctx.resume();
      console.log('[StreamingAudioPlayer] AudioContext resumed, state:', ctx.state);
    }
  }
  
  /**
   * Get the combined audio blob for replay
   * Returns null if no audio has been played yet
   */
  getCombinedAudioBlob(): Blob | null {
    if (this.combinedAudioBlob) {
      return this.combinedAudioBlob;
    }
    
    // Combine all chunks into a single blob if not already done
    if (this.allAudioChunks.length > 0) {
      this.combinedAudioBlob = new Blob(this.allAudioChunks, { type: 'audio/mpeg' });
      console.log(`[StreamingAudioPlayer] Combined ${this.allAudioChunks.length} chunks into ${this.combinedAudioBlob.size} bytes`);
      return this.combinedAudioBlob;
    }
    
    return null;
  }
  
  /**
   * Clear stored audio chunks (call when starting a new response)
   */
  clearStoredAudio(): void {
    this.allAudioChunks = [];
    this.combinedAudioBlob = null;
    console.log('[StreamingAudioPlayer] Cleared stored audio');
  }
  
  /**
   * Reset player state for a new turn (response)
   * CRITICAL: Must be called when a new 'processing' message arrives
   * This clears the sentence/word schedule from the previous turn,
   * preventing stale callbacks from firing on the new turn's audio.
   */
  resetForNewTurn(): void {
    console.error(`[StreamingAudioPlayer] ⚠️ RESET FOR NEW TURN - clearing ${this.sentenceSchedule.size} sentences, ${this.wordSchedule.size} words, ${this.pendingWordTimings.size} pending`);
    
    // Clear progressive playback state
    this.progressiveFirstChunkStarted = false;
    this.sentenceSchedule.clear();
    this.wordSchedule.clear();
    this.pendingWordTimings.clear();  // CRITICAL: Also clear pending word timings
    this.activeSentenceInLoop = -1;
    this.progressiveSentenceIndex = -1;
    this.progressiveChunks = [];
    this.progressiveTotalDuration = 0;
    
    // CRITICAL: Reset expected sentence count - will be set when response_complete arrives
    this.expectedSentenceCount = null;
    
    // Reset debug panel sentence tracking
    updateDebugTimingState({
      expectedSentenceCount: null,
      sentencesReceived: 0,
      sentencesEnded: 0,
      sentencesStarted: 0,
      allSentencesEnded: false,
    });
    
    // Reset timing anchors
    const ctx = this.audioContext;
    if (ctx) {
      this.progressiveScheduledTime = ctx.currentTime + 0.1;
      this.progressivePlaybackStartCtxTime = 0;
    }
    
    // Clear stored audio for replay
    this.allAudioChunks = [];
    this.combinedAudioBlob = null;
    
    // Log to debug panel
    logScheduleEvent('clear', [], undefined, 0);
    
    console.log('[StreamingAudioPlayer] Reset complete - ready for new turn');
  }
  
  /**
   * Get the number of pending audio chunks (queued + currently playing)
   */
  getPendingAudioCount(): number {
    return this.pendingAudioCount;
  }
  
  private updatePendingCount(count: number): void {
    this.pendingAudioCount = count;
    console.log(`[StreamingAudioPlayer] Pending audio count: ${count}`);
    this.callbacks.onPendingAudioChange?.(count);
  }
  
  /**
   * Set playback callbacks
   */
  setCallbacks(callbacks: StreamingPlaybackCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }
  
  /**
   * Get current playback state
   */
  getState(): StreamingPlaybackState {
    return this.state;
  }
  
  /**
   * Enqueue an audio chunk for playback
   * Will start playing immediately if not already playing
   */
  enqueue(chunk: StreamingAudioChunk): void {
    console.log(`[StreamingAudioPlayer] ▶ ENQUEUE sentence ${chunk.sentenceIndex}: ${chunk.audio.byteLength} bytes, isLast=${chunk.isLast}, duration=${chunk.durationMs}ms`);
    console.log(`[StreamingAudioPlayer]   Queue before: ${this.queue.length} chunks, isPlaying=${this.isPlaying}`);
    
    // Store chunk for replay functionality
    this.allAudioChunks.push(chunk.audio);
    // Invalidate combined blob so it will be regenerated on next getCombinedAudioBlob()
    this.combinedAudioBlob = null;
    
    this.queue.push(chunk);
    this.updatePendingCount(this.pendingAudioCount + 1);
    
    console.log(`[StreamingAudioPlayer]   Queue after: ${this.queue.length} chunks, pending=${this.pendingAudioCount}`);
    
    // Start playback if not already playing
    if (!this.isPlaying) {
      console.log(`[StreamingAudioPlayer]   Starting playback (was idle)`);
      this.playNext();
    } else {
      console.log(`[StreamingAudioPlayer]   Already playing, chunk queued`);
    }
  }
  
  /**
   * PROGRESSIVE STREAMING: Enqueue a progressive PCM chunk for immediate playback
   * 
   * Unlike enqueue() which buffers entire sentences, this method schedules
   * PCM chunks for gapless playback as they arrive from the server.
   * 
   * Benefits:
   * - Audio starts playing as soon as first chunk arrives (~200ms after TTS start)
   * - No waiting for full sentence synthesis
   * 
   * @param sentenceIndex - Which sentence this chunk belongs to
   * @param chunkIndex - Index of this chunk within the sentence
   * @param audio - Raw PCM audio data (f32le, 24kHz mono)
   * @param durationMs - Duration of this chunk in milliseconds
   * @param isLast - Whether this is the final chunk for the sentence
   * @param sampleRate - Audio sample rate (default: 24000)
   */
  async enqueueProgressivePcmChunk(
    sentenceIndex: number,
    chunkIndex: number,
    audio: ArrayBuffer,
    durationMs: number,
    isLast: boolean,
    sampleRate: number = 24000
  ): Promise<void> {
    // CRITICAL DEBUG: Log EVERY chunk that arrives
    console.error(`[ENQUEUE] s=${sentenceIndex} c=${chunkIndex} bytes=${audio.byteLength} isLast=${isLast} scheduleSize=${this.sentenceSchedule.size}`);
    
    // CRITICAL FIX: Handle empty audio chunks (isLast=true marker chunks)
    // These chunks have 0 audio data but signal sentence completion
    // We MUST process the isLast flag even if there's no audio to schedule
    if (audio.byteLength === 0) {
      console.error(`[AUDIO PLAYER] *** EMPTY CHUNK *** s=${sentenceIndex} c=${chunkIndex} isLast=${isLast}`);
      if (isLast) {
        // Set the endCtxTime in the sentence schedule
        const entry = this.sentenceSchedule.get(sentenceIndex);
        let endCtxTimeSet = false;
        if (entry) {
          entry.endCtxTime = entry.startCtxTime + entry.totalDuration;
          endCtxTimeSet = true;
          console.log(`[AUDIO SCHEDULE] ✓ Sentence ${sentenceIndex} endCtxTime set via EARLY PATH: ${entry.endCtxTime.toFixed(3)} (duration=${entry.totalDuration.toFixed(3)}s)`);
          
          // CRITICAL DEBUG: Verify the entry was actually updated in the Map
          const verifyEntry = this.sentenceSchedule.get(sentenceIndex);
          if (verifyEntry?.endCtxTime === undefined) {
            console.error(`[BUG!] endCtxTime set but Map entry still shows undefined! entry===verifyEntry: ${entry === verifyEntry}`);
          } else {
            console.log(`[VERIFY] Map entry S${sentenceIndex} endCtxTime confirmed: ${verifyEntry.endCtxTime.toFixed(3)}`);
          }
        } else {
          console.error(`[AUDIO SCHEDULE] ✗ No schedule entry for sentence ${sentenceIndex} when isLast received!`);
        }
        
        // Update debug panel with empty chunk info
        logEmptyChunkProcessed(sentenceIndex, endCtxTimeSet);
        
        // Also call the existing finalize method
        this.finalizeProgressiveSentence(sentenceIndex);
      }
      return;
    }
    
    const ctx = this.getAudioContext();
    
    // CRITICAL DEBUG: Log EVERY non-empty chunk that passes the empty check
    console.error(`[NON-EMPTY CHUNK] s=${sentenceIndex} c=${chunkIndex} bytes=${audio.byteLength} isLast=${isLast} - WILL ADD TO SCHEDULE`);
    
    // CRITICAL: Log AudioContext state for every chunk
    console.log(`[AUDIO STATE] Chunk ${sentenceIndex}:${chunkIndex} - ctx.state=${ctx.state}, ctx.currentTime=${ctx.currentTime?.toFixed(3)}`);
    
    // Resume AudioContext if suspended
    if (ctx.state === 'suspended') {
      console.log('[AUDIO STATE] !!! AudioContext SUSPENDED - Resuming...');
      await ctx.resume();
      console.log(`[AUDIO STATE] After resume: ctx.state=${ctx.state}`);
    }
    
    // Detect new sentence - DON'T stop current audio, let it finish naturally!
    // BUG FIX: Also detect new TURN by checking if sentenceIndex === 0
    // This handles the case where previous turn ended at sentence 0 (single-sentence response)
    // In that case, sentenceIndex === progressiveSentenceIndex but it's a NEW turn
    const isNewSentence = sentenceIndex !== this.progressiveSentenceIndex;
    
    // CRITICAL FIX (Dec 3, 2025): Only treat sentence 0, chunk 0 as a new turn if:
    // 1. We haven't started playing yet (progressiveFirstChunkStarted === false), OR
    // 2. We're on a DIFFERENT sentence than the current one
    // This prevents schedule wipe when Cartesia resends chunkIndex 0 due to retry/glitch
    // Previously: just checking s===0 && c===0 would wipe schedule mid-sentence
    const isNewTurnStarting = sentenceIndex === 0 && chunkIndex === 0 && !this.progressiveFirstChunkStarted;
    
    // Capture isPlaying state BEFORE modifying it
    // This is needed for the restart loop logic below
    const wasPlayingBeforeThisChunk = this.isPlaying;
    
    if (isNewSentence || isNewTurnStarting) {
      // Clear arrays for new sentence (old sources will continue playing)
      this.progressiveChunks = [];
      
      // For new turn, clear the sentence schedule and reset timing
      if (isNewTurnStarting) {
        this.progressiveFirstChunkStarted = false;
        this.sentenceSchedule.clear();
        this.wordSchedule.clear();
        this.activeSentenceInLoop = -1;
        // Reset scheduled time with larger prebuffer for smoother playback
        this.progressiveScheduledTime = ctx.currentTime + 0.2;
        this.progressivePlaybackStartCtxTime = 0;
      }
      
      this.progressiveSentenceIndex = sentenceIndex;
      this.currentSentenceIndex = sentenceIndex;
      
      // Schedule new sentence after current audio ends (gapless playback)
      // If no audio scheduled yet, start from now + prebuffer
      if (this.progressiveScheduledTime <= ctx.currentTime) {
        this.progressiveScheduledTime = ctx.currentTime + 0.2;
      }
      
      this.progressiveTotalDuration = 0;
      this.isPlaying = true;
      this.setState('buffering');
    }
    
    // SAFETY: Ensure scheduled time is always in the future
    // If we've fallen behind, reset to current time + prebuffer
    if (this.progressiveScheduledTime < ctx.currentTime) {
      this.progressiveScheduledTime = ctx.currentTime + 0.2;
    }
    
    // Convert raw PCM bytes to Float32Array
    const float32Data = new Float32Array(audio);
    const numSamples = float32Data.length;
    const chunkDuration = numSamples / sampleRate;
    
    // Handle empty audio chunks (isLast=true marker chunks)
    // These chunks have 0 audio data but signal sentence completion
    if (numSamples === 0) {
      if (isLast) {
        const entry = this.sentenceSchedule.get(sentenceIndex);
        if (entry) {
          entry.endCtxTime = entry.startCtxTime + entry.totalDuration;
        }
        this.scheduleProgressiveSentenceEnd(sentenceIndex, 0);
      }
      return; // Skip audio scheduling for empty chunks
    }
    
    // Store for potential replay
    this.progressiveChunks.push(float32Data);
    this.allAudioChunks.push(audio);
    this.combinedAudioBlob = null;
    
    // Create AudioBuffer
    const audioBuffer = ctx.createBuffer(1, numSamples, sampleRate);
    audioBuffer.getChannelData(0).set(float32Data);
    
    // Create and schedule buffer source
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    this.progressiveSources.push(source);
    
    // Schedule at next available time for gapless playback
    const playTime = this.progressiveScheduledTime;
    source.start(playTime);
    this.progressiveScheduledTime += chunkDuration;
    this.progressiveTotalDuration += chunkDuration;
    
    // Auto-resume if AudioContext becomes suspended (check only, no logging)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    
    // Register sentence in schedule if this is its first chunk
    if (!this.sentenceSchedule.has(sentenceIndex)) {
      this.sentenceSchedule.set(sentenceIndex, {
        startCtxTime: playTime,
        totalDuration: 0,
        started: false,
        ended: false,
      });
      
      // Process any queued word timings for this sentence
      this.processPendingWordTimings(sentenceIndex);
    }
    
    // Accumulate duration for this sentence
    const scheduleEntry = this.sentenceSchedule.get(sentenceIndex)!;
    scheduleEntry.totalDuration += chunkDuration;
    
    // Start or restart the timing loop when needed
    // - For first chunk of first sentence of a turn: always start
    // - For first chunk of any sentence after loop was stopped: restart
    // CRITICAL: Use wasPlayingBeforeThisChunk, NOT this.isPlaying
    // because isPlaying gets set to true earlier in this function for new sentences
    const shouldStartLoop = !this.progressiveFirstChunkStarted && chunkIndex === 0 && sentenceIndex === 0;
    const shouldRestartLoop = !wasPlayingBeforeThisChunk && chunkIndex === 0;
    
    if (shouldStartLoop || shouldRestartLoop) {
      this.progressiveFirstChunkStarted = true;
      this.playbackStartTime = performance.now();
      this.isPlaying = true;
      this.setState('playing');
      this.startUnifiedTimingLoop();
    }
    
    // Track progressive state for sentence 0
    if (sentenceIndex === 0 && !this.progressivePlaybackStartCtxTime) {
      this.progressivePlaybackStartCtxTime = playTime;
    }
    
    // Update current duration for progress reporting
    this.currentDuration = this.progressiveTotalDuration;
    
    // Handle last chunk - set end time in schedule
    if (isLast) {
      const entry = this.sentenceSchedule.get(sentenceIndex);
      if (entry) {
        entry.endCtxTime = entry.startCtxTime + entry.totalDuration;
      }
      this.scheduleProgressiveSentenceEnd(sentenceIndex, chunkDuration);
    }
  }
  
  /**
   * Reset progressive streaming state
   */
  private resetProgressiveState(): void {
    // Stop all active progressive sources
    for (const source of this.progressiveSources) {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Ignore - source may have already ended
      }
    }
    this.progressiveSources = [];
    this.progressiveChunks = [];
    this.progressiveFirstChunkStarted = false;
    this.progressivePlaybackStartCtxTime = 0;
    this.progressiveTotalDuration = 0;
    
    // Reset sentence and word schedules
    this.sentenceSchedule.clear();
    this.wordSchedule.clear();
    this.pendingWordTimings.clear();
    this.activeSentenceInLoop = -1;
    this.wordMatchCount = 0;
    
    // Reset debug state
    resetDebugTimingState();
  }
  
  // Queue for word timings that arrive before their sentence schedule entry exists
  private pendingWordTimings: Map<number, Array<{
    wordIndex: number;
    word: string;
    relativeStartTime: number;
    relativeEndTime: number;
  }>> = new Map();

  /**
   * WORD-BASED TIMING: Register a word timing with ABSOLUTE AudioContext times
   * 
   * Called when word_timing_delta arrives. Converts relative word times
   * (within sentence) to absolute AudioContext times for direct matching.
   * 
   * If sentence schedule entry doesn't exist yet (race condition), queues the
   * word timing to be processed when the sentence entry is created.
   * 
   * @param sentenceIndex - Which sentence this word belongs to
   * @param wordIndex - Index of word within sentence
   * @param word - The actual word text
   * @param relativeStartTime - Word start time relative to sentence start (seconds)
   * @param relativeEndTime - Word end time relative to sentence start (seconds)
   */
  registerWordTiming(
    sentenceIndex: number,
    wordIndex: number,
    word: string,
    relativeStartTime: number,
    relativeEndTime: number
  ): void {
    // Get sentence start time from schedule
    const sentenceEntry = this.sentenceSchedule.get(sentenceIndex);
    if (!sentenceEntry) {
      // RACE CONDITION FIX: Queue this word timing for later processing
      console.warn(`[WORD SCHEDULE] Queuing word S${sentenceIndex}W${wordIndex} "${word}" - sentence not in schedule yet`);
      
      if (!this.pendingWordTimings.has(sentenceIndex)) {
        this.pendingWordTimings.set(sentenceIndex, []);
      }
      this.pendingWordTimings.get(sentenceIndex)!.push({
        wordIndex,
        word,
        relativeStartTime,
        relativeEndTime
      });
      return;
    }
    
    // Calculate absolute AudioContext times
    const absoluteStartTime = sentenceEntry.startCtxTime + relativeStartTime;
    const absoluteEndTime = sentenceEntry.startCtxTime + relativeEndTime;
    
    // Store in word schedule
    const key = `s${sentenceIndex}_w${wordIndex}`;
    this.wordSchedule.set(key, {
      sentenceIndex,
      wordIndex,
      word,
      absoluteStartTime,
      absoluteEndTime
    });
    
    // Use console.error for more reliable capture in browser logs
    console.error(`[WORD SCHEDULE] Registered: ${key} "${word}" abs=${absoluteStartTime.toFixed(3)}-${absoluteEndTime.toFixed(3)}s (sentenceStart=${sentenceEntry.startCtxTime.toFixed(3)}, relative=${relativeStartTime.toFixed(3)}-${relativeEndTime.toFixed(3)})`);
    
    // Update debug state with word schedule (limit to last 20 words for performance)
    this.updateWordScheduleDebugState();
  }
  
  /**
   * Process any queued word timings for a sentence after its schedule entry is created
   */
  private processPendingWordTimings(sentenceIndex: number): void {
    const pending = this.pendingWordTimings.get(sentenceIndex);
    if (!pending || pending.length === 0) return;
    
    console.log(`[WORD SCHEDULE] Processing ${pending.length} queued words for S${sentenceIndex}`);
    
    for (const wordTiming of pending) {
      this.registerWordTiming(
        sentenceIndex,
        wordTiming.wordIndex,
        wordTiming.word,
        wordTiming.relativeStartTime,
        wordTiming.relativeEndTime
      );
    }
    
    // Clear the queue for this sentence
    this.pendingWordTimings.delete(sentenceIndex);
  }
  
  /**
   * Update debug state with current word schedule
   */
  private updateWordScheduleDebugState(): void {
    const wordEntries = Array.from(this.wordSchedule.values());
    const recentWords = wordEntries.slice(0, 20).map(e => ({
      sentenceIndex: e.sentenceIndex,
      wordIndex: e.wordIndex,
      word: e.word,
      absoluteStartTime: e.absoluteStartTime,
      absoluteEndTime: e.absoluteEndTime
    }));
    updateDebugTimingState({
      wordSchedule: recentWords,
      wordScheduleSize: this.wordSchedule.size
    });
  }
  
  /**
   * WORD-BASED TIMING: Find the currently active word based on AudioContext.currentTime
   * 
   * This is the core of the new word-based matching approach.
   * Returns the active word info or null if no word is active.
   */
  findActiveWord(): { sentenceIndex: number; wordIndex: number; word: string } | null {
    const ctx = this.audioContext;
    if (!ctx) return null;
    
    const now = ctx.currentTime;
    
    // Use Array.from for broader compatibility (avoids downlevelIteration issues)
    const wordEntries = Array.from(this.wordSchedule.entries());
    
    // DEBUG: Log word schedule state periodically (use console.error for reliable capture)
    if (wordEntries.length > 0 && Math.floor(now * 2) % 4 === 0) {
      // Find closest word for debugging
      let closestWord = wordEntries[0];
      let closestDiff = Math.abs(now - wordEntries[0][1].absoluteStartTime);
      for (let i = 1; i < wordEntries.length; i++) {
        const diff = Math.abs(now - wordEntries[i][1].absoluteStartTime);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestWord = wordEntries[i];
        }
      }
      // Show first 3 words time ranges for debugging
      const first3 = wordEntries.slice(0, 3).map(([k, e]) => `${k}:${e.absoluteStartTime.toFixed(2)}-${e.absoluteEndTime.toFixed(2)}`).join(', ');
      console.error(`[findActiveWord] now=${now.toFixed(3)}, closest="${closestWord[1].word}" ${closestWord[1].absoluteStartTime.toFixed(3)}-${closestWord[1].absoluteEndTime.toFixed(3)} (diff=${closestDiff.toFixed(3)}s) | first3=[${first3}]`);
    }
    
    // Iterate through all words and find the one that matches current time
    for (let i = 0; i < wordEntries.length; i++) {
      const [key, entry] = wordEntries[i];
      if (now >= entry.absoluteStartTime && now < entry.absoluteEndTime) {
        // Log successful match periodically (every ~0.5s)
        if (Math.floor(now * 2) % 2 === 0) {
          console.log(`[WORD MATCH FOUND] now=${now.toFixed(3)} matches ${key}:"${entry.word}" at ${entry.absoluteStartTime.toFixed(3)}-${entry.absoluteEndTime.toFixed(3)}s`);
        }
        return {
          sentenceIndex: entry.sentenceIndex,
          wordIndex: entry.wordIndex,
          word: entry.word
        };
      }
    }
    
    // Log when NO match is found (only if we have words in schedule)
    if (wordEntries.length > 0 && Math.floor(now * 2) % 4 === 0) {
      // Find range of all words
      let minStart = Infinity, maxEnd = -Infinity;
      for (let i = 0; i < wordEntries.length; i++) {
        if (wordEntries[i][1].absoluteStartTime < minStart) minStart = wordEntries[i][1].absoluteStartTime;
        if (wordEntries[i][1].absoluteEndTime > maxEnd) maxEnd = wordEntries[i][1].absoluteEndTime;
      }
      console.error(`[NO WORD MATCH] now=${now.toFixed(3)}s, wordRange=${minStart.toFixed(3)}-${maxEnd.toFixed(3)}s, scheduleSize=${wordEntries.length}`);
    }
    
    return null;
  }
  
  // Type for sentence schedule entry
  private getSentenceScheduleEntry(index: number) {
    return this.sentenceSchedule.get(index);
  }
  
  /**
   * UNIFIED TIMING LOOP: Schedule-based approach that determines active sentence
   * based on AudioContext.currentTime vs sentence schedule.
   * 
   * This is the NEW approach - instead of delaying callbacks, we track all sentences'
   * scheduled times and let the timing loop fire onSentenceStart exactly when
   * each sentence's audio actually starts playing.
   */
  private startUnifiedTimingLoop(): void {
    // Cancel any existing timing loop
    this.stopPrecisionTiming();
    
    let frameCount = 0;
    
    const tick = (): void => {
      frameCount++;
      
      // Exit if playback stopped
      if (!this.isPlaying) {
        return;
      }
      
      const ctx = this.audioContext;
      if (!ctx) {
        this.rafId = requestAnimationFrame(tick);
        return;
      }
      
      const now = ctx.currentTime;
      const ctxState = ctx.state;
      
      // Log AudioContext ID every 60 frames - only when diagnostics enabled
      if (frameCount % 60 === 0 && isWordTimingEnabled()) {
        const ctxId = (ctx as any).__debugId || 'NO_ID';
        console.log(`[TICK DEBUG] Frame ${frameCount}: ctx.currentTime=${now.toFixed(3)}, ctx.state=${ctxState}, ctxId=${ctxId}`);
      }
      
      // Auto-resume if AudioContext became suspended mid-playback
      if (ctxState === 'suspended' && frameCount > 0) {
        ctx.resume();
      }
      
      // ═══════════════════════════════════════════════════════════════════════════
      // WORD TIMING DIAGNOSTICS: Skip heavy per-frame processing when disabled
      // This reduces CPU load significantly while preserving the loop for future use.
      // Re-enable via: window.__enableWordTimingDiagnostics = true in DevTools
      // ═══════════════════════════════════════════════════════════════════════════
      if (!isWordTimingEnabled()) {
        // MINIMAL LOOP: Only check for sentence end to maintain audio scheduling
        // Check if all sentences have ended (for proper cleanup)
        let allEnded = true;
        let anyStarted = false;
        const entries = Array.from(this.sentenceSchedule.entries());
        for (const [index, entry] of entries) {
          const endTime = entry.endCtxTime ?? (entry.startCtxTime + entry.totalDuration);
          
          // Mark sentences as started when their time arrives
          if (!entry.started && now >= entry.startCtxTime) {
            entry.started = true;
            this.currentSentenceIndex = index;
            this.callbacks.onSentenceStart?.(index);
          }
          
          // Mark sentences as ended when their time passes
          if (entry.started && !entry.ended && entry.endCtxTime !== undefined && now >= endTime) {
            entry.ended = true;
            this.callbacks.onSentenceEnd?.(index);
          }
          
          if (entry.started) anyStarted = true;
          if (!entry.ended) allEnded = false;
        }
        
        // Stop loop when all sentences complete
        if (anyStarted && allEnded && entries.length > 0) {
          this.isPlaying = false;
          this.setState('idle');
          this.callbacks.onComplete?.();
          return;
        }
        
        // Continue minimal loop
        this.rafId = requestAnimationFrame(tick);
        return;
      }
      
      // ═══════════════════════════════════════════════════════════════════════════
      // FULL WORD TIMING DIAGNOSTICS (below) - Only runs when enabled
      // ═══════════════════════════════════════════════════════════════════════════
      
      // Update debug state every 10 frames (~160ms) with current timing info
      if (frameCount % 10 === 0) {
        const scheduleArray = Array.from(this.sentenceSchedule.entries()).map(([idx, e]) => ({
          sentenceIndex: idx,
          startCtxTime: e.startCtxTime,
          totalDuration: e.totalDuration,
          endCtxTime: e.endCtxTime,
          started: e.started,
          ended: e.ended
        }));
        
        const debugCtxId = (ctx as any).__debugId || 'NO_ID';
        updateDebugTimingState({
          isLoopRunning: true,
          loopTickCount: frameCount,
          currentCtxTime: now,
          audioContextState: ctxState as 'suspended' | 'running' | 'closed' | 'unknown',
          audioContextId: debugCtxId,
          activeSentenceIndex: this.activeSentenceInLoop,
          sentenceSchedule: scheduleArray,
          isPlaying: true
        });
      }
      
      // Debug log every 60 frames (~1 second) to see schedule state
      if (frameCount % 60 === 0) {
        const scheduleInfo: string[] = [];
        const entries = Array.from(this.sentenceSchedule.entries());
        for (let j = 0; j < entries.length; j++) {
          const [idx, e] = entries[j];
          const isStreaming = e.endCtxTime === undefined;
          const endT = e.endCtxTime ?? (e.startCtxTime + e.totalDuration);
          const matchesNow = now >= e.startCtxTime && (isStreaming || now < endT);
          scheduleInfo.push(`s${idx}:[${e.startCtxTime.toFixed(2)}-${endT.toFixed(2)}${isStreaming?'~':''},started=${e.started},match=${matchesNow}]`);
        }
        console.log(`[LOOP DEBUG] frame=${frameCount}, now=${now.toFixed(3)}, schedule: ${scheduleInfo.join(' | ')}`);
      }
      
      // Find which sentence is currently active based on schedule
      // PERFORMANCE: Iterate Map directly instead of Array.from() to avoid allocation per frame
      let activeIndex = -1;
      let activeEntry: { startCtxTime: number; totalDuration: number; endCtxTime?: number; started: boolean; ended: boolean } | null = null;
      
      // DEBUG: Build match info for ALL sentences every 10 frames
      const shouldUpdateMatchInfo = frameCount % 10 === 0;
      const matchInfoArray: SentenceMatchInfo[] = [];
      
      // Use Array.from for broader compatibility (avoids downlevelIteration issues)
      const scheduleEntries = Array.from(this.sentenceSchedule.entries());
      
      // DEBUG: Log schedule size and verify consistency
      if (frameCount % 10 === 0) {
        // CRITICAL: Check if scheduleEntries matches what we just logged above
        const scheduleArrayFromAbove = Array.from(this.sentenceSchedule.entries());
        if (scheduleEntries.length !== scheduleArrayFromAbove.length) {
          console.error(`[BUG!] MISMATCH: scheduleEntries.length=${scheduleEntries.length} but Map.size=${scheduleArrayFromAbove.length}`);
        }
        
        // CRITICAL DEBUG: Log ALL entries with their endCtxTime values
        const entryDetails = scheduleEntries.map(([i, e]) => 
          `S${i}(end=${e.endCtxTime !== undefined ? e.endCtxTime.toFixed(2) : 'UNDEF'})`
        ).join(', ');
        console.error(`[LOOP] Frame ${frameCount}: entries=[${entryDetails}] now=${now.toFixed(2)}`);
        
        // CRITICAL DEBUG: Check if any entries are missing endCtxTime
        // Compare against what SHOULD exist based on logEmptyChunkProcessed
        const entriesWithEndTime = scheduleEntries.filter(([_, e]) => e.endCtxTime !== undefined);
        const entriesWithoutEndTime = scheduleEntries.filter(([_, e]) => e.endCtxTime === undefined);
        if (entriesWithoutEndTime.length > 0) {
          console.error(`[LOOP WATCHDOG] ⚠️ ${entriesWithoutEndTime.length} entries WITHOUT endCtxTime: ${entriesWithoutEndTime.map(([i, e]) => 
            `S${i}(dur=${e.totalDuration.toFixed(2)})`
          ).join(', ')}`);
        }
      }
      
      for (let i = 0; i < scheduleEntries.length; i++) {
        const [index, entry] = scheduleEntries[i];
        // FIXED: Don't treat as "streaming forever" just because endCtxTime isn't set
        // Instead, use totalDuration as the fallback end time
        // Only truly "streaming" if we have no duration data yet (first chunk still arriving)
        const hasEnoughDuration = entry.totalDuration > 0.1; // At least 100ms of audio
        const endTime = entry.endCtxTime ?? (entry.startCtxTime + entry.totalDuration);
        
        // A sentence matches if:
        // 1. now >= startCtxTime (sentence has started)
        // 2. AND either: still streaming (no duration yet) OR now < computed end time
        const isActivelyStreaming = !hasEnoughDuration && entry.endCtxTime === undefined;
        const matches = now >= entry.startCtxTime && (isActivelyStreaming || now < endTime);
        
        // Build reason string
        let reason = '';
        if (now < entry.startCtxTime) {
          reason = `NOT YET: now(${now.toFixed(2)}) < start(${entry.startCtxTime.toFixed(2)})`;
        } else if (isActivelyStreaming) {
          reason = `STREAMING: now(${now.toFixed(2)}) >= start, buffering first chunks`;
        } else if (now >= endTime) {
          reason = `ENDED: now(${now.toFixed(2)}) >= end(${endTime.toFixed(2)})`;
        } else {
          const endSource = entry.endCtxTime !== undefined ? 'endCtxTime' : 'duration';
          reason = `ACTIVE: start(${entry.startCtxTime.toFixed(2)}) <= now(${now.toFixed(2)}) < end(${endTime.toFixed(2)}) [${endSource}]`;
        }
        
        if (shouldUpdateMatchInfo) {
          matchInfoArray.push({
            sentenceIndex: index,
            startCtxTime: entry.startCtxTime,
            endCtxTime: entry.endCtxTime,
            isStreaming: isActivelyStreaming,
            computedEndTime: endTime,
            nowTime: now,
            matches,
            reason
          });
        }
        
        if (matches && activeIndex === -1) {
          activeIndex = index;
          activeEntry = entry;
          // Don't break - continue to collect match info for all sentences
        }
      }
      
      // Update debug state with match info
      if (shouldUpdateMatchInfo && matchInfoArray.length > 0) {
        updateDebugTimingState({ sentenceMatchInfo: matchInfoArray });
      }
      
      // WORD-BASED TIMING: Find active word directly using AudioContext time
      const activeWord = this.findActiveWord();
      
      // Log every word match (for first 50 matches, then throttle)
      if (activeWord) {
        this.wordMatchCount++;
        if (this.wordMatchCount <= 50 || frameCount % 60 === 0) {
          console.error(`[WORD-MATCH] ✓ now=${now.toFixed(3)}s matched S${activeWord.sentenceIndex}W${activeWord.wordIndex}:"${activeWord.word}" (matchCount=${this.wordMatchCount})`);
        }
        
        // ALWAYS update lastWordMatchTime when we have a match (not throttled)
        // This ensures the debug panel shows the last successful match time
        updateDebugTimingState({
          activeWord: {
            sentenceIndex: activeWord.sentenceIndex,
            wordIndex: activeWord.wordIndex,
            word: activeWord.word
          },
          lastWordMatchTime: now
        });
      } else if (shouldUpdateMatchInfo) {
        // Only update with null when throttle allows (to avoid excessive updates)
        updateDebugTimingState({
          activeWord: null
        });
      }
      
      // Derive sentence from active word for more reliable sentence tracking
      const wordBasedSentenceIndex = activeWord?.sentenceIndex ?? -1;
      
      // Use word-based sentence detection OR fall back to sentence-based
      const effectiveSentenceIndex = wordBasedSentenceIndex >= 0 ? wordBasedSentenceIndex : activeIndex;
      const effectiveEntry = effectiveSentenceIndex >= 0 ? this.sentenceSchedule.get(effectiveSentenceIndex) : null;
      
      // DEBUG: Log effective sentence detection every 30 frames
      if (frameCount % 30 === 0) {
        const wordScheduleSize = this.wordSchedule.size;
        console.error(`[TIMING FRAME ${frameCount}] wordBasedIdx=${wordBasedSentenceIndex}, sentenceBasedIdx=${activeIndex}, effective=${effectiveSentenceIndex}, scheduleSize=${this.sentenceSchedule.size}, wordScheduleSize=${wordScheduleSize}`);
      }
      
      if (effectiveEntry && effectiveSentenceIndex >= 0) {
        // Fire onSentenceStart if this is a NEW active sentence
        if (!effectiveEntry.started) {
          const previousSentence = this.activeSentenceInLoop;
          effectiveEntry.started = true;
          this.currentSentenceIndex = effectiveSentenceIndex;
          this.activeSentenceInLoop = effectiveSentenceIndex;
          this.progressivePlaybackStartCtxTime = effectiveEntry.startCtxTime;
          
          // CRITICAL: Use console.error for visibility
          console.error(`[SENTENCE] ▶▶▶ STARTING S${effectiveSentenceIndex} (now=${ctx.currentTime.toFixed(3)}, scheduled=${effectiveEntry.startCtxTime.toFixed(3)}, via=${wordBasedSentenceIndex >= 0 ? 'word' : 'sentence'})`);
          
          // Log sentence transition for debug panel
          logSentenceTransition(previousSentence, effectiveSentenceIndex, `started at ${ctx.currentTime.toFixed(2)}s`);
          
          // Update debug panel with sentences started count
          const startedCount = Array.from(this.sentenceSchedule.values()).filter(e => e.started).length;
          updateDebugTimingState({
            sentencesStarted: startedCount,
          });
          
          this.callbacks.onSentenceStart?.(effectiveSentenceIndex);
        }
        
        // Calculate elapsed time within THIS sentence
        const elapsedInSentence = now - effectiveEntry.startCtxTime;
        
        // Fire progress callback (drives subtitle word highlighting)
        // DEBUG: Log word-based timing when available
        if (activeWord && frameCount % 30 === 0) {
          console.log(`[WORD MATCH] Active: S${activeWord.sentenceIndex} W${activeWord.wordIndex} "${activeWord.word}" | elapsed=${elapsedInSentence.toFixed(3)}s`);
        }
        
        this.callbacks.onProgress?.(elapsedInSentence, effectiveEntry.totalDuration);
      } else {
        // No active sentence - check for sentences that have ended but haven't fired onSentenceEnd
        const endCheckEntries = Array.from(this.sentenceSchedule.entries());
        let anyEndedThisTick = false;
        for (let k = 0; k < endCheckEntries.length; k++) {
          const [index, entry] = endCheckEntries[k];
          if (entry.endCtxTime === undefined) continue;
          
          if (now >= entry.endCtxTime && entry.started && !entry.ended) {
            entry.ended = true;
            anyEndedThisTick = true;
            
            // Update debug panel with sentences ended count
            const endedCount = Array.from(this.sentenceSchedule.values()).filter(e => e.ended).length;
            updateDebugTimingState({
              sentencesEnded: endedCount,
            });
            
            this.callbacks.onSentenceEnd?.(index);
          }
        }
        
        // If any sentence ended this tick, check if ALL are now complete
        if (anyEndedThisTick) {
          this.checkAllSentencesEnded();
        }
      }
      
      // FALLBACK: Periodically check if we should stop (every 30 frames) when response_complete was received
      // This handles the case where all sentences ended before the fallback code was deployed
      if (frameCount % 30 === 0) {
        const debugState = window.__debugTimingState;
        const wsReceived = debugState?.wsResponseCompleteReceived;
        const expCount = this.expectedSentenceCount;
        
        // Log every 150 frames (~2.5s) to track fallback status
        if (frameCount % 150 === 0) {
          console.log(`[FALLBACK CHECK] F${frameCount}: wsReceived=${wsReceived}, expectedCount=${expCount}, scheduleSize=${this.sentenceSchedule.size}`);
        }
        
        if (wsReceived && expCount === null) {
          const allEnded = this.checkAllSentencesEnded();
          console.log(`[FALLBACK] F${frameCount}: wsReceived=true, expectedCount=null -> checkAllSentencesEnded=${allEnded}`);
          if (allEnded) {
            console.log('[StreamingAudioPlayer] FALLBACK PERIODIC CHECK: All sentences ended, stopping loop');
            this.isPlaying = false;
            this.setState('idle');
            this.stopPrecisionTiming();
            this.callbacks.onComplete?.();
            return; // Exit the loop
          }
        }
      }
      
      // Continue the loop
      this.rafId = requestAnimationFrame(tick);
    };
    
    this.rafId = requestAnimationFrame(tick);
  }

  /**
   * Start precision timing loop specifically for progressive PCM streaming
   * Uses AudioContext.currentTime for accurate tracking
   * @deprecated Use startUnifiedTimingLoop instead
   */
  private startProgressivePrecisionTiming(): void {
    // Cancel any existing timing loop
    this.stopPrecisionTiming();
    
    console.log('[StreamingAudioPlayer] Starting progressive precision timing (AudioContext anchored)');
    
    let frameCount = 0;
    const tick = () => {
      // Exit if playback stopped
      if (!this.isPlaying || this.progressiveSentenceIndex === -1) {
        return;
      }
      
      // Calculate current playback time from AudioContext
      const ctx = this.audioContext;
      if (!ctx) {
        this.rafId = requestAnimationFrame(tick);
        return;
      }
      
      // Current time = AudioContext time - when we started playing
      const elapsedCtxTime = ctx.currentTime - this.progressivePlaybackStartCtxTime;
      
      // If we haven't reached the start time yet (audio scheduled for future), wait
      if (elapsedCtxTime < 0) {
        // Continue loop but don't fire callbacks yet
        this.rafId = requestAnimationFrame(tick);
        return;
      }
      
      const currentTime = elapsedCtxTime;
      
      // Fire progress callback with current time and estimated total duration
      this.callbacks.onProgress?.(currentTime, this.progressiveTotalDuration);
      
      // Debug log periodically - every 10 frames (~160ms at 60fps) for more visibility
      frameCount++;
      if (frameCount % 10 === 0) {
        console.log(`[TIMING LOOP] frame=${frameCount}, elapsed=${currentTime.toFixed(3)}s, total=${this.progressiveTotalDuration.toFixed(3)}s, ctx.state=${ctx?.state}`);
      }
      
      // Continue the loop
      this.rafId = requestAnimationFrame(tick);
    };
    
    this.rafId = requestAnimationFrame(tick);
  }
  
  /**
   * Schedule sentence end callback after last chunk finishes
   */
  private scheduleProgressiveSentenceEnd(sentenceIndex: number, lastChunkDuration: number): void {
    const ctx = this.getAudioContext();
    const delayMs = (this.progressiveScheduledTime - ctx.currentTime) * 1000;
    
    console.log(`[StreamingAudioPlayer] [Progressive] Scheduling sentence ${sentenceIndex} end in ${delayMs.toFixed(0)}ms`);
    
    setTimeout(() => {
      this.finalizeProgressiveSentence(sentenceIndex);
    }, Math.max(0, delayMs));
  }
  
  /**
   * Finalize a progressive sentence (called when last chunk ends)
   * NOTE: With the unified timing loop, onSentenceEnd is now fired there.
   * This method handles cleanup only if not already handled.
   */
  private finalizeProgressiveSentence(sentenceIndex: number): void {
    console.log(`[StreamingAudioPlayer] [Progressive] Sentence ${sentenceIndex} complete (current: ${this.progressiveSentenceIndex})`);
    
    // Check if unified loop already fired onSentenceEnd via the schedule
    const scheduleEntry = this.sentenceSchedule.get(sentenceIndex);
    if (scheduleEntry && !scheduleEntry.ended) {
      scheduleEntry.ended = true;
      
      // Update debug panel with sentences ended count
      const endedCount = Array.from(this.sentenceSchedule.values()).filter(e => e.ended).length;
      updateDebugTimingState({
        sentencesEnded: endedCount,
      });
      
      this.callbacks.onSentenceEnd?.(sentenceIndex);
    } else {
      console.log(`[StreamingAudioPlayer] [Progressive] Sentence ${sentenceIndex} already ended via unified loop, skipping callback`);
      
      // Still update ended count in case timing loop set ended=true but didn't update counter
      const endedCount = Array.from(this.sentenceSchedule.values()).filter(e => e.ended).length;
      updateDebugTimingState({
        sentencesEnded: endedCount,
      });
    }
    
    // FIX: Check if ALL sentences in the schedule have completed
    // Only stop playback when every scheduled sentence has ended
    // This fixes the bug where sentence 0's timeout would kill playback
    // before sentences 1 and 2 could be processed by the timing loop
    const allSentencesEnded = this.checkAllSentencesEnded();
    
    console.log(`[StreamingAudioPlayer] [Progressive] Sentence ${sentenceIndex} finalized, allEnded=${allSentencesEnded}, scheduleSize=${this.sentenceSchedule.size}`);
    
    if (allSentencesEnded && this.queue.length === 0) {
      console.log(`[StreamingAudioPlayer] [Progressive] All sentences complete, stopping playback`);
      this.progressiveSentenceIndex = -1;
      this.isPlaying = false;
      this.setState('idle');
      this.stopPrecisionTiming();
      this.callbacks.onComplete?.();
    }
    // If not all sentences ended, keep the timing loop running
  }
  
  /**
   * Check if all sentences in the schedule have ended
   * Returns true only when:
   * 1. We know the expected sentence count (from response_complete)
   * 2. We have received all expected sentences
   * 3. Every entry has ended=true AND has endCtxTime set
   * 
   * CRITICAL FIX: Without expectedSentenceCount, we can't know if more sentences
   * are coming. This prevents premature loop termination between sentences.
   */
  private checkAllSentencesEnded(): boolean {
    // Track call count in debug state
    const currentState = window.__debugTimingState;
    const callCount = (currentState?.checkAllCallCount || 0) + 1;
    
    // Helper to update debug panel with result
    const logResult = (result: boolean, reason: string) => {
      updateDebugTimingState({
        lastCheckAllResult: result,
        lastCheckAllReason: reason,
        lastCheckAllTime: Date.now(),
        checkAllCallCount: callCount,
        allSentencesEnded: result,
      });
    };
    
    if (this.sentenceSchedule.size === 0) {
      logResult(true, 'No sentences scheduled (size=0)');
      return true;
    }
    
    // CRITICAL: If we don't know how many sentences to expect, we can't be sure all have arrived
    // FALLBACK: Check if response_complete was received via debug state (playerRef might have been null)
    if (this.expectedSentenceCount === null) {
      const debugState = window.__debugTimingState;
      if (debugState?.wsResponseCompleteReceived) {
        // response_complete WAS received, but playerRef was null when hook tried to call setExpectedSentenceCount
        // Fallback: check if all sentences in schedule have ended
        const allEntries = Array.from(this.sentenceSchedule.entries());
        const allHaveEnded = allEntries.every(([_, entry]) => entry.ended && entry.endCtxTime !== undefined);
        
        if (allHaveEnded && allEntries.length > 0) {
          console.log(`[StreamingAudioPlayer] FALLBACK: response_complete received but expectedSentenceCount null. All ${allEntries.length} sentences ended.`);
          logResult(true, `FALLBACK: response_complete received, all ${allEntries.length} sentences ended`);
          return true;
        }
        logResult(false, `FALLBACK: response_complete received but not all sentences ended yet (${allEntries.length} in schedule)`);
        return false;
      }
      logResult(false, 'expectedSentenceCount=null (waiting for response_complete)');
      return false;
    }
    
    // Check if we've received all expected sentences
    if (this.sentenceSchedule.size < this.expectedSentenceCount) {
      logResult(false, `size(${this.sentenceSchedule.size}) < expected(${this.expectedSentenceCount})`);
      return false;
    }
    
    const allEntries = Array.from(this.sentenceSchedule.entries());
    for (let i = 0; i < allEntries.length; i++) {
      const [index, entry] = allEntries[i];
      if (entry.endCtxTime === undefined) {
        logResult(false, `S${index}: endCtxTime=undefined`);
        return false;
      }
      if (!entry.ended) {
        logResult(false, `S${index}: ended=false`);
        return false;
      }
    }
    
    logResult(true, `✓ All ${this.expectedSentenceCount} sentences complete!`);
    return true;
  }
  
  /**
   * Stop playback and clear queue
   */
  stop(): void {
    console.log('[StreamingAudioPlayer] Stop');
    
    // Stop precision timing
    this.stopPrecisionTiming();
    
    // Stop current MP3 audio
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.src = '';
      this.currentAudio = null;
    }
    
    // Stop current PCM audio
    if (this.currentPcmSource) {
      try {
        this.currentPcmSource.stop();
      } catch (e) {
        // Ignore - source may already be stopped
      }
      this.currentPcmSource = null;
    }
    
    // Stop progressive streaming
    this.resetProgressiveState();
    this.progressiveSentenceIndex = -1;
    
    // Clear queue and pending count
    this.queue = [];
    this.isPlaying = false;
    this.updatePendingCount(0);
    
    // Cleanup object URLs
    this.cleanupUrls();
    
    this.setState('idle');
  }
  
  /**
   * Pause playback
   */
  pause(): void {
    if (this.currentAudio && this.state === 'playing') {
      this.currentAudio.pause();
      this.setState('paused');
    }
  }
  
  /**
   * Resume playback
   */
  resume(): void {
    if (this.currentAudio && this.state === 'paused') {
      this.currentAudio.play().catch(console.error);
      this.setState('playing');
    }
  }
  
  /**
   * Start high-precision timing loop using requestAnimationFrame
   * This provides ~60fps updates instead of the coarse timeupdate (~4fps)
   * 
   * CRITICAL: Uses audio.currentTime directly when available, falling back to
   * performance.now() timing when audio element is temporarily unavailable.
   * This keeps subtitles synced with actual audio while handling edge cases.
   */
  private startPrecisionTiming(): void {
    // Cancel any existing timing loop
    this.stopPrecisionTiming();
    
    console.log('[StreamingAudioPlayer] Starting precision timing loop (audio.currentTime anchored)');
    
    let frameCount = 0;
    const tick = () => {
      // Exit only if we've explicitly stopped playback
      if (!this.isPlaying) {
        console.log('[StreamingAudioPlayer] RAF loop exiting: isPlaying=false');
        return;
      }
      
      // Use audio.currentTime when available, fall back to performance.now() timing
      // This handles edge cases where currentAudio is temporarily null (resume/stop flows)
      let currentTime: number;
      if (this.currentAudio && !this.currentAudio.paused) {
        // Primary: Use actual audio playback position for perfect sync
        currentTime = this.currentAudio.currentTime;
      } else if (this.playbackStartTime !== null) {
        // Fallback: Calculate from performance.now() when audio temporarily unavailable
        const elapsedMs = performance.now() - this.playbackStartTime;
        currentTime = elapsedMs / 1000;
      } else {
        // No timing source available, continue loop but don't fire callback
        this.rafId = requestAnimationFrame(tick);
        return;
      }
      
      // Fire progress callback with timing
      this.callbacks.onProgress?.(currentTime, this.currentDuration);
      
      // DEBUG: Log periodically to verify loop is running
      frameCount++;
      if (frameCount % 60 === 0) { // Every ~1 second at 60fps
        const source = this.currentAudio && !this.currentAudio.paused ? 'audio' : 'perf';
        console.log(`[StreamingAudioPlayer] RAF frame ${frameCount}, time: ${currentTime.toFixed(3)}s (${source})`);
      }
      
      // Continue the loop
      this.rafId = requestAnimationFrame(tick);
    };
    
    this.rafId = requestAnimationFrame(tick);
  }
  
  /**
   * Stop the precision timing loop
   * NOTE: Does NOT reset playbackStartTime - that's set in onplaying handler
   */
  private stopPrecisionTiming(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    // Don't reset playbackStartTime here - it's set in onplaying handler
    // and cleared in playNext() when preparing for next chunk
  }
  
  /**
   * Play the next chunk in the queue
   * Supports both MP3 (HTMLAudioElement) and raw PCM (Web Audio API)
   */
  private async playNext(): Promise<void> {
    console.log(`[StreamingAudioPlayer] ▶ PLAY_NEXT called, queue has ${this.queue.length} chunks`);
    
    // Stop any existing precision timing
    this.stopPrecisionTiming();
    
    // Stop any existing PCM source
    if (this.currentPcmSource) {
      try {
        this.currentPcmSource.stop();
      } catch (e) {
        // Ignore - source may already be stopped
      }
      this.currentPcmSource = null;
    }
    
    // Get next chunk from queue
    const chunk = this.queue.shift();
    
    if (!chunk) {
      console.log('[StreamingAudioPlayer] ⏹ Queue empty - stopping playback');
      this.isPlaying = false;
      this.setState('idle');
      this.callbacks.onComplete?.();
      return;
    }
    
    this.isPlaying = true;
    this.currentSentenceIndex = chunk.sentenceIndex;
    this.currentDuration = chunk.durationMs / 1000; // Convert to seconds
    this.currentAudioFormat = chunk.audioFormat || 'mp3';
    
    // Set state to buffering BEFORE firing callbacks
    // This prevents race condition where isProcessing=false but playbackState still 'idle'
    this.setState('buffering');
    
    const formatLabel = this.currentAudioFormat === 'pcm_f32le' ? 'PCM' : 'MP3';
    console.log(`[StreamingAudioPlayer] ▶ Playing sentence ${chunk.sentenceIndex} (${formatLabel}): ${chunk.audio.byteLength} bytes, expectedDuration=${(chunk.durationMs/1000).toFixed(2)}s, isLast=${chunk.isLast}`);
    
    try {
      if (this.currentAudioFormat === 'pcm_f32le') {
        // Raw PCM playback via Web Audio API
        await this.playPcmChunk(chunk);
      } else {
        // MP3 playback via HTMLAudioElement
        await this.playMp3Chunk(chunk);
      }
      
    } catch (error: any) {
      console.error('[StreamingAudioPlayer] Error playing chunk:', error);
      this.stopPrecisionTiming();
      this.callbacks.onError?.(error);
      
      // Decrement pending count on error
      this.updatePendingCount(Math.max(0, this.pendingAudioCount - 1));
      
      // Try next chunk
      this.playNext();
    }
  }
  
  /**
   * Play MP3 audio chunk using HTMLAudioElement
   */
  private async playMp3Chunk(chunk: StreamingAudioChunk): Promise<void> {
    // Create blob URL for the audio
    const blob = new Blob([chunk.audio], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    this.objectUrls.push(url);
    
    // Create audio element
    this.currentAudio = new Audio(url);
    
    // Handle audio events
    this.currentAudio.onloadedmetadata = () => {
      // Use actual duration from audio if available
      if (this.currentAudio && this.currentAudio.duration > 0 && Number.isFinite(this.currentAudio.duration)) {
        this.currentDuration = this.currentAudio.duration;
        console.log(`[StreamingAudioPlayer] Audio loaded: ${this.currentDuration.toFixed(3)}s`);
      }
    };
    
    // Use 'playing' event - fires when audio ACTUALLY starts producing sound
    this.currentAudio.onplaying = () => {
      this.setState('playing');
      this.playbackStartTime = performance.now();
      console.log(`[StreamingAudioPlayer] MP3 started at ${this.playbackStartTime.toFixed(2)}ms`);
      
      // Fire onSentenceStart for precise sync with subtitle timing
      this.callbacks.onSentenceStart?.(this.currentSentenceIndex);
      
      // Start high-precision timing loop
      this.startPrecisionTiming();
    };
    
    this.currentAudio.onended = () => {
      console.log(`[StreamingAudioPlayer] Sentence ${chunk.sentenceIndex} ended (MP3)`);
      this.stopPrecisionTiming();
      this.callbacks.onSentenceEnd?.(chunk.sentenceIndex);
      
      // Decrement pending count after chunk finishes
      this.updatePendingCount(Math.max(0, this.pendingAudioCount - 1));
      
      // Play next chunk
      this.playNext();
    };
    
    this.currentAudio.onerror = (event) => {
      console.error('[StreamingAudioPlayer] MP3 audio error:', event);
      this.stopPrecisionTiming();
      this.callbacks.onError?.(new Error('MP3 playback failed'));
      
      // Decrement pending count on error
      this.updatePendingCount(Math.max(0, this.pendingAudioCount - 1));
      
      // Try next chunk
      this.playNext();
    };
    
    // Start playback
    await this.currentAudio.play();
  }
  
  /**
   * Play raw PCM audio chunk using Web Audio API
   * PCM format: 32-bit float, little-endian (f32le), 24kHz mono
   */
  private async playPcmChunk(chunk: StreamingAudioChunk): Promise<void> {
    const ctx = this.getAudioContext();
    const sampleRate = chunk.sampleRate || 24000;
    
    // Resume AudioContext if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      console.log('[StreamingAudioPlayer] Resuming AudioContext for PCM playback...');
      await ctx.resume();
    }
    
    // Convert raw PCM bytes to Float32Array
    // f32le = 32-bit float, little-endian = 4 bytes per sample
    const float32Data = new Float32Array(chunk.audio);
    const numSamples = float32Data.length;
    
    console.log(`[StreamingAudioPlayer] PCM: ${numSamples} samples at ${sampleRate}Hz = ${(numSamples / sampleRate).toFixed(3)}s`);
    
    // Create AudioBuffer
    const audioBuffer = ctx.createBuffer(1, numSamples, sampleRate);
    audioBuffer.getChannelData(0).set(float32Data);
    
    // Update actual duration from buffer
    this.currentDuration = audioBuffer.duration;
    
    // Create buffer source node
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    this.currentPcmSource = source;
    
    // Set state and timing BEFORE starting playback
    this.setState('playing');
    this.playbackStartTime = performance.now();
    console.log(`[StreamingAudioPlayer] PCM started at ${this.playbackStartTime.toFixed(2)}ms`);
    
    // Fire onSentenceStart for precise sync with subtitle timing
    this.callbacks.onSentenceStart?.(this.currentSentenceIndex);
    
    // Start high-precision timing loop
    this.startPrecisionTiming();
    
    // Handle playback end
    source.onended = () => {
      console.log(`[StreamingAudioPlayer] Sentence ${chunk.sentenceIndex} ended (PCM)`);
      this.stopPrecisionTiming();
      this.currentPcmSource = null;
      this.callbacks.onSentenceEnd?.(chunk.sentenceIndex);
      
      // Decrement pending count after chunk finishes
      this.updatePendingCount(Math.max(0, this.pendingAudioCount - 1));
      
      // Play next chunk
      this.playNext();
    };
    
    // Start playback
    source.start(0);
  }
  
  /**
   * Update state and notify callback
   */
  private setState(state: StreamingPlaybackState): void {
    if (this.state !== state) {
      console.log(`[StreamingAudioPlayer] State: ${this.state} → ${state}`);
      this.state = state;
      this.callbacks.onStateChange?.(state);
    }
  }
  
  /**
   * Cleanup object URLs to prevent memory leaks
   */
  private cleanupUrls(): void {
    for (const url of this.objectUrls) {
      URL.revokeObjectURL(url);
    }
    this.objectUrls = [];
  }
  
  /**
   * Cleanup on destroy
   */
  destroy(): void {
    this.stopPrecisionTiming();
    this.stop();
    console.log('[StreamingAudioPlayer] Destroyed');
  }
}
