import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUserItem extends Document {
  userId: mongoose.Types.ObjectId;
  itemId: string;
  name: string;
  description?: string;
  category: 'adventure_gear' | 'collectible' | 'badge' | 'achievement' | 'souvenir' | 'memory' | 'photo' | 'ticket' | 'certificate' | 'virtual_item' | 'reward' | 'token' | 'other';
  type: 'physical' | 'digital' | 'virtual' | 'achievement' | 'badge' | 'token' | 'memory' | 'experience';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  value: {
    points?: number;
    coins?: number;
    monetaryValue?: number;
    currency?: string;
  };
  properties?: {
    color?: string;
    size?: string;
    weight?: number;
    material?: string;
    brand?: string;
    condition?: 'new' | 'excellent' | 'good' | 'fair' | 'poor';
    customAttributes?: Array<{
      key: string;
      value: any;
    }>;
  };
  location: {
    source: 'adventure' | 'event' | 'purchase' | 'gift' | 'achievement' | 'reward' | 'other';
    sourceId?: string;
    sourceName?: string;
    acquiredAt: Date;
    acquiredLocation?: {
      lat?: number;
      lng?: number;
      address?: string;
      venue?: string;
    };
  };
  media?: {
    images?: Array<{
      url?: string;
      caption?: string;
      isPrimary?: boolean;
    }>;
    videos?: Array<{
      url?: string;
      caption?: string;
      thumbnail?: string;
    }>;
    documents?: Array<{
      url?: string;
      name?: string;
      type?: string;
    }>;
  };
  metadata: {
    tags?: string[];
    isPublic?: boolean;
    isFavorite?: boolean;
    isArchived?: boolean;
    notes?: string;
    memories?: Array<{
      title?: string;
      description?: string;
      date?: Date;
      emotion?: 'happy' | 'excited' | 'nostalgic' | 'proud' | 'grateful' | 'adventurous';
    }>;
  };
  sharing?: {
    isShared?: boolean;
    sharedWith?: Array<{
      userId: mongoose.Types.ObjectId;
      permission?: 'view' | 'comment' | 'edit';
      sharedAt?: Date;
    }>;
    socialPosts?: Array<{
      platform?: string;
      postId?: string;
      url?: string;
      postedAt?: Date;
    }>;
  };
  gamification?: {
    experiencePoints?: number;
    level?: number;
    achievements?: string[];
    streakDays?: number;
    lastInteraction?: Date;
  };
  status: 'active' | 'archived' | 'deleted' | 'lost' | 'gifted';
  getPublicData(): any;
  addMemory(memoryData: any): Promise<IUserItem>;
  updateInteraction(): Promise<IUserItem>;
}

interface IUserItemModel extends Model<IUserItem> {
  getUserItemStats(userId: string): Promise<any>;
  getItemsByCategory(userId: string, category: string, options?: any): Promise<IUserItem[]>;
}

const userItemSchema = new Schema<IUserItem>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  itemId: {
    type: String,
    required: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    maxlength: 1000
  },
  category: {
    type: String,
    required: true,
    enum: [
      'adventure_gear', 'collectible', 'badge', 'achievement', 
      'souvenir', 'memory', 'photo', 'ticket', 'certificate',
      'virtual_item', 'reward', 'token', 'other'
    ],
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'physical', 'digital', 'virtual', 'achievement', 
      'badge', 'token', 'memory', 'experience'
    ]
  },
  rarity: {
    type: String,
    enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
    default: 'common'
  },
  value: {
    points: { type: Number, default: 0 },
    coins: { type: Number, default: 0 },
    monetaryValue: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' }
  },
  properties: {
    color: String,
    size: String,
    weight: Number,
    material: String,
    brand: String,
    condition: {
      type: String,
      enum: ['new', 'excellent', 'good', 'fair', 'poor'],
      default: 'new'
    },
    customAttributes: [{
      key: String,
      value: Schema.Types.Mixed
    }]
  },
  location: {
    source: {
      type: String,
      enum: ['adventure', 'event', 'purchase', 'gift', 'achievement', 'reward', 'other'],
      required: true
    },
    sourceId: String,
    sourceName: String,
    acquiredAt: {
      type: Date,
      default: Date.now
    },
    acquiredLocation: {
      lat: Number,
      lng: Number,
      address: String,
      venue: String
    }
  },
  media: {
    images: [{
      url: String,
      caption: String,
      isPrimary: { type: Boolean, default: false }
    }],
    videos: [{
      url: String,
      caption: String,
      thumbnail: String
    }],
    documents: [{
      url: String,
      name: String,
      type: String
    }]
  },
  metadata: {
    tags: [String],
    isPublic: { type: Boolean, default: false },
    isFavorite: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    notes: String,
    memories: [{
      title: String,
      description: String,
      date: Date,
      emotion: {
        type: String,
        enum: ['happy', 'excited', 'nostalgic', 'proud', 'grateful', 'adventurous']
      }
    }]
  },
  sharing: {
    isShared: { type: Boolean, default: false },
    sharedWith: [{
      userId: { type: Schema.Types.ObjectId, ref: 'User' },
      permission: {
        type: String,
        enum: ['view', 'comment', 'edit'],
        default: 'view'
      },
      sharedAt: { type: Date, default: Date.now }
    }],
    socialPosts: [{
      platform: String,
      postId: String,
      url: String,
      postedAt: Date
    }]
  },
  gamification: {
    experiencePoints: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    achievements: [String],
    streakDays: { type: Number, default: 0 },
    lastInteraction: Date
  },
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted', 'lost', 'gifted'],
    default: 'active'
  }
}, {
  timestamps: true
});

