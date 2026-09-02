type Options = Record<string, string | boolean>;

const commands = new Set([
  'create', 'list', 'show', 'accept', 'progress', 'evidence', 'block',
  'complete', 'acknowledge', 'reopen', 'reassign', 'comment',
]);
const eventCommands = new Set([
  'accept', 'progress', 'evidence', 'block', 'complete', 'acknowledge',
  'reopen', 'reassign', 'comment',
]);

function print(value: unknown, stream: NodeJS.WriteStream = process.stdout): void {
  stream.write(`${JSON.stringify(value, null, 2)}\n`);
}

function fail(message: string, exitCode = 64): never {
  print({ error: message, usage: 'coordination-cli <command> [options]' }, process.stderr);
  process.exit(exitCode);
}

function usage(): never {
  return fail(
    'Commands: create, list, show, accept, progress, evidence, block, complete, acknowledge, reopen, reassign, comment. ' +
    'Configuration: COORDINATION_API_URL and COORDINATION_API_TOKEN. --url overrides the API URL. ' +
    'Mutations require --idempotency-key; event mutations require --id and --expected-sequence. ' +
    'Common options: --content, --title, --description, --recipient, --owner, --priority, --data <JSON>.',
  );
}

function parseArgs(args: string[]): { command: string; options: Options } {
  const command = args.shift();
  if (!command || !commands.has(command)) usage();
  const options: Options = {};
  while (args.length) {
    const token = args.shift()!;
    if (!token.startsWith('--')) fail(`Unexpected argument: ${token}`);
    const name = token.slice(2);
    if (!name) usage();
    const value = args[0] && !args[0].startsWith('--') ? args.shift()! : true;
    if (options[name] !== undefined) fail(`Option --${name} was provided more than once`);
    options[name] = value;
  }
  return { command, options };
}

function required(options: Options, name: string): string {
  const value = options[name];
  if (typeof value !== 'string' || !value) fail(`--${name} is required`);
  return value;
}

function optionalJson(options: Options, name: string): unknown {
  const value = options[name];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') fail(`--${name} requires JSON`);
  try {
    return JSON.parse(value);
  } catch {
    fail(`--${name} must be valid JSON`);
  }
}

function eventType(command: string): string {
  return ({
    accept: 'accepted', progress: 'progress', evidence: 'evidence_added',
    block: 'blocked', complete: 'completed', acknowledge: 'outcome_acknowledged',
    reopen: 'reopened', reassign: 'reassigned', comment: 'comment',
  } as Record<string, string>)[command];
}

async function main(): Promise<void> {
  const { command, options } = parseArgs(process.argv.slice(2));
  const apiUrl = typeof options.url === 'string' ? options.url : process.env.COORDINATION_API_URL;
  const token = process.env.COORDINATION_API_TOKEN;
  if (!apiUrl) fail('COORDINATION_API_URL is required (or provide --url)');
  if (!token) fail('COORDINATION_API_TOKEN is required');

  const baseUrl = apiUrl.replace(/\/+$/, '');
  let method = 'GET';
  let path = '/api/coordination/threads';
  let body: Record<string, unknown> | undefined;
  let idempotencyKey: string | undefined;

  if (command === 'show') {
    path += `/${encodeURIComponent(required(options, 'id'))}`;
  } else if (command === 'list') {
    const query = new URLSearchParams();
    for (const key of ['state', 'owner', 'recipient', 'origin', 'limit', 'cursor']) {
      if (typeof options[key] === 'string') query.set(key, options[key] as string);
    }
    if (query.size) path += `?${query}`;
  } else if (command === 'create') {
    method = 'POST';
    idempotencyKey = required(options, 'idempotency-key');
    body = {
      title: required(options, 'title'),
      description: required(options, 'description'),
      intendedRecipient: required(options, 'recipient'),
      ...(typeof options.owner === 'string' ? { currentOwner: options.owner } : {}),
      ...(typeof options.priority === 'string' ? { priority: options.priority } : {}),
      ...(optionalJson(options, 'source-reference') !== undefined ? { sourceReference: optionalJson(options, 'source-reference') } : {}),
      ...(optionalJson(options, 'data') !== undefined ? { payload: optionalJson(options, 'data') } : {}),
    };
  } else if (eventCommands.has(command)) {
    method = 'POST';
    const id = required(options, 'id');
    idempotencyKey = required(options, 'idempotency-key');
    const expectedSequence = Number(required(options, 'expected-sequence'));
    if (!Number.isSafeInteger(expectedSequence) || expectedSequence < 0) fail('--expected-sequence must be a non-negative integer');
    // Lifecycle endpoints make the normal state-machine operations explicit;
    // comments remain append-only generic events.
    path = command === 'comment'
      ? `/api/coordination/threads/${encodeURIComponent(id)}/events`
      : `/api/coordination/threads/${encodeURIComponent(id)}/${command}`;
    body = {
      eventType: eventType(command),
      content: typeof options.content === 'string' ? options.content : '',
      expectedSequence,
      ...(typeof options.recipient === 'string' ? { recipientActor: options.recipient } : {}),
      ...(typeof options.owner === 'string' ? { currentOwner: options.owner } : {}),
      ...(optionalJson(options, 'evidence') !== undefined ? { evidence: optionalJson(options, 'evidence') } : {}),
      ...(optionalJson(options, 'data') !== undefined ? { payload: optionalJson(options, 'data') } : {}),
    };
  }

  const response = await fetch(new URL(path, `${baseUrl}/`), {
    method,
    headers: {
      'accept': 'application/json',
      'x-coordination-token': token,
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let result: unknown = text;
  try { result = text ? JSON.parse(text) : {}; } catch { /* Preserve non-JSON gateway responses safely. */ }
  print({ status: response.status, ok: response.ok, result });
  if (!response.ok) process.exitCode = 1;
}

main().catch((error: unknown) => {
  print({ error: error instanceof Error ? error.message : String(error) }, process.stderr);
  process.exitCode = 1;
});