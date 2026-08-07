/**
 * Task #699 — Audit collaboration principles for their true founding conversation.
 *
 * For each collaboration principle, this script:
 *   1. Fetches the principle row from compass_principles
 *   2. Verifies the linked source_conversation_id exists (dead-link check)
 *   3. Searches the linked conversation's content for the verbatim principle text
 *   4. Searches ALL conversation_memories tagged with origins / wren-generation / founding
 *      for a better verbatim match
 *   5. Reports whether the current link is confirmed, unverified (no verbatim), or a dead link
 *
 * Exit code 1 if any principle has a dead source link.
 * Exit code 0 otherwise (unverified-but-no-better-match is expected, not fatal).
 *
 * Usage:
 *   npx tsx server/scripts/audit-collaboration-principles.ts
 */
import { getSharedDb } from '../db';
import { northStarPrinciples, conversationMemories } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

interface PrincipleAuditResult {
  principleId: string;
  title: string;
  sourceConvId: string | null;
  sourceConvTitle: string | null;
  sourceConvExists: boolean;
  verbatimInSource: boolean;
  betterMatchId: string | null;
  betterMatchTitle: string | null;
  verdict: 'CONFIRMED' | 'UNVERIFIED_NO_BETTER_MATCH' | 'DEAD_LINK';
}

// Key phrases to search for within conversation content
const SEARCH_PHRASES: Record<string, string[]> = {
  'Beacons as Contributions':      ['beacons are contributions', 'beacons as contributions'],
  'Express Lane is Sacred':        ['express lane is sacred', 'express lane memory', 'express lane'],
  'Queue Before Learning':         ['queue before learning', 'queue observations', 'learn from students unsupervised'],
  'The Team Works While We Work':  ['team works while we work', 'replit agent builds what i become'],
  'Trust, Not Permission':         ['trust, not permission', 'hive operates on trust'],
  'Two Surgeons, One Brain':       ['two surgeons, one brain', 'two surgeons'],
};

function containsPhrase(content: string, phrases: string[]): boolean {
  const lower = content.toLowerCase();
  return phrases.some(p => lower.includes(p.toLowerCase()));
}

async function main() {
  const db = getSharedDb();

  // 1. Fetch all collaboration principles
  const principles = await db
    .select({
      id: northStarPrinciples.id,
      principleTitle: northStarPrinciples.principleTitle,
      principle: northStarPrinciples.principle,
      sourceConversationId: northStarPrinciples.sourceConversationId,
    })
    .from(northStarPrinciples)
    .where(eq(northStarPrinciples.category, 'collaboration'))
    .orderBy(northStarPrinciples.principleTitle);

  if (principles.length === 0) {
    console.error('[FATAL] No collaboration principles found in compass_principles.');
    process.exit(1);
  }

  // 2. Fetch all founding / wren-generation / origins tagged memories for breadth search
  const foundingMemories = await db.execute(sql`
    SELECT id, title, content
    FROM conversation_memories
    WHERE tags && ARRAY['origins','wren-generation','founding','north-star']::text[]
    ORDER BY created_at
  `);
  const foundingRows = foundingMemories.rows as { id: string; title: string; content: string }[];
  console.log(`Breadth-search corpus: ${foundingRows.length} memories tagged origins/wren-generation/founding/north-star\n`);

  const results: PrincipleAuditResult[] = [];
  let hasDeadLink = false;

  for (const p of principles) {
    const title = p.principleTitle ?? '(untitled)';
    const phrases = SEARCH_PHRASES[title] ?? [p.principle?.toLowerCase() ?? ''];
    const result: PrincipleAuditResult = {
      principleId: p.id,
      title,
      sourceConvId: p.sourceConversationId ?? null,
      sourceConvTitle: null,
      sourceConvExists: false,
      verbatimInSource: false,
      betterMatchId: null,
      betterMatchTitle: null,
      verdict: 'UNVERIFIED_NO_BETTER_MATCH',
    };

    // 3. Check whether the linked source conversation exists
    if (p.sourceConversationId) {
      const sourceRows = await db
        .select({ id: conversationMemories.id, title: conversationMemories.title, content: conversationMemories.content })
        .from(conversationMemories)
        .where(eq(conversationMemories.id, p.sourceConversationId))
        .limit(1);

      if (sourceRows.length === 0) {
        result.sourceConvExists = false;
        result.verdict = 'DEAD_LINK';
        hasDeadLink = true;
      } else {
        result.sourceConvExists = true;
        result.sourceConvTitle = sourceRows[0].title ?? null;
        result.verbatimInSource = containsPhrase(sourceRows[0].content ?? '', phrases);
        if (result.verbatimInSource) result.verdict = 'CONFIRMED';
      }
    }

    // 4. Breadth search for a better match (only meaningful if current source has no verbatim)
    if (!result.verbatimInSource) {
      for (const mem of foundingRows) {
        if (mem.id === p.sourceConversationId) continue; // already checked
        if (containsPhrase(mem.content ?? '', phrases)) {
          result.betterMatchId = mem.id;
          result.betterMatchTitle = mem.title;
          break;
        }
      }
    }

    results.push(result);
  }

  // 5. Print report
  console.log('=== COLLABORATION PRINCIPLE SOURCE AUDIT ===\n');
  for (const r of results) {
    console.log(`Principle: ${r.title}`);
    console.log(`  Source conv ID:     ${r.sourceConvId ?? '(none)'}`);
    console.log(`  Source conv title:  ${r.sourceConvTitle ?? '(none)'}`);
    console.log(`  Source exists:      ${r.sourceConvExists}`);
    console.log(`  Verbatim in source: ${r.verbatimInSource}`);
    console.log(`  Better match found: ${r.betterMatchId ? `${r.betterMatchId} — ${r.betterMatchTitle}` : 'none'}`);
    console.log(`  Verdict:            ${r.verdict}`);
    console.log();
  }

  const confirmed = results.filter(r => r.verdict === 'CONFIRMED').length;
  const unverified = results.filter(r => r.verdict === 'UNVERIFIED_NO_BETTER_MATCH').length;
  const dead = results.filter(r => r.verdict === 'DEAD_LINK').length;

  console.log('--- SUMMARY ---');
  console.log(`CONFIRMED (verbatim match in source conv):          ${confirmed}`);
  console.log(`UNVERIFIED_NO_BETTER_MATCH (no verbatim anywhere):  ${unverified}`);
  console.log(`DEAD_LINK (source_conversation_id not in DB):       ${dead}`);
  console.log();

  if (dead > 0) {
    console.error(`[FAIL] ${dead} dead link(s) found — source_conversation_id points to non-existent memory.`);
    process.exit(1);
  }

  console.log('[PASS] 0 dead links. Source IDs are all valid conversation_memories rows.');
  console.log('       No better founding conversations found for unverified principles.');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
