import { createClient, RedisClientType } from 'redis';
import CircuitBreaker from 'opossum';
import logger from '../utils/logger';

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
      
      const maxReconnectAttempts = parseInt(process.env.REDIS_RECONNECT_MAX_ATTEMPTS || '12', 10);
      const maxReconnectDelay = parseInt(process.env.REDIS_RECONNECT_MAX_DELAY_MS || '30000', 10);

      this.client = createClient({
        url: finalRedisUrl,
        socket: {
          // connectTimeout in ms
          connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT_MS || '10000', 10),
          // reconnectStrategy receives the number of attempts and should return delay in ms or false to stop
          reconnectStrategy: (retries: number) => {
            if (retries > maxReconnectAttempts) return false;
            // exponential backoff with jitter
            const base = 100; // ms
            const exp = Math.min(maxReconnectDelay, Math.floor(base * Math.pow(2, retries)));
            const jitter = Math.floor(Math.random() * base);
            return Math.min(maxReconnectDelay, exp + jitter);
          }
        }
      });

      this.client.on('error', (err: Error) => {
        logger.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis client connected');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        logger.info('Redis client ready');
        this.isConnected = true;
      });

      this.client.on('end', () => {
        logger.info('Redis client disconnected');
        this.isConnected = false;
      });

      await this.client.connect();

  // create a circuit breaker that wraps Redis operations
      const breakerOptions: CircuitBreaker.Options = {
        errorThresholdPercentage: parseInt(process.env.REDIS_BREAKER_ERROR_THRESHOLD_PCT || '50', 10),
        timeout: parseInt(process.env.REDIS_BREAKER_TIMEOUT_MS || '5000', 10),
        resetTimeout: parseInt(process.env.REDIS_BREAKER_RESET_MS || '30000', 10),
        rollingCountTimeout: 10000,
        rollingCountBuckets: 10
      };

      const action = async (fn: () => Promise<any>) => {
        return fn();
      };

  const breaker = new CircuitBreaker(action, breakerOptions);
      breaker.on('open', () => logger.warn('Redis circuit open'));
      breaker.on('halfOpen', () => logger.info('Redis circuit half-open'));
      breaker.on('close', () => logger.info('Redis circuit closed'));
      breaker.on('failure', (err) => logger.warn('Redis circuit failure', { err: err?.message }));

      // attach breaker to instance for use by methods
      (this as any)._breaker = breaker;
    } catch (error: any) {
      logger.error('Failed to initialize Redis:', error);
      this.isConnected = false;
    }
  }

  getBreakerState(): 'open' | 'halfOpen' | 'closed' | 'unknown' {
    const breaker: CircuitBreaker | undefined = (this as any)._breaker;
    if (!breaker) return 'unknown';
    if ((breaker as any).opened) return 'open';
    if ((breaker as any).halfOpen) return 'halfOpen';
    return 'closed';
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  async get(key: string): Promise<any> {
    try {
      if (!this.isConnected || !this.client) {
        logger.warn('Redis not connected, skipping cache get');
        return null;
      }

      const breaker: CircuitBreaker | undefined = (this as any)._breaker;
      if (breaker && breaker.opened) {
        logger.warn('Redis breaker open - treating as cache miss for get', { key });
        return null; // fail-fast as cache miss
      }

      const exec = async () => {
        const value = await this.client!.get(key);
        if (value) return JSON.parse(value);
        return null;
      };

      if (breaker) {
        return await breaker.fire(exec);
      }

      return await exec();
    } catch (error: any) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    try {
      if (!this.isConnected || !this.client) {
        logger.warn('Redis not connected, skipping cache set');
        return;
      }

      const breaker: CircuitBreaker | undefined = (this as any)._breaker;
      if (breaker && breaker.opened) {
        logger.warn('Redis breaker open - skipping cache set', { key });
        return; // skip writes while breaker open
      }

      const exec = async () => {
        const stringValue = JSON.stringify(value);
        await this.client!.setEx(key, ttl, stringValue);
      };

      if (breaker) {
        await breaker.fire(exec);
      } else {
        await exec();
      }
    } catch (error: any) {
      logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      if (!this.isConnected || !this.client) {
        return;
      }

      const breaker: CircuitBreaker | undefined = (this as any)._breaker;
      if (breaker && breaker.opened) {
        logger.warn('Redis breaker open - skipping delete', { key });
        return;
      }

      const exec = async () => {
        await this.client!.del(key);
      };

      if (breaker) {
        await breaker.fire(exec);
      } else {
        await exec();
      }
    } catch (error: any) {
      logger.error(`Cache delete error for key ${key}:`, error);
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
      logger.error(`Error clearing user cache for ${userId}:`, error);
    }
  }
}

export default new CacheService();

