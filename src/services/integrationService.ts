import Integration, { IIntegration } from '../models/Integration';
import Task from '../models/Task';
import taskService from './taskService';
import logger from '../utils/logger';
import axios from 'axios';

interface Credentials {
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  apiKey?: string;
}

const integrationService = {
  async connectIntegration(userId: string, service: string, credentials: Credentials): Promise<IIntegration> {
    try {
      let integration = await Integration.findOne({ userId, service });

      if (integration) {
        integration.status = 'connected';
        integration.credentials = credentials;
        integration.lastSync = new Date();
      } else {
        integration = new Integration({
          userId,
          service: service as any,
          credentials,
          status: 'connected',
          lastSync: new Date()
        });
      }

      await integration.save();

      await this.syncIntegration(userId, service);

      logger.info(`Integration connected: ${service} for user: ${userId}`);
      return integration;
    } catch (error: any) {
      logger.error('Error connecting integration:', error);
      throw error;
    }
  },

  async disconnectIntegration(userId: string, service: string): Promise<IIntegration> {
    try {
      const integration = await Integration.findOne({ userId, service });
      if (!integration) {
        throw new Error('Integration not found');
      }

      integration.status = 'disconnected';
      integration.credentials = {};
      await integration.save();

      logger.info(`Integration disconnected: ${service} for user: ${userId}`);
      return integration;
    } catch (error: any) {
      logger.error('Error disconnecting integration:', error);
      throw error;
    }
  },

  async getUserIntegrations(userId: string): Promise<IIntegration[]> {
    try {
      const integrations = await Integration.find({ userId });
      return integrations;
    } catch (error: any) {
      logger.error('Error fetching integrations:', error);
      throw error;
    }
  },

  async syncIntegration(userId: string, service: string): Promise<any> {
    try {
      const integration = await Integration.findOne({ userId, service });
      if (!integration || integration.status !== 'connected') {
        throw new Error('Integration not found or not connected');
      }

      integration.status = 'syncing';
      await integration.save();

      const tasks = await this.fetchTasksFromService(integration);
      
      const createdTasks: any[] = [];
      for (const taskData of tasks) {
        try {
          const task = await taskService.createTask(userId, {
            ...taskData,
            type: service,
            metadata: {
              sourceId: taskData.id,
              sourceUrl: taskData.url,
              sourceData: taskData
            }
          });
          createdTasks.push(task);
        } catch (error: any) {
          logger.error('Error creating task from integration:', error);
        }
      }

      integration.status = 'connected';
      integration.lastSync = new Date();
      integration.syncStats.totalTasksSynced += createdTasks.length;
      integration.syncStats.lastSyncSuccess = true;
      await integration.save();

      logger.info(`Synced ${createdTasks.length} tasks from ${service} for user: ${userId}`);
      return { tasks: createdTasks, count: createdTasks.length };
    } catch (error: any) {
      logger.error('Error syncing integration:', error);
      
      const integration = await Integration.findOne({ userId, service });
      if (integration) {
        integration.status = 'error';
        integration.syncStats.lastSyncSuccess = false;
        integration.syncStats.lastSyncError = error.message;
        await integration.save();
      }
      
      throw error;
    }
  },

  async fetchTasksFromService(integration: IIntegration): Promise<any[]> {
    try {
      switch (integration.service) {
        case 'notion':
          return await this.fetchNotionTasks(integration);
        case 'trello':
          return await this.fetchTrelloTasks(integration);
        case 'github':
          return await this.fetchGithubTasks(integration);
        case 'google_docs':
          return await this.fetchGoogleDocsTasks(integration);
        default:
          throw new Error(`Unsupported service: ${integration.service}`);
      }
    } catch (error: any) {
      logger.error(`Error fetching tasks from ${integration.service}:`, error);
      throw error;
    }
  },

  async fetchNotionTasks(integration: IIntegration): Promise<any[]> {
    logger.info('Notion integration not yet implemented');
    return [];
  },

  async fetchTrelloTasks(integration: IIntegration): Promise<any[]> {
    logger.info('Trello integration not yet implemented');
    return [];
  },

  async fetchGithubTasks(integration: IIntegration): Promise<any[]> {
    logger.info('GitHub integration not yet implemented');
    return [];
  },

  async fetchGoogleDocsTasks(integration: IIntegration): Promise<any[]> {
    logger.info('Google Docs integration not yet implemented');
    return [];
  },

  async syncAllIntegrations(userId: string): Promise<any[]> {
    try {
      const integrations = await Integration.find({ 
        userId, 
        status: 'connected',
        'configuration.autoSync': true
      });

      const results: any[] = [];
      for (const integration of integrations) {
        try {
          const result = await this.syncIntegration(userId, integration.service);
          results.push({ service: integration.service, ...result });
        } catch (error: any) {
          results.push({ 
            service: integration.service, 
            error: error.message 
          });
        }
      }

      return results;
    } catch (error: any) {
      logger.error('Error syncing all integrations:', error);
      throw error;
    }
  }
};

export default integrationService;

