import { buildTaskAgentEnvironmentDiagnostic } from '../services/task-agent-environment-diagnostic';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const taskRef = option('--task-ref');
  if (!taskRef) {
    console.error('Usage: task-agent-environment-diagnostic.ts --task-ref <positive-decimal-ref>');
    process.exit(64);
  }

  const report = await buildTaskAgentEnvironmentDiagnostic({
    taskRef,
    rootDir: process.cwd(),
  });
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
