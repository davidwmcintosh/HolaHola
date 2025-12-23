import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const REPLAY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const nonceCache = new Set<string>();

setInterval(() => {
  nonceCache.clear();
}, REPLAY_WINDOW_MS);

export function validateSyncRequest(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.SYNC_SHARED_SECRET;
  
  if (!secret || secret.length < 32) {
    console.error('[SYNC-AUTH] SYNC_SHARED_SECRET not configured or too short');
    return res.status(503).json({ error: 'Sync not configured' });
  }
  
  const signature = req.headers['x-sync-signature'] as string;
  const timestamp = req.headers['x-sync-timestamp'] as string;
  const nonce = req.headers['x-sync-nonce'] as string;
  
  if (!signature || !timestamp || !nonce) {
    return res.status(401).json({ error: 'Missing sync authentication headers' });
  }
  
  const requestTime = parseInt(timestamp, 10);
  const now = Date.now();
  
  if (isNaN(requestTime) || Math.abs(now - requestTime) > REPLAY_WINDOW_MS) {
    return res.status(401).json({ error: 'Request timestamp expired or invalid' });
  }
  
  if (nonceCache.has(nonce)) {
    return res.status(401).json({ error: 'Replay attack detected' });
  }
  
  const payload = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}:${nonce}:${payload}`)
    .digest('hex');
  
  // Use try/catch because timingSafeEqual throws if buffer lengths differ
  try {
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    
    if (sigBuffer.length !== expectedBuffer.length || 
        !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  } catch (err: any) {
    console.error('[SYNC-AUTH] Signature comparison error:', err.message);
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  nonceCache.add(nonce);
  next();
}

export function createSyncHeaders(payload: object): Record<string, string> {
  const secret = process.env.SYNC_SHARED_SECRET;
  
  if (!secret) {
    throw new Error('SYNC_SHARED_SECRET not configured');
  }
  
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const payloadStr = JSON.stringify(payload);
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}:${nonce}:${payloadStr}`)
    .digest('hex');
  
  return {
    'Content-Type': 'application/json',
    'X-Sync-Signature': signature,
    'X-Sync-Timestamp': timestamp,
    'X-Sync-Nonce': nonce,
  };
}

export function isSyncConfigured(): boolean {
  const secret = process.env.SYNC_SHARED_SECRET;
  const peerUrl = process.env.SYNC_PEER_URL;
  return !!(secret && secret.length >= 32 && peerUrl);
}

export function getSyncPeerUrl(): string | null {
  return process.env.SYNC_PEER_URL || null;
}
