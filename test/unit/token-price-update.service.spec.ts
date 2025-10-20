import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { TokenPriceUpdateService } from '../../src/services/token-price-update.service';
import { MockPriceService } from '../../src/services/mock-price.service';
import { KafkaProducerService } from '../../src/kafka/kafka-producer.service';
import { DistributedLockService } from '../../src/services/distributed-lock.service';
import { Token } from '../../src/entities/token.entity';
import { REDIS_LOCKS } from '../../src/constants/redis-locks';

describe('TokenPriceUpdateService', () => {
  let service: TokenPriceUpdateService;
  let tokenRepository: Repository<Token>;
  let mockPriceService: MockPriceService;
  let kafkaProducerService: KafkaProducerService;
  let distributedLockService: DistributedLockService;
  let mockQueryRunner: Partial<QueryRunner>;

  const getMockToken: () => Token = () =>
    ({
      id: '123e4567-e89b-12d3-a456-426614174000',
      address: '0x1234567890123456789012345678901234567890',
      symbol: 'TEST',
      name: 'Test Token',
      decimals: 18,
      isNative: false,
      isProtected: false,
      isVerified: true,
      lastUpdateAuthor: 'system',
      priority: 1,
      totalSupply: 1000000n,
      price: 100000000n, // 1.00 USD in 10^-8 dollars
      marketCap: '1000000',
      logoUrl: 'https://example.com/logo.png',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastPriceUpdate: new Date(),
      chainId: 'chain-123',
      chain: null, // Will be set in tests
    } as Token);

  beforeEach(async () => {
    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        save: jest.fn(),
        findOne: jest.fn(),
      } as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenPriceUpdateService,
        {
          provide: getRepositoryToken(Token),
          useValue: {
            count: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: MockPriceService,
          useValue: {
            getRandomPriceForToken: jest.fn(),
          },
        },
        {
          provide: KafkaProducerService,
          useValue: {
            sendPriceUpdateMessage: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
          },
        },
        {
          provide: DistributedLockService,
          useValue: {
            acquireLock: jest.fn(),
            releaseLock: jest.fn(),
            isLocked: jest.fn(),
            extendLock: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TokenPriceUpdateService>(TokenPriceUpdateService);
    tokenRepository = module.get<Repository<Token>>(getRepositoryToken(Token));
    mockPriceService = module.get<MockPriceService>(MockPriceService);
    kafkaProducerService =
      module.get<KafkaProducerService>(KafkaProducerService);
    distributedLockService = module.get<DistributedLockService>(
      DistributedLockService
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should handle scheduled price updates', () => {
    // Test that the service can be instantiated and scheduled methods exist
    expect(service).toBeDefined();
    expect(typeof service['handlePriceUpdateCron']).toBe('function');
  });

  it('should skip execution when distributed lock is not acquired', async () => {
    // Arrange
    jest.spyOn(distributedLockService, 'acquireLock').mockResolvedValue(false);
    jest.spyOn(distributedLockService, 'releaseLock').mockResolvedValue(true);

    // Act
    await service['handlePriceUpdateCron']();

    // Assert
    expect(distributedLockService.acquireLock).toHaveBeenCalled();
    expect(distributedLockService.releaseLock).not.toHaveBeenCalled();
  });

  it('should execute price updates when distributed lock is acquired', async () => {
    // Arrange
    const tokens = [getMockToken()];
    jest.spyOn(distributedLockService, 'acquireLock').mockResolvedValue(true);
    jest.spyOn(distributedLockService, 'releaseLock').mockResolvedValue(true);
    jest.spyOn(tokenRepository, 'count').mockResolvedValue(1);
    jest.spyOn(tokenRepository, 'find').mockResolvedValue(tokens);
    jest
      .spyOn(mockPriceService, 'getRandomPriceForToken')
      .mockResolvedValue(200000000n);
    jest
      .spyOn(kafkaProducerService, 'sendPriceUpdateMessage')
      .mockResolvedValue();
    jest.spyOn(mockQueryRunner.manager, 'save');

    // Act
    await service['handlePriceUpdateCron']();

    // Assert
    expect(distributedLockService.acquireLock).toHaveBeenCalled();
    expect(distributedLockService.releaseLock).toHaveBeenCalled();
    expect(tokenRepository.count).toHaveBeenCalled();
  });

  it('should use transactional method for price updates', async () => {
    // Arrange
    const tokens = [getMockToken()];
    jest.clearAllMocks();
    jest.spyOn(tokenRepository, 'count').mockResolvedValue(1);
    jest.spyOn(tokenRepository, 'find').mockResolvedValue(tokens);
    jest
      .spyOn(mockPriceService, 'getRandomPriceForToken')
      .mockResolvedValue(200000000n);
    jest
      .spyOn(kafkaProducerService, 'sendPriceUpdateMessage')
      .mockResolvedValue();
    jest.spyOn(mockQueryRunner.manager, 'save');

    // Act
    await service['updatePrices'](async () => {
      // Mock heartbeat
    });

    // Assert
    expect(mockQueryRunner.connect).toHaveBeenCalled();
    expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    expect(mockQueryRunner.release).toHaveBeenCalled();
  });

  it('should handle empty token list', async () => {
    // Arrange
    jest.clearAllMocks();
    jest.spyOn(tokenRepository, 'count').mockResolvedValue(0);

    // Act
    await service['updatePrices'](async () => {
      // Mock heartbeat
    });

    // Assert
    expect(tokenRepository.count).toHaveBeenCalled();
    expect(tokenRepository.find).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    // Arrange
    jest.clearAllMocks();
    jest
      .spyOn(tokenRepository, 'count')
      .mockRejectedValue(new Error('Database error'));

    // Act
    await service['updatePrices'](async () => {
      // Mock heartbeat
    });

    // Assert - should not throw
    expect(tokenRepository.count).toHaveBeenCalled();
  });

  describe('edge cases and error scenarios', () => {
    it('should handle database connection failures during price updates', async () => {
      // Arrange
      jest.clearAllMocks();
      jest.spyOn(tokenRepository, 'count').mockResolvedValue(1);
      jest
        .spyOn(tokenRepository, 'find')
        .mockRejectedValue(new Error('Connection lost'));

      // Act & Assert - should not throw
      await expect(
        service['updatePrices'](async () => {})
      ).resolves.not.toThrow();
    });

    it('should handle price service failures gracefully', async () => {
      // Arrange
      const tokens = [getMockToken()];
      jest.clearAllMocks();
      jest.spyOn(tokenRepository, 'count').mockResolvedValue(1);
      jest.spyOn(tokenRepository, 'find').mockResolvedValue(tokens);
      jest
        .spyOn(mockPriceService, 'getRandomPriceForToken')
        .mockRejectedValue(new Error('Price API down'));

      // Act & Assert - should not throw
      await expect(
        service['updatePrices'](async () => {})
      ).resolves.not.toThrow();
    });

    it('should handle Kafka producer failures during message sending', async () => {
      // Arrange
      const tokens = [getMockToken()];
      jest.clearAllMocks();
      jest.spyOn(tokenRepository, 'count').mockResolvedValue(1);
      jest.spyOn(tokenRepository, 'find').mockResolvedValue(tokens);
      jest
        .spyOn(mockPriceService, 'getRandomPriceForToken')
        .mockResolvedValue(200000000n);
      jest
        .spyOn(kafkaProducerService, 'sendPriceUpdateMessage')
        .mockRejectedValue(new Error('Kafka unavailable'));
      jest.spyOn(mockQueryRunner.manager, 'save');

      // Act & Assert - should not throw
      await expect(
        service['updatePrices'](async () => {})
      ).resolves.not.toThrow();
    });

    it('should handle transaction rollback when Kafka fails', async () => {
      // Arrange
      const tokens = [getMockToken()];
      jest.clearAllMocks();
      jest.spyOn(tokenRepository, 'count').mockResolvedValue(1);
      jest.spyOn(tokenRepository, 'find').mockResolvedValue(tokens);
      jest
        .spyOn(mockPriceService, 'getRandomPriceForToken')
        .mockResolvedValue(200000000n);
      jest
        .spyOn(kafkaProducerService, 'sendPriceUpdateMessage')
        .mockRejectedValue(new Error('Kafka error'));
      jest.spyOn(mockQueryRunner.manager, 'save');

      // Act
      await service['updatePrices'](async () => {});

      // Assert - The service should handle the error gracefully
      expect(mockQueryRunner.manager.save).toHaveBeenCalled();
      expect(kafkaProducerService.sendPriceUpdateMessage).toHaveBeenCalled();
    });

    it('should handle empty token list gracefully', async () => {
      // Arrange
      jest.clearAllMocks();
      jest.spyOn(tokenRepository, 'count').mockResolvedValue(0);

      // Act
      await service['updatePrices'](async () => {});

      // Assert
      expect(tokenRepository.count).toHaveBeenCalled();
      expect(tokenRepository.find).not.toHaveBeenCalled();
    });

    it('should handle large batch sizes efficiently', async () => {
      // Arrange
      const largeTokenList = Array.from({ length: 150 }, (_, i) => ({
        ...getMockToken(),
        id: `token-${i}`,
        symbol: `TOKEN${i}`,
      }));

      jest.clearAllMocks();
      jest.spyOn(tokenRepository, 'count').mockResolvedValue(150);
      jest
        .spyOn(tokenRepository, 'find')
        .mockResolvedValueOnce(largeTokenList.slice(0, 100)) // First batch
        .mockResolvedValueOnce(largeTokenList.slice(100, 150)); // Second batch
      jest
        .spyOn(mockPriceService, 'getRandomPriceForToken')
        .mockResolvedValue(200000000n);
      jest
        .spyOn(kafkaProducerService, 'sendPriceUpdateMessage')
        .mockResolvedValue();
      jest.spyOn(mockQueryRunner.manager, 'save');

      // Act
      await service['updatePrices'](async () => {});

      // Assert
      expect(tokenRepository.find).toHaveBeenCalledTimes(2);
      expect(mockPriceService.getRandomPriceForToken).toHaveBeenCalledTimes(
        150
      );
    });

    it('should handle heartbeat function failures', async () => {
      // Arrange
      const tokens = [getMockToken()];
      jest.clearAllMocks();
      jest.spyOn(tokenRepository, 'count').mockResolvedValue(1);
      jest.spyOn(tokenRepository, 'find').mockResolvedValue(tokens);
      jest
        .spyOn(mockPriceService, 'getRandomPriceForToken')
        .mockResolvedValue(200000000n);
      jest
        .spyOn(kafkaProducerService, 'sendPriceUpdateMessage')
        .mockResolvedValue();
      jest.spyOn(mockQueryRunner.manager, 'save');

      const failingHeartbeat = jest
        .fn()
        .mockRejectedValue(new Error('Heartbeat failed'));

      // Act & Assert - should not throw
      await expect(
        service['updatePrices'](failingHeartbeat)
      ).resolves.not.toThrow();
    });

    it('should handle distributed lock acquisition failures', async () => {
      // Arrange
      jest
        .spyOn(distributedLockService, 'acquireLock')
        .mockResolvedValue(false);

      // Act
      await service['handlePriceUpdateCron']();

      // Assert
      expect(distributedLockService.acquireLock).toHaveBeenCalledWith(
        REDIS_LOCKS.TOKEN_PRICE_UPDATE,
        30
      );
      expect(distributedLockService.releaseLock).not.toHaveBeenCalled();
    });

    it('should handle price service returning zero price', async () => {
      // Arrange
      const tokens = [getMockToken()];
      jest.clearAllMocks();
      jest.spyOn(tokenRepository, 'count').mockResolvedValue(1);
      jest.spyOn(tokenRepository, 'find').mockResolvedValue(tokens);
      jest
        .spyOn(mockPriceService, 'getRandomPriceForToken')
        .mockResolvedValue(0n);
      jest
        .spyOn(kafkaProducerService, 'sendPriceUpdateMessage')
        .mockResolvedValue();
      jest.spyOn(mockQueryRunner.manager, 'save');

      // Act
      await service['updatePrices'](async () => {});

      // Assert
      expect(mockQueryRunner.manager.save).toHaveBeenCalled();
      expect(kafkaProducerService.sendPriceUpdateMessage).toHaveBeenCalled();
    });

    it('should handle price service returning very large price', async () => {
      // Arrange
      const tokens = [getMockToken()];
      const veryLargePrice = 999999999999999999n;
      jest.clearAllMocks();
      jest.spyOn(tokenRepository, 'count').mockResolvedValue(1);
      jest.spyOn(tokenRepository, 'find').mockResolvedValue(tokens);
      jest
        .spyOn(mockPriceService, 'getRandomPriceForToken')
        .mockResolvedValue(veryLargePrice);
      jest
        .spyOn(kafkaProducerService, 'sendPriceUpdateMessage')
        .mockResolvedValue();
      jest.spyOn(mockQueryRunner.manager, 'save');

      // Act
      await service['updatePrices'](async () => {});

      // Assert
      expect(mockQueryRunner.manager.save).toHaveBeenCalled();
      expect(kafkaProducerService.sendPriceUpdateMessage).toHaveBeenCalled();
    });

    it('should handle database save failures', async () => {
      // Arrange
      const tokens = [getMockToken()];
      jest.clearAllMocks();
      jest.spyOn(tokenRepository, 'count').mockResolvedValue(1);
      jest.spyOn(tokenRepository, 'find').mockResolvedValue(tokens);
      jest
        .spyOn(mockPriceService, 'getRandomPriceForToken')
        .mockResolvedValue(200000000n);
      jest
        .spyOn(mockQueryRunner.manager, 'save')
        .mockRejectedValue(new Error('Database save failed'));

      // Act & Assert - should not throw
      await expect(
        service['updatePrices'](async () => {})
      ).resolves.not.toThrow();
    });
  });
});
