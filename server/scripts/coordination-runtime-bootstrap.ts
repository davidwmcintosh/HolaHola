import {
  COORDINATION_ACTOR_IDS,
  COORDINATION_CREDENTIAL_CAPABILITIES,
  type CoordinationActorId,
  type CoordinationCredentialCapability,
} from '@shared/schema';
import { closeDbConnections } from '../db';
import { registerCoordinationRuntime } from '../services/coordination-credential-broker';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const runtimeId = option('runtime-id');
  const actor = option('actor') as CoordinationActorId | undefined;
  const displayName = option('display-name');
  const capabilities = (option('capabilities') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean) as CoordinationCredentialCapability[];
  const ttl = Number(option('ttl-seconds') ?? '900');

  if (!runtimeId || !actor || !displayName || capabilities.length === 0) {
    throw new Error(
      'Usage: --runtime-id <stable-id> --actor <actor> --display-name <name> --capabilities <comma-list> [--ttl-seconds 900]',
    );
  }
  if (!COORDINATION_ACTOR_IDS.includes(actor) || actor === 'coordination-system') {
    throw new Error(`actor must be one of ${COORDINATION_ACTOR_IDS.filter((value) => value !== 'coordination-system').join(', ')}`);
  }
  for (const capability of capabilities) {
    if (!COORDINATION_CREDENTIAL_CAPABILITIES.includes(capability)) {
      throw new Error(`unsupported capability: ${capability}`);
    }
  }

  const result = await registerCoordinationRuntime({
    runtimeId,
    actor,
    displayName,
    capabilities,
    tokenTtlSeconds: ttl,
  });
  process.stdout.write([
    `Runtime ${runtimeId} registered as ${actor}.`,
    'Store this bootstrap token immediately in only that runtime’s 1Password vault item.',
    'It is shown once and cannot be recovered from the database:',
    result.bootstrapToken,
    '',
  ].join('\n'));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closeDbConnections);