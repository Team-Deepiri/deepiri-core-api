const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Redis = require('ioredis-mock');
const { tokenRevocationService } = require('../src/services/tokenRevocationService');
const UserItem = require('../src/models/UserItem');
const User = require('../src/models/User');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  // Mock Redis for tokenRevocationService
  tokenRevocationService.redis = new Redis();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  await tokenRevocationService.redis.quit();
});

describe('TokenRevocationService', () => {
  let testUser;

  beforeEach(async () => {
    await User.deleteMany({});
    await UserItem.deleteMany({});
    await tokenRevocationService.redis.flushdb();

    testUser = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'hashedpassword'
    });
  });

  describe('revokeToken', () => {
    test('should revoke a token with specified expiry', async () => {
      const tokenId = 'test-token-123';
      const expiresIn = 3600; // 1 hour

      await tokenRevocationService.revokeToken(tokenId, expiresIn);

      const isRevoked = await tokenRevocationService.isTokenRevoked(tokenId);
      expect(isRevoked).toBe(true);
    });

    test('should set correct TTL for revoked token', async () => {
      const tokenId = 'test-token-456';
      const expiresIn = 7200; // 2 hours

      await tokenRevocationService.revokeToken(tokenId, expiresIn);

      const ttl = await tokenRevocationService.redis.ttl(`revoked_token:${tokenId}`);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(expiresIn);
    });
  });

  describe('isTokenRevoked', () => {
    test('should return false for non-revoked token', async () => {
      const tokenId = 'non-revoked-token';

      const isRevoked = await tokenRevocationService.isTokenRevoked(tokenId);
      expect(isRevoked).toBe(false);
    });

    test('should return true for revoked token', async () => {
      const tokenId = 'revoked-token-123';
      await tokenRevocationService.revokeToken(tokenId, 3600);

      const isRevoked = await tokenRevocationService.isTokenRevoked(tokenId);
      expect(isRevoked).toBe(true);
    });
  });

  describe('revokeAllUserTokens', () => {
    test('should revoke all token-type items for a user', async () => {
      // Create multiple token items
      const token1 = await UserItem.create({
        userId: testUser._id,
        name: 'Token 1',
        type: 'token',
        category: 'token',
        itemId: 'token-1',
        status: 'active',
        location: {
          source: 'achievement'
        }
      });

      const token2 = await UserItem.create({
        userId: testUser._id,
        name: 'Token 2',
        type: 'token',
        category: 'token',
        itemId: 'token-2',
        status: 'active',
        location: {
          source: 'achievement'
        }
      });

      // Non-token item (should not be revoked)
      await UserItem.create({
        userId: testUser._id,
        name: 'Badge',
        type: 'achievement',
        category: 'badge',
        itemId: 'badge',
        status: 'active',
        location: {
          source: 'achievement'
        }
      });

      await tokenRevocationService.revokeAllUserTokens(testUser._id.toString());

      const isToken1Revoked = await tokenRevocationService.isTokenRevoked('token-1');
      const isToken2Revoked = await tokenRevocationService.isTokenRevoked('token-2');

      expect(isToken1Revoked).toBe(true);
      expect(isToken2Revoked).toBe(true);
    });

    test('should handle tokens with custom attributes', async () => {
      const token = await UserItem.create({
        userId: testUser._id,
        name: 'Token with Custom Attrs',
        type: 'token',
        category: 'token',
        itemId: 'token-custom-attrs',
        properties: {
          customAttributes: [
            { key: 'expiresIn', value: '24h' }
          ]
        },
        status: 'active',
        location: {
          source: 'achievement'
        }
      });

      await tokenRevocationService.revokeAllUserTokens(testUser._id.toString());

      const isRevoked = await tokenRevocationService.isTokenRevoked('token-custom-attrs');
      expect(isRevoked).toBe(true);
    });

    test('should skip deleted token items', async () => {
      const activeToken = await UserItem.create({
        userId: testUser._id,
        name: 'Active Token',
        type: 'token',
        category: 'token',
        itemId: 'active-token',
        status: 'active',
        location: {
          source: 'achievement'
        }
      });

      const deletedToken = await UserItem.create({
        userId: testUser._id,
        name: 'Deleted Token',
        type: 'token',
        category: 'token',
        itemId: 'deleted-token',
        status: 'deleted',
        location: {
          source: 'achievement'
        }
      });

      await tokenRevocationService.revokeAllUserTokens(testUser._id.toString());

      const isActiveRevoked = await tokenRevocationService.isTokenRevoked('active-token');
      const isDeletedRevoked = await tokenRevocationService.isTokenRevoked('deleted-token');

      expect(isActiveRevoked).toBe(true);
      expect(isDeletedRevoked).toBe(false);
    });

    test('should parse duration strings correctly', async () => {
      const token = await UserItem.create({
        userId: testUser._id,
        name: 'Token with Duration',
        type: 'token',
        category: 'token',
        itemId: 'duration-token',
        properties: {
          customAttributes: [
            { key: 'expiresIn', value: '2h' }
          ]
        },
        status: 'active',
        location: {
          source: 'achievement'
        }
      });

      await tokenRevocationService.revokeAllUserTokens(testUser._id.toString());

      const ttl = await tokenRevocationService.redis.ttl('revoked_token:duration-token');
      const expectedTtl = 2 * 60 * 60; // 2 hours in seconds
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(expectedTtl);
    });

    test('should handle tokens by category', async () => {
      const categoryToken = await UserItem.create({
        userId: testUser._id,
        name: 'Category Token',
        category: 'token',
        type: 'token',
        itemId: 'category-token',
        status: 'active',
        location: {
          source: 'achievement'
        }
      });

      await tokenRevocationService.revokeAllUserTokens(testUser._id.toString());

      const isRevoked = await tokenRevocationService.isTokenRevoked('category-token');
      expect(isRevoked).toBe(true);
    });

    test('should handle user with no tokens', async () => {
      const newUser = await User.create({
        name: 'User No Tokens',
        email: 'notoken@example.com',
        password: 'hashedpassword'
      });

      // Should not throw error
      await expect(tokenRevocationService.revokeAllUserTokens(newUser._id.toString())).resolves.toBeUndefined();
    });

    test('should use default expiry when no expiry info provided', async () => {
      const token = await UserItem.create({
        userId: testUser._id,
        name: 'Token No Expiry',
        type: 'token',
        category: 'token',
        itemId: 'no-expiry-token',
        status: 'active',
        location: {
          source: 'achievement'
        }
      });

      await tokenRevocationService.revokeAllUserTokens(testUser._id.toString());

      const ttl = await tokenRevocationService.redis.ttl('revoked_token:no-expiry-token');
      const defaultExpiry = 7 * 24 * 60 * 60; // 7 days default

      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(defaultExpiry);
    });
  });
});