/**
 * Auth replacement Phase 9 (founder migration): flips the founder's own
 * account from authProvider 'replit' to 'google', now that they've verified
 * a real Google login resolves to this same account (id '49847136') by
 * email -- storage.upsertUser deliberately never overwrites an existing
 * authProvider on its own (see server/services/oauth-account-linking.ts),
 * so this one-time, reviewed flip is the intentional way to complete it.
 */
import type { Pool } from '@neondatabase/serverless';
import type { DataOpResult } from '../run-data-ops';

const FOUNDER_USER_ID = '49847136';

export async function run(pool: Pool): Promise<DataOpResult> {
  const existing = await pool.query('SELECT auth_provider FROM users WHERE id = $1', [FOUNDER_USER_ID]);
  if (existing.rows.length === 0) {
    return { applied: false, detail: `no user row with id ${FOUNDER_USER_ID}` };
  }
  if (existing.rows[0].auth_provider !== 'replit') {
    return { applied: false, detail: `already ${existing.rows[0].auth_provider}, nothing to do` };
  }

  await pool.query(
    `UPDATE users SET auth_provider = 'google', updated_at = now() WHERE id = $1 AND auth_provider = 'replit'`,
    [FOUNDER_USER_ID],
  );

  return { applied: true, detail: `flipped ${FOUNDER_USER_ID} from replit to google` };
}
