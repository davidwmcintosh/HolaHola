/**
 * Regression: a just-written capture must never look successful merely because
 * the source file exists.  The record-exchange acknowledgement waits for the
 * durable cursor; a silent/unprocessed turn times out, then succeeds only
 * after the cursor reaches the expected boundary.
 *
 * This test uses only a private temporary cursor file.  It never touches the
 * live capture stream, receipt, DB, or episode.
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import {
  isRemoteCaptureAcknowledged,
  waitForCaptureAcknowledgement,
} from './record-exchange';

const testDir = join(tmpdir(), `record-exchange-ack-${process.pid}-${randomUUID()}`);
const cursorPath = join(testDir, 'cursor.json');

function fail(message: string): never {
  console.error(`[record-exchange-ack] FAIL: ${message}`);
  process.exit(1);
}

async function run(): Promise<void> {
  mkdirSync(testDir, { recursive: true });
  try {
    writeFileSync(cursorPath, JSON.stringify({ byteOffset: 100 }), 'utf-8');

    let rejected = false;
    try {
      await waitForCaptureAcknowledgement(200, {
        cursorPath,
        timeoutMs: 80,
        pollMs: 10,
      });
    } catch (error) {
      rejected = String(error).includes('Capture acknowledgement timed out');
    }
    if (!rejected) {
      fail('a capture with no cursor growth did not fail visibly');
    }
    console.log('  ✓ unchanged cursor fails as an unacknowledged turn');

    setTimeout(() => {
      writeFileSync(cursorPath, JSON.stringify({ byteOffset: 200 }), 'utf-8');
    }, 20);
    const acknowledgement = await waitForCaptureAcknowledgement(200, {
      cursorPath,
      timeoutMs: 500,
      pollMs: 10,
    });
    if (acknowledgement.cursorOffset !== 200) {
      fail(`acknowledgement returned cursor ${acknowledgement.cursorOffset}, expected 200`);
    }
    console.log('  ✓ cursor advance releases the exact pending capture');

    const mirrorPendingHealth = {
      capture: {
        worker: { armed: true },
        cursorByteOffset: 250,
        acknowledgementCursorByteOffset: 150,
      },
    };
    if (isRemoteCaptureAcknowledged(mirrorPendingHealth, 200)) {
      fail('normal cursor growth released a capture whose live-episode mirror was still pending');
    }
    if (!isRemoteCaptureAcknowledged({
      capture: {
        worker: { armed: true },
        cursorByteOffset: 250,
        acknowledgementCursorByteOffset: 200,
      },
    }, 200)) {
      fail('mirror-aware acknowledgement cursor did not release the completed capture');
    }
    console.log('  ✓ remote acknowledgement waits for the mirror-aware cursor, not normal DB progress');
    console.log('[record-exchange-ack] PASS — silence is visible; canonical acknowledgement is required');
  } finally {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
  }
}

run().catch(error => fail(error instanceof Error ? error.message : String(error)));