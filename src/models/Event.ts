import mongoose, { Schema, Document, Model } from 'mongoose';

interface ILocation {
  lat: number;
  lng: number;
  address: string;
  placeId?: string;
  venue?: {
    name?: string;
    type?: string;
    rating?: number;
    priceLevel?: number;
    photos?: string[];
    website?: string;
    phone?: string;
  };
}

export interface IEvent extends Document {
  name: string;
  description?: string;
  type: 'bar' | 'restaurant' | 'concert' | 'popup' | 'meetup' | 'party' | 'workshop' | 'sports' | 'cultural' | 'outdoor';
  category: 'nightlife' | 'music' | 'food' | 'social' | 'culture' | 'sports' | 'outdoor' | 'art' | 'education';
  location: ILocation;
  startTime: Date;
  endTime: Date;
  duration: number;
  host: {
    userId?: mongoose.Types.ObjectId;
    name?: string;
    email?: string;
    isUserHosted?: boolean;
  };
  capacity?: number;
  attendees: Array<{
    userId: mongoose.Types.ObjectId;
    joinedAt?: Date;
    status?: 'confirmed' | 'waitlist' | 'cancelled';
  }>;
  waitlist: Array<{
    userId: mongoose.Types.ObjectId;
    joinedAt?: Date;
  }>;
  price: {
    amount?: number;
    currency?: string;
    isFree?: boolean;
  };
  requirements?: {
    ageRestriction?: {
      min?: number;
      max?: number;
    };
    skillLevel?: 'beginner' | 'intermediate' | 'advanced' | 'any';
    equipment?: string[];
    dressCode?: string;
  };
  tags?: string[];
  images?: string[];
  externalLinks?: {
    website?: string;
    facebook?: string;
    instagram?: string;
    ticketUrl?: string;
  };
  status: 'draft' | 'published' | 'cancelled' | 'completed' | 'postponed';
  visibility: 'public' | 'friends' | 'private';
  weather?: {
    condition?: string;
    temperature?: number;
    humidity?: number;
    windSpeed?: number;
    lastUpdated?: Date;
  };
  aiSuggestions?: {
    bestTimeSlots?: Date[];
    nearbyAttractions?: string[];
    similarEvents?: string[];
    recommendations?: string;
  };
  analytics: {
    views?: number;
    shares?: number;
    saves?: number;
    completionRate?: number;
  };
  reviews: Array<{
    userId: mongoose.Types.ObjectId;
    rating?: number;
    comment?: string;
    createdAt?: Date;
  }>;
  metadata: {
    source?: 'user' | 'eventbrite' | 'yelp' | 'google_places' | 'manual';
    externalId?: string;
    lastSynced?: Date;
    version?: string;
  };
  addAttendee(userId: mongoose.Types.ObjectId): Promise<IEvent>;
  removeAttendee(userId: mongoose.Types.ObjectId): Promise<IEvent>;
  updateStatus(newStatus: string): Promise<IEvent>;
  addReview(userId: mongoose.Types.ObjectId, rating: number, comment: string): Promise<IEvent>;
}

const locationSchema = new Schema<ILocation>({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  address: { type: String, required: true },
  placeId: String,
  venue: {
    name: String,
    type: String,
    rating: Number,
    priceLevel: Number,
    photos: [String],
    website: String,
    phone: String
  }
});

const eventSchema = new Schema<IEvent>({
  name: {
    type: String,
    required: true,
    maxlength: 150
  },
  description: {
    type: String,
    maxlength: 1000
  },
  type: {
    type: String,
    enum: ['bar', 'restaurant', 'concert', 'popup', 'meetup', 'party', 'workshop', 'sports', 'cultural', 'outdoor'],
    required: true
  },
  category: {
    type: String,
    enum: ['nightlife', 'music', 'food', 'social', 'culture', 'sports', 'outdoor', 'art', 'education'],
    required: true
  },
  location: locationSchema,
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  host: {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    name: String,
    email: String,
    isUserHosted: { type: Boolean, default: false }
  },
  capacity: {
    type: Number,
    min: 1,
    max: 1000
  },
  attendees: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['confirmed', 'waitlist', 'cancelled'],
      default: 'confirmed'
    }
  }],
  waitlist: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: { type: Date, default: Date.now }
  }],
  price: {
    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    isFree: { type: Boolean, default: true }
  },
  requirements: {
    ageRestriction: {
      min: Number,
      max: Number
    },
    skillLevel: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'any']
    },
    equipment: [String],
    dressCode: String
  },
  tags: [String],
  images: [String],
  externalLinks: {
    website: String,
    facebook: String,
    instagram: String,
    ticketUrl: String
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'cancelled', 'completed', 'postponed'],
    default: 'draft'
  },
  visibility: {
    type: String,
    enum: ['public', 'friends', 'private'],
    default: 'public'
  },
  weather: {
    condition: String,
    temperature: Number,
    humidity: Number,
    windSpeed: Number,
    lastUpdated: Date
  },
  aiSuggestions: {
    bestTimeSlots: [Date],
    nearbyAttractions: [String],
    similarEvents: [String],
    recommendations: String
  },
  analytics: {
    views: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    saves: { type: Number, default: 0 },
    completionRate: Number
  },
  reviews: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    createdAt: { type: Date, default: Date.now }
  }],
  metadata: {
    source: {
      type: String,
      enum: ['user', 'eventbrite', 'yelp', 'google_places', 'manual'],
      default: 'user'
    },
    externalId: String,
    lastSynced: Date,
    version: { type: String, default: '2.0' }
  }
}, {
  timestamps: true
});

