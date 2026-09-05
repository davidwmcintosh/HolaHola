import { TaskOwnershipService } from '../services/task-ownership-service';

const MACHINE_PREFIX = 'TASK_OWNERSHIP_RESULT_JSON:';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function usage(): never {
  console.error('Usage: task-ownership-cli.ts --task-ref <positive-decimal-ref> [--machine-readable]');
  process.exit(64);
}

async function main(): Promise<void> {
  const taskRef = option('--task-ref') || usage();
  const result = await new TaskOwnershipService().probe(taskRef);
  console.log(process.argv.includes('--machine-readable')
    ? `${MACHINE_PREFIX}${JSON.stringify(result)}`
    : JSON.stringify(result, null, 2));
  if (result.state === 'unknown_stop') process.exitCode = 75;
}

main().catch((error) => {
  if (error instanceof Error && error.message === 'Task ref must be positive decimal digits.') {
    console.error(error.message);
    process.exit(64);
  }
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});