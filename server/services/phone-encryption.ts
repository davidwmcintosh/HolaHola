/**
 * Phone number encryption for at-rest storage.
 *
 * Uses AES-256-GCM (authenticated encryption). Phone numbers are sensitive PII
 * and must never be stored in plaintext. All reads/writes go through the helpers
 * below so the DB column is always opaque.
 *
 * Key setup:
 *  - Production: set PHONE_ENCRYPTION_KEY to exactly 64 hex characters (32 bytes).
 *  - Development: a deterministic key is derived from DATABASE_URL so dev restarts
 *    stay consistent without a separate secret.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

function getKey(): Buffer {
  const keyHex = process.env.PHONE_ENCRYPTION_KEY;
  if (keyHex) {
    const buf = Buffer.from(keyHex, 'hex');
    if (buf.length !== 32) {
      throw new Error('PHONE_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)');
    }
    return buf;
  }
  // Derive a stable key from DATABASE_URL — both dev and prod share the same
  // Neon URL so this always produces the same key in both environments.
  const seed = process.env.DATABASE_URL ?? 'holahola-dev-phone-encryption-seed';
  return crypto.createHash('sha256').update(seed).digest();
}

/**
 * Encrypt a phone number (E.164) for database storage.
 * Returns an opaque string: `<ivHex>:<tagHex>:<ciphertextHex>`.
 */
export function encryptPhone(phone: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(phone, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a stored phone string back to E.164 format.
 * Throws if the ciphertext is tampered with (GCM auth failure).
 */
export function decryptPhone(stored: string): string {
  const key = getKey();
  const parts = stored.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted phone format');
  const [ivHex, tagHex, encHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const enc = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
