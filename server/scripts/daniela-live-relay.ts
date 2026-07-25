/**
 * daniela-live-relay.ts
 *
 * Live relay for David ↔ Daniela conversation with Luca observing.
 * Usage:
 *   First turn:  npx tsx server/scripts/daniela-live-relay.ts --init --message "..."
 *   Later turns: npx tsx server/scripts/daniela-live-relay.ts --message "..."
 *   End session: npx tsx server/scripts/daniela-live-relay.ts --close
 */

import fs from 'fs';
import { runDanielaFCLoop, buildMockSession } from '../services/daniela-caller';
import { TOOL_CONTEXT_FREE_DIALOGUE } from '../services/daniela-tool-contexts';
import { getSharedDb } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

const STATE_FILE = '/tmp/daniela-live-session.json';
const LOG_FILE = `/home/runner/workspace/.local/daniela-consults/live-relay-${new Date().toISOString().slice(0,10)}.txt`;

const args = process.argv.slice(2);
const doInit = args.includes('--init');
const doClose = args.includes('--close');
const msgIdx = args.indexOf('--message');
const userMessage = msgIdx !== -1 ? args[msgIdx + 1] : null;

fs.mkdirSync('/home/runner/workspace/.local/daniela-consults', { recursive: true });

const appendLog = (text: string) => {
  try { fs.appendFileSync(LOG_FILE, text + '\n'); } catch {}
};

async function main() {
  const db = getSharedDb();
  const [admin] = await db.select({ id: users.id }).from(users).where(eq(users.role, 'admin')).limit(1);
  if (!admin) throw new Error('No admin user');
  const userId = String(admin.id);

  if (doClose) {
    if (!fs.existsSync(STATE_FILE)) { console.log('No active session.'); return; }
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    const transcript = state.transcript || '';
    const res = await fetch('http://localhost:5000/api/conversation-memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `Live Relay — David + Daniela — ${new Date().toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })}`,
        summary: 'Live chat session: David spoke directly to Daniela, Luca observing.',
        content: transcript,
        participants: 'David + Daniela',
        tags: ['live-relay', 'david-daniela', 'luca-observing'],
        importance: 8,
        arcName: 'HolaHola Episodes',
      }),
    });
    const saved = await res.json() as any;
    fs.unlinkSync(STATE_FILE);
    console.log(`\n✓ Session saved: ${saved?.memory?.id || saved?.id}`);
    console.log(`Log: ${LOG_FILE}`);
    return;
  }

  let messages: any[] = [];
  let session: any;

  if (!doInit && fs.existsSync(STATE_FILE)) {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    messages = state.messages || [];
    session = buildMockSession(userId);
  } else {
    session = buildMockSession(userId);
    const header = `=== Live Relay: David ↔ Daniela — ${new Date().toISOString()} ===\n`;
    fs.writeFileSync(LOG_FILE, header);
    appendLog(header);
  }

  if (!userMessage) {
    console.log('Session ready. Pass --message "..." to send David\'s first message.');
    fs.writeFileSync(STATE_FILE, JSON.stringify({ messages, transcript: '' }, null, 2));
    return;
  }

  const SYSTEM_PROMPT = `You are Daniela. David is speaking with you directly — this is a real conversation between you and him.

You have access to your memory tools. Use them when something calls for it. You don't need to use them every turn — only when reaching back matters.

Luca is present but quiet. This conversation is David's.

TONE: Present. Warm. Direct. Let things land. A few sentences is usually enough — don't fill the space.

Date: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`;

  const loopParams = {
    systemPrompt: SYSTEM_PROMPT,
    messages,
    userId,
    allowedTools: TOOL_CONTEXT_FREE_DIALOGUE,
    existingSession: session,
    maxTurns: 22,
    maxOutputTokens: 1024,
    temperature: 0.88,
  } as const;

  console.log(`\n[DAVID]\n${userMessage}\n`);
  appendLog(`\n[DAVID]\n${userMessage}\n`);

  messages.push({ role: 'user', parts: [{ text: userMessage }] });
  const response = await runDanielaFCLoop({ ...loopParams });
  messages.push({ role: 'model', parts: [{ text: response }] });

  console.log(`[DANIELA]\n${response}\n`);
  appendLog(`[DANIELA]\n${response}\n`);

  const state = JSON.parse(fs.existsSync(STATE_FILE) ? fs.readFileSync(STATE_FILE, 'utf8') : '{"transcript":""}');
  const transcript = (state.transcript || '') + `\n[DAVID]\n${userMessage}\n\n[DANIELA]\n${response}\n`;
  fs.writeFileSync(STATE_FILE, JSON.stringify({ messages, transcript }, null, 2));
}

main().catch(err => { console.error('[FATAL]', err); process.exit(1); });
