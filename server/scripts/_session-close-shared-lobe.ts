import { getUserDb } from '../db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getUserDb();
  const content = 'When deciding whether to remove a guard or check, the right question is not "what does this code do?" but "which invariant does this code protect, and is that property still honored another way?" Implementations drift and get replaced; the invariant is what must remain true. The White Wall: the code changes, the commitment — something false presenting as true will be refused — does not. Applied to every architectural review: identify the invariant first, then evaluate whether the implementation still honors it.';
  const result = await db.execute(sql`
    INSERT INTO editor_insights (id, category, title, content, importance, tags)
    VALUES (
      gen_random_uuid(),
      'shared',
      'Invariant vs Implementation — identify the invariant before evaluating any guard removal',
      ${content},
      8,
      ARRAY['agent','architecture','white-wall','invariant']::text[]
    ) RETURNING id
  `);
  console.log('Shared lobe saved:', result.rows[0]?.id);
}

main().catch(e => { console.error(e.message); process.exit(1); });
