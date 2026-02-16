/**
 * Sync Channel Voice Service
 * 
 * Handles voice input/output for the founder collaboration sync channel.
 * Simpler than streaming-voice-orchestrator - focused on persistence.
 * 
 * Flow:
 * 1. Receive audio chunks from client via Socket.io
 * 2. Stream to Deepgram for transcription
 * 3. Send transcript to Daniela (via Gemini)
 * 4. Generate TTS audio response via Cartesia
 * 5. Stream audio back and persist transcript
 */

import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import { getCartesiaStreamingService } from "./cartesia-streaming";
import { GoogleGenAI } from "@google/genai";
import { Socket } from "socket.io";
import { founderCollabService, type FounderMessageInput } from "./founder-collaboration-service";

// Deepgram config
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const DEEPGRAM_MODEL = "nova-3";

// Gemini config
const GEMINI_MODEL = "gemini-2.5-flash";

interface VoiceSession {
  sessionId: string;
  founderId: string;
  socket: Socket;
  deepgramConnection: any;
  isRecording: boolean;
  currentTranscript: string;
  audioChunks: Buffer[];
  startTime: number;
}

const activeSessions = new Map<string, VoiceSession>();

/**
 * Get Gemini client
 */
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required for Sync Channel voice");
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Start a voice session for a socket connection
 */
export async function startVoiceSession(
  socket: Socket,
  sessionId: string,
  founderId: string
): Promise<void> {
  const socketId = socket.id;
  
  if (activeSessions.has(socketId)) {
    console.log(`[SyncVoice] Session already exists for ${socketId}`);
    return;
  }
  
  const session: VoiceSession = {
    sessionId,
    founderId,
    socket,
    deepgramConnection: null,
    isRecording: false,
    currentTranscript: "",
    audioChunks: [],
    startTime: 0,
  };
  
  activeSessions.set(socketId, session);
  console.log(`[SyncVoice] Voice session started for socket ${socketId}`);
}

/**
 * Start recording (push-to-talk pressed)
 */
export async function startRecording(socketId: string): Promise<boolean> {
  const session = activeSessions.get(socketId);
  if (!session) {
    console.error(`[SyncVoice] No session for socket ${socketId}`);
    return false;
  }
  
  if (session.isRecording) {
    console.log(`[SyncVoice] Already recording for ${socketId}`);
    return true;
  }
  
  if (!DEEPGRAM_API_KEY) {
    console.error("[SyncVoice] DEEPGRAM_API_KEY not configured");
    session.socket.emit("voice_error", { code: "STT_ERROR", message: "Speech recognition not configured" });
    return false;
  }
  
  try {
    const deepgram = createClient(DEEPGRAM_API_KEY);
    
    const connection = deepgram.listen.live({
      model: DEEPGRAM_MODEL,
      language: "en-US", // Default to English for founder collab
      smart_format: true,
      punctuate: true,
      interim_results: true,
      endpointing: 300,
    });
    
    connection.on(LiveTranscriptionEvents.Open, () => {
      console.log(`[SyncVoice] Deepgram connection opened for ${socketId}`);
    });
    
    connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
      const transcript = data.channel?.alternatives?.[0]?.transcript || "";
      const isFinal = data.is_final;
      
      if (transcript) {
        if (isFinal) {
          session.currentTranscript += (session.currentTranscript ? " " : "") + transcript;
        }
        
        // Emit transcript update to client
        session.socket.emit("voice_transcript", {
          text: isFinal ? session.currentTranscript : session.currentTranscript + " " + transcript,
          isFinal,
        });
      }
    });
    
    connection.on(LiveTranscriptionEvents.Error, (err: any) => {
      console.error(`[SyncVoice] Deepgram error for ${socketId}:`, err);
      session.socket.emit("voice_error", { code: "STT_ERROR", message: "Transcription error" });
    });
    
    connection.on(LiveTranscriptionEvents.Close, () => {
      console.log(`[SyncVoice] Deepgram connection closed for ${socketId}`);
    });
    
    session.deepgramConnection = connection;
    session.isRecording = true;
    session.currentTranscript = "";
    session.audioChunks = [];
    session.startTime = Date.now();
    
    console.log(`[SyncVoice] Recording started for ${socketId}`);
    return true;
  } catch (error) {
    console.error(`[SyncVoice] Failed to start recording for ${socketId}:`, error);
    session.socket.emit("voice_error", { code: "STT_ERROR", message: "Failed to start recording" });
    return false;
  }
}

