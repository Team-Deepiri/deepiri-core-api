import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import Joi from 'joi';
import Event from '../models/Event';
import { secureLog } from '../utils/secureLogger';
import { AuthenticatedRequest } from '../types';

const router = express.Router();

const createEventSchema = Joi.object({
  name: Joi.string().min(2).max(150).required(),
  description: Joi.string().max(1000).optional(),
  type: Joi.string().valid('bar', 'restaurant', 'concert', 'popup', 'meetup', 'party', 'workshop', 'sports', 'cultural', 'outdoor').required(),
  category: Joi.string().valid('nightlife', 'music', 'food', 'social', 'culture', 'sports', 'outdoor', 'art', 'education').required(),
  location: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
    address: Joi.string().required()
  }).required(),
  startTime: Joi.date().required(),
  endTime: Joi.date().required(),
  capacity: Joi.number().min(1).max(1000).optional(),
  price: Joi.object({
    amount: Joi.number().min(0).optional(),
    currency: Joi.string().default('USD'),
    isFree: Joi.boolean().default(true)
  }).optional(),
  requirements: Joi.object({
    ageRestriction: Joi.object({
      min: Joi.number().min(0).optional(),
      max: Joi.number().max(120).optional()
    }).optional(),
    skillLevel: Joi.string().valid('beginner', 'intermediate', 'advanced', 'any').optional(),
    equipment: Joi.array().items(Joi.string()).optional(),
    dressCode: Joi.string().optional()
  }).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  visibility: Joi.string().valid('public', 'friends', 'private').default('public')
});

const updateEventSchema = Joi.object({
  name: Joi.string().min(2).max(150).optional(),
  description: Joi.string().max(1000).optional(),
  startTime: Joi.date().optional(),
  endTime: Joi.date().optional(),
  capacity: Joi.number().min(1).max(1000).optional(),
  price: Joi.object({
    amount: Joi.number().min(0).optional(),
    currency: Joi.string().optional(),
    isFree: Joi.boolean().optional()
  }).optional(),
  requirements: Joi.object({
    ageRestriction: Joi.object({
      min: Joi.number().min(0).optional(),
      max: Joi.number().max(120).optional()
    }).optional(),
    skillLevel: Joi.string().valid('beginner', 'intermediate', 'advanced', 'any').optional(),
    equipment: Joi.array().items(Joi.string()).optional(),
    dressCode: Joi.string().optional()
  }).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  visibility: Joi.string().valid('public', 'friends', 'private').optional()
});

const reviewEventSchema = Joi.object({
  rating: Joi.number().min(1).max(5).required(),
  comment: Joi.string().max(500).optional()
});

