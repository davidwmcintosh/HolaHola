import { TaskOwnershipService } from '../services/task-ownership-service';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { ensureTaskAgentKey } from '../services/task-ownership-key-custody';
import { TaskOwnershipHttpClient, proveTaskOwnership } from '../services/task-ownership-client';

const MACHINE_PREFIX = 'TASK_OWNERSHIP_RESULT_JSON:';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function usage(): never {
  console.error('Usage: task-ownership-cli.ts <begin|status|prove|diagnostic> --task-ref <ref> [--app-url <url>]');
  process.exit(64);
}

const TOKEN_ENV_BY_ACTOR: Record<string, string> = {
  'luca-replit': 'COORDINATION_LUCA_REPLIT_TOKEN',
  'luca-claude-code': 'COORDINATION_LUCA_CLAUDE_CODE_TOKEN',
  'luca-gemini': 'COORDINATION_LUCA_GEMINI_CODE_TOKEN',
  'luca-holahola': 'COORDINATION_LUCA_HOLAHOLA_TOKEN',
};

function clientFor(appUrl: string, actor: string): TaskOwnershipHttpClient {
  const tokenEnv = TOKEN_ENV_BY_ACTOR[actor];
  let token = tokenEnv ? process.env[tokenEnv] : undefined;
  if (actor === 'luca-gemini') {
    const legacy = process.env.COORDINATION_LUCA_GEMINI_TOKEN;
    const current = process.env.COORDINATION_LUCA_GEMINI_CODE_TOKEN;
    if (legacy && current && legacy !== current) {
      throw new Error('Conflicting luca-gemini coordination token aliases.');
    }
    token = current || legacy;
  }
  if (!token) throw new Error(`A coordination credential is required in ${tokenEnv || 'the actor-specific environment variable'}.`);
  return new TaskOwnershipHttpClient(appUrl, token);
}

async function main(): Promise<void> {
  const command = process.argv[2] || 'diagnostic';
  const taskRef = option('--task-ref') || usage();
  if (command === 'begin') {
    const appUrl = option('--app-url') || process.env.APP_URL;
    if (!appUrl) throw new Error('A server URL is required via --app-url or APP_URL.');
    const actor = option('--actor');
    if (!actor) throw new Error('--actor is required.');
    const root = process.cwd();
    const artifactPath = `${root}/.local/tasks/task-${taskRef}.md`;
    const artifact = await readFile(artifactPath);
    const key = await ensureTaskAgentKey(taskRef);
    const client = clientFor(appUrl, actor);
    const response: any = await client.challenge({
      taskRef,
      intendedActor: actor,
      artifactSha256: createHash('sha256').update(artifact).digest('hex'),
      publicKey: key.publicKey,
      keyFingerprint: key.fingerprint,
      idempotencyKey: `${taskRef}:${key.fingerprint}`,
    });
    if (!response || typeof response.challengeId !== 'string') throw new Error('Malformed challenge response.');
    console.log(JSON.stringify({ challengeId: response.challengeId, taskRef, fingerprint: key.fingerprint }));
    return;
  }
  if (command === 'status') {
    const appUrl = option('--app-url') || process.env.APP_URL;
    const id = option('--challenge-id');
    if (!appUrl || !id) throw new Error('--challenge-id and --app-url (or APP_URL) are required.');
    const actor = option('--actor');
    if (!actor) throw new Error('--actor is required.');
    const response = await clientFor(appUrl, actor).status(id);
    console.log(JSON.stringify(response));
    return;
  }
  if (command === 'prove') {
    const appUrl = option('--app-url') || process.env.APP_URL;
    const actor = option('--actor');
    const receiptId = option('--receipt-id');
    if (!appUrl || !actor || !receiptId) throw new Error('--actor, --receipt-id, and --app-url (or APP_URL) are required.');
    const response: any = await proveTaskOwnership(clientFor(appUrl, actor), taskRef, actor, receiptId);
    const result = await new TaskOwnershipService({
      verifyActiveIsolatedProof: async (ref, artifactSha256) => (
        response?.verified === true
        && response.taskRef === ref
        && response.artifactSha256 === artifactSha256
        && response.intendedActor === actor
      ),
    }).probe(taskRef);
    console.log(JSON.stringify(result, null, 2));
    if (result.state !== 'isolated_agent') process.exitCode = 75;
    return;
  }
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