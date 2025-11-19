import express, { Request, Response, NextFunction } from 'express';
import challengeService from '../services/challengeService';
import authenticateJWT from '../middleware/authenticateJWT';
import logger from '../utils/logger';

const router = express.Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
  };
}

router.post('/generate', authenticateJWT, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { taskId } = req.body;
    if (!taskId) {
      res.status(400).json({ success: false, message: 'Task ID is required' });
      return;
    }
    const challenge = await challengeService.generateChallenge(req.user!.id, taskId);
    res.status(201).json({ success: true, data: challenge });
  } catch (error: any) {
    logger.error('Error generating challenge:', error);
    next(error);
  }
});

router.get('/', authenticateJWT, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const challenges = await challengeService.getUserChallenges(req.user!.id, req.query);
    res.json({ success: true, data: challenges });
  } catch (error: any) {
    logger.error('Error fetching challenges:', error);
    next(error);
  }
});

router.get('/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const challenge = await challengeService.getChallengeById(req.params.id, req.user!.id);
    res.json({ success: true, data: challenge });
  } catch (error: any) {
    logger.error('Error fetching challenge:', error);
    next(error);
  }
});

router.post('/:id/complete', authenticateJWT, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const challenge = await challengeService.completeChallenge(
      req.params.id, 
      req.user!.id, 
      req.body
    );
    res.json({ success: true, data: challenge });
  } catch (error: any) {
    logger.error('Error completing challenge:', error);
    next(error);
  }
});

export default router;