router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    const { error, value } = createEventSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const event = new Event({
      ...value,
      host: {
        userId: userId,
        name: req.user!.name || 'Anonymous',
        email: req.user!.email,
        isUserHosted: true
      },
      status: 'published'
    });

    await event.save();

    if (req.io) {
      req.io.emit('event_created', {
        eventId: event._id,
        name: event.name,
        message: 'New event created!'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: event
    });

  } catch (error: any) {
    secureLog('error', 'Event creation failed:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/nearby', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { lat, lng, radius = '5000', category, limit = '20', offset = '0' } = req.query;

    if (!lat || !lng) {
      res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
      return;
    }

    const location = { lat: parseFloat(lat as string), lng: parseFloat(lng as string) };
    const startTime = req.query.startTime ? new Date(req.query.startTime as string) : new Date();
    const endTime = req.query.endTime ? new Date(req.query.endTime as string) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    let events;
    if (category) {
      events = await Event.findByCategory(category as string, location.lat, location.lng, parseInt(radius as string));
    } else {
      events = await Event.findByLocationAndTime(location.lat, location.lng, parseInt(radius as string), startTime, endTime);
    }

    const paginatedEvents = events.slice(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string));

    res.json({
      success: true,
      data: paginatedEvents,
      pagination: {
        total: events.length,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: events.length > parseInt(offset as string) + parseInt(limit as string)
      }
    });

  } catch (error: any) {
    secureLog('error', 'Failed to get nearby events:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/:eventId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId)
      .populate('host.userId', 'name profilePicture')
      .populate('attendees.userId', 'name profilePicture')
      .populate('reviews.userId', 'name profilePicture');

    if (!event) {
      res.status(404).json({
        success: false,
        message: 'Event not found'
      });
      return;
    }

    res.json({
      success: true,
      data: event
    });

  } catch (error: any) {
    secureLog('error', 'Failed to get event:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.put('/:eventId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { eventId } = req.params;

    const { error, value } = updateEventSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const event = await Event.findOne({
      _id: eventId,
      'host.userId': userId
    });

    if (!event) {
      res.status(404).json({
        success: false,
        message: 'Event not found or you are not the host'
      });
      return;
    }

    Object.assign(event, value);
    await event.save();

    if (req.io) {
      req.io.to(`event_${eventId}`).emit('event_updated', {
        eventId: event._id,
        name: event.name,
        message: 'Event has been updated'
      });
    }

    res.json({
      success: true,
      message: 'Event updated successfully',
      data: event
    });

  } catch (error: any) {
    secureLog('error', 'Failed to update event:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/:eventId/join', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      res.status(404).json({
        success: false,
        message: 'Event not found'
      });
      return;
    }

    await event.addAttendee(new mongoose.Types.ObjectId(userId));

    if (req.io) {
      req.io.to(`event_${eventId}`).emit('user_joined', {
        userId: userId,
        eventId: eventId,
        message: 'Someone joined the event'
      });
    }

    res.json({
      success: true,
      message: 'Successfully joined event',
      data: event
    });

  } catch (error: any) {
    secureLog('error', 'Failed to join event:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/:eventId/leave', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      res.status(404).json({
        success: false,
        message: 'Event not found'
      });
      return;
    }

    await event.removeAttendee(new mongoose.Types.ObjectId(userId));

    if (req.io) {
      req.io.to(`event_${eventId}`).emit('user_left', {
        userId: userId,
        eventId: eventId,
        message: 'Someone left the event'
      });
    }

    res.json({
      success: true,
      message: 'Successfully left event',
      data: event
    });

  } catch (error: any) {
    secureLog('error', 'Failed to leave event:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/:eventId/review', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { eventId } = req.params;

    const { error, value } = reviewEventSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const event = await Event.findById(eventId);
    if (!event) {
      res.status(404).json({
        success: false,
        message: 'Event not found'
      });
      return;
    }

    await event.addReview(new mongoose.Types.ObjectId(userId), value.rating, value.comment);

    res.json({
      success: true,
      message: 'Review added successfully',
      data: event
    });

  } catch (error: any) {
    secureLog('error', 'Failed to add review:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/:eventId/cancel', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { eventId } = req.params;

    const event = await Event.findOne({
      _id: eventId,
      'host.userId': userId
    });

    if (!event) {
      res.status(404).json({
        success: false,
        message: 'Event not found or you are not the host'
      });
      return;
    }

    await event.updateStatus('cancelled');

    if (req.io) {
      req.io.to(`event_${eventId}`).emit('event_cancelled', {
        eventId: event._id,
        name: event.name,
        message: 'Event has been cancelled'
      });
    }

    res.json({
      success: true,
      message: 'Event cancelled successfully',
      data: event
    });

  } catch (error: any) {
    secureLog('error', 'Failed to cancel event:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/user/events', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const type = (req.query.type as string) || 'all';
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    let query: any = {};
    if (type === 'hosted') {
      query = { 'host.userId': userId };
    } else if (type === 'attending') {
      query = { 'attendees.userId': userId };
    } else {
      query = {
        $or: [
          { 'host.userId': userId },
          { 'attendees.userId': userId }
        ]
      };
    }

    const events = await Event.find(query)
      .sort({ startTime: -1 })
      .limit(limit)
      .skip(offset)
      .populate('host.userId', 'name profilePicture')
      .populate('attendees.userId', 'name profilePicture');

    res.json({
      success: true,
      data: events
    });

  } catch (error: any) {
    secureLog('error', 'Failed to get user events:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/categories', async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = [
      { id: 'nightlife', name: 'Nightlife', icon: '🌃' },
      { id: 'music', name: 'Music', icon: '🎵' },
      { id: 'food', name: 'Food & Drink', icon: '🍽️' },
      { id: 'social', name: 'Social', icon: '👥' },
      { id: 'culture', name: 'Culture', icon: '🎭' },
      { id: 'sports', name: 'Sports', icon: '⚽' },
      { id: 'outdoor', name: 'Outdoor', icon: '🌲' },
      { id: 'art', name: 'Art', icon: '🎨' },
      { id: 'education', name: 'Education', icon: '📚' }
    ];

    res.json({
      success: true,
      data: categories
    });

  } catch (error: any) {
    secureLog('error', 'Failed to get categories:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;

