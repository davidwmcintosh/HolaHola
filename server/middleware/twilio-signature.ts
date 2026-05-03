import type { Request, Response, NextFunction } from "express";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Express middleware that validates Twilio request signatures on all webhook endpoints.
 *
 * Twilio signs every request it sends using HMAC-SHA1 over:
 *   FULL_URL + sorted POST params (key+value pairs, no separators)
 *
 * The computed digest (base64) must match the X-Twilio-Signature header.
 *
 * In development (NODE_ENV !== 'production') the check is skipped when
 * TWILIO_AUTH_TOKEN is not configured so local testing still works.
 * In production the token is required; missing token → 403.
 */
export function validateTwilioSignature(req: Request, res: Response, next: NextFunction): void {
  const authToken = process.env.TWILIO_AUTH_TOKEN || '';

  if (!authToken) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[TwilioWebhook] TWILIO_AUTH_TOKEN not set in production — rejecting request');
      res.status(403).send('Forbidden');
      return;
    }
    next();
    return;
  }

  const twilioSig = (req.headers['x-twilio-signature'] as string | undefined) || '';
  if (!twilioSig) {
    console.warn('[TwilioWebhook] Missing X-Twilio-Signature — rejected');
    res.status(403).send('Forbidden');
    return;
  }

  const appUrl = process.env.APP_URL || 'https://getholahola.com';
  const fullUrl = appUrl + req.originalUrl;

  const params: Record<string, string> = (req.body as Record<string, string>) || {};
  const sortedKeys = Object.keys(params).sort();
  const paramStr = sortedKeys.map((k) => k + params[k]).join('');
  const expected = createHmac('sha1', authToken).update(fullUrl + paramStr).digest('base64');

  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(twilioSig);
  const sigMatch =
    expectedBuf.length === receivedBuf.length &&
    timingSafeEqual(expectedBuf, receivedBuf);

  if (!sigMatch) {
    console.warn('[TwilioWebhook] Signature mismatch — rejected', { url: fullUrl });
    res.status(403).send('Forbidden');
    return;
  }

  next();
}
