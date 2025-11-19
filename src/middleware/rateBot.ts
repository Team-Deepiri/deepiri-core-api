import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

export default function rateBot() {
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    keyGenerator: (req: Request) => ((req as any).user?.userId || req.ip),
    standardHeaders: true,
    legacyHeaders: false,
  });

  return function(req: Request, res: Response, next: NextFunction): void {
    if (process.env.NODE_ENV !== 'production') {
      return next();
    }

    const path = req.path || '';
    if (path.startsWith('/api/auth')) {
      return next();
    }

    const ua = (req.get('User-Agent') || '').toLowerCase();
    if (ua.includes('bot') || ua.includes('crawler') || ua.includes('spider')) {
      res.status(403).json({ success: false, message: 'Bots are not allowed' });
      return;
    }
    return limiter(req, res, next);
  };
}

