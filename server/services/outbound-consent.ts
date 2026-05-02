/**
 * Outbound consent guard.
 *
 * Every outbound send path (SMS, voice call, or any future channel) MUST call
 * canContactStudent() before firing. If it returns false, abort silently and log.
 *
 * This is the single enforcement point for student opt-out:
 *  - No phone number on file        → false
 *  - Relevant consent flag is false  → false (covers explicit withdrawal)
 *  - Both conditions met             → true
 */

import { storage } from '../storage';

/**
 * Returns true only when the student has a phone number on file and has granted
 * consent for the requested channel. Withdrawing consent or removing the phone
 * number immediately prevents future sends.
 *
 * @param userId  The student's user ID
 * @param channel 'sms' | 'voice'
 */
export async function canContactStudent(
  userId: string,
  channel: 'sms' | 'voice',
): Promise<boolean> {
  const prefs = await storage.getContactPreferences(userId);
  if (!prefs?.phone) return false;
  if (channel === 'sms') return prefs.phoneConsentSms === true;
  if (channel === 'voice') return prefs.phoneConsentVoice === true;
  return false;
}