eventSchema.index({ 'location.lat': 1, 'location.lng': 1 });
eventSchema.index({ startTime: 1, endTime: 1 });
eventSchema.index({ type: 1, category: 1 });
eventSchema.index({ status: 1, visibility: 1 });
eventSchema.index({ 'host.userId': 1 });
eventSchema.index({ tags: 1 });

eventSchema.virtual('attendeeCount').get(function() {
  return this.attendees.filter((attendee: any) => attendee.status === 'confirmed').length;
});

eventSchema.virtual('availableSpots').get(function() {
  return Math.max(0, (this.capacity || 0) - (this as any).attendeeCount);
});

eventSchema.virtual('averageRating').get(function() {
  if (this.reviews.length === 0) return 0;
  const sum = this.reviews.reduce((total: number, review: any) => total + (review.rating || 0), 0);
  return sum / this.reviews.length;
});

eventSchema.methods.addAttendee = function(userId: mongoose.Types.ObjectId) {
  const existingAttendee = this.attendees.find((attendee: any) => 
    attendee.userId.toString() === userId.toString()
  );
  
  if (existingAttendee) {
    throw new Error('User is already attending this event');
  }
  
  if ((this as any).attendeeCount >= (this.capacity || 0)) {
    this.waitlist.push({ userId, joinedAt: new Date() });
    return this.save();
  }
  
  this.attendees.push({
    userId,
    joinedAt: new Date(),
    status: 'confirmed'
  });
  
  return this.save();
};

eventSchema.methods.removeAttendee = function(userId: mongoose.Types.ObjectId) {
  this.attendees = this.attendees.filter((attendee: any) => 
    attendee.userId.toString() !== userId.toString()
  );
  
  this.waitlist = this.waitlist.filter((attendee: any) => 
    attendee.userId.toString() !== userId.toString()
  );
  
  if (this.waitlist.length > 0 && (this as any).attendeeCount < (this.capacity || 0)) {
    const nextInLine = this.waitlist.shift();
    if (nextInLine) {
      this.attendees.push({
        userId: nextInLine.userId,
        joinedAt: new Date(),
        status: 'confirmed'
      });
    }
  }
  
  return this.save();
};

eventSchema.methods.updateStatus = function(newStatus: string) {
  this.status = newStatus as any;
  return this.save();
};

eventSchema.methods.addReview = function(userId: mongoose.Types.ObjectId, rating: number, comment: string) {
  const attended = this.attendees.some((attendee: any) => 
    attendee.userId.toString() === userId.toString() && 
    attendee.status === 'confirmed'
  );
  
  if (!attended) {
    throw new Error('Only attendees can review events');
  }
  
  const existingReview = this.reviews.find((review: any) => 
    review.userId.toString() === userId.toString()
  );
  
  if (existingReview) {
    throw new Error('User has already reviewed this event');
  }
  
  this.reviews.push({
    userId,
    rating,
    comment,
    createdAt: new Date()
  });
  
  return this.save();
};

eventSchema.statics.findByLocationAndTime = function(lat: number, lng: number, radius: number = 5000, startTime?: Date, endTime?: Date) {
  const query: any = {
    'location.lat': {
      $gte: lat - (radius / 111000),
      $lte: lat + (radius / 111000)
    },
    'location.lng': {
      $gte: lng - (radius / (111000 * Math.cos(lat * Math.PI / 180))),
      $lte: lng + (radius / (111000 * Math.cos(lat * Math.PI / 180)))
    },
    status: 'published',
    visibility: 'public'
  };
  
  if (startTime && endTime) {
    query.startTime = { $gte: startTime, $lte: endTime };
  }
  
  return this.find(query).sort({ startTime: 1 });
};

eventSchema.statics.findByCategory = function(category: string, lat: number, lng: number, radius: number = 5000) {
  return (this as any).findByLocationAndTime(lat, lng, radius).where('category', category);
};

interface IEventModel extends Model<IEvent> {
  findByLocationAndTime(lat: number, lng: number, radius?: number, startTime?: Date, endTime?: Date): Promise<IEvent[]>;
  findByCategory(category: string, lat: number, lng: number, radius?: number): Promise<IEvent[]>;
}

const Event = mongoose.model<IEvent, IEventModel>('Event', eventSchema);
export default Event;

