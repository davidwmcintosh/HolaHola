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
    // Skip empty audio (e.g., final marker chunk)
    if (audio.byteLength === 0) {
      if (isLast) {
        this.finalizeProgressiveSentence(sentenceIndex);
      }
      return;
    }
    
    const ctx = this.getAudioContext();
    
    // Resume AudioContext if suspended
    if (ctx.state === 'suspended') {
      console.log('[StreamingAudioPlayer] [Progressive] Resuming AudioContext...');
      await ctx.resume();
    }
    
    // Detect new sentence - reset progressive state
    if (sentenceIndex !== this.progressiveSentenceIndex) {
      console.log(`[StreamingAudioPlayer] [Progressive] New sentence ${sentenceIndex}, resetting state`);
      this.resetProgressiveState();
      this.progressiveSentenceIndex = sentenceIndex;
      this.currentSentenceIndex = sentenceIndex;
      // Use larger safety buffer (100ms) to account for decode/scheduling latency
      this.progressiveScheduledTime = ctx.currentTime + 0.1;
      this.isPlaying = true;
      this.setState('buffering');
    }
    
    // SAFETY: Ensure scheduled time is always in the future
    // If we've fallen behind, reset to current time + buffer
    if (this.progressiveScheduledTime < ctx.currentTime) {
      console.warn(`[StreamingAudioPlayer] [Progressive] Scheduled time in past, resetting. Was ${this.progressiveScheduledTime.toFixed(3)}, now ${ctx.currentTime.toFixed(3)}`);
      this.progressiveScheduledTime = ctx.currentTime + 0.05;
    }
    
    // Convert raw PCM bytes to Float32Array
    const float32Data = new Float32Array(audio);
    const numSamples = float32Data.length;
    const chunkDuration = numSamples / sampleRate;
    
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
    
    // Track first chunk for timing
    console.error(`[AUDIO DEBUG] Progressive chunk: sentenceIndex=${sentenceIndex}, chunkIndex=${chunkIndex}, firstStarted=${this.progressiveFirstChunkStarted}`);
    if (!this.progressiveFirstChunkStarted && chunkIndex === 0) {
      this.progressiveFirstChunkStarted = true;
      this.playbackStartTime = performance.now();
      this.setState('playing');
      console.error(`[AUDIO DEBUG] >>> CALLING onSentenceStart(${sentenceIndex}) <<<`);
      this.callbacks.onSentenceStart?.(sentenceIndex);
      this.startPrecisionTiming();
      console.log(`[StreamingAudioPlayer] [Progressive] First chunk playing at ${playTime.toFixed(3)}s (ctx.currentTime=${ctx.currentTime.toFixed(3)}s)`);
    }
    
    // Update duration estimate
    this.currentDuration = this.progressiveScheduledTime - (ctx.currentTime + 0.01);
    
    console.log(`[StreamingAudioPlayer] [Progressive] Chunk ${chunkIndex}: ${numSamples} samples, ${chunkDuration.toFixed(3)}s, scheduled at ${playTime.toFixed(3)}s, isLast=${isLast}`);
    
    // Handle last chunk
    if (isLast) {
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
   */
  private finalizeProgressiveSentence(sentenceIndex: number): void {
    console.log(`[StreamingAudioPlayer] [Progressive] Sentence ${sentenceIndex} complete`);
    
    this.stopPrecisionTiming();
    this.callbacks.onSentenceEnd?.(sentenceIndex);
    
    // Reset state for next sentence
    this.resetProgressiveState();
    this.progressiveSentenceIndex = -1;
    
    // If no more queued audio, mark as idle
    if (this.queue.length === 0) {
      this.isPlaying = false;
      this.setState('idle');
      this.callbacks.onComplete?.();
    } else {
      // Continue with queued (non-progressive) audio
      this.playNext();
    }
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
