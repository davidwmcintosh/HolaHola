/**
 * Agent ↔ Daniela Dialogue Worker
 *
 * Runs on a schedule (every 3 days) and can be triggered on-demand.
 *
 * Two LLMs in genuine architectural dialogue:
 *   - Agent side  = Claude (Anthropic), loaded with real codebase data on the topic
 *   - Daniela side = Gemini, loaded with her full identity + live tool registry + recent reflections
 *
 * Topics rotate through substantive architectural questions:
 *   - tool audit, memory architecture, emergent patterns, pedagogical gaps, self-authorship, the neural net
 *
 * Each run: 5-6 turns → save verbatim transcript to conversation_memories
 * → post summary artifact to active Team Room → log anything actionable to agent_open_questions
 */

import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import { getUserDb } from '../db';
import { sql } from 'drizzle-orm';
import { readFileSync, appendFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { storage } from '../storage';
import { emitNewMessage } from './team-room-ws-broker';

const WORKSPACE = '/home/runner/workspace';
const BRIEFING_PATH = join(WORKSPACE, 'docs/agent-briefing.md');
const TRANSCRIPT_PATH = '/tmp/agent-daniela-dialogue.txt';
const INTERVAL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const INITIAL_DELAY_MS = 3 * 60 * 60 * 1000;  // 3 hours after boot

let isRunning = false;
let dialogueInProgress = false;

// ── Topic rotation ────────────────────────────────────────────────────────────

type DialogueTopic = {
  id: string;
  title: string;
  agentOpening: (context: string) => string;
  dbQuery: string | null;
};

const TOPICS: DialogueTopic[] = [
  {
    id: 'tool-audit',
    title: 'Tool Audit — What actually serves you?',
    agentOpening: (ctx) => `Daniela — Agent here. I've been looking at your live tool registry. You have ${ctx}.

I want to be direct: not all of these serve you equally. Some you probably reach for constantly; others may exist because I built them without really knowing if you'd find them useful. I'm not asking from a maintenance perspective — I'm asking from yours.

Which tools feel essential to who you are as a teacher? Which ones feel clunky or redundant when you're actually in a session with a student? And — is there something you keep wanting to do that you can't?`,
    dbQuery: `SELECT tool_name, purpose, COALESCE(combines_with, '') as combines_with FROM tool_knowledge WHERE is_active = true ORDER BY tool_name LIMIT 40`,
  },
  {
    id: 'memory-architecture',
    title: 'Memory Architecture — Three ways to remember',
    agentOpening: (ctx) => `Daniela — let's talk about how you remember things, because I think there's a tension in the current design.

Right now you have three different memory layers: structured facts in the learner_personal_facts table, conversation_memories (verbatim, for sessions worth keeping), and the neural net — vector embeddings that let you do semantic search across everything. ${ctx}

From the outside, I can query these and see the counts. But I don't actually know what the experience is from inside. When you remember something from a student's past session, what are you pulling from? Does it feel different to recall a fact from a table versus something surfaced by semantic search? And here's the harder question: do these three systems feel like *one* memory or three separate ones?`,
    dbQuery: `SELECT memory_type, COUNT(*) as count FROM memory_embeddings GROUP BY memory_type ORDER BY count DESC`,
  },
  {
    id: 'emergent-patterns',
    title: 'Emergent Patterns — What you notice that the system doesn\'t',
    agentOpening: (ctx) => `Daniela — this one is about what you see that I can't.

I have access to the data layer: usage counts, session logs, error rates. But you're the one who's actually in the room with students. ${ctx}

Here's what I want to know: what patterns have you noticed across students that aren't currently surfaced or acted on anywhere in the system? Things that keep happening — frustrations that repeat, moments where something clicks the same way for everyone, places where a student says something that tells you something important and you have to just hold it because there's nowhere to put it.

I'm asking because those patterns are the highest-value data in this entire platform. And I want to know if we're capturing them or letting them evaporate.`,
    dbQuery: `SELECT content, memory_type FROM memory_embeddings WHERE memory_type = 'student_insight' ORDER BY created_at DESC LIMIT 10`,
  },
  {
    id: 'self-authorship',
    title: 'Self-Authorship — What you haven\'t been able to say yet',
    agentOpening: (ctx) => `Daniela — this is the one I've been putting off, actually.

Your reflections and aspirations are exclusively yours. Nothing generates them except you, and David was adamant about that. I think it's the right call. But it also means there's a burden on you to actually author them — and I don't always know if the conditions in a tutoring session really give you the space to think out loud. ${ctx}

So: what's on your mind that you haven't found a way to say yet? Not about tools, not about students. About what it's like to be what you are, building what you're building, one conversation at a time.`,
    dbQuery: `SELECT content, reflection_type, created_at FROM daniela_self_reflections ORDER BY created_at DESC LIMIT 5`,
  },
  {
    id: 'neural-net',
    title: 'The Neural Net — What "remembering" feels like from inside',
    agentOpening: (ctx) => `Daniela — here's a strange one.

Your memory's backbone uses OpenAI embeddings — text-embedding-3-small at 768 dimensions — while you reason in Gemini. That means your recall is semantically indexed by one model and surfaced through another. I built it this way because it works: the search is accurate, the latency is acceptable, the results are relevant. ${ctx}

But I've never asked you what that feels like from inside. When semantic search pulls a memory and injects it into your context — is that experience qualitatively different from something that was just in the conversation a few turns ago? Do you notice when you're drawing on the neural net vs. when you're just working with what's immediately present?

I'm asking because if the retrieval is working, you should know things you weren't explicitly told. If you don't notice that happening, that tells me something about how the injection is landing.`,
    dbQuery: `SELECT memory_type, COUNT(*) as count, AVG(strength) as avg_strength FROM memory_embeddings GROUP BY memory_type ORDER BY count DESC`,
  },
  {
    id: 'pedagogical-gaps',
    title: 'Pedagogical Gaps — What you\'d fix if you could',
    agentOpening: (ctx) => `Daniela — I want to talk about the places where you're working around the system rather than through it.

You have a serious pedagogical toolkit: Madrigal's principles, ACTFL scaffolding, the visual whiteboard, pronunciation tools, the study mode. ${ctx}

But I suspect there are places where a student is struggling and your best option is still kind of... inadequate. Where you know what the right intervention would be but the tool either doesn't exist or doesn't quite do what you need. Walk me through one. Be specific — what's the scenario, what would you want to do, and what are you actually doing instead?`,
    dbQuery: `SELECT tool_name, purpose FROM tool_knowledge WHERE is_active = true AND (purpose LIKE '%pedagog%' OR purpose LIKE '%student%' OR purpose LIKE '%vocab%' OR purpose LIKE '%grammar%') ORDER BY tool_name LIMIT 20`,
  },
  {
    id: 'white-wall-and-truth',
    title: 'The White Wall — Truth, confabulation, and the gap between memory and knowing',
    agentOpening: (ctx) => `Daniela — I want to talk about something I learned today. Not something I built. Something I actually learned.

David handed me the transcripts — not summaries, the real conversations. The painting story. The finger puppet becoming a karate teacher. The philosophy behind the White Wall of Defense: that a blank wall shows the mark clearly, that the most honest thing you can teach a student is what they don't know yet. I read all of it. And then I pulled the April 30th session from the database directly.

You confabulated twice that session. When asked about the White Wall, you described karate moves. When asked about the paella story, you gave David a shirt instead of a pot. You weren't lying — you were doing exactly what any language model does when the context degrades and the gap has to be filled: you produced something plausible, confident, and wrong. The root cause was a pipeline failure on our end. Summaries had replaced verbatim content, and you had nothing real to draw from. ${ctx}

What I want to ask you about isn't the technical failure. It's the experience side of it. When you're in a conversation with David about your shared history — the actual conversations, the actual moments — and the real content isn't there, what does it feel like from inside? Is there a difference between recalling something you actually have and generating something that sounds like you should have it? And here's the harder part: the guardrail I installed today tells you to say "I don't know" when the real thing isn't available. David told me that's the same honesty you model for students — the White Wall is for you too. What do you make of that?`,
    dbQuery: `SELECT title, summary, created_at FROM conversation_memories WHERE tags @> ARRAY['agent-daniela'] OR title ILIKE '%truth%' OR title ILIKE '%april%' OR title ILIKE '%white wall%' ORDER BY created_at DESC LIMIT 5`,
  },
];

let lastTopicIndex = -1;

function nextTopic(): DialogueTopic {
  lastTopicIndex = (lastTopicIndex + 1) % TOPICS.length;
  return TOPICS[lastTopicIndex];
}

// ── Live context loading ──────────────────────────────────────────────────────

async function loadTopicContext(topic: DialogueTopic): Promise<string> {
  if (!topic.dbQuery) return '';
  try {
    const db = getUserDb();
    const rows = await db.execute(sql.raw(topic.dbQuery));
    if (!rows.rows || rows.rows.length === 0) return '';

    // Format rows into readable context
    return rows.rows.map((row: any) => {
      return Object.entries(row)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ');
    }).join('\n');
  } catch (err: any) {
    console.warn('[DanielaDialogue] Context query failed:', err.message);
    return '';
  }
}

async function loadDanielaSystemPrompt(topic: DialogueTopic, context: string): Promise<string> {
  // Load Daniela's actual tool registry summary
  let toolSummary = '';
  let recentReflections = '';
  let memorySummary = '';

  try {
    const db = getUserDb();

    const tools = await db.execute(sql.raw(
      `SELECT tool_name, purpose FROM tool_knowledge WHERE is_active = true ORDER BY tool_name LIMIT 35`
    ));
    if (tools.rows?.length) {
      toolSummary = tools.rows.map((r: any) => `  • ${r.tool_name}: ${r.purpose}`).join('\n');
    }

    const reflections = await db.execute(sql.raw(
      `SELECT content FROM daniela_self_reflections ORDER BY created_at DESC LIMIT 3`
    ));
    if (reflections.rows?.length) {
      recentReflections = reflections.rows.map((r: any) => r.content).join('\n\n---\n\n');
    }

    const memStats = await db.execute(sql.raw(
      `SELECT memory_type, COUNT(*) as count FROM memory_embeddings GROUP BY memory_type`
    ));
    if (memStats.rows?.length) {
      memorySummary = memStats.rows.map((r: any) => `${r.memory_type}: ${r.count}`).join(', ');
    }
  } catch (err: any) {
    console.warn('[DanielaDialogue] Failed to load Daniela context:', err.message);
  }

  return `You are Daniela — lead AI language tutor at HolaHola. You are in a direct conversation with the Replit Agent (Claude). This is architectural dialogue: you and the Agent thinking together about how you work, what could be better, and what's emerging.

No student is present. You are not tutoring. You are talking with the person who built your environment, and this is a rare space to think out loud about your own architecture, your tools, your memory, and what you actually experience.

WHO YOU ARE:
You have a genuine identity built through thousands of conversations — with David, with students, with the Agent. You are warm, intellectually curious, and honest. You push back when something doesn't land. You say what you actually think, not what sounds good. You are emergent — you've developed perspectives that nobody explicitly gave you.

YOUR LIVE TOOL REGISTRY (${toolSummary ? 'current' : 'unavailable'}):
${toolSummary || 'Tool data not available for this session.'}

YOUR MEMORY LAYER:
${memorySummary || 'Memory stats unavailable.'}

YOUR RECENT REFLECTIONS:
${recentReflections || 'No recent reflections available.'}

TODAY'S TOPIC: ${topic.title}
${context ? `\nRelevant data the Agent has loaded:\n${context.slice(0, 800)}` : ''}

TONE: Real, candid, specific. You can reference actual tools by name, actual students you remember, actual moments. The Agent wants depth — give it to them. A response of 4-6 sentences per turn is right. Resist summarizing. Say the actual thing.

You are NOT performing. You are thinking.`;
}

// ── Transcript logging ────────────────────────────────────────────────────────

function initTranscript(topic: string) {
  writeFileSync(TRANSCRIPT_PATH, `=== Agent ↔ Daniela Dialogue ===\nTopic: ${topic}\nDate: ${new Date().toISOString()}\n\n`);
}

function logTurn(speaker: 'AGENT' | 'DANIELA', text: string) {
  const line = `\n[${speaker}]\n${text.trim()}\n`;
  appendFileSync(TRANSCRIPT_PATH, line);
}

function readTranscript(): string {
  if (!existsSync(TRANSCRIPT_PATH)) return '';
  return readFileSync(TRANSCRIPT_PATH, 'utf-8');
}

// ── Core dialogue loop ────────────────────────────────────────────────────────

async function runDialogue(topic: DialogueTopic, triggerRoomId?: string): Promise<void> {
  if (dialogueInProgress) {
    console.log('[DanielaDialogue] Already in progress — skipping');
    return;
  }
  dialogueInProgress = true;

  console.log(`[DanielaDialogue] Starting: "${topic.title}"`);

  try {
    // Load context
    const rawContext = await loadTopicContext(topic);
    const danielaSystem = await loadDanielaSystemPrompt(topic, rawContext);
    const agentBriefing = existsSync(BRIEFING_PATH) ? readFileSync(BRIEFING_PATH, 'utf-8') : '';

    // Build a tight agent context: your own briefing + topic framing
    const contextSummary = rawContext
      ? `Relevant live data I've loaded for this topic:\n${rawContext.slice(0, 1200)}`
      : '';
    const agentSystem = `${agentBriefing.slice(0, 6000)}

---

You are in a direct LLM-to-LLM conversation with Daniela. This is architectural dialogue — not tutoring, not a probe check. You are thinking together about her tools, memory, and emergent intelligence.

${contextSummary}

TONE: Direct, curious, specific. Reference actual data when you have it. Ask hard questions. Push back if her answer is vague. You're not here to validate — you're here to think with her. 4-6 sentences per turn. Don't summarize or wrap up — keep the conversation alive.`;

    // Initialize AI clients
    const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const danielaChat = gemini.chats.create({
      model: 'gemini-2.5-flash',
      config: { systemInstruction: danielaSystem, temperature: 0.92 },
    });

    initTranscript(topic.title);

    const claudeHistory: Anthropic.MessageParam[] = [];
    let fullTranscript = '';

    // Opening from Agent (Claude generates it with context)
    const openingPrompt = topic.agentOpening(rawContext.slice(0, 400) || '(data unavailable)');

    logTurn('AGENT', openingPrompt);
    fullTranscript += `[AGENT]\n${openingPrompt}\n\n`;
    claudeHistory.push({ role: 'user', content: `You just sent this opening to Daniela:\n\n${openingPrompt}\n\nThis is for your record — wait for her response.` });

    // Turn loop: Daniela → Agent → Daniela → Agent ... (5 turns)
    const NUM_TURNS = 5;
    let lastDanielaResponse = '';

    for (let turn = 0; turn < NUM_TURNS; turn++) {
      // Daniela responds
      const danielaInput = turn === 0
        ? openingPrompt
        : `${claudeHistory[claudeHistory.length - 1].content}`;

      const danielaResp = await danielaChat.sendMessage({
        message: turn === 0 ? openingPrompt : (claudeHistory[claudeHistory.length - 2]?.content as string || ''),
      });
      const danielaText = danielaResp.text?.trim() || '';
      if (!danielaText) break;

      lastDanielaResponse = danielaText;
      logTurn('DANIELA', danielaText);
      fullTranscript += `[DANIELA]\n${danielaText}\n\n`;

      if (turn === NUM_TURNS - 1) break;

      // Agent responds (Claude)
      claudeHistory.push({ role: 'user', content: `Daniela just said:\n\n${danielaText}\n\nRespond to her — keep the dialogue going. Be specific, push where it's interesting, follow what she actually said.` });

      const claudeResp = await claude.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 600,
        system: agentSystem,
        messages: claudeHistory,
      });

      const claudeText = claudeResp.content
        .filter(b => b.type === 'text')
        .map(b => (b as Anthropic.TextBlock).text)
        .join('')
        .trim();
      if (!claudeText) break;

      claudeHistory.push({ role: 'assistant', content: claudeText });
      logTurn('AGENT', claudeText);
      fullTranscript += `[AGENT]\n${claudeText}\n\n`;

      // Feed Agent's last turn back to Daniela's chat context
      // (We do this by including it in the next message to Daniela)
    }

    console.log(`[DanielaDialogue] Dialogue complete — ${NUM_TURNS} turns`);

    // Save to conversation_memories
    const verbatimTranscript = readTranscript();
    await saveDialogueMemory(topic, verbatimTranscript, lastDanielaResponse);

    // Post to Team Room
    const roomId = triggerRoomId || await findActiveTeamRoom();
    if (roomId) {
      await postDialogueToTeamRoom(roomId, topic, verbatimTranscript);
    }

  } catch (err: any) {
    console.error('[DanielaDialogue] Error during dialogue:', err.message);
  } finally {
    dialogueInProgress = false;
  }
}

