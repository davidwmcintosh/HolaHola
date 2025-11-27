/**
 * Streaming Audio Capture
 * 
 * Manages audio capture with AudioWorklet for real-time streaming to Deepgram STT.
 * Captures audio at 16kHz PCM16 format for optimal speech recognition.
 */

export interface StreamingAudioCaptureCallbacks {
  onAudioChunk: (audioData: ArrayBuffer) => void;
  onError: (error: Error) => void;
  onStart: () => void;
  onStop: () => void;
}

export class StreamingAudioCapture {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private isCapturing = false;
  private callbacks: StreamingAudioCaptureCallbacks;
  private workletLoaded = false;
  
  constructor(callbacks: StreamingAudioCaptureCallbacks) {
    this.callbacks = callbacks;
  }
  
  /**
   * Start capturing audio and streaming chunks
   */
  async start(): Promise<void> {
    if (this.isCapturing) {
      console.warn('[StreamingAudioCapture] Already capturing');
      return;
    }
    
    try {
      this.audioContext = new AudioContext({ sampleRate: 48000 });
      
      if (!this.workletLoaded) {
        await this.audioContext.audioWorklet.addModule('/audio-stream-processor.js');
        this.workletLoaded = true;
        console.log('[StreamingAudioCapture] Worklet loaded');
      }
      
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
        video: false,
      });
      
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-stream-processor');
      
      this.workletNode.port.onmessage = (event) => {
        if (event.data.type === 'audio') {
          this.callbacks.onAudioChunk(event.data.audio);
        }
      };
      
      this.sourceNode.connect(this.workletNode);
      
      this.isCapturing = true;
      this.callbacks.onStart();
      console.log('[StreamingAudioCapture] Capture started');
      
    } catch (error: any) {
      console.error('[StreamingAudioCapture] Failed to start:', error);
      this.callbacks.onError(error);
      this.cleanup();
      throw error;
    }
  }
  
  /**
   * Stop capturing audio
   */
  stop(): void {
    if (!this.isCapturing) {
      return;
    }
    
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'stop' });
      setTimeout(() => {
        this.cleanup();
        this.isCapturing = false;
        this.callbacks.onStop();
        console.log('[StreamingAudioCapture] Capture stopped');
      }, 50);
    } else {
      this.cleanup();
      this.isCapturing = false;
      this.callbacks.onStop();
      console.log('[StreamingAudioCapture] Capture stopped');
    }
  }
  
  /**
   * Check if currently capturing
   */
  isActive(): boolean {
    return this.isCapturing;
  }
  
  /**
   * Clean up resources
   */
  private cleanup(): void {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

let captureInstance: StreamingAudioCapture | null = null;

export function getStreamingAudioCapture(callbacks: StreamingAudioCaptureCallbacks): StreamingAudioCapture {
  if (!captureInstance || !captureInstance.isActive()) {
    captureInstance = new StreamingAudioCapture(callbacks);
  }
  return captureInstance;
}
