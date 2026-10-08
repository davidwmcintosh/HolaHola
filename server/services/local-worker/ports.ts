/**
 * Local Read-only Worker v1 — production ports for the supervisor.
 *  - HTTP ledger port: 5 s bounded reads, error codes preserved (design §5.6).
 *  - Host port: git, harness resolution, staging, Job Object launcher.
 *  - File state store under %LOCALAPPDATA%\HolaHola\worker (design §5.1, §5.7).
 * The model process never receives the coordination token (buildHarnessEnv).
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync, writeSync,
} from 'node:fs';
import { join } from 'node:path';
import { sha256Hex } from '../../../shared/worker-contracts';
import { pickNewestExecutable, sha256File } from './adapter';
import type { CharterRecord } from './authority';
import { startJobLauncher } from './job-launcher';
import type { LedgerAppendResult, OutboxEntry, RemoteRead } from './lifecycle';
import { parseLsTreeZ } from './paths';
import { removeStaging, stageFiles, validateHarnessOutput } from './staging';
import type { HostPort, JobsPage, LaunchHandle, LedgerPort, StateStore, ThreadView } from './supervisor';

// ---------------------------------------------------------------------------
// HTTP ledger port
// ---------------------------------------------------------------------------

export function createHttpLedgerPort(baseUrl: string, token: string, fetchImpl: typeof fetch = fetch): LedgerPort {
  const base = baseUrl.replace(/\/+$/, '');
  async function call(method: 'GET' | 'POST', path: string, body?: unknown, idempotencyKey?: string, timeoutMs = 5000) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${base}${path}`, {
        method, signal: ctl.signal,
        headers: { accept: 'application/json', 'x-coordination-token': token,
          ...(body ? { 'content-type': 'application/json' } : {}), ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const text = await res.text();
      let json: Record<string, any> = {};
      try { json = text ? JSON.parse(text) : {}; } catch { json = {}; }
      return { status: res.status, json };
    } catch (e) {
      return { status: 0, json: { code: (e as Error).name === 'AbortError' ? 'timeout' : 'network_error' } };
    } finally { clearTimeout(t); }
  }
  const readErr = (status: number, json: Record<string, any>): RemoteRead<never> => {
    if (status === 0) return { ok: false, error: json.code === 'timeout' ? 'timeout' : 'network' };
    if (status === 403 && (json.code === 'not_participant' || /participant/i.test(String(json.error ?? '')))) return { ok: false, error: 'not_participant' };
    return { ok: false, error: status >= 500 ? 'http_5xx' : 'http_4xx' };
  };
  return {
    async getCharter(id, version): Promise<RemoteRead<CharterRecord>> {
      const r = await call('GET', `/api/worker-charters/${encodeURIComponent(id)}/versions/${version}`);
      if (r.status !== 200) return readErr(r.status, r.json);
      const j = r.json;
      return { ok: true, value: { id: j.id, version: j.version, body: j.body, bodyDigest: j.bodyDigest, approvalState: j.approvalState, approvedAt: j.approvedAt } };
    },
    async listJobs(q): Promise<RemoteRead<JobsPage>> {
      const qs = new URLSearchParams({ charterId: q.charterId, charterVersion: String(q.charterVersion), after: String(q.after), limit: String(q.limit) });
      const r = await call('GET', `/api/worker/jobs?${qs}`);
      if (r.status !== 200) return readErr(r.status, r.json);
      return { ok: true, value: { jobs: r.json.jobs, nextAfter: r.json.nextAfter, complete: r.json.complete === true, acceptedInWindow: Number(r.json.acceptedInWindow) } };
    },
    async showThread(threadId): Promise<RemoteRead<ThreadView>> {
      const r = await call('GET', `/api/coordination/threads/${encodeURIComponent(threadId)}`);
      if (r.status !== 200) return readErr(r.status, r.json);
      const t = r.json.thread;
      return {
        ok: true,
        value: {
          thread: { id: t.id, state: t.state, originActor: t.originActor, intendedRecipient: t.intendedRecipient, currentOwner: t.currentOwner ?? null,
            latestSequence: t.latestSequence, sourceReference: t.sourceReference ?? null },
          events: (r.json.events ?? []).map((e: Record<string, any>) => ({
            idempotencyKey: e.idempotencyKey, eventType: e.eventType, payload: e.payload ?? {}, evidence: e.evidence ?? [],
            sequence: e.sequence, actor: e.actor, createdAt: e.createdAt,
          })),
        },
      };
    },
    async append(threadId, eventType, input): Promise<LedgerAppendResult> {
      const r = await call('POST', `/api/coordination/threads/${encodeURIComponent(threadId)}/events`, {
        eventType, content: input.content, expectedSequence: input.expectedSequence,
        ...(input.recipientActor ? { recipientActor: input.recipientActor } : {}),
        ...(input.evidence && input.evidence.length ? { evidence: input.evidence } : {}),
        ...(input.payload ? { payload: input.payload } : {}),
      }, input.idempotencyKey, 15_000);
      if (r.status === 200 || r.status === 201) return { ok: true, deduplicated: r.json.deduplicated === true, event: { eventType: r.json.event?.eventType, payload: r.json.event?.payload ?? {} } };
      if (r.status === 0) return { ok: false, errorCode: r.json.code === 'timeout' ? 'timeout' : 'network_error' };
      return { ok: false, errorCode: String(r.json.code ?? 'unknown'), httpStatus: r.status };
    },
  };
}

// ---------------------------------------------------------------------------
// Host port
// ---------------------------------------------------------------------------

export function createHostPort(input: { repoRoot: string; stagingRoot: string }): HostPort {
  const git = (...args: string[]) => execFileSync('git', args, { cwd: input.repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return {
    now: () => Date.now(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    async fetchOrigin() { try { git('fetch', '--quiet', 'origin', 'main'); return true; } catch { return false; } },
    commitExists(c) { try { git('cat-file', '-e', `${c}^{commit}`); return true; } catch { return false; } },
    isAncestorOfOriginMain(c) { try { git('merge-base', '--is-ancestor', c, 'origin/main'); return true; } catch { return false; } },
    lsTree(c) { try { return parseLsTreeZ(git('ls-tree', '-r', '-l', '-z', c)); } catch { return null; } },
    async resolveHarness() {
      const packages = join(process.env.LOCALAPPDATA ?? '', 'Packages');
      if (!existsSync(packages)) return null;
      const candidates: { version: string; path: string }[] = [];
      for (const pkg of readdirSync(packages).filter((n) => /^Claude_[a-z0-9]+$/i.test(n))) {
        const root = join(packages, pkg, 'LocalCache', 'Roaming', 'Claude', 'claude-code');
        if (!existsSync(root)) continue;
        for (const version of readdirSync(root)) {
          const vdir = join(root, version);
          for (const hash of existsSync(vdir) ? readdirSync(vdir) : []) {
            const exe = join(vdir, hash, 'claude.exe');
            if (existsSync(exe)) candidates.push({ version, path: exe });
          }
        }
      }
      const pick = pickNewestExecutable(candidates);
      return pick ? { ...pick, sha256: await sha256File(pick.path) } : null;
    },
    stage(commit, files) {
      const dir = join(input.stagingRoot, randomBytes(4).toString('hex'), 'in');
      stageFiles({ repoRoot: input.repoRoot, commit, files, stagingDir: dir });
      return dir;
    },
    removeStaging: (dir) => removeStaging(join(dir, '..')),
    validate: validateHarnessOutput,
    launch(cfg): LaunchHandle {
      const h = startJobLauncher({ exe: cfg.exe, args: cfg.args, cwd: cfg.cwd, env: cfg.env });
      return { terminate: h.terminate, killLauncher: h.killLauncher, exited: h.exited, stdout: () => Buffer.concat(h.harnessStdout).toString('utf8') };
    },
    env: () => ({ ...process.env }),
  };
}

// ---------------------------------------------------------------------------
// File state store
// ---------------------------------------------------------------------------

function processIdentity(pid: number): { creationDate: string; executablePath: string } | null {
  try {
    const out = execFileSync(`${process.env.SystemRoot ?? 'C:\\Windows'}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`,
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
        `$p = Get-CimInstance Win32_Process -Filter "ProcessId=${Math.trunc(pid)}"; if ($p) { $p.CreationDate.ToUniversalTime().ToString('o') + '|' + $p.ExecutablePath }`],
      { encoding: 'utf8', windowsHide: true }).trim();
    if (!out) return null;
    const [creationDate, executablePath] = out.split('|');
    return { creationDate, executablePath };
  } catch { return null; }
}

function atomicWrite(path: string, data: string): void {
  const tmp = `${path}.${randomBytes(4).toString('hex')}.tmp`;
  writeFileSync(tmp, data, { flag: 'wx' });
  renameSync(tmp, path);
}

export function defaultStateDir(): string {
  return join(process.env.LOCALAPPDATA ?? '', 'HolaHola', 'worker');
}

export function createFileStateStore(dir: string = defaultStateDir()): StateStore {
  if (/^\\\\/.test(dir) || !/^[A-Za-z]:\\/.test(dir)) throw new Error('state_dir_must_be_local_drive');
  for (const d of [dir, join(dir, 'outbox'), join(dir, 'receipts'), join(dir, 'launched')]) mkdirSync(d, { recursive: true });
  const lockPath = join(dir, 'supervisor.lock');
  const instPath = join(dir, 'instance.json');
  const scanPath = join(dir, 'scan.json');
  return {
    instanceId() {
      if (!existsSync(instPath)) {
        try { writeFileSync(instPath, JSON.stringify({ instanceId: crypto.randomUUID(), createdAt: new Date().toISOString() }), { flag: 'wx' }); } catch { /* raced: read below */ }
      }
      return JSON.parse(readFileSync(instPath, 'utf8')).instanceId as string;
    },
    acquireLock(runNonce, reclaimStale) {
      const me = processIdentity(process.pid);
      const record = JSON.stringify({ pid: process.pid, creationDate: me?.creationDate ?? null, executablePath: me?.executablePath ?? process.execPath, runNonce });
      const tryCreate = () => { const fd = openSync(lockPath, 'wx'); writeSync(fd, record); closeSync(fd); };
      try { tryCreate(); return { ok: true }; } catch { /* exists */ }
      if (!reclaimStale) return { ok: false, reason: 'held' };
      let held: { pid: number; creationDate: string | null; executablePath: string };
      try { held = JSON.parse(readFileSync(lockPath, 'utf8')); } catch { return { ok: false, reason: 'lock_unreadable' }; }
      const live = processIdentity(held.pid);
      // Reclaim only if no live process matches pid AND creation time AND image.
      if (live && live.creationDate === held.creationDate && live.executablePath === held.executablePath) return { ok: false, reason: 'held_by_live_process' };
      unlinkSync(lockPath);
      try { tryCreate(); return { ok: true }; } catch { return { ok: false, reason: 'held' }; }
    },
    releaseLock() { try { unlinkSync(lockPath); } catch { /* already gone */ } },
    outbox() {
      return readdirSync(join(dir, 'outbox')).filter((f) => f.endsWith('.json'))
        .map((f) => JSON.parse(readFileSync(join(dir, 'outbox', f), 'utf8')) as OutboxEntry);
    },
    saveOutbox(_threadId, _op, entry) { atomicWrite(join(dir, 'outbox', `${sha256Hex(entry.key).slice(0, 24)}.json`), JSON.stringify(entry)); },
    receipt(threadId, kind, data) {
      atomicWrite(join(dir, 'receipts', `${threadId}.${kind}.${Date.now()}.json`), JSON.stringify({ threadId, kind, at: new Date().toISOString(), data }));
    },
    launched: (key) => existsSync(join(dir, 'launched', sha256Hex(key).slice(0, 32))),
    markLaunched: (key) => { writeFileSync(join(dir, 'launched', sha256Hex(key).slice(0, 32)), key, { flag: 'w' }); },
    scanAfter(charterId, version) {
      try { return Number(JSON.parse(readFileSync(scanPath, 'utf8'))[`${charterId}:${version}`] ?? 0); } catch { return 0; }
    },
    saveScanAfter(charterId, version, after) {
      let m: Record<string, number> = {};
      try { m = JSON.parse(readFileSync(scanPath, 'utf8')); } catch { m = {}; }
      m[`${charterId}:${version}`] = after;
      atomicWrite(scanPath, JSON.stringify(m));
    },
  };
}
