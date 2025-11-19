import mongoose, { Schema, Document, Model } from 'mongoose';

interface ILocation {
  lat: number;
  lng: number;
  address: string;
  placeId?: string;
}

interface IAdventureStep {
  type: 'event' | 'venue' | 'travel' | 'activity' | 'break';
  name: string;
  description?: string;
  location: ILocation;
  startTime: Date;
  endTime: Date;
  duration: number;
  travelMethod?: 'walk' | 'bike' | 'drive' | 'transit' | 'taxi';
  travelDuration?: number;
  travelDistance?: number;
  task?: {
    description?: string;
    points?: number;
    completed?: boolean;
    skipped?: boolean;
    started?: boolean;
    startedAt?: Date;
  };
  venue?: {
    venueId?: string;
    type?: string;
    rating?: number;
    priceLevel?: number;
    photos?: string[];
    website?: string;
    phone?: string;
  };
  event?: {
    eventId?: string;
    type?: string;
    capacity?: number;
    attendees?: number;
    hostId?: string;
    isUserHosted?: boolean;
  };
  weather?: {
    condition?: string;
    temperature?: number;
    humidity?: number;
    windSpeed?: number;
  };
  alternatives?: Array<{
    name?: string;
    location?: ILocation;
    reason?: string;
  }>;
}

export interface IAdventure extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  status: 'generated' | 'active' | 'completed' | 'cancelled' | 'paused';
  steps: IAdventureStep[];
  totalDuration: number;
  totalDistance?: number;
  startLocation: ILocation;
  endLocation?: ILocation;
  preferences: {
    interests?: string[];
    skillLevel?: string;
    socialMode?: string;
    budget?: string;
    maxDistance?: number;
  };
  social: {
    friendsInvited?: mongoose.Types.ObjectId[];
    friendsJoined?: mongoose.Types.ObjectId[];
    isPublic?: boolean;
    maxParticipants?: number;
  };
  weather?: {
    forecast?: Array<{
      time?: Date;
      condition?: string;
      temperature?: number;
      humidity?: number;
      windSpeed?: number;
    }>;
    alerts?: string[];
  };
  aiMetadata?: {
    model?: string;
    version?: string;
    generationTime?: number;
    tokensUsed?: number;
    confidence?: number;
    reasoning?: string;
  };
  feedback?: {
    rating?: number;
    comments?: string;
    completedSteps?: string[];
    skippedSteps?: string[];
    suggestions?: string;
    submittedAt?: Date;
  };
  gamification: {
    points?: number;
    badges?: string[];
    challenges?: Array<{
      description?: string;
      completed?: boolean;
      points?: number;
    }>;
  };
  notifications?: Array<{
    type?: 'step_reminder' | 'weather_alert' | 'venue_change' | 'friend_joined' | 'completion';
    message?: string;
    sentAt?: Date;
    read?: boolean;
  }>;
  metadata: {
    generatedAt?: Date;
    startedAt?: Date;
    completedAt?: Date;
    lastUpdated?: Date;
    version?: string;
  };
  updateStatus(newStatus: string): Promise<IAdventure>;
  addNotification(type: string, message: string): Promise<IAdventure>;
  completeStep(stepIndex: number): Promise<IAdventure>;
  getCurrentStep(): IAdventureStep | undefined;
  getNextStep(): IAdventureStep | undefined;
}

const locationSchema = new Schema<ILocation>({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  address: { type: String, required: true },
  placeId: String
});

const adventureStepSchema = new Schema<IAdventureStep>({
  type: {
    type: String,
    enum: ['event', 'venue', 'travel', 'activity', 'break'],
    required: true
  },
  name: { type: String, required: true },
  description: String,
  location: locationSchema,
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  duration: { type: Number, required: true },
  travelMethod: {
    type: String,
    enum: ['walk', 'bike', 'drive', 'transit', 'taxi'],
    default: 'walk'
  },
  travelDuration: Number,
  travelDistance: Number,
  task: {
    description: String,
    points: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    skipped: { type: Boolean, default: false },
    started: { type: Boolean, default: false },
    startedAt: Date
  },
  venue: {
    venueId: String,
    type: String,
    rating: Number,
    priceLevel: Number,
    photos: [String],
    website: String,
    phone: String
  },
  event: {
    eventId: String,
    type: String,
    capacity: Number,
    attendees: Number,
    hostId: String,
    isUserHosted: { type: Boolean, default: false }
  },
  weather: {
    condition: String,
    temperature: Number,
    humidity: Number,
    windSpeed: Number
  },
  alternatives: [{
    name: String,
    location: locationSchema,
    reason: String
  }]
});

