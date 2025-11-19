import Notification, { INotification, NotificationType } from '../models/Notification';
import logger from '../utils/logger';

class NotificationService {
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;

  async initialize(): Promise<void> {
    try {
      this.startProcessor();
      logger.info('Notification service initialized');
    } catch (error: any) {
      logger.error('Failed to initialize notification service:', error);
    }
  }

  startProcessor(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.intervalId = setInterval(async () => {
      await this.processPendingNotifications();
    }, 30000);

    logger.info('Notification processor started');
  }

  stopProcessor(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('Notification processor stopped');
  }

  async processPendingNotifications(): Promise<void> {
    try {
      const pendingNotifications = await Notification.findPending();
      
      for (const notification of pendingNotifications) {
        await this.sendNotification(notification);
      }

      if (pendingNotifications.length > 0) {
        logger.info(`Processed ${pendingNotifications.length} pending notifications`);
      }
    } catch (error: any) {
      logger.error('Error processing pending notifications:', error);
    }
  }

  async sendNotification(notification: INotification): Promise<void> {
    try {
      for (const channel of notification.channels) {
        switch (channel) {
          case 'push':
            await this.sendPushNotification(notification);
            break;
          case 'email':
            await this.sendEmailNotification(notification);
            break;
          case 'sms':
            await this.sendSMSNotification(notification);
            break;
          case 'in_app':
            await this.sendInAppNotification(notification);
            break;
        }
      }

      await notification.markAsSent();

    } catch (error: any) {
      logger.error(`Failed to send notification ${notification._id}:`, error);
      await notification.markAsFailed(error.message);
    }
  }

  async sendPushNotification(notification: INotification): Promise<boolean> {
    try {
      logger.info(`Sending push notification to user ${notification.userId}: ${notification.message}`);
      return true;
    } catch (error: any) {
      logger.error('Push notification failed:', error);
      throw error;
    }
  }

  async sendEmailNotification(notification: INotification): Promise<boolean> {
    try {
      logger.info(`Sending email notification to user ${notification.userId}: ${notification.message}`);
      return true;
    } catch (error: any) {
      logger.error('Email notification failed:', error);
      throw error;
    }
  }

  async sendSMSNotification(notification: INotification): Promise<boolean> {
    try {
      logger.info(`Sending SMS notification to user ${notification.userId}: ${notification.message}`);
      return true;
    } catch (error: any) {
      logger.error('SMS notification failed:', error);
      throw error;
    }
  }

  async sendInAppNotification(notification: INotification): Promise<boolean> {
    try {
      if ((global as any).io) {
        (global as any).io.to(`user_${notification.userId}`).emit('notification', {
          id: notification._id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          priority: notification.priority,
          timestamp: notification.scheduledFor
        });
      }

      logger.info(`Sent in-app notification to user ${notification.userId}`);
      return true;
    } catch (error: any) {
      logger.error('In-app notification failed:', error);
      throw error;
    }
  }

  async createAdventureNotification(userId: string, type: NotificationType, adventureId: string, message: string, scheduledFor: Date | null = null): Promise<INotification> {
    try {
      const notification = await Notification.createAdventureNotification(
        userId,
        type,
        adventureId,
        message,
        scheduledFor
      );

      logger.info(`Created adventure notification for user ${userId}: ${type}`);
      return notification;
    } catch (error: any) {
      logger.error('Failed to create adventure notification:', error);
      throw error;
    }
  }

  async createEventNotification(userId: string, type: NotificationType, eventId: string, message: string, scheduledFor: Date | null = null): Promise<INotification> {
    try {
      const notification = await Notification.createEventNotification(
        userId,
        type,
        eventId,
        message,
        scheduledFor
      );

      logger.info(`Created event notification for user ${userId}: ${type}`);
      return notification;
    } catch (error: any) {
      logger.error('Failed to create event notification:', error);
      throw error;
    }
  }

  async createFriendNotification(userId: string, type: NotificationType, friendId: string, message: string): Promise<INotification> {
    try {
      const notification = await Notification.createFriendNotification(
        userId,
        type,
        friendId,
        message
      );

      logger.info(`Created friend notification for user ${userId}: ${type}`);
      return notification;
    } catch (error: any) {
      logger.error('Failed to create friend notification:', error);
      throw error;
    }
  }

  async createGamificationNotification(userId: string, type: NotificationType, message: string, data: any = {}): Promise<INotification> {
    try {
      const notification = await Notification.createGamificationNotification(
        userId,
        type,
        message,
        data
      );

      logger.info(`Created gamification notification for user ${userId}: ${type}`);
      return notification;
    } catch (error: any) {
      logger.error('Failed to create gamification notification:', error);
      throw error;
    }
  }

