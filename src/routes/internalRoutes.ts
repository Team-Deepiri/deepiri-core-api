import { Router, Request, Response } from 'express';
import cacheService from '../services/cacheService';
import httpClient from '../utils/httpClient';
import logger from '../utils/logger';

const router = Router();

// Return dependency breaker states and basic connectivity hints.
router.get('/health/dependencies', async (req: Request, res: Response) => {
  try {
    const redis = cacheService.getBreakerState();
    const httpBreakers = httpClient.getBreakerStates();

    const payload = {
      redis: { breaker: redis },
      http: Object.keys(httpBreakers).map((origin) => ({ origin, state: httpBreakers[origin] }))
    };

    res.json(payload);
  } catch (err: any) {
    logger.error('Failed to fetch dependency health:', err?.message);
    res.status(500).json({ error: 'failed to fetch dependency health' });
  }
});

export default router;
