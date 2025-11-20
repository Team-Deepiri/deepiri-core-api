import express, { Response } from 'express';
import Joi from 'joi';
import userItemService from '../services/userItemService';
import logger from '../utils/logger';
import {
  verifyItemOwnership,
  verifySharedItemAccess,
  verifyEditPermission,
  validateUserId,
  itemRateLimit,
  auditItemOperation
} from '../middleware/userItemAuth';
import { AuthenticatedRequest, UserItemRequest } from '../types';

const router = express.Router();

router.use(validateUserId);
router.use(itemRateLimit(100, 15 * 60 * 1000));

const createItemSchema = Joi.object({
  name: Joi.string().min(1).max(200).required(),
  description: Joi.string().max(1000).optional(),
  category: Joi.string().valid(
    'adventure_gear', 'collectible', 'badge', 'achievement', 
    'souvenir', 'memory', 'photo', 'ticket', 'certificate',
    'virtual_item', 'reward', 'token', 'other'
  ).required(),
  type: Joi.string().valid(
    'physical', 'digital', 'virtual', 'achievement', 
    'badge', 'token', 'memory', 'experience'
  ).required(),
  rarity: Joi.string().valid('common', 'uncommon', 'rare', 'epic', 'legendary').optional(),
  value: Joi.object({
    points: Joi.number().min(0).optional(),
    coins: Joi.number().min(0).optional(),
    monetaryValue: Joi.number().min(0).optional(),
    currency: Joi.string().optional()
  }).optional(),
  properties: Joi.object().optional(),
  source: Joi.string().valid('adventure', 'event', 'purchase', 'gift', 'achievement', 'reward', 'other').optional(),
  sourceId: Joi.string().optional(),
  sourceName: Joi.string().optional(),
  acquiredAt: Joi.date().optional(),
  acquiredLocation: Joi.object().optional(),
  media: Joi.object().optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  isPublic: Joi.boolean().optional(),
  isFavorite: Joi.boolean().optional(),
  notes: Joi.string().optional()
});

const updateItemSchema = Joi.object({
  name: Joi.string().min(1).max(200).optional(),
  description: Joi.string().max(1000).optional(),
  rarity: Joi.string().valid('common', 'uncommon', 'rare', 'epic', 'legendary').optional(),
  value: Joi.object().optional(),
  properties: Joi.object().optional(),
  media: Joi.object().optional(),
  metadata: Joi.object().optional()
});

const addMemorySchema = Joi.object({
  title: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).optional(),
  date: Joi.date().optional(),
  emotion: Joi.string().valid('happy', 'excited', 'nostalgic', 'proud', 'grateful', 'adventurous').optional()
});

const shareItemSchema = Joi.object({
  sharedWith: Joi.array().items(Joi.object({
    userId: Joi.string().required(),
    permission: Joi.string().valid('view', 'comment', 'edit').optional()
  })).optional(),
  isPublic: Joi.boolean().optional()
});

