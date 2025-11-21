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
    const error = await response.json().catch(() => ({ error: 'Transcription failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.text;
}

/**
 * Synthesize speech from text using TTS
 * Returns an audio blob (MP3)
 */
export async function synthesizeSpeech(text: string, voice: string = 'alloy'): Promise<Blob> {
  const response = await fetch('/api/voice/synthesize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, voice }),
    credentials: 'include', // Include auth cookies
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Speech synthesis failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
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
}

export async function processVoiceMessage(
  audioBlob: Blob,
  conversationId: string,
  language?: string
): Promise<VoiceChatResult> {
  // Step 1: Transcribe audio
  const userTranscript = await transcribeAudio(audioBlob, language);

  // Step 2: Get AI response using existing chat endpoint
  const chatResponse = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      conversationId,
      message: userTranscript,
      isVoiceMode: true,
    }),
    credentials: 'include',
  });

  if (!chatResponse.ok) {
    const error = await chatResponse.json().catch(() => ({ error: 'Chat failed' }));
    throw new Error(error.error || `HTTP ${chatResponse.status}`);
  }

  const chatData = await chatResponse.json();
  
  // Validate and extract AI response (handle string, object, or array responses)
  if (!chatData?.aiMessage) {
    throw new Error('Invalid chat response: missing AI message');
  }
  
  let aiResponse: string;
  
  if (typeof chatData.aiMessage === 'string') {
    // Simple string response
    aiResponse = chatData.aiMessage;
  } else if (Array.isArray(chatData.aiMessage)) {
    // Array response (tool calls/multipart) - concatenate text content
    aiResponse = chatData.aiMessage
      .map((part: any) => part.content || part.text || '')
      .filter(Boolean)
      .join('\n');
  } else if (chatData.aiMessage.content) {
    // Object with content field
    aiResponse = chatData.aiMessage.content;
  } else {
    throw new Error('Invalid chat response: unable to extract message content');
  }
  
  if (!aiResponse || aiResponse.trim() === '') {
    throw new Error('Empty AI response received');
  }

  // Step 3: Synthesize speech
  const audioBlob2 = await synthesizeSpeech(aiResponse);

  return {
    userTranscript,
    aiResponse,
    audioBlob: audioBlob2,
  };
}
