/**
 * inner-life-lock.ts
 *
 * Cross-process file lock over the Luca inner-life trigger files
 * (.luca_reflection / .luca_question / .luca_moment).
 *
 * WHY: exactly one watcher may drain those files at a time. The
 * capture-watchdog decides ownership by observing a stale autosave heartbeat,
 * but a dev server can boot *during* a watchdog drain — between the watchdog's
 * DB insert and its processed-sha state persistence. Without a lock the
 * autosave startup seed would find no lastProcessedMs and both processes would
 * save the identical entry. Both sides therefore serialize on this lock:
 *   - the watchdog holds it for the whole inner-life drain tick
 *     (DB work + state save are atomic w.r.t. other watchers), and
 *   - autosave holds it during startup trigger seeding AND each inner-life
 *     poll pass.
 *
 * Lock format: JSON { pid, acquiredAt } written with O_EXCL. A lock older
 * than STALE_LOCK_MS is presumed abandoned (crashed holder) and taken over.
 */

import * as fs from 'fs';

export const STALE_LOCK_MS = 2 * 60 * 1000;

/** Try to acquire the lock. Returns true if acquired. Non-blocking. */
export function tryAcquireInnerLifeLock(lockPath: string): boolean {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, acquiredAt: Date.now() }), { flag: 'wx' });
      return true;
    } catch (err: any) {
      if (err?.code !== 'EEXIST') return false;
      // Held — check for a stale (crashed-holder) lock and take it over once.
      try {
        const age = Date.now() - fs.statSync(lockPath).mtimeMs;
        if (age > STALE_LOCK_MS) {
          fs.unlinkSync(lockPath);
          continue; // retry the O_EXCL write
        }
      } catch { /* raced with a release — retry */ continue; }
      return false;
    }
  }
  return false;
}

/**
 * Renew the lock lease if this process holds it (refreshes the file mtime).
 * A live-but-slow holder (e.g. a drain awaiting DB I/O) must call this
 * periodically so contenders can distinguish it from an abandoned crashed
 * holder: takeover only triggers when the mtime is older than STALE_LOCK_MS,
 * i.e. when renewals have stopped. Best-effort; never throws.
 */
export function renewInnerLifeLock(lockPath: string): void {
  try {
    const holder = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
    if (holder?.pid === process.pid) {
      const now = new Date();
      fs.utimesSync(lockPath, now, now);
    }
  } catch { /* lost or unreadable — the drain's own release path handles it */ }
}

/** Release the lock if this process holds it (best-effort; never throws). */
export function releaseInnerLifeLock(lockPath: string): void {
  try {
    const holder = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
    if (holder?.pid === process.pid) fs.unlinkSync(lockPath);
  } catch { /* already gone or unreadable — ignore */ }
}

/**
 * Acquire the lock, waiting up to timeoutMs (polling every pollMs).
 * Used by the autosave startup seed so it never races an in-flight watchdog
 * drain: it waits for the drain to finish, then re-reads the watchdog state
 * (which by then includes lastProcessedMs for anything the watchdog saved).
 * Returns true if acquired within the timeout.
 */
export async function waitForInnerLifeLock(
  lockPath: string,
  timeoutMs = 15_000,
  pollMs = 250,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (tryAcquireInnerLifeLock(lockPath)) return true;
    await new Promise(r => setTimeout(r, pollMs));
  }
  return tryAcquireInnerLifeLock(lockPath);
}
