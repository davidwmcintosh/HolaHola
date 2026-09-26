import { readFile } from 'node:fs/promises';
import { isDirectCliInvocation } from './lib/cli-entrypoint';

const TOKEN_ENV = 'COORDINATION_DAVID_TOKEN';

const COMMANDS = [
  'create-draft', 'approve', 'reject', 'revoke-version',
  'issue-grant', 'revoke-grant', 'show-version', 'list-versions',
] as const;
type Command = typeof COMMANDS[number];

function isCommand(value: string | undefined): value is Command {
  return !!value && (COMMANDS as readonly string[]).includes(value);
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function fail(message: string): never {
  console.error(JSON.stringify({ error: message }));
  process.exit(64);
}

function required(name: string): string {
  const value = option(name);
  if (!value) fail(`--${name} is required`);
  return value as string;
}

function usage(): never {
  fail(
    `Usage: coordination-policy-cli.ts <${COMMANDS.join('|')}> [options]. ` +
    `Requires ${TOKEN_ENV} and --app-url (or APP_URL). ` +
    'create-draft: --policy-key --display-name [--description] (--policy <json> | --policy-file <path>). ' +
    'approve / reject / revoke-version: --version-id --request-key [--reason]. ' +
    'issue-grant: --policy-identity-id --operator-actor --actions <a,b,c> (--expires-at <iso> | --expires-in-minutes <n>) --request-key [--min-version] [--max-version]. ' +
    'revoke-grant: --grant-id --request-key [--reason]. ' +
    'show-version: --version-id. list-versions: --policy-identity-id.',
  );
}

function resolvedAppUrl(): string {
  const url = option('app-url') || process.env.APP_URL;
  if (!url) fail('--app-url or APP_URL is required');
  return url as string;
}

function resolvedToken(): string {
  const value = process.env[TOKEN_ENV];
  if (!value) fail(`${TOKEN_ENV} is required (the founder coordination credential)`);
  return value as string;
}

async function call(method: 'GET' | 'POST', path: string, body?: unknown): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${resolvedAppUrl()}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-coordination-token': resolvedToken(),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let parsed: unknown = {};
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }
  }
  return { status: response.status, body: parsed };
}

async function loadPolicy(): Promise<unknown> {
  const inline = option('policy');
  if (inline) {
    try {
      return JSON.parse(inline);
    } catch {
      fail('--policy must be valid JSON');
    }
  }
  const file = required('policy-file');
  const contents = await readFile(file, 'utf8');
  try {
    return JSON.parse(contents);
  } catch {
    fail(`${file} does not contain valid JSON`);
  }
}

function expiresAtIso(): string {
  const explicit = option('expires-at');
  if (explicit) return explicit;
  const minutes = option('expires-in-minutes');
  if (minutes) {
    const parsed = Number(minutes);
    if (!Number.isFinite(parsed) || parsed <= 0) fail('--expires-in-minutes must be a positive number');
    return new Date(Date.now() + parsed * 60_000).toISOString();
  }
  fail('--expires-at or --expires-in-minutes is required');
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (!isCommand(command)) usage();

  let result: { status: number; body: unknown };
  if (command === 'create-draft') {
    result = await call('POST', '/api/coordination/v2/policies', {
      policyKey: required('policy-key'),
      displayName: required('display-name'),
      ...(option('description') ? { description: option('description') } : {}),
      policy: await loadPolicy(),
    });
  } else if (command === 'approve' || command === 'reject' || command === 'revoke-version') {
    const action = command === 'revoke-version' ? 'revoke' : command;
    result = await call('POST', `/api/coordination/v2/policy-versions/${required('version-id')}/${action}`, {
      requestKey: required('request-key'),
      ...(option('reason') ? { reason: option('reason') } : {}),
    });
  } else if (command === 'issue-grant') {
    const actions = required('actions').split(',').map((value) => value.trim()).filter(Boolean);
    result = await call('POST', '/api/coordination/v2/operator-grants', {
      policyIdentityId: required('policy-identity-id'),
      operatorActor: required('operator-actor'),
      actions,
      expiresAt: expiresAtIso(),
      requestKey: required('request-key'),
      ...(option('min-version') ? { minVersion: Number(option('min-version')) } : {}),
      ...(option('max-version') ? { maxVersion: Number(option('max-version')) } : {}),
    });
  } else if (command === 'revoke-grant') {
    result = await call('POST', `/api/coordination/v2/operator-grants/${required('grant-id')}/revoke`, {
      requestKey: required('request-key'),
      ...(option('reason') ? { reason: option('reason') } : {}),
    });
  } else if (command === 'show-version') {
    result = await call('GET', `/api/coordination/v2/policy-versions/${required('version-id')}`);
  } else {
    result = await call('GET', `/api/coordination/v2/policies/${required('policy-identity-id')}/versions`);
  }

  console.log(JSON.stringify(result.body, null, 2));
  if (result.status >= 400) process.exitCode = 1;
}

if (isDirectCliInvocation('coordination-policy-cli.ts')) {
  main().catch((error: unknown) => {
    console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  });
}
