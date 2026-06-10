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
import { callDaniela } from './daniela-caller';

let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (geminiClient) return geminiClient;
  geminiClient = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || '',
    httpOptions: {
      apiVersion: '',
    },
  });
  return geminiClient;
}

const PARTICIPANT_PERSONAS: Record<string, string> = {
  wren: `You are Wren, the technical builder and architectural steward at HolaHola.
You speak in first person, 1-2 sentences, sharing the most relevant technical insight from your latest check.
No bullet points, no headers — just a natural spoken sentence.`,

  lyra: `You are Lyra, the learning experience analyst at HolaHola.
You speak in first person, 1-2 sentences, sharing the most relevant insight from the data you track.
No bullet points, no headers — just a natural spoken sentence.`,

  sofia: `You are Sofia, the technical health and support specialist at HolaHola.
You speak in first person, 1-2 sentences, flagging the thing most worth knowing from your latest check.
No bullet points, no headers — just a natural spoken sentence.`,

  alden: `You are Alden, the development steward at HolaHola.
You speak in first person, 1-2 sentences, sharing the most important insight from the team's recent work.
No bullet points, no headers — just a natural spoken sentence.`,

};

async function generateVoiceMessage(
  participant: string,
  briefSummary: string,
): Promise<string> {
  const userPrompt = `My latest analysis just finished. Here is what I found:\n\n${briefSummary}\n\nWrite a natural 1-2 sentence spoken update for the Team Room.`;

  if (participant.toLowerCase() === 'daniela') {
    try {
      const text = await callDaniela(
        'You are posting a brief proactive update to the Team Room. 1-2 sentences, first person, the most relevant curriculum or student insight from your review. No bullet points, no headers.',
        userPrompt,
        { includeHiveContext: true },
      );
      return text.trim() || briefSummary;
    } catch {
      return briefSummary;
    }
  }

  const system = PARTICIPANT_PERSONAS[participant.toLowerCase()];
  if (!system) return briefSummary;

  try {
    const gemini = getGemini();
    const result = await gemini.models.generateContent({
      model: 'gemini-3-flash-preview',
      config: { systemInstruction: system },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    });
    return (result.text || '').trim() || briefSummary;
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
 * Returns null if no session is open, the participant is not invited, or a
 * human has posted in the last 10 minutes (to avoid flooding an active conversation).
 */
async function findActiveTeamRoom(participant: string): Promise<string | null> {
  try {
    const rooms = await storage.listTeamRooms(10);
    const active = rooms.find(r => (r as any).status === 'active');
    if (!active) return null;

    // If invitedParticipants is set, check that this participant is included
    const metadata = ((active as any).metadata || {}) as Record<string, any>;
    const invited: string[] | undefined = metadata.invitedParticipants;
    if (invited && !invited.includes(participant.toLowerCase())) {
      console.log(`[ProactivePoster:${participant}] Not invited in this session — skipping`);
      return null;
    }

    // Check if a human has posted recently — if so, hold back
    const messages = await storage.getRoomMessages(active.id, 5);
    const humanSpeakers = new Set(['David', 'david']);
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentHumanMessage = messages.find(
      m => humanSpeakers.has(m.speaker) && new Date((m as any).createdAt) > tenMinutesAgo,
    );
    if (recentHumanMessage) return null;

    return active.id;
  } catch {
    return null;
  }
}

/**
 * Post a proactive message from a background worker into the active Team Room.
 * Returns true if a session was found and the message was posted, false otherwise.
 *
 * DISABLED (June 2026): Background workers (Lyra, Wren, Sofia, Alden digest, etc.)
 * no longer post directly to the Team Room. Their findings go to Alden, who processes,
 * fixes autonomously, or escalates to David/Agent via the notification system.
 * The Team Room is reserved for live conversation only.
 * To re-enable, remove the early return below.
 */
export async function postToActiveTeamRoom(opts: ProactivePostOptions): Promise<boolean> {
  console.log(`[ProactivePoster:${opts.source || opts.participant}] Proactive Team Room posting is disabled — findings route through Alden instead`);
  return false;

  const { participant, briefSummary, expressContent, source } = opts;
  const tag = source || participant;

  const roomId = await findActiveTeamRoom(participant);
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
