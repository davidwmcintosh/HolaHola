/**
 * Supervisor wiring tests with in-memory ports (no network, no model, no shared data).
 * The ledger port is backed by FakeLedger, which mirrors the real service's
 * idempotency -> CAS -> transition ordering. Each F-numbered test reproduces a
 * finding from Luca's implementation review (shared-spec 60e19c1b rev a95f6ed8)
 * through the real runSupervisor wiring.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WORKER_MINIMUM_DENYLIST, buildCompletionEvidence, charterBodyDigest, claimKeyFor, writeKeyFor, type WorkerCharterBody,
} from '../../../shared/worker-contracts';
import { configDigest } from './adapter';
import type { CharterRecord } from './authority';
import { FakeLedger } from './fake-ledger';
import { freezeOutboxEntry, type OutboxEntry } from './lifecycle';
import type { StagedInput } from './staging';
import type { HostPort, LaunchExit, LaunchHandle, LedgerPort, StateStore, ThreadView } from './supervisor';
import { runSupervisor } from './supervisor';

const W = 'luca-claude-code';
const CHARTER_ID = '11111111-2222-4333-8444-555555555555';
const INSTANCE = '99999999-9999-4999-8999-999999999999';
const OLD_RUN = '88888888-8888-4888-8888-888888888888';
const COMMIT = 'c'.repeat(40);
const EXE_SHA = 'e'.repeat(64);
const T0 = Date.parse('2026-10-08T03:00:00.000Z');
const tid = (i: number) => `aaaaaaaa-0000-4000-8000-00000000000${i}`;

type LaunchMode = 'ok' | 'hang' | 'unresponsive' | 'exitNull' | 'spawnFail';

type SetupOpts = {
  qualified?: boolean;
  threads?: number;
  jobOver?: Record<string, unknown>;
  charterOver?: Partial<WorkerCharterBody['limits']>;
  authProfiles?: ('subscription' | 'api')[];
  launch?: LaunchMode;
  stdoutOverflow?: boolean;
  validate?: HostPort['validate'];
  verifyStaged?: HostPort['verifyStaged'];
  stage?: HostPort['stage'];
  launchThrows?: boolean;
  pageMode?: 'normal' | 'incompleteThenFail' | 'staleCount' | 'freshCountFails' | 'freshCountHigher';
};

function charterBody(o: SetupOpts): WorkerCharterBody {
  return {
    schema: 'hh.worker.charter.v1', workerActor: W, host: 'LITTLENEMO', originators: ['luca-replit'], kinds: ['doc_inspect'],
    pathAllowlist: ['docs/**'], pathDenylist: [...WORKER_MINIMUM_DENYLIST], authProfiles: o.authProfiles ?? ['subscription'], models: ['sonnet'],
    qualifiedHarnesses: o.qualified === false ? [] : (['subscription', 'api'] as const).map((p) => (
      { adapter: 'claude-cli' as const, executableSha256: EXE_SHA, version: '2.1.289', configDigest: configDigest('claude-cli', p), qualificationRef: 'test' })),
    limits: { maxJobsPerWindow: 5, maxRuntimeSec: 600, maxApiBudgetUsdPerJob: 1, pollIntervalSec: 300, ...o.charterOver },
    window: { notBefore: '2026-10-08T00:00:00.000Z', notAfter: '2026-10-09T00:00:00.000Z' },
  };
}

const goodValidate: HostPort['validate'] = () => ({
  ok: true, answer: { summary: 's', findings: [], citations: [] },
  citations: [{ path: 'docs/a.md', startLine: 1, endLine: 1, excerpt: 'x', excerptSha256: 'f'.repeat(64) }], costTelemetryUsd: 0.01,
});

function setup(opts: SetupOpts = {}) {
  const fake = new FakeLedger();
  const createdAt = new Map<string, string>();
  const body = charterBody(opts);
  const charter: CharterRecord = { id: CHARTER_ID, version: 1, body, bodyDigest: charterBodyDigest(body), approvalState: 'approved', approvedAt: '2026-10-08T01:00:00.000Z' };
  const ids: string[] = [];
  for (let i = 1; i <= (opts.threads ?? 1); i += 1) {
    const T = tid(i);
    ids.push(T);
    fake.createThread(T, 'luca-replit', W);
    fake.events.push({ threadId: T, sequence: 1, actor: 'luca-replit', eventType: 'created', idempotencyKey: `test-created-${i}`, evidence: [], content: 'job',
      payload: { schema: 'hh.worker.job.v1', kind: 'doc_inspect', repository: 'davidwmcintosh/HolaHola', commit: COMMIT, paths: ['docs/*.md'],
        question: 'What is it?', resultSchemaId: 'answer-with-citations.v1', authProfile: 'subscription', model: 'sonnet',
        limits: { maxRuntimeSec: 600 }, charterId: CHARTER_ID, charterVersion: 1, deadline: '2026-10-08T08:00:00.000Z', ...opts.jobOver } });
    createdAt.set(T, '2026-10-08T02:00:00.000Z');
  }
  const appends: string[] = [];
  const hooks = {
    onSleep: (_n: number) => undefined as void,
    /** Return a replacement result to intercept an append (after optionally mutating the fake). */
    onAppend: (_t: string, _et: string, _in: { idempotencyKey: string; expectedSequence: number }) => undefined as ReturnType<LedgerPort['append']> | undefined,
    showFails: false,
    charterStalls: false,
  };

  const view = (id: string): ThreadView => {
    const t = fake.threads.get(id)!;
    return {
      thread: { id, state: t.state, originActor: t.originActor, intendedRecipient: t.intendedRecipient, currentOwner: t.currentOwner, latestSequence: t.latestSequence, sourceReference: null },
      events: fake.events.filter((e) => e.threadId === id).map((e) => ({ ...e, createdAt: e.eventType === 'created' ? createdAt.get(id)! : '2026-10-08T03:00:00.000Z' })),
    };
  };
  let listCalls = 0;
  const ledger: LedgerPort = {
    async getCharter() { return hooks.charterStalls ? new Promise(() => undefined) : { ok: true, value: charter }; },
    async listJobs({ after, limit }) {
      listCalls += 1;
      const accepted = fake.events.filter((e) => e.eventType === 'accepted' && (e.payload as { charterId?: string }).charterId === CHARTER_ID).length;
      const all = [...fake.threads.keys()].map((id, i) => ({ threadId: id, createdGlobalSequence: 100 + i })).filter((j) => j.createdGlobalSequence > after);
      const mode = opts.pageMode ?? 'normal';
      if (mode === 'freshCountFails' && limit === 1) return { ok: false, error: 'timeout' };
      // Another instance's acceptance lands between discovery and this claim: only the fresh read sees it.
      if (mode === 'freshCountHigher' && limit === 1) return { ok: true, value: { jobs: [], nextAfter: after, complete: true, acceptedInWindow: accepted + 1 } };
      if (mode === 'incompleteThenFail' && limit === 50) {
        if (after === 0) return { ok: true, value: { jobs: all.slice(0, 1), nextAfter: 100, complete: false, acceptedInWindow: accepted } };
        return { ok: false, error: 'http_5xx' };
      }
      return { ok: true, value: { jobs: all, nextAfter: all.at(-1)?.createdGlobalSequence ?? after, complete: true, acceptedInWindow: mode === 'staleCount' ? 0 : accepted } };
    },
    async showThread(id) {
      if (hooks.showFails) return { ok: false, error: 'timeout' };
      const r = fake.read(id, W);
      return r.ok ? { ok: true, value: view(id) } : { ok: false, error: 'not_participant' };
    },
    async append(threadId, eventType, input) {
      appends.push(eventType);
      const intercepted = hooks.onAppend(threadId, eventType, input);
      if (intercepted) return intercepted;
      return fake.append({ threadId, actor: W, eventType, idempotencyKey: input.idempotencyKey, expectedSequence: input.expectedSequence, payload: input.payload, evidence: input.evidence, recipientActor: input.recipientActor, content: input.content });
    },
  };

  let now = T0;
  const staged: string[] = [];
  const removed: string[] = [];
  let sleeps = 0;
  let launches = 0;
  const host: HostPort = {
    now: () => now,
    // Fires on a later macrotask; an aborted (losing) timer never advances fake time.
    sleep: (ms, signal) => new Promise<void>((resolve) => setImmediate(() => {
      if (signal?.aborted) { resolve(); return; }
      now += ms; sleeps += 1; hooks.onSleep(sleeps); resolve();
    })),
    fetchOrigin: async () => true,
    commitExists: (c) => c === COMMIT,
    isAncestorOfOriginMain: (c) => c === COMMIT,
    lsTree: () => [{ mode: '100644', type: 'blob', size: 30, path: 'docs/a.md' }],
    resolveHarness: async () => ({ path: 'C:\\x\\claude.exe', version: '2.1.289', sha256: EXE_SHA }),
    stage: opts.stage ?? ((_c, files): StagedInput => { staged.push(...files.map((f) => f.path)); return { dir: 'C:\\hh-w\\test\\in', baseline: new Map([['docs/a.md', Buffer.from('x')]]) }; }),
    removeStaging: (d) => { removed.push(d); },
    verifyStaged: opts.verifyStaged ?? (() => ({ ok: true })),
    validate: opts.validate ?? goodValidate,
    launch: () => {
      if (opts.launchThrows) throw new Error('spawn EINVAL');
      launches += 1;
      const mode = opts.launch ?? 'ok';
      let resolveExit!: (v: LaunchExit) => void;
      const exited = new Promise<LaunchExit>((r) => { resolveExit = r; });
      if (mode === 'ok') resolveExit({ code: 0 });
      if (mode === 'exitNull') resolveExit({ code: null });
      if (mode === 'spawnFail') resolveExit({ code: null, spawnFailed: true });
      const h: LaunchHandle = {
        terminate: () => { if (mode !== 'unresponsive') resolveExit({ code: 80 }); return true; },
        killLauncher: () => { if (mode !== 'unresponsive') resolveExit({ code: null }); },
        exited,
        stdout: () => ({ text: '{"looks":"valid"}', overflow: opts.stdoutOverflow === true }),
      };
      return h;
    },
    env: () => ({ SystemRoot: 'C:\\Windows', LOCALAPPDATA: 'C:\\L' }),
  };

  const outbox = new Map<string, unknown>();
  const launched = new Set<string>();
  const receipts: { threadId: string; kind: string; data: Record<string, unknown> }[] = [];
  const scan = new Map<string, number>();
  let locked = false;
  const state: StateStore = {
    instanceId: () => INSTANCE,
    acquireLock: () => (locked ? { ok: false, reason: 'held' } : ((locked = true), { ok: true })),
    releaseLock: () => { locked = false; return { released: true }; },
    outbox: () => [...outbox.values()].map((e) => JSON.parse(JSON.stringify(e))), // persistence round trip
    saveOutbox: (e) => { outbox.set(e.key, e); },
    receipt: (threadId, kind, data) => { receipts.push({ threadId, kind, data }); },
    launched: (k) => launched.has(k),
    markLaunched: (k) => { launched.add(k); },
    scanAfter: (c, v) => scan.get(`${c}:${v}`) ?? 0,
    saveScanAfter: (c, v, a) => { scan.set(`${c}:${v}`, a); },
  };
  const entries = () => [...outbox.values()] as OutboxEntry[];
  return {
    fake, ledger, host, state, appends, staged, removed, receipts, outbox, entries, hooks, scan, ids, T: ids[0],
    launches: () => launches, listCalls: () => listCalls, setLocked: (v: boolean) => { locked = v; },
    events: (type: string) => fake.events.filter((e) => e.eventType === type),
  };
}

