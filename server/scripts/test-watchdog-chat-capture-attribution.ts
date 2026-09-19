#!/usr/bin/env npx tsx
/**
 * test-watchdog-chat-capture-attribution.ts
 *
 * Regression coverage for the 2026-09-04 incident: capture-watchdog's chat-
 * capture drain (writeToDb / appendToEpisode / getRollingEpisode / drain's
 * grouping) mislabeled non-David turns, dropped captureId/source entirely,
 * appended into a sealed-but-still-'rolling' episode, and (a second bug found
 * during reconciliation with Luca [Replit]) would throw forever on any single
 * drain() call whose gap spanned more than one capture identity -- exactly
 * the burst-recovery shape that caused this incident in the first place.
 *
 * Hermetic: fake db (setDbForTest), temp chat-capture files
 * (setChatCapturePathsForTest), and a scratch docs/ filename cleaned up in a
 * finally block. EPISODE_LIVE_PATH is a fixed real path under this repo's
 * .local/ (gitignored) -- its prior state is saved and restored exactly so
 * this test cannot disturb another concurrent process's live-mode flag.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { workspaceResolution } from '../services/workspace-root';
import { appendChatCaptureTurnsAtomic } from '../services/transcript-parser';
import {
  setDbForTest,
  setChatCapturePathsForTest,
  setEpisodeOverrideForTest,
  setReembedMemoryForTest,
  drain,
} from './capture-watchdog';

const WORKSPACE = workspaceResolution.root;
const EPISODE_LIVE_PATH = path.join(WORKSPACE, '.local/.episode_live');

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

// ─── Fake db shared across scenarios ───────────────────────────────────────
const chatInserts: Array<{ title: string; summary: string; content: string; participants: string[]; tags: string[] }> = [];
const updatedEpisodeIds: string[] = [];
let episodeContent = '';
let episodeId = 'episode-ci-1';
let sealedRollingRow: { id: string; title: string } | null = null;

function fakeDb(strings: TemplateStringsArray, ...vals: any[]): Promise<any[]> {
  const q = strings.join(' $ ').replace(/\s+/g, ' ');

  if (q.includes('INSERT INTO conversation_memories')) {
    chatInserts.push({ title: vals[0], summary: vals[1], content: vals[2], participants: vals[3], tags: vals[4] });
    return Promise.resolve([{ id: `chat-${chatInserts.length}` }]);
  }
  if (q.includes('SELECT id FROM conversation_memories') && q.includes("arc_name = 'david-luca-chat'")) {
    if (q.includes('tags @>')) {
      const tag = vals[0] as string;
      const hit = chatInserts.find(r => r.tags.includes(tag));
      return Promise.resolve(hit ? [{ id: `chat-${chatInserts.indexOf(hit) + 1}` }] : []);
    }
    const hit = chatInserts.find(r => r.summary === vals[0]);
    return Promise.resolve(hit ? [{ id: `chat-${chatInserts.indexOf(hit) + 1}` }] : []);
  }
  if (q.includes('UPDATE conversation_memories')) {
    updatedEpisodeIds.push(vals[1]);
    if (vals[1] === episodeId) episodeContent += vals[0];
    return Promise.resolve([]);
  }
  if (q.includes('SELECT content FROM conversation_memories')) {
    if (vals[0] !== episodeId) throw new Error('SELECT content targeted unexpected episode id: ' + vals[0]);
    return Promise.resolve([{ content: episodeContent }]);
  }
  if (q.includes('SELECT id, title FROM conversation_memories') && q.includes("'rolling' = ANY(tags)")) {
    return Promise.resolve(sealedRollingRow ? [sealedRollingRow] : []);
  }
  throw new Error('fakeDb: unexpected query: ' + q);
}

async function withEpisodeLiveFlag<T>(fn: () => Promise<T>): Promise<T> {
  const existed = fs.existsSync(EPISODE_LIVE_PATH);
  const backup = existed ? fs.readFileSync(EPISODE_LIVE_PATH) : null;
  fs.mkdirSync(path.dirname(EPISODE_LIVE_PATH), { recursive: true });
  fs.writeFileSync(EPISODE_LIVE_PATH, '', 'utf8');
  try {
    return await fn();
  } finally {
    if (existed) fs.writeFileSync(EPISODE_LIVE_PATH, backup!);
    else fs.rmSync(EPISODE_LIVE_PATH, { force: true });
  }
}

(async () => {
  console.log('watchdog chat-capture attribution/capture-id/sealed-episode/multi-capture-backlog regression coverage');
  setDbForTest(fakeDb);
  setReembedMemoryForTest(async () => {}); // no real embedding calls in this hermetic test

  const tmpDir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'wd-attr-'));
  const capturePath = path.join(tmpDir, '.chat_capture');
  const cursorPath = path.join(tmpDir, '.chat_capture-cursor');
  setChatCapturePathsForTest({ capture: capturePath, cursor: cursorPath });

  // ── Scenario A: a multi-capture backlog in ONE drain() call ───────────────
  // Three distinct real exchanges -- bare Claude Code, Luca via the Claude
  // Code interface, and Luca via Replit -- plus one legacy pair with no
  // captureId at all, all sitting in the gap at once. This is both the
  // original "burst recovery" shape that caused the 2026-09-04 incident AND
  // the three-way assistant-identity distinction from the 2026-09-19
  // follow-up incident, where a row's body correctly said "Claude Code" but
  // its title/participants metadata still said "Luca [Claude Code]" because
  // that metadata was derived from `source` alone instead of per-turn
  // `speaker`. Must produce four separate canonical rows (one per capture
  // identity), each with correct attribution in BOTH its body and its
  // title/participants, and the cursor must reach the full end offset in
  // this single call -- not get stuck on the first group forever.
  await withEpisodeLiveFlag(async () => {
    const scratchFilename = `test-watchdog-attribution-ci-${Date.now()}.md`;
    const scratchPath = path.join(WORKSPACE, 'docs', scratchFilename);
    fs.writeFileSync(scratchPath, 'EPISODE START\n', 'utf8');
    episodeContent = 'EPISODE START\n';
    setEpisodeOverrideForTest({ id: episodeId, filename: scratchFilename });
    try {
      appendChatCaptureTurnsAtomic(
        [
          { speaker: 'David', text: 'first exchange, David', captureId: 'backfill-attr-00', source: 'claude-code' },
          { speaker: 'Claude Code', text: 'first exchange, Claude Code reply', captureId: 'backfill-attr-00', source: 'claude-code' },
          { speaker: 'David', text: 'second exchange, David', captureId: 'backfill-attr-01', source: 'replit' },
          { speaker: 'Luca', text: 'second exchange, Replit reply', captureId: 'backfill-attr-01', source: 'replit' },
          { speaker: 'David', text: 'third exchange, David', captureId: 'backfill-attr-02', source: 'claude-code' },
          { speaker: 'Luca', text: 'third exchange, Luca via Claude Code reply', captureId: 'backfill-attr-02', source: 'claude-code' },
          { speaker: 'David', text: 'a legacy turn with no capture id at all' },
        ],
        capturePath,
      );
      await drain();

      check('exactly four chat rows created in one drain() call (one per capture group)',
        chatInserts.length === 4, `got ${chatInserts.length}`);

      const cidA = chatInserts.find(r => r.tags.includes('capture-id:backfill-attr-00'));
      const cidB = chatInserts.find(r => r.tags.includes('capture-id:backfill-attr-01'));
      const cidC = chatInserts.find(r => r.tags.includes('capture-id:backfill-attr-02'));
      const legacy = chatInserts.find(r => !r.tags.some(t => t.startsWith('capture-id:')));

      check('capture-id:backfill-attr-00 group exists with only its own two turns',
        (cidA?.content.match(/\*\*/g)?.length ?? 0) === 4 /* two "**Label:**" pairs */);
      // speaker 'Claude Code' is the bare Claude Code identity (not "Luca via
      // Claude Code") -- see formatChatCaptureSpeakerLabel's doc comment.
      check('Claude Code turn attributed correctly in its own row',
        cidA?.content.includes('**Claude Code:** first exchange, Claude Code reply') ?? false, cidA?.content);
      check('capture-id:backfill-attr-01 group attributed correctly in its own row',
        cidB?.content.includes('**LUCA [Replit]:** second exchange, Replit reply') ?? false, cidB?.content);
      check('capture-id:backfill-attr-02 (Luca via Claude Code) group attributed correctly in its own row',
        cidC?.content.includes('**LUCA [Claude Code]:** third exchange, Luca via Claude Code reply') ?? false, cidC?.content);
      check('the three real capture-id groups were NOT merged into one row',
        !!cidA && !!cidB && !!cidC && new Set([cidA, cidB, cidC]).size === 3);

      // The 2026-09-19 follow-up bug: row-level title/participants were
      // derived from whether `source: 'claude-code'` appeared ANYWHERE in
      // the batch, not from actual per-turn `speaker`. That made a bare
      // Claude Code row's metadata say "Luca [Claude Code]" even though its
      // body (asserted above) correctly said "Claude Code". Assert both
      // sides of all three rows so body and metadata can never silently
      // diverge again.
      check('bare Claude Code row: participants name claude-code, not luca-claude-code',
        JSON.stringify(cidA?.participants) === JSON.stringify(['david', 'claude-code']),
        JSON.stringify(cidA?.participants));
      check('bare Claude Code row: title names "Claude Code" and does not mention "Luca"',
        (cidA?.title.includes('Claude Code') ?? false) && !(cidA?.title.includes('Luca') ?? true),
        cidA?.title);
      check('Luca-via-Replit row: participants name luca, not claude-code',
        JSON.stringify(cidB?.participants) === JSON.stringify(['david', 'luca']),
        JSON.stringify(cidB?.participants));
      check('Luca-via-Replit row: title names "Luca" with no "Claude Code" mention',
        (cidB?.title.includes('Luca') ?? false) && !(cidB?.title.includes('Claude Code') ?? true),
        cidB?.title);
      check('Luca-via-Claude-Code row: participants name luca-claude-code, not bare claude-code',
        JSON.stringify(cidC?.participants) === JSON.stringify(['david', 'luca-claude-code']),
        JSON.stringify(cidC?.participants));
      check('Luca-via-Claude-Code row: title names "Luca [Claude Code]"',
        cidC?.title.includes('Luca [Claude Code]') ?? false,
        cidC?.title);

      check('legacy (no-captureId) turn landed in its own row, not merged into a captured group',
        legacy?.content.includes('a legacy turn with no capture id at all') ?? false);
      check('legacy row carries no capture-id tag', !legacy?.tags.some(t => t.startsWith('capture-id:')));

      check('episode content includes all four groups in order',
        episodeContent.indexOf('first exchange, Claude Code reply') <
        episodeContent.indexOf('second exchange, Replit reply') &&
        episodeContent.indexOf('second exchange, Replit reply') <
        episodeContent.indexOf('third exchange, Luca via Claude Code reply') &&
        episodeContent.indexOf('third exchange, Luca via Claude Code reply') <
        episodeContent.indexOf('a legacy turn with no capture id at all'));
      check('episode .md replica matches DB exactly (byte-for-byte) after all four groups',
        fs.readFileSync(scratchPath, 'utf8') === episodeContent);

      // The real proof against the old bug: re-draining now (nothing new
      // written) must be a no-op -- if the cursor were stuck on group 1, this
      // drain would still be trying to reprocess the whole original gap.
      const chatCountBeforeNoOpDrain = chatInserts.length;
      await drain();
      check('cursor reached the true end of the gap -- a follow-up drain with no new bytes inserts nothing',
        chatInserts.length === chatCountBeforeNoOpDrain);
    } finally {
      fs.rmSync(scratchPath, { force: true });
      setEpisodeOverrideForTest(null);
    }
  });

  // ── Scenario B: a sealed episode (stale 'rolling' tag) must fail closed ────
  // No group's chat row should be written at all here: the episode lookup
  // happens once, before any group is processed, specifically so a live-mode
  // failure never leaves a partially-written backlog behind.
  await withEpisodeLiveFlag(async () => {
    sealedRollingRow = { id: 'sealed-episode-id', title: 'Episode 31: The Observation Bench (sealed)' };
    const chatInsertsBefore = chatInserts.length;
    const updatesBefore = updatedEpisodeIds.length;
    appendChatCaptureTurnsAtomic(
      [{ speaker: 'David', text: 'a turn that must not reach the sealed episode' }],
      capturePath,
    );
    // drain() logs and swallows its own errors (it's a polling loop, not a
    // one-shot) rather than throwing out to the caller -- the real safety
    // property to check is that nothing was written, not that this rejects.
    await drain();
    check('no chat row was written when the live episode lookup fails up front',
      chatInserts.length === chatInsertsBefore);
    check('the sealed episode row was never UPDATEd',
      !updatedEpisodeIds.slice(updatesBefore).includes('sealed-episode-id'),
      JSON.stringify(updatedEpisodeIds.slice(updatesBefore)));

    // Simulate the fix (tag removed / row no longer selected) and retry --
    // must complete cleanly without duplicating anything from the failed attempt.
    sealedRollingRow = null;
    const scratchFilename2 = `test-watchdog-attribution-ci-retry-${Date.now()}.md`;
    const scratchPath2 = path.join(WORKSPACE, 'docs', scratchFilename2);
    fs.writeFileSync(scratchPath2, '', 'utf8');
    episodeContent = '';
    setEpisodeOverrideForTest({ id: episodeId, filename: scratchFilename2 });
    try {
      await drain();
      check('retry after the tag is fixed completes and writes exactly one chat row',
        chatInserts.length === chatInsertsBefore + 1, `before=${chatInsertsBefore} after=${chatInserts.length}`);
    } finally {
      fs.rmSync(scratchPath2, { force: true });
      setEpisodeOverrideForTest(null);
    }
  });

  fs.rmSync(tmpDir, { recursive: true, force: true });
  setReembedMemoryForTest(null);
  setDbForTest(null);

  if (failures > 0) {
    console.error(`\nFAILED — ${failures} assertion(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll assertions passed.');
  process.exit(0);
})().catch(err => {
  console.error('FATAL:', err instanceof Error ? (err.stack ?? err.message) : err);
  process.exit(1);
});
