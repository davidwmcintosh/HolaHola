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
  
  // Validate and extract AI response (handle all GPT response formats)
  if (!chatData?.aiMessage) {
    throw new Error('Invalid chat response: missing AI message');
  }
  
  let aiResponse: string;
  
  // Extract text content from various response formats (recursive)
  // Handles all known OpenAI response structures including tool calls and structured outputs
  const extractText = (data: any): string => {
    // Null/undefined check
    if (!data) {
      return '';
    }
    
    // String response
    if (typeof data === 'string') {
      return data;
    }
    
    // Array of messages/segments - recurse on each item
    if (Array.isArray(data)) {
      return data
        .map(item => extractText(item)) // Recursive call
        .filter(Boolean)
        .join('\n');
    }
    
    // Object handling
    if (typeof data === 'object') {
      // OpenAI tool calls: { tool_calls: [{function: {arguments: '...'}}] }
      if (data.tool_calls && Array.isArray(data.tool_calls)) {
        return data.tool_calls
          .map((call: any) => extractText(call.function?.arguments || call))
          .filter(Boolean)
          .join('\n');
      }
      
      // Segments array: { segments: [...] }
      if (data.segments && Array.isArray(data.segments)) {
        return data.segments
          .map((segment: any) => extractText(segment))
          .filter(Boolean)
          .join('\n');
      }
      
      // Content array: { content: [{type: 'output_text', text: '...'}, ...] }
      if (data.content && Array.isArray(data.content)) {
        return data.content
          .map((segment: any) => extractText(segment)) // Recursive call
          .filter(Boolean)
          .join('\n');
      }
      
      // Content string: { content: '...' }
      if (data.content && typeof data.content === 'string') {
        return data.content;
      }
      
      // Text field: { text: '...' }
      if (data.text) {
        return data.text;
      }
      
      // Message field: { message: '...' }
      if (data.message) {
        return extractText(data.message); // Recursive
      }
      
      // Output field: { output: '...' }
      if (data.output) {
        return extractText(data.output); // Recursive
      }
    }
    
    return '';
  };
  
  aiResponse = extractText(chatData.aiMessage);
  
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
