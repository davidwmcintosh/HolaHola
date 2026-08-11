/**
 * capture-exchange.ts
 *
 * One-call capture of a complete David↔Luca exchange.
 *
 * Writes a .luca_auto_capture trigger file that the autosave worker picks up
 * within milliseconds (fs.watch) or at most 20s (poll). The worker appends
 * both turns to .chat_capture in order, saves to conversation_memories, and
 * deletes the trigger file.
 *
 * This replaces the two separate `append-turn.ts` calls with a single command:
 *
 *   npx tsx server/scripts/capture-exchange.ts \
 *     --david "David's exact message" \
 *     --luca  "Luca's exact response"
 *
 * Either --david or --luca may be omitted to capture a single-speaker turn.
 *
 * Alternative (raw file write):
 *   echo '{"david":"...","luca":"..."}' > .local/.luca_auto_capture
 *
 * The autosave worker also exports appendChatCaptureTurn() for code-level use.
 */

import { writeFileSync, renameSync, existsSync } from 'fs';
import { join } from 'path';
import { WORKSPACE, LUCA_AUTO_CAPTURE_PATH } from '../services/transcript-parser';

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

// --status: show current trigger file state
if (args.includes('--status')) {
  const exists = existsSync(LUCA_AUTO_CAPTURE_PATH);
  console.log(`[CaptureExchange] Trigger file: ${LUCA_AUTO_CAPTURE_PATH}`);
  console.log(`[CaptureExchange] Exists: ${exists}`);
  process.exit(0);
}

const davidText = getArg('--david');
const lucaText  = getArg('--luca');

if (!davidText && !lucaText) {
  console.error('[CaptureExchange] Usage:');
  console.error('  npx tsx server/scripts/capture-exchange.ts --david "text" --luca "text"');
  console.error('  npx tsx server/scripts/capture-exchange.ts --david "text only"');
  console.error('  npx tsx server/scripts/capture-exchange.ts --luca  "text only"');
  console.error('  npx tsx server/scripts/capture-exchange.ts --status');
  console.error('');
  console.error('At least one of --david or --luca is required.');
  process.exit(1);
}

const trigger: Record<string, string> = { ts: new Date().toISOString() };
if (davidText) trigger.david = davidText;
if (lucaText)  trigger.luca  = lucaText;

// Atomic write via temp file + rename — prevents the autosave worker's fs.watch
// from observing an empty or partially-written file. writeFileSync to the target
// directly would expose a window where the watcher reads zero/partial bytes and
// deletes the trigger as "invalid". With rename, the file appears atomically.
const tmpPath = LUCA_AUTO_CAPTURE_PATH + '.tmp';
writeFileSync(tmpPath, JSON.stringify(trigger, null, 2), 'utf-8');
renameSync(tmpPath, LUCA_AUTO_CAPTURE_PATH);

const parts: string[] = [];
if (davidText) parts.push('1 David turn');
if (lucaText)  parts.push('1 Luca Replit turn');

console.log(`[CaptureExchange] ✓ Wrote ${parts.join(' + ')} to trigger file`);
console.log(`[CaptureExchange]   Autosave worker will append to .chat_capture and save to DB`);
console.log(`[CaptureExchange]   (sub-second via fs.watch, at most 20s via poll)`);
