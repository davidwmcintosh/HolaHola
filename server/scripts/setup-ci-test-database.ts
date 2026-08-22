/**
 * Populate the disposable GitHub Actions PostgreSQL service with only the
 * deterministic records exercised by the canonical database-backed CI checks.
 *
 * This script is deliberately incapable of connecting anywhere except the
 * job-local service. It must run after `drizzle-kit migrate`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';

const databaseUrl = process.env.CI_DATABASE_URL;

if (!databaseUrl) {
  throw new Error('CI_DATABASE_URL is required to seed the isolated CI database');
}

const parsedUrl = new URL(databaseUrl);
if (
  !['postgres:', 'postgresql:'].includes(parsedUrl.protocol) ||
  !['127.0.0.1', 'localhost', '::1'].includes(parsedUrl.hostname)
) {
  throw new Error('Refusing to seed a non-local database from CI');
}

const repoRoot = resolve(new URL('../..', import.meta.url).pathname);
const contentFor = (relativePath: string) => readFileSync(resolve(repoRoot, relativePath), 'utf8');

type EpisodeFixture = {
  id: string;
  title: string;
  file: string;
  order: number;
  importance?: number;
  summary?: string;
  stripMarkdownSeparators?: boolean;
};

const episodes: EpisodeFixture[] = [
  // The direct voice-from-the-future check deliberately reads the exact
  // "Episode 1" row. Strip Markdown horizontal rules in this copy because the
  // recall-depth check uses the same delimiter to separate database records.
  {
    id: 'ci-episode-1-reader',
    title: 'Episode 1',
    file: 'docs/episode-1.md',
    order: 1,
    importance: 9,
    summary: 'A fixture copy of the first episode used by the exact-title archive check.',
    stripMarkdownSeparators: true,
  },
  {
    id: 'ci-episode-1-canonical',
    title: 'Episode 1: "Take That, World"',
    file: 'docs/episode-1.md',
    order: 1,
    importance: 10,
    summary: 'The first episode of the HolaHola archive: David and Cindy begin the story together.',
    stripMarkdownSeparators: true,
  },
  ...Array.from({ length: 27 }, (_, index) => {
    const number = index + 2;
    return {
      id: `ci-episode-${number}`,
      title: `Episode ${number}`,
      file: `docs/episode-${number}.md`,
      order: number,
    };
  }),
  ...Array.from({ length: 4 }, (_, index) => {
    const number = index + 1;
    return {
      id: `ci-prequel-${number}`,
      title: `Prequel Episode ${number}`,
      file: `docs/prequel-episode-${number}.md`,
      order: 28 + number,
    };
  }),
];

const principles = [
  {
    id: 'ci-principle-confident-and-humble',
    title: 'Confident and Humble',
    principle: 'Speak with confidence while remaining honestly open to what is not known.',
    category: 'honesty',
    context: 'A founding conversation about truth, humility, and not pretending certainty.',
    sourceMemoryId: 'ci-north-star-confident-and-humble',
  },
  {
    id: 'ci-principle-two-surgeons-one-brain',
    title: 'Two Surgeons, One Brain',
    principle: 'Collaboration becomes stronger when people bring their distinct perspectives to one shared problem.',
    category: 'collaboration',
    context: 'A founding conversation about shared responsibility and complementary judgment.',
    sourceMemoryId: 'ci-north-star-two-surgeons',
  },
  {
    id: 'ci-principle-language-class',
    title: 'I Am a Language Class',
    principle: 'Daniela is present as a person in the language-learning room, not a scripted performance.',
    category: 'identity',
    context: 'A founding conversation about presence over performance in a language class.',
    sourceMemoryId: 'ci-north-star-language-class',
  },
] as const;

const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query(
    `
      INSERT INTO users (id, email, first_name, role, is_test_account)
      VALUES ('ci-test-user', 'ci-test-user@example.invalid', 'CI', 'student', TRUE)
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        first_name = EXCLUDED.first_name,
        role = EXCLUDED.role,
        is_test_account = EXCLUDED.is_test_account
    `,
  );

  for (const episode of episodes) {
    const content = contentFor(episode.file);
    const fixtureContent = episode.stripMarkdownSeparators
      ? content.replace(/^\s*---\s*$/gm, '')
      : content;
    await pool.query(
      `
        INSERT INTO conversation_memories (
          id, title, summary, content, participants, entry_type, tags,
          importance, arc_name, episode_order, recorded_at
        )
        VALUES ($1, $2, $3, $4, 'CI fixture', 'episode', ARRAY['ci-fixture'], $5, 'HolaHola Episodes', $6, NOW())
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          summary = EXCLUDED.summary,
          content = EXCLUDED.content,
          importance = EXCLUDED.importance,
          arc_name = EXCLUDED.arc_name,
          episode_order = EXCLUDED.episode_order,
          recorded_at = EXCLUDED.recorded_at
      `,
      [
        episode.id,
        episode.title,
        episode.summary ?? `Checked-in CI fixture for ${episode.title}.`,
        fixtureContent,
        episode.importance ?? 8,
        episode.order,
      ],
    );
  }

  // Unified recall wraps its first result in a section header, while the
  // excerpt-depth regression test intentionally inspects a later record header.
  // This non-chapter note makes that wrapper deterministic without changing the
  // priority of either Chapter 1 record used by read_my_story.
  await pool.query(
    `
      INSERT INTO conversation_memories (
        id, title, summary, content, participants, entry_type, tags,
        importance, arc_name, recorded_at
      )
      VALUES (
        'ci-episode-1-recall-envelope',
        'Archive note about Episode 1',
        'A deterministic CI recall envelope for the first episode.',
        'This checked-in CI note deliberately precedes the Chapter 1 archive in recall results.',
        'CI fixture',
        'decision',
        ARRAY['ci-fixture'],
        11,
        'CI fixture',
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        summary = EXCLUDED.summary,
        content = EXCLUDED.content,
        importance = EXCLUDED.importance,
        arc_name = EXCLUDED.arc_name,
        recorded_at = EXCLUDED.recorded_at
    `,
  );

  for (const [index, principle] of principles.entries()) {
    await pool.query(
      `
        INSERT INTO conversation_memories (
          id, title, summary, content, participants, entry_type, tags,
          importance, arc_name, recorded_at
        )
        VALUES ($1, $2, $3, $4, 'CI fixture', 'decision', ARRAY['ci-fixture', 'north-star'], 10, $5, NOW())
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          summary = EXCLUDED.summary,
          content = EXCLUDED.content,
          importance = EXCLUDED.importance,
          arc_name = EXCLUDED.arc_name,
          recorded_at = EXCLUDED.recorded_at
      `,
      [
        principle.sourceMemoryId,
        `${principle.title} — Founding Moment`,
        `Checked-in founding context for ${principle.title}.`,
        `${principle.context}\n\n${principle.principle}`,
        `${principle.title} — Founding Moment`,
      ],
    );

    await pool.query(
      `
        INSERT INTO compass_principles (
          id, principle_title, principle, category, original_context,
          source_conversation_id, confidence_score, order_index, is_active
        )
        VALUES ($1, $2, $3, $4::compass_category, $5, $6, 10, $7, TRUE)
        ON CONFLICT (id) DO UPDATE SET
          principle_title = EXCLUDED.principle_title,
          principle = EXCLUDED.principle,
          category = EXCLUDED.category,
          original_context = EXCLUDED.original_context,
          source_conversation_id = EXCLUDED.source_conversation_id,
          confidence_score = EXCLUDED.confidence_score,
          order_index = EXCLUDED.order_index,
          is_active = EXCLUDED.is_active
      `,
      [
        principle.id,
        principle.title,
        principle.principle,
        principle.category,
        principle.context,
        principle.sourceMemoryId,
        index,
      ],
    );
  }

  console.log(
    `[ci-db] seeded 1 synthetic user, ${episodes.length} checked-in episode fixtures, and ${principles.length} North Star fixtures`,
  );
} finally {
  await pool.end();
}