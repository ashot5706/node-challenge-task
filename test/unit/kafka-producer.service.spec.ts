import { Test, TestingModule } from '@nestjs/testing';
import { KafkaProducerService } from '../../src/kafka/kafka-producer.service';
import { KafkaClientService } from '../../src/kafka/kafka-client.service';
import { KAFKA_TOPICS } from '../../src/constants/kafka-topics';
import { TokenPriceUpdateMessage } from '../../src/schemas/token-price-updated.message';

describe('KafkaProducerService', () => {
  let service: KafkaProducerService;

  const mockProducer = {
    send: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
  };

  const validMessage: TokenPriceUpdateMessage = {
    tokenId: '123e4567-e89b-12d3-a456-426614174000',
    symbol: 'BTC',
    oldPrice: 50000000000n, // $500.00
    newPrice: 51000000000n, // $510.00
    timestamp: new Date('2023-01-01T00:00:00Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KafkaProducerService,
        {
          provide: KafkaClientService,
          useValue: {
            getProducer: jest.fn().mockReturnValue(mockProducer),
          },
        },
      ],
    }).compile();

    service = module.get<KafkaProducerService>(KafkaProducerService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('sendPriceUpdateMessage', () => {
    it('should successfully send a valid message', async () => {
      // Arrange
      mockProducer.send.mockResolvedValue([
        { topicName: KAFKA_TOPICS.TOKEN_PRICE_UPDATES },
      ]);

      // Act
      await service.sendPriceUpdateMessage(validMessage);

      // Assert
      expect(mockProducer.send).toHaveBeenCalledWith({
        topic: KAFKA_TOPICS.TOKEN_PRICE_UPDATES,
        messages: [
          {
            key: validMessage.tokenId,
            value: JSON.stringify(validMessage, (_, v) =>
              typeof v === 'bigint' ? v.toString() : v
            ),
          },
        ],
      });
    });

    it('should handle bigint serialization correctly', async () => {
      // Arrange
      const messageWithBigInts: TokenPriceUpdateMessage = {
        tokenId: '123e4567-e89b-12d3-a456-426614174000',
        symbol: 'ETH',
        oldPrice: 3000000000000n, // $30,000.00
        newPrice: 3100000000000n, // $31,000.00
        timestamp: new Date(),
      };
      mockProducer.send.mockResolvedValue([
        { topicName: KAFKA_TOPICS.TOKEN_PRICE_UPDATES },
      ]);

      // Act
      await service.sendPriceUpdateMessage(messageWithBigInts);

      // Assert
      const sentValue = mockProducer.send.mock.calls[0][0].messages[0].value;
      const parsedValue = JSON.parse(sentValue);

      expect(parsedValue.oldPrice).toBe('3000000000000');
      expect(parsedValue.newPrice).toBe('3100000000000');
      expect(typeof parsedValue.oldPrice).toBe('string');
      expect(typeof parsedValue.newPrice).toBe('string');
    });

    it('should use tokenId as message key for partitioning', async () => {
      // Arrange
      mockProducer.send.mockResolvedValue([
        { topicName: KAFKA_TOPICS.TOKEN_PRICE_UPDATES },
      ]);

      // Act
      await service.sendPriceUpdateMessage(validMessage);

      // Assert
      expect(mockProducer.send).toHaveBeenCalledWith({
        topic: KAFKA_TOPICS.TOKEN_PRICE_UPDATES,
        messages: [
          {
            key: validMessage.tokenId,
            value: expect.any(String),
          },
        ],
      });
    });

    it('should throw error for invalid message schema', async () => {
      // Arrange
      const invalidMessage = {
        tokenId: 'invalid-uuid',
        symbol: 'BTC',
        // Missing required fields
      } as any;

      // Act & Assert
      await expect(
        service.sendPriceUpdateMessage(invalidMessage)
      ).rejects.toThrow();
    });

    it('should throw error for message with invalid tokenId format', async () => {
      // Arrange
      const invalidMessage: TokenPriceUpdateMessage = {
        tokenId: 'not-a-uuid',
        symbol: 'BTC',
        oldPrice: 100000000n,
        newPrice: 110000000n,
        timestamp: new Date(),
      };

      // Act & Assert
      await expect(
        service.sendPriceUpdateMessage(invalidMessage)
      ).rejects.toThrow();
    });

    it('should throw error for message with negative prices', async () => {
      // Arrange
      const invalidMessage: TokenPriceUpdateMessage = {
        tokenId: '123e4567-e89b-12d3-a456-426614174000',
        symbol: 'BTC',
        oldPrice: -100000000n, // Negative price
        newPrice: 110000000n,
        timestamp: new Date(),
      };

      // Act & Assert
      await expect(
        service.sendPriceUpdateMessage(invalidMessage)
      ).rejects.toThrow();
    });

    it('should throw error for message with invalid timestamp', async () => {
      // Arrange
      const invalidMessage: TokenPriceUpdateMessage = {
        tokenId: '123e4567-e89b-12d3-a456-426614174000',
        symbol: 'BTC',
        oldPrice: 100000000n,
        newPrice: 110000000n,
        timestamp: new Date('invalid-date'),
      };

      // Act & Assert
      await expect(
        service.sendPriceUpdateMessage(invalidMessage)
      ).rejects.toThrow();
    });

    it('should handle Kafka producer errors', async () => {
      // Arrange
      const kafkaError = new Error('Kafka producer error');
      mockProducer.send.mockRejectedValue(kafkaError);

      // Act & Assert
      await expect(
        service.sendPriceUpdateMessage(validMessage)
      ).rejects.toThrow('Kafka producer error');
    });

    it('should handle network timeout errors', async () => {
      // Arrange
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      mockProducer.send.mockRejectedValue(timeoutError);

      // Act & Assert
      await expect(
        service.sendPriceUpdateMessage(validMessage)
      ).rejects.toThrow('Request timeout');
    });

    it('should handle message size limit errors', async () => {
      // Arrange
      const largeMessage: TokenPriceUpdateMessage = {
        tokenId: '123e4567-e89b-12d3-a456-426614174000',
        symbol: 'A'.repeat(1000), // Very large symbol
        oldPrice: 100000000n,
        newPrice: 110000000n,
        timestamp: new Date(),
      };

      const sizeError = new Error('Message too large');
      mockProducer.send.mockRejectedValue(sizeError);

      // Act & Assert
      await expect(
        service.sendPriceUpdateMessage(largeMessage)
      ).rejects.toThrow('Message too large');
    });

    it('should handle concurrent message sending', async () => {
      // Arrange
      const messages = Array.from({ length: 5 }, (_, i) => ({
        ...validMessage,
        tokenId: `123e4567-e89b-12d3-a456-42661417400${i}`,
        symbol: `TOKEN${i}`,
      }));

      mockProducer.send.mockResolvedValue([
        { topicName: KAFKA_TOPICS.TOKEN_PRICE_UPDATES },
      ]);

      // Act
      const promises = messages.map(message =>
        service.sendPriceUpdateMessage(message)
      );
      await Promise.all(promises);

      // Assert
      expect(mockProducer.send).toHaveBeenCalledTimes(5);
    });

    it('should handle producer connection errors', async () => {
      // Arrange
      const connectionError = new Error('Producer not connected');
      mockProducer.send.mockRejectedValue(connectionError);

      // Act & Assert
      await expect(
        service.sendPriceUpdateMessage(validMessage)
      ).rejects.toThrow('Producer not connected');
    });
  });

  describe('edge cases', () => {
    it('should handle message with zero prices', async () => {
      // Arrange
      const zeroPriceMessage: TokenPriceUpdateMessage = {
        tokenId: '123e4567-e89b-12d3-a456-426614174000',
        symbol: 'ZERO',
        oldPrice: 0n,
        newPrice: 0n,
        timestamp: new Date(),
      };
      mockProducer.send.mockResolvedValue([
        { topicName: KAFKA_TOPICS.TOKEN_PRICE_UPDATES },
      ]);

      // Act
      await service.sendPriceUpdateMessage(zeroPriceMessage);

      // Assert
      expect(mockProducer.send).toHaveBeenCalled();
    });

    it('should handle message with very large prices', async () => {
      // Arrange
      const largePriceMessage: TokenPriceUpdateMessage = {
        tokenId: '123e4567-e89b-12d3-a456-426614174000',
        symbol: 'EXPENSIVE',
        oldPrice: 999999999999999999n, // Very large price
        newPrice: 1000000000000000000n,
        timestamp: new Date(),
      };
      mockProducer.send.mockResolvedValue([
        { topicName: KAFKA_TOPICS.TOKEN_PRICE_UPDATES },
      ]);

      // Act
      await service.sendPriceUpdateMessage(largePriceMessage);

      // Assert
      expect(mockProducer.send).toHaveBeenCalled();
    });

    it('should handle message with special characters in symbol', async () => {
      // Arrange
      const specialCharMessage: TokenPriceUpdateMessage = {
        tokenId: '123e4567-e89b-12d3-a456-426614174000',
        symbol: 'BTC-USD$',
        oldPrice: 100000000n,
        newPrice: 110000000n,
        timestamp: new Date(),
      };
      mockProducer.send.mockResolvedValue([
        { topicName: KAFKA_TOPICS.TOKEN_PRICE_UPDATES },
      ]);

      // Act
      await service.sendPriceUpdateMessage(specialCharMessage);

      // Assert
      expect(mockProducer.send).toHaveBeenCalled();
    });

    it('should handle message with future timestamp', async () => {
      // Arrange
      const futureMessage: TokenPriceUpdateMessage = {
        tokenId: '123e4567-e89b-12d3-a456-426614174000',
        symbol: 'FUTURE',
        oldPrice: 100000000n,
        newPrice: 110000000n,
        timestamp: new Date(Date.now() + 86400000), // 24 hours in future
      };
      mockProducer.send.mockResolvedValue([
        { topicName: KAFKA_TOPICS.TOKEN_PRICE_UPDATES },
      ]);

      // Act
      await service.sendPriceUpdateMessage(futureMessage);

      // Assert
      expect(mockProducer.send).toHaveBeenCalled();
    });

    it('should handle message with very old timestamp', async () => {
      // Arrange
      const oldMessage: TokenPriceUpdateMessage = {
        tokenId: '123e4567-e89b-12d3-a456-426614174000',
        symbol: 'OLD',
        oldPrice: 100000000n,
        newPrice: 110000000n,
        timestamp: new Date('2020-01-01T00:00:00Z'),
      };
      mockProducer.send.mockResolvedValue([
        { topicName: KAFKA_TOPICS.TOKEN_PRICE_UPDATES },
      ]);

      // Act
      await service.sendPriceUpdateMessage(oldMessage);

      // Assert
      expect(mockProducer.send).toHaveBeenCalled();
    });
  });
});
