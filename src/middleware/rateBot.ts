import { RateLimiterMemory, RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import { Request, Response, NextFunction } from 'express';
import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

// single connect promise for readiness checks
const redisReady = redisClient.connect().catch((err) => {
  console.error('[redis] connect failed:', err);
  throw err;
});

// Main distributed limiter: 100 requests / 15 minutes
const rateLimiterRedis = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'rl_main',
  points: 100,
  duration: 900,
  // Optional: block for a bit after exceeded
  // blockDuration: 60,
});

// Burst limiter (token bucket style): 10 requests / second
// NOTE: in-memory (single-instance only). For multi-instance, use Redis.
const tokenBucketLimiter = new RateLimiterMemory({
  keyPrefix: 'rl_burst',
  points: 10,
  duration: 1,
});

function getKey(req: Request): string {
  return (req as any).user?.userId || req.ip || 'anonymous';
}

function isBotUserAgent(req: Request): boolean {
  const ua = (req.get('User-Agent') || '').toLowerCase();
  return ua.includes('bot') || ua.includes('crawler') || ua.includes('spider');
}

export default function rateBot() {
  return async function (req: Request, res: Response, next: NextFunction): Promise<void> {
    if (process.env.NODE_ENV !== 'production') return next();

    const path = req.path || '';
    if (path.startsWith('/api/auth')) return next();

    if (isBotUserAgent(req)) {
      res.status(403).json({ success: false, message: 'Bots are not allowed' });
      return;
    }

    const key = getKey(req);

    // If Redis is down: choose fail-open or fail-closed
    try {
      await redisReady;
    } catch {
      console.warn('[rate-limit] Redis unavailable; failing open');
      return next(); // fail-open
      // fail-closed alternative:
      // res.status(503).json({ success: false, message: 'Rate limiter unavailable' });
      // return;
    }

    try {
      // Distributed limit
      await rateLimiterRedis.consume(key);

      // Burst limit (still rejects when exceeded)
      await tokenBucketLimiter.consume(key);

      return next();
    } catch (err) {
      // Only treat RateLimiterRes as "rate limit exceeded"
      if (err instanceof RateLimiterRes) {
        const retryAfterSec = Math.ceil(err.msBeforeNext / 1000);
        res.setHeader('Retry-After', String(retryAfterSec));
        res.status(429).json({
          success: false,
          message: 'Too many requests, please try again later.',
          retryAfter: retryAfterSec,
        });
        return;
      }

      // Unexpected error (Redis/network/etc.)
      console.error('[rate-limit] unexpected error:', err);
      return next(); // fail-open on unexpected errors
      // or fail-closed:
      // res.status(503).json({ success: false, message: 'Rate limiter error' });
    }
  };
}