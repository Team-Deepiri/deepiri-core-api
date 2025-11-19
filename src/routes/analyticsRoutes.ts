import express, { Request, Response, NextFunction } from 'express';
import analyticsService from '../services/analyticsService';
import authenticateJWT from '../middleware/authenticateJWT';
import logger from '../utils/logger';

const router = express.Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
  };
}

router.get('/', authenticateJWT, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const analytics = await analyticsService.getUserAnalytics(req.user!.id, days);
    res.json({ success: true, data: analytics });
  } catch (error: any) {
    logger.error('Error fetching analytics:', error);
    next(error);
  }
});

router.get('/stats', authenticateJWT, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const period = (req.query.period as string) || 'week';
    const stats = await analyticsService.getProductivityStats(req.user!.id, period);
    res.json({ success: true, data: stats });
  } catch (error: any) {
    logger.error('Error fetching productivity stats:', error);
    next(error);
  }
});

export default router;

