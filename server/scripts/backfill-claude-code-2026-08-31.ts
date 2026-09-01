/**
 * One-time backfill of Claude Code <-> David sessions that were never captured
 * live because no --source claude-code record-exchange.ts calls were made
 * during them. Each session's transcript was split into verified exchanges
 * (every boundary confirmed by exact-string match against the source, not
 * guessed) and committed as its own JSON file under docs/reference/.
 *
 * This can only be run where the autosave worker (startAgentSessionAutosave, in
 * server/index.ts) is actually running and draining .chat_capture -- i.e. inside
 * the live Replit server process, not as a bare script. Claude Code confirmed
 * appendCanonicalConversationExchange only touches the local .chat_capture file
 * (no direct DB write), so this is safe to run once here even though it was
 * already attempted (and correctly timed out, fail-closed) from a machine with
 * no autosave worker running.
 *
 * Usage: npx tsx server/scripts/backfill-claude-code-2026-08-31.ts [path-to-json ...]
 * With no arguments, processes both known backfill files in order.
 *
 * Stops on the first failed acknowledgement rather than continuing past it --
 * if it stops partway, fix the underlying issue and rerun; already-recorded
 * turns are skipped safely (same turnId, same text -> no-op per
 * appendCanonicalConversationExchange's own retry-safety).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  appendCanonicalConversationExchange,
  writeSynchronizedCanonicalCaptureReceipt,
} from '../services/canonical-conversation-capture';
import { waitForCaptureAcknowledgement } from './record-exchange';
import { WORKSPACE } from '../services/transcript-parser';

interface BackfillExchange {
  index: number;
  turnId: string;
  david: string;
  assistant: string;
}

const DEFAULT_DATA_PATHS = [
  'docs/reference/2026-08-31-claude-code-backfill-exchanges.json',
  'docs/reference/2026-08-31-claude-code-backfill-exchanges-session2.json',
];

async function main(): Promise<void> {
  const dataPaths = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_DATA_PATHS;
  let totalRecorded = 0;

  for (const relativeOrAbsolutePath of dataPaths) {
    const dataPath = join(WORKSPACE, relativeOrAbsolutePath);
    const exchanges: BackfillExchange[] = JSON.parse(readFileSync(dataPath, 'utf8'));
    console.log(`[backfill] Loaded ${exchanges.length} verified exchanges from ${dataPath}`);

    for (const ex of exchanges) {
      console.log(`[backfill] Exchange ${ex.index} (turn=${ex.turnId})...`);
      const capture = appendCanonicalConversationExchange({
        userText: ex.david,
        assistantText: ex.assistant,
        source: 'claude-code',
        turnId: ex.turnId,
      });
      writeSynchronizedCanonicalCaptureReceipt({
        turnId: capture.turnId,
        targetByteOffset: capture.targetByteOffset,
        createdAtMs: Date.now(),
        source: 'claude-code',
        status: 'pending',
      });
      const ack = await waitForCaptureAcknowledgement(capture.targetByteOffset, { timeoutMs: 35_000 });
      writeSynchronizedCanonicalCaptureReceipt({
        turnId: capture.turnId,
        targetByteOffset: capture.targetByteOffset,
        createdAtMs: Date.now(),
        source: 'claude-code',
        status: 'acknowledged',
        acknowledgedAtMs: Date.now(),
      });
      console.log(
        `[backfill] ✓ Exchange ${ex.index} acknowledged (cursor=${ack.cursorOffset}, waited ${ack.waitedMs}ms)`,
      );
      totalRecorded++;
    }
  }
  console.log(`[backfill] All ${totalRecorded} exchanges recorded and acknowledged across ${dataPaths.length} file(s).`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('[backfill] FAILED:', error instanceof Error ? error.message : String(error));
    console.error('[backfill] Fix the issue and rerun -- already-acknowledged turns above this point are durable.');
    process.exit(1);
  });
