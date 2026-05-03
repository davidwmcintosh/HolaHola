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

import { createHmac, randomBytes } from 'crypto';
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
 * Returns true if the call was successfully initiated, false on any failure.
 */
async function initiateCall(userId: string, queueId: string): Promise<boolean> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    console.warn('[VoiceCallSender] Twilio credentials not configured — call skipped');
    return false;
  }

  const prefs = await storage.getContactPreferences(userId);
  if (!prefs?.phone) {
    console.warn(`[VoiceCallSender] No phone number for user ${userId.slice(-6)}`);
    return false;
  }

  // getContactPreferences() already decrypts the phone — use it directly
  const phone = prefs.phone;

  const appUrl = APP_URL;
  const answerUrl = `${appUrl}/api/webhooks/twilio/voice-answer?queueId=${encodeURIComponent(queueId)}&userId=${encodeURIComponent(userId)}`;
  const statusUrl = `${appUrl}/api/webhooks/twilio/voice-status?queueId=${encodeURIComponent(queueId)}&userId=${encodeURIComponent(userId)}`;
  const recordingCallbackUrl = `${appUrl}/api/webhooks/twilio/recording-complete?queueId=${encodeURIComponent(queueId)}&userId=${encodeURIComponent(userId)}`;
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

  try {
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
          // 'completed' covers answered+hung-up, no-answer, busy, and failed
          // as the CallStatus field on the completed callback
          StatusCallbackEvent: 'completed',
          // Synchronous AMD: Twilio detects human vs machine before calling the TwiML URL.
          // AnsweredBy is included in the voice-answer POST body — the webhook can return
          // <Hangup/> for machines before any stream is established, preventing Daniela
          // from speaking into voicemail.
          MachineDetection: 'Enable',
          // Record the full call for quality review and transcription.
          // Twilio REST API uses Record=true (boolean) to enable recording from answer.
          Record: 'true',
          RecordingStatusCallback: recordingCallbackUrl,
          RecordingStatusCallbackMethod: 'POST',
        }).toString(),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(`[VoiceCallSender] Twilio API error ${response.status}:`, text.slice(0, 200));
      return false;
    }

    const json = (await response.json()) as { sid: string };
    const callSid = json.sid;
    console.log(`[VoiceCallSender] Call initiated — SID: ${callSid}, user: ${userId.slice(-6)}`);

    const db = getSharedDb();
    await db
      .update(danielaOutboundQueue)
      .set({ callSid, callAt: new Date() })
      .where(eq(danielaOutboundQueue.id, queueId));

    return true;
  } catch (err: unknown) {
    console.error(
      '[VoiceCallSender] initiateCall error:',
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
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
      const callPlaced = await initiateCall(userId, queueId);
      if (callPlaced) return;
      // Call initiation failed — fall through to SMS
      console.log(
        `[VoiceCallSender] Call initiation failed — falling back to SMS for user ${userId.slice(-6)}`,
      );
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
