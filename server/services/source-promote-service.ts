import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Thin proxy over a GitHub Actions workflow_dispatch — the actual validation
// and push run in an isolated Actions runner, never on this process. See
// docs/superpowers/specs/2026-08-26-unified-source-promote-endpoint-design.md
// and .github/workflows/source-promote.yml.

const OWNER = 'davidwmcintosh';
const REPO = 'HolaHola';
const WORKFLOW_FILE = 'source-promote.yml';
const GITHUB_API = 'https://api.github.com';
const STATUS_DIR = path.resolve('.local/source-promote-status');

export type PromotionState = 'pending' | 'queued' | 'in_progress' | 'synced' | 'failed';

export interface PromotionJob {
  jobId: string;
  source: string;
  branch: string;
  createdAt: string;
  runId?: number;
  runUrl?: string;
  state: PromotionState;
  detail?: string;
}

// Matches a git branch/ref name closely enough to reject anything that could
// be interpreted as a flag or path traversal when it reaches git/gh — the
// actual git ref grammar is more permissive than this, but nothing legitimate
// needs more than this.
export function isValidBranchName(branch: string): boolean {
  return (
    typeof branch === 'string' &&
    branch.length > 0 &&
    branch.length <= 200 &&
    /^[A-Za-z0-9._/-]+$/.test(branch) &&
    !branch.startsWith('-') &&
    !branch.includes('..')
  );
}

export function isValidSource(source: unknown): source is string {
  return typeof source === 'string' && /^[a-z0-9-]{1,40}$/.test(source);
}

function statusFilePath(jobId: string): string {
  return path.join(STATUS_DIR, `${jobId}.json`);
}

function readJob(jobId: string): PromotionJob | undefined {
  const file = statusFilePath(jobId);
  if (!existsSync(file)) return undefined;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
}

function writeJob(job: PromotionJob): void {
  mkdirSync(STATUS_DIR, { recursive: true });
  const tmp = `${statusFilePath(job.jobId)}.tmp`;
  writeFileSync(tmp, JSON.stringify(job, null, 2));
  renameSync(tmp, statusFilePath(job.jobId));
}

function githubToken(): string {
  const token = process.env.GITHUB_ACTIONS_DISPATCH_TOKEN;
  if (!token) {
    throw new Error('GITHUB_ACTIONS_DISPATCH_TOKEN is not configured');
  }
  return token;
}

async function githubApi<T>(apiPath: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${GITHUB_API}${apiPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${githubToken()}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GitHub API ${init.method ?? 'GET'} ${apiPath} failed: ${res.status} ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function startPromotion(source: string, branch: string): Promise<PromotionJob> {
  const jobId = randomUUID();
  const job: PromotionJob = {
    jobId,
    source,
    branch,
    createdAt: new Date().toISOString(),
    state: 'pending',
  };
  writeJob(job);

  await githubApi(`/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
    method: 'POST',
    body: JSON.stringify({ ref: 'main', inputs: { branch, jobId } }),
  });

  return job;
}

interface GithubWorkflowRun {
  id: number;
  name?: string;
  display_title?: string;
  status: string;
  conclusion: string | null;
  html_url: string;
}

// workflow_dispatch's own response never includes the run it created, so the
// run is found by matching run-name (set to include our jobId) among recent
// dispatch-triggered runs — the standard workaround for this GitHub API gap.
async function resolveRunId(job: PromotionJob): Promise<number | undefined> {
  const { workflow_runs } = await githubApi<{ workflow_runs: GithubWorkflowRun[] }>(
    `/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILE}/runs?event=workflow_dispatch&per_page=20`,
  );
  const match = workflow_runs.find((run) =>
    (run.display_title ?? run.name ?? '').includes(job.jobId),
  );
  return match?.id;
}

export async function getPromotionStatus(jobId: string): Promise<PromotionJob | undefined> {
  const job = readJob(jobId);
  if (!job) return undefined;

  if (!job.runId) {
    const runId = await resolveRunId(job);
    if (runId) {
      job.runId = runId;
      job.state = 'queued';
      writeJob(job);
    }
    return job;
  }

  if (job.state === 'synced' || job.state === 'failed') {
    return job;
  }

  const run = await githubApi<GithubWorkflowRun>(`/repos/${OWNER}/${REPO}/actions/runs/${job.runId}`);
  job.runUrl = run.html_url;
  if (run.status !== 'completed') {
    job.state = run.status === 'in_progress' ? 'in_progress' : 'queued';
  } else {
    job.state = run.conclusion === 'success' ? 'synced' : 'failed';
    job.detail = run.conclusion ?? undefined;
  }
  writeJob(job);
  return job;
}
