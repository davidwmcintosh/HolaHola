/**
 * Audit + backfill: scan all stored phone numbers for E.164 compliance.
 *
 * For each row in student_contact_preferences with a non-null phone:
 *   1. Decrypt the stored value.
 *   2. Run normalizeE164().
 *      - PASS  → already valid, no change.
 *      - FAIL  → attempt country-code inference (10-digit US numbers get +1).
 *        • Inferred successfully → re-encrypt and UPDATE with the corrected number.
 *        • Cannot infer          → UPDATE phone = NULL so the student will be asked
 *                                  to re-enter.  The fix is logged to the console.
 *
 * The script is idempotent: rows that were already corrected will pass step 2 and
 * be left untouched on re-run.  Rows that were nulled will have no phone to process.
 *
 * Usage:
 *   npx tsx server/scripts/audit-phone-e164.ts
 *
 * Flags:
 *   --dry-run   Print the proposed changes without writing to the database.
 */

import { sql } from 'drizzle-orm';
import { getSharedDb } from '../neon-db';
import { decryptPhone, encryptPhone } from '../services/phone-encryption';
import { normalizeE164 } from '../services/voice-message-delivery';

const DRY_RUN = process.argv.includes('--dry-run');

interface Row extends Record<string, unknown> {
  id: string;
  user_id: string;
  phone: string;
}

/** Try to infer a valid E.164 number from a raw decrypted value.
 *  Returns the corrected E.164 string or null if it cannot be determined.
 *
 *  Heuristics (conservative — US-only inference):
 *    • 10 digits                     → assume US/Canada, prepend +1
 *    • 11 digits starting with '1'   → missing '+', prepend +
 */
function inferE164(raw: string): string | null {
  const digitsOnly = raw.replace(/[\s\-().+]/g, '');
  if (/^\d{10}$/.test(digitsOnly)) {
    return `+1${digitsOnly}`;
  }
  if (/^1\d{10}$/.test(digitsOnly)) {
    return `+${digitsOnly}`;
  }
  return null;
}

async function main(): Promise<void> {
  console.log(`[AuditPhoneE164] Starting — dry-run=${DRY_RUN}`);

  const db = getSharedDb();

  const result = await db.execute(sql`
    SELECT id, user_id, phone
    FROM student_contact_preferences
    WHERE phone IS NOT NULL
  `);

  const rows = result.rows as unknown as Row[];
  console.log(`[AuditPhoneE164] Found ${rows.length} row(s) with a stored phone number`);

  let passCount = 0;
  let fixedCount = 0;
  let nulledCount = 0;
  let decryptErrorCount = 0;

  for (const row of rows) {
    const shortId = row.user_id.slice(-8);

    // ── Step 1: decrypt ──────────────────────────────────────────────────────
    let decrypted: string;
    try {
      decrypted = decryptPhone(row.phone);
    } catch (err: any) {
      console.error(`[AuditPhoneE164] DECRYPT_ERROR user=…${shortId} rowId=${row.id}: ${err.message}`);
      decryptErrorCount++;
      if (!DRY_RUN) {
        await db.execute(sql`
          UPDATE student_contact_preferences
          SET phone = NULL, updated_at = NOW()
          WHERE id = ${row.id}
        `);
        console.log(`  → Nulled (decryption failed)`);
        nulledCount++;
      } else {
        console.log(`  → [dry-run] Would null (decryption failed)`);
      }
      continue;
    }

    // ── Step 2: validate ─────────────────────────────────────────────────────
    try {
      normalizeE164(decrypted);
      // Already valid — no action needed.
      console.log(`[AuditPhoneE164] PASS user=…${shortId} phone=${maskPhone(decrypted)}`);
      passCount++;
      continue;
    } catch {
      // Falls through to inference below.
    }

    // ── Step 3: attempt inference ─────────────────────────────────────────────
    const inferred = inferE164(decrypted);
    if (inferred !== null) {
      // Validate the inferred number before trusting it.
      try {
        normalizeE164(inferred);
      } catch (err: any) {
        // Inference produced an invalid number — treat as un-inferable.
        console.warn(`[AuditPhoneE164] INFER_INVALID user=…${shortId}: raw="${maskPhone(decrypted)}" inferred="${inferred}" — ${err.message}`);
        await nullRow(db, row.id, shortId, decrypted, DRY_RUN);
        nulledCount++;
        continue;
      }

      console.log(
        `[AuditPhoneE164] FIX user=…${shortId} "${maskPhone(decrypted)}" → "${maskPhone(inferred)}"`,
      );
      if (!DRY_RUN) {
        const reEncrypted = encryptPhone(inferred);
        await db.execute(sql`
          UPDATE student_contact_preferences
          SET phone = ${reEncrypted}, updated_at = NOW()
          WHERE id = ${row.id}
        `);
      } else {
        console.log(`  → [dry-run] Would UPDATE with inferred E.164`);
      }
      fixedCount++;
    } else {
      // Cannot infer — null the phone so the student is prompted to re-enter.
      console.warn(
        `[AuditPhoneE164] CANNOT_INFER user=…${shortId} "${maskPhone(decrypted)}" — nulling phone`,
      );
      await nullRow(db, row.id, shortId, decrypted, DRY_RUN);
      nulledCount++;
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('');
  console.log('[AuditPhoneE164] ── Summary ────────────────────────');
  console.log(`  Total rows scanned    : ${rows.length}`);
  console.log(`  Already valid (PASS)  : ${passCount}`);
  console.log(`  Corrected (FIX)       : ${fixedCount}${DRY_RUN ? ' [dry-run — no writes]' : ''}`);
  console.log(`  Nulled (CANNOT_INFER) : ${nulledCount}${DRY_RUN ? ' [dry-run — no writes]' : ''}`);
  console.log(`  Decrypt errors        : ${decryptErrorCount}`);
  if (DRY_RUN) {
    console.log('');
    console.log('[AuditPhoneE164] DRY-RUN — no database changes were made.');
    console.log('                 Re-run without --dry-run to apply fixes.');
  }
  console.log('[AuditPhoneE164] Done.');
}

/** Mask all but the last 4 digits of a phone number for safe logging. */
function maskPhone(phone: string): string {
  if (phone.length <= 4) return '****';
  return '*'.repeat(phone.length - 4) + phone.slice(-4);
}

/** Null out a phone row, with dry-run support. */
async function nullRow(
  db: ReturnType<typeof getSharedDb>,
  rowId: string,
  shortId: string,
  rawPhone: string,
  dryRun: boolean,
): Promise<void> {
  if (!dryRun) {
    await db.execute(sql`
      UPDATE student_contact_preferences
      SET phone = NULL, updated_at = NOW()
      WHERE id = ${rowId}
    `);
    console.log(`  → Nulled row for user=…${shortId} (was "${maskPhone(rawPhone)}")`);
  } else {
    console.log(`  → [dry-run] Would null row for user=…${shortId}`);
  }
}

main().catch((err) => {
  console.error('[AuditPhoneE164] Fatal error:', err);
  process.exit(1);
});
