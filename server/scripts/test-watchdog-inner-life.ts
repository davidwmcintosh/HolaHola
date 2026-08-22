#!/usr/bin/env npx tsx
/**
 * test-watchdog-inner-life.ts
 *
 * Hermetic CI for the capture-watchdog inner-life drain (Task #1235):
 *
 *   1. First-run lossless handoff — a trigger written AFTER the autosave
 *      heartbeat went quiet is drained on the watchdog's first run (not
 *      silently discarded by seed-only logic).
 *   2. Chat + inner-life interleaving — the chat-capture episode append is
 *      DB-first, so a subsequent inner-life DB-first append derives the .md
 *      from DB content that already includes the chat turns. Nothing is erased.
 *   3. Idempotency — re-running the drain with unchanged triggers inserts no
 *      duplicate rows.
 *   4. Restart dedup — agent-session-autosave's watchdogAlreadyProcessed()
 *      returns true only for content the watchdog actually processed
 *      (sha match + lastProcessedMs), so a server restart cannot double-save.
 *
 * Hermetic setup: the watchdog resolves its .local/docs paths from
 * process.cwd(), so the drain scenarios run in a spawned driver process
 * (test-watchdog-inner-life-driver.ts) with a temp cwd, and the watchdog's
 * neon client is replaced with an in-memory fake (setDbForTest) — no shared
 * database rows are created. The restart-dedup guard is tested against a
 * temp trigger + temp state file only.
 */

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createHash } from 'crypto';

const WORKSPACE = '/home/runner/workspace';
const MARKER = `wdtest-${Date.now()}`;

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

