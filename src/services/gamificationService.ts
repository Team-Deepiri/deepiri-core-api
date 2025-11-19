import Gamification, { IGamification } from '../models/Gamification';
import Badge from '../models/Badge';
import logger from '../utils/logger';

const gamificationService = {
  async getOrCreateProfile(userId: string): Promise<IGamification> {
    try {
      let profile = await Gamification.findOne({ userId });
      
      if (!profile) {
        profile = new Gamification({ userId });
        await profile.save();
      }
      
      return profile;
    } catch (error: any) {
      logger.error('Error getting gamification profile:', error);
      throw error;
    }
  },

  async getLeaderboard(limit: number = 100, period: string = 'all'): Promise<any[]> {
    try {
      const query: any = {};

      const leaderboard = await Gamification.find(query)
        .populate('userId', 'name email')
        .sort({ points: -1 })
        .limit(limit)
        .select('userId points level stats.tasksCompleted stats.challengesCompleted streaks');

      leaderboard.forEach((entry: any, index: number) => {
        entry.stats.currentRank = index + 1;
      });

      return leaderboard;
    } catch (error: any) {
      logger.error('Error fetching leaderboard:', error);
      throw error;
    }
  },

  async getUserRank(userId: string): Promise<number | null> {
    try {
      const userProfile = await Gamification.findOne({ userId });
      if (!userProfile) {
        return null;
      }

      const higherScorers = await Gamification.countDocuments({
        points: { $gt: userProfile.points }
      });

      return higherScorers + 1;
    } catch (error: any) {
      logger.error('Error calculating user rank:', error);
      throw error;
    }
  },

  async awardBadge(userId: string, badgeId: string): Promise<IGamification> {
    try {
      const badge = await Badge.findById(badgeId);
      if (!badge || !badge.isActive) {
        throw new Error('Badge not found or inactive');
      }

      const profile = await this.getOrCreateProfile(userId);

      const hasBadge = profile.badges.some((b: any) => b.badgeId?.toString() === badgeId);
      if (hasBadge) {
        return profile;
      }

      profile.badges.push({
        badgeId: badge._id,
        badgeName: badge.name,
        badgeIcon: badge.icon,
        earnedAt: new Date()
      });

      profile.points += badge.pointsReward;
      profile.xp += badge.pointsReward;

      await profile.save();

      logger.info(`Badge awarded: ${badge.name} to user: ${userId}`);
      return profile;
    } catch (error: any) {
      logger.error('Error awarding badge:', error);
      throw error;
    }
  },

  async checkAndAwardBadges(userId: string): Promise<any[]> {
    try {
      const profile = await this.getOrCreateProfile(userId);
      const badges = await Badge.find({ isActive: true });

      const awardedBadges: any[] = [];

      for (const badge of badges) {
        const hasBadge = profile.badges.some((b: any) => b.badgeId?.toString() === badge._id.toString());
        if (hasBadge) continue;

        let shouldAward = false;

        switch (badge.criteria.type) {
          case 'streak':
            if (badge.criteria.value <= profile.streaks.daily.current) {
              shouldAward = true;
            }
            break;
          case 'tasks_completed':
            if (badge.criteria.value <= profile.stats.tasksCompleted) {
              shouldAward = true;
            }
            break;
          case 'challenges_completed':
            if (badge.criteria.value <= profile.stats.challengesCompleted) {
              shouldAward = true;
            }
            break;
          case 'points':
            if (badge.criteria.value <= profile.points) {
              shouldAward = true;
            }
            break;
        }

        if (shouldAward) {
          await this.awardBadge(userId, badge._id.toString());
          awardedBadges.push(badge);
        }
      }

      return awardedBadges;
    } catch (error: any) {
      logger.error('Error checking badges:', error);
      throw error;
    }
  },

  async updatePreferences(userId: string, preferences: any): Promise<IGamification> {
    try {
      const profile = await this.getOrCreateProfile(userId);
      
      profile.preferences = {
        ...profile.preferences,
        ...preferences
      };

      await profile.save();
      return profile;
    } catch (error: any) {
      logger.error('Error updating preferences:', error);
      throw error;
    }
  }
};

export default gamificationService;

