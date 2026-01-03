import { Request, Response, NextFunction } from 'express';

// Simple in-memory throttling (for demo; use Redis for production)
const requestTimes: { [key: string]: number[] } = {};

export function throttleRequests(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = (req as any).user?.userId || req.ip || 'anonymous';
    const now = Date.now();

    if (!requestTimes[key]) {
      requestTimes[key] = [];
    }

    // Remove old timestamps outside the window
    requestTimes[key] = requestTimes[key].filter((time) => now - time < windowMs);

    // Cleanup: if no recent timestamps remain, delete the key to prevent memory growth
    if (requestTimes[key].length === 0) {
      delete requestTimes[key];
      // Re-initialize for this request (since we're going to record it below)
      requestTimes[key] = [];
    }

    if (requestTimes[key].length >= maxRequests) {
      // Throttle: delay the request until the oldest timestamp falls out of the window
      const delay = windowMs - (now - requestTimes[key][0]);

      setTimeout(() => {
        // If client disconnected or response already started, don't run downstream handlers
        if (req.aborted || res.headersSent) return;

        requestTimes[key].push(Date.now());
        next();
      }, Math.max(0, delay));
    } else {
      requestTimes[key].push(now);
      next();
    }
  };
}
