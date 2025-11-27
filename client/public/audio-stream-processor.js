/**
 * Audio Stream Processor Worklet
 * 
 * Captures audio from the microphone, resamples to 16kHz,
 * converts to PCM16 format, and sends chunks to main thread.
 * 
 * Input: Audio samples at browser's native sample rate (usually 44.1kHz or 48kHz)
 * Output: PCM16 audio at 16kHz for Deepgram STT
 */

class AudioStreamProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
    this.targetSampleRate = 16000;
    this.isProcessing = true;
    
    this.port.onmessage = (event) => {
      if (event.data.type === 'flush') {
        this.flushBuffer();
      } else if (event.data.type === 'stop') {
        this.flushBuffer();
        this.isProcessing = false;
      }
    };
  }

  flushBuffer() {
    if (this.bufferIndex > 0) {
      const remainingBuffer = this.buffer.slice(0, this.bufferIndex);
      const resampled = this.resample(
        remainingBuffer,
        sampleRate,
        this.targetSampleRate
      );
      
      if (resampled.length > 0) {
        const pcm16 = this.floatToPcm16(resampled);
        
        this.port.postMessage({
          type: 'audio',
          audio: pcm16.buffer,
          isFinal: true,
        }, [pcm16.buffer]);
      }
      
      this.bufferIndex = 0;
    }
  }

  process(inputs, outputs, parameters) {
    if (!this.isProcessing) {
      return false;
    }

    const input = inputs[0];
    if (!input || !input[0]) {
      return true;
    }

    const channelData = input[0];

    for (let i = 0; i < channelData.length; i++) {
      this.buffer[this.bufferIndex++] = channelData[i];

      if (this.bufferIndex >= this.bufferSize) {
        const resampled = this.resample(
          this.buffer,
          sampleRate,
          this.targetSampleRate
        );
        
        const pcm16 = this.floatToPcm16(resampled);
        
        this.port.postMessage({
          type: 'audio',
          audio: pcm16.buffer,
          isFinal: false,
        }, [pcm16.buffer]);

        this.bufferIndex = 0;
      }
    }

    return true;
  }

  resample(inputBuffer, inputRate, outputRate) {
    const ratio = inputRate / outputRate;
    const outputLength = Math.floor(inputBuffer.length / ratio);
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i * ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, inputBuffer.length - 1);
      const fraction = srcIndex - srcIndexFloor;
      
      output[i] = inputBuffer[srcIndexFloor] * (1 - fraction) +
                  inputBuffer[srcIndexCeil] * fraction;
    }

    return output;
  }

  floatToPcm16(floatBuffer) {
    const pcm16 = new Int16Array(floatBuffer.length);
    for (let i = 0; i < floatBuffer.length; i++) {
      const s = Math.max(-1, Math.min(1, floatBuffer[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return pcm16;
  }
}

registerProcessor('audio-stream-processor', AudioStreamProcessor);
