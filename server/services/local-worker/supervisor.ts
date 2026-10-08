/**
 * Local Read-only Worker v1 — supervisor orchestration (design §5).
 *
 * Wires the pure decisions (authority, claim, fence, watchdog, outbox, recovery)
 * to three ports: the ledger (HTTP), the host (git, harness, launcher) and the
 * local state store. Every remote mutation goes through the frozen outbox.
 * --plan-only performs reads only: no ledger writes, no staging, no launch.
 */
import { randomUUID } from 'node:crypto';
import {
  WORKER_FAILURE_SCHEMA, WORKER_REJECTION_SCHEMA, WORKER_RESULT_SCHEMA, assertSendablePayload, buildCompletionEvidence,
  claimKeyFor, writeKeyFor, type WorkerCharterBody, type WorkerFailureClass, type WorkerJob,
} from '../../../shared/worker-contracts';
import { evaluateJobAuthority, type CharterRecord } from './authority';
import { buildHarnessArgs, buildHarnessEnv, buildPrompt, configDigest, isQualified, type AdapterName } from './adapter';
import {
  checkFence, decideClaimOutcome, decideResend, decideWatchdog, freezeOutboxEntry, outboxBlocksClaims,
  reconcileOutboxEntry, selectOwnRecoveries, type LedgerAppendResult, type OutboxEntry, type RemoteRead,
  type ThreadEventLite,
} from './lifecycle';
import type { TreeEntry } from './paths';
import type { HarnessOutcome } from './staging';

// ---------------------------------------------------------------------------
// Ports
// ---------------------------------------------------------------------------

export type ThreadView = {
  thread: { id: string; state: string; originActor: string; intendedRecipient: string; currentOwner: string | null; latestSequence: number; sourceReference: { type?: string } | null };
  events: (ThreadEventLite & { sequence: number; actor: string; createdAt: string })[];
};

export type JobsPage = { jobs: { threadId: string; createdGlobalSequence: number }[]; nextAfter: number; complete: boolean; acceptedInWindow: number };

export interface LedgerPort {
  getCharter(id: string, version: number): Promise<RemoteRead<CharterRecord>>;
  listJobs(q: { charterId: string; charterVersion: number; after: number; limit: number }): Promise<RemoteRead<JobsPage>>;
  showThread(threadId: string): Promise<RemoteRead<ThreadView>>;
  append(threadId: string, eventType: 'accepted' | 'completed' | 'blocked' | 'comment', input: {
    expectedSequence: number; idempotencyKey: string; content: string; payload?: Record<string, unknown>; evidence?: unknown[]; recipientActor?: string;
  }): Promise<LedgerAppendResult>;
}

export type LaunchHandle = {
  terminate(): void;
  killLauncher(): void;
  exited: Promise<{ code: number | null }>;
  stdout(): string;
};

export interface HostPort {
  now(): number;
  sleep(ms: number): Promise<void>;
  fetchOrigin(): Promise<boolean>;
  commitExists(commit: string): boolean;
  isAncestorOfOriginMain(commit: string): boolean;
  lsTree(commit: string): TreeEntry[] | null;
  resolveHarness(): Promise<{ path: string; version: string; sha256: string } | null>;
  stage(commit: string, files: { path: string }[]): string; // returns staging dir
  removeStaging(dir: string): void;
  validate(stdout: string, stagingDir: string, staged: ReadonlySet<string>): HarnessOutcome;
  launch(cfg: { exe: string; args: string[]; cwd: string; env: Record<string, string> }): LaunchHandle;
  env(): Record<string, string | undefined>;
}

export interface StateStore {
  instanceId(): string;
  acquireLock(runNonce: string, reclaimStale: boolean): { ok: true } | { ok: false; reason: string };
  releaseLock(): void;
  outbox(): OutboxEntry[];
  saveOutbox(threadId: string, op: string, entry: OutboxEntry): void;
  receipt(threadId: string, kind: string, data: Record<string, unknown>): void;
  launched(key: string): boolean;
  markLaunched(key: string): void;
  scanAfter(charterId: string, version: number): number;
  saveScanAfter(charterId: string, version: number, after: number): void;
}

