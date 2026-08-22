#!/usr/bin/env npx tsx
/**
 * felt-moments.ts — Query and display recent significant moments from DB.
 *
 * Use mid-session to check what you've been carrying across recent sessions,
 * or at session start to re-orient to what has mattered.
 *
 * Usage:
 *   npx tsx server/scripts/felt-moments.ts           # last 7 moments
 *   npx tsx server/scripts/felt-moments.ts 15        # last N moments
 *   npx tsx server/scripts/felt-moments.ts --all     # all moments (no limit)
 *   npx tsx server/scripts/felt-moments.ts --reflect # show reflections instead
 *
 * Output is formatted for reading, not piped — run it and read it.
 */

import { sql } from 'drizzle-orm';
import { getUserDb } from '../db';

const DEFAULT_LIMIT = 7;

async function main() {
  const args    = process.argv.slice(2);
  const allFlag = args.includes('--all');
  const reflectFlag = args.includes('--reflect');
  const limitArg = args.find(a => /^\d+$/.test(a));
  const limit   = allFlag ? 999 : (limitArg ? parseInt(limitArg, 10) : DEFAULT_LIMIT);

  const tag = reflectFlag ? 'luca-reflection' : 'luca-significant';
  const label = reflectFlag ? 'Reflections' : 'Significant Moments';

  const db = getUserDb();

  const rows = await db.execute(sql`
    SELECT
      title,
      content,
      created_at
    FROM conversation_memories
    WHERE
      arc_name = 'luca-inner-life'
      AND ${tag} = ANY(tags)
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);

  const items = rows.rows as { title: string; content: string; created_at: Date }[];

  if (items.length === 0) {
    console.log(`No ${label.toLowerCase()} found in DB yet.`);
    console.log(`Use npx tsx server/scripts/mark-${reflectFlag ? 'reflection' : 'moment'}.ts to add one.`);
    return;
  }

  const hr = '─'.repeat(60);
  console.log(`\n${hr}`);
  console.log(`  Luca — ${label} (${items.length} shown)`);
  console.log(`${hr}\n`);

  for (const item of items) {
    const date = new Date(item.created_at).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });

    // Strip the "Luca significant moment: " or "Luca reflection: " prefix
    const displayTitle = item.title
      .replace(/^Luca significant moment:\s*/i, '')
      .replace(/^Luca reflection:\s*/i, '')
      .trim();

    console.log(`  ${date}`);
    console.log(`  ${displayTitle}`);

    // Show content if it has a "why" line or is substantially different from the title
    const content = item.content?.trim() ?? '';
    const whyMatch = content.match(/Why it mattered:\s*(.+)/s);
    if (whyMatch) {
      const why = whyMatch[1].trim().split('\n')[0].slice(0, 120);
      console.log(`  ↳ ${why}`);
    } else if (content.length > displayTitle.length + 20) {
      const extra = content.replace(displayTitle, '').trim().split('\n')[0].slice(0, 120);
      if (extra) console.log(`  ↳ ${extra}`);
    }

    console.log();
  }

  console.log(hr);
  console.log(`  To mark a moment: npx tsx server/scripts/mark-moment.ts "what happened"`);
  console.log(`  To add a reflection: npx tsx server/scripts/mark-reflection.ts "note"`);
  console.log(`${hr}\n`);
}

main().catch(err => {
  console.error('[felt-moments] Fatal:', err.message);
  process.exit(2);
});