(async () => {
  console.log('watchdog inner-life CI — drain scenarios (hermetic temp cwd)');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wd-il-'));
  const run = spawnSync('npx', ['tsx', path.join(WORKSPACE, 'server/scripts/test-watchdog-inner-life-driver.ts')], {
    cwd: tmp,
    env: { ...process.env, WD_TEST_MARKER: MARKER },
    encoding: 'utf8',
    timeout: 180_000,
  });
  const out = (run.stdout ?? '') + (run.stderr ?? '');
  const m = /RESULTS:(\{.*\})/.exec(out);
  if (!m) {
    console.error(out);
    console.error('FAIL — driver produced no results');
    process.exit(1);
  }
  const r = JSON.parse(m[1]);

  check('first-run drains a trigger written after the heartbeat went quiet', r.firstRunDrained === true);
  check('personal memory rows carry the luca-inner-life tag', r.firstRunTagsCorrect === true);
  check('first-run entry routed to episode DB content', r.firstRunInEpisodeDb === true);
  check('.md is derived from DB after first-run drain', r.mdMatchesDb1 === true);
  check('watchdog re-embeds the new personal memory row', r.firstRunReembeddedPersonal === true);
  check('watchdog re-embeds the updated rolling episode row', r.firstRunReembeddedEpisode === true);
  check('chat turns survive a subsequent inner-life append (interleaving)', r.chatTurnsPreserved === true);
  check('inner-life entry appended alongside chat turns', r.thinkingAppended === true);
  check('.md still a projection of DB content after interleaving', r.mdMatchesDb2 === true);
  check('re-running the drain inserts no duplicate rows', r.noDuplicates === true);
  check('concurrency: lock blocks a booting autosave mid-drain (DB done, state not yet saved)', r.lockBlockedAutosaveMidDrain === true);
  check('concurrency: race window is real (state lacked lastProcessedMs during pause)', r.raceWindowIsReal === true);
  check('concurrency: lock released after drain completes', r.lockFreeAfterDrain === true);
  check('concurrency: entry saved exactly once', r.momentSavedExactlyOnce === true);
  check('timing: trigger older than heartbeat but never saved is still drained (processed-record handoff)',
    r.heartbeatTimingGapDrained === true);
  check('timing: already-saved triggers do not duplicate after state loss (DB idempotency)',
    r.idempotentAcrossStateLoss === true);
  check('timing: processed trigger newer than heartbeat is NOT re-processed (sha in processed record)',
    r.processedRecordPreventsDuplicate === true);
  check('timing: processed-record scenario inserts nothing new', r.scenario7NoNewInserts === true);
  check('lease: slow drain past STALE_LOCK_MS keeps the lock mtime fresh via renewal',
    r.leaseRenewedDuringSlowDrain === true);
  check('lease: contender cannot take over a live slow drain', r.takeoverBlockedDuringSlowDrain === true);
  check('lease: slow-drain entry saved exactly once', r.leaseDrainSavedOnce === true);
  check('lease: abandoned lock (crashed holder, no renewals) IS taken over', r.abandonedLockTakenOver === true);
  check('fault: crash before episode update — recovery completes the episode append exactly once',
    r.crashBeforeEpisodeCompleted === true);
  check('fault: crash before episode update — personal row not duplicated', r.crashBeforeEpisodeNoPersonalDup === true);
  check('fault: crash after episode update — entry NOT appended a second time',
    r.crashAfterEpisodeExactlyOnce === true);
  check('fault: crash after episode update — personal row not duplicated', r.crashAfterEpisodeNoPersonalDup === true);
  check('fault: transient episode failure — watchdog state NOT advanced', r.transientFailureStateUnadvanced === true);
  check('fault: transient episode failure — no episode entry on failed attempt', r.transientFailureNoEpisodeEntry === true);
  check('fault: transient episode failure — retry completes the episode append exactly once',
    r.transientFailureRetryCompleted === true);
  check('fault: transient episode failure — personal row not duplicated on retry', r.transientFailureNoPersonalDup === true);
  check('fault: transient episode failure — state advanced only after successful retry',
    r.transientFailureStateAdvancedAfterRetry === true);
  check('fault: transient episode failure — personal .md entry appears exactly once', r.transientFailurePersonalFileOnce === true);
  check('canonical collision: trigger files + record-exchange yield one episode copy per channel',
    r.collisionEpisodeExactlyOnce === true);
  check('canonical collision: matching intent defers direct trigger append until canonical episode commit',
    r.collisionPendingBeforeCanonical === true);
  check('canonical collision: all single-line channel text survives complete (>200 chars)',
    r.collisionEpisodeComplete === true);
  check('canonical collision: no truncated/repeated legacy direct entries are appended',
    r.collisionNoLegacyDirectEntries === true);
  check('canonical collision: personal DB rows preserve each complete channel exactly once',
    r.collisionPersonalDbCompleteOnce === true);
  check('canonical collision: personal files preserve each complete channel exactly once',
    r.collisionPersonalFilesCompleteOnce === true);
  check('canonical collision: episode .md remains an exact DB projection',
    r.collisionMdMatchesDb === true);
  check('canonical omission: a later Luca output without the pending channel uses direct fallback once',
    r.omittedChannelFallsBackExactlyOnce === true);
  check('canonical crash: dead intent owner before chat append uses direct fallback once',
    r.crashedIntentFallsBackExactlyOnce === true);
  check('retention: captured handoffs older than 14 days are removed before resolver scans',
    r.retentionPrunesExpiredCapturedBeforeResolverScan === true);
  check('retention: old pending handoffs remain available for crash recovery',
    r.retentionKeepsOldPendingRecoverable === true);
  check('chat fault: episode failure leaves chat cursor unadvanced',
    r.chatFailureCursorUnadvanced === true);
  check('chat fault: first attempt creates one idempotent conversation row',
    r.chatFailureOneDbRow === true);
  check('chat fault: retry does not duplicate the conversation row',
    r.chatRetryNoDuplicateDbRow === true);
  check('chat fault: retry appends each episode turn exactly once',
    r.chatRetryEpisodeExactlyOnce === true);
  check('chat fault: cursor advances only after episode success',
    r.chatRetryCursorAdvanced === true);
  check('re-embed fault: cursor remains pending after embedding failure',
    r.reembedFailureCursorUnadvanced === true);
  check('re-embed fault: first attempt creates one conversation row',
    r.reembedFailureOneDbRow === true);
  check('re-embed fault: first attempt appends each episode turn once',
    r.reembedFailureOneEpisode === true);
  check('re-embed fault: retry does not duplicate the conversation row',
    r.reembedRetryNoDuplicateDbRow === true);
  check('re-embed fault: retry does not duplicate episode text',
    r.reembedRetryEpisodeExactlyOnce === true);
  check('re-embed fault: cursor advances after successful retry',
    r.reembedRetryCursorAdvanced === true);
  check('re-embed path receives the chat conversation row ID',
    r.reembedRetryReembeddedChat === true);
  check('re-embed path receives the updated rolling episode row ID',
    r.reembedRetryReembeddedEpisode === true);
  check('lookup fault: null rolling episode leaves chat cursor pending',
    r.nullLookupLeavesChatCursorPending === true);
  check('lookup fault: null rolling episode leaves inner-life channel pending',
    r.nullLookupLeavesInnerLifePending === true);
  check('lookup fault: retry completes chat and inner-life after recovery',
    r.nullLookupRecoveryCompletes === true);
  check('event identity: two identical successive exchanges are both preserved',
    r.identicalSuccessiveExchangesPreserved === true);

  // Post-recovery seed check (parent runs from the workspace so path aliases resolve):
  // after the drain released the lock, the autosave startup seed reads state that
  // now carries lastProcessedMs → it must skip re-processing the same content.
  {
  const { watchdogAlreadyProcessed } = await import('../services/agent-session-autosave');
    check('concurrency: post-recovery seed sees lastProcessedMs and skips re-processing',
      watchdogAlreadyProcessed(r.momentPath, String(r.momentRaw).trim(), r.statePath) === true);
  }

  // ── Scenario 4: restart dedup guard (temp trigger + temp state file) ──────
  const { watchdogAlreadyProcessed } = await import('../services/agent-session-autosave');
  const reflectionPath = path.join(tmp, '.luca_reflection'); // basename-keyed, temp copy
  const statePath = path.join(tmp, 'wd-state.json');
  const raw = `Restart dedup fixture ${MARKER}\nWritten and drained by the watchdog while the server was down.\n`;
  fs.writeFileSync(reflectionPath, raw, 'utf8');
  const sha = createHash('sha256').update(raw, 'utf8').digest('hex');
  fs.writeFileSync(statePath, JSON.stringify({ felt: { mtimeMs: 1, sha, lastProcessedMs: Date.now() } }), 'utf8');
  check('restart dedup: guard blocks re-processing of watchdog-drained content',
    watchdogAlreadyProcessed(reflectionPath, raw.trim(), statePath) === true);
  fs.writeFileSync(statePath, JSON.stringify({ felt: { mtimeMs: 1, sha } }), 'utf8');
  check('restart dedup: seeded-but-unprocessed content is NOT blocked',
    watchdogAlreadyProcessed(reflectionPath, raw.trim(), statePath) === false);
  fs.writeFileSync(statePath, JSON.stringify({ felt: { mtimeMs: 1, sha: 'stale', lastProcessedMs: Date.now() } }), 'utf8');
  check('restart dedup: changed content is NOT blocked',
    watchdogAlreadyProcessed(reflectionPath, raw.trim(), statePath) === false);

  // ── Scenario 5: startup seed never bypasses the lock on timeout ───────────
  // Hold the lock (as a watchdog drain would) PAST the startup wait window,
  // then release it before the first poll. The seed must not run while the
  // lock is held (no timeout bypass) and must complete only after release —
  // so the state it reads includes the watchdog's lastProcessedMs and no
  // duplicate write can follow.
  {
    const { seedInnerLifeTriggerState, _innerLifeSeedCompleteForTest, _resetInnerLifeSeedCompleteForTest } =
      await import('../services/agent-session-autosave');
    const seedLockPath = path.join(tmp, 'seed-test.lock');
    fs.writeFileSync(seedLockPath, JSON.stringify({ pid: 999999999, acquiredAt: Date.now() }), 'utf8');
    _resetInnerLifeSeedCompleteForTest();
    const seedPromise = seedInnerLifeTriggerState(seedLockPath, 400); // 400ms wait window
    await new Promise(res => setTimeout(res, 1200)); // hold well past the timeout
    check('seed timeout does NOT bypass the lock (seed incomplete while lock held)',
      _innerLifeSeedCompleteForTest() === false);
    fs.unlinkSync(seedLockPath); // watchdog drain finishes and releases
    await seedPromise;
    check('seed completes only after the lock is released',
      _innerLifeSeedCompleteForTest() === true);
    check('poll gating: inner-life poll pass requires completed seed (gate flag set)',
      _innerLifeSeedCompleteForTest() === true);
  }

  // ── Scenario 6: autosave records the marker only after ALL effects succeed ─
  // Fault injection on the autosave side: when the episode append fails, the
  // processed-record marker must NOT be written (the watchdog can then recover
  // the capture); when everything succeeds, it must be written.
  {
    const autosave = await import('../services/agent-session-autosave');
    const processedPath = path.join(process.cwd(), '.local/.inner-life-processed.json');
    const processedBackup = fs.existsSync(processedPath) ? fs.readFileSync(processedPath) : null;
    const trigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wd-marker-'));
    const trigPath = path.join(trigDir, '.luca_reflection');
    try {
      autosave.setCanonicalFourChannelRouteForTest(false);
      autosave.setLucaPersonalSideEffectsEnabled(false); // no DB personal writes in CI
      autosave.setReflectionPathOverrideForTest(trigPath);

      // Failure case: episode override points at a nonexistent episode file →
      // appendInnerLifeToEpisodeDb returns false → marker must NOT be recorded.
      autosave.setInnerLifeRollingEpisodeOverride('episode-nonexistent-ci.md');
      fs.rmSync(processedPath, { force: true });
      fs.writeFileSync(trigPath, 'Marker ordering failure case\nEpisode append will fail.', 'utf8');
      autosave.setReflectionLastMtimeForTest(1);
      await autosave.checkLucaReflection();
      const recAfterFail = fs.existsSync(processedPath)
        ? JSON.parse(fs.readFileSync(processedPath, 'utf8')) : {};
      check('marker ordering: episode-append failure leaves the processed marker UNRECORDED',
        recAfterFail.felt === undefined);

      // Retry case: the trigger file is NOT touched. Because the failure rolled
      // the mtime cursor back, the very next poll of the UNCHANGED trigger must
      // retry; with the fault cleared (no episode routing) all effects succeed
      // and the marker is recorded — exactly-one eventual completion.
      autosave.setInnerLifeRollingEpisodeOverride(null);
      await autosave.checkLucaReflection();
      const recAfterOk = fs.existsSync(processedPath)
        ? JSON.parse(fs.readFileSync(processedPath, 'utf8')) : {};
      check('marker ordering: unchanged trigger is RETRIED after transient failure (mtime rollback) and marker recorded on success',
        typeof recAfterOk.felt?.sha === 'string');
    } finally {
      autosave.setCanonicalFourChannelRouteForTest(null);
      autosave.setReflectionPathOverrideForTest(null);
      autosave.setInnerLifeRollingEpisodeOverride(null);
      fs.rmSync(trigDir, { recursive: true, force: true });
      if (processedBackup) fs.writeFileSync(processedPath, processedBackup);
      else fs.rmSync(processedPath, { force: true });
    }
  }

  // ── Scenario 7: autosave retry with personal side effects ENABLED ─────────
  // Hermetic fault injection: fake personal-memory DB + redirected personal
  // .md dir. Episode append fails once; the retry of the UNCHANGED trigger
  // must yield exactly one DB personal row, one personal-file entry, one
  // (eventual) marker — never duplicates.
  {
    const autosave = await import('../services/agent-session-autosave');
    const processedPath = path.join(process.cwd(), '.local/.inner-life-processed.json');
    const processedBackup = fs.existsSync(processedPath) ? fs.readFileSync(processedPath) : null;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wd-personal-'));
    const trigPath = path.join(dir, '.luca_reflection');
    // In-memory fake DB for savePersonalMemory (dedup SELECT + INSERT).
    const dbRows: Array<{ title: string; content: string }> = [];
    const fakeDb = {
      execute: async (q: any) => {
        const chunks: any[] = (q as any).queryChunks ?? [];
        const text = chunks.map(c => (Array.isArray(c?.value) ? c.value.join('') : '')).join(' ');
        // Params appear as plain values between StringChunk objects ({ value: string[] }).
        const params = chunks
          .filter(c => !(c && typeof c === 'object' && Array.isArray((c as any).value)))
          .map(c => (c && typeof c === 'object' && 'value' in c ? (c as any).value : c));
        if (text.includes('SELECT id FROM conversation_memories')) {
          const hit = dbRows.find(r => r.title === params[0] && r.content === params[1]);
          return { rows: hit ? [{ id: 'fake-id' }] : [] };
        }
        if (text.includes('INSERT INTO conversation_memories')) {
          dbRows.push({ title: params[0], content: params[2] });
          return { rows: [] };
        }
        throw new Error('fake personal DB got unexpected query: ' + text.slice(0, 80));
      },
    };
    try {
      autosave.setCanonicalFourChannelRouteForTest(false);
      autosave.setLucaPersonalSideEffectsEnabled(true);
      autosave.setPersonalMemoryDbForTest(fakeDb);
      autosave.setPersonalFilesDirForTest(dir);
      autosave.setReflectionPathOverrideForTest(trigPath);
      autosave.setInnerLifeRollingEpisodeOverride('episode-nonexistent-ci.md'); // episode append fails
      fs.rmSync(processedPath, { force: true });

      const title = 'Side-effects retry case';
      const body = 'Episode fails once; retry must not duplicate personal effects.';
      fs.writeFileSync(trigPath, `${title}\n${body}`, 'utf8');
      autosave.setReflectionLastMtimeForTest(1);
      await autosave.checkLucaReflection(); // fails at episode step
      const recFail = fs.existsSync(processedPath) ? JSON.parse(fs.readFileSync(processedPath, 'utf8')) : {};
      check('side-effects fault: marker absent after episode failure', recFail.felt === undefined);

      autosave.setInnerLifeRollingEpisodeOverride(null); // fault cleared
      await autosave.checkLucaReflection(); // unchanged trigger — must retry & complete
      const recOk = fs.existsSync(processedPath) ? JSON.parse(fs.readFileSync(processedPath, 'utf8')) : {};
      check('side-effects fault: marker recorded after successful retry', typeof recOk.felt?.sha === 'string');
      check('side-effects fault: exactly one DB personal row across failure + retry',
        dbRows.filter(r => r.title === `Luca reflection: ${title}`).length === 1);
      const reflectionsMd = fs.existsSync(path.join(dir, 'REFLECTIONS.md'))
        ? fs.readFileSync(path.join(dir, 'REFLECTIONS.md'), 'utf8') : '';
      check('side-effects fault: exactly one personal .md entry across failure + retry',
        (reflectionsMd.match(new RegExp(`— ${title}`, 'g')) ?? []).length === 1);
    } finally {
      autosave.setCanonicalFourChannelRouteForTest(null);
      autosave.setLucaPersonalSideEffectsEnabled(false);
      autosave.setPersonalMemoryDbForTest(null);
      autosave.setPersonalFilesDirForTest(null);
      autosave.setReflectionPathOverrideForTest(null);
      autosave.setInnerLifeRollingEpisodeOverride(null);
      fs.rmSync(dir, { recursive: true, force: true });
      if (processedBackup) fs.writeFileSync(processedPath, processedBackup);
      else fs.rmSync(processedPath, { force: true });
    }
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  if (failures > 0) {
    console.error(`\nFAILED — ${failures} assertion(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll assertions passed.');
  process.exit(0);
})();
