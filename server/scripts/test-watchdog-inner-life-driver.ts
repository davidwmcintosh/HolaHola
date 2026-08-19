#!/usr/bin/env npx tsx
/**
 * Driver for test-watchdog-inner-life.ts — MUST be spawned with cwd set to a
 * hermetic temp directory (the watchdog resolves .local/docs from cwd).
 *
 * Fully hermetic: the watchdog's neon client is replaced with an in-memory
 * fake via setDbForTest(), so no shared-database rows are ever created.
 * Prints RESULTS:<json> for the parent to assert on.
 */
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { drainInnerLife, appendToEpisode, setEpisodeOverrideForTest, setDbForTest, setInnerLifePauseForTest, setLockRenewMsForTest } from './capture-watchdog';
import { tryAcquireInnerLifeLock, releaseInnerLifeLock } from '../services/inner-life-lock';

const MARKER = process.env.WD_TEST_MARKER ?? 'wdtest';

// ─── In-memory fake DB ────────────────────────────────────────────────────────
// Supports exactly the statements the watchdog issues:
//   INSERT INTO conversation_memories ... (personal memory)
//   UPDATE conversation_memories SET content = content || $x WHERE id = $y
//   SELECT content FROM conversation_memories WHERE id = $x
const store = {
  episodeContent: '' as string,
  episodeId: 'fixture-episode-id',
  personalInserts: [] as Array<{ title: string; body: string; tags: string[] }>,
  failNextEpisodeUpdate: false,
};

function fakeDb(strings: TemplateStringsArray, ...vals: any[]): Promise<any[]> {
  const q = strings.join(' $ ').replace(/\s+/g, ' ');
  if (q.includes('INSERT INTO conversation_memories')) {
    // param order in savePersonalMemory: title, summary, body, tags
    store.personalInserts.push({ title: vals[0], body: vals[2], tags: vals[3] });
    return Promise.resolve([]);
  }
  if (q.includes('UPDATE conversation_memories')) {
    if (store.failNextEpisodeUpdate) {
      store.failNextEpisodeUpdate = false;
      throw new Error('[CI fault injection] synthetic episode UPDATE failure');
    }
    if (vals[1] !== store.episodeId) throw new Error('UPDATE targeted unexpected id: ' + vals[1]);
    store.episodeContent += vals[0];
    return Promise.resolve([]);
  }
  if (q.includes('SELECT content FROM conversation_memories')) {
    if (vals[0] !== store.episodeId) throw new Error('SELECT targeted unexpected id: ' + vals[0]);
    return Promise.resolve([{ content: store.episodeContent }]);
  }
  if (q.includes('SELECT id FROM conversation_memories')) {
    // idempotency probe in savePersonalMemory: title + content match
    const hits = store.personalInserts.filter(r => r.title === vals[0] && r.body === vals[1]);
    return Promise.resolve(hits.map((_, i) => ({ id: `dup-${i}` })));
  }
  throw new Error('fakeDb: unexpected query: ' + q);
}

