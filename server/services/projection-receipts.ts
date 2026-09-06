import { createHash, randomUUID } from 'node:crypto';
import { closeSync, constants, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

export const PROJECTION_RECEIPTS_PATH = '.local/projection-receipts.jsonl';
const MAX_LINE_BYTES = 16 * 1024;
export type ProjectionKind = 'episode-db-markdown' | 'mailbox-ledger-json' | 'mailbox-markdown';
export type ProjectionReceipt = { schemaVersion: 1; state: 'pending' | 'completed'; operationId: string; path: string; kind: ProjectionKind; writer: string; source: { type: 'conversation_memory' | 'agent_notes' | 'mailbox_snapshot'; ids: string[] }; beforeHash: string | 'missing'; resultHash: string; reason: string; timestamp: string; correlation?: Record<string, string> };
let failCompletedAppendForTest = false;
let afterParentOpenForTest: (() => void) | undefined;
export function setProjectionReceiptCompletedAppendFailureForTest(value: boolean): void { failCompletedAppendForTest = value; }
export function setProjectionAfterParentOpenForTest(value?: () => void): void { afterParentOpenForTest = value; }
export const hashProjectionBytes = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const hashOk = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
export function isAllowedProjectionPath(path: string, kind: ProjectionKind): boolean {
  return (kind === 'episode-db-markdown' && /^docs\/episode-\d+\.md$/.test(path))
    || (kind === 'mailbox-ledger-json' && /^docs\/mailbox-ledgers\/(?:claude-code-to-luca|luca-to-claude-code)\.json$/.test(path))
    || (kind === 'mailbox-markdown' && /^docs\/(?:claude-code-to-luca|luca-to-claude-code)\.md$/.test(path));
}
export function projectionPath(root: string, destination: string): string {
  const path = relative(resolve(root), resolve(destination)).replace(/\\/g, '/');
  if (!path || path.startsWith('..') || path.includes('\0')) throw new Error('Projection destination is outside the workspace.');
  return path;
}
function assertNoSymlink(root: string, destination: string): void {
  const rootResolved = resolve(root), target = resolve(destination);
  for (let current = target; current.startsWith(rootResolved); current = dirname(current)) {
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error(`Projection destination contains a symlink: ${current}`);
    if (current === rootResolved) break;
  }
}
function heldDirectory(root: string, directory: string): { fd: number; path: string } {
  assertNoSymlink(root, directory);
  const fd = openSync(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  const held = `/proc/self/fd/${fd}`;
  const rootReal = realpathSync(root);
  const directoryReal = realpathSync(held);
  if (directoryReal !== rootReal && !directoryReal.startsWith(`${rootReal}/`)) {
    closeSync(fd); throw new Error('Held projection directory escaped the workspace.');
  }
  return { fd, path: held };
}
function readHeldFile(parent: { fd: number; path: string }, name: string): Buffer | undefined {
  const path = `${parent.path}/${name}`;
  try {
    const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try { return readFileSync(fd); } finally { closeSync(fd); }
  } catch (error: any) {
    if (error?.code === 'ENOENT') return undefined;
    throw error;
  }
}
function append(root: string, entry: ProjectionReceipt): void {
  const line = `${JSON.stringify(entry)}\n`;
  if (Buffer.byteLength(line) > MAX_LINE_BYTES) throw new Error('Projection receipt exceeds bounded journal record size.');
  const local = join(root, '.local'); mkdirSync(local, { recursive: true, mode: 0o700 });
  const parent = heldDirectory(root, local);
  try {
    const fd = openSync(`${parent.path}/projection-receipts.jsonl`, constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW, 0o600);
    try { writeFileSync(fd, line, 'utf8'); fsyncSync(fd); } finally { closeSync(fd); }
    fsyncSync(parent.fd);
  } finally { closeSync(parent.fd); }
}
function valid(value: any): value is ProjectionReceipt {
  return value?.schemaVersion === 1 && (value.state === 'pending' || value.state === 'completed')
    && typeof value.operationId === 'string' && /^[a-f0-9-]{36}$/.test(value.operationId)
    && typeof value.path === 'string' && isAllowedProjectionPath(value.path, value.kind)
    && typeof value.writer === 'string' && value.writer.length > 0 && value.writer.length < 256
    && value.source && Array.isArray(value.source.ids) && value.source.ids.length > 0 && value.source.ids.every((id: unknown) => typeof id === 'string' && id.length > 0 && id.length < 512)
    && (value.beforeHash === 'missing' || hashOk(value.beforeHash)) && hashOk(value.resultHash)
    && typeof value.reason === 'string' && value.reason.length > 0 && value.reason.length < 1024
    && typeof value.timestamp === 'string' && !Number.isNaN(Date.parse(value.timestamp));
}
function entries(root: string): ProjectionReceipt[] {
  try {
    const parent = heldDirectory(root, join(root, '.local'));
    let bytes: Buffer;
    try { bytes = readHeldFile(parent, 'projection-receipts.jsonl') ?? Buffer.alloc(0); } finally { closeSync(parent.fd); }
    return bytes.toString('utf8').split('\n').filter(Boolean).flatMap((line) => {
      if (Buffer.byteLength(line) > MAX_LINE_BYTES) return [];
      try { const entry = JSON.parse(line); return valid(entry) ? [entry] : []; } catch { return []; }
    });
  } catch { return []; }
}
/** Recover only pending operations whose final bytes prove the intended rename completed. */
export function readProjectionReceipts(root: string): ProjectionReceipt[] {
  const all = entries(root), completed = new Set(all.filter((x) => x.state === 'completed').map((x) => x.operationId));
  for (const pending of all.filter((x) => x.state === 'pending' && !completed.has(x.operationId))) {
    try {
      const file = resolve(root, pending.path);
      const parent = heldDirectory(root, dirname(file));
      let final: Buffer | undefined;
      try { final = readHeldFile(parent, basename(file)); } finally { closeSync(parent.fd); }
      if (final && hashProjectionBytes(final) === pending.resultHash) {
        append(root, { ...pending, state: 'completed', timestamp: new Date().toISOString() });
      }
    } catch { /* unresolved pending records are deliberately not trusted */ }
  }
  return entries(root).filter((entry) => entry.state === 'completed');
}
/** Pending records that could not be proven complete remain explicit evidence,
 * never successful receipts. */
export function unresolvedProjectionReceipts(root: string): ProjectionReceipt[] {
  const all = entries(root);
  const done = new Set(all.filter((entry) => entry.state === 'completed').map((entry) => entry.operationId));
  return all.filter((entry) => entry.state === 'pending' && !done.has(entry.operationId));
}
export function writeProjectionAtomically(root: string, destination: string, bytes: string, receipt: Omit<ProjectionReceipt, 'schemaVersion' | 'state' | 'operationId' | 'path' | 'beforeHash' | 'resultHash' | 'timestamp'>): { changed: boolean; receipt?: ProjectionReceipt } {
  const path = projectionPath(root, destination);
  if (!isAllowedProjectionPath(path, receipt.kind) || !receipt.source.ids.length) throw new Error(`Unauthorized or unidentified projection: ${path}`);
  const parent = heldDirectory(root, dirname(destination));
  try {
    afterParentOpenForTest?.();
    const name = basename(destination);
    const result = Buffer.from(bytes), before = readHeldFile(parent, name);
    if (before?.equals(result)) return { changed: false };
    const record: ProjectionReceipt = { schemaVersion: 1, state: 'pending', operationId: randomUUID(), path, kind: receipt.kind, writer: receipt.writer, source: receipt.source, beforeHash: before ? hashProjectionBytes(before) : 'missing', resultHash: hashProjectionBytes(result), reason: receipt.reason, timestamp: new Date().toISOString(), correlation: receipt.correlation };
    append(root, record);
    const temporaryName = `.${name}.${record.operationId}.tmp`;
    try {
      const fd = openSync(`${parent.path}/${temporaryName}`, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      try { writeFileSync(fd, result); fsyncSync(fd); } finally { closeSync(fd); }
      renameSync(`${parent.path}/${temporaryName}`, `${parent.path}/${name}`);
      fsyncSync(parent.fd);
    } catch (error) { try { unlinkSync(`${parent.path}/${temporaryName}`); } catch {} throw error; }
    const final = readHeldFile(parent, name);
    if (!final || hashProjectionBytes(final) !== record.resultHash) throw new Error(`Projection post-rename hash verification failed: ${path}`);
    if (failCompletedAppendForTest) throw new Error('Synthetic completed receipt append failure.');
    const completed = { ...record, state: 'completed' as const, timestamp: new Date().toISOString() };
    append(root, completed);
    return { changed: true, receipt: completed };
  } finally { closeSync(parent.fd); }
}

/** Descriptor-bound write for deliberately synthetic test bytes. It emits no
 * canonical receipt and must never be used by a production projection. */
export function writeIsolatedProjectionFixture(root: string, destination: string, bytes: string): void {
  const path = projectionPath(root, destination);
  if (!/^docs\/episode-\d+\.md$/.test(path)) throw new Error(`Unauthorized fixture destination: ${path}`);
  const parent = heldDirectory(root, dirname(destination));
  const name = basename(destination), temporary = `.${name}.${randomUUID()}.fixture.tmp`;
  try {
    const fd = openSync(`${parent.path}/${temporary}`, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { writeFileSync(fd, Buffer.from(bytes)); fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(`${parent.path}/${temporary}`, `${parent.path}/${name}`);
    fsyncSync(parent.fd);
  } finally { try { unlinkSync(`${parent.path}/${temporary}`); } catch {} closeSync(parent.fd); }
}

export function removeIsolatedProjectionFixture(root: string, destination: string): void {
  const path = projectionPath(root, destination);
  if (!/^docs\/episode-\d+\.md$/.test(path)) throw new Error(`Unauthorized fixture destination: ${path}`);
  const parent = heldDirectory(root, dirname(destination));
  try {
    unlinkSync(`${parent.path}/${basename(destination)}`);
    fsyncSync(parent.fd);
  } finally { closeSync(parent.fd); }
}