const opts = (over: Record<string, unknown> = {}) => ({
  workerActor: W, charterId: CHARTER_ID, charterVersion: 1, planOnly: false, untilMs: T0 + 3_600_000, maxJobs: 1, adapter: 'claude-cli' as const, ...over,
});

/** Seeds an earlier run's acceptance of thread T by this instance; returns its claim key. */
function seedOldClaim(s: ReturnType<typeof setup>, T: string) {
  const seq = s.fake.threads.get(T)!.latestSequence;
  const key = claimKeyFor(INSTANCE, T, OLD_RUN, seq);
  const r = s.fake.append({ threadId: T, actor: W, eventType: 'accepted', idempotencyKey: key, expectedSequence: seq, content: 'Local Read-only Worker claim',
    payload: { instanceId: INSTANCE, runNonce: OLD_RUN, claimKey: key, charterId: CHARTER_ID, charterVersion: 1 } });
  assert.equal(r.ok, true);
  return key;
}

// --- baseline behaviour ----------------------------------------------------------

test('--plan-only performs no ledger writes, no staging and no launch', async () => {
  const s = setup();
  const r = await runSupervisor(opts({ planOnly: true }), s.ledger, s.host, s.state);
  assert.equal(r.mode, 'plan-only');
  assert.deepEqual(s.appends, []);
  assert.deepEqual(s.staged, []);
  assert.equal(r.decisions[0].decision, 'eligible(plan-only: not claimed)');
});

