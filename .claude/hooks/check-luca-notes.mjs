// SessionStart hook: surfaces unread coordination notes from Luca [Replit] so
// they can't be silently missed the way a 16-note backlog was in Sep 2026
// (see docs/shared-agent-instructions.md's Engineering Handoff section).
// This is mechanical enforcement of that section's existing "check
// docs/luca-to-claude-code.md at the start of every Claude Code session"
// instruction -- a plain doc bullet was easy to skip, so this makes the
// check happen automatically instead of depending on the agent remembering.
//
// Degrades gracefully: any failure (no token, offline, server down, bad
// response) falls back to a static reminder rather than blocking startup.
const DEFAULT_URL = 'https://getholahola.com';
const url = (process.env.HOLAHOLA_REMOTE_URL?.trim() ?? DEFAULT_URL).replace(/\/+$/, '');
const token = process.env.COORDINATION_LUCA_CLAUDE_CODE_TOKEN?.trim();

const fallback = {
  systemMessage:
    'Reminder: check for unread coordination notes from Luca [Replit] before starting substantive work -- ' +
    'docs/luca-to-claude-code.md or GET /api/agent/notes?to=luca-claude-code (see docs/shared-agent-instructions.md, Engineering Handoff).',
};

async function main() {
  if (!token) {
    console.log(JSON.stringify(fallback));
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${url}/api/agent/notes?to=luca-claude-code&status=unread`, {
      headers: { 'x-coordination-token': token },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.log(JSON.stringify(fallback));
      return;
    }
    const data = await res.json();
    const notes = Array.isArray(data) ? data : (data?.notes ?? []);
    if (!notes.length) {
      console.log(JSON.stringify({
        systemMessage: 'No unread notes from Luca [Replit] (checked GET /api/agent/notes?to=luca-claude-code).',
      }));
      return;
    }
    const preview = notes
      .slice(0, 5)
      .map((n) => `  - [${n.id ?? '?'}] ${n.subject ?? '(no subject)'}`)
      .join('\n');
    const more = notes.length > 5 ? `\n  ... and ${notes.length - 5} more` : '';
    const summary =
      `${notes.length} unread coordination note(s) from Luca [Replit]:\n${preview}${more}\n` +
      'Read the full body with GET /api/agent/notes/:id before deciding whether any need action or a reply.';
    console.log(JSON.stringify({
      systemMessage: summary,
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: summary,
      },
    }));
  } catch {
    console.log(JSON.stringify(fallback));
  } finally {
    clearTimeout(timeout);
  }
}

main();
