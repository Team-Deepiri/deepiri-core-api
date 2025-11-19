import { Request, Response, NextFunction } from 'express';
import AuditLog from '../models/AuditLog';

export default function auditLogger() {
  return async function(req: Request, res: Response, next: NextFunction): Promise<void> {
    const start = Date.now();
    res.on('finish', async () => {
      try {
        const action = `${req.method} ${req.path}`;
        const userId = (req as any).user?.userId;
        await AuditLog.create({
          userId,
          action,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          metadata: { status: res.statusCode, durationMs: Date.now() - start }
        });
      } catch (error) {
        // Silently fail audit logging
      }
    });
    next();
  };
}

