import { createClient } from "@deepgram/sdk";
import { GoogleGenAI } from "@google/genai";

/**
 * Deepgram client (STT) - lazy initialization to allow server start without API key
 */
let _deepgramClient: ReturnType<typeof createClient> | null = null;
function getDeepgramClient(): ReturnType<typeof createClient> {
  if (!_deepgramClient) {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPGRAM_API_KEY is required for voice features');
    }
    _deepgramClient = createClient(apiKey);
  }
  return _deepgramClient;
}
const deepgram = { get client() { return getDeepgramClient(); } };

/**
 * Gemini client for vocabulary extraction (direct Google API via GEMINI_API_KEY)
 */
const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || ''
});

export { deepgram, gemini };
