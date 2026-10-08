/**
 * Supervisor wiring tests with in-memory ports (no network, no model, no shared data).
 * The ledger port is backed by FakeLedger, which mirrors the real service's
 * idempotency -> CAS -> transition ordering.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { WORKER_MINIMUM_DENYLIST, charterBodyDigest, type WorkerCharterBody } from '../../../shared/worker-contracts';
import { configDigest } from './adapter';
import type { CharterRecord } from './authority';
import { FakeLedger } from './fake-ledger';
import type { OutboxEntry } from './lifecycle';
import type { HostPort, LaunchHandle, LedgerPort, StateStore, ThreadView } from './supervisor';
import { runSupervisor } from './supervisor';

const W = 'luca-claude-code';
const CHARTER_ID = '11111111-2222-4333-8444-555555555555';
const INSTANCE = '99999999-9999-4999-8999-999999999999';
const COMMIT = 'c'.repeat(40);
const EXE_SHA = 'e'.repeat(64);
const T0 = Date.parse('2026-10-08T03:00:00.000Z');

function charterBody(qualified: boolean): WorkerCharterBody {
  return {
    schema: 'hh.worker.charter.v1', workerActor: W, host: 'LITTLENEMO', originators: ['luca-replit'], kinds: ['doc_inspect'],
    pathAllowlist: ['docs/**'], pathDenylist: [...WORKER_MINIMUM_DENYLIST], authProfiles: ['subscription'], models: ['sonnet'],
    qualifiedHarnesses: qualified ? [{ adapter: 'claude-cli', executableSha256: EXE_SHA, version: '2.1.289', configDigest: configDigest('claude-cli', 'subscription'), qualificationRef: 'test' }] : [],
    limits: { maxJobsPerWindow: 5, maxRuntimeSec: 600, maxApiBudgetUsdPerJob: 1, pollIntervalSec: 300 },
    window: { notBefore: '2026-10-08T00:00:00.000Z', notAfter: '2026-10-09T00:00:00.000Z' },
  };
}

function setup(opts: { qualified?: boolean; jobOver?: Record<string, unknown>; harnessStdout?: string; hangHarness?: boolean } = {}) {
  const fake = new FakeLedger();
  const createdAt = new Map<string, string>();
  const body = charterBody(opts.qualified !== false);
  const charter: CharterRecord = { id: CHARTER_ID, version: 1, body, bodyDigest: charterBodyDigest(body), approvalState: 'approved', approvedAt: '2026-10-08T01:00:00.000Z' };
  const T = 'aaaaaaaa-0000-4000-8000-000000000001';
  fake.createThread(T, 'luca-replit', W);
  fake.events.push({ threadId: T, sequence: 1, actor: 'luca-replit', eventType: 'created', idempotencyKey: 'test-created', evidence: [],
    payload: { schema: 'hh.worker.job.v1', kind: 'doc_inspect', repository: 'davidwmcintosh/HolaHola', commit: COMMIT, paths: ['docs/*.md'],
      question: 'What is it?', resultSchemaId: 'answer-with-citations.v1', authProfile: 'subscription', model: 'sonnet',
      limits: { maxRuntimeSec: 600 }, charterId: CHARTER_ID, charterVersion: 1, deadline: '2026-10-08T08:00:00.000Z', ...opts.jobOver } });
  createdAt.set(T, '2026-10-08T02:00:00.000Z');
  const appends: string[] = [];

  const view = (id: string): ThreadView => {
    const t = fake.threads.get(id)!;
    return {
      thread: { id, state: t.state, originActor: t.originActor, intendedRecipient: t.intendedRecipient, currentOwner: t.currentOwner, latestSequence: t.latestSequence, sourceReference: null },
      events: fake.events.filter((e) => e.threadId === id).map((e) => ({ ...e, createdAt: e.eventType === 'created' ? createdAt.get(id)! : '2026-10-08T03:00:00.000Z' })),
    };
  };
  const ledger: LedgerPort = {
    async getCharter() { return { ok: true, value: charter }; },
    async listJobs({ after }) {
      const jobs = [...fake.threads.keys()].map((id, i) => ({ threadId: id, createdGlobalSequence: 100 + i })).filter((j) => j.createdGlobalSequence > after);
      const accepted = fake.events.filter((e) => e.eventType === 'accepted' && (e.payload as { charterId?: string }).charterId === CHARTER_ID).length;
      return { ok: true, value: { jobs, nextAfter: jobs.at(-1)?.createdGlobalSequence ?? after, complete: true, acceptedInWindow: accepted } };
    },
    async showThread(id) {
      const r = fake.read(id, W);
      return r.ok ? { ok: true, value: view(id) } : { ok: false, error: 'not_participant' };
    },
    async append(threadId, eventType, input) {
      appends.push(eventType);
      return fake.append({ threadId, actor: W, eventType, idempotencyKey: input.idempotencyKey, expectedSequence: input.expectedSequence, payload: input.payload, evidence: input.evidence, recipientActor: input.recipientActor });
    },
  };

  let now = T0;
  const staged: string[] = [];
  const removed: string[] = [];
  const hooks = { onSleep: (_n: number) => undefined as void };
  let sleeps = 0;
  const host: HostPort = {
    now: () => now,
    sleep: async (ms) => { now += ms; sleeps += 1; hooks.onSleep(sleeps); },
    fetchOrigin: async () => true,
    commitExists: (c) => c === COMMIT,
    isAncestorOfOriginMain: (c) => c === COMMIT,
    lsTree: () => [{ mode: '100644', type: 'blob', size: 30, path: 'docs/a.md' }],
    resolveHarness: async () => ({ path: 'C:\\x\\claude.exe', version: '2.1.289', sha256: EXE_SHA }),
    stage: (_c, files) => { staged.push(...files.map((f) => f.path)); return 'C:\\hh-w\\test\\in'; },
    removeStaging: (d) => { removed.push(d); },
    validate: () => ({ ok: true, answer: { summary: 's', findings: [], citations: [] }, citations: [{ path: 'docs/a.md', startLine: 1, endLine: 1, excerpt: 'x', excerptSha256: 'f'.repeat(64) }], costTelemetryUsd: 0.01 }),
    launch: () => {
      let resolveExit!: (v: { code: number | null }) => void;
      const exited = new Promise<{ code: number | null }>((r) => { resolveExit = r; });
      if (!opts.hangHarness) resolveExit({ code: 0 });
      const h: LaunchHandle = { terminate: () => resolveExit({ code: 80 }), killLauncher: () => resolveExit({ code: null }), exited, stdout: () => opts.harnessStdout ?? '{}' };
      return h;
    },
    env: () => ({ SystemRoot: 'C:\\Windows', LOCALAPPDATA: 'C:\\L' }),
  };

  const outbox = new Map<string, OutboxEntry>();
  const launched = new Set<string>();
  const receipts: { threadId: string; kind: string }[] = [];
  let locked = false;
  const state: StateStore = {
    instanceId: () => INSTANCE,
    acquireLock: () => (locked ? { ok: false, reason: 'held' } : ((locked = true), { ok: true })),
    releaseLock: () => { locked = false; },
    outbox: () => [...outbox.values()],
    saveOutbox: (_t, _op, e) => { outbox.set(e.key, e); },
    receipt: (threadId, kind) => { receipts.push({ threadId, kind }); },
    launched: (k) => launched.has(k),
    markLaunched: (k) => { launched.add(k); },
    scanAfter: () => 0,
    saveScanAfter: () => undefined,
  };
  return { fake, ledger, host, state, appends, staged, removed, receipts, outbox, hooks, T, setLocked: (v: boolean) => { locked = v; } };
}

const opts = (over: Record<string, unknown> = {}) => ({
  workerActor: W, charterId: CHARTER_ID, charterVersion: 1, planOnly: false, untilMs: T0 + 3_600_000, maxJobs: 1, adapter: 'claude-cli' as const, ...over,
});

test('--plan-only performs no ledger writes, no staging and no launch', async () => {
  const s = setup();
  const r = await runSupervisor(opts({ planOnly: true }), s.ledger, s.host, s.state);
  assert.equal(r.mode, 'plan-only');
  assert.deepEqual(s.appends, []);
  assert.deepEqual(s.staged, []);
  assert.equal(r.decisions[0].decision, 'eligible(plan-only: not claimed)');
});

test('unqualified harness: ineligible before claim, no writes, no rejection comment (worker-side condition)', async () => {
  const s = setup({ qualified: false });
  const r = await runSupervisor(opts({ maxJobs: 1, untilMs: T0 + 1 }), s.ledger, s.host, s.state);
  assert.match(r.decisions[0].decision, /unqualified_harness/);
  assert.deepEqual(s.appends, []);
});

test('happy path: fresh claim, staged run, completed with git evidence, staging removed', async () => {
  const s = setup();
  const r = await runSupervisor(opts(), s.ledger, s.host, s.state);
  assert.deepEqual(r.outcomes, [{ threadId: s.T, outcome: 'completed' }]);
  assert.deepEqual(s.appends, ['accepted', 'completed']);
  const done = s.fake.events.find((e) => e.eventType === 'completed')!;
  assert.equal((done.payload as { schema: string }).schema, 'hh.worker.result.v1');
  assert.equal((done.evidence as { type: string }[])[0].type, 'commit');
  assert.deepEqual(s.staged, ['docs/a.md']);
  assert.equal(s.removed.length, 1);
  assert.equal(s.state.outbox().every((e) => e.state === 'sent'), true);
});

test('job-intrinsic rejection: one comment to the originator, idempotent across runs', async () => {
  const s = setup({ jobOver: { model: 'opus' } });
  await runSupervisor(opts({ untilMs: T0 + 1 }), s.ledger, s.host, s.state);
  await runSupervisor(opts({ untilMs: T0 + 1 }), s.ledger, s.host, s.state);
  assert.equal(s.fake.events.filter((e) => e.eventType === 'comment').length, 1);
  assert.equal(s.fake.events.some((e) => e.eventType === 'accepted'), false);
});

test('lock held by another supervisor halts before any read or write', async () => {
  const s = setup();
  s.setLocked(true);
  const r = await runSupervisor(opts(), s.ledger, s.host, s.state);
  assert.equal(r.halted, 'lock:held');
  assert.deepEqual(s.appends, []);
});

test('reassignment during a run: stop via job termination, NO ledger write, local receipt (R2)', async () => {
  const s = setup({ hangHarness: true });
  s.hooks.onSleep = (n) => {
    if (n === 1) s.fake.append({ threadId: s.T, actor: 'luca-replit', eventType: 'reassigned', idempotencyKey: 'test-reassign', expectedSequence: s.fake.threads.get(s.T)!.latestSequence, recipientActor: 'alden' });
  };
  const r = await runSupervisor(opts(), s.ledger, s.host, s.state);
  assert.deepEqual(r.outcomes, [{ threadId: s.T, outcome: 'authority_lost' }]);
  assert.deepEqual(s.appends, ['accepted'], 'no blocked/completed written after losing authority');
  assert.ok(s.receipts.some((x) => x.kind === 'authority_lost'));
  assert.equal(s.fake.threads.get(s.T)!.intendedRecipient, 'alden', 'new owner state untouched');
});
