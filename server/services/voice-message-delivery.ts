/**
 * Voice Message SMS Delivery
 *
 * After Daniela writes a message via leave_for_next_session, this service:
 *  1. Checks whether the student has SMS consent via canContactStudent()
 *  2. Renders the text to audio using Gemini TTS (WAV format)
 *  3. Uploads the WAV to object storage
 *  4. Sends a Twilio SMS with a link to the playback page
 *  5. Updates danielaOutboundQueue with smsDeliveredAt + audioUrl
 *
 * Every step fails gracefully: if audio rendering, storage, or Twilio is
 * unavailable the message stays in the queue for session-start delivery.
 */

import { getSharedDb } from '../db';
import { danielaOutboundQueue } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { canContactStudent } from './outbound-consent';
import { storage } from '../storage';
import { uploadBuffer } from '../replit_integrations/object_storage/objectStorage';

const APP_URL = process.env.APP_URL || 'https://getholahola.com';
const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || '';
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_FROM_NUMBER = (process.env.TWILIO_FROM_NUMBER || '').replace(/[\s\-().]/g, '');

/** Returns true when all three required Twilio env vars are present. */
export function isTwilioConfigured(): boolean {
  return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER);
}

/**
 * Attempt to send an SMS using explicitly-supplied credentials.
 * This injectable form is used by tests so they can exercise both the
 * "configured" and "not configured" paths without module mocking.
 *
 * Returns true if sent, false if credentials are missing. Throws on API errors.
 */
export async function sendSmsWithCredentials(
  credentials: { accountSid: string; authToken: string; fromNumber: string },
  to: string,
  body: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const { accountSid, authToken, fromNumber } = credentials;
  if (!accountSid || !authToken || !fromNumber) {
    return false;
  }
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const response = await fetchImpl(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: fromNumber, Body: body }).toString(),
    },
  );
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Twilio ${response.status}: ${errText.substring(0, 200)}`);
  }
  const data = await response.json() as { sid?: string; status?: string };
  console.log(`[VoiceMessageDelivery] SMS sent sid=${data.sid} status=${data.status}`);
  return true;
}

/**
 * Normalise a phone number to E.164 format (+[country][subscriber]).
 *
 * Throws an explicit error when the number cannot be confirmed valid so callers
 * receive a clear, actionable message instead of a cryptic Twilio rejection.
 *
 * Exported for use by the pipeline test script and upsert-time validation.
 */
export function normalizeE164(phone: string): string {
  const stripped = phone.replace(/[\s\-().]/g, '');

  if (!stripped.startsWith('+')) {
    throw new Error(
      `Phone number "${stripped}" is not in E.164 format — it must start with '+' followed by the ` +
      `country code (e.g. +15551234567). ` +
      `Store numbers with the leading '+' to prevent silent Twilio rejections.`,
    );
  }

  // E.164 requires '+' then 7–15 digits (country code + subscriber number).
  if (!/^\+[1-9]\d{6,14}$/.test(stripped)) {
    throw new Error(
      `Phone "${stripped}" is not a valid E.164 number — ` +
      `expected '+' followed by 7–15 digits (country code + subscriber). ` +
      `Twilio will reject this number.`,
    );
  }

  return stripped;
}

const DANIELA_VOICE = 'Kore';

async function renderAudioBuffer(text: string): Promise<Buffer | null> {
  try {
    const { getGeminiLiveTtsService } = await import('./gemini-live-tts');
    const tts = getGeminiLiveTtsService();
    if (!tts.isAvailable()) {
      console.warn('[VoiceMessageDelivery] Gemini TTS not available');
      return null;
    }
    return await tts.synthesizeToBuffer(text, DANIELA_VOICE);
  } catch (err: any) {
    console.error('[VoiceMessageDelivery] Audio render error:', err.message);
    return null;
  }
}

async function uploadAudioToStorage(queueId: string, wavBuffer: Buffer): Promise<string | null> {
  if (!BUCKET_ID) {
    console.warn('[VoiceMessageDelivery] Object storage not configured — SMS skipped');
    return null;
  }
  try {
    const filename = `${queueId}.wav`;
    await uploadBuffer(
      BUCKET_ID,
      `public/voice-messages/${filename}`,
      wavBuffer,
      'audio/wav',
      { cacheControl: 'public, max-age=86400' },
    );
    return `/api/media/vm-audio/${filename}`;
  } catch (err: any) {
    console.error('[VoiceMessageDelivery] Storage upload error:', err.message);
    return null;
  }
}

/** Returns true if the SMS was actually sent, false if credentials are missing. Throws on API errors. */
async function sendTwilioSms(to: string, body: string): Promise<boolean> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    console.warn('[VoiceMessageDelivery] Twilio credentials not configured — SMS skipped. ' +
      'Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER to Secrets.');
    return false;
  }
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: TWILIO_FROM_NUMBER, Body: body }).toString(),
    },
  );
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Twilio ${response.status}: ${errText.substring(0, 200)}`);
  }
  const data = await response.json() as { sid?: string; status?: string };
  console.log(`[VoiceMessageDelivery] SMS sent sid=${data.sid} status=${data.status}`);
  return true;
}

