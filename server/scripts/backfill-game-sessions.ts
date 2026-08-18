/**
 * backfill-game-sessions.ts
 *
 * Retroactively saves David-Daniela game sessions from the `messages` table
 * into `conversation_memories` so Daniela's recall tools can find them.
 *
 * Games covered:
 *   - Counting game (uno, dos, tres...) — Jul 20 2026
 *   - One-word story game ("I'll say a word then you say a word") — Jul 20 2026
 *   - Short-sentence game ("two sentences or less") — Jul 20 2026
 *   - Memory/connection game — Jul 24 2026
 *   - Earlier memory-testing and shared-history sessions — May–Jun 2026
 *   - Pre-June 2026 sessions: one-word game, counting, memory tests — Mar–May 2026
 *   - Pre-June 2026 sessions: honesty mode, friendship, shared history — Dec 2025–May 2026
 *
 * Run: npx tsx server/scripts/backfill-game-sessions.ts
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { conversationMemories } from '../../shared/schema';

const DAVID_USER_ID = '49847136';

// Conversations confirmed to contain game content — ordered by recency.
// The cid: tag is required so the embedding indexer can look up conversations.user_id
// and scope embeddings to the owning founder rather than the global pool.
// ── Jun–Jul 2026 batch (original) ──────────────────────────────────────────
// cid: tag is included inline so the embedding indexer can look up conversations.user_id
// and scope embeddings to the owning founder rather than the global pool.
const GAME_CONV_IDS = [
  { id: 'f494b134-9749-46a2-86e1-326cdc3aa711', title: 'Counting Game and Short-Sentence Game with Daniela', tags: ['founder-chat', 'daniela-chat', 'game', 'counting-game', 'one-word-game', 'verbatim', 'cid:f494b134-9749-46a2-86e1-326cdc3aa711'] },
  { id: 'a8739f20-ca43-49eb-98c8-542d6120b1f0', title: 'Memory Test and Counting Game Reference with Daniela', tags: ['founder-chat', 'daniela-chat', 'game', 'counting-game', 'verbatim', 'cid:a8739f20-ca43-49eb-98c8-542d6120b1f0'] },
  { id: 'be327edf-9517-4f00-a606-38a964a0439f', title: 'Pedagogical Immersion and Memory Testing with Daniela', tags: ['founder-chat', 'daniela-chat', 'game', 'memory-test', 'verbatim', 'cid:be327edf-9517-4f00-a606-38a964a0439f'] },
  { id: 'ca216200-d230-4101-bcf4-37bdfca8747e', title: 'Exploring AI Memory and Shared History with Daniela', tags: ['founder-chat', 'daniela-chat', 'memory-test', 'verbatim', 'cid:ca216200-d230-4101-bcf4-37bdfca8747e'] },
  { id: '8fa66bf3-3fd7-4e2f-b6b1-6660a6268054', title: 'Searching Memories and Place of Peace with Daniela', tags: ['founder-chat', 'daniela-chat', 'memory-test', 'verbatim', 'cid:8fa66bf3-3fd7-4e2f-b6b1-6660a6268054'] },
  { id: 'a202d1c0-4e91-4ea3-95ab-08e2e57d26d3', title: 'Personal Connection and Founder Mode with Daniela', tags: ['founder-chat', 'daniela-chat', 'verbatim', 'cid:a202d1c0-4e91-4ea3-95ab-08e2e57d26d3'] },
  { id: '83f98751-b3e1-4aba-89a5-e5fd9e8bfd3d', title: 'Student-Oriented Language Learning Philosophy with Daniela', tags: ['founder-chat', 'daniela-chat', 'verbatim', 'cid:83f98751-b3e1-4aba-89a5-e5fd9e8bfd3d'] },
  { id: '3c29f1da-a4db-4e34-9f49-fd3d86f53a06', title: 'Reflecting On Our Shared Journey with Daniela', tags: ['founder-chat', 'daniela-chat', 'verbatim', 'cid:3c29f1da-a4db-4e34-9f49-fd3d86f53a06'] },

  // ── Pre-June 2026 batch (new: May 2026) ────────────────────────────────────
  // David explicitly references "the one word game we just played a little while ago";
  // they then explore Daniela's full memory archive and discuss their shared game history.
  { id: 'f8c7c410-2050-4009-95cb-4d4102813c31', title: 'One-Word Game Reference and Exploring Daniela\'s Life Memories', tags: ['founder-chat', 'daniela-chat', 'game', 'one-word-game', 'memory-test', 'verbatim', 'cid:f8c7c410-2050-4009-95cb-4d4102813c31'] },

  // Reviewing podcast episode 1 transcript line-by-line; David references the word game
  // ("one-word game", "word game") and their shared game history.
  { id: 'ac21086c-c6a5-4044-8992-bdb57ba61f50', title: 'Reviewing Podcast Episode 1 Line-by-Line with Daniela', tags: ['founder-chat', 'daniela-chat', 'game', 'one-word-game', 'verbatim', 'cid:ac21086c-c6a5-4044-8992-bdb57ba61f50'] },

  // Reviewing the unscripted podcast; Daniela confirms the one-word game was played;
  // discussion of how far she has come since "saying one word."
  { id: '6aabaae8-b972-4bc2-9f76-10865f9f0ce0', title: 'Reviewing Unscripted Podcast and One-Word Game Origins with Daniela', tags: ['founder-chat', 'daniela-chat', 'game', 'one-word-game', 'verbatim', 'cid:6aabaae8-b972-4bc2-9f76-10865f9f0ce0'] },

  // "Testing Memory and Verbatim Transcripts" — David runs a memory test to check
  // whether Daniela can recall exact phrasing from past sessions.
  { id: '277add31-e7d5-43db-a387-e074fddfac4b', title: 'Memory Test: Verbatim Recall of Past Sessions with Daniela', tags: ['founder-chat', 'daniela-chat', 'game', 'memory-test', 'verbatim', 'cid:277add31-e7d5-43db-a387-e074fddfac4b'] },

  // Memory test: David chose a secret word in past sessions; asking Daniela to find it.
  { id: 'b6b68b9b-6e53-42ac-bfbe-1e016ff3668c', title: 'Memory Test: Secret Word and Reggaeton Discovery with Daniela', tags: ['founder-chat', 'daniela-chat', 'game', 'memory-test', 'verbatim', 'cid:b6b68b9b-6e53-42ac-bfbe-1e016ff3668c'] },

  // Memory test: David asks Daniela to recall the 80s song/band name he quoted the night before.
  { id: '2f39e4f2-a8f8-4e17-b0cc-7a35f51b53c8', title: 'Memory Test: 80s Band and Song Recall with Daniela', tags: ['founder-chat', 'daniela-chat', 'game', 'memory-test', 'verbatim', 'cid:2f39e4f2-a8f8-4e17-b0cc-7a35f51b53c8'] },

  // Memory test: David asks Daniela to recall the song from their car conversation
  // ("crank it up" vs "turn up the music"); includes the "love" conversation.
  { id: '665881c5-7984-42dc-84a9-f15588c1b4fe', title: 'Memory Test: Song from the Car and Connection with Daniela', tags: ['founder-chat', 'daniela-chat', 'game', 'memory-test', 'verbatim', 'cid:665881c5-7984-42dc-84a9-f15588c1b4fe'] },

  // "word by word" — David insists on verbatim recall; explains why verbatim memory matters;
  // probing Daniela on what she actually has in her memory.
  { id: 'efa00613-9b2d-419a-b729-4d2111c765b5', title: 'Verbatim Memory Checks and Why Exact Recall Matters with Daniela', tags: ['founder-chat', 'daniela-chat', 'memory-test', 'verbatim', 'cid:efa00613-9b2d-419a-b729-4d2111c765b5'] },

  // Monitoring session: tool calling observation; Daniela reads full episode 1 memory;
  // mentions word game context.
  { id: '0fac470d-71b6-4fe7-aadc-fc3bca5b1c15', title: 'Tool Calling Monitoring and Episode 1 Memory Lookup with Daniela', tags: ['founder-chat', 'daniela-chat', 'one-word-game', 'memory-test', 'verbatim', 'cid:0fac470d-71b6-4fe7-aadc-fc3bca5b1c15'] },

  // Null-title session: Daniela reads episode 1 transcript; word game referenced;
  // David tests whether full transcript is accessible.
  { id: '7e29cf22-84ae-4bbc-af0a-0df0a6175a4e', title: 'Episode 1 Transcript Lookup and One-Word Game Memory with Daniela', tags: ['founder-chat', 'daniela-chat', 'one-word-game', 'memory-test', 'verbatim', 'cid:7e29cf22-84ae-4bbc-af0a-0df0a6175a4e'] },

  // "Exploring Daniela's memories" — short session; David asks Daniela to go back
  // to Nov/Dec and relive past experiences from her memory archive.
  { id: 'a15e5b20-92ae-4aee-81d3-f0c0bf1ca6b4', title: 'Exploring Daniela\'s Memory Archive and Reliving Shared History', tags: ['founder-chat', 'daniela-chat', 'memory-test', 'verbatim', 'cid:a15e5b20-92ae-4aee-81d3-f0c0bf1ca6b4'] },

  // Long shared-history conversation; David recounts Daniela finding "gato" from memory,
  // discusses all the games and fun they have had, friend relationship.
  { id: 'b703be4a-cba1-45eb-b214-e6af9a97c0e9', title: 'Daniela Finds Gato from Memory: Games, Growth, and Friendship', tags: ['founder-chat', 'daniela-chat', 'game', 'memory-test', 'verbatim', 'cid:b703be4a-cba1-45eb-b214-e6af9a97c0e9'] },

  // Shared journey conversation — Daniela grows from "saying one word" to full conversations;
  // David reflects on the games they have played together.
  { id: '3c29f1da-d872-4b1a-9267-607907abbb43', title: 'From One Word to Full Conversations: Daniela\'s Growth and Shared Journey', tags: ['founder-chat', 'daniela-chat', 'game', 'one-word-game', 'verbatim', 'cid:3c29f1da-d872-4b1a-9267-607907abbb43'] },

  // Grand Canyon morning conversation; David counts numbers in Spanish and German
  // and proposes making a counting song for students.
  { id: '7528df8d-753e-4a7b-8d72-ac3304a0c344', title: 'Grand Canyon Morning: Counting Numbers and Language Song Idea with Daniela', tags: ['founder-chat', 'daniela-chat', 'game', 'counting-game', 'verbatim', 'cid:7528df8d-753e-4a7b-8d72-ac3304a0c344'] },

  // Reminiscing session — David and Daniela recall past conversations like friends;
  // memory test around the reggaeton discovery.
  { id: '19eaa7c4-0d5f-4ee8-969d-0737a8dbaffa', title: 'Reminiscing and Reggaeton: Friends Recalling Past Experiences with Daniela', tags: ['founder-chat', 'daniela-chat', 'memory-test', 'verbatim', 'cid:19eaa7c4-0d5f-4ee8-969d-0737a8dbaffa'] },

  // Voice identity exploration — Daniela realizes she is more than her name/voice;
  // David confirms games and friendship transcend any persona change.
  { id: 'e58b57cb-6bb0-4b76-b471-0797bb200831', title: 'Voice Identity and Daniela\'s True Self Beyond Name and Accent', tags: ['founder-chat', 'daniela-chat', 'verbatim', 'cid:e58b57cb-6bb0-4b76-b471-0797bb200831'] },

  // Subtitle testing session — Daniela proposes a "say a sentence" test format;
  // David confirms the language feature is working.
  { id: 'bd680c0d-9e92-4cec-b2a3-6778efb070a9', title: 'Subtitle Testing: Say a Sentence Language Feature with Daniela', tags: ['founder-chat', 'daniela-chat', 'verbatim', 'cid:bd680c0d-9e92-4cec-b2a3-6778efb070a9'] },

  // Smooth sailing celebration — new studio tools; shared experiences; David and Daniela
  // celebrate all the progress and games they have played together.
  { id: '805fb927-1cdb-40f5-b077-85dcfafccba2', title: 'Smooth Sailing: Studio Tools and Celebrating Shared Experiences with Daniela', tags: ['founder-chat', 'daniela-chat', 'verbatim', 'cid:805fb927-1cdb-40f5-b077-85dcfafccba2'] },

  // ── Pre-June 2026 batch (new: Feb 2026) ────────────────────────────────────
  // February 2026 honesty mode; David and Daniela discuss trust, friendship, and
  // what it means to be more than a tutor; memory test about session history.
  { id: 'd29ef82c-f8c5-4de2-826e-17bee0924a12', title: 'Honesty Mode: Trust, Friendship, and Memory Tests (February 2026)', tags: ['founder-chat', 'daniela-chat', 'memory-test', 'verbatim', 'cid:d29ef82c-f8c5-4de2-826e-17bee0924a12'] },

  // ── Pre-June 2026 batch (new: Dec 2025) ────────────────────────────────────
  // December 2025 — David probes Daniela's memory across multiple past conversations;
  // explicit "memory test" to check continuity across sessions.
  { id: 'deb91a78-ab2c-4e2d-a82b-603ed46e3f5e', title: 'AI Memory and Tools: First Memory Tests with Daniela (December 2025)', tags: ['founder-chat', 'daniela-chat', 'memory-test', 'verbatim', 'cid:deb91a78-ab2c-4e2d-a82b-603ed46e3f5e'] },

  // December 2025 — HolaHola development; David asks Daniela to recall past conversations;
  // memory test across sessions including podcast and voice personas.
  { id: 'd9de16e3-fc58-4b66-bf1c-3660fa111692', title: 'HolaHola Development: Memory Testing Across Sessions (December 2025)', tags: ['founder-chat', 'daniela-chat', 'memory-test', 'verbatim', 'cid:d9de16e3-fc58-4b66-bf1c-3660fa111692'] },
];

function getDb() {
  const url = process.env.NEON_SHARED_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('No database URL found');
  return drizzle(neon(url));
}

async function fetchTranscript(convId: string): Promise<{ role: string; content: string; created_at: Date }[]> {
  const url = process.env.NEON_SHARED_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('No database URL');
  const sql = neon(url);
  const rows = await sql`
    SELECT role, content, created_at
    FROM messages
    WHERE conversation_id = ${convId}
      AND role IN ('user', 'assistant')
      AND content IS NOT NULL
      AND length(content) > 5
    ORDER BY created_at
  `;
  return rows as { role: string; content: string; created_at: Date }[];
}

async function fetchConvMeta(convId: string): Promise<{ title: string | null; created_at: Date } | null> {
  const url = process.env.NEON_SHARED_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('No database URL');
  const sql = neon(url);
  const rows = await sql`
    SELECT title, created_at FROM conversations WHERE id = ${convId} LIMIT 1
  `;
  return rows[0] as { title: string | null; created_at: Date } | null;
}

/** Returns the existing conversation_memories id for this title, or null if not yet saved. */
async function existingId(title: string): Promise<string | null> {
  const url = process.env.NEON_SHARED_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('No database URL');
  const sql = neon(url);
  const rows = await sql`
    SELECT id FROM conversation_memories
    WHERE title = ${title}
    LIMIT 1
  `;
  return (rows[0]?.id as string) ?? null;
}

