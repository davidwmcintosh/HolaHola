/**
 * Outbound consent guard.
 *
 * Every outbound send path (SMS, voice call, or any future channel) MUST call
 * canContactStudent() before firing. If it returns false, abort silently and log.
 *
 * This is the single enforcement point for student opt-out AND active-account status:
 *  - No phone number on file             → false
 *  - Relevant consent flag is false      → false (covers explicit withdrawal)
 *  - No active subscription or credits   → false (don't contact churned users)
 *  - All checks pass                     → true
 */

import { storage } from '../storage';
import { usageService } from './usage-service';

/**
 * Returns true only when:
 *  1. The student has a phone number on file
 *  2. They have granted consent for the requested channel
 *  3. They have an active account (credits remaining OR admin/developer bypass)
 *
 * @param userId  The student's user ID
 * @param channel 'sms' | 'voice'
 */
export async function canContactStudent(
  userId: string,
  channel: 'sms' | 'voice',
): Promise<boolean> {
  // ── 1. Phone + consent ──────────────────────────────────────────────────
  const prefs = await storage.getContactPreferences(userId);
  if (!prefs?.phone) return false;

  let consentOk = false;
  if (channel === 'sms')   consentOk = prefs.phoneConsentSms === true;
  if (channel === 'voice') consentOk = prefs.phoneConsentVoice === true;
  if (!consentOk) return false;

  // ── 2. Active account guard ──────────────────────────────────────────────
  // Don't call or text users who have churned (zero credits, no active sub).
  // checkSufficientCredits already handles admin/developer bypass gracefully.
  try {
    const creditCheck = await usageService.checkSufficientCredits(userId);
    if (!creditCheck.allowed) {
      console.log(
        `[OutboundConsent] Skipping ${channel} for user ${userId.slice(-6)} — ` +
        `no active account (${creditCheck.message ?? 'insufficient credits'})`,
      );
      return false;
    }
  } catch (err: unknown) {
    // If the credit check itself errors, fail open for SMS/voice (don't block
    // on infra issues), but log loudly so we can investigate.
    console.error(
      `[OutboundConsent] Credit check failed for user ${userId.slice(-6)} — ` +
      `allowing outreach to avoid false blocks:`,
      err instanceof Error ? err.message : String(err),
    );
  }

  return true;
}
