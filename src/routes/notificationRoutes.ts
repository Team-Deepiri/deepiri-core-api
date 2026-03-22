import express, { Response } from 'express';
import Notification from '../models/Notification';
import { secureLog } from '../utils/secureLogger';
import { AuthenticatedRequest } from '../types';

const router = express.Router();

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const unreadOnly = req.query.unreadOnly === 'true';

    const notifications = await Notification.findForUser(userId, limit);

    res.json({
      success: true,
      data: notifications
    });

  } catch (error: any) {
    secureLog('error', 'Failed to get notifications:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.put('/:notificationId/read', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { notificationId } = req.params;

    const notification = await Notification.findOne({
      _id: notificationId,
      userId: userId
    });

    if (!notification) {
      res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
      return;
    }

    await notification.markAsRead();

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });

  } catch (error: any) {
    secureLog('error', 'Failed to mark notification as read:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.put('/read-all', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    await Notification.updateMany(
      { userId: userId, status: { $in: ['pending', 'sent', 'delivered'] } },
      { status: 'read', readAt: new Date() }
    );

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });

  } catch (error: any) {
    secureLog('error', 'Failed to mark all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.delete('/:notificationId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      userId: userId
    });

    if (!notification) {
      res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });

  } catch (error: any) {
    secureLog('error', 'Failed to delete notification:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/settings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const settings = {
      push: true,
      email: true,
      sms: false,
      adventureReminders: true,
      eventReminders: true,
      friendActivity: true,
      systemAnnouncements: true
    };

    res.json({
      success: true,
      data: settings
    });

  } catch (error: any) {
    secureLog('error', 'Failed to get notification settings:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.put('/settings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const settings = req.body;

    secureLog('info', `User ${userId} updated notification settings:`, settings);

    res.json({
      success: true,
      message: 'Notification settings updated successfully',
      data: settings
    });

  } catch (error: any) {
    secureLog('error', 'Failed to update notification settings:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/unread/count', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const count = await Notification.countDocuments({
      userId: userId,
      status: { $in: ['pending', 'sent', 'delivered'] }
    });

    res.json({
      success: true,
      data: { count }
    });

  } catch (error: any) {
    secureLog('error', 'Failed to get unread notification count:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;

