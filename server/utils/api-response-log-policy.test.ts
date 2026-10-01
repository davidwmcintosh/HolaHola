import assert from 'node:assert/strict';
import test from 'node:test';
import { apiResponseBodyForLogging } from './api-response-log-policy';

test('credential and onboarding bodies are omitted before JSON serialization even on short paths', () => {
  let serializations = 0;
  const sensitiveBody = {
    accessToken: 'fixture-credential',
    toJSON() {
      serializations += 1;
      throw new Error('sensitive body must never be serialized for logging');
    },
  };
  for (const path of [
    '/api/coordination/credentials/renew',
    '/api/coordination/credentials/exchange',
    '/api/coordination/onboarding/requests/a/prove',
    '/api/coordination/onboarding/admin',
    '/api/coordination/runtimes',
    '/API/COORDINATION/CREDENTIALS/renew',
    '/api/coordination/%63redentials/renew',
    '/api/coordination/x/../credentials/renew',
    '/api/coordination/x/%2e%2e/CREDENTIALS/renew',
    '/api/coordination/%2563redentials/renew',
    '/api/coordination/x%252f..%252fcredentials/renew',
    '\\api\\coordination\\credentials\\renew',
  ]) {
    const captured = apiResponseBodyForLogging(path, sensitiveBody);
    const line = captured ? JSON.stringify(captured) : `POST ${path} 200`;
    assert.equal(captured, undefined);
    assert.ok(!line.includes('fixture-credential'));
  }
  assert.equal(serializations, 0);
});

test('ordinary API bodies still log and malformed encoded paths fail closed', () => {
  const body = { ok: true };
  assert.equal(apiResponseBodyForLogging('/api/health', body), body);
  assert.equal(apiResponseBodyForLogging('/api/coordination/threads', body), body);
  assert.equal(apiResponseBodyForLogging('/api/coordination/credentials-unrelated', body), body);
  assert.equal(apiResponseBodyForLogging('/api/%ZZ', body), undefined);
});