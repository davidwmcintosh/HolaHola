import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createVerify, generateKeyPairSync } from 'node:crypto';
import {
  encodeGithubAppGitCredential,
  fetchGithubInstallationToken,
  loadGithubAppPrivateKey,
  mintGithubAppJwt,
  normalizeGithubAppPrivateKeyPem,
} from '../services/github-app-auth';

const root = process.cwd();
const coordinator = readFileSync(join(root, 'server/services/source-control-service.ts'), 'utf8');

assert.match(coordinator, /HOLAHOLA_GITHUB_APP_ID/, 'coordinator must require the GitHub App id');
assert.match(coordinator, /HOLAHOLA_GITHUB_APP_INSTALLATION_ID/, 'coordinator must require the GitHub App installation id');
assert.match(coordinator, /HOLAHOLA_GITHUB_APP_PRIVATE_KEY/, 'coordinator must require the GitHub App private key');
assert.match(
  coordinator,
  /GIT_CONFIG_KEY_0: 'http\.extraheader'/,
  'coordinator must inject the bearer credential via git config env vars, never argv or the remote URL',
);
assert.doesNotMatch(
  coordinator,
  /https?:\/\/[^'" \n]*:[^'" \n]*@/,
  'the installation token must never be embedded directly in a remote URL',
);
assert.match(coordinator, /\['fetch', '--no-tags'/, 'coordinator must fetch before source decisions');
assert.match(coordinator, /\['merge', '--ff-only', 'FETCH_HEAD'\]/, 'receive must be fast-forward-only');
assert.match(coordinator, /\['push', this\.repoUrl/, 'push must use the fixed repository target');
assert.doesNotMatch(coordinator, /--force/, 'force push must remain impossible');
assert.doesNotMatch(coordinator, /\['(?:add|commit|reset)'/, 'coordinator must not stage, commit, or reset');

for (const script of ['scripts/sync-to-github.sh', 'scripts/sync-from-github.sh']) {
  const result = spawnSync('bash', [join(root, script)], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 78, `${script} must fail closed`);
  assert.match(`${result.stdout}${result.stderr}`, /coordinator/i);
}

// --- GitHub App auth transport (server/services/github-app-auth.ts) ---
// This replaces the retired SSH deploy-key transport: the coordinator's only
// remote-mutating operation now authenticates as one narrowly scoped GitHub
// App installation whose tokens expire automatically, rather than a
// repo-wide SSH key. These checks prove the module's normalize/mint/fetch
// behavior directly, using a locally generated disposable test keypair —
// never real credentials.

const { publicKey: testPublicKeyPem, privateKey: testPrivateKeyPem } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
});

function verifyJwtSignature(jwt: string): Record<string, unknown> {
  const [headerB64, payloadB64, signatureB64] = jwt.split('.');
  assert.ok(headerB64 && payloadB64 && signatureB64, 'JWT must have header, payload, and signature segments');
  const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
  assert.equal(header.alg, 'RS256', 'JWT must be signed with RS256');
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  assert.ok(
    verifier.verify(testPublicKeyPem, Buffer.from(signatureB64, 'base64url')),
    'JWT signature must verify against the source key\u2019s public half',
  );
  return JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
}

const validSerializations = [
  ['multiline', testPrivateKeyPem],
  ['literal-newline', testPrivateKeyPem.replace(/\n/g, '\\n')],
  ['space-flattened', testPrivateKeyPem.replace(/\n/g, ' ')],
  ['fully-flattened', testPrivateKeyPem.replace(/\n/g, '')],
] as const;

for (const [label, serializedKey] of validSerializations) {
  const normalized = normalizeGithubAppPrivateKeyPem(serializedKey);
  assert.match(normalized, /^-----BEGIN RSA PRIVATE KEY-----\n/, `${label} must normalize to an armored PEM`);
  assert.match(normalized, /\n-----END RSA PRIVATE KEY-----\n$/, `${label} must normalize with a matching footer`);

  const key = loadGithubAppPrivateKey(serializedKey);
  assert.equal(key.asymmetricKeyType, 'rsa', `${label} must parse as an RSA key`);

  const fixedNow = () => new Date('2026-09-17T12:00:00.000Z');
  const jwt = mintGithubAppJwt('123456', key, fixedNow);
  const payload = verifyJwtSignature(jwt);
  assert.equal(payload.iss, '123456', `${label} JWT must carry the numeric app id as issuer`);
  const iat = Number(payload.iat);
  const exp = Number(payload.exp);
  assert.ok(exp > iat, `${label} JWT must expire after it was issued`);
  assert.ok(exp - iat <= 600, `${label} JWT must respect GitHub's 10-minute expiry ceiling`);
  assert.ok(Math.floor(fixedNow().getTime() / 1000) - iat <= 120, `${label} JWT must back-date iat only for small clock-skew tolerance`);
}

assert.throws(() => mintGithubAppJwt('not-numeric', loadGithubAppPrivateKey(testPrivateKeyPem)), /must be numeric/i);

const invalidPrivateKeyInputs: Array<[string, string, RegExp]> = [
  ['empty', '', /does not contain an armored private key/i],
  ['no-armor', 'this is not a key at all', /does not contain an armored private key/i],
  [
    'mismatched-armor',
    '-----BEGIN RSA PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----',
    /header and footer do not match/i,
  ],
  [
    'invalid-base64-body',
    '-----BEGIN RSA PRIVATE KEY-----\nnot@base64!!\n-----END RSA PRIVATE KEY-----',
    /not valid base64 text/i,
  ],
  [
    'unparseable-body',
    '-----BEGIN RSA PRIVATE KEY-----\nQUFBQQ==\n-----END RSA PRIVATE KEY-----',
    /could not be parsed as a private key/i,
  ],
];

for (const [label, input, expectedError] of invalidPrivateKeyInputs) {
  assert.throws(
    () => loadGithubAppPrivateKey(input),
    (error: unknown) => {
      assert.ok(error instanceof Error, `${label} must throw an Error`);
      assert.match(error.message, expectedError, `${label} must report a safe, actionable error`);
      assert.doesNotMatch(error.message, /BEGIN .*PRIVATE KEY/, `${label} must not log key material`);
      assert.doesNotMatch(error.message, new RegExp(testPrivateKeyPem.slice(40, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${label} must not echo real key bytes`);
      return true;
    },
  );
}

// An RSA key that GitHub's App auth explicitly rejects (must be RSA, not EC).
// PKCS8 (not SEC1) so the PEM carries the generic "PRIVATE KEY" armor our
// regex accepts, exercising the asymmetricKeyType check rather than the
// armor-matching check.
const { privateKey: ecPrivateKeyPem } = generateKeyPairSync('ec', {
  namedCurve: 'P-256',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
assert.throws(() => loadGithubAppPrivateKey(ecPrivateKeyPem), /must be an RSA private key/i);

// --- Installation token exchange (fetchGithubInstallationToken) ---

const baseTokenRequest = {
  appId: '123456',
  installationId: '987654',
  privateKey: testPrivateKeyPem,
  now: () => new Date('2026-09-17T12:00:00.000Z'),
};

const successToken = await fetchGithubInstallationToken({
  ...baseTokenRequest,
  fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(String(url), 'https://api.github.com/app/installations/987654/access_tokens');
    assert.equal(init?.method, 'POST');
    const headers = init?.headers as Record<string, string>;
    assert.match(headers.authorization, /^Bearer /, 'installation token request must present the App JWT as a bearer token');
    verifyJwtSignature(headers.authorization.replace(/^Bearer /, ''));
    return {
      ok: true,
      status: 201,
      json: async () => ({ token: 'ghs_faketoken123', expires_at: '2026-09-17T13:00:00Z' }),
    } as Response;
  }) as typeof fetch,
});
assert.equal(successToken.token, 'ghs_faketoken123');
assert.equal(successToken.expiresAt.toISOString(), '2026-09-17T13:00:00.000Z');

const credential = encodeGithubAppGitCredential(successToken.token);
assert.equal(Buffer.from(credential, 'base64').toString('utf8'), 'x-access-token:ghs_faketoken123');

await assert.rejects(() => fetchGithubInstallationToken({
  ...baseTokenRequest,
  fetchImpl: (async () => ({ ok: false, status: 401, text: async () => 'Bad credentials' })) as unknown as typeof fetch,
}), /GitHub installation token request failed \(401\)/);

await assert.rejects(() => fetchGithubInstallationToken({
  ...baseTokenRequest,
  fetchImpl: (async () => ({ ok: true, json: async () => ({ token: 123 }) })) as unknown as typeof fetch,
}), /malformed/i);

await assert.rejects(() => fetchGithubInstallationToken({
  ...baseTokenRequest,
  fetchImpl: (async () => ({ ok: true, json: async () => ({ token: 'ghs_x', expires_at: 'not-a-date' }) })) as unknown as typeof fetch,
}), /invalid expiry/i);

await assert.rejects(() => fetchGithubInstallationToken({
  ...baseTokenRequest,
  installationId: 'not-numeric',
  fetchImpl: (async () => { throw new Error('must not be called'); }) as unknown as typeof fetch,
}), /must be numeric/i);

console.log('GitHub release transport safety checks passed.');
