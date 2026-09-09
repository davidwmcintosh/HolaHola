import {
  activateCoordinationInbox,
  backfillCoordinationInbox,
  getCoordinationInboxActivation,
  verifyCoordinationInboxIntegrity,
} from '../services/coordination-inbox-service';

type Command = 'status' | 'backfill' | 'verify' | 'activate';

function usage(): never {
  console.error(
    'Usage: npx tsx server/scripts/coordination-inbox-admin.ts ' +
    '<status|backfill|verify|activate> [--migration-run-id <stable-id>]',
  );
  process.exit(64);
}

function parseArgs(argv: string[]): { command: Command; migrationRunId?: string } {
  const [rawCommand, ...rest] = argv;
  if (!['status', 'backfill', 'verify', 'activate'].includes(rawCommand ?? '')) usage();
  let migrationRunId: string | undefined;
  for (let index = 0; index < rest.length; index += 1) {
    if (rest[index] !== '--migration-run-id' || !rest[index + 1]) usage();
    migrationRunId = rest[index + 1];
    index += 1;
  }
  if (
    (rawCommand === 'backfill' || rawCommand === 'activate')
    && (!migrationRunId || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,254}$/.test(migrationRunId))
  ) {
    throw new Error('backfill and activate require a stable --migration-run-id');
  }
  return { command: rawCommand as Command, migrationRunId };
}

export async function runCoordinationInboxAdmin(argv = process.argv.slice(2)) {
  const { command, migrationRunId } = parseArgs(argv);
  if (command === 'status') {
    return { activation: await getCoordinationInboxActivation() };
  }
  if (command === 'verify') {
    const integrity = await verifyCoordinationInboxIntegrity();
    if (!integrity.ok) process.exitCode = 2;
    return { integrity };
  }
  if (command === 'backfill') {
    return {
      backfill: await backfillCoordinationInbox({
        migrationRunId: migrationRunId!,
      }),
      activation: await getCoordinationInboxActivation(),
    };
  }
  return activateCoordinationInbox(migrationRunId!);
}

if (process.argv[1]?.includes('coordination-inbox-admin')) {
  runCoordinationInboxAdmin()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }, null, 2));
      process.exitCode = 1;
    });
}