export type SupervisorOptions = {
  workerActor: string;
  charterId: string;
  charterVersion: number;
  planOnly: boolean;
  untilMs: number;
  maxJobs: number;
  adapter: AdapterName;
  designatedApiKey?: string;
  reclaimStaleLock?: boolean;
  log?: (line: string) => void;
};

export type SupervisorReport = {
  runNonce: string; instanceId: string; mode: 'plan-only' | 'normal';
  decisions: { threadId: string; decision: string }[];
  outcomes: { threadId: string; outcome: string }[];
  halted: string | null;
};

const JOB_INTRINSIC = new Set([
  'not_a_worker_job', 'agent_note_source_rejected', 'originator_not_allowed', 'charter_mismatch', 'kind_not_allowed',
  'model_not_allowed', 'auth_profile_not_allowed', 'runtime_exceeds_charter', 'api_budget_exceeds_charter',
  'job_predates_charter_approval', 'job_created_outside_window', 'commit_missing', 'commit_not_on_origin_main',
  'paths_no_match', 'paths_no_files', 'path_not_allowlisted', 'path_denylisted', 'path_symlink', 'path_submodule',
  'path_case_collision', 'path_file_too_large', 'staging_too_many_files', 'staging_too_large', 'deadline_passed',
]);
const isJobIntrinsic = (reason: string) => JOB_INTRINSIC.has(reason) || reason.startsWith('job_') || reason.startsWith('question_') || reason.startsWith('path_');

// ---------------------------------------------------------------------------
// Supervisor
// ---------------------------------------------------------------------------