/**
 * Process audio chunk during recording
 */
export function processAudioChunk(socketId: string, audioData: Buffer): void {
  const session = activeSessions.get(socketId);
  if (!session || !session.isRecording || !session.deepgramConnection) {
    return;
  }
  
  try {
    session.deepgramConnection.send(audioData);
    session.audioChunks.push(audioData);
  } catch (error) {
    console.error(`[SyncVoice] Error sending audio chunk:`, error);
  }
}

/**
 * Stop recording and process the message
 */
export async function stopRecording(socketId: string): Promise<void> {
  const session = activeSessions.get(socketId);
  if (!session || !session.isRecording) {
    return;
  }
  
  const duration = Date.now() - session.startTime;
  
  // Close Deepgram connection
  if (session.deepgramConnection) {
    try {
      session.deepgramConnection.finish();
    } catch (e) {
      // Ignore close errors
    }
    session.deepgramConnection = null;
  }
  
  session.isRecording = false;
  
  // Wait a bit for final transcript
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const transcript = session.currentTranscript.trim();
  
  if (!transcript) {
    console.log(`[SyncVoice] No transcript captured for ${socketId}`);
    session.socket.emit("voice_complete", { success: false, message: "No speech detected" });
    return;
  }
  
  console.log(`[SyncVoice] Transcript for ${socketId}: "${transcript}"`);
  
  try {
    const founderMessage = await founderCollabService.addMessage(session.sessionId, {
      role: "founder",
      content: transcript,
      messageType: "voice",
      audioDuration: duration,
    });
    
    session.socket.emit("message", founderMessage);
    
    const { founderCollabWSBroker } = await import('./founder-collab-ws-broker');
    founderCollabWSBroker.emitToSession(session.sessionId, 'message', founderMessage);
    
    const { hiveConsciousnessService } = await import('./hive-consciousness-service');
    await hiveConsciousnessService.processMessage(session.sessionId, founderMessage);
    
  } catch (error) {
    console.error(`[SyncVoice] Error processing transcript:`, error);
    session.socket.emit("voice_error", { code: "PROCESS_ERROR", message: "Failed to process message" });
  }
}

/**
 * Generate Daniela's response via Gemini and TTS
 */
async function generateDanielaResponse(session: VoiceSession, userMessage: string): Promise<void> {
  try {
    session.socket.emit("voice_processing", { status: "thinking" });
    
    const gemini = getGeminiClient();
    
    // Get recent messages for context
    const recentMessages = await founderCollabService.getSessionMessages(session.sessionId, 20);
    
    // Build conversation context
    const conversationContext = recentMessages
      .filter(m => m.id !== recentMessages[recentMessages.length - 1]?.id) // Exclude the message we just added
      .map(m => `${m.role}: ${m.content}`)
      .join("\n");
    
    const systemPrompt = `You are Daniela, an AI language tutor and collaborator. You're in a voice conversation with the founder/developer of the HolaHola language learning app.

This is a VOICE conversation - keep responses conversational and concise (1-3 sentences typically).

You can discuss:
- Teaching strategies and pedagogy
- Feature ideas and improvements
- Language learning theory
- App development decisions
- Any topic the founder brings up

Be warm, helpful, and collaborative. You're partners building something great together.

Recent conversation:
${conversationContext || "(New conversation)"}`;

    const result = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "user", parts: [{ text: userMessage }] },
      ],
    });
    
    const responseText = result.text || "I'm not sure what to say to that.";
    
    console.log(`[SyncVoice] Daniela response: "${responseText.substring(0, 100)}..."`);
    
    // Add Daniela's message
    const danielaMessage = await founderCollabService.addMessage(session.sessionId, {
      role: "daniela",
      content: responseText,
      messageType: "voice",
    });
    
    // Emit message (will be broadcasted by broker)
    session.socket.emit("message", danielaMessage);
    
    // Generate TTS audio
    await generateAndStreamTTS(session, responseText, danielaMessage.id);
    
  } catch (error) {
    console.error(`[SyncVoice] Error generating response:`, error);
    session.socket.emit("voice_error", { code: "AI_ERROR", message: "Failed to generate response" });
  }
}

