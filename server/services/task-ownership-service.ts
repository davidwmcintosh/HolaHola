import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export type TaskOwnershipState = 'main_session' | 'isolated_agent' | 'unknown_stop';
export type CheckoutKind = 'primary_worktree' | 'linked_worktree' | 'not_a_git_worktree' | 'malformed_git_metadata';

export interface TaskOwnershipEvidence {
  taskRef: string;
  taskArtifact: {
    path: string;
    exists: boolean;
    regularFile: boolean;
    sha256?: string;
    size?: number;
  };
  checkout: {
    kind: CheckoutKind;
    gitMetadataPath: string;
  };
  verifiedActiveMainReceipt: boolean;
}

export interface TaskOwnershipResult {
  ok: boolean;
  state: TaskOwnershipState;
  taskRef: string;
  evidence: TaskOwnershipEvidence;
  contradictions: string[];
  explanation: string;
}

export interface TaskOwnershipServiceOptions {
  rootDir?: string;
  verifyActiveMainReceipt?: (taskRef: string) => Promise<boolean>;
}

const TASK_REF = /^[1-9][0-9]*$/;
const MAX_TASK_ARTIFACT_BYTES = 256 * 1024;

export function classifyTaskOwnership(evidence: TaskOwnershipEvidence): TaskOwnershipResult {
  const contradictions: string[] = [];
  const artifactValid = evidence.taskArtifact.exists && evidence.taskArtifact.regularFile;

  if (evidence.taskArtifact.exists && !evidence.taskArtifact.regularFile) {
    contradictions.push('The exact task artifact exists but is not a regular file.');
  }
  if (evidence.verifiedActiveMainReceipt && evidence.checkout.kind !== 'primary_worktree') {
    contradictions.push('Verified main-session evidence conflicts with the current checkout.');
  }

  if (
    contradictions.length === 0
    && artifactValid
    && evidence.verifiedActiveMainReceipt
    && evidence.checkout.kind === 'primary_worktree'
  ) {
    return {
      ok: true,
      state: 'main_session',
      taskRef: evidence.taskRef,
      evidence,
      contradictions,
      explanation: 'A verified active main-session receipt and the exact task artifact agree.',
    };
  }

  if (
    contradictions.length === 0
    && artifactValid
    && !evidence.verifiedActiveMainReceipt
    && evidence.checkout.kind === 'linked_worktree'
  ) {
    return {
      ok: true,
      state: 'isolated_agent',
      taskRef: evidence.taskRef,
      evidence,
      contradictions,
      explanation: 'The exact task artifact is present in a current linked Git worktree.',
    };
  }

  const explanation = evidence.checkout.kind === 'primary_worktree' && artifactValid
    ? 'A historical task artifact in the primary worktree does not prove current ownership.'
    : contradictions[0] || 'Current task ownership cannot be proven from local workspace evidence.';
  return {
    ok: false,
    state: 'unknown_stop',
    taskRef: evidence.taskRef,
    evidence,
    contradictions,
    explanation,
  };
}

export class TaskOwnershipService {
  private readonly rootDir: string;
  private readonly verifyActiveMainReceipt: (taskRef: string) => Promise<boolean>;

  constructor(options: TaskOwnershipServiceOptions = {}) {
    this.rootDir = resolve(options.rootDir || process.cwd());
    this.verifyActiveMainReceipt = options.verifyActiveMainReceipt || (async () => false);
  }

  async probe(taskRef: string): Promise<TaskOwnershipResult> {
    if (!TASK_REF.test(taskRef)) {
      throw new Error('Task ref must be positive decimal digits.');
    }
    const evidence: TaskOwnershipEvidence = {
      taskRef,
      taskArtifact: await this.readTaskArtifact(taskRef),
      checkout: await this.readCheckout(),
      verifiedActiveMainReceipt: await this.verifyActiveMainReceipt(taskRef),
    };
    return classifyTaskOwnership(evidence);
  }

  private async readTaskArtifact(taskRef: string): Promise<TaskOwnershipEvidence['taskArtifact']> {
    const path = join(this.rootDir, '.local', 'tasks', `task-${taskRef}.md`);
    try {
      const info = await lstat(path);
      if (!info.isFile()) return { path, exists: true, regularFile: false };
      if (info.size > MAX_TASK_ARTIFACT_BYTES) {
        return { path, exists: true, regularFile: false, size: info.size };
      }
      const bytes = await readFile(path);
      return {
        path,
        exists: true,
        regularFile: true,
        size: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      };
    } catch (error: any) {
      if (error?.code === 'ENOENT') return { path, exists: false, regularFile: false };
      throw error;
    }
  }

  private async readCheckout(): Promise<TaskOwnershipEvidence['checkout']> {
    const gitMetadataPath = join(this.rootDir, '.git');
    try {
      const info = await lstat(gitMetadataPath);
      if (info.isDirectory()) return { kind: 'primary_worktree', gitMetadataPath };
      if (!info.isFile()) return { kind: 'malformed_git_metadata', gitMetadataPath };
      const content = await readFile(gitMetadataPath, 'utf8');
      return /^gitdir:\s+\S+/m.test(content)
        ? { kind: 'linked_worktree', gitMetadataPath }
        : { kind: 'malformed_git_metadata', gitMetadataPath };
    } catch (error: any) {
      if (error?.code === 'ENOENT') return { kind: 'not_a_git_worktree', gitMetadataPath };
      throw error;
    }
  }
}