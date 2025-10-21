import { Test, TestingModule } from '@nestjs/testing';
import { MockPriceService } from '../../src/services/mock-price.service';
import { PriceConfigService } from '../../src/config/price.config';
import { Token } from '../../src/entities/token.entity';
import { randomUUID } from 'crypto';

describe('MockPriceService', () => {
  let service: MockPriceService;

  const mockToken: Token = {
    id: randomUUID(),
    symbol: 'TEST',
    name: 'Test Token',
    address: '0x123',
    decimals: 18,
    isNative: false,
    isProtected: false,
    isVerified: true,
    lastUpdateAuthor: 'system',
    priority: 1,
    totalSupply: 1000000n,
    price: 100000000n,
    marketCap: '1000000',
    logoUrl: 'https://example.com/logo.png',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastPriceUpdate: new Date(),
    chainId: randomUUID(),
    chain: null,
  } as Token;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MockPriceService,
        {
          provide: PriceConfigService,
          useValue: {
            minPriceDollars: 1,
            maxPriceDollars: 100,
            minDelayMs: 10,
            maxDelayMs: 50,
          },
        },
      ],
    }).compile();

    service = module.get<MockPriceService>(MockPriceService);
  });

  describe('getRandomPriceForToken', () => {
    it('should return a price within the configured range', async () => {
      // Act
      const price = await service.getRandomPriceForToken(mockToken);

      // Assert
      expect(price).toBeGreaterThan(0n);
      expect(price).toBeGreaterThanOrEqual(100000000n); // $1.00 minimum
      expect(price).toBeLessThanOrEqual(10000000000n); // $100.00 maximum
    });

    it('should respect the delay configuration', async () => {
      // Arrange
      const startTime = Date.now();

      // Act
      await service.getRandomPriceForToken(mockToken);

      // Assert
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(10); // minDelayMs
      expect(elapsed).toBeLessThanOrEqual(100); // maxDelayMs + buffer
    });

    it('should generate different prices for multiple calls', async () => {
      // Act
      const prices = await Promise.all([
        service.getRandomPriceForToken(mockToken),
        service.getRandomPriceForToken(mockToken),
        service.getRandomPriceForToken(mockToken),
        service.getRandomPriceForToken(mockToken),
        service.getRandomPriceForToken(mockToken),
      ]);

      // Assert - at least some prices should be different (very high probability)
      const uniquePrices = new Set(prices.map(p => p.toString()));
      expect(uniquePrices.size).toBeGreaterThan(1);
    });

    it('should handle edge case with minimum price range', async () => {
      // Arrange
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MockPriceService,
          {
            provide: PriceConfigService,
            useValue: {
              minPriceDollars: 1,
              maxPriceDollars: 1, // Same min and max
              minDelayMs: 1,
              maxDelayMs: 1,
            },
          },
        ],
      }).compile();

      const edgeCaseService = module.get<MockPriceService>(MockPriceService);

      // Act
      const price = await edgeCaseService.getRandomPriceForToken(mockToken);

      // Assert
      expect(price).toBeGreaterThanOrEqual(100000000n); // $1.00
      expect(price).toBeLessThanOrEqual(199999999n); // $1.99 (with decimals)
    });

    it('should handle edge case with maximum price range', async () => {
      // Arrange
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MockPriceService,
          {
            provide: PriceConfigService,
            useValue: {
              minPriceDollars: 1000000, // $1M
              maxPriceDollars: 1000000, // $1M
              minDelayMs: 1,
              maxDelayMs: 1,
            },
          },
        ],
      }).compile();

      const edgeCaseService = module.get<MockPriceService>(MockPriceService);

      // Act
      const price = await edgeCaseService.getRandomPriceForToken(mockToken);

      // Assert
      expect(price).toBeGreaterThanOrEqual(100000000000000n); // $1M
      expect(price).toBeLessThanOrEqual(100000000999999999n); // $1M + decimals
    });

    it('should handle zero delay configuration', async () => {
      // Arrange
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MockPriceService,
          {
            provide: PriceConfigService,
            useValue: {
              minPriceDollars: 1,
              maxPriceDollars: 100,
              minDelayMs: 0,
              maxDelayMs: 0,
            },
          },
        ],
      }).compile();

      const zeroDelayService = module.get<MockPriceService>(MockPriceService);
      const startTime = Date.now();

      // Act
      await zeroDelayService.getRandomPriceForToken(mockToken);

      // Assert
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(10); // Should be very fast
    });

    it('should generate prices with proper decimal precision', async () => {
      // Act
      const price = await service.getRandomPriceForToken(mockToken);

      // Assert
      // Price should be in 10^-8 dollars format
      const dollars = Number(price) / 100000000;
      expect(dollars).toBeGreaterThanOrEqual(1);
      expect(dollars).toBeLessThanOrEqual(100);

      // Should have proper decimal places
      const decimalPart = Number(price) % 100000000;
      expect(decimalPart).toBeGreaterThanOrEqual(0);
      expect(decimalPart).toBeLessThan(100000000);
    });

    it('should handle multiple concurrent calls', async () => {
      // Act
      const promises = Array.from({ length: 10 }, () =>
        service.getRandomPriceForToken(mockToken)
      );
      const prices = await Promise.all(promises);

      // Assert
      expect(prices).toHaveLength(10);
      prices.forEach(price => {
        expect(price).toBeGreaterThan(0n);
        expect(price).toBeGreaterThanOrEqual(100000000n);
        expect(price).toBeLessThanOrEqual(10000000000n);
      });
    });

    it('should handle tokens with different properties', async () => {
      // Arrange
      const tokens = [
        { ...mockToken, symbol: 'BTC', decimals: 8 },
        { ...mockToken, symbol: 'ETH', decimals: 18 },
        { ...mockToken, symbol: 'USDC', decimals: 6 },
        { ...mockToken, symbol: 'DOGE', decimals: 8 },
      ];

      // Act
      const prices = await Promise.all(
        tokens.map(token => service.getRandomPriceForToken(token))
      );

      // Assert
      expect(prices).toHaveLength(4);
      prices.forEach(price => {
        expect(price).toBeGreaterThan(0n);
        expect(price).toBeGreaterThanOrEqual(100000000n);
        expect(price).toBeLessThanOrEqual(10000000000n);
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle invalid price configuration gracefully', async () => {
      // Arrange
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MockPriceService,
          {
            provide: PriceConfigService,
            useValue: {
              minPriceDollars: 100, // Higher than max
              maxPriceDollars: 50, // Lower than min
              minDelayMs: 100,
              maxDelayMs: 50, // Lower than min
            },
          },
        ],
      }).compile();

      const invalidConfigService =
        module.get<MockPriceService>(MockPriceService);

      // Act
      const price = await invalidConfigService.getRandomPriceForToken(
        mockToken
      );

      // Assert - should still return a valid price (implementation should handle this)
      expect(price).toBeGreaterThan(0n);
    });

    it('should handle very large price ranges', async () => {
      // Arrange
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MockPriceService,
          {
            provide: PriceConfigService,
            useValue: {
              minPriceDollars: 0.000001, // Very small
              maxPriceDollars: 1000000000, // Very large
              minDelayMs: 1,
              maxDelayMs: 1,
            },
          },
        ],
      }).compile();

      const largeRangeService = module.get<MockPriceService>(MockPriceService);

      // Act
      const price = await largeRangeService.getRandomPriceForToken(mockToken);

      // Assert
      expect(price).toBeGreaterThan(0n);
      expect(price).toBeGreaterThanOrEqual(100n); // $0.000001
      expect(price).toBeLessThanOrEqual(100000000000000000n); // $1B
    });

    it('should handle token with null/undefined properties', async () => {
      // Arrange
      const invalidToken = {
        ...mockToken,
        symbol: null,
        name: undefined,
        address: '',
      } as any;

      // Act & Assert - should not throw
      const price = await service.getRandomPriceForToken(invalidToken);
      expect(price).toBeGreaterThan(0n);
    });
  });
});
