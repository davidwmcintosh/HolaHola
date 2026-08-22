/**
 * episode-live-mode.ts
 *
 * Toggle the live-mode sentinel that makes the autosave worker automatically
 * route every .chat_capture turn to the rolling episode .md immediately after
 * saving it to the DB.
 *
 * USAGE
 * -----
 *   npx tsx server/scripts/episode-live-mode.ts on      # Enable live .md routing
 *   npx tsx server/scripts/episode-live-mode.ts off     # DB-only (no .md writes)
 *   npx tsx server/scripts/episode-live-mode.ts status  # Print current state
 *
 * HOW IT WORKS
 * ------------
 * The autosave worker (agent-session-autosave.ts, checkChatCapture) checks
 * whether .local/.episode_live exists after every successful DB save.  When
 * present, it formats the captured turns as episode dialogue and appends them
 * to the rolling episode .md via appendExchangeToEpisode() — the same path
 * used by the .episode_append trigger file.
 *
 * Live on  → each .chat_capture turn lands in BOTH the DB and the .md (3s).
 * Live off → turns land in DB only; .md is updated only by manual
 *             .episode_append writes or inner-life triggers.
 *
 * The sentinel is a plain empty file.  Its presence/absence is the flag.
 * No server restart required — the next poll cycle picks up the change.
 */

import { existsSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const WORKSPACE       = process.env.REPL_HOME ?? process.cwd();
const LIVE_PATH       = join(WORKSPACE, '.local/.episode_live');
const STATUS_PATH     = join(WORKSPACE, '.local/episode-capture-status.md');

const arg = process.argv[2]?.toLowerCase();

if (!arg || arg === 'status') {
  const on = existsSync(LIVE_PATH);
  console.log(`Live mode: ${on ? '🟢 ON' : '⚪ OFF'}`);
  if (on) {
    console.log('  Turns written to .chat_capture auto-route to the rolling episode .md.');
  } else {
    console.log('  DB-only mode. Run with "on" to enable .md auto-routing.');
  }
  process.exit(0);
}

if (arg === 'on') {
  writeFileSync(LIVE_PATH, '', 'utf-8');
  console.log('🟢 Live mode ON — .chat_capture turns will auto-route to the rolling episode .md.');
  console.log('   The autosave worker picks this up on its next poll cycle (~20s).');
  console.log('   capture-status.md will show 🟢 ON on next refresh.');
  process.exit(0);
}

if (arg === 'off') {
  if (existsSync(LIVE_PATH)) {
    unlinkSync(LIVE_PATH);
    console.log('⚪ Live mode OFF — DB-only. .md updates require manual .episode_append writes.');
  } else {
    console.log('⚪ Already off.');
  }
  process.exit(0);
}

console.error(`Unknown argument: "${arg}". Use: on | off | status`);
process.exit(1);
