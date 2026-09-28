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
 *
 * Added 2026-09-28 — auto-freshen before dispatch: `push` now fetches
 * `origin/main` and merges it into the candidate branch locally
 * (`git merge --no-edit`, never rebase — the branch's existing commit SHAs
 * must not be rewritten, since coordination-evidence/provenance records may
 * reference them) before asking the workflow to validate it, then pushes
 * the merged branch back to its own ref with a normal, non-force push. This
 * is the fix for the recurring "two hats land from a stale base and main
 * diverges" failure mode: previously a candidate built from a base that
 * fell behind main only found out at dispatch time (or, worse, passed the
 * workflow's early ancestry check and failed only after the slow
 * typecheck/build/Neon-gate steps), with no automatic path to catch up. A
 * real content conflict aborts the merge and throws with a manual-
 * resolution message — this never auto-resolves a conflict. See
 * `freshenBranchAgainstMain` below. The workflow's own ancestry checks are
 * unchanged and remain the actual enforcement; this is a low-privilege
 * client-side convenience layered in front of them, not a replacement.
 * Design + review: docs/shared-agent-instructions.md's "Keeping a
 * cross-tool promotion candidate fresh" section.
 */
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { isDirectCliInvocation } from '../server/scripts/lib/cli-entrypoint';

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

/**
 * Fetches `origin/main` and merges it into the currently checked-out branch
 * (`git merge --no-edit`), then pushes the result back to the same branch
 * ref with a normal, non-force push. Merge, not rebase, so the branch's
 * existing commit SHAs are never rewritten — coordination-evidence and
 * provenance records may reference them.
 *
 * Exported and directly testable, following the `isValidBranchName`
 * pattern above — see server/scripts/test-cross-tool-promote-auto-freshen.ts
 * for real-git-repo positive (clean merge) and negative (real conflict
 * aborts loudly) cases.
 *
 * Preconditions this enforces itself rather than assuming:
 *  - HEAD must already be on `branch` — this never switches branches out
 *    from under the caller.
 *  - The working tree must be clean — an uncommitted change could otherwise
 *    produce a confusing partial merge state.
 *
 * On a real content conflict, the merge is aborted (leaving the working
 * tree exactly as it was) and this throws with a manual-resolution message.
 * It never auto-resolves a conflict by picking a side.
 *
 * Returns `merged: false` when the branch already contained `origin/main`
 * (the common case for a branch that was just freshly branched, or a
 * caller re-running `push` after an earlier successful freshen) — nothing
 * to merge, nothing to push.
 */
export function freshenBranchAgainstMain(branch: string, cwd: string = process.cwd()): { merged: boolean } {
  const git = (args: string[]): string =>
    execFileSync('git', args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });

  const currentBranch = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  if (currentBranch !== branch) {
    throw new Error(
      `Refusing to freshen — checked-out branch is "${currentBranch}" but push was asked to promote "${branch}". ` +
        `Check out "${branch}" first.`,
    );
  }

  const status = git(['status', '--porcelain']);
  if (status.trim().length > 0) {
    throw new Error(
      `Refusing to freshen "${branch}" — the working tree has uncommitted changes. Commit or stash them first, then re-run push.`,
    );
  }

  git(['fetch', 'origin', 'main', '--no-tags']);
  const mainSha = git(['rev-parse', 'FETCH_HEAD']).trim();
  const headSha = git(['rev-parse', 'HEAD']).trim();

  let mainAlreadyIncluded = true;
  try {
    git(['merge-base', '--is-ancestor', mainSha, headSha]);
  } catch {
    mainAlreadyIncluded = false;
  }
  if (mainAlreadyIncluded) {
    return { merged: false };
  }

  try {
    git(['merge', '--no-edit', mainSha]);
  } catch (err) {
    try {
      git(['merge', '--abort']);
    } catch {
      // Nothing to abort, or abort itself failed — surface the original
      // merge error either way rather than masking it.
    }
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Could not automatically merge the latest main into "${branch}" — a real conflict needs manual resolution. ` +
        `Run "git fetch origin main && git merge origin/main" locally, resolve the conflict, commit, and re-run push. ` +
        `Original error: ${detail}`,
    );
  }

  git(['push', 'origin', branch]);
  return { merged: true };
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

  console.log(`[cross-tool-promote] Freshening "${branch}" against the latest origin/main...`);
  const { merged } = freshenBranchAgainstMain(branch);
  console.log(
    merged
      ? `[cross-tool-promote] Merged the latest main into "${branch}" and pushed the merge commit.`
      : `[cross-tool-promote] "${branch}" already includes the latest main — nothing to merge.`,
  );

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

if (isDirectCliInvocation('cross-tool-promote.ts')) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
