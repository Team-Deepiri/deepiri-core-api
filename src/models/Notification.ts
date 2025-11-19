import mongoose, { Schema, Document, Model } from 'mongoose';

export type NotificationType = 
  | 'adventure_generated' | 'step_reminder' | 'weather_alert' | 'venue_change'
  | 'friend_joined' | 'friend_invited' | 'event_reminder' | 'event_cancelled'
  | 'event_updated' | 'badge_earned' | 'points_earned' | 'streak_reminder'
  | 'adventure_completed' | 'new_event_nearby' | 'friend_adventure_shared' | 'system_announcement';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  data?: {
    adventureId?: mongoose.Types.ObjectId;
    eventId?: mongoose.Types.ObjectId;
    stepIndex?: number;
    points?: number;
    badge?: string;
    friendId?: mongoose.Types.ObjectId;
    metadata?: any;
  };
  priority: 'low' | 'medium' | 'high' | 'urgent';
  channels: ('push' | 'email' | 'sms' | 'in_app')[];
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  scheduledFor: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  expiresAt?: Date;
  retryCount: number;
  errorMessage?: string;
  metadata?: {
    source?: string;
    campaign?: string;
    version?: string;
  };
  markAsSent(): Promise<INotification>;
  markAsDelivered(): Promise<INotification>;
  markAsRead(): Promise<INotification>;
  markAsFailed(errorMessage: string): Promise<INotification>;
  reschedule(newTime: Date): Promise<INotification>;
}

interface INotificationModel extends Model<INotification> {
  findPending(): Promise<INotification[]>;
  findOverdue(): Promise<INotification[]>;
  findForUser(userId: string, limit?: number): Promise<INotification[]>;
  createAdventureNotification(userId: string, type: NotificationType, adventureId: string, message: string, scheduledFor?: Date): Promise<INotification>;
  createEventNotification(userId: string, type: NotificationType, eventId: string, message: string, scheduledFor?: Date): Promise<INotification>;
  createFriendNotification(userId: string, type: NotificationType, friendId: string, message: string): Promise<INotification>;
  createGamificationNotification(userId: string, type: NotificationType, message: string, data?: any): Promise<INotification>;
  cleanup(daysOld?: number): Promise<any>;
}

const notificationSchema = new Schema<INotification>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: [
      'adventure_generated', 'step_reminder', 'weather_alert', 'venue_change',
      'friend_joined', 'friend_invited', 'event_reminder', 'event_cancelled',
      'event_updated', 'badge_earned', 'points_earned', 'streak_reminder',
      'adventure_completed', 'new_event_nearby', 'friend_adventure_shared', 'system_announcement'
    ],
    required: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  message: {
    type: String,
    required: true,
    maxlength: 500
  },
  data: {
    adventureId: {
      type: Schema.Types.ObjectId,
      ref: 'Adventure'
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event'
    },
    stepIndex: Number,
    points: Number,
    badge: String,
    friendId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    metadata: Schema.Types.Mixed
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  channels: [{
    type: String,
    enum: ['push', 'email', 'sms', 'in_app'],
    default: ['push', 'in_app']
  }],
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
    default: 'pending'
  },
  scheduledFor: {
    type: Date,
    default: Date.now
  },
  sentAt: Date,
  deliveredAt: Date,
  readAt: Date,
  expiresAt: Date,
  retryCount: {
    type: Number,
    default: 0,
    max: 3
  },
  errorMessage: String,
  metadata: {
    source: String,
    campaign: String,
    version: { type: String, default: '2.0' }
  }
}, {
  timestamps: true
});

notificationSchema.index({ userId: 1, status: 1 });
notificationSchema.index({ scheduledFor: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ 'data.adventureId': 1 });
notificationSchema.index({ 'data.eventId': 1 });

notificationSchema.virtual('timeUntilScheduled').get(function() {
  if (!this.scheduledFor) return 0;
  return Math.max(0, this.scheduledFor.getTime() - Date.now());
});

notificationSchema.virtual('isOverdue').get(function() {
  return this.scheduledFor && this.scheduledFor < new Date() && this.status === 'pending';
});

notificationSchema.methods.markAsSent = function() {
  this.status = 'sent';
  this.sentAt = new Date();
  return this.save();
};

notificationSchema.methods.markAsDelivered = function() {
  this.status = 'delivered';
  this.deliveredAt = new Date();
  return this.save();
};

notificationSchema.methods.markAsRead = function() {
  this.status = 'read';
  this.readAt = new Date();
  return this.save();
};

notificationSchema.methods.markAsFailed = function(errorMessage: string) {
  this.status = 'failed';
  this.errorMessage = errorMessage;
  this.retryCount += 1;
  return this.save();
};

notificationSchema.methods.reschedule = function(newTime: Date) {
  this.scheduledFor = newTime;
  this.status = 'pending';
  return this.save();
};

notificationSchema.statics.findPending = function() {
  return this.find({
    status: 'pending',
    scheduledFor: { $lte: new Date() },
    retryCount: { $lt: 3 }
  });
};

notificationSchema.statics.findOverdue = function() {
  return this.find({
    status: 'pending',
    scheduledFor: { $lt: new Date() },
    retryCount: { $lt: 3 }
  });
};

notificationSchema.statics.findForUser = function(userId: string, limit: number = 50) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('data.adventureId', 'name status')
    .populate('data.eventId', 'name startTime')
    .populate('data.friendId', 'name profilePicture');
};

notificationSchema.statics.createAdventureNotification = function(userId: string, type: NotificationType, adventureId: string, message: string, scheduledFor: Date | null = null) {
  return this.create({
    userId,
    type,
    title: 'Adventure Update',
    message,
    data: { adventureId },
    scheduledFor: scheduledFor || new Date(),
    priority: type === 'weather_alert' ? 'high' : 'medium'
  });
};

notificationSchema.statics.createEventNotification = function(userId: string, type: NotificationType, eventId: string, message: string, scheduledFor: Date | null = null) {
  return this.create({
    userId,
    type,
    title: 'Event Update',
    message,
    data: { eventId },
    scheduledFor: scheduledFor || new Date(),
    priority: type === 'event_cancelled' ? 'high' : 'medium'
  });
};

notificationSchema.statics.createFriendNotification = function(userId: string, type: NotificationType, friendId: string, message: string) {
  return this.create({
    userId,
    type,
    title: 'Friend Activity',
    message,
    data: { friendId },
    priority: 'low'
  });
};

notificationSchema.statics.createGamificationNotification = function(userId: string, type: NotificationType, message: string, data: any = {}) {
  return this.create({
    userId,
    type,
    title: 'Achievement Unlocked!',
    message,
    data,
    priority: 'medium'
  });
};

notificationSchema.statics.cleanup = function(daysOld: number = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.deleteMany({
    createdAt: { $lt: cutoffDate },
    status: { $in: ['read', 'failed'] }
  });
};

const Notification = mongoose.model<INotification, INotificationModel>('Notification', notificationSchema);
export default Notification;

