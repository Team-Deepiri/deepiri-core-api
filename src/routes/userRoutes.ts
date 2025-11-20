import express, { Response } from 'express';
import Joi from 'joi';
import userService from '../services/userService';
import logger from '../utils/logger';
import { AuthenticatedRequest } from '../types';

const router = express.Router();

const updateUserSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  profilePicture: Joi.string().uri().optional(),
  bio: Joi.string().max(500).optional(),
  location: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
    address: Joi.string().required()
  }).optional()
});

const updatePreferencesSchema = Joi.object({
  interests: Joi.array().items(Joi.string()).optional(),
  skillLevel: Joi.string().valid('beginner', 'intermediate', 'advanced').optional(),
  maxDistance: Joi.number().min(1000).max(20000).optional(),
  preferredDuration: Joi.number().min(30).max(90).optional(),
  socialMode: Joi.string().valid('solo', 'friends', 'meet_new_people').optional(),
  budget: Joi.string().valid('low', 'medium', 'high').optional(),
  timePreferences: Joi.object({
    morning: Joi.boolean().optional(),
    afternoon: Joi.boolean().optional(),
    evening: Joi.boolean().optional(),
    night: Joi.boolean().optional()
  }).optional()
});

const addFriendSchema = Joi.object({
  friendId: Joi.string().required()
});

const searchUsersSchema = Joi.object({
  query: Joi.string().min(2).required(),
  limit: Joi.number().min(1).max(50).optional()
});

const addFavoriteVenueSchema = Joi.object({
  venueId: Joi.string().required(),
  name: Joi.string().required(),
  type: Joi.string().required(),
  location: Joi.object({
    lat: Joi.number().required(),
    lng: Joi.number().required(),
    address: Joi.string().required()
  }).required()
});

router.get('/profile', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const user = await userService.getUserById(userId);

    res.json({
      success: true,
      data: user.getPublicProfile()
    });

  } catch (error: any) {
    logger.error('Failed to get user profile:', error);
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
});

router.put('/profile', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    const { error, value } = updateUserSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const user = await userService.updateUser(userId, value);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: user.getPublicProfile()
    });

  } catch (error: any) {
    logger.error('Failed to update user profile:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.put('/preferences', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    const { error, value } = updatePreferencesSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const user = await userService.updateUserPreferences(userId, value);

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: user.preferences
    });

  } catch (error: any) {
    logger.error('Failed to update user preferences:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.put('/location', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { lat, lng, address } = req.body;

    if (!lat || !lng || !address) {
      res.status(400).json({
        success: false,
        message: 'Latitude, longitude, and address are required'
      });
      return;
    }

    const location = { lat: parseFloat(lat), lng: parseFloat(lng), address };
    const user = await userService.updateUserLocation(userId, location);

    res.json({
      success: true,
      message: 'Location updated successfully',
      data: user.location
    });

  } catch (error: any) {
    logger.error('Failed to update user location:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const stats = await userService.getUserStats(userId);

    res.json({
      success: true,
      data: stats
    });

  } catch (error: any) {
    logger.error('Failed to get user stats:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/friends', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const friends = await userService.getFriends(userId);

    res.json({
      success: true,
      data: friends
    });

  } catch (error: any) {
    logger.error('Failed to get friends:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/friends', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    const { error, value } = addFriendSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const result = await userService.addFriend(userId, value.friendId);

    res.json({
      success: true,
      message: 'Friend added successfully',
      data: {
        friend: result.friend.getPublicProfile()
      }
    });

  } catch (error: any) {
    logger.error('Failed to add friend:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.delete('/friends/:friendId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { friendId } = req.params;

    const result = await userService.removeFriend(userId, friendId);

    res.json({
      success: true,
      message: 'Friend removed successfully',
      data: {
        friend: result.friend.getPublicProfile()
      }
    });

  } catch (error: any) {
    logger.error('Failed to remove friend:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/search', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    const { error, value } = searchUsersSchema.validate(req.query);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const users = await userService.searchUsers(value.query, userId, value.limit);

    res.json({
      success: true,
      data: users
    });

  } catch (error: any) {
    logger.error('Failed to search users:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/favorite-venues', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const user = await userService.getUserById(userId);

    res.json({
      success: true,
      data: user.favoriteVenues
    });

  } catch (error: any) {
    logger.error('Failed to get favorite venues:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/favorite-venues', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    const { error, value } = addFavoriteVenueSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const user = await userService.addFavoriteVenue(userId, value);

    res.json({
      success: true,
      message: 'Venue added to favorites',
      data: user.favoriteVenues
    });

  } catch (error: any) {
    logger.error('Failed to add favorite venue:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.delete('/favorite-venues/:venueId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { venueId } = req.params;

    const user = await userService.removeFavoriteVenue(userId, venueId);

    res.json({
      success: true,
      message: 'Venue removed from favorites',
      data: user.favoriteVenues
    });

  } catch (error: any) {
    logger.error('Failed to remove favorite venue:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/leaderboard', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const timeRange = (req.query.timeRange as string) || '30d';
    const limit = parseInt(req.query.limit as string) || 50;
    const leaderboard = await userService.getUserLeaderboard(timeRange, limit);

    res.json({
      success: true,
      data: leaderboard
    });

  } catch (error: any) {
    logger.error('Failed to get leaderboard:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/:userId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const user = await userService.getUserById(userId);

    res.json({
      success: true,
      data: user.getPublicProfile()
    });

  } catch (error: any) {
    logger.error('Failed to get user:', error);
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
});

router.delete('/account', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { password } = req.body;

    if (!password) {
      res.status(400).json({
        success: false,
        message: 'Password is required to delete account'
      });
      return;
    }

    const user = await userService.getUserById(userId);
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
      return;
    }

    await userService.deleteUser(userId);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });

  } catch (error: any) {
    logger.error('Failed to delete user account:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

export default router;

