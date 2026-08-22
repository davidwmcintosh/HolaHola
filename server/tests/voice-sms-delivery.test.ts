/**
 * voice-sms-delivery.test.ts
 *
 * Verifies that the SMS delivery helpers behave correctly when Twilio
 * credentials are absent vs. present — with no DB, TTS, or real network calls.
 *
 * Uses the exported `sendSmsWithCredentials` and `isTwilioConfigured` helpers
 * so we can exercise both paths without module-level mocking (Node 20 compat).
 *
 * Run standalone:
 *   npx tsx --test server/tests/voice-sms-delivery.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  isTwilioConfigured,
  sendSmsWithCredentials,
} from '../services/voice-message-delivery.js';

// ---------------------------------------------------------------------------
// isTwilioConfigured — reflects the module-level env-var snapshot
// ---------------------------------------------------------------------------

describe('isTwilioConfigured', () => {
  it('returns a boolean', () => {
    const result = isTwilioConfigured();
    assert.equal(typeof result, 'boolean');
  });
});

// ---------------------------------------------------------------------------
// sendSmsWithCredentials — absent credentials path
// ---------------------------------------------------------------------------

describe('sendSmsWithCredentials — Twilio absent', () => {
  it('returns false immediately when accountSid is empty', async () => {
    const noFetch: typeof fetch = () => {
      throw new Error('fetch must not be called when credentials are absent');
    };
    const result = await sendSmsWithCredentials(
      { accountSid: '', authToken: 'tok', fromNumber: '+15550000001' },
      '+15559990000',
      'Hello',
      noFetch,
    );
    assert.equal(result, false);
  });

  it('returns false immediately when authToken is empty', async () => {
    const noFetch: typeof fetch = () => {
      throw new Error('fetch must not be called');
    };
    const result = await sendSmsWithCredentials(
      { accountSid: 'ACtest', authToken: '', fromNumber: '+15550000001' },
      '+15559990000',
      'Hello',
      noFetch,
    );
    assert.equal(result, false);
  });

  it('returns false immediately when fromNumber is empty', async () => {
    const noFetch: typeof fetch = () => {
      throw new Error('fetch must not be called');
    };
    const result = await sendSmsWithCredentials(
      { accountSid: 'ACtest', authToken: 'tok', fromNumber: '' },
      '+15559990000',
      'Hello',
      noFetch,
    );
    assert.equal(result, false);
  });

  it('does not hang — resolves synchronously when credentials absent', async () => {
    const noFetch: typeof fetch = () => {
      throw new Error('fetch must not be called');
    };
    // Should resolve with false, not hang
    const result = await Promise.race([
      sendSmsWithCredentials(
        { accountSid: '', authToken: '', fromNumber: '' },
        '+15559990000',
        'Hello',
        noFetch,
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timed out')), 2000),
      ),
    ]);
    assert.equal(result, false);
  });
});

// ---------------------------------------------------------------------------
// sendSmsWithCredentials — Twilio configured path
// ---------------------------------------------------------------------------

describe('sendSmsWithCredentials — Twilio configured', () => {
  const goodCreds = {
    accountSid: 'ACtest123',
    authToken: 'authtoken456',
    fromNumber: '+15550000001',
  };

  it('returns true when Twilio responds 200', async () => {
    let fetchCalled = false;
    const mockFetch: typeof fetch = async (url, _init) => {
      fetchCalled = true;
      assert.ok(String(url).includes('twilio.com'), 'should call Twilio API');
      return {
        ok: true,
        json: async () => ({ sid: 'SMabc123', status: 'queued' }),
        text: async () => '',
      } as Response;
    };

    const result = await sendSmsWithCredentials(
      goodCreds,
      '+15559990000',
      'Test message',
      mockFetch,
    );

    assert.equal(result, true);
    assert.equal(fetchCalled, true);
  });

  it('calls Twilio API with Authorization header', async () => {
    let capturedHeaders: Record<string, string> = {};
    const mockFetch: typeof fetch = async (_url, init) => {
      capturedHeaders = Object.fromEntries(
        Object.entries((init as RequestInit).headers as Record<string, string>),
      );
      return {
        ok: true,
        json: async () => ({ sid: 'SMabc', status: 'queued' }),
        text: async () => '',
      } as Response;
    };

    await sendSmsWithCredentials(goodCreds, '+15559990000', 'Test', mockFetch);

    assert.ok(
      capturedHeaders['Authorization']?.startsWith('Basic '),
      'should send Basic auth header',
    );
  });

  it('throws when Twilio responds with an error status', async () => {
    const mockFetch: typeof fetch = async () =>
      ({
        ok: false,
        status: 401,
        text: async () => 'Authentication Error',
        json: async () => ({}),
      }) as Response;

    await assert.rejects(
      () => sendSmsWithCredentials(goodCreds, '+15559990000', 'Test', mockFetch),
      /Twilio 401/,
    );
  });
});