test('unqualified harness: ineligible before claim, no writes, no rejection comment, candidate stays discoverable', async () => {
  const s = setup({ qualified: false });
  const r = await runSupervisor(opts({ untilMs: T0 + 1 }), s.ledger, s.host, s.state);
  assert.match(r.decisions[0].decision, /unqualified_harness/);
  assert.deepEqual(s.appends, []);
  assert.equal(s.scan.get(`${CHARTER_ID}:1`), 99, 'scan position stops before the transient candidate (created seq 100)');
});

test('happy path (valid result control): fresh claim, staged run, completed with git evidence and exact content, staging removed', async () => {
  const s = setup();
  const r = await runSupervisor(opts(), s.ledger, s.host, s.state);
  assert.deepEqual(r.outcomes, [{ threadId: s.T, outcome: 'completed' }]);
  assert.deepEqual(s.appends, ['accepted', 'completed']);
  const done = s.events('completed')[0];
  assert.equal((done.payload as { schema: string }).schema, 'hh.worker.result.v1');
  assert.equal((done.evidence as { type: string }[])[0].type, 'commit');
  assert.equal(done.content, 'Local Read-only Worker result');
  assert.deepEqual(s.staged, ['docs/a.md']);
  assert.equal(s.removed.length, 1);
  assert.ok(s.entries().every((e) => e.state === 'sent'));
  assert.equal(r.halted, null);
});

