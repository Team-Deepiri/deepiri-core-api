import { Request, Response, NextFunction } from 'express';

const strip = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(strip);
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('$') || k.includes('.')) continue;
    clean[k] = strip(v);
  }
  return clean;
};

export default function sanitize() {
  return function(req: Request, res: Response, next: NextFunction): void {
    if (req.body) req.body = strip(req.body);
    if (req.query) req.query = strip(req.query);
    if (req.params) req.params = strip(req.params);
    next();
  };
}

