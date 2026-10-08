import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { freezeOutboxEntry } from './lifecycle';
import { createFileStateStore, createHttpLedgerPort } from './ports';

async function fakeApi(handler: http.RequestListener) {
  const s = http.createServer(handler);
  await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
  return { base: `http://127.0.0.1:${(s.address() as { port: number }).port}`, close: () => new Promise<void>((r) => { s.closeAllConnections(); s.close(() => r()); }) };
}

test('HTTP port preserves ledger error codes and sends the token only as a header', async () => {
  let seenToken = '';
  const api = await fakeApi((req, res) => {
    seenToken = String(req.headers['x-coordination-token']);
    res.writeHead(409, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Sequence conflict', code: 'sequence_conflict' }));
  });
  try {
    const port = createHttpLedgerPort(api.base, 'tok');
    const r = await port.append('t1', 'accepted', { expectedSequence: 2, idempotencyKey: 'lrw.k.accept', content: 'c' });
    assert.deepEqual(r, { ok: false, errorCode: 'sequence_conflict', httpStatus: 409 });
    assert.equal(seenToken, 'tok');
  } finally { await api.close(); }
});

test('HTTP port: not_participant reads are distinguished; a hung server becomes a bounded timeout', async () => {
  const api = await fakeApi((req, res) => {
    if (req.url?.startsWith('/api/coordination/threads/')) {
      res.writeHead(403, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Actor is not a thread participant', code: 'not_participant' }));
      return;
    }
    // /api/worker-charters... : never respond (simulated stall)
  });
  try {
    const port = createHttpLedgerPort(api.base, 'tok');
    assert.deepEqual(await port.showThread('t1'), { ok: false, error: 'not_participant' });
    const started = Date.now();
    const c = await port.getCharter('11111111-2222-4333-8444-555555555555', 1);
    assert.deepEqual(c, { ok: false, error: 'timeout' });
    assert.ok(Date.now() - started < 8000, 'read must be bounded (~5 s)');
  } finally { await api.close(); }
});

test('state store: exclusive lock, live owner cannot be reclaimed, release frees it', { skip: process.platform !== 'win32' ? 'Windows state store (not run on this platform)' : false }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'lrw-state-'));
  try {
    const a = createFileStateStore(dir);
    const b = createFileStateStore(dir);
    assert.deepEqual(a.acquireLock('n1', false), { ok: true });
    assert.deepEqual(b.acquireLock('n2', false), { ok: false, reason: 'held' });
    // The holder (this test process) is alive with matching identity: reclaim must refuse.
    assert.deepEqual(b.acquireLock('n2', true), { ok: false, reason: 'held_by_live_process' });
    a.releaseLock();
    assert.deepEqual(b.acquireLock('n2', false), { ok: true });
    b.releaseLock();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('state store: stable instance id, persisted outbox and launched markers, scan positions', { skip: process.platform !== 'win32' ? 'Windows state store (not run on this platform)' : false }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'lrw-state-'));
  try {
    const s = createFileStateStore(dir);
    const id = s.instanceId();
    assert.equal(createFileStateStore(dir).instanceId(), id);
    const e = freezeOutboxEntry('lrw.x.t.completed.abcd1234', 'completed', { a: 1 });
    s.saveOutbox('t', 'completed', e);
    s.saveOutbox('t', 'completed', { ...e, state: 'sent' });
    const reopened = createFileStateStore(dir).outbox();
    assert.equal(reopened.length, 1);
    assert.equal(reopened[0].state, 'sent');
    s.markLaunched('k1');
    assert.equal(createFileStateStore(dir).launched('k1'), true);
    s.saveScanAfter('c', 1, 42);
    assert.equal(createFileStateStore(dir).scanAfter('c', 1), 42);
    assert.throws(() => createFileStateStore('\\\\server\\share\\x'), /state_dir_must_be_local_drive/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
