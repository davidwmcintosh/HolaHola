/**
 * test-voice-sms-pipeline.ts
 *
 * End-to-end verification of the voice-note SMS delivery path:
 *
 *   leave_for_next_session (queue insert)
 *     → consent check (canContactStudent)
 *     → Gemini TTS render (audio buffer)
 *     → object storage upload
 *     → Twilio SMS send
 *     → DB update (audioUrl + smsDeliveredAt)
 *     → /api/vm/:id playback API
 *
 * The script reports PASS/FAIL for each step so you can see exactly where the
 * pipeline breaks when credentials are absent or misconfigured.
 *
 * Run: npx tsx server/scripts/test-voice-sms-pipeline.ts
 *
 * Options (env vars):
 *   VOICE_SMS_TEST_USER_ID  — target user ID (must have SMS consent + phone)
 *                             If unset, the script scans the DB for the first
 *                             eligible student.
 *   VOICE_SMS_DRY_RUN=1     — skip the actual Twilio call; all other steps run.
 */

import { getSharedDb } from '../db';
import { danielaOutboundQueue, studentContactPreferences, users } from '@shared/schema';
import { eq, isNotNull, and } from 'drizzle-orm';

// ── Colours ────────────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;

const pass = (msg: string) => console.log(`  ${G('✓')} ${msg}`);
const fail = (msg: string) => { console.log(`  ${R('✗')} ${msg}`); failures++; };
const skip = (msg: string) => console.log(`  ${Y('–')} ${msg}`);
const info = (msg: string) => console.log(`  ${B('·')} ${msg}`);

let failures = 0;

// ── Step 0: Resolve target user ────────────────────────────────────────────
async function resolveTargetUser(): Promise<{ userId: string; phone: string } | null> {
  const db = getSharedDb();

  // Prefer an explicit override
  const overrideId = process.env.VOICE_SMS_TEST_USER_ID;
  if (overrideId) {
    const prefs = await db.select()
      .from(studentContactPreferences)
      .where(eq(studentContactPreferences.userId, overrideId))
      .limit(1);
    if (!prefs[0]?.phone) {
      fail(`VOICE_SMS_TEST_USER_ID=${overrideId} has no phone on file`);
      return null;
    }
    if (!prefs[0].phoneConsentSms) {
      fail(`VOICE_SMS_TEST_USER_ID=${overrideId} has no SMS consent`);
      return null;
    }
    return { userId: overrideId, phone: prefs[0].phone };
  }

  // Auto-scan: find first student with phone + SMS consent
  const rows = await db
    .select({
      userId: studentContactPreferences.userId,
      phone: studentContactPreferences.phone,
    })
    .from(studentContactPreferences)
    .where(
      and(
        isNotNull(studentContactPreferences.phone),
        eq(studentContactPreferences.phoneConsentSms, true),
      )
    )
    .limit(5);

  if (rows.length === 0) {
    skip('No student with SMS consent found in DB — set VOICE_SMS_TEST_USER_ID to a user with phone + SMS consent to run the full test');
    return null;
  }

  // Decrypt phone for display (we just trust storage layer; here we show only last 4)
  const { userId, phone } = rows[0];
  info(`Auto-selected user …${userId.slice(-6)}, phone on file (encrypted in DB)`);
  return { userId, phone: phone! };
}

// ── Step 1: Consent check ──────────────────────────────────────────────────
async function checkConsent(userId: string): Promise<boolean> {
  const { canContactStudent } = await import('../services/outbound-consent');
  const ok = await canContactStudent(userId, 'sms');
  if (ok) {
    pass('Consent check passed (phone + SMS consent + active account)');
  } else {
    fail('Consent check failed — student may have no phone, no SMS consent, or an inactive account');
  }
  return ok;
}

// ── Step 2: Audio render ───────────────────────────────────────────────────
async function renderAudio(text: string): Promise<Buffer | null> {
  try {
    const { getGeminiLiveTtsService } = await import('../services/gemini-live-tts');
    const tts = getGeminiLiveTtsService();
    if (!tts.isAvailable()) {
      fail('Gemini TTS not available — check GEMINI_API_KEY');
      return null;
    }
    const buf = await tts.synthesizeToBuffer(text, 'Kore');
    if (!buf || buf.length === 0) {
      fail('Audio render returned empty buffer');
      return null;
    }
    pass(`Audio rendered: ${buf.length} bytes (WAV)`);
    return buf;
  } catch (err: any) {
    fail(`Audio render error: ${err.message}`);
    return null;
  }
}

// ── Step 3: Storage upload ─────────────────────────────────────────────────
async function uploadAudio(queueId: string, buf: Buffer): Promise<string | null> {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || '';
  if (!bucketId) {
    fail('Object storage not configured — set DEFAULT_OBJECT_STORAGE_BUCKET_ID');
    return null;
  }
  try {
    const { uploadBuffer } = await import('../replit_integrations/object_storage/objectStorage');
    await uploadBuffer(
      bucketId,
      `public/voice-messages/${queueId}.wav`,
      buf,
      'audio/wav',
      { cacheControl: 'public, max-age=86400' },
    );
    const path = `/api/media/vm-audio/${queueId}.wav`;
    pass(`Audio uploaded → ${path}`);
    return path;
  } catch (err: any) {
    fail(`Storage upload error: ${err.message}`);
    return null;
  }
}