export interface VoiceDeliveryResult {
  smsSent: boolean;
  deliveryNote: string;
}

/**
 * Attempt to deliver a queued voice message via SMS.
 *
 * Called fire-and-forget after LEAVE_FOR_NEXT_SESSION writes to the queue.
 * Errors are logged; the message always remains in the queue for session-start
 * delivery as a fallback.
 *
 * Returns a result describing what happened so callers (e.g. the test endpoint)
 * can surface it to the founder without reading server logs.
 */
export async function deliverVoiceMessageViaSms(
  queueId: string,
  userId: string,
  content: string,
): Promise<VoiceDeliveryResult> {
  const canSend = await canContactStudent(userId, 'sms');
  if (!canSend) {
    console.log(`[VoiceMessageDelivery] No SMS consent for user …${userId.slice(-6)} — message stays in queue`);
    return { smsSent: false, deliveryNote: 'SMS skipped — student has not granted SMS consent' };
  }

  const prefs = await storage.getContactPreferences(userId);
  if (!prefs?.phone) {
    console.log(`[VoiceMessageDelivery] No phone on file for user …${userId.slice(-6)} — delivery skipped`);
    return { smsSent: false, deliveryNote: 'SMS skipped — no phone number on file for this student' };
  }

  console.log(`[VoiceMessageDelivery] Starting SMS voice note delivery for user …${userId.slice(-6)}`);

  const db = getSharedDb();

  /** Persist a delivery error to the queue row so the founder can see it in CommandCenter. */
  async function markFailed(note: string): Promise<VoiceDeliveryResult> {
    try {
      await db.update(danielaOutboundQueue)
        .set({ deliveryError: note })
        .where(eq(danielaOutboundQueue.id, queueId));
    } catch (dbErr: any) {
      console.error('[VoiceMessageDelivery] Failed to persist deliveryError:', dbErr.message);
    }
    return { smsSent: false, deliveryNote: note };
  }

  const wavBuffer = await renderAudioBuffer(content);
  if (!wavBuffer || wavBuffer.length === 0) {
    console.warn('[VoiceMessageDelivery] Audio rendering produced empty buffer — delivery skipped');
    return markFailed('Audio rendering failed (check Gemini TTS config)');
  }

  const audioPath = await uploadAudioToStorage(queueId, wavBuffer);
  if (!audioPath) {
    console.warn('[VoiceMessageDelivery] Audio upload failed — delivery skipped');
    return markFailed('Audio upload to storage failed');
  }

  await db.update(danielaOutboundQueue)
    .set({ audioUrl: audioPath })
    .where(eq(danielaOutboundQueue.id, queueId));

  const vmUrl = `${APP_URL}/vm/${queueId}`;
  const smsBody = `Daniela left you a voice note. Tap to listen: ${vmUrl}  Reply STOP to unsubscribe.`;

  let smsSent = false;
  try {
    smsSent = await sendTwilioSms(normalizeE164(prefs.phone), smsBody);
  } catch (err: any) {
    console.error('[VoiceMessageDelivery] SMS send failed:', err.message);
    return markFailed(`Twilio API error: ${err.message}`);
  }

  if (!smsSent) {
    // Credentials not configured — logged inside sendTwilioSms
    return markFailed('Twilio not configured (add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER to Secrets)');
  }

  // Success — clear any prior error flag and stamp delivery time
  await db.update(danielaOutboundQueue)
    .set({ smsDeliveredAt: new Date(), deliveryError: null })
    .where(eq(danielaOutboundQueue.id, queueId));

  console.log(`[VoiceMessageDelivery] Complete — queue item ${queueId} delivered via SMS`);
  return { smsSent: true, deliveryNote: 'SMS sent ✓' };
}
