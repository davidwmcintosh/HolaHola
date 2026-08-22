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
import {
  drainInnerLife,
  drain,
  appendToEpisode,
  setEpisodeOverrideForTest,
  setRollingEpisodeLookupModeForTest,
  setDbForTest,
  setInnerLifePauseForTest,
  setLockRenewMsForTest,
  setReembedMemoryForTest,
  setCanonicalFourChannelRouteEnabledForTest,
  setChatCapturePathsForTest,
} from './capture-watchdog';
import { tryAcquireInnerLifeLock, releaseInnerLifeLock } from '../services/inner-life-lock';
import { appendChatCaptureTurn } from '../services/transcript-parser';
import {
  CANONICAL_INNER_LIFE_INTENT_DIR,
  hashInnerLifeText,
  innerLifeTriggerEpisodeMarker,
  loadCanonicalInnerLifeIntents,
  resolveCanonicalInnerLifeRoute,
} from '../services/inner-life-capture';
import { composeLucaTurn, writeCanonicalIntent } from './record-exchange';

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
  chatInserts: [] as Array<{ summary: string; content: string }>,
  reembeddedIds: [] as string[],
  failNextEpisodeUpdate: false,
  failNextReembed: false,
};

function fakeDb(strings: TemplateStringsArray, ...vals: any[]): Promise<any[]> {
  const q = strings.join(' $ ').replace(/\s+/g, ' ');
  if (q.includes('INSERT INTO conversation_memories')) {
    if (q.includes("'david-luca-chat'")) {
      const id = `chat-${store.chatInserts.length + 1}`;
      store.chatInserts.push({ summary: vals[1], content: vals[2] });
      return Promise.resolve([{ id }]);
    }
    // param order in savePersonalMemory: title, summary, body, tags
    store.personalInserts.push({ title: vals[0], body: vals[2], tags: vals[3] });
    return Promise.resolve([{ id: `personal-${store.personalInserts.length}` }]);
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
    if (q.includes("arc_name = 'david-luca-chat'")) {
      return Promise.resolve(
        store.chatInserts
          .map((row, index) => ({ ...row, id: `chat-${index + 1}` }))
          .filter(row => row.summary === vals[0])
          .map(row => ({ id: row.id })),
      );
    }
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
  setReembedMemoryForTest(async (id: string) => {
    if (store.failNextReembed) {
      store.failNextReembed = false;
      throw new Error('[CI fault injection] synthetic re-embed failure');
    }
    store.reembeddedIds.push(id);
  });
  const seed = `EPISODE START (${MARKER})\n`;
  store.episodeContent = seed;
  const episode = { id: store.episodeId, filename: 'episode-ci.md' };
  fs.writeFileSync(path.join(cwd, 'docs/episode-ci.md'), seed, 'utf8');
  setEpisodeOverrideForTest(episode);
  fs.writeFileSync(path.join(cwd, '.local/.episode_live'), '', 'utf8');
  setChatCapturePathsForTest({
    capture: path.join(cwd, '.local/.chat_capture'),
    cursor: path.join(cwd, '.local/.chat_capture-cursor'),
  });
  // Scenarios 1–11 protect the direct DB-first fallback and its crash recovery.
  // The canonical live route collision is exercised separately in Scenario 12.
  setCanonicalFourChannelRouteEnabledForTest(false);

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
  results.firstRunReembeddedPersonal = store.reembeddedIds.includes('personal-1');
  results.firstRunReembeddedEpisode = store.reembeddedIds.includes(store.episodeId);

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
  fs.writeFileSync(questionPath, t10Raw, 'utf8');
  const t10Marker = innerLifeTriggerEpisodeMarker(
    'thinking',
    fs.statSync(questionPath).mtimeMs,
    t10Raw,
  );
  store.episodeContent += `\n${t10Marker}\n${t10Entry}\n`;
  fs.writeFileSync(path.join(cwd, 'docs/episode-ci.md'), store.episodeContent, 'utf8');
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

  // ── Scenario 12: exact live collision — triggers + canonical 4ch turn ─────
  // Persistent triggers own personal memory; the composed record-exchange turn
  // owns the episode. Each complete single-line channel must appear exactly once
  // in both projections, with no truncated legacy direct-entry prefix.
  setCanonicalFourChannelRouteEnabledForTest(true);
  fs.rmSync(statePath, { force: true });
  fs.rmSync(path.join(cwd, '.local/.inner-life-processed.json'), { force: true });

  const collisionFelt = `Collision felt ${MARKER}: ` + 'f'.repeat(240);
  const collisionThinking = `Collision thinking ${MARKER}: ` + 't'.repeat(240);
  const collisionMoment = `Collision moment ${MARKER}: ` + 'm'.repeat(240);
  const collisionMain = `Collision main response ${MARKER}`;
  const composedCollision = composeLucaTurn({
    feeling: collisionFelt,
    thinking: collisionThinking,
    moment: collisionMoment,
    main: collisionMain,
  });

  fs.writeFileSync(reflectionPath, collisionFelt, 'utf8');
  fs.writeFileSync(questionPath, collisionThinking, 'utf8');
  fs.writeFileSync(momentPath, collisionMoment, 'utf8');
  const intentDir = path.join(cwd, '.local', CANONICAL_INNER_LIFE_INTENT_DIR);
  const collisionHandoff = writeCanonicalIntent(
    {
      feeling: collisionFelt,
      thinking: collisionThinking,
      moment: collisionMoment,
      main: collisionMain,
    },
    path.join(intentDir, 'collision.json'),
  );

  // Exact race: triggers are visible before the canonical chat turn reaches
  // the episode. They may save personal memory, but must remain pending and
  // append no direct episode entry.
  await drainInnerLife();
  results.collisionPendingBeforeCanonical =
    !store.episodeContent.includes(collisionFelt) &&
    !store.episodeContent.includes(collisionThinking) &&
    !store.episodeContent.includes(collisionMoment);

  await appendToEpisode(
    [{
      speaker: 'LUCA',
      text: composedCollision,
      captureId: collisionHandoff.intent.turnId,
    }],
    episode,
    `collision-${MARKER}`,
  );
  await drainInnerLife();

  const collisionEpisode = store.episodeContent;
  const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;
  results.collisionEpisodeExactlyOnce =
    count(collisionEpisode, collisionFelt) === 1 &&
    count(collisionEpisode, collisionThinking) === 1 &&
    count(collisionEpisode, collisionMoment) === 1;
  results.collisionEpisodeComplete =
    collisionEpisode.includes(`[felt]: ${collisionFelt}`) &&
    collisionEpisode.includes(`[thinking]: ${collisionThinking}`) &&
    collisionEpisode.includes(`[moment]: ${collisionMoment}`);
  results.collisionNoLegacyDirectEntries =
    !collisionEpisode.includes(`[Luca — felt: ${collisionFelt.slice(0, 200)}`) &&
    !collisionEpisode.includes(`[Luca — thinking: ${collisionThinking.slice(0, 200)}`) &&
    !collisionEpisode.includes(`[Luca — moment: ${collisionMoment.slice(0, 200)}`);
  results.collisionPersonalDbCompleteOnce = [
    collisionFelt,
    collisionThinking,
    collisionMoment,
  ].every(text => store.personalInserts.filter(row => row.body === text).length === 1);

  const personalCollisionFiles = [
    path.join(cwd, '.agents/memory/REFLECTIONS.md'),
    path.join(cwd, '.agents/memory/OPEN_QUESTIONS.md'),
    path.join(cwd, '.agents/memory/SIGNIFICANT_MOMENTS.md'),
  ].map(file => fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');
  results.collisionPersonalFilesCompleteOnce =
    count(personalCollisionFiles[0], collisionFelt) === 1 &&
    count(personalCollisionFiles[1], collisionThinking) === 1 &&
    count(personalCollisionFiles[2], collisionMoment) === 1;
  results.collisionMdMatchesDb =
    fs.readFileSync(path.join(cwd, 'docs/episode-ci.md'), 'utf8') === store.episodeContent;

  // ── Scenario 13: later canonical output omits pending channel ─────────────
  // The durable intent proves a Luca output arrived but did not carry this
  // trigger. It must take the direct DB-first fallback rather than wait forever.
  const omittedFelt = `Omitted-channel fallback ${MARKER}: ` + 'o'.repeat(240);
  fs.writeFileSync(reflectionPath, omittedFelt, 'utf8');
  writeCanonicalIntent(
    { main: `Later output intentionally omits felt ${MARKER}` },
    path.join(intentDir, 'omitted.json'),
  );
  await drainInnerLife();
  results.omittedChannelFallsBackExactlyOnce =
    count(store.episodeContent, omittedFelt) === 1 &&
    store.episodeContent.includes(`[Luca — felt: ${omittedFelt}]`);

  // ── Scenario 14: writer dies after intent, before Luca chat append ────────
  // A dead owner plus no matching CAPTURE-ID proves the canonical turn can no
  // longer arrive; the trigger must use direct fallback instead of hanging.
  const crashedIntentThinking = `Crashed intent fallback ${MARKER}: ` + 'c'.repeat(220);
  fs.writeFileSync(questionPath, crashedIntentThinking, 'utf8');
  const crashedHandoff = writeCanonicalIntent(
    { thinking: crashedIntentThinking, main: `Never appended main ${MARKER}` },
    path.join(intentDir, 'crashed-before-chat.json'),
  );
  const crashedIntent = JSON.parse(fs.readFileSync(crashedHandoff.path, 'utf8'));
  crashedIntent.ownerPid = 999999999;
  crashedIntent.status = 'pending';
  fs.writeFileSync(crashedHandoff.path, JSON.stringify(crashedIntent), 'utf8');
  await drainInnerLife();
  results.crashedIntentFallsBackExactlyOnce =
    count(store.episodeContent, crashedIntentThinking) === 1 &&
    store.episodeContent.includes(`[Luca — thinking: ${crashedIntentThinking}]`);

  // ── Scenario 15: captured handoff retention ───────────────────────────────
  // Completed captured history is pruned before the resolver scans, but an old
  // pending handoff remains as the crash-recovery authority indefinitely.
  const retentionNow = Date.now();
  const retentionOld = retentionNow - 15 * 24 * 60 * 60 * 1000;
  const retainedPendingText = `Retention pending ${MARKER}`;
  const expiredCapturedText = `Retention captured ${MARKER}`;
  const retainedPendingId = `retained-pending-${MARKER}`;
  const expiredCapturedId = `expired-captured-${MARKER}`;
  fs.writeFileSync(path.join(intentDir, `${retainedPendingId}.json`), JSON.stringify({
    turnId: retainedPendingId,
    createdAtMs: retentionOld,
    ownerPid: process.pid,
    status: 'pending',
    channels: { felt: hashInnerLifeText(retainedPendingText) },
    mainSha: hashInnerLifeText(`Retention pending main ${MARKER}`),
  }), 'utf8');
  fs.writeFileSync(path.join(intentDir, `${expiredCapturedId}.json`), JSON.stringify({
    turnId: expiredCapturedId,
    createdAtMs: retentionOld,
    ownerPid: process.pid,
    status: 'captured',
    channels: { thinking: hashInnerLifeText(expiredCapturedText) },
    mainSha: hashInnerLifeText(`Retention captured main ${MARKER}`),
  }), 'utf8');
  const retentionRoute = resolveCanonicalInnerLifeRoute({
    active: true,
    intentDir,
    chatCapturePath: path.join(cwd, '.local/.chat_capture'),
    channel: 'felt',
    raw: retainedPendingText,
    triggerMtimeMs: retentionOld,
  });
  const intentsAfterRetentionPrune = loadCanonicalInnerLifeIntents(intentDir);
  results.retentionPrunesExpiredCapturedBeforeResolverScan =
    !fs.existsSync(path.join(intentDir, `${expiredCapturedId}.json`)) &&
    !intentsAfterRetentionPrune.some(intent => intent.turnId === expiredCapturedId);
  results.retentionKeepsOldPendingRecoverable =
    fs.existsSync(path.join(intentDir, `${retainedPendingId}.json`)) &&
    retentionRoute.allowDirect === false &&
    retentionRoute.expectedTurnId === retainedPendingId;

  // ── Scenario 16: chat DB write succeeds, episode write fails ──────────────
  // Cursor must remain unadvanced; retry must reuse the same conversation row
  // and append the episode once.
  const chatCapturePath = path.join(cwd, '.local/.chat_capture');
  const chatCursorPath = path.join(cwd, '.local/.chat_capture-cursor');
  fs.writeFileSync(chatCapturePath, '', 'utf8');
  fs.rmSync(chatCursorPath, { force: true });
  appendChatCaptureTurn('David', `Watchdog chat retry David ${MARKER}`, chatCapturePath);
  appendChatCaptureTurn('Luca Replit', `Watchdog chat retry Luca ${MARKER}`, chatCapturePath);
  const chatRowsBefore = store.chatInserts.length;
  store.failNextEpisodeUpdate = true;
  await drain();
  results.chatFailureCursorUnadvanced =
    !fs.existsSync(chatCursorPath) || fs.readFileSync(chatCursorPath, 'utf8').trim() === '0';
  results.chatFailureOneDbRow = store.chatInserts.length === chatRowsBefore + 1;
  await drain();
  results.chatRetryNoDuplicateDbRow = store.chatInserts.length === chatRowsBefore + 1;
  results.chatRetryEpisodeExactlyOnce =
    count(store.episodeContent, `Watchdog chat retry David ${MARKER}`) === 1 &&
    count(store.episodeContent, `Watchdog chat retry Luca ${MARKER}`) === 1;
  results.chatRetryCursorAdvanced =
    fs.existsSync(chatCursorPath) &&
    Number(JSON.parse(fs.readFileSync(chatCursorPath, 'utf8')).byteOffset) > 0;

  // ── Scenario 17: re-embed failure leaves chat capture retryable ────────────
  // Both durable writes complete before re-embedding. A transient embedding
  // failure must leave the cursor pending; retry must dedup both the chat row
  // and episode event, then reach the re-embed path for both row IDs.
  const reembedFailureDavid = `Watchdog reembed retry David ${MARKER}`;
  const reembedFailureLuca = `Watchdog reembed retry Luca ${MARKER}`;
  appendChatCaptureTurn('David', reembedFailureDavid, chatCapturePath);
  appendChatCaptureTurn('Luca Replit', reembedFailureLuca, chatCapturePath);
  const reembedFailureCursorBefore = Number(
    JSON.parse(fs.readFileSync(chatCursorPath, 'utf8')).byteOffset,
  );
  const chatRowsBeforeReembedFailure = store.chatInserts.length;
  const reembeddedBeforeFailure = store.reembeddedIds.length;
  store.failNextReembed = true;
  await drain();
  const reembedFailureChatId = `chat-${chatRowsBeforeReembedFailure + 1}`;
  results.reembedFailureCursorUnadvanced =
    Number(JSON.parse(fs.readFileSync(chatCursorPath, 'utf8')).byteOffset) === reembedFailureCursorBefore;
  results.reembedFailureOneDbRow = store.chatInserts.length === chatRowsBeforeReembedFailure + 1;
  results.reembedFailureOneEpisode =
    count(store.episodeContent, reembedFailureDavid) === 1 &&
    count(store.episodeContent, reembedFailureLuca) === 1;
  await drain();
  results.reembedRetryNoDuplicateDbRow = store.chatInserts.length === chatRowsBeforeReembedFailure + 1;
  results.reembedRetryEpisodeExactlyOnce =
    count(store.episodeContent, reembedFailureDavid) === 1 &&
    count(store.episodeContent, reembedFailureLuca) === 1;
  results.reembedRetryCursorAdvanced =
    Number(JSON.parse(fs.readFileSync(chatCursorPath, 'utf8')).byteOffset) > reembedFailureCursorBefore;
  results.reembedRetryReembeddedChat = store.reembeddedIds.includes(reembedFailureChatId);
  results.reembedRetryReembeddedEpisode = store.reembeddedIds.includes(store.episodeId);
  results.reembedFailureHadRetry = store.reembeddedIds.length > reembeddedBeforeFailure;

  // ── Scenario 18: live rolling lookup returns null ─────────────────────────
  const nullLookupCursor = Number(JSON.parse(fs.readFileSync(chatCursorPath, 'utf8')).byteOffset);
  appendChatCaptureTurn('David', `Null lookup David ${MARKER}`, chatCapturePath);
  appendChatCaptureTurn('Luca Replit', `Null lookup Luca ${MARKER}`, chatCapturePath);
  setRollingEpisodeLookupModeForTest('null');
  await drain();
  results.nullLookupLeavesChatCursorPending =
    Number(JSON.parse(fs.readFileSync(chatCursorPath, 'utf8')).byteOffset) === nullLookupCursor;

  fs.rmSync(statePath, { force: true });
  const nullLookupFelt = `Null lookup felt ${MARKER}`;
  fs.writeFileSync(reflectionPath, nullLookupFelt, 'utf8');
  await drainInnerLife();
  const nullState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  results.nullLookupLeavesInnerLifePending =
    nullState.felt?.lastProcessedMs === undefined &&
    !store.episodeContent.includes(nullLookupFelt);

  writeCanonicalIntent(
    { main: `Output after null-lookup recovery ${MARKER}` },
    path.join(intentDir, 'null-lookup-recovery.json'),
  );
  setRollingEpisodeLookupModeForTest('normal');
  await drain();
  await drainInnerLife();
  results.nullLookupRecoveryCompletes =
    Number(JSON.parse(fs.readFileSync(chatCursorPath, 'utf8')).byteOffset) > nullLookupCursor &&
    store.episodeContent.includes(`Null lookup Luca ${MARKER}`) &&
    store.episodeContent.includes(nullLookupFelt);

  // ── Scenario 18: identical successive exchanges are distinct events ──────
  const repeatedDavid = `Intentionally repeated David ${MARKER}`;
  const repeatedLuca = `Intentionally repeated Luca ${MARKER}`;
  appendChatCaptureTurn('David', repeatedDavid, chatCapturePath);
  appendChatCaptureTurn('Luca Replit', repeatedLuca, chatCapturePath);
  await drain();
  appendChatCaptureTurn('David', repeatedDavid, chatCapturePath);
  appendChatCaptureTurn('Luca Replit', repeatedLuca, chatCapturePath);
  await drain();
  results.identicalSuccessiveExchangesPreserved =
    count(store.episodeContent, repeatedDavid) === 2 &&
    count(store.episodeContent, repeatedLuca) === 2;

  // Abandoned lock (crashed holder, no renewals): takeover MUST succeed.
  fs.writeFileSync(lockPath, JSON.stringify({ pid: 999999999, acquiredAt: Date.now() - 3 * 60 * 1000 }), 'utf8');
  const abandonedAge = new Date(Date.now() - 3 * 60 * 1000);
  fs.utimesSync(lockPath, abandonedAge, abandonedAge);
  results.abandonedLockTakenOver = tryAcquireInnerLifeLock(lockPath);
  if (results.abandonedLockTakenOver) releaseInnerLifeLock(lockPath);

  console.log('RESULTS:' + JSON.stringify(results));
  process.exit(0);
})().catch(err => { console.error('DRIVER ERROR:', err?.message ?? err); process.exit(1); });
