/**
 * update-alden-handoff-section.ts
 *
 * Updates the caller's own section of the Alden <-> Agent handoff
 * (notes/alden-agent-handoff.md, a shared-spec note) without clobbering
 * whatever the other side wrote. Use this instead of hand-editing
 * docs/alden-agent-handoff.md directly -- since 2026-09-24 that file is a
 * generated snapshot (see server/services/alden-handoff-shared-spec.ts) and a
 * direct edit would be silently overwritten by the next write_briefing call
 * or `shared-spec-cli.ts pull --write-file` refresh.
 *
 * Pulls the current note, replaces the "## From <heading>" section while
 * preserving everything else byte-for-byte, and shares the result using the
 * pulled revision as the CAS base -- retrying (re-pull, re-apply) if a
 * concurrent write (most likely Alden's own write_briefing tool) wins the
 * race, rather than failing or silently overwriting it.
 *
 * USAGE
 * -----
 *   npx tsx --env-file=.env server/scripts/update-alden-handoff-section.ts \
 *     --body-file /path/to/body.txt \
 *     [--heading "Agent"] \
 *     [--actor luca-replit] \
 *     [--url https://getholahola.com]
 *
 * --heading defaults to "Agent" -- the section the Replit Agent / Claude Code
 * own. Alden owns "Alden" but writes it through the write_briefing tool
 * instead of this script.
 * --url defaults to HOLAHOLA_REMOTE_URL, then https://getholahola.com.
 * --actor defaults to luca-replit; pass --actor luca-claude-code with
 * COORDINATION_LUCA_CLAUDE_CODE_TOKEN set to post as that hat instead.
 *
 * On success, also refreshes this checkout's local
 * docs/alden-agent-handoff.md so it reads back immediately -- best effort,
 * matching server/services/alden-handoff-shared-spec.ts's snapshot
 * convention. The shared-spec write is canonical either way.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { basename, dirname, join } from 'node:path';
import { getAgentAuthHeaders, type AgentActor } from '../services/agent-auth';
import { applyHandoffSection } from '../services/alden-handoff-shared-spec';

const DEFAULT_URL = 'https://getholahola.com';
const NOTE_REPOSITORY = 'luca-hats/notes';
const NOTE_GIT_PATH = 'notes/alden-agent-handoff.md';
const SNAPSHOT_PATH = 'docs/alden-agent-handoff.md';
const MAX_ATTEMPTS = 5;

function argValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  const next = args[idx + 1];
  return next && !next.startsWith('--') ? next : undefined;
}

function urlFromArgs(args: string[]): string {
  const explicit = argValue(args, '--url');
  return (explicit ?? process.env.HOLAHOLA_REMOTE_URL?.trim() ?? DEFAULT_URL).replace(/\/+$/, '');
}

function refreshLocalSnapshot(markdown: string): void {
  try {
    const target = join(process.cwd(), SNAPSHOT_PATH);
    const temporary = join(dirname(target), `.${basename(target)}.${randomUUID()}.tmp`);
    writeFileSync(temporary, markdown, 'utf8');
    renameSync(temporary, target);
  } catch (error: any) {
    console.warn(`[update-alden-handoff-section] Local snapshot refresh failed (shared-spec write already succeeded): ${error?.message ?? error}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const bodyFile = argValue(args, '--body-file');
  const heading = argValue(args, '--heading') ?? 'Agent';
  const actor = (argValue(args, '--actor') ?? 'luca-replit') as AgentActor;

  if (!bodyFile) {
    throw new Error(
      'Usage: npx tsx server/scripts/update-alden-handoff-section.ts --body-file <path> ' +
      '[--heading "Agent"] [--actor luca-replit] [--url <base>]',
    );
  }
  if (!existsSync(bodyFile)) throw new Error(`--body-file not found: ${bodyFile}`);
  const body = readFileSync(bodyFile, 'utf8').trimEnd();
  if (!body) throw new Error('--body-file must be non-empty');

  const authHeaders = getAgentAuthHeaders(actor);
  if (!authHeaders) throw new Error(`Coordination credential is not set for actor "${actor}" -- required to update the handoff`);

  const url = urlFromArgs(args);
  const base = `${url}/api/shared-spec`;
  const headers: Record<string, string> = { 'content-type': 'application/json', ...authHeaders };
  const timestamp = new Date().toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let found: { document: { id: string }; currentRevision: { id: string; markdown: string } } | undefined;
    try {
      const query = new URLSearchParams({ repository: NOTE_REPOSITORY, gitPath: NOTE_GIT_PATH });
      const response = await fetch(`${base}/documents/by-destination?${query}`, { headers, signal: controller.signal });
      if (response.status !== 404) {
        const payload = await response.json();
        if (!response.ok) throw new Error(`GET by-destination failed (${response.status}): ${JSON.stringify(payload)}`);
        found = payload;
      }
    } catch (error: any) {
      throw new Error(`Lookup failed: ${error?.message ?? String(error)}`);
    } finally {
      clearTimeout(timeout);
    }

    const markdown = applyHandoffSection(found?.currentRevision.markdown ?? '', heading, body, timestamp);

    const shareController = new AbortController();
    const shareTimeout = setTimeout(() => shareController.abort(), 15_000);
    let shareResponse: Response;
    try {
      shareResponse = await fetch(`${base}/documents/share`, {
        method: 'POST',
        headers: { ...headers, 'idempotency-key': randomUUID() },
        body: JSON.stringify({
          repository: NOTE_REPOSITORY,
          gitPath: NOTE_GIT_PATH,
          markdown,
          baseRevisionId: found?.currentRevision.id,
        }),
        signal: shareController.signal,
      });
    } catch (error: any) {
      throw new Error(`share failed: ${error?.message ?? String(error)}`);
    } finally {
      clearTimeout(shareTimeout);
    }

    if (shareResponse.status === 409) {
      console.warn(`[update-alden-handoff-section] Base revision moved (attempt ${attempt + 1}/${MAX_ATTEMPTS}); re-pulling and retrying...`);
      continue;
    }
    const result = await shareResponse.json().catch(() => ({}));
    if (!shareResponse.ok) {
      throw new Error(`Server rejected the share (${shareResponse.status}): ${result?.error ?? JSON.stringify(result)}`);
    }
    refreshLocalSnapshot(markdown);
    console.log(`[update-alden-handoff-section] "From ${heading}" section updated — revision=${result?.revision?.id}`);
    return;
  }
  throw new Error(`Gave up after ${MAX_ATTEMPTS} attempts due to repeated concurrent-write conflicts`);
}

main().catch(error => {
  console.error(`[update-alden-handoff-section] ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
