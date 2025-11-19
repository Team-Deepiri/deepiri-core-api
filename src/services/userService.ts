import User, { IUser } from '../models/User';
import Adventure from '../models/Adventure';
import Event from '../models/Event';
import Notification from '../models/Notification';
import cacheService from './cacheService';
import logger from '../utils/logger';
import mongoose from 'mongoose';

interface UserData {
  name: string;
  email: string;
  password: string;
  preferences?: any;
}

interface UpdateData {
  name?: string;
  preferences?: any;
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
  profilePicture?: string;
  bio?: string;
}

interface VenueData {
  venueId: string;
  name: string;
  type?: string;
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
}

class UserService {
  async createUser(userData: UserData): Promise<IUser> {
    try {
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        throw new Error('User already exists with this email');
      }

      const user = new User({
        name: userData.name,
        email: userData.email,
        password: userData.password,
        preferences: userData.preferences || {
          interests: ['social'],
          skillLevel: 'beginner',
          maxDistance: 5000,
          preferredDuration: 60,
          socialMode: 'solo',
          budget: 'medium',
          timePreferences: {
            morning: false,
            afternoon: true,
            evening: true,
            night: false
          }
        }
      });

      await user.save();

      await cacheService.setUserPreferences(user._id.toString(), user.preferences);

      logger.info(`New user created: ${user.email}`);
      return user;

    } catch (error: any) {
      logger.error('Failed to create user:', error);
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  async findByRefreshToken(token: string): Promise<IUser | null> {
    const user = await User.findOne({ 'refreshTokens.token': token, 'refreshTokens.expiresAt': { $gt: new Date() } });
    return user;
  }

  async revokeRefreshToken(token: string): Promise<boolean> {
    const user = await User.findOne({ 'refreshTokens.token': token });
    if (!user) return false;
    user.refreshTokens = user.refreshTokens.filter((rt: any) => rt.token !== token);
    await user.save();
    return true;
  }

  async getUserById(userId: string): Promise<IUser> {
    try {
      const cached = await cacheService.get(`user:${userId}`);
      if (cached) {
        return cached as IUser;
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      await cacheService.set(`user:${userId}`, user, 3600);

      return user;
    } catch (error: any) {
      logger.error('Failed to get user:', error);
      throw new Error(`Failed to get user: ${error.message}`);
    }
  }

  async getUserByEmail(email: string): Promise<IUser> {
    try {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error: any) {
      logger.error('Failed to get user by email:', error);
      throw new Error(`Failed to get user: ${error.message}`);
    }
  }

  async updateUser(userId: string, updateData: UpdateData): Promise<IUser> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const allowedFields = ['name', 'preferences', 'location', 'profilePicture', 'bio'];
      for (const field of allowedFields) {
        if ((updateData as any)[field] !== undefined) {
          (user as any)[field] = (updateData as any)[field];
        }
      }

      await user.save();

      await cacheService.clearUserCache(userId);

      logger.info(`User ${userId} updated`);
      return user;

    } catch (error: any) {
      logger.error('Failed to update user:', error);
      throw new Error(`Failed to update user: ${error.message}`);
    }
  }

  async updateUserPreferences(userId: string, preferences: any): Promise<IUser> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      this.validatePreferences(preferences);

      user.preferences = { ...user.preferences, ...preferences };
      await user.save();

      await cacheService.setUserPreferences(userId, user.preferences);

