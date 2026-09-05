/**
 * Seeds a single shared dev/test account that agents (Claude Code, teammate
 * sessions, CI) log into via the real password-auth API instead of relying
 * on DEV_AUTH_BYPASS -- see server/middleware/rbac.ts's isDevBypass()
 * removal. Deliberately NOT the founder's real account: a distinct id so a
 * leaked/rotated test credential can never touch the founder's real row.
 *
 * DEV_TEST_ACCOUNT_ID is referenced directly (not looked up) by the
 * dev-only founder allow-list in server/middleware/rbac.ts -- if this id
 * ever changes, that constant must change too.
 */
import type { Pool } from '@neondatabase/serverless';
import bcrypt from 'bcrypt';
import type { DataOpResult } from '../run-data-ops';

export const DEV_TEST_ACCOUNT_ID = 'dev-test-agent';
const EMAIL = 'dev-test-agent@holahola.internal';
const SALT_ROUNDS = 12; // matches server/services/password-auth-service.ts

export async function run(pool: Pool): Promise<DataOpResult> {
  const existing = await pool.query('SELECT 1 FROM users WHERE id = $1', [DEV_TEST_ACCOUNT_ID]);
  if (existing.rows.length > 0) {
    return { applied: false, detail: `${DEV_TEST_ACCOUNT_ID} already exists` };
  }

  const password = process.env.DEV_TEST_ACCOUNT_PASSWORD;
  if (!password) {
    throw new Error('DEV_TEST_ACCOUNT_PASSWORD must be set to seed the dev/test account');
  }
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO users (id, email, first_name, last_name, role, auth_provider, is_test_account)
       VALUES ($1, $2, $3, $4, 'admin', 'password', true)
       ON CONFLICT (id) DO NOTHING`,
      [DEV_TEST_ACCOUNT_ID, EMAIL, 'Dev', 'Test Agent'],
    );
    await client.query(
      `INSERT INTO user_credentials (user_id, password_hash)
       VALUES ($1, $2)`,
      [DEV_TEST_ACCOUNT_ID, passwordHash],
    );
    await client.query('COMMIT');
    return { applied: true, detail: `created ${DEV_TEST_ACCOUNT_ID} (${EMAIL})` };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