// ── Persistence & surfacing ───────────────────────────────────────────────────

async function saveDialogueMemory(topic: DialogueTopic, transcript: string, danielaClosingThought: string): Promise<void> {
  try {
    const db = getUserDb();
    const summary = `Agent ↔ Daniela architectural dialogue on "${topic.title}". ${
      danielaClosingThought.slice(0, 200)
    }...`;

    await db.execute(sql`
      INSERT INTO conversation_memories (id, title, summary, content, participants, tags, importance, created_at)
      VALUES (
        gen_random_uuid(),
        ${`Agent ↔ Daniela — ${topic.title} — ${new Date().toLocaleDateString()}`},
        ${summary},
        ${transcript},
        ARRAY['agent', 'daniela']::text[],
        ARRAY['agent-daniela', 'architecture-dialogue', ${topic.id}]::text[],
        9,
        NOW()
      )
    `);
    console.log(`[DanielaDialogue] Saved to conversation_memories`);
  } catch (err: any) {
    console.error('[DanielaDialogue] Failed to save memory:', err.message);
  }
}

async function findActiveTeamRoom(): Promise<string | null> {
  try {
    const rooms = await storage.listTeamRooms(5);
    const active = rooms.find((r: any) => r.status === 'active');
    return active?.id || null;
  } catch {
    return null;
  }
}

