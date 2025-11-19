import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IBadge extends Document {
  name: string;
  icon: string;
  description: string;
  category: 'streak' | 'completion' | 'efficiency' | 'social' | 'special' | 'milestone';
  criteria: {
    type: 'streak' | 'tasks_completed' | 'challenges_completed' | 'efficiency' | 'points' | 'custom';
    value: number;
    description?: string;
  };
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  pointsReward: number;
  isActive: boolean;
  createdAt?: Date;
}

const badgeSchema = new Schema<IBadge>({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  icon: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  category: {
    type: String,
    enum: ['streak', 'completion', 'efficiency', 'social', 'special', 'milestone'],
    required: true
  },
  criteria: {
    type: {
      type: String,
      enum: ['streak', 'tasks_completed', 'challenges_completed', 'efficiency', 'points', 'custom'],
      required: true
    },
    value: {
      type: Number,
      required: true
    },
    description: String
  },
  rarity: {
    type: String,
    enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
    default: 'common'
  },
  pointsReward: {
    type: Number,
    default: 50,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

badgeSchema.index({ category: 1 });
badgeSchema.index({ rarity: 1 });
badgeSchema.index({ isActive: 1 });

const Badge: Model<IBadge> = mongoose.model<IBadge>('Badge', badgeSchema);
export default Badge;

