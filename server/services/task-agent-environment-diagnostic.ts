import { createHash } from 'node:crypto';
import { relative, sep } from 'node:path';
import {
  TaskOwnershipService,
  type TaskOwnershipResult,
} from './task-ownership-service';

const RELEVANT_ENV_NAME = /(?:^|_)(?:REPL|REPLIT|TASK|AGENT|WORKSPACE|PROJECT|DEPLOY)(?:_|$)/i;
const IDENTITY_ENV_NAMES = [
  'REPL_ID',
  'REPLIT_ENVIRONMENT',
  'REPL_IN_MICROVM',
  'REPLIT_CONTAINER',
  'REPLIT_CLUSTER',
  'REPLIT_SESSION',
] as const;

export interface TaskAgentEnvironmentDiagnostic {
  schemaVersion: 1;
  taskRef: string;
  ownership: TaskOwnershipResult;
  relevantEnvironmentVariableNames: string[];
  identityDigests: Partial<Record<(typeof IDENTITY_ENV_NAMES)[number], string>>;
}

function digest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function workspaceRelative(rootDir: string, path: string): string {
  const normalized = relative(rootDir, path).split(sep).join('/');
  return normalized || '.';
}

function normalizeOwnershipPaths(rootDir: string, result: TaskOwnershipResult): TaskOwnershipResult {
  return {
    ...result,
    evidence: {
      ...result.evidence,
      taskArtifact: {
        ...result.evidence.taskArtifact,
        path: workspaceRelative(rootDir, result.evidence.taskArtifact.path),
      },
      checkout: {
        ...result.evidence.checkout,
        gitMetadataPath: workspaceRelative(rootDir, result.evidence.checkout.gitMetadataPath),
      },
    },
  };
}

export async function buildTaskAgentEnvironmentDiagnostic(options: {
  taskRef: string;
  rootDir: string;
  env?: NodeJS.ProcessEnv;
}): Promise<TaskAgentEnvironmentDiagnostic> {
  const env = options.env ?? process.env;
  const ownership = await new TaskOwnershipService({ rootDir: options.rootDir }).probe(options.taskRef);
  const relevantEnvironmentVariableNames = Object.keys(env)
    .filter((name) => RELEVANT_ENV_NAME.test(name))
    .sort();
  const identityDigests: TaskAgentEnvironmentDiagnostic['identityDigests'] = {};

  for (const name of IDENTITY_ENV_NAMES) {
    const value = env[name];
    if (typeof value === 'string' && value.length > 0) {
      identityDigests[name] = digest(value);
    }
  }

  return {
    schemaVersion: 1,
    taskRef: options.taskRef,
    ownership: normalizeOwnershipPaths(options.rootDir, ownership),
    relevantEnvironmentVariableNames,
    identityDigests,
  };
}
