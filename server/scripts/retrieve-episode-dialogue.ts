/**
 * retrieve-episode-dialogue.ts
 *
 * Pulls verbatim conversation from conversation_memories into episode-ready
 * David:/Luca: dialogue blocks.  Luca retrieves instead of reconstructs.
 *
 * Usage:
 *   npx tsx server/scripts/retrieve-episode-dialogue.ts \
 *     --tag david-luca-chat \
 *     --since "2026-08-14T00:00:00Z" \
 *     --until  "2026-08-14T17:00:00Z"
 *
 *   # multiple tags (all must match — AND semantics):
 *   npx tsx server/scripts/retrieve-episode-dialogue.ts \
 *     --tag david-luca-chat --tag episode-28 \
 *     --since "2026-08-14T00:00:00Z"
 *
 *   # markdown output — each row becomes a ## section with source metadata:
 *   npx tsx server/scripts/retrieve-episode-dialogue.ts \
 *     --tag david-luca-chat --since "2026-08-14T00:00:00Z" \
 *     --format markdown
 *
 *   # limit results:
 *   npx tsx server/scripts/retrieve-episode-dialogue.ts \
 *     --tag david-luca-chat --since "2026-08-14T00:00:00Z" --limit 5
 *
 *   # show only the titles/IDs (preview mode, no content):
 *   npx tsx server/scripts/retrieve-episode-dialogue.ts \
 *     --tag david-luca-chat --since "2026-08-14T00:00:00Z" --list-only
 *
 *   # fetch a single row by ID:
 *   npx tsx server/scripts/retrieve-episode-dialogue.ts --id <uuid>
 *
 * Content is emitted verbatim — the bytes stored in the DB, unchanged.
 * Output goes to stdout — pipe to pbcopy, a file, or paste directly into .md.
 *
 * Exit codes
 * ──────────
 *   0  — one or more records found; output written to stdout
 *   1  — fatal error (missing args, DB unavailable, unexpected failure)
 *   2  — NO records found for the given tags/time window (loud failure)
 *
 * The exit-2 loud failure is intentional and load-bearing: it prevents Luca
 * from silently proceeding to write dialogue from memory when the DB has no
 * matching records.  The holahola-episode skill's DB-first process depends on
 * this script failing loudly so Luca knows to stop and check the DB first.
 *
 * Uses neon() HTTP driver per episode-sync-http rule — always reads the
 * authoritative state from Neon regardless of local WebSocket pool state.
 */

import { neon } from '@neondatabase/serverless';

// ---------------------------------------------------------------------------
// DB connection (HTTP driver — one-shot queries, no persistent pool)
// ---------------------------------------------------------------------------

function buildSql() {
  const url = process.env.NEON_SHARED_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    process.stderr.write(
      '[retrieve-episode-dialogue] FATAL: NEON_SHARED_DATABASE_URL is not set.\n',
    );
    process.exit(1);
  }
  return neon(url);
}

// Module-level singleton — avoids passing the sql function through every helper
// call and eliminates the NeonQueryFunction<false,false> vs <boolean,boolean>
// parameter-type mismatch that arises when it's typed at the call-site.
const sql = buildSql();

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]) {
  const args = argv.slice(2);

  const tags: string[] = [];
  let since    = '';
  let until    = '';
  let format   = 'plain';   // 'plain' | 'markdown'
  let limit    = 50;
  let listOnly = false;
  let id       = '';

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--tag':
      case '--tags':  // alias accepted by the CI check script
        if (args[i + 1]) tags.push(args[++i]);
        break;
      case '--since':
        if (args[i + 1]) since = args[++i];
        break;
      case '--until':
        if (args[i + 1]) until = args[++i];
        break;
      case '--format':
        if (args[i + 1]) format = args[++i];
        break;
      case '--limit':
        if (args[i + 1]) limit = parseInt(args[++i], 10);
        break;
      case '--list-only':
        listOnly = true;
        break;
      case '--id':
        if (args[i + 1]) id = args[++i];
        break;
      default:
        // ignore unknown flags
    }
  }

  return { tags, since, until, format, limit, listOnly, id };
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

