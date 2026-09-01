import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildOutageSms,
  buildRecoverySms,
  probeReadiness,
  runMonitor,
  sendTwilioSms,
} from './production-uptime-monitor.mjs';

const readyResponse = () => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify({ status: 'ready' }),
});

const failedResponse = (status = 503, payload = { status: 'starting' }) => ({
  ok: false,
  status,
  text: async () => JSON.stringify(payload),
});

function fakeGithub({ failUpdateCalls = [] } = {}) {
  let issue = null;
  let nextNumber = 41;
  let updateCount = 0;
  const calls = [];
  return {
    calls,
    async ensureLabel() {
      calls.push('ensureLabel');
    },
    async findIncident() {
      calls.push('findIncident');
      return issue;
    },
    async createIncident(body) {
      calls.push('createIncident');
      issue = { number: nextNumber++, title: '[monitor] Production outage', body };
      return issue;
    },
    async updateIncident(number, body) {
      updateCount += 1;
      calls.push(`updateIncident:${number}`);
      assert.equal(issue.number, number);
      if (failUpdateCalls.includes(updateCount)) {
        throw new Error(`injected GitHub update failure ${updateCount}`);
      }
      issue.body = body;
      return issue;
    },
    async closeIncident(number) {
      calls.push(`closeIncident:${number}`);
      assert.equal(issue.number, number);
      issue = null;
    },
    get issue() {
      return issue;
    },
  };
}

function fetchSequence(sequence) {
  let index = 0;
  return async () => sequence[Math.min(index++, sequence.length - 1)];
}

test('probeReadiness accepts only an explicit ready response', async () => {
  const result = await probeReadiness('https://example.test/health/readiness', {
    fetchImpl: async () => readyResponse(),
    attempts: 1,
    timeoutMs: 100,
    retryDelayMs: 0,
  });
  assert.deepEqual(result, { ok: true, status: 200, reason: 'ready', attempts: 1 });
});

test('probeReadiness retries bounded failures and never exposes response bodies', async () => {
  let calls = 0;
  const result = await probeReadiness('https://example.test/health/readiness', {
    fetchImpl: async () => {
      calls += 1;
      return failedResponse(503, { status: 'failed', error: 'private database details' });
    },
    attempts: 3,
    timeoutMs: 100,
    retryDelayMs: 0,
  });
  assert.equal(calls, 3);
  assert.deepEqual(result, { ok: false, status: 503, reason: 'status_failed', attempts: 3 });
  assert.equal(JSON.stringify(result).includes('private database details'), false);
});

test('first failure creates a pending incident without sending SMS', async () => {
  const github = fakeGithub();
  const sms = [];
  const result = await runMonitor({
    attempts: 1,
    timeoutMs: 100,
    retryDelayMs: 0,
    primaryUrl: 'https://primary.test/health/readiness',
    secondaryUrl: 'https://secondary.test/health/readiness',
    fetchImpl: fetchSequence([failedResponse(), readyResponse()]),
    sleepImpl: async () => {},
    now: () => '2026-09-01T20:00:00.000Z',
    github,
    sendSms: async (body) => sms.push(body),
  });
  assert.equal(result.action, 'pending_incident_updated');
  assert.equal(result.failures, 1);
  assert.deepEqual(sms, []);
  assert.equal(github.calls.includes('createIncident'), true);
  assert.equal(github.issue.body.includes('outageSms=none'), true);
  assert.equal(github.issue.body.includes('Diagnostic result: ready'), true);
});

