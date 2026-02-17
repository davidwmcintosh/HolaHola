import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

function rateLimitHandler(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  const key = userId ? `user:${userId}` : `ip:${req.ip}`;
  console.warn(`[Rate Limit] Exceeded for ${key} on ${req.path}`);
  
  res.status(429).json({
    error: 'Too many requests',
    message: 'You have exceeded the rate limit. Please try again later.',
    retryAfter: res.getHeader('Retry-After'),
  });
}

function userOrIpKey(req: Request): string {
  const userId = (req as any).user?.id;
  return userId || req.ip || 'unknown';
}

const userKeyedDefaults = {
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: userOrIpKey,
  validate: { keyGeneratorIpFallback: false },
} as const;

export const generalLimiter = rateLimit({
  ...userKeyedDefaults,
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: 'Too many requests, please try again after 15 minutes',
  skip: () => process.env.NODE_ENV === 'development',
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: 'Too many login attempts, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: () => process.env.NODE_ENV === 'development',
});

export const aiLimiter = rateLimit({
  ...userKeyedDefaults,
  windowMs: 60 * 1000,
  max: 100,
  message: 'Too many AI requests, please wait a moment before trying again',
  skip: () => process.env.NODE_ENV === 'development',
});

export const voiceLimiter = rateLimit({
  ...userKeyedDefaults,
  windowMs: 60 * 1000,
  max: 200,
  message: 'Too many voice requests, please wait a moment before trying again',
  skip: () => process.env.NODE_ENV === 'development',
});

export const mutationLimiter = rateLimit({
  ...userKeyedDefaults,
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Too many modification requests, please try again later',
  skip: () => process.env.NODE_ENV === 'development',
});

export const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many attempts for this sensitive operation, please try again after an hour',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: () => process.env.NODE_ENV === 'development',
});

export const hiveExternalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many external Hive messages, please wait before trying again',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

console.log(`[Rate Limiting] Configured for ${process.env.NODE_ENV || 'production'} environment`);
if (process.env.NODE_ENV === 'development') {
  console.log('[Rate Limiting] Rate limiting DISABLED in development mode');
  console.log('[Rate Limiting] Hive External: 10 req/min (ENABLED in dev)');
} else {
  console.log('[Rate Limiting] Rate limiting ENABLED for production (user-keyed)');
  console.log('  General API: 500 req/15min | Auth: 60 req/15min (IP-keyed)');
  console.log('  AI/Chat: 100 req/min | Voice: 200 req/min | Mutations: 200 req/15min');
  console.log('  Sensitive Ops: 10 req/hour | Hive External: 10 req/min');
}
