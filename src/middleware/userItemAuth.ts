import { Request, Response, NextFunction } from 'express';
import UserItem from '../models/UserItem';
import logger from '../utils/logger';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
  };
  item?: any;
  isOwner?: boolean;
  isShared?: boolean;
  isPublic?: boolean;
}

export const verifyItemOwnership = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { itemId } = req.params;
    const userId = req.user?.userId;

    if (!itemId) {
      res.status(400).json({
        success: false,
        message: 'Item ID is required'
      });
      return;
    }

    const item = await UserItem.findOne({ 
      _id: itemId, 
      userId: userId,
      status: { $ne: 'deleted' }
    });

    if (!item) {
      res.status(404).json({
        success: false,
        message: 'Item not found or access denied'
      });
      return;
    }

    req.item = item;
    next();

  } catch (error: any) {
    logger.error('Item ownership verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying item ownership'
    });
  }
};

export const verifySharedItemAccess = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { itemId } = req.params;
    const userId = req.user?.userId;

    if (!itemId) {
      res.status(400).json({
        success: false,
        message: 'Item ID is required'
      });
      return;
    }

    const item = await UserItem.findOne({
      _id: itemId,
      status: { $ne: 'deleted' },
      $or: [
        { userId: userId },
        { 'sharing.sharedWith.userId': userId },
        { 'metadata.isPublic': true }
      ]
    });

    if (!item) {
      res.status(404).json({
        success: false,
        message: 'Item not found or access denied'
      });
      return;
    }

    req.item = item;
    req.isOwner = item.userId.toString() === userId;
    req.isShared = item.sharing?.sharedWith?.some((share: any) => 
      share.userId.toString() === userId
    ) || false;
    req.isPublic = item.metadata?.isPublic || false;

    next();

  } catch (error: any) {
    logger.error('Shared item access verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying item access'
    });
  }
};

export const verifyEditPermission = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.isOwner) {
    res.status(403).json({
      success: false,
      message: 'Permission denied. Only item owner can edit.'
    });
    return;
  }
  next();
};

export const validateUserId = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const userId = req.user?.userId;
  
  if (!userId) {
    res.status(401).json({
      success: false,
      message: 'User ID not found in token'
    });
    return;
  }

  if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
    res.status(400).json({
      success: false,
      message: 'Invalid user ID format'
    });
    return;
  }

  next();
};

export const itemRateLimit = (maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) => {
  const requests = new Map<string, number[]>();

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const now = Date.now();
    const windowStart = now - windowMs;

    if (requests.has(userId)) {
      const userRequests = requests.get(userId)!.filter(time => time > windowStart);
      requests.set(userId, userRequests);
    }

    const currentRequests = requests.get(userId) || [];
    
    if (currentRequests.length >= maxRequests) {
      res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      });
      return;
    }

    currentRequests.push(now);
    requests.set(userId, currentRequests);

    next();
  };
};

export const auditItemOperation = (operation: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const originalSend = res.send.bind(res);
    
    res.send = function(data: any) {
      const logData = {
        operation,
        userId: req.user?.userId,
        itemId: req.params.itemId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date(),
        success: res.statusCode < 400
      };

      logger.info('Item operation audit:', logData);
      
      originalSend(data);
    };

    next();
  };
};

