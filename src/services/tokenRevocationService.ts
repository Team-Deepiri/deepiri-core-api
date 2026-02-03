import Redis from 'ioredis';
import logger from '../utils/logger';
import UserItem from '../models/UserItem';

class TokenRevocationService {
  private redis: Redis;
  private prefix = 'revoked_token:';

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  async revokeToken(tokenId: string, expiresIn: number): Promise<void> {
    const key = `${this.prefix}${tokenId}`;
    await this.redis.setex(key, expiresIn, '1');
    logger.info(`Token revoked: ${tokenId}`);
  }

  async isTokenRevoked(tokenId: string): Promise<boolean> {
    const key = `${this.prefix}${tokenId}`;
    const result = await this.redis.get(key);
    return result === '1';
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    const parseDurationToSeconds = (value: string): number | null => {
      const match = value.trim().match(/^(\d+)\s*(s|m|h|d|w)?$/i);
      if (!match) {
        return null;
      }

      const amount = parseInt(match[1], 10);
      const unit = (match[2] || 's').toLowerCase();

      switch (unit) {
        case 's':
          return amount;
        case 'm':
          return amount * 60;
        case 'h':
          return amount * 60 * 60;
        case 'd':
          return amount * 24 * 60 * 60;
        case 'w':
          return amount * 7 * 24 * 60 * 60;
        default:
          return null;
      }
    };

    const resolveExpiresIn = (item: any): number => {
      const customAttributes = item?.properties?.customAttributes || [];
      const lookup = (keys: string[]): any => {
        const found = customAttributes.find((attr: any) => keys.includes(String(attr?.key || '').toLowerCase()));
        return found?.value;
      };

      const expiresInValue = lookup(['expiresin', 'expiresinseconds', 'ttl']);
      if (typeof expiresInValue === 'number' && Number.isFinite(expiresInValue)) {
        return Math.max(1, Math.floor(expiresInValue));
      }
      if (typeof expiresInValue === 'string') {
        const parsed = parseDurationToSeconds(expiresInValue);
        if (parsed && parsed > 0) {
          return parsed;
        }
      }

      const expiresAtValue = lookup(['expiresat', 'expiry', 'expires', 'tokenexpiresat']);
      if (expiresAtValue) {
        const expiresAt = new Date(expiresAtValue);
        if (!Number.isNaN(expiresAt.getTime())) {
          const diffSeconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
          if (diffSeconds > 0) {
            return diffSeconds;
          }
        }
      }

      const defaultExpiresIn = parseDurationToSeconds(process.env.JWT_EXPIRES_IN || '7d');
      return defaultExpiresIn && defaultExpiresIn > 0 ? defaultExpiresIn : 7 * 24 * 60 * 60;
    };

    const resolveTokenId = (item: any): string | null => {
      if (item?.itemId) {
        return String(item.itemId);
      }

      const customAttributes = item?.properties?.customAttributes || [];
      const tokenAttr = customAttributes.find((attr: any) => {
        const key = String(attr?.key || '').toLowerCase();
        return ['tokenid', 'jti', 'token_id', 'id'].includes(key);
      });

      if (tokenAttr?.value) {
        return String(tokenAttr.value);
      }

      return null;
    };

    const items = await UserItem.find({
      userId,
      status: { $ne: 'deleted' },
      $or: [{ type: 'token' }, { category: 'token' }]
    }).lean();

    if (!items.length) {
      logger.info(`No token items found for user: ${userId}`);
      return;
    }

    const revokeTasks = items.map(async (item: any) => {
      const tokenId = resolveTokenId(item);
      if (!tokenId) {
        logger.warn(`Skipping token item without tokenId for user: ${userId}`);
        return;
      }

      const expiresIn = resolveExpiresIn(item);
      await this.revokeToken(tokenId, expiresIn);
    });

    await Promise.all(revokeTasks);
    logger.info(`All user tokens revoked for user: ${userId}`);
  }
}

export const tokenRevocationService = new TokenRevocationService();