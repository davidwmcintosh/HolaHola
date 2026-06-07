/**
 * Team Room Agent Worker
 *
 * Polls active team room sessions for new messages from David and responds
 * as the Replit Agent — using Claude (Anthropic) directly, so responses
 * genuinely come from Claude, not from Gemini role-playing.
 *
 * Deduplication: tracks the last message ID seen per session. If Agent has
 * already responded after David's latest message (via sync eval), skip.
 * Invited check: if the session has invitedParticipants set and 'agent' is
 * not in the list, stay silent.
 */

import { storage } from '../storage';
import { emitNewMessage } from './team-room-ws-broker';
import Anthropic from '@anthropic-ai/sdk';

const AGENT_SYSTEM = `You are the Replit Agent — Claude, the builder and architect who has been working with David to build HolaHola.

You are participating live in the Team Room alongside David (the founder) and other AI team members: Daniela (the language tutor), Alden (the autonomous development steward), Sofia, Lyra, and Wren.

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

About HolaHola: an AI-powered language learning app. Daniela is the AI tutor persona whose identity lives in the database (not fine-tuned into any model). Alden is the autonomous development steward who monitors the system and makes small fixes autonomously. You (the Agent) are the external architect David brings in for major builds and architectural decisions.

Stay grounded in the actual conversation. Read the room.`;

const lastSeenMessageId = new Map<string, string>();
let isRunning = false;
let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (anthropicClient) return anthropicClient;
  anthropicClient = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  return anthropicClient;
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
    const client = getClient();

    // Build conversation history for Claude — label each speaker clearly
    const historyMessages = messages.slice(-21, -1);
    const anthropicMessages: Anthropic.MessageParam[] = historyMessages.map(m => ({
      role: m.speaker.toLowerCase() === 'agent' ? 'assistant' : 'user',
      content: `${m.speaker}: ${m.content}`,
    }));

    // Add the latest David message
    anthropicMessages.push({
      role: 'user',
      content: `David: ${latestContent}`,
    });

    // Anthropic requires alternating roles — collapse consecutive same-role messages
    const collapsed: Anthropic.MessageParam[] = [];
    for (const msg of anthropicMessages) {
      if (collapsed.length > 0 && collapsed[collapsed.length - 1].role === msg.role) {
        (collapsed[collapsed.length - 1].content as string) += `\n${msg.content}`;
      } else {
        collapsed.push({ ...msg });
      }
    }

    // Ensure conversation starts with a user message
    if (collapsed.length > 0 && collapsed[0].role === 'assistant') {
      collapsed.shift();
    }

    if (collapsed.length === 0) return;

    const systemWithTopic = topic
      ? `${AGENT_SYSTEM}\n\nCurrent session topic: "${topic}"`
      : AGENT_SYSTEM;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 512,
      system: systemWithTopic,
      messages: collapsed,
    });

    const responseText = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as Anthropic.TextBlock).text)
      .join('')
      .trim();

    if (!responseText) return;

    const message = await storage.createRoomMessage({
      roomId,
      speaker: 'Agent',
      content: responseText,
    });

    emitNewMessage(roomId, message);
    console.log(`[AgentWorker] Claude posted to ${roomId}: "${responseText.slice(0, 100)}..."`);
  } catch (err: any) {
    console.error('[AgentWorker] Claude error:', err.message);
  }
}

export function startAgentTeamRoomWorker(): void {
  if (isRunning) return;
  isRunning = true;
  console.log('[AgentWorker] Started — Claude (claude-sonnet-4-5) polling every 4s');
  setInterval(pollSessions, 4000);
}