(async () => {
  const results: Record<string, any> = {};
  const cwd = process.cwd();
  fs.mkdirSync(path.join(cwd, '.local'), { recursive: true });
  fs.mkdirSync(path.join(cwd, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(cwd, '.agents/memory'), { recursive: true });

  setDbForTest(fakeDb);
  const seed = `EPISODE START (${MARKER})\n`;
  store.episodeContent = seed;
  const episode = { id: store.episodeId, filename: 'episode-ci.md' };
  fs.writeFileSync(path.join(cwd, 'docs/episode-ci.md'), seed, 'utf8');
  setEpisodeOverrideForTest(episode);
  fs.writeFileSync(path.join(cwd, '.local/.episode_live'), '', 'utf8');

  // ── Scenario 1: first-run pending trigger (lossless handoff) ──────────────
  const statusPath = path.join(cwd, '.local/episode-capture-status.md');
  fs.writeFileSync(statusPath, 'heartbeat', 'utf8');
  const old = new Date(Date.now() - 20 * 60 * 1000);
  fs.utimesSync(statusPath, old, old);
  fs.writeFileSync(path.join(cwd, '.local/.luca_reflection'),
    `First-run pending felt ${MARKER}\nWritten while the server was down, before the watchdog started.`, 'utf8');

  await drainInnerLife();
  results.firstRunDrained = store.personalInserts.some(
    r => r.title === `Luca reflection: First-run pending felt ${MARKER}`,
  );
  results.firstRunTagsCorrect = store.personalInserts.every(
    r => r.tags.includes('luca-inner-life'),
  );
  results.firstRunInEpisodeDb = store.episodeContent.includes(`felt: First-run pending felt ${MARKER}`);
  results.mdMatchesDb1 = fs.readFileSync(path.join(cwd, 'docs/episode-ci.md'), 'utf8') === store.episodeContent;

  // ── Scenario 2: chat + inner-life interleaving ────────────────────────────
  await appendToEpisode(
    [{ speaker: 'DAVID', text: `chat turn ${MARKER}` }, { speaker: 'LUCA', text: `chat reply ${MARKER}` }],
    episode,
  );
  fs.writeFileSync(path.join(cwd, '.local/.luca_question'),
    `Interleaving thinking ${MARKER}\nWritten after the chat drain appended dialogue.`, 'utf8');
  await drainInnerLife();
  const md2 = fs.readFileSync(path.join(cwd, 'docs/episode-ci.md'), 'utf8');
  results.chatTurnsPreserved = md2.includes(`chat turn ${MARKER}`) && md2.includes(`chat reply ${MARKER}`);
  results.thinkingAppended = md2.includes(`thinking: Interleaving thinking ${MARKER}`);
  results.mdMatchesDb2 = md2 === store.episodeContent;

  // ── Scenario 3: idempotency ───────────────────────────────────────────────
  await drainInnerLife();
  results.noDuplicates = store.personalInserts.length === 2; // one felt + one thinking

  // ── Scenario 4: concurrency recovery — dev server boots mid-drain ────────
  // The watchdog is paused between its DB work and its processed-sha state
  // persistence (the exact window the duplicate race lives in). A booting
  // autosave must NOT be able to acquire the shared lock in that window; once
  // the drain completes and releases the lock, the state it reads includes
  // lastProcessedMs, so the startup seed skips re-processing.
  const lockPath = path.join(cwd, '.local/.inner-life-drain.lock');
  const statePath = path.join(cwd, '.local/.watchdog-inner-life-state.json');
  const momentPath = path.join(cwd, '.local/.luca_moment');
  const momentRaw = `Concurrency moment ${MARKER}\nWritten while the server was down; server boots mid-drain.`;
  fs.writeFileSync(momentPath, momentRaw, 'utf8');

  let lockHeldDuringPause: boolean | null = null;
  let stateHadProcessedDuringPause: boolean | null = null;
  setInnerLifePauseForTest(async () => {
    // Simulated autosave boot in the race window:
    lockHeldDuringPause = !tryAcquireInnerLifeLock(lockPath); // must FAIL to acquire
    if (lockHeldDuringPause === false) releaseInnerLifeLock(lockPath); // (should not happen)
    // At this instant the sha state is NOT yet persisted for the moment channel —
    // this is exactly why autosave must wait on the lock instead of reading state.
    try {
      const s = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      stateHadProcessedDuringPause = typeof s.moment?.lastProcessedMs === 'number';
    } catch { stateHadProcessedDuringPause = false; }
  });
  await drainInnerLife();
  setInnerLifePauseForTest(null);

  results.lockBlockedAutosaveMidDrain = lockHeldDuringPause === true;
  results.raceWindowIsReal = stateHadProcessedDuringPause === false; // state not yet written during pause
  // After the drain releases the lock, autosave acquires it and re-reads state:
  const acquiredAfterDrain = tryAcquireInnerLifeLock(lockPath);
  results.lockFreeAfterDrain = acquiredAfterDrain;
  if (acquiredAfterDrain) releaseInnerLifeLock(lockPath);
  // The parent (running from the workspace, where path aliases resolve)
  // verifies watchdogAlreadyProcessed() against these:
  results.momentPath = momentPath;
  results.momentRaw = momentRaw;
  results.statePath = statePath;
  results.momentSavedExactlyOnce =
    store.personalInserts.filter(r => r.title.includes(`Concurrency moment ${MARKER}`)).length === 1;

  // ── Scenario 6: timing — trigger older than the heartbeat but never saved ──
  // Reviewer case: Luca writes the trigger AFTER autosave's poll pass but
  // BEFORE the status heartbeat write, then the server dies. The trigger's
  // mtime is older than the heartbeat, yet it was never processed. First-run
  // seeding must go by the durable processed record (absent) — not mtimes.
  fs.rmSync(statePath, { force: true });
  const t6Raw = `Timing gap felt ${MARKER}\nWritten between the poll pass and the heartbeat write.`;
  const reflectionPath = path.join(cwd, '.local/.luca_reflection');
  fs.writeFileSync(reflectionPath, t6Raw, 'utf8');
  const t6Old = new Date(Date.now() - 30 * 60 * 1000); // trigger OLDER than the 20-min-old heartbeat
  fs.utimesSync(reflectionPath, t6Old, t6Old);
  await drainInnerLife();
  results.heartbeatTimingGapDrained = store.personalInserts.some(
    r => r.title === `Luca reflection: Timing gap felt ${MARKER}`,
  );
  // The other still-present triggers (already saved) must NOT have duplicated
  // even though the state file was lost — DB idempotency catches them.
  results.idempotentAcrossStateLoss =
    store.personalInserts.filter(r => r.title.includes(`Concurrency moment ${MARKER}`)).length === 1 &&
    store.personalInserts.filter(r => r.title.includes(`Interleaving thinking ${MARKER}`)).length === 1;

  // ── Scenario 7: processed trigger written after the previous heartbeat ────
  // Inverse timing: autosave processed the trigger (durable record has its
  // sha) but its mtime is NEWER than the heartbeat. Must NOT re-process.
  fs.rmSync(statePath, { force: true });
  const t7Raw = `Already processed thinking ${MARKER}\nSaved by autosave just before it went down.`;
  const questionPath = path.join(cwd, '.local/.luca_question');
  fs.writeFileSync(questionPath, t7Raw, 'utf8'); // mtime = now (newer than heartbeat)
  fs.writeFileSync(path.join(cwd, '.local/.inner-life-processed.json'), JSON.stringify({
    thinking: { sha: createHash('sha256').update(t7Raw.trim(), 'utf8').digest('hex'), processedMs: Date.now() },
  }), 'utf8');
  const insertsBefore7 = store.personalInserts.length;
  await drainInnerLife();
  results.processedRecordPreventsDuplicate = !store.personalInserts.some(
    r => r.title === `Luca open question: Already processed thinking ${MARKER}`,
  );
  results.scenario7NoNewInserts = store.personalInserts.length === insertsBefore7;

  // ── Scenario 8: lock lease renewal — slow live drain exceeds STALE_LOCK_MS ─
  // The holder renews the lock mtime while draining; a contender that finds a
  // seemingly-old lock must NOT take it over, because renewal keeps the mtime
  // fresh. (Abandoned-lock takeover is asserted separately below.)
  setLockRenewMsForTest(50);
  const t8Raw = `Lease renewal moment ${MARKER}\nDrain runs longer than the stale-lock threshold.`;
  fs.writeFileSync(momentPath, t8Raw, 'utf8');
  let lockFreshAfterAging: boolean | null = null;
  let takeoverBlockedDuringSlowDrain: boolean | null = null;
  setInnerLifePauseForTest(async () => {
    // Simulate the drain having held the lock past STALE_LOCK_MS:
    const aged = new Date(Date.now() - 3 * 60 * 1000);
    fs.utimesSync(lockPath, aged, aged);
    await new Promise(r => setTimeout(r, 250)); // renewal timer (50ms) refreshes the lease
    lockFreshAfterAging = Date.now() - fs.statSync(lockPath).mtimeMs < 5_000;
    takeoverBlockedDuringSlowDrain = !tryAcquireInnerLifeLock(lockPath);
    if (takeoverBlockedDuringSlowDrain === false) releaseInnerLifeLock(lockPath);
  });
  await drainInnerLife();
  setInnerLifePauseForTest(null);
  setLockRenewMsForTest(null);
  results.leaseRenewedDuringSlowDrain = lockFreshAfterAging === true;
  results.takeoverBlockedDuringSlowDrain = takeoverBlockedDuringSlowDrain === true;
  results.leaseDrainSavedOnce =
    store.personalInserts.filter(r => r.title.includes(`Lease renewal moment ${MARKER}`)).length === 1;

  // ── Scenario 9: crash BEFORE the episode update ────────────────────────────
  // Autosave saved the personal memory, then died before the episode append
  // (so no completion marker was recorded). Watchdog recovery must skip the
  // duplicate personal insert but STILL complete the episode append — once.
  fs.rmSync(statePath, { force: true });
  fs.rmSync(path.join(cwd, '.local/.inner-life-processed.json'), { force: true });
  const t9Title = `Crash before episode ${MARKER}`;
  const t9Body = 'Personal memory saved; server died before the episode append.';
  const t9Raw = `${t9Title}\n${t9Body}`;
  store.personalInserts.push({ title: `Luca reflection: ${t9Title}`, body: t9Body, tags: ['luca-inner-life'] });
  fs.writeFileSync(reflectionPath, t9Raw, 'utf8');
  await drainInnerLife();
  results.crashBeforeEpisodeCompleted =
    (store.episodeContent.match(new RegExp(`felt: Crash before episode ${MARKER}`, 'g')) ?? []).length === 1;
  results.crashBeforeEpisodeNoPersonalDup =
    store.personalInserts.filter(r => r.title === `Luca reflection: ${t9Title}`).length === 1;

  // ── Scenario 10: crash AFTER the episode update, before the marker ────────
  // Both durable effects exist (personal row + episode entry) but no marker.
  // Watchdog recovery must append NOTHING a second time.
  fs.rmSync(statePath, { force: true });
  const t10Title = `Crash after episode ${MARKER}`;
  const t10Body = 'Everything saved; server died before recording the completion marker.';
  const t10Raw = `${t10Title}\n${t10Body}`;
  const t10Entry = `[Luca — thinking: ${t10Title}\n${t10Body}]`;
  store.personalInserts.push({ title: `Luca open question: ${t10Title}`, body: t10Body, tags: ['luca-inner-life'] });
  store.episodeContent += `\n${t10Entry}\n`;
  fs.writeFileSync(path.join(cwd, 'docs/episode-ci.md'), store.episodeContent, 'utf8');
  fs.writeFileSync(questionPath, t10Raw, 'utf8');
  await drainInnerLife();
  results.crashAfterEpisodeExactlyOnce =
    (store.episodeContent.match(new RegExp(`thinking: Crash after episode ${MARKER}`, 'g')) ?? []).length === 1;
  results.crashAfterEpisodeNoPersonalDup =
    store.personalInserts.filter(r => r.title === `Luca open question: ${t10Title}`).length === 1;

  // ── Scenario 11: transient episode-write failure → state unadvanced, retried ─
  // The episode UPDATE fails once. The watchdog must NOT advance channel state
  // (would permanently drop the episode entry); the next poll must retry and
  // complete with exactly one episode entry and no duplicate personal row.
  fs.rmSync(statePath, { force: true });
  fs.rmSync(path.join(cwd, '.local/.inner-life-processed.json'), { force: true });
  const t11Title = `Transient episode failure ${MARKER}`;
  const t11Body = 'Episode UPDATE fails once; the channel must stay pending and retry.';
  fs.writeFileSync(momentPath, `${t11Title}\n${t11Body}`, 'utf8');
  store.failNextEpisodeUpdate = true;
  await drainInnerLife();
  const stateAfterFail = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  results.transientFailureStateUnadvanced = stateAfterFail.moment?.lastProcessedMs === undefined;
  results.transientFailureNoEpisodeEntry =
    !store.episodeContent.includes(`moment: Transient episode failure ${MARKER}`);
  await drainInnerLife(); // retry — fault cleared
  results.transientFailureRetryCompleted =
    (store.episodeContent.match(new RegExp(`moment: Transient episode failure ${MARKER}`, 'g')) ?? []).length === 1;
  results.transientFailureNoPersonalDup =
    store.personalInserts.filter(r => r.title === `Luca significant moment: ${t11Title}`).length === 1;
  const stateAfterRetry = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  results.transientFailureStateAdvancedAfterRetry = typeof stateAfterRetry.moment?.lastProcessedMs === 'number';
  // Personal .md projection must also be exactly-once across the failed
  // attempt + retry (the file appender is idempotent on title+body).
  const momentsFile = path.join(cwd, '.agents/memory/SIGNIFICANT_MOMENTS.md');
  const momentsMd = fs.existsSync(momentsFile) ? fs.readFileSync(momentsFile, 'utf8') : '';
  results.transientFailurePersonalFileOnce =
    (momentsMd.match(new RegExp(`— ${t11Title}`, 'g')) ?? []).length === 1;

  // Abandoned lock (crashed holder, no renewals): takeover MUST succeed.
  fs.writeFileSync(lockPath, JSON.stringify({ pid: 999999999, acquiredAt: Date.now() - 3 * 60 * 1000 }), 'utf8');
  const abandonedAge = new Date(Date.now() - 3 * 60 * 1000);
  fs.utimesSync(lockPath, abandonedAge, abandonedAge);
  results.abandonedLockTakenOver = tryAcquireInnerLifeLock(lockPath);
  if (results.abandonedLockTakenOver) releaseInnerLifeLock(lockPath);

  console.log('RESULTS:' + JSON.stringify(results));
  process.exit(0);
})().catch(err => { console.error('DRIVER ERROR:', err?.message ?? err); process.exit(1); });