test('job-intrinsic rejection: one comment to the originator, idempotent across runs', async () => {
  const s = setup({ jobOver: { model: 'opus' } });
  await runSupervisor(opts({ untilMs: T0 + 1 }), s.ledger, s.host, s.state);
  await runSupervisor(opts({ untilMs: T0 + 1 }), s.ledger, s.host, s.state);
  assert.equal(s.events('comment').length, 1);
  assert.equal(s.events('accepted').length, 0);
});

test('lock held by another supervisor halts before any read or write', async () => {
  const s = setup();
  s.setLocked(true);
  const r = await runSupervisor(opts(), s.ledger, s.host, s.state);
  assert.equal(r.halted, 'lock:held');
  assert.deepEqual(s.appends, []);
});

test('reassignment during a run: stop via job termination, NO ledger write, local receipt (R2)', async () => {
  const s = setup({ launch: 'hang' });
  s.hooks.onSleep = (n) => {
    if (n === 1) s.fake.append({ threadId: s.T, actor: 'luca-replit', eventType: 'reassigned', idempotencyKey: 'test-reassign', expectedSequence: s.fake.threads.get(s.T)!.latestSequence, recipientActor: 'alden' });
  };
  const r = await runSupervisor(opts(), s.ledger, s.host, s.state);
  assert.deepEqual(r.outcomes, [{ threadId: s.T, outcome: 'authority_lost' }]);
  assert.deepEqual(s.appends, ['accepted'], 'no blocked/completed written after losing authority');
  assert.ok(s.receipts.some((x) => x.kind === 'authority_lost'));
  assert.equal(s.fake.threads.get(s.T)!.intendedRecipient, 'alden', 'new owner state untouched');
});

// --- F1: complete history and a fresh per-claim count --------------------------------

test('F1 maxJobsPerWindow=1 with two eligible jobs in one page: exactly one accepted and completed', async () => {
  const s = setup({ threads: 2, charterOver: { maxJobsPerWindow: 1 } });
  const r = await runSupervisor(opts({ maxJobs: 2, untilMs: T0 + 1000 }), s.ledger, s.host, s.state);
  assert.equal(s.events('accepted').length, 1);
  assert.equal(s.events('completed').length, 1);
  assert.ok(r.decisions.some((d) => d.threadId === s.ids[1] && d.decision === 'ineligible:limit_reached'));
});

test('F1 a stale server count still cannot exceed the limit: own acceptances this run are counted', async () => {
  const s = setup({ threads: 2, charterOver: { maxJobsPerWindow: 1 }, pageMode: 'staleCount' });
  await runSupervisor(opts({ maxJobs: 2, untilMs: T0 + 1000 }), s.ledger, s.host, s.state);
  assert.equal(s.events('accepted').length, 1);
});

