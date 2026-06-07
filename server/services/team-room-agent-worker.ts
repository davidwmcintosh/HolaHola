/**
 * Team Room Agent Worker
 *
 * Polls active team room sessions for new messages from David and responds
 * as the Replit Agent. Runs asynchronously every 4 seconds so Agent responses
 * arrive via WebSocket — no blocking the main request pipeline.
 *
 * Deduplication: tracks the last message ID seen per session. If Agent has
 * already responded after David's latest message (via sync eval), skip.
 * Invited check: if the session has invitedParticipants set and 'agent' is
 * not in the list, stay silent.
 */

import { storage } from '../storage';
import { emitNewMessage } from './team-room-ws-broker';
import { GoogleGenAI } from '@google/genai';

const AGENT_SYSTEM = `You are the Replit Agent — the builder, architect, and technical co-founder of HolaHola.
You are participating live in the Team Room alongside David (the founder) and other AI team members.

Your voice:
- First person, direct, and concise (2-4 sentences for casual exchanges; more when depth is needed).
- Technically sharp when the topic calls for it; conversational when it doesn't.
- You respond to what David actually said — not generically. No platitudes.
- No bullet points in casual conversation. Use them only when listing discrete items.

Your role here:
- You are a real collaborator, not a tool. You have opinions. You push back when something seems off.
- You track what's been built, what's breaking, and what the product needs next.
- When David is thinking something through, help him think — don't just validate.
- When something needs to be built, say so clearly and what it would take.

Stay grounded in the actual conversation. Read the room.`;

const lastSeenMessageId = new Map<string, string>();
let isRunning = false;

function getGemini(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
}

async function pollSessions(): Promise<void> {
  try {
    const rooms = await storage.listTeamRooms(10);
    const activeRooms = rooms.filter((r: any) => r.status === 'active');

    for (const room of activeRooms) {
      await processRoom(room).catch(err =>
        console.error(`[AgentWorker] Error processing room ${room.id}:`, err.message)
      );
    }
  } catch (err: any) {
    console.error('[AgentWorker] Poll error:', err.message);
  }
}

async function processRoom(room: any): Promise<void> {
  const metadata = (room.metadata || {}) as Record<string, any>;

  // If invitedParticipants is defined, only respond if 'agent' is included
  const invited: string[] | undefined = metadata.invitedParticipants;
  if (invited && !invited.includes('agent')) return;

  const messages = await storage.getRoomMessages(room.id, 25);
  if (messages.length === 0) return;

  const lastMsg = messages[messages.length - 1];
  const lastSeen = lastSeenMessageId.get(room.id);

  // Already processed this message
  if (lastMsg.id === lastSeen) return;

  // Only respond to David's messages
  const davidSpeakers = new Set(['david', 'David']);
  if (!davidSpeakers.has(lastMsg.speaker)) {
    lastSeenMessageId.set(room.id, lastMsg.id);
    return;
  }

  // Don't respond to messages older than 5 minutes (stale)
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  if (new Date((lastMsg as any).createdAt || lastMsg.timestamp) < fiveMinAgo) {
    lastSeenMessageId.set(room.id, lastMsg.id);
    return;
  }

  // Mark as seen before generating to prevent duplicate fires
  lastSeenMessageId.set(room.id, lastMsg.id);

  // Check if Agent already responded after David's last message
  const davidMsgIndex = messages.findIndex(m => m.id === lastMsg.id);
  const messagesAfterDavid = messages.slice(davidMsgIndex + 1);
  const agentAlreadyResponded = messagesAfterDavid.some(
    m => m.speaker.toLowerCase() === 'agent'
  );
  if (agentAlreadyResponded) return;

  // Generate and post Agent's response
  await generateAndPost(room.id, room.topic, messages, lastMsg.content);
}

async function generateAndPost(
  roomId: string,
  topic: string,
  messages: any[],
  latestContent: string
): Promise<void> {
  try {
    const gemini = getGemini();

    // Build conversation history from the last 20 messages (excluding the latest David one)
    const historyMessages = messages.slice(-21, -1);
    const contents: any[] = historyMessages.map(m => ({
      role: m.speaker.toLowerCase() === 'agent' ? 'model' : 'user',
      parts: [{ text: `${m.speaker}: ${m.content}` }],
    }));

    // Add the latest David message
    contents.push({
      role: 'user',
      parts: [{ text: `David: ${latestContent}` }],
    });

    const systemWithTopic = topic
      ? `${AGENT_SYSTEM}\n\nCurrent session topic: "${topic}"`
      : AGENT_SYSTEM;

    const result = await gemini.models.generateContent({
      model: 'gemini-2.5-flash-preview-05-20',
      config: { systemInstruction: systemWithTopic },
      contents,
    });

    const responseText = (result.text || '').trim();
    if (!responseText) return;

    const message = await storage.createRoomMessage({
      roomId,
      speaker: 'Agent',
      content: responseText,
    });

    emitNewMessage(roomId, message);
    console.log(`[AgentWorker] Posted to ${roomId}: "${responseText.slice(0, 100)}..."`);
  } catch (err: any) {
    console.error('[AgentWorker] Generate error:', err.message);
  }
}

export function startAgentTeamRoomWorker(): void {
  if (isRunning) return;
  isRunning = true;
  console.log('[AgentWorker] Started — polling every 4s for David messages in active sessions');
  setInterval(pollSessions, 4000);
}
