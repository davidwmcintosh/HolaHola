/**
 * Voice Call Sender
 *
 * Orchestrates outbound Daniela → Student delivery with consent-aware fallback:
 *   1. phoneConsentVoice → Twilio outbound VoIP call (Phase 4)
 *   2. phoneConsentSms   → SMS + rendered voice note (Phase 3)
 *   3. neither           → stays in session-start queue (Phase 1)
 *
 * Called fire-and-forget from leave_for_next_session in native-fc-handlers.ts
 * and streaming-voice-orchestrator.ts.
 */

import { createHmac } from 'crypto';
import { canContactStudent } from './outbound-consent';
import { storage } from '../storage';
import { getSharedDb } from '../db';
import { danielaOutboundQueue } from '@shared/schema';
import { eq } from 'drizzle-orm';

const APP_URL = process.env.APP_URL || 'https://getholahola.com';
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_FROM_NUMBER = (process.env.TWILIO_FROM_NUMBER || '').replace(/[\s\-().]/g, '');

/**
 * Collapse duplicate country-code prefixes that arise when a user enters
 * "16027438228" in a US (+1) field, producing "+116027438228".
 * Works for any country code: strips formatting then checks if the digits
 * after "+" start with a repeated copy of the country prefix.
 * "+116027438228" → "+16027438228"  (US double-1)
 * "+4940123456"   → "+4940123456"   (unchanged, valid DE number)
 */
function normalizeE164(phone: string): string {
  const stripped = phone.replace(/[\s\-().]/g, '');
  if (!stripped.startsWith('+')) return stripped;
  // Try common country code lengths (1–3 digits) longest-first
  for (const len of [3, 2, 1]) {
    const cc = stripped.slice(1, 1 + len);   // e.g. "1" for US
    const rest = stripped.slice(1 + len);     // digits after the code
    if (rest.startsWith(cc)) {
      // Duplicate detected — return without the extra copy
      return '+' + cc + rest.slice(cc.length);
    }
  }
  return stripped;
}

/**
 * Compute a per-call HMAC nonce that the bridge verifies at stream start.
 * Prevents unauthorized actors from triggering Gemini sessions by guessing
 * the WS path.
 */
export function computeCallNonce(userId: string, queueId: string): string {
  if (!TWILIO_AUTH_TOKEN && process.env.NODE_ENV === 'production') {
    console.error('[VoiceCallSender] TWILIO_AUTH_TOKEN not set — nonce is insecure in production');
  }
  const secret = TWILIO_AUTH_TOKEN || 'dev-nonce-secret';
  return createHmac('sha256', secret).update(`${userId}:${queueId}`).digest('hex').slice(0, 32);
}

/**
 * Place an outbound Twilio call to the student.
 * Returns the CallSID on success, or throws with a human-readable message on failure.
 * Use this directly from admin routes that need to bypass consent checks.
 */
export async function initiateCall(userId: string, queueId: string): Promise<string> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    throw new Error('Twilio credentials not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER must all be set)');
  }

  const prefs = await storage.getContactPreferences(userId);
  if (!prefs?.phone) {
    throw new Error(`No phone number on file for user ${userId.slice(-6)}`);
  }

  // getContactPreferences() already decrypts the phone — normalize to valid E.164
  // Guard against double country-code entries like +116027438228 → +16027438228
  const phone = normalizeE164(prefs.phone);

  const appUrl = APP_URL;
  const answerUrl = `${appUrl}/api/webhooks/twilio/voice-answer?queueId=${encodeURIComponent(queueId)}&userId=${encodeURIComponent(userId)}`;
  const statusUrl = `${appUrl}/api/webhooks/twilio/voice-status?queueId=${encodeURIComponent(queueId)}&userId=${encodeURIComponent(userId)}`;
  const recordingCallbackUrl = `${appUrl}/api/webhooks/twilio/recording-complete?queueId=${encodeURIComponent(queueId)}&userId=${encodeURIComponent(userId)}`;
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: phone,
        From: TWILIO_FROM_NUMBER,
        Url: answerUrl,
        StatusCallback: statusUrl,
        StatusCallbackMethod: 'POST',
        StatusCallbackEvent: 'completed',
        MachineDetection: 'Enable',
        Record: 'true',
        RecordingStatusCallback: recordingCallbackUrl,
        RecordingStatusCallbackMethod: 'POST',
      }).toString(),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    console.error(`[VoiceCallSender] Twilio API error ${response.status}:`, text.slice(0, 500));
    // Extract Twilio's human-readable message if available
    let twilioMsg = `Twilio ${response.status}`;
    try {
      const body = JSON.parse(text);
      if (body.message) twilioMsg = `Twilio error: ${body.message}`;
    } catch { /* ignore parse errors */ }
    throw new Error(twilioMsg);
  }

  const json = (await response.json()) as { sid: string };
  const callSid = json.sid;
  console.log(`[VoiceCallSender] Call initiated — SID: ${callSid}, to: ${phone}, user: ${userId.slice(-6)}`);

  const db = getSharedDb();
  await db
    .update(danielaOutboundQueue)
    .set({ callSid, callAt: new Date() })
    .where(eq(danielaOutboundQueue.id, queueId));

  return callSid;
}

/**
 * Main entry — checks consent and initiates appropriate delivery.
 * Should be called fire-and-forget after leave_for_next_session creates a queue item.
 *
 * Priority order:
 *  1. VoIP call (phoneConsentVoice) — falls through to SMS if call initiation fails
 *  2. SMS voice note (phoneConsentSms)
 *  3. Session-start queue (no consent, already queued)
 */
export async function initiateOutboundContact(
  userId: string,
  queueId: string,
  content: string,
): Promise<void> {
  try {
    const voiceOk = await canContactStudent(userId, 'voice');
    if (voiceOk) {
      console.log(`[VoiceCallSender] Voice consent ✓ — initiating call for user ${userId.slice(-6)}`);
      try {
        await initiateCall(userId, queueId);
        return;
      } catch (callErr: unknown) {
        // Call initiation failed — fall through to SMS
        console.log(
          `[VoiceCallSender] Call initiation failed — falling back to SMS for user ${userId.slice(-6)}:`,
          callErr instanceof Error ? callErr.message : String(callErr),
        );
      }
    }

    const smsOk = await canContactStudent(userId, 'sms');
    if (smsOk) {
      console.log(`[VoiceCallSender] SMS consent ✓ — delivering via SMS for user ${userId.slice(-6)}`);
      const { deliverVoiceMessageViaSms } = await import('./voice-message-delivery');
      await deliverVoiceMessageViaSms(queueId, userId, content);
      return;
    }

    console.log(
      `[VoiceCallSender] No outbound consent for user ${userId.slice(-6)} — message stays in queue`,
    );
  } catch (err: unknown) {
    console.error(
      '[VoiceCallSender] initiateOutboundContact error:',
      err instanceof Error ? err.message : String(err),
    );
  }
}