test('F1 incomplete paging then a failed page: no claim at all, scan position not advanced', async () => {
  const s = setup({ threads: 2, pageMode: 'incompleteThenFail' });
  const r = await runSupervisor(opts({ maxJobs: 2, untilMs: T0 + 1 }), s.ledger, s.host, s.state);
  assert.equal(s.events('accepted').length, 0);
  assert.deepEqual(s.appends, []);
  assert.ok(r.decisions.some((d) => d.decision.startsWith('history_incomplete')));
  assert.equal(s.scan.has(`${CHARTER_ID}:1`), false);
});

test('F1 the count rises between discovery and the claim (another acceptance): the fresh read refuses the claim', async () => {
  const s = setup({ charterOver: { maxJobsPerWindow: 1 }, pageMode: 'freshCountHigher' });
  const r = await runSupervisor(opts({ untilMs: T0 + 1 }), s.ledger, s.host, s.state);
  assert.equal(s.events('accepted').length, 0);
  assert.ok(r.decisions.some((d) => d.decision === 'ineligible:limit_reached'));
});

test('F1 the fresh count immediately before a claim fails: never treated as zero, no claim', async () => {
  const s = setup({ pageMode: 'freshCountFails' });
  const r = await runSupervisor(opts({ untilMs: T0 + 1 }), s.ledger, s.host, s.state);
  assert.equal(s.events('accepted').length, 0);
  assert.ok(r.decisions.some((d) => d.decision === 'ineligible:history_incomplete'));
});

// --- F2: unsafe output never completes ------------------------------------------------

test('F2 a result containing a secret pattern is BLOCKED (schema_invalid), never completed', async () => {
  const s = setup({ validate: () => ({ ok: true, answer: { summary: 'token sk-ABCDEFGHIJKLMNOPQRSTUV', findings: [], citations: [] }, citations: [], costTelemetryUsd: 0 }) });
  const r = await runSupervisor(opts(), s.ledger, s.host, s.state);
  assert.equal(s.events('completed').length, 0);
  const b = s.events('blocked');
  assert.equal(b.length, 1);
  assert.equal((b[0].payload as { failureClass: string }).failureClass, 'schema_invalid');
  assert.deepEqual(b[0].evidence, [], 'no completion evidence on the failure');
  assert.deepEqual(r.outcomes, [{ threadId: s.T, outcome: 'schema_invalid' }]);
});

test('F2 an oversize result is BLOCKED, never completed', async () => {
  const big = 'a '.repeat(40_000);
  const s = setup({ validate: () => ({ ok: true, answer: { summary: big, findings: [], citations: [] }, citations: [], costTelemetryUsd: 0 }) });
  const r = await runSupervisor(opts(), s.ledger, s.host, s.state);
  assert.equal(s.events('completed').length, 0);
  assert.equal((s.events('blocked')[0].payload as { detail: string }).detail, 'payload_too_large');
  assert.deepEqual(r.outcomes, [{ threadId: s.T, outcome: 'schema_invalid' }]);
});

// --- F3: fencing on every attempt and exact frozen envelopes --------------------------

test('F3 sequence conflict, then a same-actor NEW claim: the old claim\'s terminal write is abandoned, not appended', async () => {
  const s = setup();
  let done = false;
  s.hooks.onAppend = (T, et, input) => {
    if (et !== 'completed' || done) return undefined;
    done = true;
    const seq = () => s.fake.threads.get(T)!.latestSequence;
    s.fake.append({ threadId: T, actor: 'luca-replit', eventType: 'reassigned', idempotencyKey: 'away', expectedSequence: seq(), recipientActor: 'alden' });
    s.fake.append({ threadId: T, actor: 'luca-replit', eventType: 'reassigned', idempotencyKey: 'back', expectedSequence: seq(), recipientActor: W });
    const k = claimKeyFor('77777777-7777-4777-8777-777777777777', T, OLD_RUN, seq());
    s.fake.append({ threadId: T, actor: W, eventType: 'accepted', idempotencyKey: k, expectedSequence: seq(), payload: { claimKey: k }, content: 'other claim' });
    return Promise.resolve(s.fake.append({ threadId: T, actor: W, eventType: 'completed', idempotencyKey: input.idempotencyKey, expectedSequence: input.expectedSequence, payload: {}, evidence: [{}] }));
  };
  const r = await runSupervisor(opts(), s.ledger, s.host, s.state);
  assert.equal(s.events('completed').length, 0, 'the newer claim never receives the old claim\'s completion');
  assert.deepEqual(r.outcomes, [{ threadId: s.T, outcome: 'authority_lost' }]);
  assert.ok(s.receipts.some((x) => x.kind === 'authority_lost_on_send' && x.data.reason === 'fence_claim_superseded'));
  assert.equal(s.entries().find((e) => e.op === 'completed')!.state, 'abandoned_authority_lost');
});