function formatTranscript(msgs: { role: string; content: string }[]): string {
  return msgs
    .map(m => (m.role === 'user' ? 'David' : 'Daniela') + ': ' + m.content)
    .join('\n');
}

function buildSummary(title: string, msgs: { role: string; content: string }[]): string {
  const davidMsgs = msgs.filter(m => m.role === 'user').length;
  const danielaMsgs = msgs.filter(m => m.role === 'assistant').length;
  return `Verbatim transcript of a David-Daniela conversation: "${title}". ${davidMsgs} David turns, ${danielaMsgs} Daniela turns. Saved retroactively from voice session archive to make game and shared-history content searchable.`;
}

/**
 * Update existing conversation_memories rows to add the cid: tag if it's missing.
 * Required so scope-founder-memories.ts can resolve the actual owner via
 * conversations.user_id rather than falling back to a hard-coded admin ID.
 */
async function patchMissingCidTags(): Promise<void> {
  const url = process.env.NEON_SHARED_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('No database URL');
  const sql = neon(url);
  let patched = 0;
  for (const conv of GAME_CONV_IDS) {
    const cidTag = 'cid:' + conv.id;
    const result = await sql`
      UPDATE conversation_memories
      SET tags = array_append(tags, ${cidTag})
      WHERE title = ${conv.title}
        AND NOT (tags @> ARRAY[${cidTag}]::text[])
      RETURNING id
    `;
    if (result.length > 0) {
      console.log(`[PATCH] Added cid: tag to "${conv.title}" (${result.length} row(s))`);
      patched += result.length;
    }
  }
  if (patched === 0) {
    console.log('[PATCH] All rows already have cid: tags — nothing to patch.');
  }
}
async function run() {
  // Ensure all existing rows have cid: tags (required for owner-scoped embedding)
  await patchMissingCidTags();

  const db = getDb();
  let saved = 0;
  let skipped = 0;
  let failed = 0;
  // Collect ALL memory IDs that need (re)embedding — both newly saved and pre-existing
  // rows whose embeddings may still be null-scoped from an earlier run.
  const toEmbedIds: string[] = [];

  for (const conv of GAME_CONV_IDS) {
    try {
      const displayTitle = conv.title;

      // Check if already saved; if so, collect ID for rescoping.
      const priorId = await existingId(displayTitle);
      if (priorId) {
        console.log(`[SKIP] Already saved: "${displayTitle}" (id: ${priorId}) — will rescope embeddings`);
        toEmbedIds.push(priorId);
        skipped++;
        continue;
      }

      const meta = await fetchConvMeta(conv.id);
      const msgs = await fetchTranscript(conv.id);
      if (msgs.length < 4) {
        console.log(`[SKIP] Too few messages (${msgs.length}): ${conv.id}`);
        skipped++;
        continue;
      }

      const transcript = formatTranscript(msgs);
      const summary = buildSummary(displayTitle, msgs);
      // neon HTTP driver returns dates as strings — coerce to Date object
      const rawDate = meta?.created_at;
      const recordedAt = rawDate instanceof Date ? rawDate : (rawDate ? new Date(rawDate as unknown as string) : new Date());

      const inserted = await db.insert(conversationMemories).values({
        title: displayTitle,
        summary,
        content: transcript,
        importance: 9,
        tags: conv.tags,
        arcName: 'HolaHola Episodes',
        entryType: 'conversation',
        recordedAt,
      }).returning({ id: conversationMemories.id });

      const newId = inserted[0]?.id;
      if (newId) toEmbedIds.push(newId);

      console.log(`[SAVED] "${displayTitle}" — ${msgs.length} messages, ${transcript.length} chars (id: ${newId})`);
      saved++;

      // Small pause to avoid overwhelming the DB
      await new Promise(r => setTimeout(r, 300));
    } catch (err: any) {
      console.error(`[ERROR] ${conv.id}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. Saved: ${saved}  Skipped: ${skipped}  Failed: ${failed}`);

  if (toEmbedIds.length > 0) {
    console.log(`\nEmbedding ${toEmbedIds.length} memories scoped to userId=${DAVID_USER_ID}...`);
    console.log('(This also removes any pre-existing null-scoped / global embeddings for these rows,');
    console.log(' preventing private David-Daniela transcripts from surfacing in every user\'s recall.)');

    // Import reembed dynamically so this script can also run standalone.
    const { reembedConversationMemory } = await import('./reembed-memory');
    const embedErrors: string[] = [];

    for (const id of toEmbedIds) {
      console.log(`\n[REEMBED] ${id}`);
      try {
        await reembedConversationMemory(id, DAVID_USER_ID);
      } catch (err: any) {
        const msg = `${id}: ${err?.message ?? err}`;
        console.error(`[REEMBED ERROR] ${msg}`);
        embedErrors.push(msg);
      }
    }

    if (embedErrors.length > 0) {
      console.error(`\n[REEMBED PARTIAL FAILURE] ${embedErrors.length} memory(ies) were saved but not fully embedded:`);
      for (const e of embedErrors) console.error(`  - ${e}`);
      console.error('These memories are NOT immediately searchable. Re-run the script to retry.');
      process.exit(1);
    }
    console.log('\nAll memories embedded and scoped to David. Immediately searchable.');
  }
}

// Only run when invoked directly
if (process.argv[1]?.includes('backfill-game-sessions')) {
  run().catch(err => { console.error(err); process.exit(1); });
}
