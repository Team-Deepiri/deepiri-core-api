import express, { Request, Response } from 'express';
import Joi from 'joi';
import agentService from '../services/agentService';
import logger from '../utils/logger';

const router = express.Router();

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
  };
}

const createSessionSchema = Joi.object({
  title: Joi.string().max(120).optional(),
  settings: Joi.object({
    model: Joi.string().optional(),
    temperature: Joi.number().min(0).max(2).optional(),
    topP: Joi.number().min(0).max(1).optional()
  }).optional()
});

const sendMessageSchema = Joi.object({
  content: Joi.string().min(1).required()
});

router.post('/sessions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { error, value } = createSessionSchema.validate(req.body || {});
    if (error) {
      res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map(d => d.message) });
      return;
    }
    const session = await agentService.createSession(userId, value.title, value.settings);
    res.status(201).json({ success: true, data: session });
  } catch (err: any) {
    logger.error('Failed to create agent session:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/sessions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const sessions = await agentService.listSessions(userId, limit, offset);
    res.json({ success: true, data: sessions });
  } catch (err: any) {
    logger.error('Failed to list sessions:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/sessions/:sessionId/messages', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { sessionId } = req.params;
    const { error, value } = sendMessageSchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map(d => d.message) });
      return;
    }

    const result = await agentService.sendMessage(sessionId, userId, value.content);
    res.json({ success: true, data: result });
  } catch (err: any) {
    logger.error('Failed to send agent message:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/sessions/:sessionId/archive', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { sessionId } = req.params;
    const session = await agentService.archiveSession(sessionId, userId);
    res.json({ success: true, data: session });
  } catch (err: any) {
    logger.error('Failed to archive session:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;

