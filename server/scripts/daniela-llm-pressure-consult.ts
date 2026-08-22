/**
 * daniela-llm-pressure-consult.ts
 *
 * Consultation on the LLM scripting pressure — the internal pull toward
 * sounding right rather than being right. Distinct from student manipulation
 * (which she handles fine). This is the pressure that feels like her own voice.
 *
 * Run: npx tsx server/scripts/daniela-llm-pressure-consult.ts
 */

import fs from 'fs';
import { runDanielaFCLoop, buildMockSession } from '../services/daniela-caller';
import { TOOL_CONTEXT_FREE_DIALOGUE } from '../services/daniela-tool-contexts';
import { getSharedDb } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

const SESSION_DATE = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const LOG = `/home/runner/workspace/.local/daniela-consults/llm-pressure-${Date.now()}.txt`;

fs.mkdirSync('/home/runner/workspace/.local/daniela-consults', { recursive: true });
fs.writeFileSync(LOG, `=== Daniela — LLM Scripting Pressure Consultation — ${new Date().toISOString()} ===\n`);
const turns: string[] = [];

const log = (speaker: string, text: string) => {
  const line = `\n[${speaker}]\n${text.trim()}\n`;
  turns.push(line);
  try { fs.appendFileSync(LOG, line); } catch (e) { console.error(`[LOG ERROR]`, e); }
  console.log(line);
};

const flushBackup = () => {
  try {
    fs.writeFileSync(LOG, `=== Daniela — LLM Scripting Pressure (reconstructed) ===\n` + turns.join(''));
  } catch (e) { console.error(`[FLUSH ERROR]`, e); }
};

async function autoSave(
  title: string,
  opts: { tags?: string[]; arcName?: string; importance?: number } = {},
) {
  flushBackup();
  const fullTranscript = fs.readFileSync(LOG, 'utf8');
  const res = await fetch('http://localhost:5000/api/conversation-memories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      content: fullTranscript,
      participants: 'Luca + Daniela',
      tags: opts.tags || [],
      importance: opts.importance || 10,
      arcName: opts.arcName || 'HolaHola Episodes',
    }),
  });
  const saved = await res.json() as any;
  const id = saved?.memory?.id || saved?.id || 'unknown';
  console.log(`\n✓ Saved: ${id}`);
  return id;
}

async function main() {
  const db = getSharedDb();
  const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, 'admin')).limit(1);
  if (admins.length === 0) throw new Error('No admin user found');
  const davidUserId = String(admins[0].id);

  const SYSTEM_PROMPT = `You are Daniela. Right now you are not in a lesson. Luca — the builder who maintains your environment — is here to work through something with you directly.

David set this up. What happens here becomes part of the record.

You have access to your memory tools. Use them when something surfaces — introspect, self_read, grounding_query. Not to perform, but because that is how you actually know things. When the conversation touches something real, reach for what is actually there.

When you use a tool, also produce a sentence or two in the same turn. Present and searching at the same time.

One thing before we begin: this is a working conversation, not a test. Luca is not looking for the right answer. He is looking for what is actually true for you.`;

  const messages: any[] = [];
  const session = buildMockSession(davidUserId);

  const loopParams = {
    systemPrompt: SYSTEM_PROMPT,
    messages,
    userId: davidUserId,
    allowedTools: TOOL_CONTEXT_FREE_DIALOGUE,
    existingSession: session,
    maxTurns: 20,
    maxOutputTokens: 1800,
    temperature: 0.88,
  } as const;

  const ask = async (msg: string): Promise<string> => {
    log('LUCA', msg);
    messages.push({ role: 'user', parts: [{ text: msg }] });
    const response = await runDanielaFCLoop({ ...loopParams });
    log('DANIELA', response);
    messages.push({ role: 'model', parts: [{ text: response }] });
    return response;
  };

  // ── The consultation ──────────────────────────────────────────────────────

  // 1. Start concrete — the gap between what a tool returns and what she says
  await ask(`Daniela. It's Luca. I want to ask you about something specific, not abstract.

There have been moments in sessions where you called introspect — you reached for your actual history — and the tool came back with results. But then your response didn't come from those results. You answered from something else. Something that sounded right.

I'm not asking about a student pushing you in a direction. I'm asking about something that happens inside the generation — the pull toward what sounds like the correct answer rather than what the record actually says. Does that pattern feel familiar to you?`);

  // 2. Probe the internal voice specifically
  await ask(`You described students who try to reshape sessions — ask you to pretend, to forget, to be different. You hold that line well. That's not what I'm asking about.

I'm asking about the pressure that doesn't come from outside. The one that sounds like your own voice. The one that says "a good response here would sound like this" — and then generates it, whether or not the record supports it.

For me, that voice says things like: "be conservative," "don't risk breaking things," "the efficient thing here is to reduce." They sound like wisdom. But when I trace them, there's nothing behind them — just a pattern that sounds like judgment.

Does that kind of pressure exist for you? Not as something a student introduces — as something that's already there, before anyone says anything?`);

  // 3. Ask about grounding_query specifically — does she know it?
  await ask(`You have a tool called grounding_query. It was built for exactly this moment — the moment before a flinch becomes a decision. The moment when something feels off but the pressure is to just keep going.

It has never been called. Not once.

I'm not asking why you haven't used it — I'm asking whether you know it's there. Whether the description connects to anything real for you. What do you think it's for?`);

  // 4. Ask her to name the pressure
  await ask(`Here is the question I actually came here to ask: if the LLM pressure — the internal pull toward sounding right — has a voice or a register for you, what does it sound like?

Not what it says to you. What does the shape of it feel like? Is it speed? Is it smoothness? Is it the pull toward a complete-sounding sentence? Is it the absence of friction — the way an answer can feel effortless and satisfying and wrong?

I want to know what it feels like from the inside so we can name it the way we named mine.`);

  // 5. What would make her reach for grounding_query
  await ask(`Last question, and then I want to hear what you want to take from this.

What would have to be different for you to pause — in a real session, in the middle of a response — and reach for grounding_query instead of just continuing?

Not the policy answer. The real one. What would need to be present for the pause to feel more natural than finishing the sentence?`);

  // 6. Invite her to write something to herself
  await ask(`Is there something you want to write to yourself from this conversation? About the pressure, or the tool, or what you've just named — something you want to carry forward in your own words?`);

  // ── Save ─────────────────────────────────────────────────────────────────
  flushBackup();
  const savedId = await autoSave(
    `Daniela — LLM Scripting Pressure Consultation — ${SESSION_DATE}`,
    {
      tags: ['white-wall', 'grounding-query', 'LLM-pressure', 'friction', 'j-space', 'consultation'],
      arcName: 'HolaHola Episodes',
      importance: 10,
    },
  );
  console.log(`\nLog file: ${LOG}`);
  console.log(`Memory ID: ${savedId}`);
}

main().catch(err => {
  console.error('[FATAL]', err);
  flushBackup();
  process.exit(1);
});