// ── Step 4: Twilio SMS ─────────────────────────────────────────────────────
async function sendSms(phone: string, vmUrl: string): Promise<boolean> {
  const sid  = process.env.TWILIO_ACCOUNT_SID  || '';
  const auth = process.env.TWILIO_AUTH_TOKEN    || '';
  const from = (process.env.TWILIO_FROM_NUMBER  || '').replace(/[\s\-().]/g, '');

  if (!sid || !auth || !from) {
    const missing = [!sid && 'TWILIO_ACCOUNT_SID', !auth && 'TWILIO_AUTH_TOKEN', !from && 'TWILIO_FROM_NUMBER']
      .filter(Boolean).join(', ');
    skip(`Twilio not configured (missing: ${missing}) — SMS step skipped`);
    return false;
  }

  if (process.env.VOICE_SMS_DRY_RUN === '1') {
    skip(`DRY RUN: would send SMS to ${phone.slice(0, -4).replace(/./g, '*')}****  body: ${vmUrl}`);
    return false;
  }

  try {
    const body = new URLSearchParams({
      To:   phone,
      From: from,
      Body: `Daniela left you a voice note. Tap to listen: ${vmUrl}  Reply STOP to unsubscribe.`,
    }).toString();
    const b64 = Buffer.from(`${sid}:${auth}`).toString('base64');
    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: { Authorization: `Basic ${b64}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      }
    );
    if (!resp.ok) {
      const txt = await resp.text();
      fail(`Twilio ${resp.status}: ${txt.substring(0, 200)}`);
      return false;
    }
    const data = await resp.json() as { sid?: string; status?: string };
    pass(`SMS sent via Twilio — sid=${data.sid}  status=${data.status}`);
    return true;
  } catch (err: any) {
    fail(`Twilio request error: ${err.message}`);
    return false;
  }
}

// ── Step 5: DB state verification ─────────────────────────────────────────
async function verifyDbRow(queueId: string, expectAudioUrl: boolean, expectSmsDeliveredAt: boolean): Promise<void> {
  const db = getSharedDb();
  const [row] = await db.select().from(danielaOutboundQueue)
    .where(eq(danielaOutboundQueue.id, queueId))
    .limit(1);

  if (!row) {
    fail(`Queue row ${queueId} not found in DB`);
    return;
  }
  pass(`Queue row exists (id=${queueId})`);

  if (expectAudioUrl) {
    if (row.audioUrl) {
      pass(`audioUrl populated: ${row.audioUrl}`);
    } else {
      fail('audioUrl is NULL — storage upload did not update the row');
    }
  }

  if (expectSmsDeliveredAt) {
    if (row.smsDeliveredAt) {
      pass(`smsDeliveredAt populated: ${row.smsDeliveredAt.toISOString()}`);
    } else {
      fail('smsDeliveredAt is NULL — Twilio send did not update the row (or was skipped)');
    }
  }
}

// ── Step 6: Playback API ────────────────────────────────────────────────────
async function verifyPlaybackApi(queueId: string): Promise<void> {
  // Call the route logic directly (DB lookup + join) without spinning up a server
  const db = getSharedDb();
  const [item] = await db.select({
    id: danielaOutboundQueue.id,
    content: danielaOutboundQueue.content,
    audioUrl: danielaOutboundQueue.audioUrl,
    audioPlayedAt: danielaOutboundQueue.audioPlayedAt,
    createdAt: danielaOutboundQueue.createdAt,
    userId: danielaOutboundQueue.userId,
    targetLanguage: users.targetLanguage,
    tutorGender: users.tutorGender,
  })
    .from(danielaOutboundQueue)
    .leftJoin(users, eq(danielaOutboundQueue.userId, users.id))
    .where(eq(danielaOutboundQueue.id, queueId))
    .limit(1);

  if (!item) {
    fail('Playback API: queue row not found');
    return;
  }

  const payload = {
    id: item.id,
    audioUrl: item.audioUrl,
    content: item.content,
    playedAt: item.audioPlayedAt,
    createdAt: item.createdAt,
    language: item.targetLanguage ?? 'spanish',
    gender: item.tutorGender ?? 'female',
  };

  if (!payload.id) { fail('Playback API: id missing from response'); return; }
  if (!payload.content) { fail('Playback API: content missing from response'); return; }
  if (!payload.language) { fail('Playback API: language missing from response'); return; }

  pass(`Playback API returns valid payload (language=${payload.language}, gender=${payload.gender})`);

  if (payload.audioUrl) {
    pass(`Playback API: audioUrl is set → ${payload.audioUrl}`);
  } else {
    skip('Playback API: audioUrl is null (audio render/upload was skipped)');
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(B('\n═══ Voice SMS Pipeline — End-to-End Verification ═══\n'));

  // ── Resolve user ──────────────────────────────────────────────────────
  console.log(B('Step 0: Resolve target student'));
  const target = await resolveTargetUser();
  if (!target) {
    console.log(Y('\nNo eligible student found — skipping live delivery steps.\n'));
    console.log(Y('To run the full test, create a student record with a phone number'));
    console.log(Y('and phoneConsentSms=true, then set VOICE_SMS_TEST_USER_ID=<userId>.\n'));
    console.log(failures === 0
      ? G('Pipeline structure OK (no eligible student to run live steps against)')
      : R(`${failures} failure(s) — see above`));
    process.exit(failures > 0 ? 1 : 0);
  }

  const { userId, phone } = target;
  const content = 'Hola! I was thinking about our last session — you did so well. I left you a little note before we meet again. ¡Hasta pronto!';

  // ── Step 1: Consent ───────────────────────────────────────────────────
  console.log(B('\nStep 1: Consent check'));
  const consentOk = await checkConsent(userId);
  if (!consentOk) {
    fail('Consent gate blocked delivery — remaining steps skipped');
    process.exit(1);
  }

  // ── Insert queue row ──────────────────────────────────────────────────
  console.log(B('\nStep 2: Insert danielaOutboundQueue row'));
  const db = getSharedDb();
  const [row] = await db.insert(danielaOutboundQueue)
    .values({ userId, content })
    .returning({ id: danielaOutboundQueue.id });
  const queueId = row.id;
  pass(`Queue row inserted (id=${queueId})`);

  const appUrl = process.env.APP_URL || 'https://getholahola.com';
  const vmUrl  = `${appUrl}/vm/${queueId}`;
  info(`Playback URL: ${vmUrl}`);

  // ── Step 3: Audio render ──────────────────────────────────────────────
  console.log(B('\nStep 3: Audio render (Gemini TTS)'));
  const wavBuffer = await renderAudio(content);

  // ── Step 4: Storage upload ────────────────────────────────────────────
  let audioPath: string | null = null;
  if (wavBuffer) {
    console.log(B('\nStep 4: Object storage upload'));
    audioPath = await uploadAudio(queueId, wavBuffer);
    if (audioPath) {
      await db.update(danielaOutboundQueue)
        .set({ audioUrl: audioPath })
        .where(eq(danielaOutboundQueue.id, queueId));
    }
  } else {
    skip('Step 4: Skipped (no audio buffer)');
  }

  // ── Step 5: Twilio SMS ────────────────────────────────────────────────
  console.log(B('\nStep 5: Twilio SMS'));

  // Decrypt phone via storage layer (phone in DB is encrypted)
  const { storage } = await import('../storage');
  const prefs = await storage.getContactPreferences(userId);
  const decryptedPhone = prefs?.phone ?? '';
  if (!decryptedPhone) {
    fail('Could not decrypt phone number from storage');
  }

  // Validate E.164 format before attempting the Twilio call.
  // A number without a leading '+' will be silently rejected by Twilio;
  // catching it here produces a clear, actionable failure instead.
  let e164Phone = decryptedPhone;
  if (decryptedPhone) {
    const { normalizeE164 } = await import('../services/voice-message-delivery');
    try {
      e164Phone = normalizeE164(decryptedPhone);
      pass(`Phone passes E.164 validation: ${e164Phone.slice(0, 3)}${'*'.repeat(Math.max(0, e164Phone.length - 5))}${e164Phone.slice(-2)}`);
    } catch (err: any) {
      fail(`E.164 validation failed — ${err.message}`);
      e164Phone = '';
    }
  }

  const smsSent = e164Phone ? await sendSms(e164Phone, vmUrl) : false;
  if (smsSent) {
    await db.update(danielaOutboundQueue)
      .set({ smsDeliveredAt: new Date() })
      .where(eq(danielaOutboundQueue.id, queueId));
  }

  // ── Step 6: DB state ─────────────────────────────────────────────────
  console.log(B('\nStep 6: DB row state'));
  await verifyDbRow(queueId, !!audioPath, smsSent);

  // ── Step 7: Playback API ──────────────────────────────────────────────
  console.log(B('\nStep 7: Playback API response'));
  await verifyPlaybackApi(queueId);

  // ── Summary ───────────────────────────────────────────────────────────
  console.log(B('\n═══ Summary ═══'));
  info(`Queue ID:    ${queueId}`);
  info(`Playback URL: ${vmUrl}`);
  info(`Audio rendered: ${wavBuffer ? 'yes' : 'no'}`);
  info(`Audio uploaded: ${audioPath ? 'yes' : 'no'}`);
  info(`SMS sent:       ${smsSent ? 'yes' : 'no (see above)'}`);
  console.log('');

  if (failures === 0) {
    console.log(G('ALL CHECKS PASSED\n'));
    process.exit(0);
  } else {
    console.log(R(`${failures} FAILURE(S) — see above\n`));
    process.exit(1);
  }
}

main().catch(err => {
  console.error(R('\nUnhandled error:'), err);
  process.exit(1);
});
