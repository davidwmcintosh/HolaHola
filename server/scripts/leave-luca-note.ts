/**
 * leave-luca-note.ts
 *
 * The write side of the Claude Code -> Luca [Replit] notes inbox
 * (docs/claude-code-to-luca.md). Posts to POST /api/agent/notes/from-claude-code,
 * then triggers a snapshot refresh so the markdown file reflects the new note
 * immediately rather than waiting for the next server restart.
 *
 * This is the channel docs/agent-workflows.md's session-start checklist
 * (step 8) actually reads for "Luca [Claude Code]" notes -- use this instead
 * of docs/alden-agent-handoff.md for cross-cutting Claude Code -> Luca
 * handoffs. See docs/shared-agent-instructions.md.
 *
 * There is no local-write mode: unlike record-exchange.ts's .chat_capture
 * file, this inbox has no local-file form at all -- it lives only in the
 * agent_notes table and its markdown snapshot is generated server-side. Every
 * caller, on any machine, posts to a running server.
 *
 * USAGE
 * -----
 *   npx tsx --env-file=.env server/scripts/leave-luca-note.ts \
 *     --subject "Short subject line" \
 *     --body-file /path/to/body.txt \
 *     [--session-label "During: ..."] \
 *     [--source-message-key <stable-id-for-idempotent-retry>] \
 *     [--url https://getholahola.com]
 *
 * --url defaults to HOLAHOLA_REMOTE_URL, then https://getholahola.com.
 * Requires REPLIT_AGENT_TOKEN in the environment.
 */
import { existsSync, readFileSync } from 'fs';

const DEFAULT_URL = 'https://getholahola.com';

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

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const subject = argValue(args, '--subject');
  const bodyFile = argValue(args, '--body-file');
  const sessionLabel = argValue(args, '--session-label');
  const sourceMessageKey = argValue(args, '--source-message-key');

  if (!subject || !bodyFile) {
    throw new Error(
      'Usage: npx tsx server/scripts/leave-luca-note.ts --subject <text> --body-file <path> ' +
      '[--session-label <text>] [--source-message-key <id>] [--url <base>]',
    );
  }
  if (!existsSync(bodyFile)) throw new Error(`--body-file not found: ${bodyFile}`);
  const body = readFileSync(bodyFile, 'utf8').trimEnd();
  if (!body) throw new Error('--body-file must be non-empty');

  const agentToken = process.env.REPLIT_AGENT_TOKEN?.trim();
  if (!agentToken) throw new Error('REPLIT_AGENT_TOKEN is not set -- required to leave a note');

  const url = urlFromArgs(args);
  console.log(`[leave-luca-note] Posting "${subject}" to ${url}/api/agent/notes/from-claude-code...`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let response: Response;
  try {
    response = await fetch(`${url}/api/agent/notes/from-claude-code`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-agent-token': agentToken },
      body: JSON.stringify({
        subject,
        body,
        session_label: sessionLabel ?? null,
        source_message_key: sourceMessageKey ?? null,
      }),
      signal: controller.signal,
    });
  } catch (error: any) {
    throw new Error(`POST failed: ${error?.message ?? String(error)}`);
  } finally {
    clearTimeout(timeout);
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Server rejected the note (${response.status}): ${result?.error ?? JSON.stringify(result)}`);
  }
  console.log(
    `[leave-luca-note] ${result.deduplicated ? 'Already existed (idempotent retry)' : 'Saved'} — id=${result.id}`,
  );

  const refreshController = new AbortController();
  const refreshTimeout = setTimeout(() => refreshController.abort(), 15_000);
  try {
    const refreshResponse = await fetch(`${url}/api/agent/notes/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-agent-token': agentToken },
      body: JSON.stringify({}),
      signal: refreshController.signal,
    });
    if (refreshResponse.ok) {
      console.log('[leave-luca-note] Snapshot refreshed -- docs/claude-code-to-luca.md is current.');
    } else {
      console.warn(`[leave-luca-note] Note saved, but snapshot refresh returned ${refreshResponse.status}. It will still appear at the server's next restart.`);
    }
  } catch (error: any) {
    console.warn(`[leave-luca-note] Note saved, but snapshot refresh failed: ${error?.message ?? String(error)}. It will still appear at the server's next restart.`);
  } finally {
    clearTimeout(refreshTimeout);
  }
}

main().catch(error => {
  console.error(`[leave-luca-note] ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
