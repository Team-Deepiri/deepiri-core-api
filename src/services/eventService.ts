import Event, { IEvent } from '../models/Event';
import User from '../models/User';
import externalApiService from './externalApiService';
import aiOrchestrator from './aiOrchestrator';
import cacheService from './cacheService';
import { secureLog } from '../utils/secureLogger';
import mongoose from 'mongoose';

interface EventData {
  name: string;
  description?: string;
  type: string;
  category: string;
  location: any;
  startTime: Date;
  endTime: Date;
  duration: number;
  capacity?: number;
  price?: any;
  tags?: string[];
  [key: string]: any;
}

interface EventFilters {
  category?: string;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
}

class EventService {
  async createEvent(userId: string, eventData: EventData): Promise<IEvent> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const event = new Event({
        ...eventData,
        host: {
          userId: userId,
          name: user.name,
          email: user.email,
          isUserHosted: true
        },
        status: 'published'
      });

      await event.save();

      try {
        const suggestions = await aiOrchestrator.generateEventSuggestions(event, user.preferences);
        event.aiSuggestions = suggestions;
        await event.save();
      } catch (error: any) {
        secureLog('warn', 'Failed to generate AI suggestions for event:', error);
      }

      secureLog('info', `Event created: ${event.name} by user ${userId}`);
      return event;

    } catch (error: any) {
      secureLog('error', 'Failed to create event:', error);
      throw new Error(`Failed to create event: ${error.message}`);
    }
  }

  async getEvent(eventId: string): Promise<IEvent> {
    try {
      const event = await Event.findById(eventId)
        .populate('host.userId', 'name profilePicture')
        .populate('attendees.userId', 'name profilePicture')
        .populate('reviews.userId', 'name profilePicture');

      if (!event) {
        throw new Error('Event not found');
      }

      return event;
    } catch (error: any) {
      secureLog('error', 'Failed to get event:', error);
      throw new Error(`Failed to get event: ${error.message}`);
    }
  }

  async getNearbyEvents(location: { lat: number; lng: number }, radius: number = 5000, filters: EventFilters = {}): Promise<any> {
    try {
      const { category, startTime, endTime, limit = 20, offset = 0 } = filters;

      let events;
      if (category) {
        events = await (Event as any).findByCategory(category, location.lat, location.lng, radius);
      } else {
        events = await (Event as any).findByLocationAndTime(location.lat, location.lng, radius, startTime, endTime);
      }

      const paginatedEvents = events.slice(offset, offset + limit);

      return {
        events: paginatedEvents,
        pagination: {
          total: events.length,
          limit,
          offset,
          hasMore: events.length > offset + limit
        }
      };

    } catch (error: any) {
      secureLog('error', 'Failed to get nearby events:', error);
      throw new Error(`Failed to get nearby events: ${error.message}`);
    }
  }

  async updateEvent(eventId: string, userId: string, updateData: any): Promise<IEvent> {
    try {
      const event = await Event.findOne({
        _id: eventId,
        'host.userId': userId
      });

      if (!event) {
        throw new Error('Event not found or you are not the host');
      }

      Object.assign(event, updateData);
      await event.save();

      secureLog('info', `Event updated: ${event.name} by user ${userId}`);
      return event;

    } catch (error: any) {
      secureLog('error', 'Failed to update event:', error);
      throw new Error(`Failed to update event: ${error.message}`);
    }
  }

  async joinEvent(eventId: string, userId: string): Promise<IEvent> {
    try {
      const event = await Event.findById(eventId);
      if (!event) {
        throw new Error('Event not found');
      }

      await event.addAttendee(new mongoose.Types.ObjectId(userId));

      secureLog('info', `User ${userId} joined event ${eventId}`);
      return event;

    } catch (error: any) {
      secureLog('error', 'Failed to join event:', error);
      throw new Error(`Failed to join event: ${error.message}`);
    }
  }

  async leaveEvent(eventId: string, userId: string): Promise<IEvent> {
    try {
      const event = await Event.findById(eventId);
      if (!event) {
        throw new Error('Event not found');
      }

      await event.removeAttendee(new mongoose.Types.ObjectId(userId));

      secureLog('info', `User ${userId} left event ${eventId}`);
      return event;

    } catch (error: any) {
      secureLog('error', 'Failed to leave event:', error);
      throw new Error(`Failed to leave event: ${error.message}`);
    }
  }

  async reviewEvent(eventId: string, userId: string, rating: number, comment: string): Promise<IEvent> {
    try {
      const event = await Event.findById(eventId);
      if (!event) {
        throw new Error('Event not found');
      }

      await event.addReview(new mongoose.Types.ObjectId(userId), rating, comment);

      secureLog('info', `User ${userId} reviewed event ${eventId} with rating ${rating}`);
      return event;

    } catch (error: any) {
      secureLog('error', 'Failed to review event:', error);
      throw new Error(`Failed to review event: ${error.message}`);
    }
  }

  async cancelEvent(eventId: string, userId: string): Promise<IEvent> {
    try {
      const event = await Event.findOne({
        _id: eventId,
        'host.userId': userId
      });

      if (!event) {
        throw new Error('Event not found or you are not the host');
      }

      await event.updateStatus('cancelled');

      secureLog('info', `Event ${eventId} cancelled by user ${userId}`);
      return event;

    } catch (error: any) {
      secureLog('error', 'Failed to cancel event:', error);
      throw new Error(`Failed to cancel event: ${error.message}`);
    }
  }

  async getUserEvents(userId: string, type: string = 'all', limit: number = 20, offset: number = 0): Promise<IEvent[]> {
    try {
      let query: any = {};
      if (type === 'hosted') {
        query = { 'host.userId': userId };
      } else if (type === 'attending') {
        query = { 'attendees.userId': userId };
      } else {
        query = {
          $or: [
            { 'host.userId': userId },
            { 'attendees.userId': userId }
          ]
        };
      }

      const events = await Event.find(query)
        .sort({ startTime: -1 })
        .limit(limit)
        .skip(offset)
        .populate('host.userId', 'name profilePicture')
        .populate('attendees.userId', 'name profilePicture');

      return events;

    } catch (error: any) {
      secureLog('error', 'Failed to get user events:', error);
      throw new Error(`Failed to get user events: ${error.message}`);
    }
  }

  async getEventCategories(): Promise<any[]> {
    try {
      const categories = [
        { id: 'nightlife', name: 'Nightlife', icon: '🌃', description: 'Bars, clubs, and evening entertainment' },
        { id: 'music', name: 'Music', icon: '🎵', description: 'Concerts, live music, and DJ sets' },
        { id: 'food', name: 'Food & Drink', icon: '🍽️', description: 'Restaurants, food trucks, and tastings' },
        { id: 'social', name: 'Social', icon: '👥', description: 'Meetups, networking, and social gatherings' },
        { id: 'culture', name: 'Culture', icon: '🎭', description: 'Museums, galleries, and cultural events' },
        { id: 'sports', name: 'Sports', icon: '⚽', description: 'Games, tournaments, and fitness events' },
        { id: 'outdoor', name: 'Outdoor', icon: '🌲', description: 'Hiking, parks, and outdoor activities' },
        { id: 'art', name: 'Art', icon: '🎨', description: 'Exhibitions, workshops, and creative events' },
        { id: 'education', name: 'Education', icon: '📚', description: 'Workshops, lectures, and learning events' }
      ];

      return categories;

    } catch (error: any) {
      secureLog('error', 'Failed to get event categories:', error);
      throw new Error(`Failed to get event categories: ${error.message}`);
    }
  }

  async getEventAnalytics(eventId: string, userId: string): Promise<any> {
    try {
      const event = await Event.findOne({
        _id: eventId,
        'host.userId': userId
      });

      if (!event) {
        throw new Error('Event not found or you are not the host');
      }

      const analytics = {
        totalViews: event.analytics.views || 0,
        totalShares: event.analytics.shares || 0,
        totalSaves: event.analytics.saves || 0,
        attendeeCount: (event as any).attendeeCount || 0,
        capacity: event.capacity || 0,
        attendanceRate: event.capacity && event.capacity > 0 ? (((event as any).attendeeCount || 0) / event.capacity) * 100 : 0,
        averageRating: (event as any).averageRating || 0,
        totalReviews: event.reviews.length,
        waitlistCount: event.waitlist.length,
        completionRate: event.analytics.completionRate || 0
      };

      return analytics;

    } catch (error: any) {
      secureLog('error', 'Failed to get event analytics:', error);
      throw new Error(`Failed to get event analytics: ${error.message}`);
    }
  }

  async getPopularEvents(location: { lat: number; lng: number }, limit: number = 10): Promise<IEvent[]> {
    try {
      const events = await Event.find({
        'location.lat': {
          $gte: location.lat - 0.01,
          $lte: location.lat + 0.01
        },
        'location.lng': {
          $gte: location.lng - 0.01,
          $lte: location.lng + 0.01
        },
        status: 'published',
        visibility: 'public',
        startTime: { $gte: new Date() }
      })
      .sort({ 'analytics.views': -1, 'reviews.rating': -1 })
      .limit(limit)
      .populate('host.userId', 'name profilePicture');

      return events;

    } catch (error: any) {
      secureLog('error', 'Failed to get popular events:', error);
      throw new Error(`Failed to get popular events: ${error.message}`);
    }
  }

  async getTrendingEvents(location: { lat: number; lng: number }, timeRange: string = '7d', limit: number = 10): Promise<IEvent[]> {
    try {
      const timeRangeMs = this.getTimeRangeMs(timeRange);
      const startDate = new Date(Date.now() - timeRangeMs);

      const events = await Event.find({
        'location.lat': {
          $gte: location.lat - 0.01,
          $lte: location.lat + 0.01
        },
        'location.lng': {
          $gte: location.lng - 0.01,
          $lte: location.lng + 0.01
        },
        status: 'published',
        visibility: 'public',
        startTime: { $gte: new Date() },
        createdAt: { $gte: startDate }
      })
      .sort({ 'analytics.shares': -1, 'analytics.views': -1 })
      .limit(limit)
      .populate('host.userId', 'name profilePicture');

      return events;

    } catch (error: any) {
      secureLog('error', 'Failed to get trending events:', error);
      throw new Error(`Failed to get trending events: ${error.message}`);
    }
  }

  async searchEvents(query: string, location: { lat: number; lng: number }, radius: number = 5000, limit: number = 20): Promise<IEvent[]> {
    try {
      const events = await Event.find({
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { tags: { $in: [new RegExp(query, 'i')] } }
        ],
        'location.lat': {
          $gte: location.lat - (radius / 111000),
          $lte: location.lat + (radius / 111000)
        },
        'location.lng': {
          $gte: location.lng - (radius / (111000 * Math.cos(location.lat * Math.PI / 180))),
          $lte: location.lng + (radius / (111000 * Math.cos(location.lat * Math.PI / 180)))
        },
        status: 'published',
        visibility: 'public',
        startTime: { $gte: new Date() }
      })
      .sort({ startTime: 1 })
      .limit(limit)
      .populate('host.userId', 'name profilePicture');

      return events;

    } catch (error: any) {
      secureLog('error', 'Failed to search events:', error);
      throw new Error(`Failed to search events: ${error.message}`);
    }
  }

  async syncExternalEvents(location: { lat: number; lng: number }, radius: number = 5000): Promise<number> {
    try {
      const externalEvents = await externalApiService.getNearbyEvents(location, radius);

      let syncedCount = 0;
      for (const externalEvent of externalEvents) {
        try {
          const existingEvent = await Event.findOne({
            'metadata.externalId': externalEvent.eventId,
            'metadata.source': 'eventbrite'
          });

          if (!existingEvent) {
            const event = new Event({
              name: externalEvent.name,
              description: externalEvent.description,
              type: this.mapExternalEventType(externalEvent.category),
              category: this.mapExternalEventCategory(externalEvent.category),
              location: externalEvent.location,
              startTime: externalEvent.startTime,
              endTime: externalEvent.endTime,
              duration: Math.round((externalEvent.endTime.getTime() - externalEvent.startTime.getTime()) / (1000 * 60)),
              capacity: externalEvent.venue?.capacity,
              price: externalEvent.price,
              status: 'published',
              visibility: 'public',
              metadata: {
                source: 'eventbrite',
                externalId: externalEvent.eventId,
                lastSynced: new Date()
              }
            });

            await event.save();
            syncedCount++;
          } else {
            existingEvent.metadata.lastSynced = new Date();
            await existingEvent.save();
          }
        } catch (error: any) {
          secureLog('warn', `Failed to sync external event ${externalEvent.eventId}:`, error);
        }
      }

      secureLog('info', `Synced ${syncedCount} external events`);
      return syncedCount;

    } catch (error: any) {
      secureLog('error', 'Failed to sync external events:', error);
      throw new Error(`Failed to sync external events: ${error.message}`);
    }
  }

  private mapExternalEventType(category: string): string {
    const typeMapping: Record<string, string> = {
      'music': 'concert',
      'food': 'restaurant',
      'nightlife': 'bar',
      'social': 'meetup',
      'culture': 'cultural',
      'sports': 'sports',
      'outdoor': 'outdoor',
      'art': 'art',
      'education': 'workshop'
    };
    return typeMapping[category] || 'meetup';
  }

  private mapExternalEventCategory(category: string): string {
    const categoryMapping: Record<string, string> = {
      'music': 'music',
      'food': 'food',
      'nightlife': 'nightlife',
      'social': 'social',
      'culture': 'culture',
      'sports': 'sports',
      'outdoor': 'outdoor',
      'art': 'art',
      'education': 'education'
    };
    return categoryMapping[category] || 'social';
  }

  private getTimeRangeMs(timeRange: string): number {
    const ranges: Record<string, number> = {
      '1d': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000
    };
    return ranges[timeRange] || ranges['7d'];
  }
}

export default new EventService();

