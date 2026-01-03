import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import { createClient } from 'redis';
import { Request, Response, NextFunction } from 'express';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

// Keep a single connect promise so we can await readiness when needed
const redisReady = redisClient.connect().catch((err) => {
  console.error('[redis] connect failed:', err);
  // Keep the promise rejected; middleware can decide fail-open vs fail-closed
  throw err;
});

// Define endpoint rules with prefix matching (covers /api/users/:id, etc.)
type EndpointRule = {
  prefix: string;
  limiter: RateLimiterRedis;
};

const endpointRules: EndpointRule[] = [
  {
    prefix: '/api/users',
    limiter: new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'endpoint_users',
      points: 50,      // 50 requests
      duration: 900,   // per 15 minutes
      // Optional: if someone exceeds, block them for a bit
      blockDuration: 60, // seconds
    }),
  },
  {
    prefix: '/api/adventures',
    limiter: new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'endpoint_adventures',
      points: 200,
      duration: 900,
      blockDuration: 30,
    }),
  },
];

function getLimiterForPath(path: string): RateLimiterRedis | null {
  const rule = endpointRules.find((r) => path.startsWith(r.prefix));
  return rule ? rule.limiter : null;
}

function getRateLimitKey(req: Request): string {
  // Prefer authenticated user id, fallback to IP
  return (req as any).user?.userId || req.ip || 'anonymous';
}

export async function perEndpointLimiter(req: Request, res: Response, next: NextFunction) {
  const limiter = getLimiterForPath(req.path);
  if (!limiter) return next();

  const key = getRateLimitKey(req);

  // Decide policy if Redis isn't ready:
  // - fail-open: allow traffic if Redis is down
  // - fail-closed: return 503
  try {
    await redisReady;
  } catch {
    console.warn('[rate-limit] Redis not available; failing open');
    return next(); // fail-open (recommended for most apps)
    // If you prefer fail-closed:
    // return res.status(503).json({ message: 'Rate limiter unavailable' });
  }

  try {
    await limiter.consume(key);
    return next();
  } catch (err) {
    // Normal "limit exceeded" case gives a RateLimiterRes
    if (err instanceof RateLimiterRes) {
      const retryAfterSeconds = Math.ceil(err.msBeforeNext / 1000);
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        message: 'Endpoint rate limit exceeded',
        retryAfterSeconds,
      });
    }

    // Unexpected error (Redis/network/etc.)
    console.error('[rate-limit] unexpected error:', err);
    return next(); // fail-open on unexpected limiter errors
    // or: return res.status(503).json({ message: 'Rate limiter error' });
  }
}