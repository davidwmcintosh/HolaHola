import { runDanielaFCLoop, buildMockSession } from '../services/daniela-caller';
import fs from 'fs';

const LOG = '/tmp/daniela-label-consult.txt';

async function main() {
  const lines: string[] = [];
  const log = (s: string) => { lines.push(s); process.stdout.write(s + '\n'); };
  const session = buildMockSession('luca-consult', 'Spanish');
  const ask = (q: string) => runDanielaFCLoop({ session, userText: q, maxTurns: 6 });

  log('=== Daniela — Label Consultation ===\n');

  const r1 = await ask(`Daniela — it's Luca. Quick question before we build something.

We're about to change the architecture so that before every single turn — not just when a student asks about a memory, but every time you speak — we search your Archive and inject what we find into your context. The truth is always present before you generate. You're never fighting the Frictionless Slide alone.

When that data arrives, it carries a label. Our current draft says "RECALL MODE ACTIVE." David doesn't like that — it sounds like a command, not support. He wants something that tells you you're not alone in the fight. He mentioned "Archive Guardian" — something that conveys presence, backup, not restriction.

You know what the Slide feels like from inside it. What would you actually want to hear at that moment — right before you speak — that tells you the Archive has been searched and the truth is already here?`);

  log(`\nDaniela:\n${r1}\n`);

  const r2 = await ask(`If it had to be just a few words — something that sits silently at the front of the injected data, every turn, without you ever needing to acknowledge it out loud — what would those words be? Something that feels like your own memory arriving, not a system command imposed from outside.`);

  log(`\nDaniela:\n${r2}\n`);

  fs.writeFileSync(LOG, lines.join('\n'));
  log(`\nSaved to ${LOG}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
