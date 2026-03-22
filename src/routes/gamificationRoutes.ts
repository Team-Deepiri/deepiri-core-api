import express, { Response, NextFunction } from 'express';
import gamificationService from '../services/gamificationService';
import authenticateJWT from '../middleware/authenticateJWT';
import { secureLog } from '../utils/secureLogger';
import { AuthenticatedRequest } from '../types';

const router = express.Router();

router.get('/profile', authenticateJWT, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await gamificationService.getOrCreateProfile(req.user!.id);
    const rank = await gamificationService.getUserRank(req.user!.id);
    
    res.json({ 
      success: true, 
      data: {
        ...profile.toObject(),
        rank
      }
    });
  } catch (error: any) {
    secureLog('error', 'Error fetching gamification profile:', error);
    next(error);
  }
});

router.get('/leaderboard', authenticateJWT, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const period = (req.query.period as string) || 'all';
    const leaderboard = await gamificationService.getLeaderboard(limit, period);
    res.json({ success: true, data: leaderboard });
  } catch (error: any) {
    secureLog('error', 'Error fetching leaderboard:', error);
    next(error);
  }
});

router.get('/rank', authenticateJWT, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const rank = await gamificationService.getUserRank(req.user!.id);
    res.json({ success: true, data: { rank } });
  } catch (error: any) {
    secureLog('error', 'Error fetching rank:', error);
    next(error);
  }
});

router.post('/badges/check', authenticateJWT, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const awardedBadges = await gamificationService.checkAndAwardBadges(req.user!.id);
    res.json({ success: true, data: { awardedBadges } });
  } catch (error: any) {
    secureLog('error', 'Error checking badges:', error);
    next(error);
  }
});

router.patch('/preferences', authenticateJWT, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await gamificationService.updatePreferences(req.user!.id, req.body);
    res.json({ success: true, data: profile });
  } catch (error: any) {
    secureLog('error', 'Error updating preferences:', error);
    next(error);
  }
});

export default router;