test('F3 authority unknown at send time: no mutation, entry kept unresolved, run halts', async () => {
  const s = setup();
  s.hooks.onAppend = (_T, et) => { if (et === 'accepted') queueMicrotask(() => { /* run proceeds */ }); return undefined; };
  const validate = goodValidate;
  s.host.validate = (...a) => { s.hooks.showFails = true; return validate(...a); };
  const r = await runSupervisor(opts(), s.ledger, s.host, s.state);
  assert.equal(s.events('completed').length, 0);
  assert.deepEqual(r.outcomes, [{ threadId: s.T, outcome: 'send_unresolved' }]);
  const e = s.entries().find((x) => x.op === 'completed')!;
  assert.equal(e.state, 'pending');
  assert.equal(r.halted, null, 'the run had already used its single job');
  s.hooks.showFails = false;
  // Next start replays the exact frozen bytes.
  const r2 = await runSupervisor(opts({ untilMs: T0 + 1 }), s.ledger, s.host, s.state);
  assert.equal(r2.halted, null);
  assert.equal(s.events('completed').length, 1);
  assert.equal(s.events('completed')[0].content, e.content);
});

test('F3 restart with a pending owner write whose thread was reassigned away: abandoned locally, nothing appended', async () => {
  const s = setup();
  const key = seedOldClaim(s, s.T);
  s.fake.append({ threadId: s.T, actor: 'luca-replit', eventType: 'reassigned', idempotencyKey: 'away', expectedSequence: s.fake.threads.get(s.T)!.latestSequence, recipientActor: 'alden' });
  const pending = freezeOutboxEntry({ key: writeKeyFor(INSTANCE, s.T, 'blocked', key), threadId: s.T, op: 'blocked', eventType: 'blocked',
    content: 'Local Read-only Worker stopped: timeout', recipientActor: null, claimKey: key, payload: { p: 1 }, evidence: [] });
  s.state.saveOutbox(pending);
  const r = await runSupervisor(opts({ untilMs: T0 + 1 }), s.ledger, s.host, s.state);
  assert.equal(r.halted, null);
  assert.equal(s.events('blocked').length, 0);
  assert.equal(s.entries().find((e) => e.key === pending.key)!.state, 'abandoned_authority_lost');
  assert.ok(s.receipts.some((x) => x.kind === 'authority_lost_on_send'));
});

test('F3 exact-envelope restart replay: the original content, payload and evidence bytes are sent, never a replacement', async () => {
  const s = setup();
  const key = seedOldClaim(s, s.T);
  const evidence = buildCompletionEvidence(COMMIT, [{ path: 'docs/a.md', startLine: 1, endLine: 1, excerpt: 'x', excerptSha256: 'f'.repeat(64) }]);
  const pending = freezeOutboxEntry({ key: writeKeyFor(INSTANCE, s.T, 'completed', key), threadId: s.T, op: 'completed', eventType: 'completed',
    content: 'Local Read-only Worker result — original bytes ✓', recipientActor: null, claimKey: key, payload: { original: true }, evidence });
  s.state.saveOutbox(pending);
  const r = await runSupervisor(opts({ untilMs: T0 + 1 }), s.ledger, s.host, s.state);
  assert.equal(r.halted, null);
  const done = s.events('completed');
  assert.equal(done.length, 1);
  assert.equal(done[0].content, pending.content);
  assert.deepEqual(done[0].payload, { original: true });
  assert.deepEqual(done[0].evidence, evidence);
  assert.equal(s.launches(), 0);
});

test('F3 a tampered or pre-v2 outbox entry halts before any claim', async () => {
  const s = setup();
  s.outbox.set('legacy', { key: 'lrw.x', eventType: 'completed', payload: {}, evidence: [], state: 'pending', attempts: 0 });
  const r = await runSupervisor(opts(), s.ledger, s.host, s.state);
  assert.equal(r.halted, 'outbox_corrupt');
  assert.deepEqual(s.appends, []);
});

// --- F4: ambiguous claims and post-accept exceptions ----------------------------------