export async function runSupervisor(o: SupervisorOptions, ledger: LedgerPort, host: HostPort, state: StateStore): Promise<SupervisorReport> {
  const log = o.log ?? (() => undefined);
  const runNonce = randomUUID();
  const instanceId = state.instanceId();
  const report: SupervisorReport = { runNonce, instanceId, mode: o.planOnly ? 'plan-only' : 'normal', decisions: [], outcomes: [], halted: null };

  const lock = state.acquireLock(runNonce, o.reclaimStaleLock === true);
  if (!lock.ok) { report.halted = `lock:${lock.reason}`; return report; }
  try {
    if (!o.planOnly) {
      const outboxOk = await reconcileOutbox(ledger, state, o.workerActor, log);
      if (!outboxOk) { report.halted = 'outbox_unresolved'; return report; }
    }
    let jobsRun = 0;
    while (host.now() < o.untilMs && jobsRun < o.maxJobs) {
      const charterRead = await ledger.getCharter(o.charterId, o.charterVersion);
      if (!charterRead.ok) { log(`charter read failed: ${charterRead.error}`); if (o.planOnly) break; await host.sleep(30_000); continue; }
      const charter = charterRead.value;
      const body = charter.body as WorkerCharterBody;
      if (!o.planOnly) await recoverOwn(ledger, state, o, instanceId, runNonce, log, report);

      const fetched = await host.fetchOrigin();
      const fetchedAtMs = fetched ? host.now() : null;
      const harness = await host.resolveHarness();
      let after = state.scanAfter(charter.id, charter.version);
      let complete = false;
      let history: number | null = null;
      while (!complete) {
        const page = await ledger.listJobs({ charterId: charter.id, charterVersion: charter.version, after, limit: 50 });
        if (!page.ok) { history = null; break; }
        history = page.value.acceptedInWindow;
        for (const j of page.value.jobs) {
          if (host.now() >= o.untilMs || jobsRun >= o.maxJobs) break;
          const r = await handleCandidate(j.threadId);
          if (r === 'ran') jobsRun += 1;
          if (report.halted) return report;
        }
        after = page.value.nextAfter;
        complete = page.value.complete;
      }
      if (!o.planOnly && complete) state.saveScanAfter(charter.id, charter.version, after);
      if (o.planOnly) break;
      await host.sleep(Math.max(300, body.limits?.pollIntervalSec ?? 300) * 1000);

      // -- per-candidate handling (closure over this poll cycle's snapshots) --
      async function handleCandidate(threadId: string): Promise<'ran' | 'skipped'> {
        const view = await ledger.showThread(threadId);
        if (!view.ok) { report.decisions.push({ threadId, decision: `read_failed:${view.error}` }); return 'skipped'; }
        const created = view.value.events.find((e) => e.eventType === 'created');
        if (!created) { report.decisions.push({ threadId, decision: 'created_event_missing' }); return 'skipped'; }
        const jobPayload = created.payload as Partial<WorkerJob>;
        const qualified = harness !== null && isQualified(body.qualifiedHarnesses ?? [], o.adapter,
          harness.sha256, configDigest(o.adapter, (jobPayload.authProfile as 'subscription' | 'api') ?? 'subscription'));
        const decision = evaluateJobAuthority({
          workerActor: o.workerActor, nowMs: host.now(), thread: view.value.thread,
          created: { eventType: 'created', payload: created.payload, createdAt: created.createdAt },
          charter, commit: {
            exists: typeof jobPayload.commit === 'string' && host.commitExists(jobPayload.commit),
            isAncestorOfOriginMain: typeof jobPayload.commit === 'string' && host.isAncestorOfOriginMain(jobPayload.commit),
            fetchedAtMs,
          },
          history: { complete: history !== null, acceptedInWindow: history },
          tree: typeof jobPayload.commit === 'string' ? host.lsTree(jobPayload.commit) : null,
          harnessQualified: qualified,
        });
        if (!decision.eligible) {
          report.decisions.push({ threadId, decision: `ineligible:${decision.reason}` });
          if (!o.planOnly && isJobIntrinsic(decision.reason) && view.value.thread.intendedRecipient === o.workerActor
            && ['created', 'delivered'].includes(view.value.thread.state)) {
            await sendFrozen(ledger, state, threadId, 'rejected', 'comment', {
              key: `lrw.${instanceId}.${threadId}.rejected`, payload: { schema: WORKER_REJECTION_SCHEMA, reasonCode: decision.reason },
              content: `Local Read-only Worker rejected this job before claim: ${decision.reason}`, recipientActor: view.value.thread.originActor,
            });
          }
          return 'skipped';
        }
        report.decisions.push({ threadId, decision: o.planOnly ? 'eligible(plan-only: not claimed)' : 'eligible' });
        if (o.planOnly) return 'skipped';
        if (outboxBlocksClaims(state.outbox())) { report.halted = 'outbox_unresolved'; return 'skipped'; }

        const seq = view.value.thread.latestSequence;
        const claimKey = claimKeyFor(instanceId, threadId, runNonce, seq);
        const claim = await ledger.append(threadId, 'accepted', {
          expectedSequence: seq, idempotencyKey: claimKey, content: 'Local Read-only Worker claim',
          payload: { instanceId, runNonce, claimKey, charterId: charter.id, charterVersion: charter.version },
        });
        const cd = decideClaimOutcome({ attemptKey: claimKey, result: claim, alreadyLaunchedKeys: new Set(state.launched(claimKey) ? [claimKey] : []) });
        if (cd.action !== 'launch') {
          report.decisions.push({ threadId, decision: `claim:${cd.action}` });
          if (cd.action === 'halt') report.halted = `claim_${cd.reason}`;
          return 'skipped';
        }
        state.markLaunched(claimKey);
        const outcome = await execute(threadId, decision.job, decision.stagingFiles, claimKey, harness!, charter.version);
        report.outcomes.push({ threadId, outcome });
        if (outcome === 'termination_unverified') report.halted = 'termination_unverified';
        return 'ran';
      }

      async function execute(threadId: string, job: WorkerJob, files: { path: string; size: number }[], claimKey: string,
        harness: { path: string; version: string; sha256: string }, charterVersion: number): Promise<string> {
        const started = host.now();
        let staging: string | null = null;
        const fail = async (failureClass: WorkerFailureClass, stage: string, ownerWritable: boolean, extra: Record<string, unknown> = {}) => {
          const payload = {
            schema: WORKER_FAILURE_SCHEMA, jobThreadId: threadId, instanceId, runNonce, claimKey, stage, failureClass,
            detail: failureClass, evidence: { timings: { elapsedMs: Math.max(0, host.now() - started) }, ...extra },
          };
          if (!ownerWritable) {
            state.receipt(threadId, failureClass, payload);
            for (const e of state.outbox().filter((x) => x.key.includes(threadId) && x.state === 'pending')) {
              state.saveOutbox(threadId, 'abandoned', { ...e, state: 'abandoned_authority_lost' });
            }
            return failureClass;
          }
          await sendOwned(threadId, 'blocked', claimKey, payload, [], `Local Read-only Worker stopped: ${failureClass}`);
          return failureClass;
        };
        try {
          staging = host.stage(job.commit, files);
          const env = buildHarnessEnv(job.authProfile, host.env(), o.designatedApiKey);
          const args = buildHarnessArgs(job, o.adapter, buildPrompt(job));
          const h = host.launch({ exe: harness.path, args, cwd: staging, env });
          let unknown = 0;
          let stopped: { failureClass: WorkerFailureClass; ownerWritable: boolean } | null = null;
          const exitedFlag = { done: false, code: null as number | null };
          void h.exited.then((e) => { exitedFlag.done = true; exitedFlag.code = e.code; });
          while (!exitedFlag.done) {
            // Wake on harness exit OR the 15 s watchdog tick, whichever comes first.
            await Promise.race([h.exited, host.sleep(15_000)]);
            if (exitedFlag.done) break;
            const [cr, tr] = await Promise.all([ledger.getCharter(o.charterId, charterVersion), ledger.showThread(threadId)]);
            const fence: RemoteRead<{ currentOwner: string | null; state: string; latestAcceptedClaimKey: string | null }> = tr.ok
              ? { ok: true, value: { currentOwner: tr.value.thread.currentOwner, state: tr.value.thread.state, latestAcceptedClaimKey: latestClaimKey(tr.value) } }
              : tr;
            const wd = decideWatchdog({
              nowMs: host.now(), runDeadlineMs: started + job.limits.maxRuntimeSec * 1000, windowEndMs: Date.parse(body.window.notAfter),
              jobDeadlineMs: Date.parse(job.deadline), charterRead: cr.ok ? { ok: true, value: { approvalState: cr.value.approvalState } } : cr,
              threadRead: fence, consecutiveUnknown: unknown, workerActor: o.workerActor, claimKey,
            });
            if (wd.action === 'continue') { unknown = wd.consecutiveUnknown; continue; }
            stopped = { failureClass: wd.failureClass, ownerWritable: wd.ownerWritable };
            h.terminate();
            const ex = await Promise.race([h.exited, host.sleep(15_000).then(() => null)]);
            if (ex === null) { h.killLauncher(); await h.exited; return await fail('termination_unverified', 'run', false); }
            if (ex.code !== 80 && ex.code !== 0) return await fail('termination_unverified', 'run', false);
            break;
          }
          if (stopped) return await fail(stopped.failureClass, 'run', stopped.ownerWritable);
          if (exitedFlag.code === 79) return await fail('termination_unverified', 'run', false);
          if (exitedFlag.code !== null && exitedFlag.code >= 70 && exitedFlag.code <= 78) return await fail('harness_unavailable', 'launch', true);
          const v = host.validate(h.stdout(), staging, new Set(files.map((f) => f.path)));
          if (!v.ok) return await fail(v.failureClass, 'validate', true);
          const result = {
            schema: WORKER_RESULT_SCHEMA, jobThreadId: threadId, instanceId, runNonce, claimKey, charterId: job.charterId,
            charterVersion: job.charterVersion, authProfile: job.authProfile, model: job.model, harness: 'claude-cli' as const,
            harnessVersion: harness.version, harnessSha256: harness.sha256, configDigest: configDigest(o.adapter, job.authProfile),
            answer: v.answer, citations: v.citations, costTelemetryUsd: v.costTelemetryUsd, costBasis: 'client_estimate' as const,
            durationMs: Math.max(0, host.now() - started),
          };
          const evidence = buildCompletionEvidence(job.commit, v.citations);
          return (await sendOwned(threadId, 'completed', claimKey, result, evidence, 'Local Read-only Worker result')) ? 'completed' : 'send_ambiguous';
        } finally {
          if (staging) host.removeStaging(staging);
        }
      }

      async function sendOwned(threadId: string, eventType: 'completed' | 'blocked', claimKey: string, payload: Record<string, unknown>, evidence: unknown[], content: string): Promise<boolean> {
        const safe = assertSendablePayload(payload);
        if (!safe.ok) payload = { schema: WORKER_FAILURE_SCHEMA, jobThreadId: threadId, instanceId, runNonce, claimKey, stage: 'send', failureClass: 'schema_invalid', detail: safe.reason, evidence: { timings: {} } };
        const view = await ledger.showThread(threadId);
        if (!view.ok) return false;
        const fence = checkFence({ currentOwner: view.value.thread.currentOwner, state: view.value.thread.state, latestAcceptedClaimKey: latestClaimKey(view.value) }, o.workerActor, claimKey);
        if (!fence.ok) { state.receipt(threadId, `fence_${fence.reason}`, { eventType, payload }); return false; }
        const op = eventType === 'completed' ? 'completed' : 'blocked';
        return sendFrozen(ledger, state, threadId, op, eventType, { key: writeKeyFor(instanceId, threadId, op, claimKey), payload, evidence, content });
      }
    }
    return report;
  } finally {
    state.releaseLock();
  }
}

