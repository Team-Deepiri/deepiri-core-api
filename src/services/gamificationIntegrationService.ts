import httpClient from '../utils/httpClient';
import logger from '../utils/logger';

const ENGAGEMENT_SERVICE_URL = process.env.ENGAGEMENT_SERVICE_URL || 'http://localhost:5003';

class GamificationIntegrationService {
  /**
   * Award momentum for task completion
   */
  async awardTaskCompletion(userId: string, taskData: any): Promise<void> {
    try {
      // Calculate momentum based on task properties
      const momentumAmount = this.calculateTaskMomentum(taskData);
      
      // Award momentum
      await httpClient.httpRequest({
        serviceName: 'engagement',
        url: '/momentum/award',
        method: 'post',
        data: {
          userId,
          amount: momentumAmount,
          source: 'tasks',
          metadata: {
            taskId: taskData._id,
            taskType: taskData.type,
            efficiency: taskData.completionData?.efficiency
          }
        }
      });

      // Update daily streak
  await httpClient.httpRequest({ serviceName: 'engagement', url: '/streaks/update', method: 'post', data: { userId, streakType: 'daily' } });

      logger.info(`Gamification awarded for task completion: ${taskData._id}`);
    } catch (error: any) {
      logger.error('Failed to award gamification for task:', error.message);
      // Don't throw - gamification failures shouldn't break task completion
    }
  }

  /**
   * Award momentum for challenge completion
   */
  async awardChallengeCompletion(userId: string, challengeData: any): Promise<void> {
    try {
      const momentumAmount = this.calculateChallengeMomentum(challengeData);
      
      await httpClient.httpRequest({
        serviceName: 'engagement',
        url: '/momentum/award',
        method: 'post',
        data: {
          userId,
          amount: momentumAmount,
          source: 'tasks',
          metadata: {
            challengeId: challengeData._id,
            challengeType: challengeData.type,
            score: challengeData.completionData?.score
          }
        }
      });

  await httpClient.httpRequest({ serviceName: 'engagement', url: '/streaks/update', method: 'post', data: { userId, streakType: 'daily' } });

      logger.info(`Gamification awarded for challenge completion: ${challengeData._id}`);
    } catch (error: any) {
      logger.error('Failed to award gamification for challenge:', error.message);
    }
  }

  /**
   * Award momentum for commit
   */
  async awardCommit(userId: string, commitData: any): Promise<void> {
    try {
      const momentumAmount = this.calculateCommitMomentum(commitData);
      
      await httpClient.httpRequest({
        serviceName: 'engagement',
        url: '/momentum/award',
        method: 'post',
        data: {
          userId,
          amount: momentumAmount,
          source: 'commits',
          metadata: commitData
        }
      });

      // Update PR streak
      await httpClient.httpRequest({ serviceName: 'engagement', url: '/streaks/update', method: 'post', data: { userId, streakType: 'pr' } });

      logger.info(`Gamification awarded for commit: ${commitData.commitId}`);
    } catch (error: any) {
      logger.error('Failed to award gamification for commit:', error.message);
    }
  }

  /**
   * Award momentum for document activity
   */
  async awardDocumentActivity(userId: string, docData: any): Promise<void> {
    try {
      const momentumAmount = this.calculateDocMomentum(docData);
      
      await httpClient.httpRequest({
        serviceName: 'engagement',
        url: '/momentum/award',
        method: 'post',
        data: {
          userId,
          amount: momentumAmount,
          source: 'docs',
          metadata: docData
        }
      });

      logger.info(`Gamification awarded for document activity`);
    } catch (error: any) {
      logger.error('Failed to award gamification for document:', error.message);
    }
  }

  // Calculation methods
  private calculateTaskMomentum(taskData: any): number {
    let base = 10;
    
    // Bonus for efficiency
    if (taskData.completionData?.efficiency) {
      const efficiency = taskData.completionData.efficiency;
      if (efficiency > 90) base += 5;
      else if (efficiency > 70) base += 3;
    }
    
    // Bonus for task type
    if (taskData.type === 'code') base += 5;
    if (taskData.type === 'design') base += 3;
    if (taskData.priority === 'urgent') base += 5;
    
    return Math.round(base);
  }

  private calculateChallengeMomentum(challengeData: any): number {
    let base = 15;
    
    // Bonus for score
    if (challengeData.completionData?.score) {
      const score = challengeData.completionData.score;
      if (score >= 90) base += 10;
      else if (score >= 70) base += 5;
    }
    
    // Bonus for difficulty
    if (challengeData.difficulty === 'hard') base += 10;
    else if (challengeData.difficulty === 'medium') base += 5;
    
    return Math.round(base);
  }

  private calculateCommitMomentum(commitData: any): number {
    let base = 5;
    
    if (commitData.filesChanged) {
      base += Math.min(commitData.filesChanged * 0.5, 10);
    }
    
    if (commitData.linesAdded) {
      base += Math.min(commitData.linesAdded * 0.1, 15);
    }
    
    return Math.round(base);
  }

  private calculateDocMomentum(docData: any): number {
    let base = 3;
    
    if (docData.action === 'create') base += 2;
    if (docData.wordCount) {
      base += Math.min(docData.wordCount / 100, 5);
    }
    
    return Math.round(base);
  }
}

export default new GamificationIntegrationService();

