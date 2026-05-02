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
import { objectStorageClient } from '../replit_integrations/object_storage/objectStorage';

const APP_URL = process.env.APP_URL || 'https://getholahola.com';
const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || '';
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER || '';

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
    const bucket = objectStorageClient.bucket(BUCKET_ID);
    const file = bucket.file(`public/voice-messages/${filename}`);
    await file.save(wavBuffer, {
      contentType: 'audio/wav',
      metadata: { cacheControl: 'public, max-age=86400' },
    });
    return `/api/media/vm-audio/${filename}`;
  } catch (err: any) {
    console.error('[VoiceMessageDelivery] Storage upload error:', err.message);
    return null;
  }
}

async function sendTwilioSms(to: string, body: string): Promise<void> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    console.warn('[VoiceMessageDelivery] Twilio credentials not configured — SMS skipped');
    return;
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
}

/**
 * Attempt to deliver a queued voice message via SMS.
 *
 * Called fire-and-forget after LEAVE_FOR_NEXT_SESSION writes to the queue.
 * Errors are logged; the message always remains in the queue for session-start
 * delivery as a fallback.
 */
export async function deliverVoiceMessageViaSms(
  queueId: string,
  userId: string,
  content: string,
): Promise<void> {
  const canSend = await canContactStudent(userId, 'sms');
  if (!canSend) {
    console.log(`[VoiceMessageDelivery] No SMS consent for user …${userId.slice(-6)} — message stays in queue`);
    return;
  }

  const prefs = await storage.getContactPreferences(userId);
  if (!prefs?.phone) return;

  console.log(`[VoiceMessageDelivery] Starting SMS voice note delivery for user …${userId.slice(-6)}`);

  const wavBuffer = await renderAudioBuffer(content);
  if (!wavBuffer || wavBuffer.length === 0) {
    console.warn('[VoiceMessageDelivery] Audio rendering produced empty buffer — delivery skipped');
    return;
  }

  const audioPath = await uploadAudioToStorage(queueId, wavBuffer);
  if (!audioPath) {
    console.warn('[VoiceMessageDelivery] Audio upload failed — delivery skipped');
    return;
  }

  const db = getSharedDb();
  await db.update(danielaOutboundQueue)
    .set({ audioUrl: audioPath })
    .where(eq(danielaOutboundQueue.id, queueId));

  const vmUrl = `${APP_URL}/vm/${queueId}`;
  const smsBody = `Daniela left you a voice note. Tap to listen: ${vmUrl}  Reply STOP to unsubscribe.`;

  try {
    await sendTwilioSms(prefs.phone, smsBody);
  } catch (err: any) {
    console.error('[VoiceMessageDelivery] SMS send failed:', err.message);
    return;
  }

  await db.update(danielaOutboundQueue)
    .set({ smsDeliveredAt: new Date() })
    .where(eq(danielaOutboundQueue.id, queueId));

  console.log(`[VoiceMessageDelivery] Complete — queue item ${queueId} delivered via SMS`);
}