test('F4 committed-but-lost accept: same-key reconciliation launches exactly once', async () => {
  const s = setup();
  s.hooks.onAppend = (T, et, input) => {
    if (et !== 'accepted') return undefined;
    s.fake.append({ threadId: T, actor: W, eventType: 'accepted', idempotencyKey: input.idempotencyKey, expectedSequence: input.expectedSequence,
      payload: (input as { payload?: Record<string, unknown> }).payload, content: (input as { content?: string }).content });
    return Promise.resolve({ ok: false as const, errorCode: 'timeout' });
  };
  const r = await runSupervisor(opts(), s.ledger, s.host, s.state);
  assert.equal(s.launches(), 1);
  assert.equal(s.events('accepted').length, 1);
  assert.deepEqual(r.outcomes, [{ threadId: s.T, outcome: 'completed' }]);
  assert.ok(r.decisions.some((d) => d.decision === 'claim:committed_reply_lost'));
});

test('F4 proven-absent accept: no launch, no acceptance, candidate stays discoverable', async () => {
  const s = setup();
  s.hooks.onAppend = (_T, et) => (et === 'accepted' ? Promise.resolve({ ok: false as const, errorCode: 'timeout' }) : undefined);
  const r = await runSupervisor(opts({ untilMs: T0 + 1 }), s.ledger, s.host, s.state);
  assert.equal(s.launches(), 0);
  assert.equal(s.events('accepted').length, 0);
  assert.ok(r.decisions.some((d) => d.decision === 'claim:proven_absent'));
  assert.equal(s.entries().find((e) => e.op === 'accept')!.state, 'not_applied');
  assert.equal(s.scan.get(`${CHARTER_ID}:1`), 99);
});

test('F4 accept key conflict (same key, different content): halt, no launch', async () => {
  const s = setup();
  s.hooks.onAppend = (T, et, input) => {
    if (et !== 'accepted') return undefined;
    s.fake.events.push({ threadId: T, sequence: 99, actor: W, eventType: 'accepted', idempotencyKey: input.idempotencyKey, payload: { claimKey: 'forged' }, evidence: [], content: 'x' });
    return Promise.resolve({ ok: false as const, errorCode: 'timeout' });
  };
  const r = await runSupervisor(opts(), s.ledger, s.host, s.state);
  assert.equal(r.halted, 'claim_idempotency_conflict');
  assert.equal(s.launches(), 0);
});

test('F4 accept outcome unknowable (read also fails): claims blocked, run halts, no launch', async () => {
  const s = setup();
  s.hooks.onAppend = (_T, et) => {
    if (et !== 'accepted') return undefined;
    s.hooks.showFails = true;
    return Promise.resolve({ ok: false as const, errorCode: 'timeout' });
  };
  const r = await runSupervisor(opts(), s.ledger, s.host, s.state);
  assert.equal(r.halted, 'claim_unresolved');
  assert.equal(s.launches(), 0);
  assert.equal(s.entries().find((e) => e.op === 'accept')!.state, 'send_ambiguous');
});

test('F4 a committed accept from an earlier run whose reply was lost: blocked as interrupted at restart, never launched', async () => {
  const s = setup();
  const key = seedOldClaim(s, s.T);
  s.state.saveOutbox(freezeOutboxEntry({ key, threadId: s.T, op: 'accept', eventType: 'accepted', content: 'Local Read-only Worker claim',
    recipientActor: null, claimKey: key, evidence: [], payload: { instanceId: INSTANCE, runNonce: OLD_RUN, claimKey: key, charterId: CHARTER_ID, charterVersion: 1 } }));
  const r = await runSupervisor(opts({ untilMs: T0 + 1 }), s.ledger, s.host, s.state);
  assert.equal(s.launches(), 0);
  const b = s.events('blocked');
  assert.equal(b.length, 1);
  assert.equal((b[0].payload as { failureClass: string }).failureClass, 'interrupted');
  assert.ok(r.outcomes.some((o) => o.outcome === 'recovered_interrupted'));
});

test('F4 staging exception after acceptance: fenced blocked failure, never an escaped exception', async () => {
  const s = setup({ stage: () => { throw new Error('git cat-file failed'); } });
  const r = await runSupervisor(opts(), s.ledger, s.host, s.state);
  assert.deepEqual(r.outcomes, [{ threadId: s.T, outcome: 'harness_unavailable' }]);
  assert.equal((s.events('blocked')[0].payload as { stage: string }).stage, 'staging');
  const c = setup({ stage: () => { throw new Error('staging_reparse_point'); } });
  const rc = await runSupervisor(opts(), c.ledger, c.host, c.state);
  assert.deepEqual(rc.outcomes, [{ threadId: c.T, outcome: 'confinement_violation' }]);
});