interface MemoryRow {
  id: string;
  title: string;
  content: string;
  recorded_at: string | Date;
  tags: string[] | null;
}

async function fetchById(id: string): Promise<MemoryRow[]> {
  const rows = await sql`
    SELECT id, title, content, recorded_at, tags
    FROM conversation_memories
    WHERE id = ${id}
  `;
  return rows as unknown as MemoryRow[];
}

async function fetchByTagsAndRange(
  tags: string[],
  since: string,
  until: string,
  limit: number,
): Promise<MemoryRow[]> {
  // Filter and order by recorded_at — the event time of the conversation, not the
  // DB insertion time (created_at).  Backfilled or manually-inserted records may
  // have a created_at that differs from when the conversation actually happened;
  // recorded_at is the canonical episode timestamp.
  // tags @> array means all supplied tags must be present (AND semantics).
  if (since && until) {
    const rows = await sql`
      SELECT id, title, content, recorded_at, tags
      FROM conversation_memories
      WHERE tags @> ${tags as unknown as string[]}
        AND recorded_at >= ${since}::timestamptz
        AND recorded_at <= ${until}::timestamptz
      ORDER BY recorded_at ASC
      LIMIT ${limit}
    `;
    return rows as unknown as MemoryRow[];
  }

  if (since) {
    const rows = await sql`
      SELECT id, title, content, recorded_at, tags
      FROM conversation_memories
      WHERE tags @> ${tags as unknown as string[]}
        AND recorded_at >= ${since}::timestamptz
      ORDER BY recorded_at ASC
      LIMIT ${limit}
    `;
    return rows as unknown as MemoryRow[];
  }

  if (until) {
    const rows = await sql`
      SELECT id, title, content, recorded_at, tags
      FROM conversation_memories
      WHERE tags @> ${tags as unknown as string[]}
        AND recorded_at <= ${until}::timestamptz
      ORDER BY recorded_at ASC
      LIMIT ${limit}
    `;
    return rows as unknown as MemoryRow[];
  }

  // No time filter
  const rows = await sql`
    SELECT id, title, content, recorded_at, tags
    FROM conversation_memories
    WHERE tags @> ${tags as unknown as string[]}
    ORDER BY recorded_at ASC
    LIMIT ${limit}
  `;
  return rows as unknown as MemoryRow[];
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function isoDate(d: string | Date): string {
  const ts = typeof d === 'string' ? d : (d as Date).toISOString();
  return ts.slice(0, 19).replace('T', ' ') + ' UTC';
}

/**
 * Plain output: verbatim content, one row after another.
 * Each row is preceded by a one-line divider showing title + ID + timestamp
 * so the reader knows which DB entry produced each block.
 * The content bytes are emitted exactly as stored — no trimming, no blank-line
 * collapsing, no other modification.
 */
function formatPlain(rows: MemoryRow[]): string {
  const parts: string[] = [];
  for (const row of rows) {
    const header = `--- ${row.title} [${row.id}] ${isoDate(row.recorded_at)} ---`;
    parts.push(`${header}\n\n${row.content}`);
  }
  return parts.join('\n\n\n');
}

/**
 * Markdown output: each DB row becomes a level-2 section.
 *
 *   ## <title>
 *   *Source: id=… | timestamp | tags: …*
 *
 *   > <content verbatim as a blockquote>
 *
 * The blockquote prefix ("> ") preserves the content exactly while giving it
 * visible episode context in any Markdown renderer.  Drop the blockquote
 * markers before pasting dialogue into the episode narrative itself.
 */
function formatMarkdown(rows: MemoryRow[]): string {
  const parts: string[] = [];
  for (const row of rows) {
    const ts     = isoDate(row.recorded_at);
    const tagStr = (row.tags ?? []).join(', ') || '—';
    const header = `## ${row.title}`;
    const meta   = `*Source: id=${row.id} | ${ts} | tags: ${tagStr}*`;
    // Wrap each line of verbatim content in a blockquote marker
    const quoted = row.content
      .split('\n')
      .map(line => `> ${line}`)
      .join('\n');
    parts.push(`${header}\n\n${meta}\n\n${quoted}`);
  }
  return parts.join('\n\n---\n\n');
}

/**
 * List-only output: id | recorded_at | title — no content.
 * Use this first to identify which rows you want before pulling the full text.
 */
function formatList(rows: MemoryRow[]): string {
  if (rows.length === 0) return '(no results)';
  return rows.map(r => `${r.id}  ${isoDate(r.recorded_at)}  ${r.title}`).join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { tags, since, until, format, limit, listOnly, id } = parseArgs(process.argv);

  // Validate args
  if (!id && tags.length === 0) {
    process.stderr.write(
      '[retrieve-episode-dialogue] ERROR: Provide --tag <tag> (one or more) or --id <uuid>.\n\n' +
      'Examples:\n' +
      '  npx tsx server/scripts/retrieve-episode-dialogue.ts \\\n' +
      '    --tag david-luca-chat --since "2026-08-14T00:00:00Z"\n\n' +
      '  npx tsx server/scripts/retrieve-episode-dialogue.ts --id <uuid>\n',
    );
    process.exit(1);
  }

  const validFormats = ['plain', 'markdown'];
  if (!validFormats.includes(format)) {
    process.stderr.write(
      `[retrieve-episode-dialogue] ERROR: --format must be one of: ${validFormats.join(', ')}\n`,
    );
    process.exit(1);
  }

  // Fetch
  let rows: MemoryRow[];

  if (id) {
    process.stderr.write(`[retrieve-episode-dialogue] Fetching id=${id}…\n`);
    rows = await fetchById(id);
  } else {
    const timeDesc =
      [since && `since ${since}`, until && `until ${until}`].filter(Boolean).join(', ') ||
      'no time filter';
    process.stderr.write(
      `[retrieve-episode-dialogue] Querying tags=[${tags.join(', ')}] ${timeDesc} limit=${limit}…\n`,
    );
    rows = await fetchByTagsAndRange(tags, since, until, limit);
  }

  process.stderr.write(`[retrieve-episode-dialogue] Found ${rows.length} row(s).\n`);

  if (rows.length === 0) {
    process.stderr.write(
      '\n⛔ NO RECORDS FOUND — zero rows matched the given tags / date range.\n' +
      '   Do NOT proceed with episode writing until real rows are retrieved.\n' +
      '   Do NOT reconstruct from memory.\n\n' +
      '  Retrieve options:\n' +
      '    - Widen the time range (--since / --until)\n' +
      '    - Check available rows by querying the DB directly:\n' +
      '        SELECT id, title, recorded_at, tags FROM conversation_memories\n' +
      (tags.length > 0
        ? `        WHERE tags && '{${tags[0]}}' ORDER BY recorded_at DESC LIMIT 10;\n`
        : '') +
      '    - Save the live session manually before writing:\n' +
      '        POST /api/conversation-memories (see holahola-episode SKILL.md)\n',
    );
    process.exit(2);
  }

  // Format and emit — all output to stdout, status messages to stderr
  let output: string;
  if (listOnly) {
    output = formatList(rows);
  } else if (format === 'markdown') {
    output = formatMarkdown(rows);
  } else {
    output = formatPlain(rows);
  }

  process.stdout.write(output + '\n');
}

main().catch(err => {
  process.stderr.write(`[retrieve-episode-dialogue] FATAL: ${(err as Error).message ?? err}\n`);
  process.exit(1);
});
