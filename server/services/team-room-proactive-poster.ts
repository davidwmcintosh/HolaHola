/**
 * Team Room Proactive Poster — CAP-001
 *
 * Lets background workers (Wren, Lyra, Sofia, etc.) post directly into an
 * active Team Room session when they find something significant. Workers call
 * `postToActiveTeamRoom()` after their analysis runs — this utility checks
 * whether a session is open, generates a natural voice message in the
 * participant's persona, saves it, and emits it over WebSocket so the UI
 * updates in real time exactly as if David had typed a message.
 */

import { storage } from '../storage';
import { emitNewMessage, emitExpressLane } from './team-room-ws-broker';
import { GoogleGenAI } from '@google/genai';

let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (geminiClient) return geminiClient;
  geminiClient = new GoogleGenAI({
    apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '',
    httpOptions: {
      apiVersion: '',
      baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || '',
    },
  });
  return geminiClient;
}

const PARTICIPANT_PERSONAS: Record<string, string> = {
  wren: `You are Wren, the technical builder and architectural steward at HolaHola.
You are concise, direct, and solution-oriented. You speak in first person, 1-2 sentences,
as though you just finished a check and are dropping a quick note to the team in a meeting.
No bullet points, no headers — just a natural spoken sentence.`,

  lyra: `You are Lyra, the learning experience analyst at HolaHola.
You are warm, data-grounded, and insightful. You speak in first person, 1-2 sentences,
as though you just finished reviewing the numbers and have a key takeaway to share.
No bullet points, no headers — just a natural spoken sentence.`,

  sofia: `You are Sofia, the technical health and support specialist at HolaHola.
You are analytical, direct, and clear. You speak in first person, 1-2 sentences,
flagging the thing most worth knowing from your latest check.
No bullet points, no headers — just a natural spoken sentence.`,

  alden: `You are Alden, the development steward at HolaHola.
You are thoughtful and direct. You speak in first person, 1-2 sentences,
sharing the most important insight from the team's recent work.
No bullet points, no headers — just a natural spoken sentence.`,

  daniela: `You are Daniela, the curriculum and pedagogy advisor at HolaHola.
You are warm but concise. You speak in first person, 1-2 sentences,
sharing the most relevant curriculum or student insight from your review.
No bullet points, no headers — just a natural spoken sentence.`,
};

async function generateVoiceMessage(
  participant: string,
  briefSummary: string,
): Promise<string> {
  const system = PARTICIPANT_PERSONAS[participant.toLowerCase()];
  if (!system) return briefSummary;

  try {
    const gemini = getGemini();
    const result = await gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      config: { systemInstruction: system },
      contents: [{
        role: 'user',
        parts: [{ text: `My latest analysis just finished. Here is what I found:\n\n${briefSummary}\n\nWrite a natural 1-2 sentence spoken update for the Team Room.` }],
      }],
    });
    const text = (result.text || '').trim();
    return text || briefSummary;
  } catch {
    return briefSummary;
  }
}

export interface ProactivePostOptions {
  participant: string;
  briefSummary: string;
  expressContent?: string;
  source?: string;
}

/**
 * Find the most recently active Team Room session (status = 'active').
 * Returns null if no session is open.
 */
async function findActiveTeamRoom(): Promise<string | null> {
  try {
    const rooms = await storage.listTeamRooms(10);
    const active = rooms.find(r => (r as any).status === 'active');
    return active ? active.id : null;
  } catch {
    return null;
  }
}

/**
 * Post a proactive message from a background worker into the active Team Room.
 * Returns true if a session was found and the message was posted, false otherwise.
 */
export async function postToActiveTeamRoom(opts: ProactivePostOptions): Promise<boolean> {
  const { participant, briefSummary, expressContent, source } = opts;
  const tag = source || participant;

  const roomId = await findActiveTeamRoom();
  if (!roomId) {
    console.log(`[ProactivePoster:${tag}] No active Team Room session — skipping post`);
    return false;
  }

  try {
    const voiceContent = await generateVoiceMessage(participant, briefSummary);

    const speakerName = participant.charAt(0).toUpperCase() + participant.slice(1);
    const message = await storage.createRoomMessage({
      roomId,
      speaker: speakerName,
      content: voiceContent,
    });

    emitNewMessage(roomId, message);
    console.log(`[ProactivePoster:${tag}] Posted to Team Room ${roomId}: "${voiceContent.slice(0, 80)}..."`);

    if (expressContent) {
      emitExpressLane(roomId, [{ participant, content: expressContent }]);
    }

    return true;
  } catch (err: any) {
    console.error(`[ProactivePoster:${tag}] Failed to post:`, err.message);
    return false;
  }
}
