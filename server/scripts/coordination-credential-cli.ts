import { isDirectCliInvocation } from './lib/cli-entrypoint';

// Only alden and david hold coordination:runtime:admin (see
// COORDINATION_LEGACY_CAPABILITIES_BY_ACTOR in
// server/middleware/coordination-auth.ts). This CLI is not imported from
// that module to keep it free of the broker's database dependency chain --
// see the type-only import note at the top of coordination-auth.ts.
const TOKEN_ENV_BY_ACTOR = {
  alden: 'COORDINATION_ALDEN_TOKEN',
  david: 'COORDINATION_DAVID_TOKEN',
} as const;
type AdminActor = keyof typeof TOKEN_ENV_BY_ACTOR;

const COMMANDS = ['register-runtime', 'revoke-runtime', 'list-runtimes'] as const;
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
    `Usage: coordination-credential-cli.ts <${COMMANDS.join('|')}> [options]. `
    + 'Requires --app-url (or APP_URL) and authenticates as --as-actor alden|david '
    + '(default alden) using that actor\'s COORDINATION_ALDEN_TOKEN or '
    + 'COORDINATION_DAVID_TOKEN -- the only two coordination actors holding '
    + 'coordination:runtime:admin. '
    + 'register-runtime: --runtime-id --actor --display-name [--capabilities a,b,c] '
    + '[--ttl-seconds 900] [--provider <name>] [--model <name>]. When --actor starts '
    + 'with "luca-" and --capabilities is omitted, it defaults to the standard '
    + 'Luca-hat capability set every existing Luca hat already holds -- onboarding a '
    + 'new Luca-hat LLM is a peer addition on the one HolaHola project, not a new '
    + 'policy to author. '
    + 'revoke-runtime: --runtime-id. '
    + 'list-runtimes: (no options; non-secret operational listing).',
  );
}

function resolvedAppUrl(): string {
  const url = option('app-url') || process.env.APP_URL;
  if (!url) fail('--app-url or APP_URL is required');
  return url as string;
}

function resolvedActor(): AdminActor {
  const actor = option('as-actor') ?? 'alden';
  if (actor !== 'alden' && actor !== 'david') fail('--as-actor must be alden or david');
  return actor;
}

function resolvedToken(): string {
  const actor = resolvedActor();
  const envName = TOKEN_ENV_BY_ACTOR[actor];
  const value = process.env[envName];
  if (!value) fail(`${envName} is required (the ${actor} coordination:runtime:admin credential)`);
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

async function main(): Promise<void> {
  const command = process.argv[2];
  if (!isCommand(command)) usage();

  let result: { status: number; body: unknown };
  if (command === 'register-runtime') {
    const capabilitiesOption = option('capabilities');
    result = await call('POST', '/api/coordination/credentials/register-runtime', {
      runtimeId: required('runtime-id'),
      actor: required('actor'),
      displayName: required('display-name'),
      ...(capabilitiesOption
        ? { capabilities: capabilitiesOption.split(',').map((value) => value.trim()).filter(Boolean) }
        : {}),
      ...(option('ttl-seconds') ? { tokenTtlSeconds: Number(option('ttl-seconds')) } : {}),
      ...(option('provider') ? { provider: option('provider') } : {}),
      ...(option('model') ? { model: option('model') } : {}),
    });
  } else if (command === 'revoke-runtime') {
    result = await call('POST', '/api/coordination/credentials/admin-revoke-runtime', {
      runtimeId: required('runtime-id'),
    });
  } else {
    result = await call('GET', '/api/coordination/credentials/runtimes');
  }

  console.log(JSON.stringify(result.body, null, 2));
  if (result.status >= 400) process.exitCode = 1;
}

if (isDirectCliInvocation('coordination-credential-cli.ts')) {
  main().catch((error: unknown) => {
    console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  });
}