      logger.info(`User ${userId} preferences updated`);
      return user;

    } catch (error: any) {
      logger.error('Failed to update user preferences:', error);
      throw new Error(`Failed to update user preferences: ${error.message}`);
    }
  }

  async updateUserLocation(userId: string, location: { lat: number; lng: number; address?: string }): Promise<IUser> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      user.location = {
        lat: location.lat,
        lng: location.lng,
        address: location.address,
        lastUpdated: new Date()
      };

      await user.save();

      await cacheService.clearUserCache(userId);

      logger.info(`User ${userId} location updated`);
      return user;

    } catch (error: any) {
      logger.error('Failed to update user location:', error);
      throw new Error(`Failed to update user location: ${error.message}`);
    }
  }

  async addFriend(userId: string, friendId: string): Promise<{ user: IUser; friend: IUser }> {
    try {
      const user = await User.findById(userId);
      const friend = await User.findById(friendId);

      if (!user || !friend) {
        throw new Error('User or friend not found');
      }

      if (user.friends.some((id: mongoose.Types.ObjectId) => id.toString() === friendId)) {
        throw new Error('User is already a friend');
      }

      if (userId === friendId) {
        throw new Error('Cannot add yourself as a friend');
      }

      user.friends.push(new mongoose.Types.ObjectId(friendId));
      friend.friends.push(new mongoose.Types.ObjectId(userId));

      await Promise.all([user.save(), friend.save()]);

      await Notification.createFriendNotification(
        friendId,
        'friend_invited',
        userId,
        `${user.name} added you as a friend!`
      );

      logger.info(`User ${userId} added friend ${friendId}`);
      return { user, friend };

    } catch (error: any) {
      logger.error('Failed to add friend:', error);
      throw new Error(`Failed to add friend: ${error.message}`);
    }
  }

  async removeFriend(userId: string, friendId: string): Promise<{ user: IUser; friend: IUser }> {
    try {
      const user = await User.findById(userId);
      const friend = await User.findById(friendId);

      if (!user || !friend) {
        throw new Error('User or friend not found');
      }

      user.friends = user.friends.filter((id: mongoose.Types.ObjectId) => id.toString() !== friendId);
      friend.friends = friend.friends.filter((id: mongoose.Types.ObjectId) => id.toString() !== userId);

      await Promise.all([user.save(), friend.save()]);

      logger.info(`User ${userId} removed friend ${friendId}`);
      return { user, friend };

    } catch (error: any) {
      logger.error('Failed to remove friend:', error);
      throw new Error(`Failed to remove friend: ${error.message}`);
    }
  }

  async getFriends(userId: string): Promise<IUser[]> {
    try {
      const user = await User.findById(userId).populate('friends', 'name profilePicture bio stats');
      if (!user) {
        throw new Error('User not found');
      }

      return user.friends as any;
    } catch (error: any) {
      logger.error('Failed to get friends:', error);
      throw new Error(`Failed to get friends: ${error.message}`);
    }
  }

  async searchUsers(query: string, userId: string, limit: number = 20): Promise<IUser[]> {
    try {
      const users = await User.find({
        _id: { $ne: userId },
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } }
        ]
      })
      .select('name profilePicture bio stats')
      .limit(limit);

      return users;
    } catch (error: any) {
      logger.error('Failed to search users:', error);
      throw new Error(`Failed to search users: ${error.message}`);
    }
  }

  async getUserStats(userId: string): Promise<any> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const [adventureStats, eventStats] = await Promise.all([
        this.getAdventureStats(userId),
        this.getEventStats(userId)
      ]);

      const stats = {
        ...user.stats,
        adventureStats,
        eventStats,
        friendsCount: user.friends.length,
        favoriteVenuesCount: user.favoriteVenues.length,
        accountAge: Math.floor((Date.now() - (user.createdAt?.getTime() || Date.now())) / (1000 * 60 * 60 * 24))
      };

      return stats;

    } catch (error: any) {
      logger.error('Failed to get user stats:', error);
      throw new Error(`Failed to get user stats: ${error.message}`);
    }
  }

  async getAdventureStats(userId: string): Promise<any> {
    try {
      const adventures = await Adventure.find({ userId: userId });

      const stats = {
        total: adventures.length,
        completed: adventures.filter(a => a.status === 'completed').length,
        active: adventures.filter(a => a.status === 'active').length,
        totalPoints: adventures.reduce((sum, a) => sum + (a.gamification.points || 0), 0),
        averageRating: this.calculateAverageAdventureRating(adventures),
        favoriteInterests: this.getFavoriteAdventureInterests(adventures)
      };

      return stats;

    } catch (error: any) {
      logger.error('Failed to get adventure stats:', error);
      return {};
    }
  }

  async getEventStats(userId: string): Promise<any> {
    try {
      const hostedEvents = await Event.find({ 'host.userId': userId });
      const attendedEvents = await Event.find({ 'attendees.userId': userId });

      const stats = {
        hosted: hostedEvents.length,
        attended: attendedEvents.length,
        totalCapacity: hostedEvents.reduce((sum, e) => sum + (e.capacity || 0), 0),
        totalAttendees: attendedEvents.reduce((sum, e) => sum + ((e as any).attendeeCount || 0), 0)
      };

      return stats;

    } catch (error: any) {
      logger.error('Failed to get event stats:', error);
      return {};
    }
  }

  async addFavoriteVenue(userId: string, venueData: VenueData): Promise<IUser> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const existingVenue = user.favoriteVenues.find(
        (venue: any) => venue.venueId === venueData.venueId
      );

      if (existingVenue) {
        throw new Error('Venue already in favorites');
      }

      user.favoriteVenues.push(venueData as any);
      await user.save();

      logger.info(`User ${userId} added favorite venue: ${venueData.name}`);
      return user;

    } catch (error: any) {
      logger.error('Failed to add favorite venue:', error);
      throw new Error(`Failed to add favorite venue: ${error.message}`);
    }
  }

  async removeFavoriteVenue(userId: string, venueId: string): Promise<IUser> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      user.favoriteVenues = user.favoriteVenues.filter(
        (venue: any) => venue.venueId !== venueId
      );

      await user.save();

      logger.info(`User ${userId} removed favorite venue: ${venueId}`);
      return user;

    } catch (error: any) {
      logger.error('Failed to remove favorite venue:', error);
      throw new Error(`Failed to remove favorite venue: ${error.message}`);
    }
  }

  async getUserLeaderboard(timeRange: string = '30d', limit: number = 50): Promise<any[]> {
    try {
      const timeRangeMs = this.getTimeRangeMs(timeRange);
      const startDate = new Date(Date.now() - timeRangeMs);

      const users = await User.find({
        'stats.lastAdventureDate': { $gte: startDate }
      })
      .sort({ 'stats.totalPoints': -1 })
      .limit(limit)
      .select('name profilePicture stats');

      return users.map((user, index) => ({
        rank: index + 1,
        userId: user._id,
        name: user.name,
        profilePicture: user.profilePicture,
        points: user.stats.totalPoints,
        adventuresCompleted: user.stats.adventuresCompleted,
        streak: user.stats.streak
      }));

    } catch (error: any) {
      logger.error('Failed to get leaderboard:', error);
      throw new Error(`Failed to get leaderboard: ${error.message}`);
    }
  }

  async deleteUser(userId: string): Promise<boolean> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      await Adventure.deleteMany({ userId: userId });
      await Event.deleteMany({ 'host.userId': userId });
      await User.updateMany(
        { friends: userId },
        { $pull: { friends: userId } }
      );
      await Notification.deleteMany({ userId: userId });
      await User.findByIdAndDelete(userId);
      await cacheService.clearUserCache(userId);

      logger.info(`User ${userId} deleted`);
      return true;

    } catch (error: any) {
      logger.error('Failed to delete user:', error);
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }

  validatePreferences(preferences: any): void {
    const validInterests = ['bars', 'music', 'food', 'outdoors', 'art', 'sports', 'social', 'solo', 'nightlife', 'culture'];
    const validSkillLevels = ['beginner', 'intermediate', 'advanced'];
    const validSocialModes = ['solo', 'friends', 'meet_new_people'];
    const validBudgets = ['low', 'medium', 'high'];

    if (preferences.interests) {
      if (!Array.isArray(preferences.interests)) {
        throw new Error('Interests must be an array');
      }
      for (const interest of preferences.interests) {
        if (!validInterests.includes(interest)) {
          throw new Error(`Invalid interest: ${interest}`);
        }
      }
    }

    if (preferences.skillLevel && !validSkillLevels.includes(preferences.skillLevel)) {
      throw new Error(`Invalid skill level: ${preferences.skillLevel}`);
    }

    if (preferences.socialMode && !validSocialModes.includes(preferences.socialMode)) {
      throw new Error(`Invalid social mode: ${preferences.socialMode}`);
    }

    if (preferences.budget && !validBudgets.includes(preferences.budget)) {
      throw new Error(`Invalid budget: ${preferences.budget}`);
    }

    if (preferences.maxDistance && (preferences.maxDistance < 1000 || preferences.maxDistance > 20000)) {
      throw new Error('Max distance must be between 1000 and 20000 meters');
    }

    if (preferences.preferredDuration && (preferences.preferredDuration < 30 || preferences.preferredDuration > 90)) {
      throw new Error('Preferred duration must be between 30 and 90 minutes');
    }
  }

  private calculateAverageAdventureRating(adventures: any[]): number {
    const ratedAdventures = adventures.filter(a => a.feedback && a.feedback.rating);
    if (ratedAdventures.length === 0) return 0;
    
    const sum = ratedAdventures.reduce((total, a) => total + (a.feedback.rating || 0), 0);
    return sum / ratedAdventures.length;
  }

  private getFavoriteAdventureInterests(adventures: any[]): Array<{ interest: string; count: number }> {
    const interestCount: Record<string, number> = {};
    adventures.forEach(adventure => {
      (adventure.preferences.interests || []).forEach((interest: string) => {
        interestCount[interest] = (interestCount[interest] || 0) + 1;
      });
    });

    return Object.entries(interestCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([interest, count]) => ({ interest, count }));
  }

  private getTimeRangeMs(timeRange: string): number {
    const ranges: Record<string, number> = {
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000,
      '1y': 365 * 24 * 60 * 60 * 1000
    };
    return ranges[timeRange] || ranges['30d'];
  }
}

export default new UserService();