test('second failure sends exactly one outage SMS and later failures do not repeat it', async () => {
  const github = fakeGithub();
  const sms = [];
  const options = {
    attempts: 1,
    timeoutMs: 100,
    retryDelayMs: 0,
    primaryUrl: 'https://primary.test/health/readiness',
    secondaryUrl: 'https://secondary.test/health/readiness',
    fetchImpl: async () => failedResponse(),
    sleepImpl: async () => {},
    now: () => '2026-09-01T20:00:00.000Z',
    github,
    sendSms: async (body) => sms.push(body),
  };

  await runMonitor(options);
  const second = await runMonitor({ ...options, now: () => '2026-09-01T20:05:00.000Z' });
  const third = await runMonitor({ ...options, now: () => '2026-09-01T20:10:00.000Z' });

  assert.equal(second.failures, 2);
  assert.equal(third.action, 'incident_updated');
  assert.equal(sms.length, 1);
  assert.equal(sms[0].includes('HolaHola production appears down.'), true);
  assert.equal(github.issue.body.includes('outageSms=accepted'), true);
});

test('recovery sends one SMS and closes an alerted incident', async () => {
  const github = fakeGithub();
  const sms = [];
  const common = {
    attempts: 1,
    timeoutMs: 100,
    retryDelayMs: 0,
    primaryUrl: 'https://primary.test/health/readiness',
    secondaryUrl: 'https://secondary.test/health/readiness',
    sleepImpl: async () => {},
    github,
    sendSms: async (body) => sms.push(body),
  };
  await runMonitor({
    ...common,
    fetchImpl: async () => failedResponse(),
    now: () => '2026-09-01T20:00:00.000Z',
  });
  await runMonitor({
    ...common,
    fetchImpl: async () => failedResponse(),
    now: () => '2026-09-01T20:05:00.000Z',
  });
  const result = await runMonitor({
    ...common,
    fetchImpl: async () => readyResponse(),
    now: () => '2026-09-01T20:12:00.000Z',
  });

  assert.equal(result.action, 'recovery_sms_sent');
  assert.equal(sms.length, 2);
  assert.equal(sms[1].includes('HolaHola production recovered.'), true);
  assert.equal(github.issue, null);
});

test('a pending incident that recovers before threshold closes silently', async () => {
  const github = fakeGithub();
  const sms = [];
  const common = {
    attempts: 1,
    timeoutMs: 100,
    retryDelayMs: 0,
    primaryUrl: 'https://primary.test/health/readiness',
    secondaryUrl: 'https://secondary.test/health/readiness',
    sleepImpl: async () => {},
    github,
    sendSms: async (body) => sms.push(body),
  };
  await runMonitor({
    ...common,
    fetchImpl: async () => failedResponse(),
    now: () => '2026-09-01T20:00:00.000Z',
  });
  const result = await runMonitor({
    ...common,
    fetchImpl: async () => readyResponse(),
    now: () => '2026-09-01T20:04:00.000Z',
  });
  assert.equal(result.action, 'pending_incident_closed');
  assert.deepEqual(sms, []);
  assert.equal(github.issue, null);
});

test('an outage SMS accepted before a GitHub update failure is never sent twice', async () => {
  const github = fakeGithub({ failUpdateCalls: [3] });
  const sms = [];
  const common = {
    attempts: 1,
    timeoutMs: 100,
    retryDelayMs: 0,
    primaryUrl: 'https://primary.test/health/readiness',
    secondaryUrl: 'https://secondary.test/health/readiness',
    fetchImpl: async () => failedResponse(),
    sleepImpl: async () => {},
    github,
    sendSms: async (body) => sms.push(body),
  };

  await runMonitor({ ...common, now: () => '2026-09-01T20:00:00.000Z' });
  await assert.rejects(
    () => runMonitor({ ...common, now: () => '2026-09-01T20:05:00.000Z' }),
    /injected GitHub update failure 3/,
  );
  assert.equal(github.issue.body.includes('outageSms=reserved'), true);

  await runMonitor({ ...common, now: () => '2026-09-01T20:10:00.000Z' });
  assert.equal(sms.length, 1);
});

