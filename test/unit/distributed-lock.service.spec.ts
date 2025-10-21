import { Test, TestingModule } from '@nestjs/testing';
import { DistributedLockService } from '../../src/services/distributed-lock.service';
import { RedisConfigService } from '../../src/config/redis.config';
import { REDIS_LOCKS } from '../../src/constants/redis-locks';

// Mock Redis client
const mockRedisClient = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  set: jest.fn(),
  get: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
  eval: jest.fn(),
};

jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient),
}));

describe('DistributedLockService', () => {
  let service: DistributedLockService;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DistributedLockService,
        {
          provide: RedisConfigService,
          useValue: {
            url: 'redis://localhost:6379',
          },
        },
      ],
    }).compile();

    service = module.get<DistributedLockService>(DistributedLockService);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  describe('acquireLock', () => {
    it('should successfully acquire a lock when Redis is available', async () => {
      // Arrange
      mockRedisClient.set.mockResolvedValue('OK');

      // Act
      const result = await service.acquireLock(
        REDIS_LOCKS.TOKEN_PRICE_UPDATE,
        30
      );

      // Assert
      expect(result).toBe(true);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        REDIS_LOCKS.TOKEN_PRICE_UPDATE,
        expect.stringMatching(/^instance-\d+-[a-z0-9]+$/),
        {
          EX: 30,
          NX: true,
        }
      );
    });

    it('should fail to acquire lock when already held by another instance', async () => {
      // Arrange
      mockRedisClient.set.mockResolvedValue(null);

      // Act
      const result = await service.acquireLock(
        REDIS_LOCKS.TOKEN_PRICE_UPDATE,
        30
      );

      // Assert
      expect(result).toBe(false);
      expect(mockRedisClient.set).toHaveBeenCalled();
    });

    it('should handle Redis connection errors gracefully', async () => {
      // Arrange
      mockRedisClient.set.mockRejectedValue(
        new Error('Redis connection failed')
      );

      // Act
      const result = await service.acquireLock(
        REDIS_LOCKS.TOKEN_PRICE_UPDATE,
        30
      );

      // Assert
      expect(result).toBe(false);
    });

    it('should use different instance IDs for different service instances', async () => {
      // Arrange
      mockRedisClient.set.mockResolvedValue('OK');

      // Create a second service instance
      const module2: TestingModule = await Test.createTestingModule({
        providers: [
          DistributedLockService,
          {
            provide: RedisConfigService,
            useValue: {
              url: 'redis://localhost:6379',
            },
          },
        ],
      }).compile();

      const service2 = module2.get<DistributedLockService>(
        DistributedLockService
      );

      // Act
      const result1 = await service.acquireLock(
        REDIS_LOCKS.TOKEN_PRICE_UPDATE,
        30
      );
      const result2 = await service2.acquireLock(
        REDIS_LOCKS.TOKEN_PRICE_UPDATE,
        30
      );

      // Assert
      expect(result1).toBe(true);
      expect(result2).toBe(true);

      const calls = mockRedisClient.set.mock.calls;
      const lockValue1 = calls[0][1];
      const lockValue2 = calls[1][1];

      // Should have different instance IDs
      expect(lockValue1).not.toBe(lockValue2);

      // Cleanup
      await service2.onModuleDestroy();
      await module2.close();
    });
  });

  describe('releaseLock', () => {
    it('should successfully release a lock owned by this instance', async () => {
      // Arrange
      mockRedisClient.eval.mockResolvedValue(1);

      // Act
      const result = await service.releaseLock(REDIS_LOCKS.TOKEN_PRICE_UPDATE);

      // Assert
      expect(result).toBe(true);
      expect(mockRedisClient.eval).toHaveBeenCalledWith(
        expect.stringContaining('if redis.call("GET", KEYS[1]) == ARGV[1]'),
        {
          keys: [REDIS_LOCKS.TOKEN_PRICE_UPDATE],
          arguments: [expect.stringMatching(/^instance-\d+-[a-z0-9]+$/)],
        }
      );
    });

    it('should fail to release a lock not owned by this instance', async () => {
      // Arrange
      mockRedisClient.eval.mockResolvedValue(0);

      // Act
      const result = await service.releaseLock(REDIS_LOCKS.TOKEN_PRICE_UPDATE);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle Redis errors during lock release', async () => {
      // Arrange
      mockRedisClient.eval.mockRejectedValue(new Error('Redis error'));

      // Act
      const result = await service.releaseLock(REDIS_LOCKS.TOKEN_PRICE_UPDATE);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('isLocked', () => {
    it('should return true when lock exists', async () => {
      // Arrange
      mockRedisClient.exists.mockResolvedValue(1);

      // Act
      const result = await service.isLocked(REDIS_LOCKS.TOKEN_PRICE_UPDATE);

      // Assert
      expect(result).toBe(true);
      expect(mockRedisClient.exists).toHaveBeenCalledWith(
        REDIS_LOCKS.TOKEN_PRICE_UPDATE
      );
    });

    it('should return false when lock does not exist', async () => {
      // Arrange
      mockRedisClient.exists.mockResolvedValue(0);

      // Act
      const result = await service.isLocked(REDIS_LOCKS.TOKEN_PRICE_UPDATE);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle Redis errors during lock check', async () => {
      // Arrange
      mockRedisClient.exists.mockRejectedValue(new Error('Redis error'));

      // Act
      const result = await service.isLocked(REDIS_LOCKS.TOKEN_PRICE_UPDATE);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('extendLock', () => {
    it('should successfully extend lock expiration', async () => {
      // Arrange
      mockRedisClient.expire.mockResolvedValue(true);

      // Act
      const result = await service.extendLock(
        REDIS_LOCKS.TOKEN_PRICE_UPDATE,
        60
      );

      // Assert
      expect(result).toBe(true);
      expect(mockRedisClient.expire).toHaveBeenCalledWith(
        REDIS_LOCKS.TOKEN_PRICE_UPDATE,
        60
      );
    });

    it('should fail to extend lock when lock does not exist', async () => {
      // Arrange
      mockRedisClient.expire.mockResolvedValue(false);

      // Act
      const result = await service.extendLock(
        REDIS_LOCKS.TOKEN_PRICE_UPDATE,
        60
      );

      // Assert
      expect(result).toBe(false);
    });

    it('should handle Redis errors during lock extension', async () => {
      // Arrange
      mockRedisClient.expire.mockRejectedValue(new Error('Redis error'));

      // Act
      const result = await service.extendLock(
        REDIS_LOCKS.TOKEN_PRICE_UPDATE,
        60
      );

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('onModuleDestroy', () => {
    it('should release all held locks and disconnect from Redis', async () => {
      // Arrange
      mockRedisClient.disconnect.mockResolvedValue(undefined);

      // Simulate holding a lock
      await service.acquireLock(REDIS_LOCKS.TOKEN_PRICE_UPDATE, 30);

      // Act
      await service.onModuleDestroy();

      // Assert
      expect(mockRedisClient.disconnect).toHaveBeenCalled();
    });

    it('should handle errors during cleanup gracefully', async () => {
      // Arrange
      mockRedisClient.disconnect.mockRejectedValue(
        new Error('Disconnect failed')
      );

      // Act & Assert - should not throw
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent lock acquisition attempts', async () => {
      // Arrange
      mockRedisClient.set
        .mockResolvedValueOnce('OK') // First call succeeds
        .mockResolvedValueOnce(null); // Second call fails (lock already held)

      // Act
      const [result1, result2] = await Promise.all([
        service.acquireLock(REDIS_LOCKS.TOKEN_PRICE_UPDATE, 30),
        service.acquireLock(REDIS_LOCKS.TOKEN_PRICE_UPDATE, 30),
      ]);

      // Assert
      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });

    it('should handle very short lock timeouts', async () => {
      // Arrange
      mockRedisClient.set.mockResolvedValue('OK');

      // Act
      const result = await service.acquireLock(
        REDIS_LOCKS.TOKEN_PRICE_UPDATE,
        1
      );

      // Assert
      expect(result).toBe(true);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        REDIS_LOCKS.TOKEN_PRICE_UPDATE,
        expect.any(String),
        {
          EX: 1,
          NX: true,
        }
      );
    });

    it('should handle very long lock timeouts', async () => {
      // Arrange
      mockRedisClient.set.mockResolvedValue('OK');

      // Act
      const result = await service.acquireLock(
        REDIS_LOCKS.TOKEN_PRICE_UPDATE,
        86400
      ); // 24 hours

      // Assert
      expect(result).toBe(true);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        REDIS_LOCKS.TOKEN_PRICE_UPDATE,
        expect.any(String),
        {
          EX: 86400,
          NX: true,
        }
      );
    });
  });
});
