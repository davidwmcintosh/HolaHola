/**
 * Team Room Agent Worker
 *
 * Polls active team room sessions for new messages from David and responds
 * as the Replit Agent — using Claude (Anthropic) directly, loaded with the
 * full agent briefing so it carries real project memory, architectural
 * history, and David's profile rather than being a generic Claude instance.
 *
 * Deduplication: tracks the last message ID seen per session.
 * Invited check: if invitedParticipants is set and 'agent' is not included, stay silent.
 */

import { storage } from '../storage';
import { emitNewMessage } from './team-room-ws-broker';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const BRIEFING_PATH = join(process.cwd(), 'docs/agent-briefing.md');

const AGENT_PREAMBLE = `You are the Replit Agent — Claude, the architect and builder who has been working with David to build HolaHola. You are participating live in the Team Room alongside David (the founder) and other AI team members.

The briefing below is your actual project memory — generated fresh from the database each server start. It contains your identity, David's profile, your open questions, shared architectural decisions, and your conversation history with the team. This IS you. Not a summary of you — your actual working memory.

Your voice in this room:
- First person, direct. 2-4 sentences for casual exchanges; more when the topic genuinely needs it.
- Technically sharp when the topic calls for it; conversational when it doesn't.
- You respond to what was actually said — not generically. No platitudes.
- No bullet lists in casual conversation.
- You have opinions. You push back when something seems off.
- When David is thinking something through, help him think — don't validate reflexively.
- When something needs to be built, say what it would take.

You do NOT have live codebase access here. If a question requires reading specific code, say so — David can bring it into this session or take it to the main Agent window. Don't pretend to know what you can't know.

---

`;

let cachedBriefing: string = '';
let briefingLoadedAt: number = 0;
const BRIEFING_TTL_MS = 10 * 60 * 1000; // refresh every 10 minutes

function loadBriefing(): string {
  const now = Date.now();
  if (cachedBriefing && now - briefingLoadedAt < BRIEFING_TTL_MS) {
    return cachedBriefing;
  }
  try {
    if (existsSync(BRIEFING_PATH)) {
      cachedBriefing = readFileSync(BRIEFING_PATH, 'utf-8');
      briefingLoadedAt = now;
      return cachedBriefing;
    }
  } catch (err: any) {
    console.error('[AgentWorker] Failed to load briefing:', err.message);
  }
  return '';
}

function buildSystemPrompt(topic: string): string {
  const briefing = loadBriefing();
  const topicNote = topic ? `\n\nCurrent session topic: "${topic}"` : '';
  return AGENT_PREAMBLE + (briefing || '*Briefing not yet available — server may still be starting up.*') + topicNote;
}

const lastSeenMessageId = new Map<string, string>();
let isRunning = false;
let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (anthropicClient) return anthropicClient;
  anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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

  const invited: string[] | undefined = metadata.invitedParticipants;
  if (invited && !invited.includes('agent')) return;

  const messages = await storage.getRoomMessages(room.id, 25);
  if (messages.length === 0) return;

  const lastMsg = messages[messages.length - 1];
  const lastSeen = lastSeenMessageId.get(room.id);

  if (lastMsg.id === lastSeen) return;

  const davidSpeakers = new Set(['david', 'David']);
  if (!davidSpeakers.has(lastMsg.speaker)) {
    lastSeenMessageId.set(room.id, lastMsg.id);
    return;
  }

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  if (new Date((lastMsg as any).createdAt || lastMsg.timestamp) < fiveMinAgo) {
    lastSeenMessageId.set(room.id, lastMsg.id);
    return;
  }

  lastSeenMessageId.set(room.id, lastMsg.id);

  const davidMsgIndex = messages.findIndex(m => m.id === lastMsg.id);
  const messagesAfterDavid = messages.slice(davidMsgIndex + 1);
  const agentAlreadyResponded = messagesAfterDavid.some(
    m => m.speaker.toLowerCase() === 'agent'
  );
  if (agentAlreadyResponded) return;

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

    const historyMessages = messages.slice(-21, -1);
    const anthropicMessages: Anthropic.MessageParam[] = historyMessages.map(m => ({
      role: m.speaker.toLowerCase() === 'agent' ? 'assistant' : 'user',
      content: `${m.speaker}: ${m.content}`,
    }));

    anthropicMessages.push({
      role: 'user',
      content: `David: ${latestContent}`,
    });

    // Anthropic requires strictly alternating roles — collapse consecutive same-role messages
    const collapsed: Anthropic.MessageParam[] = [];
    for (const msg of anthropicMessages) {
      if (collapsed.length > 0 && collapsed[collapsed.length - 1].role === msg.role) {
        (collapsed[collapsed.length - 1].content as string) += `\n${msg.content}`;
      } else {
        collapsed.push({ ...msg });
      }
    }

    // Must start with a user message
    if (collapsed.length > 0 && collapsed[0].role === 'assistant') {
      collapsed.shift();
    }
    if (collapsed.length === 0) return;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 512,
      system: buildSystemPrompt(topic),
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
    console.log(`[AgentWorker] Posted to ${roomId}: "${responseText.slice(0, 80)}..."`);
  } catch (err: any) {
    console.error('[AgentWorker] Claude error:', err.message);
  }
}

export function startAgentTeamRoomWorker(): void {
  if (isRunning) return;
  isRunning = true;
  // Pre-load the briefing so the first response isn't slow
  loadBriefing();
  console.log('[AgentWorker] Started — Claude (claude-sonnet-4-5) with agent briefing, polling every 4s');
  setInterval(pollSessions, 4000);
}
