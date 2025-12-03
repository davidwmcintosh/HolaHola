import { resetDebugTimingState, logEmptyChunkProcessed, logSentenceTransition, updateDebugTimingState, type SentenceScheduleEntry, type SentenceMatchInfo } from './debugTimingState';

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
  
  // Track which sentence the timing loop is currently reporting on
  private activeSentenceInLoop = -1;
  
  constructor() {
    console.log('[StreamingAudioPlayer] Initialized');
  }
  
  /**
   * Get or create AudioContext for PCM playback
   * Lazy initialization to comply with autoplay policies
   */
  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: 24000 });
      console.log('[StreamingAudioPlayer] Web Audio API initialized, state:', this.audioContext.state);
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
    const isNewTurnStarting = sentenceIndex === 0 && chunkIndex === 0;
    
    if (isNewSentence || isNewTurnStarting) {
      console.log(`[StreamingAudioPlayer] [Progressive] New sentence ${sentenceIndex} (previous: ${this.progressiveSentenceIndex}, isNewTurn=${isNewTurnStarting})`);
      
      // DON'T call resetProgressiveState() - that stops all audio!
      // Instead, just update tracking variables and let old audio finish
      
      // Clear arrays for new sentence (old sources will continue playing)
      this.progressiveChunks = [];
      
      // CRITICAL FIX: Only reset progressiveFirstChunkStarted for NEW TURNS
      // NOT for new sentences within the same turn!
      // This preserves the turn-level timing anchor across sentences
      
      // For new turn, ALWAYS clear the sentence schedule and reset timing
      // A new turn is detected when we receive sentence 0, chunk 0
      if (isNewTurnStarting) {
        console.error(`[SCHEDULE CLEAR] ⚠️ NEW TURN detected (s=0,c=0) - clearing ${this.sentenceSchedule.size} entries from schedule`);
        this.progressiveFirstChunkStarted = false; // ONLY reset for new turn
        this.sentenceSchedule.clear();
        this.activeSentenceInLoop = -1;
        // CRITICAL: Reset scheduled time for new turn - don't wait for old schedule to finish
        this.progressiveScheduledTime = ctx.currentTime + 0.1;
        // Also reset the playback start time for the new turn
        this.progressivePlaybackStartCtxTime = 0;
      }
      
      this.progressiveSentenceIndex = sentenceIndex;
      this.currentSentenceIndex = sentenceIndex;
      
      // Schedule new sentence after current audio ends (gapless playback)
      // If no audio scheduled yet, start from now + buffer
      if (this.progressiveScheduledTime <= ctx.currentTime) {
        this.progressiveScheduledTime = ctx.currentTime + 0.1;
      }
      // Otherwise, new sentence will naturally follow previous (within same turn)
      
      // DON'T set progressivePlaybackStartCtxTime here - it will be set when first chunk is scheduled below
      this.progressiveTotalDuration = 0; // Reset duration for new sentence
      this.isPlaying = true;
      this.setState('buffering');
      
      console.log(`[StreamingAudioPlayer] [Progressive] Sentence ${sentenceIndex} will start at ${this.progressiveScheduledTime.toFixed(3)}s (ctx.currentTime=${ctx.currentTime.toFixed(3)}s)`);
    }
    
    // SAFETY: Ensure scheduled time is always in the future
    // If we've fallen behind, reset to current time + buffer
    if (this.progressiveScheduledTime < ctx.currentTime) {
      console.warn(`[StreamingAudioPlayer] [Progressive] Scheduled time in past, resetting. Was ${this.progressiveScheduledTime.toFixed(3)}, now ${ctx.currentTime.toFixed(3)}`);
      this.progressiveScheduledTime = ctx.currentTime + 0.05;
    }
    
    // Convert raw PCM bytes to Float32Array
    // CRITICAL DEBUG: Log audio buffer size
    const audioByteLength = audio.byteLength;
    console.error(`[AUDIO PLAYER] Chunk s=${sentenceIndex} c=${chunkIndex} bytes=${audioByteLength} isLast=${isLast}`);
    
    const float32Data = new Float32Array(audio);
    const numSamples = float32Data.length;
    const chunkDuration = numSamples / sampleRate;
    
    // CRITICAL FIX: Handle empty audio chunks (isLast=true marker chunks)
    // These chunks have 0 audio data but signal sentence completion
    // We MUST process the isLast flag even if there's no audio to schedule
    if (numSamples === 0) {
      console.error(`[AUDIO PLAYER] *** EMPTY CHUNK DETECTED *** s=${sentenceIndex} c=${chunkIndex} isLast=${isLast}`);
      if (isLast) {
        const entry = this.sentenceSchedule.get(sentenceIndex);
        let endCtxTimeSet = false;
        if (entry) {
          entry.endCtxTime = entry.startCtxTime + entry.totalDuration;
          endCtxTimeSet = true;
          console.log(`[AUDIO SCHEDULE] ✓ Sentence ${sentenceIndex} endCtxTime set: ${entry.endCtxTime.toFixed(3)} (duration=${entry.totalDuration.toFixed(3)}s)`);
        } else {
          console.error(`[AUDIO SCHEDULE] ✗ No schedule entry for sentence ${sentenceIndex} when isLast received!`);
        }
        // Update debug panel with empty chunk info
        logEmptyChunkProcessed(sentenceIndex, endCtxTimeSet);
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
    this.progressiveTotalDuration += chunkDuration; // Track total duration
    
    // Track first chunk for timing - SCHEDULE-BASED APPROACH
    // Only log first chunk of each sentence to reduce console noise
    if (chunkIndex === 0) {
      console.log(`[AUDIO] Chunk s=${sentenceIndex} c=0 started=${this.progressiveFirstChunkStarted}`);
    }
    
    // Register sentence in schedule if this is its first chunk
    if (!this.sentenceSchedule.has(sentenceIndex)) {
      this.sentenceSchedule.set(sentenceIndex, {
        startCtxTime: playTime,
        totalDuration: 0,
        started: false,
        ended: false,
      });
      // List all sentences now in schedule
      const allSentences = Array.from(this.sentenceSchedule.keys()).join(',');
      console.error(`[SCHEDULE ADD] ✅ S${sentenceIndex} ADDED at ${playTime.toFixed(3)}s. Schedule now: [${allSentences}] (${this.sentenceSchedule.size} entries)`);
      // IMMEDIATELY update debug state with new schedule entry
      updateDebugSchedule(this.sentenceSchedule);
    } else {
      // Only log occasionally for subsequent chunks
      if (chunkIndex % 5 === 0) {
        const allSentences = Array.from(this.sentenceSchedule.keys()).join(',');
        console.error(`[SCHEDULE CHECK] S${sentenceIndex} c${chunkIndex} - Schedule: [${allSentences}]`);
      }
    }
    
    // Accumulate duration for this sentence
    const scheduleEntry = this.sentenceSchedule.get(sentenceIndex)!;
    scheduleEntry.totalDuration += chunkDuration;
    
    // Start or restart the timing loop when needed
    // - For first chunk of first sentence of a turn: always start
    // - For first chunk of any sentence after loop was stopped: restart
    const shouldStartLoop = !this.progressiveFirstChunkStarted && chunkIndex === 0 && sentenceIndex === 0;
    const shouldRestartLoop = !this.isPlaying && chunkIndex === 0;
    
    if (shouldStartLoop || shouldRestartLoop) {
      this.progressiveFirstChunkStarted = true;
      this.playbackStartTime = performance.now();
      this.isPlaying = true;
      this.setState('playing');
      console.log(`[AUDIO] ${shouldRestartLoop && !shouldStartLoop ? 'Restarting' : 'Starting'} timing loop: s=${sentenceIndex}, c=${chunkIndex}`);
      this.startUnifiedTimingLoop();
    }
    
    console.log(`[StreamingAudioPlayer] [Progressive] First chunk of sentence ${sentenceIndex} scheduled at ${playTime.toFixed(3)}s (ctx.currentTime=${ctx.currentTime.toFixed(3)}s)`);
    
    // For backward compatibility, also track progressive state for sentence 0
    if (sentenceIndex === 0 && !this.progressivePlaybackStartCtxTime) {
      this.progressivePlaybackStartCtxTime = playTime;
    }
    
    // Update current duration for progress reporting
    this.currentDuration = this.progressiveTotalDuration;
    
    console.log(`[StreamingAudioPlayer] [Progressive] Chunk ${chunkIndex}: ${numSamples} samples, ${chunkDuration.toFixed(3)}s, scheduled at ${playTime.toFixed(3)}s, isLast=${isLast}`);
    
    // Handle last chunk - set end time in schedule
    if (isLast) {
      const entry = this.sentenceSchedule.get(sentenceIndex);
      if (entry) {
        entry.endCtxTime = entry.startCtxTime + entry.totalDuration;
        console.log(`[AUDIO SCHEDULE] Sentence ${sentenceIndex} complete: endCtxTime=${entry.endCtxTime.toFixed(3)} (duration=${entry.totalDuration.toFixed(3)}s)`);
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
    
    // Reset sentence schedule
    this.sentenceSchedule.clear();
    this.activeSentenceInLoop = -1;
    
    // Reset debug state
    resetDebugTimingState();
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
    
    console.log(`[LOOP] Starting: scheduleSize=${this.sentenceSchedule.size}`);
    
    // Update debug state: loop is now running
    updateDebugTimingState({
      isLoopRunning: true,
      loopTickCount: 0,
      isPlaying: true
    });
    
    let frameCount = 0;
    
    const tick = (): void => {
      // Exit if playback stopped
      if (!this.isPlaying) {
        // Update debug state: loop stopped
        updateDebugTimingState({
          isLoopRunning: false,
          isPlaying: false
        });
        return;
      }
      
      const ctx = this.audioContext;
      if (!ctx) {
        this.rafId = requestAnimationFrame(tick);
        return;
      }
      
      const now = ctx.currentTime;
      frameCount++;
      
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
        
        updateDebugTimingState({
          isLoopRunning: true,
          loopTickCount: frameCount,
          currentCtxTime: now,
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
        console.error(`[LOOP] Frame ${frameCount}: scheduleEntries.length=${scheduleEntries.length}`);
      }
      
      for (let i = 0; i < scheduleEntries.length; i++) {
        const [index, entry] = scheduleEntries[i];
        const isStreaming = entry.endCtxTime === undefined;
        const endTime = entry.endCtxTime ?? (entry.startCtxTime + entry.totalDuration);
        const matches = now >= entry.startCtxTime && (isStreaming || now < endTime);
        
        // Build reason string
        let reason = '';
        if (now < entry.startCtxTime) {
          reason = `NOT YET: now(${now.toFixed(2)}) < start(${entry.startCtxTime.toFixed(2)})`;
        } else if (isStreaming) {
          reason = `STREAMING: now(${now.toFixed(2)}) >= start, no endTime`;
        } else if (now >= endTime) {
          reason = `ENDED: now(${now.toFixed(2)}) >= end(${endTime.toFixed(2)})`;
        } else {
          reason = `ACTIVE: start(${entry.startCtxTime.toFixed(2)}) <= now(${now.toFixed(2)}) < end(${endTime.toFixed(2)})`;
        }
        
        if (shouldUpdateMatchInfo) {
          matchInfoArray.push({
            sentenceIndex: index,
            startCtxTime: entry.startCtxTime,
            endCtxTime: entry.endCtxTime,
            isStreaming,
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
      
      if (activeEntry && activeIndex >= 0) {
        // Fire onSentenceStart if this is a NEW active sentence
        if (!activeEntry.started) {
          const previousSentence = this.activeSentenceInLoop;
          activeEntry.started = true;
          this.currentSentenceIndex = activeIndex;
          this.activeSentenceInLoop = activeIndex;
          this.progressivePlaybackStartCtxTime = activeEntry.startCtxTime;
          
          console.log(`[SENTENCE] ▶▶▶ STARTING sentence ${activeIndex} (now=${ctx.currentTime.toFixed(3)}, scheduled=${activeEntry.startCtxTime.toFixed(3)})`);
          
          // Log sentence transition for debug panel
          logSentenceTransition(previousSentence, activeIndex, `started at ${ctx.currentTime.toFixed(2)}s`);
          
          this.callbacks.onSentenceStart?.(activeIndex);
        }
        
        // Calculate elapsed time within THIS sentence
        const elapsedInSentence = now - activeEntry.startCtxTime;
        
        // Fire progress callback (drives subtitle word highlighting)
        this.callbacks.onProgress?.(elapsedInSentence, activeEntry.totalDuration);
      } else {
        // No active sentence - check for sentences that have ended but haven't fired onSentenceEnd
        const endCheckEntries = Array.from(this.sentenceSchedule.entries());
        for (let k = 0; k < endCheckEntries.length; k++) {
          const [index, entry] = endCheckEntries[k];
          if (entry.endCtxTime === undefined) continue;
          
          if (now >= entry.endCtxTime && entry.started && !entry.ended) {
            entry.ended = true;
            this.callbacks.onSentenceEnd?.(index);
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
      this.callbacks.onSentenceEnd?.(sentenceIndex);
    } else {
      console.log(`[StreamingAudioPlayer] [Progressive] Sentence ${sentenceIndex} already ended via unified loop, skipping callback`);
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
   * Returns true only when every entry has ended=true AND has endCtxTime set
   */
  private checkAllSentencesEnded(): boolean {
    if (this.sentenceSchedule.size === 0) {
      return true; // No sentences scheduled
    }
    
    const allEntries = Array.from(this.sentenceSchedule.entries());
    for (let i = 0; i < allEntries.length; i++) {
      const [index, entry] = allEntries[i];
      // A sentence is complete when:
      // 1. It has endCtxTime set (received isLast=true)
      // 2. It has been marked as ended (callback fired)
      if (entry.endCtxTime === undefined || !entry.ended) {
        console.log(`[StreamingAudioPlayer] Sentence ${index} not complete: endCtxTime=${entry.endCtxTime}, ended=${entry.ended}`);
        return false;
      }
    }
    
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
