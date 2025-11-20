import mongoose from 'mongoose';
import Challenge, { IChallenge } from '../models/Challenge';
import Task from '../models/Task';
import Gamification from '../models/Gamification';
import analyticsService from './analyticsService';
import logger from '../utils/logger';
import axios from 'axios';

interface ChallengeFilters {
  status?: string;
  type?: string;
  taskId?: string;
  limit?: number;
  skip?: number;
}

interface CompletionData {
  completionTime?: number;
  score?: number;
  accuracy?: number;
  attemptsUsed?: number;
  hintsUsed?: number;
}

const challengeService = {
  async generateChallenge(userId: string, taskId: string): Promise<IChallenge> {
    try {
      const task = await Task.findOne({ _id: taskId, userId });
      if (!task) {
        throw new Error('Task not found');
      }

      const challengeData = await this.callAIChallengeService(task);

      const challenge = new Challenge({
        userId,
        taskId,
        type: challengeData.type || 'timed_completion',
        title: challengeData.title || `Challenge: ${task.title}`,
        description: challengeData.description || '',
        difficulty: challengeData.difficulty || 'medium',
        difficultyScore: challengeData.difficultyScore || 5,
        configuration: challengeData.configuration || {},
        pointsReward: challengeData.pointsReward || 100,
        aiGenerated: true,
        aiMetadata: {
          model: challengeData.model || 'gpt-4',
          prompt: challengeData.prompt || '',
          generationTime: challengeData.generationTime || 0
        }
      });

      await challenge.save();

      if (!challenge._id) {
        throw new Error('Failed to create challenge');
      }
      const challengeId = challenge._id instanceof mongoose.Types.ObjectId 
        ? challenge._id 
        : new mongoose.Types.ObjectId(String(challenge._id));
      task.challengeId = challengeId;
      await task.save();

      logger.info(`Challenge generated: ${challenge._id} for task: ${taskId}`);
      return challenge;
    } catch (error: any) {
      logger.error('Error generating challenge:', error);
      throw error;
    }
  },

  async callAIChallengeService(task: any): Promise<any> {
    try {
      const pythonAgentUrl = process.env.CYREX_URL || 'http://localhost:8000';
      const response = await axios.post(`${pythonAgentUrl}/agent/challenge/generate`, {
        task: {
          title: task.title,
          description: task.description,
          type: task.type,
          estimatedDuration: task.estimatedDuration
        }
      }, {
        headers: {
          'x-api-key': process.env.CYREX_API_KEY || ''
        },
        timeout: 30000
      });

      return response.data.data || {};
    } catch (error: any) {
      logger.error('Error calling AI challenge service:', error);
      return {
        type: 'timed_completion',
        title: `Complete: ${task.title}`,
        description: `Complete this task within the estimated time!`,
        difficulty: 'medium',
        configuration: {
          timeLimit: task.estimatedDuration || 30
        }
      };
    }
  },

  async getUserChallenges(userId: string, filters: ChallengeFilters = {}): Promise<IChallenge[]> {
    try {
      const query: any = { userId };
      
      if (filters.status) {
        query.status = filters.status;
      }
      if (filters.type) {
        query.type = filters.type;
      }
      if (filters.taskId) {
        query.taskId = filters.taskId;
      }

      const challenges = await Challenge.find(query)
        .populate('taskId', 'title description')
        .sort({ createdAt: -1 })
        .limit(filters.limit || 50)
        .skip(filters.skip || 0);
      
      return challenges;
    } catch (error: any) {
      logger.error('Error fetching challenges:', error);
      throw error;
    }
  },

  async getChallengeById(challengeId: string, userId: string): Promise<IChallenge> {
    try {
      const challenge = await Challenge.findOne({ _id: challengeId, userId })
        .populate('taskId');
      if (!challenge) {
        throw new Error('Challenge not found');
      }
      return challenge;
    } catch (error: any) {
      logger.error('Error fetching challenge:', error);
      throw error;
    }
  },

  async completeChallenge(challengeId: string, userId: string, completionData: CompletionData): Promise<IChallenge> {
    try {
      const challenge = await Challenge.findOne({ _id: challengeId, userId });
      if (!challenge) {
        throw new Error('Challenge not found');
      }

      challenge.status = 'completed';
      challenge.completionData = {
        completedAt: new Date(),
        completionTime: completionData.completionTime || 0,
        score: completionData.score || 0,
        accuracy: completionData.accuracy || 100,
        attemptsUsed: completionData.attemptsUsed || 1,
        hintsUsed: completionData.hintsUsed || 0
      };

      await challenge.save();

      await this.awardChallengeCompletion(userId, challenge);
      await analyticsService.recordChallengeCompletion(userId, challenge);

      logger.info(`Challenge completed: ${challengeId} for user: ${userId}`);
      return challenge;
    } catch (error: any) {
      logger.error('Error completing challenge:', error);
      throw error;
    }
  },

  async awardChallengeCompletion(userId: string, challenge: IChallenge): Promise<void> {
    try {
      let gamification = await Gamification.findOne({ userId });
      
      if (!gamification) {
        gamification = new Gamification({ userId });
      }

      const basePoints = challenge.pointsReward || 100;
      const bonusMultiplier = challenge.bonusMultiplier || 1.0;
      const finalPoints = Math.floor(basePoints * bonusMultiplier);

      gamification.points += finalPoints;
      gamification.xp += finalPoints;
      
      gamification.stats.challengesCompleted += 1;

      await gamification.save();
    } catch (error: any) {
      logger.error('Error awarding challenge completion:', error);
    }
  }
};

export default challengeService;

