import { apiRequest } from './queryClient';

/**
 * REST-based Voice API helpers (replaces unreliable WebSocket Realtime API)
 * Architecture: Record audio → Whisper STT → GPT text → TTS → Playback
 */

/**
 * Upload audio and get transcription from Whisper
 */
export async function transcribeAudio(audioBlob: Blob, language?: string): Promise<string> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  if (language) {
    formData.append('language', language);
  }

  const response = await fetch('/api/voice/transcribe', {
    method: 'POST',
    body: formData,
    credentials: 'include', // Include auth cookies
  });

  if (!response.ok) {
    // Try to parse JSON error, but handle HTML responses gracefully
    let errorMessage = `Failed to transcribe audio (HTTP ${response.status})`;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } else {
        // HTML error page or other non-JSON response
        const textResponse = await response.text();
        console.error('[Whisper] Non-JSON error response:', textResponse.substring(0, 200));
        errorMessage = `Transcription failed. Please try again or switch to text mode.`;
      }
    } catch (e) {
      console.error('[Whisper] Failed to parse error response:', e);
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return data.text;
}

/**
 * Synthesize speech from text using TTS
 * Returns an audio blob (MP3)
 * language: Target language for pronunciation (e.g., 'spanish', 'french')
 */
export async function synthesizeSpeech(text: string, language?: string, voice?: string): Promise<Blob> {
  // Use nova voice for better multilingual pronunciation (default to nova if language specified)
  const selectedVoice = voice || (language ? 'nova' : 'alloy');
  
  const response = await fetch('/api/voice/synthesize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, voice: selectedVoice, language }),
    credentials: 'include', // Include auth cookies
  });

  if (!response.ok) {
    // Try to parse JSON error, but handle HTML responses gracefully
    let errorMessage = `Failed to synthesize speech (HTTP ${response.status})`;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } else {
        // HTML error page or other non-JSON response
        const textResponse = await response.text();
        console.error('[TTS] Non-JSON error response:', textResponse.substring(0, 200));
        errorMessage = `Speech synthesis failed. Please try again or switch to text mode.`;
      }
    } catch (e) {
      console.error('[TTS] Failed to parse error response:', e);
    }
    throw new Error(errorMessage);
  }

  // Response is MP3 audio blob
  return await response.blob();
}

/**
 * Full voice chat cycle: record → transcribe → chat → synthesize → play
 */
export interface VoiceChatResult {
  userTranscript: string;
  aiResponse: string;
  audioBlob: Blob;
  conversationUpdated?: {
    id: string;
    language?: string;
    isOnboarding?: boolean;
    userName?: string;
  };
}

export async function processVoiceMessage(
  audioBlob: Blob,
  conversationId: string,
  language?: string
): Promise<VoiceChatResult> {
  // Step 1: Transcribe audio
  const userTranscript = await transcribeAudio(audioBlob, language);

  // Step 2: Get AI response using the same endpoint as text chat
  // Use isVoiceMode flag to trigger fast response path (text-only, no vocab/images)
  const chatResponse = await fetch(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role: 'user',
      content: userTranscript,
      isVoiceMode: true, // Trigger fast text-only response for voice chat
    }),
    credentials: 'include',
  });

  // Check content type BEFORE parsing (even for 200 OK responses)
  const contentType = chatResponse.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    const textResponse = await chatResponse.text();
    console.error('[Chat] Non-JSON response:', textResponse.substring(0, 500));
    throw new Error(`Chat endpoint returned ${contentType || 'non-JSON'} instead of JSON. Check server logs.`);
  }

  if (!chatResponse.ok) {
    // Try to parse JSON error
    let errorMessage = `Chat failed (HTTP ${chatResponse.status})`;
    try {
      const errorData = await chatResponse.json();
      errorMessage = errorData.error || errorMessage;
    } catch (e) {
      console.error('[Chat] Failed to parse error response:', e);
    }
    throw new Error(errorMessage);
  }

  const chatData = await chatResponse.json();
  
  // Extract AI message content from server response
  if (!chatData?.aiMessage?.content) {
    throw new Error('Invalid chat response: missing AI message content');
  }
  
  const aiResponse = chatData.aiMessage.content;
  
  if (!aiResponse || aiResponse.trim() === '') {
    throw new Error('Empty AI response received');
  }

  // Step 3: Determine correct language for TTS
  // If conversation language changed, use the new language for TTS
  const ttsLanguage = chatData.conversationUpdated?.language || language;
  
  // Use FULL content (English + target language) with target language voice
  // This gives English explanations an authentic accent for immersion
  console.log('[VOICE TTS] Synthesizing full content with', ttsLanguage, 'voice');
  
  const ttsAudioBlob = await synthesizeSpeech(aiResponse, ttsLanguage);

  return {
    userTranscript,
    aiResponse,
    audioBlob: ttsAudioBlob,
    conversationUpdated: chatData.conversationUpdated,
  };
}