test('F4 launch exception after acceptance: fenced blocked failure', async () => {
  const s = setup({ launchThrows: true });
  const r = await runSupervisor(opts(), s.ledger, s.host, s.state);
  assert.deepEqual(r.outcomes, [{ threadId: s.T, outcome: 'harness_unavailable' }]);
  assert.equal((s.events('blocked')[0].payload as { stage: string }).stage, 'launch');
  assert.equal(s.events('completed').length, 0);
});

test('F4 an API-profile job with no designated key fails BEFORE claim', async () => {
  const s = setup({ authProfiles: ['subscription', 'api'], jobOver: { authProfile: 'api', limits: { maxRuntimeSec: 600, maxApiBudgetUsd: 1 } } });
  const r = await runSupervisor(opts({ untilMs: T0 + 1 }), s.ledger, s.host, s.state);
  assert.equal(s.events('accepted').length, 0);
  assert.ok(r.decisions.some((d) => d.decision === 'ineligible:api_key_not_configured'));
});

// --- F5: independent deadlines, bounded fallback, uncertain exits ----------------------

test('F5 remote reads that stall across the local deadline: the run still stops on its own timer (timeout)', async () => {
  const s = setup({ launch: 'hang' });
  s.hooks.onAppend = (_T, et) => { if (et === 'accepted') s.hooks.charterStalls = true; return undefined; };
  const r = await runSupervisor(opts(), s.ledger, s.host, s.state);
  assert.deepEqual(r.outcomes, [{ threadId: s.T, outcome: 'timeout' }]);
  assert.equal((s.events('blocked')[0].payload as { failureClass: string }).failureClass, 'timeout');
});

test('F5 an exit that never settles after TERMINATE and the launcher kill: bounded, termination_unverified, staging preserved, no ledger write', async () => {
  const s = setup({ launch: 'unresponsive' });
  const r = await runSupervisor(opts(), s.ledger, s.host, s.state);
  assert.deepEqual(r.outcomes, [{ threadId: s.T, outcome: 'termination_unverified' }]);
  assert.equal(r.halted, 'termination_unverified');
  assert.deepEqual(s.appends, ['accepted']);
  assert.deepEqual(s.removed, [], 'staging is preserved when termination is uncertain');
  assert.ok(s.receipts.some((x) => x.kind === 'staging_preserved'));
});

test('F5 valid-looking stdout with an unexpected/uncertain launcher exit never completes', async () => {
  const s = setup({ launch: 'exitNull' });
  const r = await runSupervisor(opts(), s.ledger, s.host, s.state);
  assert.equal(s.events('completed').length, 0);
  assert.deepEqual(r.outcomes, [{ threadId: s.T, outcome: 'termination_unverified' }]);
  assert.equal(r.halted, 'termination_unverified');
});

test('F5 launcher spawn failure: harness_unavailable, no completion', async () => {
  const s = setup({ launch: 'spawnFail' });
  const r = await runSupervisor(opts(), s.ledger, s.host, s.state);
  assert.deepEqual(r.outcomes, [{ threadId: s.T, outcome: 'harness_unavailable' }]);
  assert.equal(s.events('completed').length, 0);
});

test('F5 retained stdout overflow is never validated as a complete result', async () => {
  const s = setup({ stdoutOverflow: true });
  const r = await runSupervisor(opts(), s.ledger, s.host, s.state);
  assert.deepEqual(r.outcomes, [{ threadId: s.T, outcome: 'schema_invalid' }]);
  assert.equal(s.events('completed').length, 0);
});

// --- F7: staged bytes must still be the pinned blobs --------------------------------

test('F7 a staged tree that no longer matches the pinned blobs is confinement_violation, never completed', async () => {
  const s = setup({ verifyStaged: () => ({ ok: false, detail: 'staged_file_changed' }) });
  const r = await runSupervisor(opts(), s.ledger, s.host, s.state);
  assert.deepEqual(r.outcomes, [{ threadId: s.T, outcome: 'confinement_violation' }]);
  assert.equal(s.events('completed').length, 0);
});
