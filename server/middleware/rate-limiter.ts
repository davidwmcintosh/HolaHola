import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Rate limiting middleware for production API protection
 * 
 * Different rate limits for different endpoint categories:
 * - General API: 100 requests per 15 minutes
 * - Auth: 5 attempts per 15 minutes  
 * - AI/Chat: 30 requests per minute (considering users need quick responses)
 * - Mutations: 50 requests per 15 minutes
 * - Voice endpoints: 40 requests per minute (for push-to-talk)
 */

/**
 * Custom error handler for rate limit exceeded
 */
function rateLimitHandler(req: Request, res: Response) {
  console.warn(`[Rate Limit] Exceeded for IP ${req.ip} on ${req.path}`);
  
  res.status(429).json({
    error: 'Too many requests',
    message: 'You have exceeded the rate limit. Please try again later.',
    retryAfter: res.getHeader('Retry-After'),
  });
}

/**
 * General API rate limiter
 * Applied to all API routes as a baseline
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 requests per window (SPA makes many calls on load)
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: rateLimitHandler,
  // Skip rate limiting in development
  skip: () => process.env.NODE_ENV === 'development',
});

/**
 * Auth endpoint limiter
 * Stricter limits for authentication to prevent brute force attacks
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // 60 attempts per window (SPA checks auth on every navigation)
  message: 'Too many login attempts from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: () => process.env.NODE_ENV === 'development',
});

/**
 * AI/Chat endpoint limiter
 * Moderate limits for AI interactions (users need responsive chat)
 */
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: 'Too many AI requests, please wait a moment before trying again',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: () => process.env.NODE_ENV === 'development',
});

/**
 * Voice endpoint limiter
 * Higher limits for voice interactions (push-to-talk needs quick responses)
 */
export const voiceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 40, // 40 requests per minute (supports rapid voice exchanges)
  message: 'Too many voice requests, please wait a moment before trying again',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: () => process.env.NODE_ENV === 'development',
});

/**
 * Mutation endpoint limiter
 * Limits for create/update/delete operations
 */
export const mutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per window
  message: 'Too many modification requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: () => process.env.NODE_ENV === 'development',
});

/**
 * Strict limiter for sensitive operations
 * Used for operations like password reset, account deletion, etc.
 */
export const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per hour
  message: 'Too many attempts for this sensitive operation, please try again after an hour',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: () => process.env.NODE_ENV === 'development',
});

/**
 * Hive External Message limiter
 * Rate limit for external @mentions to Daniela/Wren
 * 10 requests per minute - generous for legitimate use, protective against abuse
 */
export const hiveExternalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: 'Too many external Hive messages, please wait before trying again',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  // Note: Keep enabled even in development for testing purposes
});

// Log rate limiter status
console.log(`[Rate Limiting] Configured for ${process.env.NODE_ENV || 'production'} environment`);
if (process.env.NODE_ENV === 'development') {
  console.log('[Rate Limiting] ⚠️  Rate limiting DISABLED in development mode');
  console.log('[Rate Limiting] ✓ Hive External: 10 req/min (ENABLED in dev)');
} else {
  console.log('[Rate Limiting] ✓ Rate limiting ENABLED for production');
  console.log('  • General API: 500 req/15min');
  console.log('  • Auth: 60 req/15min');
  console.log('  • AI/Chat: 30 req/min');
  console.log('  • Voice: 40 req/min');
  console.log('  • Mutations: 50 req/15min');
  console.log('  • Sensitive Ops: 5 req/hour');
  console.log('  • Hive External: 10 req/min');
}