/**
 * Generate TTS audio and stream to client
 */
async function generateAndStreamTTS(session: VoiceSession, text: string, messageId: string): Promise<void> {
  try {
    session.socket.emit("voice_processing", { status: "speaking" });
    
    const cartesia = getCartesiaStreamingService();
    
    // Use Daniela's default voice
    const voiceId = "a0e99841-438c-4a64-b679-ae501e7d6091"; // Friendly Female
    
    // Use synthesizeSentence to generate audio
    const result = await cartesia.synthesizeSentence({
      text,
      voiceId,
      language: "en",
    });
    
    // Send audio as a single chunk (can be split for larger responses)
    const chunkSize = 16000; // ~1 second of audio at 16kHz
    const audioBuffer = result.audio;
    
    for (let i = 0; i < audioBuffer.length; i += chunkSize) {
      const chunk = audioBuffer.slice(i, Math.min(i + chunkSize, audioBuffer.length));
      const isLast = i + chunkSize >= audioBuffer.length;
      
      session.socket.emit("voice_audio", {
        messageId,
        chunk: chunk.toString("base64"),
        isLast,
        duration: isLast ? result.durationMs : undefined,
      });
    }
    
    session.socket.emit("voice_complete", { success: true, messageId });
    
  } catch (error) {
    console.error(`[SyncVoice] TTS generation error:`, error);
    session.socket.emit("voice_error", { code: "TTS_ERROR", message: "Failed to generate audio" });
  }
}

/**
 * Replay audio for a voice message (regenerate TTS from transcript)
 */
export async function replayVoiceMessage(socketId: string, messageId: string): Promise<void> {
  const session = activeSessions.get(socketId);
  if (!session) {
    return;
  }
  
  try {
    // Get the message content
    const messages = await founderCollabService.getSessionMessages(session.sessionId, 100);
    const message = messages.find(m => m.id === messageId);
    
    if (!message || message.messageType !== "voice") {
      session.socket.emit("voice_error", { code: "NOT_FOUND", message: "Message not found" });
      return;
    }
    
    // Regenerate TTS
    await generateAndStreamTTS(session, message.content, messageId);
    
  } catch (error) {
    console.error(`[SyncVoice] Replay error:`, error);
    session.socket.emit("voice_error", { code: "REPLAY_ERROR", message: "Failed to replay audio" });
  }
}

/**
 * End voice session
 */
export function endVoiceSession(socketId: string): void {
  const session = activeSessions.get(socketId);
  if (!session) {
    return;
  }
  
  if (session.deepgramConnection) {
    try {
      session.deepgramConnection.finish();
    } catch (e) {
      // Ignore
    }
  }
  
  activeSessions.delete(socketId);
  console.log(`[SyncVoice] Voice session ended for ${socketId}`);
}

/**
 * Check if a socket has an active voice session
 */
export function hasVoiceSession(socketId: string): boolean {
  return activeSessions.has(socketId);
}

/**
 * Check if currently recording
 */
export function isRecording(socketId: string): boolean {
  const session = activeSessions.get(socketId);
  return session?.isRecording || false;
}
