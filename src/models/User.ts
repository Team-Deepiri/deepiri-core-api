import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  preferences: {
    interests: string[];
    skillLevel: 'beginner' | 'intermediate' | 'advanced';
    maxDistance: number;
    preferredDuration: number;
    socialMode: 'solo' | 'friends' | 'meet_new_people';
    budget: 'low' | 'medium' | 'high';
    timePreferences: {
      morning: boolean;
      afternoon: boolean;
      evening: boolean;
      night: boolean;
    };
  };
  friends: mongoose.Types.ObjectId[];
  favoriteVenues: Array<{
    venueId: string;
    name: string;
    type: string;
    location: {
      lat: number;
      lng: number;
      address: string;
    };
  }>;
  stats: {
    adventuresCompleted: number;
    totalPoints: number;
    badges: string[];
    streak: number;
    lastAdventureDate?: Date;
  };
  location?: {
    lat: number;
    lng: number;
    address: string;
    lastUpdated: Date;
  };
  isActive: boolean;
  profilePicture?: string;
  bio?: string;
  roles: string[];
  refreshTokens: Array<{
    token: string;
    createdAt: Date;
    expiresAt: Date;
  }>;
  createdAt?: Date;
  updatedAt?: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  getPublicProfile(): any;
  updateStats(adventure: any): Promise<IUser>;
}

const userSchema = new Schema<IUser>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  preferences: {
    interests: [{
      type: String,
      enum: ['bars', 'music', 'food', 'outdoors', 'art', 'sports', 'social', 'solo', 'nightlife', 'culture']
    }],
    skillLevel: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner'
    },
    maxDistance: {
      type: Number,
      default: 5000,
      min: 1000,
      max: 20000
    },
    preferredDuration: {
      type: Number,
      default: 60,
      min: 30,
      max: 90
    },
    socialMode: {
      type: String,
      enum: ['solo', 'friends', 'meet_new_people'],
      default: 'solo'
    },
    budget: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    timePreferences: {
      morning: { type: Boolean, default: false },
      afternoon: { type: Boolean, default: true },
      evening: { type: Boolean, default: true },
      night: { type: Boolean, default: false }
    }
  },
  friends: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  favoriteVenues: [{
    venueId: String,
    name: String,
    type: String,
    location: {
      lat: Number,
      lng: Number,
      address: String
    }
  }],
  stats: {
    adventuresCompleted: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 },
    badges: [String],
    streak: { type: Number, default: 0 },
    lastAdventureDate: Date
  },
  location: {
    lat: Number,
    lng: Number,
    address: String,
    lastUpdated: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  profilePicture: String,
  bio: {
    type: String,
    maxlength: 500
  },
  roles: {
    type: [String],
    default: ['user'],
    enum: ['user', 'admin']
  },
  refreshTokens: [{
    token: String,
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date
  }]
}, {
  timestamps: true
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete (userObject as any).password;
  delete (userObject as any).email;
  return userObject;
};

userSchema.methods.updateStats = function(adventure: any) {
  this.stats.adventuresCompleted += 1;
  this.stats.totalPoints += adventure.points || 10;
  this.stats.lastAdventureDate = new Date();
  
  const today = new Date();
  const lastAdventure = this.stats.lastAdventureDate;
  if (lastAdventure) {
    const daysDiff = Math.floor((today.getTime() - lastAdventure.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff === 1) {
      this.stats.streak += 1;
    } else if (daysDiff > 1) {
      this.stats.streak = 1;
    }
  } else {
    this.stats.streak = 1;
  }
  
  return this.save();
};

const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);
export default User;