const adventureSchema = new Schema<IAdventure>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['generated', 'active', 'completed', 'cancelled', 'paused'],
    default: 'generated'
  },
  steps: [adventureStepSchema],
  totalDuration: {
    type: Number,
    required: true,
    min: 30,
    max: 90
  },
  totalDistance: Number,
  startLocation: locationSchema,
  endLocation: locationSchema,
  preferences: {
    interests: [String],
    skillLevel: String,
    socialMode: String,
    budget: String,
    maxDistance: Number
  },
  social: {
    friendsInvited: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    friendsJoined: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    isPublic: { type: Boolean, default: false },
    maxParticipants: Number
  },
  weather: {
    forecast: [{
      time: Date,
      condition: String,
      temperature: Number,
      humidity: Number,
      windSpeed: Number
    }],
    alerts: [String]
  },
  aiMetadata: {
    model: String,
    version: String,
    generationTime: Number,
    tokensUsed: Number,
    confidence: Number,
    reasoning: String
  },
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comments: String,
    completedSteps: [String],
    skippedSteps: [String],
    suggestions: String,
    submittedAt: Date
  },
  gamification: {
    points: { type: Number, default: 0 },
    badges: [String],
    challenges: [{
      description: String,
      completed: { type: Boolean, default: false },
      points: Number
    }]
  },
  notifications: [{
    type: {
      type: String,
      enum: ['step_reminder', 'weather_alert', 'venue_change', 'friend_joined', 'completion']
    },
    message: String,
    sentAt: Date,
    read: { type: Boolean, default: false }
  }],
  metadata: {
    generatedAt: { type: Date, default: Date.now },
    startedAt: Date,
    completedAt: Date,
    lastUpdated: { type: Date, default: Date.now },
    version: { type: String, default: '2.0' }
  }
}, {
  timestamps: true
});

adventureSchema.index({ userId: 1, status: 1 });
adventureSchema.index({ 'startLocation.lat': 1, 'startLocation.lng': 1 });
adventureSchema.index({ 'metadata.generatedAt': -1 });
adventureSchema.index({ 'social.friendsInvited': 1 });

adventureSchema.virtual('totalPoints').get(function() {
  return (this.gamification.points || 0) + 
    this.steps.reduce((total: number, step: IAdventureStep) => total + (step.task?.points || 0), 0);
});

adventureSchema.methods.updateStatus = function(newStatus: string) {
  this.status = newStatus;
  this.metadata.lastUpdated = new Date();
  
  if (newStatus === 'active' && !this.metadata.startedAt) {
    this.metadata.startedAt = new Date();
  } else if (newStatus === 'completed' && !this.metadata.completedAt) {
    this.metadata.completedAt = new Date();
  }
  
  return this.save();
};

adventureSchema.methods.addNotification = function(type: string, message: string) {
  this.notifications = this.notifications || [];
  this.notifications.push({
    type: type as any,
    message,
    sentAt: new Date(),
    read: false
  });
  return this.save();
};

adventureSchema.methods.completeStep = function(stepIndex: number) {
  if (this.steps[stepIndex]) {
    this.steps[stepIndex].task = this.steps[stepIndex].task || {};
    this.steps[stepIndex].task!.completed = true;
    this.metadata.lastUpdated = new Date();
    return this.save();
  }
  throw new Error('Step not found');
};

adventureSchema.methods.getCurrentStep = function(): IAdventureStep | undefined {
  const now = new Date();
  return this.steps.find((step: IAdventureStep) => 
    step.startTime <= now && step.endTime >= now
  );
};

adventureSchema.methods.getNextStep = function(): IAdventureStep | undefined {
  const now = new Date();
  return this.steps.find((step: IAdventureStep) => step.startTime > now);
};

adventureSchema.statics.findByLocation = function(lat: number, lng: number, radius: number = 5000) {
  return this.find({
    'startLocation.lat': {
      $gte: lat - (radius / 111000),
      $lte: lat + (radius / 111000)
    },
    'startLocation.lng': {
      $gte: lng - (radius / (111000 * Math.cos(lat * Math.PI / 180))),
      $lte: lng + (radius / (111000 * Math.cos(lat * Math.PI / 180)))
    },
    status: { $in: ['generated', 'active'] }
  });
};

const Adventure: Model<IAdventure> = mongoose.model<IAdventure>('Adventure', adventureSchema);
export default Adventure;

