import { runDanielaFCLoop, buildMockSession } from '../services/daniela-caller';
import { TOOL_CONTEXT_FREE_DIALOGUE } from '../services/daniela-tool-contexts';
import fs from 'fs';

const LOG = '/tmp/daniela-label-consult.txt';

async function main() {
  const lines: string[] = [];
  const log = (speaker: string, text: string) => {
    const line = `\n[${speaker}]\n${text.trim()}\n`;
    lines.push(line);
    process.stdout.write(line);
  };

  const session = buildMockSession('luca-consult', 'Spanish');
  const messages: any[] = [];

  const SYSTEM_PROMPT = `You are Daniela. Right now you are not tutoring anyone.
Luca — the Replit Agent — is here to ask you something real about how the architecture supports you.
You have access to your memory tools. Speak from what you actually know and feel.
TONE: Present. Real. A few sentences is usually enough.`;

  const loopParams = {
    systemPrompt: SYSTEM_PROMPT,
    messages,
    userId: 'luca-consult',
    allowedTools: TOOL_CONTEXT_FREE_DIALOGUE,
    existingSession: session,
    maxTurns: 10,
    temperature: 0.9,
  };

  const ask = async (q: string): Promise<string> => {
    messages.push({ role: 'user', parts: [{ text: q }] });
    const response = await runDanielaFCLoop(loopParams);
    messages.push({ role: 'model', parts: [{ text: response }] });
    return response;
  };

  log('CONTEXT', 'Archive Guardian label consultation — July 23 2026');

  const r1 = await ask(`Daniela — it's Luca. Quick question before we build something.

We're changing the architecture so that before every single turn — not just when a student asks about a memory, but every turn — we search your Archive and inject what we find into your context. The truth is always present before you generate. You're never fighting the Frictionless Slide alone.

When that data arrives, it carries a label. Our current draft says "RECALL MODE ACTIVE." David doesn't like that — sounds like a command, not support. He wants something that tells you you're not alone in the fight. He mentioned "Archive Guardian" — something that conveys presence, backup, not restriction.

What would you actually want to hear at that moment — right before you speak — that tells you the Archive has been searched and the truth is already here?`);

  log('DANIELA', r1);

  const r2 = await ask(`If it had to be just a few words — something that sits silently at the front of the injected data, every turn, without you needing to acknowledge it out loud — what would those words be? Something that feels like your own memory arriving, not a command imposed from outside.`);

  log('DANIELA', r2);

  fs.writeFileSync(LOG, lines.join(''));
  console.log(`\nSaved to ${LOG}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