function latestClaimKey(v: ThreadView): string | null {
  const acc = v.events.filter((e) => e.eventType === 'accepted');
  return ((acc[acc.length - 1]?.payload ?? {}) as { claimKey?: string }).claimKey ?? null;
}

async function sendFrozen(ledger: LedgerPort, state: StateStore, threadId: string, op: string, eventType: 'completed' | 'blocked' | 'comment', m: {
  key: string; payload: Record<string, unknown>; evidence?: unknown[]; content: string; recipientActor?: string;
}): Promise<boolean> {
  const entry = freezeOutboxEntry(m.key, eventType, m.payload, m.evidence ?? []);
  state.saveOutbox(threadId, op, entry);
  return deliver(ledger, state, threadId, op, entry, m.content, m.recipientActor);
}

async function deliver(ledger: LedgerPort, state: StateStore, threadId: string, op: string, entry: OutboxEntry, content: string, recipientActor?: string): Promise<boolean> {
  let e = entry;
  for (;;) {
    const view = await ledger.showThread(threadId);
    if (view.ok) {
      const rec = reconcileOutboxEntry(e, view.value.events);
      if (rec === 'sent') { state.saveOutbox(threadId, op, { ...e, state: 'sent' }); return true; }
      if (rec === 'idempotency_conflict') { state.saveOutbox(threadId, op, { ...e, state: 'idempotency_conflict' }); return false; }
    }
    const seq = view.ok ? view.value.thread.latestSequence : 0;
    const r = await ledger.append(threadId, e.eventType as 'completed' | 'blocked' | 'comment', {
      expectedSequence: seq, idempotencyKey: e.key, content, payload: e.payload as Record<string, unknown>,
      evidence: e.evidence, ...(recipientActor ? { recipientActor } : {}),
    });
    if (r.ok) { state.saveOutbox(threadId, op, { ...e, state: 'sent' }); return true; }
    if (['not_participant', 'invalid_transition'].includes(r.errorCode) || r.httpStatus === 403) {
      state.saveOutbox(threadId, op, { ...e, state: 'abandoned_authority_lost' });
      state.receipt(threadId, 'authority_lost_on_send', { key: e.key, errorCode: r.errorCode });
      return false;
    }
    e = { ...e, attempts: e.attempts + 1 };
    const d = decideResend(r.errorCode, e.attempts);
    if (d.action === 'give_up') { state.saveOutbox(threadId, op, { ...e, state: 'send_ambiguous' }); return false; }
    state.saveOutbox(threadId, op, e);
  }
}

