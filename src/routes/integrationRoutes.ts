import express, { Response, NextFunction } from 'express';
import integrationService from '../services/integrationService';
import authenticateJWT from '../middleware/authenticateJWT';
import logger from '../utils/logger';
import { AuthenticatedRequest } from '../types';

const router = express.Router();

router.get('/', authenticateJWT, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const integrations = await integrationService.getUserIntegrations(req.user!.id);
    res.json({ success: true, data: integrations });
  } catch (error: any) {
    logger.error('Error fetching integrations:', error);
    next(error);
  }
});

router.post('/connect', authenticateJWT, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { service, credentials } = req.body;
    if (!service || !credentials) {
      res.status(400).json({ 
        success: false, 
        message: 'Service and credentials are required' 
      });
      return;
    }
    const integration = await integrationService.connectIntegration(
      req.user!.id, 
      service, 
      credentials
    );
    res.status(201).json({ success: true, data: integration });
  } catch (error: any) {
    logger.error('Error connecting integration:', error);
    next(error);
  }
});

router.post('/:service/disconnect', authenticateJWT, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const integration = await integrationService.disconnectIntegration(
      req.user!.id, 
      req.params.service
    );
    res.json({ success: true, data: integration });
  } catch (error: any) {
    logger.error('Error disconnecting integration:', error);
    next(error);
  }
});

router.post('/:service/sync', authenticateJWT, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await integrationService.syncIntegration(
      req.user!.id, 
      req.params.service
    );
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('Error syncing integration:', error);
    next(error);
  }
});

router.post('/sync/all', authenticateJWT, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const results = await integrationService.syncAllIntegrations(req.user!.id);
    res.json({ success: true, data: results });
  } catch (error: any) {
    logger.error('Error syncing all integrations:', error);
    next(error);
  }
});

export default router;

