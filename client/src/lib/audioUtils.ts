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
 * Uses HTMLAudioElement for MP3 playback (better browser support).
 * Supports queue-based playback with minimal buffering latency.
 */
export interface StreamingAudioChunk {
  sentenceIndex: number;
  audio: ArrayBuffer;
  durationMs: number;
  isLast: boolean;
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
  
  constructor() {
    console.log('[StreamingAudioPlayer] Initialized');
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
    console.log(`[StreamingAudioPlayer] Enqueue sentence ${chunk.sentenceIndex} (${chunk.audio.byteLength} bytes)`);
    
    this.queue.push(chunk);
    this.updatePendingCount(this.pendingAudioCount + 1);
    
    // Start playback if not already playing
    if (!this.isPlaying) {
      this.playNext();
    }
  }
  
  /**
   * Stop playback and clear queue
   */
  stop(): void {
    console.log('[StreamingAudioPlayer] Stop');
    
    // Stop current audio
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.src = '';
      this.currentAudio = null;
    }
    
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
   * Play the next chunk in the queue
   */
  private async playNext(): Promise<void> {
    // Get next chunk from queue
    const chunk = this.queue.shift();
    
    if (!chunk) {
      console.log('[StreamingAudioPlayer] Queue empty');
      this.isPlaying = false;
      this.setState('idle');
      this.callbacks.onComplete?.();
      return;
    }
    
    this.isPlaying = true;
    this.currentSentenceIndex = chunk.sentenceIndex;
    
    // Set state to buffering BEFORE firing callbacks
    // This prevents race condition where isProcessing=false but playbackState still 'idle'
    this.setState('buffering');
    
    console.log(`[StreamingAudioPlayer] Playing sentence ${chunk.sentenceIndex}`);
    this.callbacks.onSentenceStart?.(chunk.sentenceIndex);
    
    try {
      // Create blob URL for the audio
      const blob = new Blob([chunk.audio], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      this.objectUrls.push(url);
      
      // Create audio element
      this.currentAudio = new Audio(url);
      
      // Handle audio events
      this.currentAudio.onloadedmetadata = () => {
        console.log(`[StreamingAudioPlayer] Audio loaded: ${this.currentAudio?.duration}s`);
      };
      
      this.currentAudio.oncanplaythrough = () => {
        this.setState('playing');
      };
      
      this.currentAudio.ontimeupdate = () => {
        if (this.currentAudio) {
          this.callbacks.onProgress?.(
            this.currentAudio.currentTime,
            this.currentAudio.duration
          );
        }
      };
      
      this.currentAudio.onended = () => {
        console.log(`[StreamingAudioPlayer] Sentence ${chunk.sentenceIndex} ended`);
        this.callbacks.onSentenceEnd?.(chunk.sentenceIndex);
        
        // Decrement pending count after chunk finishes
        this.updatePendingCount(Math.max(0, this.pendingAudioCount - 1));
        
        // Play next chunk
        this.playNext();
      };
      
      this.currentAudio.onerror = (event) => {
        console.error('[StreamingAudioPlayer] Audio error:', event);
        this.callbacks.onError?.(new Error('Audio playback failed'));
        
        // Decrement pending count on error too
        this.updatePendingCount(Math.max(0, this.pendingAudioCount - 1));
        
        // Try next chunk
        this.playNext();
      };
      
      // Start playback
      await this.currentAudio.play();
      
    } catch (error: any) {
      console.error('[StreamingAudioPlayer] Error playing chunk:', error);
      this.callbacks.onError?.(error);
      
      // Try next chunk
      this.playNext();
    }
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
    this.stop();
    console.log('[StreamingAudioPlayer] Destroyed');
  }
}