userItemSchema.index({ userId: 1, category: 1 });
userItemSchema.index({ userId: 1, 'metadata.isFavorite': 1 });
userItemSchema.index({ userId: 1, status: 1 });
userItemSchema.index({ userId: 1, 'location.source': 1 });
userItemSchema.index({ 'metadata.tags': 1 });
userItemSchema.index({ createdAt: -1 });

userItemSchema.virtual('ageInDays').get(function() {
  return Math.floor((Date.now() - this.location.acquiredAt.getTime()) / (1000 * 60 * 60 * 24));
});

userItemSchema.methods.getPublicData = function() {
  const itemObject = this.toObject();
  
  if (!this.metadata.isPublic) {
    delete (itemObject as any).value.monetaryValue;
    delete (itemObject as any).sharing;
    delete (itemObject as any).metadata.notes;
  }
  
  return itemObject;
};

userItemSchema.methods.addMemory = function(memoryData: any) {
  this.metadata.memories = this.metadata.memories || [];
  this.metadata.memories.push({
    title: memoryData.title,
    description: memoryData.description,
    date: memoryData.date || new Date(),
    emotion: memoryData.emotion
  });
  
  this.gamification = this.gamification || {};
  this.gamification.lastInteraction = new Date();
  return this.save();
};

userItemSchema.methods.updateInteraction = function() {
  this.gamification = this.gamification || {};
  this.gamification.lastInteraction = new Date();
  
  const today = new Date();
  const lastInteraction = this.gamification.lastInteraction;
  
  if (lastInteraction) {
    const daysDiff = Math.floor((today.getTime() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff === 1) {
      this.gamification.streakDays = (this.gamification.streakDays || 0) + 1;
    } else if (daysDiff > 1) {
      this.gamification.streakDays = 1;
    }
  } else {
    this.gamification.streakDays = 1;
  }
  
  return this.save();
};

userItemSchema.statics.getUserItemStats = async function(userId: string) {
  const stats = await this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'active' } },
    {
      $group: {
        _id: null,
        totalItems: { $sum: 1 },
        totalValue: { $sum: '$value.points' },
        categories: { $addToSet: '$category' },
        rarityCount: {
          $push: '$rarity'
        },
        favoriteCount: {
          $sum: { $cond: ['$metadata.isFavorite', 1, 0] }
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalItems: 0,
    totalValue: 0,
    categories: [],
    rarityCount: [],
    favoriteCount: 0
  };
};

userItemSchema.statics.getItemsByCategory = async function(userId: string, category: string, options: any = {}) {
  const query: any = { 
    userId: new mongoose.Types.ObjectId(userId), 
    status: 'active'
  };
  
  if (category && category !== 'all') {
    query.category = category;
  }
  
  const sort = options.sort || { createdAt: -1 };
  const limit = options.limit || 50;
  const skip = options.skip || 0;
  
  return this.find(query)
    .sort(sort)
    .limit(limit)
    .skip(skip)
    .lean();
};

const UserItem: Model<IUserItem> = mongoose.model<IUserItem, IUserItemModel>('UserItem', userItemSchema);
export default UserItem;