test('a recovery SMS accepted before a GitHub update failure is never sent twice', async () => {
  const github = fakeGithub({ failUpdateCalls: [5] });
  const sms = [];
  const common = {
    attempts: 1,
    timeoutMs: 100,
    retryDelayMs: 0,
    primaryUrl: 'https://primary.test/health/readiness',
    secondaryUrl: 'https://secondary.test/health/readiness',
    sleepImpl: async () => {},
    github,
    sendSms: async (body) => sms.push(body),
  };

  await runMonitor({
    ...common,
    fetchImpl: async () => failedResponse(),
    now: () => '2026-09-01T20:00:00.000Z',
  });
  await runMonitor({
    ...common,
    fetchImpl: async () => failedResponse(),
    now: () => '2026-09-01T20:05:00.000Z',
  });
  await assert.rejects(
    () => runMonitor({
      ...common,
      fetchImpl: async () => readyResponse(),
      now: () => '2026-09-01T20:10:00.000Z',
    }),
    /injected GitHub update failure 5/,
  );
  assert.equal(github.issue.body.includes('recoverySms=reserved'), true);

  const result = await runMonitor({
    ...common,
    fetchImpl: async () => readyResponse(),
    now: () => '2026-09-01T20:15:00.000Z',
  });
  assert.equal(result.action, 'delivery_uncertain_incident_closed');
  assert.equal(sms.length, 2);
  assert.equal(github.issue, null);
});

test('a rejected outage SMS is marked failed and is not automatically retried', async () => {
  const github = fakeGithub();
  let smsAttempts = 0;
  const common = {
    attempts: 1,
    timeoutMs: 100,
    retryDelayMs: 0,
    primaryUrl: 'https://primary.test/health/readiness',
    secondaryUrl: 'https://secondary.test/health/readiness',
    fetchImpl: async () => failedResponse(),
    sleepImpl: async () => {},
    github,
    sendSms: async () => {
      smsAttempts += 1;
      throw new Error('Twilio request failed with HTTP 503');
    },
  };

  await runMonitor({ ...common, now: () => '2026-09-01T20:00:00.000Z' });
  await assert.rejects(
    () => runMonitor({ ...common, now: () => '2026-09-01T20:05:00.000Z' }),
    /Twilio request failed with HTTP 503/,
  );
  assert.equal(github.issue.body.includes('outageSms=failed'), true);
  await runMonitor({ ...common, now: () => '2026-09-01T20:10:00.000Z' });
  assert.equal(smsAttempts, 1);
});

test('dry runs probe both URLs but never mutate GitHub or send SMS', async () => {
  let calls = 0;
  const result = await runMonitor({
    dryRun: true,
    attempts: 1,
    timeoutMs: 100,
    retryDelayMs: 0,
    primaryUrl: 'https://primary.test/health/readiness',
    secondaryUrl: 'https://secondary.test/health/readiness',
    fetchImpl: async () => {
      calls += 1;
      return failedResponse();
    },
    sleepImpl: async () => {},
    now: () => '2026-09-01T20:00:00.000Z',
  });
  assert.equal(result.action, 'dry_run');
  assert.equal(calls, 2);
});

test('Twilio rejection reports only the HTTP status', async () => {
  await assert.rejects(
    () => sendTwilioSms({
      accountSid: 'AC123',
      authToken: 'secret-token',
      fromNumber: '+15550000000',
      toNumber: '+15551111111',
      body: buildOutageSms({
        checkedAt: '2026-09-01T20:00:00.000Z',
        primary: { ok: false, status: 503, reason: 'timeout' },
        secondary: { ok: false, status: 503, reason: 'timeout' },
        runUrl: '',
      }),
      fetchImpl: async () => ({
        ok: false,
        status: 401,
        text: async () => 'secret Twilio response',
      }),
    }),
    (error) => error.message === 'Twilio request failed with HTTP 401'
      && !error.message.includes('secret Twilio response'),
  );
});

test('recovery message includes duration only when it is available', () => {
  const message = buildRecoverySms({
    recoveredAt: '2026-09-01T20:12:00.000Z',
    outageDuration: '12 minutes',
    runUrl: 'https://github.com/example/repo/actions/runs/1',
  });
  assert.equal(message.includes('12 minutes'), true);
  assert.equal(message.includes('actions/runs/1'), true);
});