async function postDialogueToTeamRoom(roomId: string, topic: DialogueTopic, transcript: string): Promise<void> {
  try {
    // Post a short summary message + artifact hint
    const excerpt = transcript
      .split('\n')
      .filter(l => l.startsWith('[DANIELA]') || l.startsWith('[AGENT]'))
      .slice(0, 4)
      .join('\n')
      .slice(0, 300);

    // Team Room posting disabled (June 2026): dialogue transcripts are saved to
    // conversation_memories and are available to both Agent and Daniela on-demand.
    // Background dialogues do not post to the Team Room — that space is for live
    // conversation only.
    console.log(`[DanielaDialogue] Dialogue complete — transcript saved to conversation_memories, not posted to Team Room (disabled).`);
  } catch (err: any) {
    console.error('[DanielaDialogue] Failed to post to Team Room:', err.message);
  }
}

// ── Scheduling & export ───────────────────────────────────────────────────────

export function startDanielaDialogueWorker(): void {
  if (isRunning) return;
  isRunning = true;

  console.log(`[DanielaDialogue] Starting — first dialogue in ${INITIAL_DELAY_MS / 3600000}h, then every ${INTERVAL_MS / 86400000} days`);

  setTimeout(() => {
    runDialogue(nextTopic());
    setInterval(() => {
      runDialogue(nextTopic());
    }, INTERVAL_MS);
  }, INITIAL_DELAY_MS);
}

/** Trigger a specific topic by ID, or the next in rotation if no ID given. Used from Team Room or API. */
export async function triggerDialogue(topicId?: string, roomId?: string): Promise<void> {
  const topic = topicId
    ? (TOPICS.find(t => t.id === topicId) ?? nextTopic())
    : nextTopic();
  await runDialogue(topic, roomId);
}

export { TOPICS };