router.get('/', auditItemOperation('list'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const {
      category = 'all',
      status = 'active',
      isFavorite,
      isPublic,
      tags,
      sort = 'createdAt',
      order = 'desc',
      limit = '50',
      page = '1'
    } = req.query;

    const options: any = {
      category,
      status,
      limit: parseInt(limit as string),
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      sort: { [sort as string]: order === 'desc' ? -1 : 1 }
    };

    if (isFavorite !== undefined) {
      options.isFavorite = isFavorite === 'true';
    }

    if (isPublic !== undefined) {
      options.isPublic = isPublic === 'true';
    }

    if (tags) {
      options.tags = Array.isArray(tags) ? tags : (tags as string).split(',');
    }

    const items = await userItemService.getUserItems(userId, options);

    res.json({
      success: true,
      data: items,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: items.length
      }
    });

  } catch (error: any) {
    logger.error('Failed to get user items:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/stats', auditItemOperation('stats'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const stats = await userItemService.getUserItemStats(userId);

    res.json({
      success: true,
      data: stats
    });

  } catch (error: any) {
    logger.error('Failed to get user item stats:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/search', auditItemOperation('search'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { q: searchQuery, category, tags, limit = '20', page = '1' } = req.query;

    if (!searchQuery) {
      res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
      return;
    }

    const options: any = {
      category,
      limit: parseInt(limit as string),
      skip: (parseInt(page as string) - 1) * parseInt(limit as string)
    };

    if (tags) {
      options.tags = Array.isArray(tags) ? tags : (tags as string).split(',');
    }

    const items = await userItemService.searchUserItems(userId, searchQuery as string, options);

    res.json({
      success: true,
      data: items,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      }
    });

  } catch (error: any) {
    logger.error('Failed to search user items:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/shared', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 20;
    const page = parseInt(req.query.page as string) || 1;

    const options = {
      limit,
      skip: (page - 1) * limit
    };

    const items = await userItemService.getSharedItems(userId, options);

    res.json({
      success: true,
      data: items,
      pagination: {
        page,
        limit
      }
    });

  } catch (error: any) {
    logger.error('Failed to get shared items:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/public', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { category, limit = '50', page = '1', sort = 'createdAt', order = 'desc' } = req.query;

    const options: any = {
      category,
      limit: parseInt(limit as string),
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      sort: { [sort as string]: order === 'desc' ? -1 : 1 }
    };

    const items = await userItemService.getPublicItems(options);

    res.json({
      success: true,
      data: items,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      }
    });

  } catch (error: any) {
    logger.error('Failed to get public items:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/export', auditItemOperation('export'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const format = (req.query.format as string) || 'json';

    const items = await userItemService.exportUserItems(userId, format);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=user_items.csv');
      res.send(items);
    } else {
      res.json({
        success: true,
        data: items
      });
    }

  } catch (error: any) {
    logger.error('Failed to export user items:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/:itemId', verifySharedItemAccess, auditItemOperation('view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { itemId } = req.params;

    const item = await userItemService.getUserItemById(userId, itemId);

    res.json({
      success: true,
      data: item
    });

  } catch (error: any) {
    logger.error('Failed to get user item:', error);
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/', auditItemOperation('create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    const { error, value } = createItemSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const item = await userItemService.createUserItem(userId, value);

    res.status(201).json({
      success: true,
      message: 'Item created successfully',
      data: item
    });

  } catch (error: any) {
    logger.error('Failed to create user item:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/bulk', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Items array is required and must not be empty'
      });
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const { error } = createItemSchema.validate(items[i]);
      if (error) {
        res.status(400).json({
          success: false,
          message: `Validation error in item ${i + 1}`,
          errors: error.details.map(detail => detail.message)
        });
        return;
      }
    }

    const createdItems = await userItemService.bulkCreateItems(userId, items);

    res.status(201).json({
      success: true,
      message: `${createdItems.length} items created successfully`,
      data: createdItems
    });

  } catch (error: any) {
    logger.error('Failed to bulk create user items:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.put('/:itemId', verifyItemOwnership, auditItemOperation('update'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { itemId } = req.params;
    
    const { error, value } = updateItemSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const item = await userItemService.updateUserItem(userId, itemId, value);

    res.json({
      success: true,
      message: 'Item updated successfully',
      data: item
    });

  } catch (error: any) {
    logger.error('Failed to update user item:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.patch('/:itemId/favorite', verifyItemOwnership, auditItemOperation('toggle_favorite'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { itemId } = req.params;

    const item = await userItemService.toggleFavorite(userId, itemId);

    res.json({
      success: true,
      message: `Item ${item.metadata.isFavorite ? 'added to' : 'removed from'} favorites`,
      data: { isFavorite: item.metadata.isFavorite }
    });

  } catch (error: any) {
    logger.error('Failed to toggle favorite:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/:itemId/memories', verifyItemOwnership, auditItemOperation('add_memory'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { itemId } = req.params;
    
    const { error, value } = addMemorySchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const item = await userItemService.addItemMemory(userId, itemId, value);

    res.json({
      success: true,
      message: 'Memory added successfully',
      data: item.metadata.memories
    });

  } catch (error: any) {
    logger.error('Failed to add memory:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/:itemId/share', verifyItemOwnership, auditItemOperation('share'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { itemId } = req.params;
    
    const { error, value } = shareItemSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }

    const item = await userItemService.shareItem(userId, itemId, value);

    res.json({
      success: true,
      message: 'Item shared successfully',
      data: item.sharing
    });

  } catch (error: any) {
    logger.error('Failed to share item:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.delete('/:itemId', verifyItemOwnership, auditItemOperation('delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { itemId } = req.params;
    const permanent = req.query.permanent === 'true';

    await userItemService.deleteUserItem(userId, itemId, permanent);

    res.json({
      success: true,
      message: `Item ${permanent ? 'permanently deleted' : 'moved to trash'}`
    });

  } catch (error: any) {
    logger.error('Failed to delete user item:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

export default router;

