/**
 * Deepgram Live Streaming STT Service
 * 
 * Purpose: Reliable speech-to-text for push-to-talk voice mode
 * 
 * Core Values:
 * - <2 second response time: WebSocket reduces connection overhead
 * - Word timestamps for karaoke: Enabled via smart_format
 * - Sequential pipeline: Returns complete transcript before LLM call
 * - Reliability: Live API handles WebM/Opus better than prerecorded
 * 
 * Architecture: Send complete audio blob → Wait for final transcript → Return
 */

import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";

export interface TranscriptionResult {
  transcript: string;
  confidence: number;
  words: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  durationMs: number;
}

export interface DeepgramLiveConfig {
  language: string;
  model?: string;
}

const deepgramClient = createClient(process.env.DEEPGRAM_API_KEY || '');

/**
 * Transcribe audio using Deepgram's live streaming API
 * 
 * This is more reliable than the prerecorded API for WebM/Opus audio
 * from browser MediaRecorder. We send the complete blob and wait for
 * the final transcript.
 * 
 * @param audioBuffer - Complete audio buffer (WebM/Opus from browser)
 * @param config - Language and model configuration
 * @returns Promise<TranscriptionResult> with transcript, confidence, and word timings
 */
export async function transcribeWithLiveAPI(
  audioBuffer: Buffer,
  config: DeepgramLiveConfig
): Promise<TranscriptionResult> {
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Deepgram live transcription timeout (10s)'));
    }, 10000);
    
    try {
      // For WebM container format (from browser MediaRecorder), DON'T specify
      // encoding/sample_rate - Deepgram auto-detects from container headers
      const connection = deepgramClient.listen.live({
        model: config.model || 'nova-2',
        language: config.language,
        punctuate: true,
        smart_format: true,
        // NO encoding/sample_rate for container formats like WebM
      });
      
      let finalTranscript = '';
      let finalConfidence = 0;
      let finalWords: TranscriptionResult['words'] = [];
      let hasReceivedAnyTranscript = false;
      let closeTimeout: NodeJS.Timeout | null = null;
      
      connection.on(LiveTranscriptionEvents.Open, () => {
        console.log(`[Deepgram Live] Connected, sending ${audioBuffer.length} bytes`);
        
        // Send all audio data at once
        connection.send(audioBuffer);
        
        // Wait for Deepgram to process, then close connection
        // The 2.5 second timeout worked in earlier tests
        closeTimeout = setTimeout(() => {
          console.log(`[Deepgram Live] Closing after timeout (transcript: "${finalTranscript}")`);
          connection.requestClose();
        }, 2500);
      });
      
      connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        const alternative = data.channel?.alternatives?.[0];
        if (!alternative) return;
        
        const transcript = alternative.transcript || '';
        const confidence = alternative.confidence || 0;
        const words = alternative.words || [];
        
        hasReceivedAnyTranscript = true;
        
        if (data.is_final && transcript.length > 0) {
          finalTranscript = transcript;
          finalConfidence = confidence;
          finalWords = words.map((w: any) => ({
            word: w.word || '',
            start: w.start || 0,
            end: w.end || 0,
            confidence: w.confidence || 0,
          }));
          
          console.log(`[Deepgram Live] Final: "${transcript}" (${(confidence * 100).toFixed(0)}%)`);
          
          // Got final result - close early instead of waiting for timeout
          if (closeTimeout) {
            clearTimeout(closeTimeout);
            closeTimeout = null;
          }
          // Small delay to ensure all data is flushed
          setTimeout(() => connection.requestClose(), 50);
        } else if (transcript.length > 0) {
          console.log(`[Deepgram Live] Interim: "${transcript}"`);
        }
      });
      
      connection.on(LiveTranscriptionEvents.Close, () => {
        clearTimeout(timeout);
        if (closeTimeout) clearTimeout(closeTimeout);
        const durationMs = Date.now() - startTime;
        
        console.log(`[Deepgram Live] Closed after ${durationMs}ms`);
        
        resolve({
          transcript: finalTranscript,
          confidence: finalConfidence,
          words: finalWords,
          durationMs,
        });
      });
      
      connection.on(LiveTranscriptionEvents.Error, (error) => {
        clearTimeout(timeout);
        console.error('[Deepgram Live] Error:', error);
        reject(error);
      });
      
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}

/**
 * Get Deepgram language code from our language names
 */
export function getDeepgramLanguageCode(language: string): string {
  const languageMap: Record<string, string> = {
    'spanish': 'es',
    'french': 'fr',
    'german': 'de',
    'italian': 'it',
    'portuguese': 'pt',
    'japanese': 'ja',
    'korean': 'ko',
    'chinese': 'zh',
    'english': 'en',
  };
  return languageMap[language.toLowerCase()] || 'en';
}
