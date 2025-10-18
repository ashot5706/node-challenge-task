import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Token } from '../entities/token.entity';
import { MockPriceService } from './mock-price.service';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { createTokenPriceUpdateMessage } from '../schemas/token-price-updated.message';

@Injectable()
export class TokenPriceUpdateService implements OnModuleDestroy {
  private readonly logger = new Logger(TokenPriceUpdateService.name);
  private timer: NodeJS.Timeout;
  private readonly updateIntervalSeconds: number = 5;
  private isRunning: boolean = false;

  constructor(
    @InjectRepository(Token)
    private readonly tokenRepository: Repository<Token>,
    private readonly priceService: MockPriceService,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  start(): void {
    if (this.isRunning) {
      this.logger.warn('Price update service is already running');
      return;
    }

    this.isRunning = true;
    this.logger.log(`Starting price update service (interval: ${this.updateIntervalSeconds} seconds)...`);
        
    this.timer = setInterval(      
      async () => {
        try {
          await this.updatePrices();
        } catch (error) {
          this.logger.error(`Error in price update interval: ${error.message}`);
        }
      },
      this.updateIntervalSeconds * 1000,
    );

    // Trigger an initial update immediately
    this.updatePrices().catch(error => {
      this.logger.error(`Error in initial price update: ${error.message}`);
    });
  }

  private async updatePrices(): Promise<void> {
    try {
      const tokens = await this.tokenRepository.find();
      this.logger.log(`Updating prices for ${tokens.length} tokens...`);
      
      for (const token of tokens) {
        await this.updateTokenPrice(token);
      }
    } catch (error) {
      this.logger.error(`Error updating prices: ${error.message}`);      
    }
  }

  private async updateTokenPrice(token: Token): Promise<void> {
    try {
      const oldPrice = token.price;
      const newPrice = await this.priceService.getRandomPriceForToken(token);
      
      if (oldPrice !== newPrice) {
        // Create message for Kafka using Zod helper function
        const message = createTokenPriceUpdateMessage({
          tokenId: token.id,
          symbol: token.symbol || 'UNKNOWN',
          oldPrice,
          newPrice,
          // timestamp will be set to current date by default if not provided
        });
        
        await this.kafkaProducer.sendPriceUpdateMessage(message);
        
        // Update token in database
        token.price = newPrice;
        token.lastPriceUpdate = new Date();
        
        await this.tokenRepository.save(token);
        this.logger.log(`Updated price for ${token.symbol}: ${oldPrice} -> ${newPrice}`);
      }
    } catch (error) {
      this.logger.error(`Error updating price for token ${token.id}: ${error.message}`);      
    }
  }

  stop(): void {
    if (!this.isRunning) {
      this.logger.warn('Price update service is not running');
      return;
    }

    clearInterval(this.timer);
    this.isRunning = false;
    this.logger.log('Price update service stopped');
  }

  onModuleDestroy(): void {
    this.stop();
  }
}
