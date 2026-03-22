import { createClient, RedisClientType } from 'redis';
import { secureLog } from '../utils/secureLogger';

class CacheService {
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;

  async initialize(): Promise<void> {
    try {
      const redisHost = process.env.REDIS_HOST || 'localhost';
      const redisPort = process.env.REDIS_PORT || '6379';
      const redisPassword = process.env.REDIS_PASSWORD;
      
      let redisUrl = `redis://${redisHost}:${redisPort}`;
      if (redisPassword) {
        redisUrl = `redis://:${redisPassword}@${redisHost}:${redisPort}`;
      }
      
      const finalRedisUrl = process.env.REDIS_URL || redisUrl;
      
      this.client = createClient({
        url: finalRedisUrl
      });

      this.client.on('error', (err: Error) => {
        secureLog('error', 'Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        secureLog('info', 'Redis client connected');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        secureLog('info', 'Redis client ready');
        this.isConnected = true;
      });

      this.client.on('end', () => {
        secureLog('info', 'Redis client disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error: any) {
      secureLog('error', 'Failed to initialize Redis:', error);
      this.isConnected = false;
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  async get(key: string): Promise<any> {
    try {
      if (!this.isConnected || !this.client) {
        secureLog('warn', 'Redis not connected, skipping cache get');
        return null;
      }

      const value = await this.client.get(key);
      if (value) {
        return JSON.parse(value);
      }
      return null;
    } catch (error: any) {
      secureLog('error', `Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    try {
      if (!this.isConnected || !this.client) {
        secureLog('warn', 'Redis not connected, skipping cache set');
        return;
      }

      const stringValue = JSON.stringify(value);
      await this.client.setEx(key, ttl, stringValue);
    } catch (error: any) {
      secureLog('error', `Cache set error for key ${key}:`, error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      if (!this.isConnected || !this.client) {
        return;
      }

      await this.client.del(key);
    } catch (error: any) {
      secureLog('error', `Cache delete error for key ${key}:`, error);
    }
  }

  async setUserPreferences(userId: string, preferences: any): Promise<void> {
    await this.set(`user:${userId}:preferences`, preferences, 3600);
  }

  async getUserPreferences(userId: string): Promise<any> {
    return await this.get(`user:${userId}:preferences`);
  }

  async setAdventure(userId: string, location: any, interests: string[], adventure: any): Promise<void> {
    const key = `adventure:${userId}:${location.lat}:${location.lng}:${interests.join(',')}`;
    await this.set(key, adventure, 1800);
  }

  async getAdventure(userId: string, location: any, interests: string[]): Promise<any> {
    const key = `adventure:${userId}:${location.lat}:${location.lng}:${interests.join(',')}`;
    return await this.get(key);
  }

  async clearUserCache(userId: string): Promise<void> {
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      const keys = await this.client.keys(`*:${userId}*`);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error: any) {
      secureLog('error', `Error clearing user cache for ${userId}:`, error);
    }
  }
}

export default new CacheService();

