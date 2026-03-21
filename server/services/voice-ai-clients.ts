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
 * Gemini client for vocabulary extraction (using Replit AI integrations)
 * IMPORTANT: Must include apiVersion: "" and baseUrl for Replit's AI proxy to work correctly
 */
const gemini = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '',
  httpOptions: {
    apiVersion: "",  // Required: removes /v1beta path prefix for Replit proxy
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || '',
  }
});

export { deepgram, gemini };
