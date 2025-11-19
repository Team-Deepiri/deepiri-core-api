import Task, { ITask } from '../models/Task';
import Challenge from '../models/Challenge';
import Gamification from '../models/Gamification';
import analyticsService from './analyticsService';
import logger from '../utils/logger';
import mongoose from 'mongoose';

interface TaskData {
  title: string;
  description?: string;
  type?: string;
  status?: string;
  priority?: string;
  dueDate?: Date;
  estimatedDuration?: number;
  tags?: string[];
  metadata?: any;
  challengeId?: string;
  [key: string]: any;
}

interface TaskFilters {
  status?: string;
  type?: string;
  search?: string;
  limit?: number;
  skip?: number;
}

interface CompletionData {
  actualDuration?: number;
  notes?: string;
}

const taskService = {
  async createTask(userId: string, taskData: TaskData): Promise<ITask> {
    try {
      const task = new Task({
        userId,
        ...taskData
      });
      await task.save();
      logger.info(`Task created: ${task._id} for user: ${userId}`);
      return task;
    } catch (error: any) {
      logger.error('Error creating task:', error);
      throw error;
    }
  },

  async getUserTasks(userId: string, filters: TaskFilters = {}): Promise<ITask[]> {
    try {
      const query: any = { userId };
      
      if (filters.status) {
        query.status = filters.status;
      }
      if (filters.type) {
        query.type = filters.type;
      }
      if (filters.search) {
        query.$or = [
          { title: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } }
        ];
      }

      const tasks = await Task.find(query)
        .sort({ createdAt: -1 })
        .limit(filters.limit || 50)
        .skip(filters.skip || 0);
      
      return tasks;
    } catch (error: any) {
      logger.error('Error fetching tasks:', error);
      throw error;
    }
  },

  async getTaskById(taskId: string, userId: string): Promise<ITask> {
    try {
      const task = await Task.findOne({ _id: taskId, userId });
      if (!task) {
        throw new Error('Task not found');
      }
      return task;
    } catch (error: any) {
      logger.error('Error fetching task:', error);
      throw error;
    }
  },

  async updateTask(taskId: string, userId: string, updateData: any): Promise<ITask> {
    try {
      const task = await Task.findOneAndUpdate(
        { _id: taskId, userId },
        { $set: updateData },
        { new: true, runValidators: true }
      );
      
      if (!task) {
        throw new Error('Task not found');
      }
      
      logger.info(`Task updated: ${taskId} for user: ${userId}`);
      return task;
    } catch (error: any) {
      logger.error('Error updating task:', error);
      throw error;
    }
  },

  async deleteTask(taskId: string, userId: string): Promise<ITask> {
    try {
      const task = await Task.findOneAndDelete({ _id: taskId, userId });
      if (!task) {
        throw new Error('Task not found');
      }
      
      if (task.challengeId) {
        await Challenge.findByIdAndDelete(task.challengeId);
      }
      
      logger.info(`Task deleted: ${taskId} for user: ${userId}`);
      return task;
    } catch (error: any) {
      logger.error('Error deleting task:', error);
      throw error;
    }
  },

  async completeTask(taskId: string, userId: string, completionData: CompletionData): Promise<ITask> {
    try {
      const task = await Task.findOne({ _id: taskId, userId });
      if (!task) {
        throw new Error('Task not found');
      }

      const actualDuration = completionData.actualDuration || 0;
      const estimatedDuration = task.estimatedDuration || 1;
      const efficiency = Math.min(100, Math.max(0, (estimatedDuration / actualDuration) * 100));

      task.status = 'completed';
      task.completionData = {
        completedAt: new Date(),
        actualDuration,
        efficiency,
        notes: completionData.notes || ''
      };

      await task.save();

      await this.awardTaskCompletion(userId, task);
      await analyticsService.recordTaskCompletion(userId, task);

      logger.info(`Task completed: ${taskId} for user: ${userId}`);
      return task;
    } catch (error: any) {
      logger.error('Error completing task:', error);
      throw error;
    }
  },

  async awardTaskCompletion(userId: string, task: ITask): Promise<void> {
    try {
      let gamification = await Gamification.findOne({ userId });
      
      if (!gamification) {
        gamification = new Gamification({ userId });
      }

      const basePoints = 100;
      gamification.points += basePoints;
      gamification.xp += basePoints;
      
      gamification.stats.tasksCompleted += 1;
      gamification.stats.totalTimeSpent += (task.completionData?.actualDuration || 0);
      
      const completedTasks = gamification.stats.tasksCompleted;
      const currentAvg = gamification.stats.averageEfficiency;
      const newEfficiency = task.completionData?.efficiency || 0;
      gamification.stats.averageEfficiency = 
        ((currentAvg * (completedTasks - 1)) + newEfficiency) / completedTasks;

      await this.updateStreaks(gamification);

      await gamification.save();
    } catch (error: any) {
      logger.error('Error awarding task completion:', error);
    }
  },

  async updateStreaks(gamification: any): Promise<void> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastDate = gamification.streaks.daily.lastDate 
      ? new Date(gamification.streaks.daily.lastDate)
      : null;

    if (!lastDate || lastDate.getTime() < today.getTime()) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (lastDate && lastDate.getTime() === yesterday.getTime()) {
        gamification.streaks.daily.current += 1;
      } else {
        gamification.streaks.daily.current = 1;
      }

      if (gamification.streaks.daily.current > gamification.streaks.daily.longest) {
        gamification.streaks.daily.longest = gamification.streaks.daily.current;
      }

      gamification.streaks.daily.lastDate = today;
    }

    const weekNumber = this.getWeekNumber(now);
    const lastWeek = gamification.streaks.weekly.lastWeek;

    if (!lastWeek || lastWeek !== weekNumber) {
      if (lastWeek && this.isConsecutiveWeek(lastWeek, weekNumber)) {
        gamification.streaks.weekly.current += 1;
      } else {
        gamification.streaks.weekly.current = 1;
      }

      if (gamification.streaks.weekly.current > gamification.streaks.weekly.longest) {
        gamification.streaks.weekly.longest = gamification.streaks.weekly.current;
      }

      gamification.streaks.weekly.lastWeek = weekNumber;
    }
  },

  getWeekNumber(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return d.getUTCFullYear() + '-' + Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  },

  isConsecutiveWeek(lastWeek: string, currentWeek: string): boolean {
    return lastWeek < currentWeek;
  }
};

export default taskService;