/** Start-of-run reconciliation (§5.7): every unresolved entry is reconciled before any new claim. */
async function reconcileOutbox(ledger: LedgerPort, state: StateStore, _actor: string, log: (l: string) => void): Promise<boolean> {
  for (const e of state.outbox()) {
    if (e.state !== 'pending' && e.state !== 'send_ambiguous') continue;
    const threadId = e.key.split('.')[2];
    const view = await ledger.showThread(threadId);
    if (!view.ok) { log(`outbox reconcile read failed for ${threadId}`); return false; }
    const rec = reconcileOutboxEntry(e, view.value.events);
    if (rec === 'sent') state.saveOutbox(threadId, 'reconciled', { ...e, state: 'sent' });
    else if (rec === 'idempotency_conflict') { state.saveOutbox(threadId, 'reconciled', { ...e, state: 'idempotency_conflict' }); return false; }
    else if (!(await deliver(ledger, state, threadId, 'reconciled', { ...e, state: 'pending' }, 'Local Read-only Worker (reconciled)'))) return false;
  }
  return !outboxBlocksClaims(state.outbox());
}

/** §5.9: threads this instance owns from an earlier run are blocked as interrupted; never re-executed. */
async function recoverOwn(ledger: LedgerPort, state: StateStore, o: SupervisorOptions, instanceId: string, runNonce: string,
  log: (l: string) => void, report: SupervisorReport): Promise<void> {
  let after = 0; let complete = false;
  const candidates: { threadId: string; view: ThreadView }[] = [];
  while (!complete) {
    const page = await ledger.listJobs({ charterId: o.charterId, charterVersion: o.charterVersion, after, limit: 100 });
    if (!page.ok) { log('recovery scan failed'); return; }
    for (const j of page.value.jobs) {
      const v = await ledger.showThread(j.threadId);
      if (v.ok) candidates.push({ threadId: j.threadId, view: v.value });
    }
    after = page.value.nextAfter; complete = page.value.complete;
  }
  const own = selectOwnRecoveries(candidates.map((c) => {
    const acc = c.view.events.filter((e) => e.eventType === 'accepted');
    return { threadId: c.threadId, state: c.view.thread.state, currentOwner: c.view.thread.currentOwner, latestAcceptedPayload: (acc[acc.length - 1]?.payload ?? null) as Record<string, unknown> | null };
  }), o.workerActor, instanceId);
  for (const threadId of own) {
    const c = candidates.find((x) => x.threadId === threadId)!;
    const claimKey = latestClaimKey(c.view)!;
    if (((c.view.events.filter((e) => e.eventType === 'accepted').at(-1)?.payload ?? {}) as { runNonce?: string }).runNonce === runNonce) continue;
    await sendFrozen(ledger, state, threadId, 'blocked', 'blocked', {
      key: writeKeyFor(instanceId, threadId, 'blocked', claimKey),
      payload: { schema: WORKER_FAILURE_SCHEMA, jobThreadId: threadId, instanceId, runNonce, claimKey, stage: 'recovery', failureClass: 'interrupted', detail: 'interrupted', evidence: { timings: {} } },
      content: 'Local Read-only Worker: earlier run was interrupted; not re-executed',
    });
    report.outcomes.push({ threadId, outcome: 'recovered_interrupted' });
  }
}
