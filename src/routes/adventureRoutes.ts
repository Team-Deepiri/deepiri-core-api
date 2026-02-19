import express, { Request, Response } from 'express';
import Joi from 'joi';
import adventureService from '../services/adventureService';
import { secureLog } from '../utils/secureLogger';
import { asyncHandler } from '../middleware/errorHandler';

const router = express.Router();

const generateAdventureSchema = Joi.object({
  location: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
    address: Joi.string().optional()
  }).required(),
  interests: Joi.array().items(Joi.string()).min(1).required(),
  duration: Joi.number().min(30).max(90).optional(),
  maxDistance: Joi.number().min(1000).max(20000).optional(),
  startTime: Joi.date().optional(),
  endTime: Joi.date().optional(),
  socialMode: Joi.string().valid('solo', 'friends', 'meet_new_people').optional(),
  friends: Joi.array().items(Joi.string()).optional()
});

const updateStepSchema = Joi.object({
  stepIndex: Joi.number().min(0).required(),
  action: Joi.string().valid('complete', 'skip', 'start').required()
});

const feedbackSchema = Joi.object({
  rating: Joi.number().min(1).max(5).required(),
  comments: Joi.string().max(500).optional(),
  completedSteps: Joi.array().items(Joi.string()).optional(),
  skippedSteps: Joi.array().items(Joi.string()).optional(),
  suggestions: Joi.string().max(500).optional()
});

const shareAdventureSchema = Joi.object({
  friends: Joi.array().items(Joi.string()).optional(),
  isPublic: Joi.boolean().optional()
});

router.post('/generate', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  
  const { error, value } = generateAdventureSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.details.map(detail => detail.message)
    });
  }

  const adventure = await adventureService.generateAdventure(userId, value);

  if ((req as any).io) {
    (req as any).io.to(`user_${userId}`).emit('adventure_generated', {
      adventureId: adventure._id,
      name: adventure.name,
      message: 'Your adventure is ready!'
    });
  }

  res.status(201).json({
    success: true,
    message: 'Adventure generated successfully',
    data: adventure
  });
}));

router.get('/:adventureId', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { adventureId } = req.params;

  const adventure = await adventureService.getAdventure(adventureId, userId);

  res.json({
    success: true,
    data: adventure
  });
}));

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { status, limit = '20', offset = '0' } = req.query;

  const adventures = await adventureService.getUserAdventures(
    userId, 
    status as string | null, 
    parseInt(limit as string), 
    parseInt(offset as string)
  );

  res.json({
    success: true,
    data: adventures
  });
}));

router.post('/:adventureId/start', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { adventureId } = req.params;

  const adventure = await adventureService.startAdventure(adventureId, userId);

  res.json({
    success: true,
    message: 'Adventure started successfully',
    data: adventure
  });
}));

router.post('/:adventureId/complete', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { adventureId } = req.params;

  let feedback = null;
  if (req.body.feedback) {
    const { error, value } = feedbackSchema.validate(req.body.feedback);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }
    feedback = value;
  }

  const adventure = await adventureService.completeAdventure(adventureId, userId, feedback);

  res.json({
    success: true,
    message: 'Adventure completed successfully',
    data: adventure
  });
}));

router.put('/:adventureId/steps', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { adventureId } = req.params;

  const { error, value } = updateStepSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.details.map(detail => detail.message)
    });
  }

  const adventure = await adventureService.updateAdventureStep(
    adventureId, 
    value.stepIndex, 
    userId, 
    value.action
  );

  res.json({
    success: true,
    message: 'Adventure step updated successfully',
    data: adventure
  });
}));

router.get('/:adventureId/recommendations', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { adventureId } = req.params;
  const { limit = '5' } = req.query;

  const adventure = await adventureService.getAdventure(adventureId, userId);
  const recommendations = await adventureService.getAdventureRecommendations(
    userId,
    adventure.startLocation,
    parseInt(limit as string)
  );

  res.json({
    success: true,
    data: recommendations
  });
}));

router.post('/:adventureId/share', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { adventureId } = req.params;

  const { error, value } = shareAdventureSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.details.map(detail => detail.message)
    });
  }

  const adventure = await adventureService.shareAdventure(adventureId, userId, value);

  res.json({
    success: true,
    message: 'Adventure shared successfully',
    data: adventure
  });
}));

router.get('/analytics/overview', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { timeRange = '30d' } = req.query;

  const analytics = await adventureService.getAdventureAnalytics(userId, timeRange as string);

  res.json({
    success: true,
    data: analytics
  });
}));

export default router;

