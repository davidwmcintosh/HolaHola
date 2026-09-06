import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { winDurableReconnectAuthority } from '../services/reconnect-authority';

function deferred(): {
  promise: Promise<void>;
  resolve: () => void;
} {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('durable reconnect authority', () => {
  it('grants exactly one winner to two concurrent claims', async () => {
    let durableRow = true;
    const deleteReturning = async () => {
      if (!durableRow) return [];
      durableRow = false;
      return [{ usageSessionId: 'voice-1' }];
    };
    const results = await Promise.all([
      winDurableReconnectAuthority(Promise.resolve(), deleteReturning),
      winDurableReconnectAuthority(Promise.resolve(), deleteReturning),
    ]);
    assert.deepEqual(results.sort(), [false, true]);
  });

  it('prevents expiry from finalizing after a reconnect claim won', async () => {
    let durableRow = true;
    const take = async () => {
      if (!durableRow) return [];
      durableRow = false;
      return [{ usageSessionId: 'voice-1' }];
    };
    assert.equal(await winDurableReconnectAuthority(Promise.resolve(), take), true);
    assert.equal(await winDurableReconnectAuthority(Promise.resolve(), take), false);
  });

  it('waits for store persistence before an immediate reconnect claim', async () => {
    const stored = deferred();
    let deleteAttempted = false;
    const claim = winDurableReconnectAuthority(stored.promise, async () => {
      deleteAttempted = true;
      return [{ usageSessionId: 'voice-1' }];
    });
    await Promise.resolve();
    assert.equal(deleteAttempted, false);
    stored.resolve();
    assert.equal(await claim, true);
    assert.equal(deleteAttempted, true);
  });

  it('fails closed on persistence and delete errors', async () => {
    assert.equal(
      await winDurableReconnectAuthority(Promise.reject(new Error('write failed')), async () => [{}]),
      false,
    );
    assert.equal(
      await winDurableReconnectAuthority(Promise.resolve(), async () => { throw new Error('delete failed'); }),
      false,
    );
  });
});