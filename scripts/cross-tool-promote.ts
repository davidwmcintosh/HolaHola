/**
 * Cross-tool "get a committed branch onto main safely" — for any external
 * tool/caller (Claude Code, Cursor, Antigravity, a human) that isn't Replit's
 * own persistent dev checkout. Design: docs/superpowers/specs/2026-08-26-unified-source-promote-endpoint-design.md
 *
 * Renamed from source-promote.ts 2026-08-31: Replit independently built its
 * own git-promotion entry point (server/services/source-control-service.ts,
 * "source-promotion") for its own dev checkout specifically — different
 * caller, different constraints, not a duplicate. Two entry points into main
 * is the right shape here, not a conflict to resolve into one; a future
 * platform with its own host-specific requirements (Antigravity, say) could
 * reasonably add a third. What they share: fast-forward-only, no automatic
 * reconciliation of a diverged branch, and the deploy key never held by the
 * calling agent/tool. See the "Two entry points" note in the design doc.
 *
 * Talks to the GitHub Actions API directly — no HolaHola server involved.
 * An earlier version proxied through POST /api/internal/source-promote, but
 * that endpoint would only ever be as reachable as whichever Replit process
 * hosted it (dev restarts constantly and isn't meant to have uptime
 * guarantees; production is the live-traffic process this was always meant
 * to stay off of). The actual credential this needs to protect —
 * HOLAHOLA_GITHUB_DEPLOY_KEY — never leaves GitHub Actions secrets in either
 * design, so the server-hosted proxy added a reachability dependency without
 * adding real security. GitHub's own API is already the always-on service
 * here; there was nothing to proxy.
 *
 * Usage:
 *   npx tsx scripts/cross-tool-promote.ts push <branch> [--source <label>]
 *   npx tsx scripts/cross-tool-promote.ts status <jobId>
 *
 * Caller responsibility before calling `push`: commit locally, then
 * `git push origin <branch>` normally — pushing a non-main branch needs no
 * special credential. This script only asks GitHub Actions to validate and
 * fast-forward main; it never touches the deploy key itself.
 */
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const OWNER = 'davidwmcintosh';
const REPO = 'HolaHola';
const WORKFLOW_FILE = 'cross-tool-promote.yml';
const GITHUB_API = 'https://api.github.com';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} — add it to .env before running scripts/cross-tool-promote.ts`);
  }
  return value;
}

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

async function githubApi<T>(apiPath: string, init: RequestInit = {}): Promise<T> {
  const token = requireEnv('GITHUB_ACTIONS_DISPATCH_TOKEN');
  const res = await fetch(`${GITHUB_API}${apiPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
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

interface GithubWorkflowRun {
  id: number;
  name?: string;
  display_title?: string;
  status: string;
  conclusion: string | null;
  html_url: string;
}

// workflow_dispatch's own response never includes the run it created, so the
// run is found by matching run-name (set from the jobId) among recent
// dispatch-triggered runs — the standard workaround for this GitHub API gap.
// Stateless by design: any later `status <jobId>` call resolves this fresh,
// no local bookkeeping needed.
async function resolveRun(jobId: string): Promise<GithubWorkflowRun | undefined> {
  const { workflow_runs } = await githubApi<{ workflow_runs: GithubWorkflowRun[] }>(
    `/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILE}/runs?event=workflow_dispatch&per_page=20`,
  );
  return workflow_runs.find((run) => (run.display_title ?? run.name ?? '').includes(jobId));
}

function parseFlags(args: string[]): { positional: string[]; flags: Record<string, string | boolean> } {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const [key, inlineValue] = arg.slice(2).split('=');
      if (inlineValue !== undefined) {
        flags[key] = inlineValue;
      } else if (args[i + 1] && !args[i + 1].startsWith('--')) {
        flags[key] = args[++i];
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

async function cmdPush(positional: string[], flags: Record<string, string | boolean>) {
  const branch = positional[0];
  if (!branch) {
    throw new Error('Usage: cross-tool-promote.ts push <branch> [--source <label>]');
  }
  if (!isValidBranchName(branch)) {
    throw new Error(`Not a valid branch name: ${branch}`);
  }
  const source = (flags.source as string) ?? 'claude-code';
  const jobId = randomUUID();

  await githubApi(`/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
    method: 'POST',
    body: JSON.stringify({ ref: 'main', inputs: { branch, jobId } }),
  });
  console.log(`[cross-tool-promote] Dispatched by ${source} — job ${jobId}`);

  for (;;) {
    await new Promise((r) => setTimeout(r, 10_000));
    const run = await resolveRun(jobId);
    if (!run) {
      console.log('[cross-tool-promote] queued — waiting for the run to appear...');
      continue;
    }
    if (run.status !== 'completed') {
      console.log(`[cross-tool-promote] ${run.status} — ${run.html_url}`);
      continue;
    }
    if (run.conclusion === 'success') {
      console.log(`[cross-tool-promote] SYNCED — main now includes this branch. ${run.html_url}`);
    } else {
      console.error(`[cross-tool-promote] FAILED (${run.conclusion}) — ${run.html_url}`);
      process.exitCode = 1;
    }
    return;
  }
}

async function cmdStatus(positional: string[]) {
  const jobId = positional[0];
  if (!jobId) {
    throw new Error('Usage: cross-tool-promote.ts status <jobId>');
  }
  const run = await resolveRun(jobId);
  if (!run) {
    console.log('No run found yet for that jobId — it may not have started, or may be older than the last 20 dispatch runs.');
    return;
  }
  console.log(JSON.stringify(run, null, 2));
}

async function main() {
  const [subcommand, ...rest] = process.argv.slice(2);
  const { positional, flags } = parseFlags(rest);

  switch (subcommand) {
    case 'push':
      return cmdPush(positional, flags);
    case 'status':
      return cmdStatus(positional);
    default:
      console.error('Usage: cross-tool-promote.ts <push|status> [options]');
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
