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

import { canContactStudent } from './outbound-consent';
import { storage } from '../storage';
import { getSharedDb } from '../db';
import { danielaOutboundQueue } from '@shared/schema';
import { eq } from 'drizzle-orm';

const APP_URL = process.env.APP_URL || 'https://getholahola.com';
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER || '';

async function initiateCall(userId: string, queueId: string): Promise<void> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    console.warn('[VoiceCallSender] Twilio credentials not configured — call skipped');
    return;
  }

  const prefs = await storage.getContactPreferences(userId);
  if (!prefs?.phone) {
    console.warn(`[VoiceCallSender] No phone number for user ${userId.slice(-6)}`);
    return;
  }

  const { decryptPhone } = await import('./phone-encryption');
  let phone: string;
  try {
    phone = decryptPhone(prefs.phone);
  } catch {
    console.error(`[VoiceCallSender] Phone decrypt failed for user ${userId.slice(-6)}`);
    return;
  }

  const answerUrl = `${APP_URL}/api/webhooks/twilio/voice-answer?queueId=${queueId}&userId=${userId}`;
  const statusUrl = `${APP_URL}/api/webhooks/twilio/voice-status?queueId=${queueId}&userId=${userId}`;
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
          StatusCallbackEvent: 'completed no-answer busy failed',
        }).toString(),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(`[VoiceCallSender] Twilio API error ${response.status}:`, text.slice(0, 200));
      return;
    }

    const json = (await response.json()) as { sid: string };
    const callSid = json.sid;
    console.log(`[VoiceCallSender] Call initiated — SID: ${callSid}, user: ${userId.slice(-6)}`);

    const db = getSharedDb();
    await db
      .update(danielaOutboundQueue)
      .set({ callSid, callAt: new Date() })
      .where(eq(danielaOutboundQueue.id, queueId));
  } catch (err: any) {
    console.error('[VoiceCallSender] initiateCall error:', err.message);
  }
}

/**
 * Main entry — checks consent and initiates appropriate delivery.
 * Should be called fire-and-forget after leave_for_next_session creates a queue item.
 *
 * Priority order:
 *  1. VoIP call (phoneConsentVoice)
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
      await initiateCall(userId, queueId);
      return;
    }

    const smsOk = await canContactStudent(userId, 'sms');
    if (smsOk) {
      console.log(`[VoiceCallSender] No voice consent, falling back to SMS for user ${userId.slice(-6)}`);
      const { deliverVoiceMessageViaSms } = await import('./voice-message-delivery');
      await deliverVoiceMessageViaSms(queueId, userId, content);
      return;
    }

    console.log(`[VoiceCallSender] No outbound consent for user ${userId.slice(-6)} — message stays in queue`);
  } catch (err: any) {
    console.error('[VoiceCallSender] initiateOutboundContact error:', err.message);
  }
}
