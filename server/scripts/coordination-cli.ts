import {
  createCoordinationActorClient,
  type CoordinationClientActor,
  type CoordinationEventInput,
} from '../services/coordination-actor-client';
import type {
  CoordinationEvidenceReference,
  CoordinationActorId,
} from '@shared/schema';

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
    'Configuration: COORDINATION_API_URL, COORDINATION_ACTOR, and that actor’s dedicated COORDINATION_*_TOKEN. ' +
    'There is no shared coordination token. --url overrides the API URL. ' +
    'Mutations require --idempotency-key; event mutations require --id and --expected-sequence. ' +
    'Use --cursor/--limit for list, --after-sequence for show, and --evidence/--data with event mutations.',
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

const OPTIONS_BY_COMMAND: Record<string, ReadonlySet<string>> = {
  list: new Set(['url', 'cursor', 'limit']),
  show: new Set(['url', 'id', 'after-sequence']),
  create: new Set([
    'url', 'title', 'description', 'recipient', 'priority', 'source-reference',
    'idempotency-key',
  ]),
  accept: new Set(['url', 'id', 'expected-sequence', 'idempotency-key', 'content', 'evidence', 'data']),
  progress: new Set(['url', 'id', 'expected-sequence', 'idempotency-key', 'content', 'evidence', 'data']),
  evidence: new Set(['url', 'id', 'expected-sequence', 'idempotency-key', 'content', 'evidence', 'data']),
  block: new Set(['url', 'id', 'expected-sequence', 'idempotency-key', 'content', 'evidence', 'data']),
  complete: new Set(['url', 'id', 'expected-sequence', 'idempotency-key', 'content', 'evidence', 'data']),
  acknowledge: new Set(['url', 'id', 'expected-sequence', 'idempotency-key', 'content', 'evidence', 'data']),
  reopen: new Set(['url', 'id', 'expected-sequence', 'idempotency-key', 'content', 'evidence', 'data']),
  reassign: new Set([
    'url', 'id', 'expected-sequence', 'idempotency-key', 'content', 'recipient',
    'evidence', 'data',
  ]),
  comment: new Set(['url', 'id', 'expected-sequence', 'idempotency-key', 'content', 'evidence', 'data']),
};

export function unsupportedCoordinationCliOptions(
  command: string,
  options: Options,
): string[] {
  const allowed = OPTIONS_BY_COMMAND[command] ?? new Set<string>();
  return Object.keys(options).filter((name) => !allowed.has(name));
}

function required(options: Options, name: string): string {
  const value = options[name];
  if (typeof value !== 'string' || !value) fail(`--${name} is required`);
  return value;
}

function requiredRecipient(options: Options): Exclude<CoordinationActorId, 'coordination-system'> {
  const value = required(options, 'recipient');
  const supportedRecipients: readonly Exclude<CoordinationActorId, 'coordination-system'>[] = [
    'luca-replit', 'luca-claude-code', 'luca-holahola', 'alden', 'daniela', 'david',
  ];
  if (!supportedRecipients.includes(value as Exclude<CoordinationActorId, 'coordination-system'>)) {
    fail(`Unsupported --recipient: ${value}`);
  }
  return value as Exclude<CoordinationActorId, 'coordination-system'>;
}

function optionalPriority(
  options: Options,
): 'low' | 'normal' | 'high' | 'urgent' | undefined {
  const value = options.priority;
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !['low', 'normal', 'high', 'urgent'].includes(value)) {
    fail('--priority must be low, normal, high, or urgent');
  }
  return value as 'low' | 'normal' | 'high' | 'urgent';
}

function optionalNonNegativeInteger(options: Options, name: string): number | undefined {
  const value = options[name];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') fail(`--${name} requires a non-negative integer`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    fail(`--${name} requires a non-negative integer`);
  }
  return number;
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

async function main(): Promise<void> {
  const { command, options } = parseArgs(process.argv.slice(2));
  const unsupported = unsupportedCoordinationCliOptions(command, options);
  if (unsupported.length > 0) {
    fail(`Unsupported option${unsupported.length === 1 ? '' : 's'} for ${command}: ${unsupported.map((name) => `--${name}`).join(', ')}`);
  }
  const apiUrl = typeof options.url === 'string' ? options.url : process.env.COORDINATION_API_URL;
  const actorValue = process.env.COORDINATION_ACTOR;
  const supportedActors: readonly CoordinationClientActor[] = [
    'luca-replit', 'luca-claude-code', 'luca-holahola', 'alden', 'daniela', 'david',
  ];
  if (!apiUrl) fail('COORDINATION_API_URL is required (or provide --url)');
  if (!actorValue) fail('COORDINATION_ACTOR is required; set it to the identity running this client');
  if (!supportedActors.includes(actorValue as CoordinationClientActor)) {
    fail(`Unsupported COORDINATION_ACTOR: ${actorValue}`);
  }
  const actor = actorValue as CoordinationClientActor;

  const client = createCoordinationActorClient(actor, { apiUrl });
  let result: unknown;

  if (command === 'show') {
    result = await client.show(
      required(options, 'id'),
      optionalNonNegativeInteger(options, 'after-sequence') ?? 0,
    );
  } else if (command === 'list') {
    const cursor = optionalNonNegativeInteger(options, 'cursor');
    const limit = optionalNonNegativeInteger(options, 'limit');
    result = await client.listFeed({
      ...(cursor !== undefined ? { cursor } : {}),
      ...(limit !== undefined ? { limit } : {}),
    });
  } else if (command === 'create') {
    result = await client.create({
      title: required(options, 'title'),
      description: required(options, 'description'),
      intendedRecipient: requiredRecipient(options),
      ...(optionalPriority(options) ? { priority: optionalPriority(options) } : {}),
      ...(optionalJson(options, 'source-reference') !== undefined
        ? { sourceReference: optionalJson(options, 'source-reference') as CoordinationEvidenceReference }
        : {}),
      idempotencyKey: required(options, 'idempotency-key'),
    });
  } else if (eventCommands.has(command)) {
    const id = required(options, 'id');
    const expectedSequence = Number(required(options, 'expected-sequence'));
    if (!Number.isSafeInteger(expectedSequence) || expectedSequence < 0) fail('--expected-sequence must be a non-negative integer');
    const input: CoordinationEventInput = {
      content: typeof options.content === 'string' ? options.content : '',
      expectedSequence,
      idempotencyKey: required(options, 'idempotency-key'),
      ...(typeof options.recipient === 'string' ? { recipientActor: requiredRecipient(options) } : {}),
      ...(optionalJson(options, 'evidence') !== undefined
        ? { evidence: optionalJson(options, 'evidence') as CoordinationEvidenceReference[] }
        : {}),
      ...(optionalJson(options, 'data') !== undefined
        ? { payload: optionalJson(options, 'data') as Record<string, unknown> }
        : {}),
    };
    const method = client[command as keyof typeof client];
    if (typeof method !== 'function') fail(`Unsupported client action: ${command}`);
    result = await (method as (threadId: string, input: CoordinationEventInput) => Promise<unknown>).call(
      client,
      id,
      input,
    );
  }

  print(result);
}

if (process.argv[1]?.includes('coordination-cli')) {
  main().catch((error: unknown) => {
    print({ error: error instanceof Error ? error.message : String(error) }, process.stderr);
    process.exitCode = 1;
  });
}