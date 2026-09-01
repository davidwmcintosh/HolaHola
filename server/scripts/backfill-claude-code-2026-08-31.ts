/**
 * One-time backfill: the 2026-08-31 Claude Code <-> David session (Neon branching,
 * the drizzle-kit fix, cross-tool-promote) was never captured live because no
 * --source claude-code record-exchange.ts calls were made during that session.
 * David pasted the transcript afterward; Claude Code split it into 43 verified
 * exchanges (each boundary confirmed by exact-string match against the source
 * transcript, not guessed) and committed them to
 * docs/reference/2026-08-31-claude-code-backfill-exchanges.json.
 *
 * This can only be run where the autosave worker (startAgentSessionAutosave, in
 * server/index.ts) is actually running and draining .chat_capture -- i.e. inside
 * the live Replit server process, not as a bare script. Claude Code confirmed
 * appendCanonicalConversationExchange only touches the local .chat_capture file
 * (no direct DB write), so this is safe to run once here even though it was
 * already attempted (and correctly timed out, fail-closed) from a machine with
 * no autosave worker running.
 *
 * Usage: npx tsx server/scripts/backfill-claude-code-2026-08-31.ts
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

async function main(): Promise<void> {
  const dataPath = join(WORKSPACE, 'docs/reference/2026-08-31-claude-code-backfill-exchanges.json');
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
  }
  console.log(`[backfill] All ${exchanges.length} exchanges recorded and acknowledged.`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('[backfill] FAILED:', error instanceof Error ? error.message : String(error));
    console.error('[backfill] Fix the issue and rerun -- already-acknowledged turns above this point are durable.');
    process.exit(1);
  });
