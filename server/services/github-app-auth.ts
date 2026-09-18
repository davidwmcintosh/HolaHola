import { createPrivateKey, createSign, type KeyObject } from 'node:crypto';

/**
 * Mints short-lived GitHub App installation tokens for the source-control
 * coordinator. This replaces a long-lived SSH deploy key: the coordinator's
 * only remote-mutating operation (a fast-forward push in
 * source-control-service.ts) now authenticates as one specific, narrowly
 * scoped GitHub App installation whose tokens expire automatically (GitHub
 * caps installation tokens at one hour), rather than a repo-wide deploy key
 * that GitHub can only bypass branch protection for as an entire category.
 */

// GitHub rejects a JWT `exp` more than 10 minutes past `iat`. Stay well under
// that ceiling and back-date `iat` slightly to tolerate small clock drift.
const JWT_CLOCK_SKEW_SECONDS = 60;
const JWT_TTL_SECONDS = 540;

export interface GithubInstallationToken {
  token: string;
  expiresAt: Date;
}

function base64url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Reconstructs a standard armored PEM from the shapes Replit Secrets may
 * produce for a pasted GitHub App private key: real newlines, literal `\n`
 * escapes, or the header/body/footer flattened onto one line.
 */
export function normalizeGithubAppPrivateKeyPem(value: string): string {
  const withRealNewlines = value.replaceAll('\r', '').replaceAll('\\n', '\n').replaceAll('\\r', '').trim();
  const match = withRealNewlines.match(
    /(-----BEGIN (?:RSA )?PRIVATE KEY-----)\s*([\s\S]*?)\s*(-----END (?:RSA )?PRIVATE KEY-----)/,
  );
  if (!match) {
    throw new Error('HOLAHOLA_GITHUB_APP_PRIVATE_KEY does not contain an armored private key.');
  }
  const [, header, rawBody, footer] = match;
  const expectedFooter = header.replace('BEGIN', 'END');
  if (footer !== expectedFooter) {
    throw new Error('HOLAHOLA_GITHUB_APP_PRIVATE_KEY header and footer do not match.');
  }
  const body = rawBody.replace(/\s+/g, '');
  if (!body || !/^[A-Za-z0-9+/=]+$/.test(body)) {
    throw new Error('HOLAHOLA_GITHUB_APP_PRIVATE_KEY body is not valid base64 text.');
  }
  const wrapped = body.match(/.{1,64}/g)?.join('\n') ?? body;
  return `${header}\n${wrapped}\n${footer}\n`;
}

export function loadGithubAppPrivateKey(value: string): KeyObject {
  const pem = normalizeGithubAppPrivateKeyPem(value);
  let key: KeyObject;
  try {
    key = createPrivateKey(pem);
  } catch {
    throw new Error('HOLAHOLA_GITHUB_APP_PRIVATE_KEY could not be parsed as a private key.');
  }
  if (key.asymmetricKeyType !== 'rsa') {
    throw new Error('HOLAHOLA_GITHUB_APP_PRIVATE_KEY must be an RSA private key.');
  }
  return key;
}

export function mintGithubAppJwt(appId: string, key: KeyObject, now: () => Date = () => new Date()): string {
  if (!/^[0-9]+$/.test(appId)) {
    throw new Error('HOLAHOLA_GITHUB_APP_ID must be numeric.');
  }
  const nowSeconds = Math.floor(now().getTime() / 1000);
  const header = base64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const payload = base64url(Buffer.from(JSON.stringify({
    iat: nowSeconds - JWT_CLOCK_SKEW_SECONDS,
    exp: nowSeconds + JWT_TTL_SECONDS,
    iss: appId,
  })));
  const signingInput = `${header}.${payload}`;
  const signature = createSign('RSA-SHA256').update(signingInput).end().sign(key);
  return `${signingInput}.${base64url(signature)}`;
}

export async function fetchGithubInstallationToken(input: {
  appId: string;
  installationId: string;
  privateKey: string;
  now?: () => Date;
  fetchImpl?: typeof fetch;
}): Promise<GithubInstallationToken> {
  if (!/^[0-9]+$/.test(input.installationId)) {
    throw new Error('HOLAHOLA_GITHUB_APP_INSTALLATION_ID must be numeric.');
  }
  const now = input.now ?? (() => new Date());
  const fetchImpl = input.fetchImpl ?? fetch;
  const key = loadGithubAppPrivateKey(input.privateKey);
  const jwt = mintGithubAppJwt(input.appId, key, now);
  const response = await fetchImpl(`https://api.github.com/app/installations/${input.installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${jwt}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
    },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`GitHub installation token request failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  const body = await response.json() as { token?: unknown; expires_at?: unknown };
  if (typeof body.token !== 'string' || !body.token || typeof body.expires_at !== 'string') {
    throw new Error('GitHub installation token response was malformed.');
  }
  const expiresAt = new Date(body.expires_at);
  if (Number.isNaN(expiresAt.getTime())) {
    throw new Error('GitHub installation token response had an invalid expiry.');
  }
  return { token: body.token, expiresAt };
}

/** HTTP Basic credential for `http.extraheader`, e.g. `AUTHORIZATION: basic <this>`. */
export function encodeGithubAppGitCredential(token: string): string {
  return Buffer.from(`x-access-token:${token}`, 'utf8').toString('base64');
}