  async scheduleAdventureReminders(adventure: any): Promise<void> {
    try {
      const userId = adventure.userId.toString();
      const adventureId = adventure._id.toString();

      for (let i = 0; i < adventure.steps.length; i++) {
        const step = adventure.steps[i];
        const reminderTime = new Date(step.startTime.getTime() - 15 * 60000);

        if (reminderTime > new Date()) {
          await this.createAdventureNotification(
            userId,
            'step_reminder',
            adventureId,
            `Upcoming: ${step.name} in 15 minutes`,
            reminderTime
          );
        }
      }

      const completionTime = new Date(adventure.steps[adventure.steps.length - 1].endTime);
      await this.createAdventureNotification(
        userId,
        'adventure_completed',
        adventureId,
        'How was your adventure? Leave a review!',
        completionTime
      );

      logger.info(`Scheduled reminders for adventure ${adventureId}`);
    } catch (error: any) {
      logger.error('Failed to schedule adventure reminders:', error);
    }
  }

  async sendWeatherAlert(userId: string, adventureId: string, alert: string): Promise<void> {
    try {
      await this.createAdventureNotification(
        userId,
        'weather_alert',
        adventureId,
        `Weather Alert: ${alert}`,
        new Date()
      );

      logger.info(`Sent weather alert to user ${userId}`);
    } catch (error: any) {
      logger.error('Failed to send weather alert:', error);
    }
  }

  async sendVenueChangeAlert(userId: string, adventureId: string, oldVenue: string, newVenue: string): Promise<void> {
    try {
      const message = `Venue change: ${oldVenue} is now ${newVenue}`;
      await this.createAdventureNotification(
        userId,
        'venue_change',
        adventureId,
        message,
        new Date()
      );

      logger.info(`Sent venue change alert to user ${userId}`);
    } catch (error: any) {
      logger.error('Failed to send venue change alert:', error);
    }
  }

  async sendFriendJoinedNotification(userId: string, friendId: string, adventureId: string): Promise<void> {
    try {
      const message = `Your friend joined your adventure!`;
      await this.createAdventureNotification(
        userId,
        'friend_joined',
        adventureId,
        message,
        new Date()
      );

      logger.info(`Sent friend joined notification to user ${userId}`);
    } catch (error: any) {
      logger.error('Failed to send friend joined notification:', error);
    }
  }

  async sendBadgeEarnedNotification(userId: string, badge: string): Promise<void> {
    try {
      await this.createGamificationNotification(
        userId,
        'badge_earned',
        `Congratulations! You earned the "${badge}" badge!`,
        { badge }
      );

      logger.info(`Sent badge earned notification to user ${userId}`);
    } catch (error: any) {
      logger.error('Failed to send badge earned notification:', error);
    }
  }

  async sendPointsEarnedNotification(userId: string, points: number, reason: string): Promise<void> {
    try {
      await this.createGamificationNotification(
        userId,
        'points_earned',
        `You earned ${points} points for ${reason}!`,
        { points, reason }
      );

      logger.info(`Sent points earned notification to user ${userId}`);
    } catch (error: any) {
      logger.error('Failed to send points earned notification:', error);
    }
  }

  async sendStreakReminder(userId: string, streak: number): Promise<void> {
    try {
      await this.createGamificationNotification(
        userId,
        'streak_reminder',
        `You're on a ${streak} day adventure streak! Keep it going!`,
        { streak }
      );

      logger.info(`Sent streak reminder to user ${userId}`);
    } catch (error: any) {
      logger.error('Failed to send streak reminder:', error);
    }
  }

  async cleanupOldNotifications(daysOld: number = 30): Promise<any> {
    try {
      const result = await Notification.cleanup(daysOld);
      logger.info(`Cleaned up ${result.deletedCount} old notifications`);
      return result;
    } catch (error: any) {
      logger.error('Failed to cleanup old notifications:', error);
      throw error;
    }
  }

  async getNotificationStats(): Promise<any> {
    try {
      const stats = await Notification.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const total = await Notification.countDocuments();
      const pending = await Notification.countDocuments({ status: 'pending' });
      const sent = await Notification.countDocuments({ status: 'sent' });
      const failed = await Notification.countDocuments({ status: 'failed' });

      return {
        total,
        pending,
        sent,
        failed,
        breakdown: stats
      };
    } catch (error: any) {
      logger.error('Failed to get notification stats:', error);
      throw error;
    }
  }
}

export default new NotificationService();

