import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(',').map(v => v.trim()).filter(Boolean);
}

export default function ipFilter() {
  const allow = parseList(process.env.IP_ALLOW_LIST);
  const deny = parseList(process.env.IP_DENY_LIST);

  return function(req: Request, res: Response, next: NextFunction): void {
    const ip = ((req.headers['x-forwarded-for'] as string) || (req.socket.remoteAddress || '')).toString();

    if (deny.length && deny.some(block => ip.includes(block))) {
      logger.warn(`Blocked IP ${ip}`);
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }
    if (allow.length && !allow.some(ok => ip.includes(ok))) {
      logger.warn(`Denied IP ${ip} not in allow list`);
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }
    next();
  };
}

