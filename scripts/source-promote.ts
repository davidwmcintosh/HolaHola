/**
 * Caller-side CLI for POST /api/internal/source-promote — the one shared way
 * any tool (Claude Code, Replit, Cursor, Antigravity) gets a committed branch
 * onto main safely. Design: docs/superpowers/specs/2026-08-26-unified-source-promote-endpoint-design.md
 *
 * Usage:
 *   npx tsx scripts/source-promote.ts push <branch> [--source <label>] [--url <base>]
 *   npx tsx scripts/source-promote.ts status <jobId> [--url <base>]
 *
 * Caller responsibility before calling `push`: commit locally, then
 * `git push origin <branch>` normally — pushing a non-main branch needs no
 * special credential. This script only asks the shared endpoint to validate
 * and fast-forward main; it never touches the deploy key itself.
 */
import { existsSync } from 'node:fs';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} — add it to .env before running scripts/source-promote.ts`);
  }
  return value;
}

function baseUrl(flags: Record<string, string | boolean>): string {
  const url = (flags.url as string) ?? process.env.APP_URL;
  if (!url) {
    throw new Error('No base URL — pass --url or set APP_URL in .env');
  }
  return url.replace(/\/$/, '');
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

async function bridgeFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = requireEnv('SOURCE_BRIDGE_API_TOKEN');
  const res = await fetch(url, {
    ...init,
    headers: {
      'x-source-bridge-token': token,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${init.method ?? 'GET'} ${url} -> ${res.status}: ${JSON.stringify(body)}`);
  }
  return body as T;
}

interface PromotionStatus {
  jobId: string;
  state: 'pending' | 'queued' | 'in_progress' | 'synced' | 'failed';
  branch: string;
  source: string;
  runUrl?: string;
  detail?: string;
}

async function cmdPush(positional: string[], flags: Record<string, string | boolean>) {
  const branch = positional[0];
  if (!branch) {
    throw new Error('Usage: source-promote.ts push <branch> [--source <label>] [--url <base>]');
  }
  const source = (flags.source as string) ?? 'claude-code';
  const url = baseUrl(flags);

  const start = await bridgeFetch<{ jobId: string; state: string }>(`${url}/api/internal/source-promote`, {
    method: 'POST',
    body: JSON.stringify({ source, branch }),
  });
  console.log(`[source-promote] Dispatched — job ${start.jobId}, state ${start.state}`);

  const terminal = new Set(['synced', 'failed']);
  for (;;) {
    await new Promise((r) => setTimeout(r, 10_000));
    const status = await bridgeFetch<PromotionStatus>(`${url}/api/internal/source-promote/${start.jobId}`);
    console.log(`[source-promote] ${status.state}${status.runUrl ? ` — ${status.runUrl}` : ''}`);
    if (terminal.has(status.state)) {
      if (status.state === 'failed') {
        console.error(`[source-promote] FAILED${status.detail ? `: ${status.detail}` : ''}`);
        process.exitCode = 1;
      } else {
        console.log('[source-promote] SYNCED — main now includes this branch.');
      }
      return;
    }
  }
}

async function cmdStatus(positional: string[], flags: Record<string, string | boolean>) {
  const jobId = positional[0];
  if (!jobId) {
    throw new Error('Usage: source-promote.ts status <jobId> [--url <base>]');
  }
  const url = baseUrl(flags);
  const status = await bridgeFetch<PromotionStatus>(`${url}/api/internal/source-promote/${jobId}`);
  console.log(JSON.stringify(status, null, 2));
}

async function main() {
  const [subcommand, ...rest] = process.argv.slice(2);
  const { positional, flags } = parseFlags(rest);

  switch (subcommand) {
    case 'push':
      return cmdPush(positional, flags);
    case 'status':
      return cmdStatus(positional, flags);
    default:
      console.error('Usage: source-promote.ts <push|status> [options]');
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
