import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Token } from '../entities/token.entity';
import { MockPriceService } from './mock-price.service';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { createTokenPriceUpdateMessage } from '../schemas/token-price-updated.message';
import pAll from 'p-all';

@Injectable()
export class TokenPriceUpdateService implements OnModuleDestroy {
  private readonly logger = new Logger(TokenPriceUpdateService.name);
  private timer: NodeJS.Timeout;
  private readonly updateIntervalSeconds: number = 5;
  private readonly batchSize: number = 100;
  private readonly concurrency: number = 20;
  private isRunning: boolean = false;

  constructor(
    @InjectRepository(Token)
    private readonly tokenRepository: Repository<Token>,
    private readonly priceService: MockPriceService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly dataSource: DataSource,
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
      const totalTokens = await this.tokenRepository.count();
      this.logger.log(`Starting batch price updates for ${totalTokens} tokens (batch size: ${this.batchSize}, concurrency: ${this.concurrency})`);
      
      let processedTokens = 0;
      let offset = 0;

      while (offset < totalTokens) {
        const tokenBatch = await this.tokenRepository.find({
          take: this.batchSize,
          skip: offset,
          order: { symbol: 'ASC' },
        });

        if (tokenBatch.length === 0) {
          break; // No more tokens to process
        }

        this.logger.log(`Processing batch ${Math.floor(offset / this.batchSize) + 1}: ${tokenBatch.length} tokens (${processedTokens + 1}-${processedTokens + tokenBatch.length} of ${totalTokens})`);

        // Process batch with parallel execution
        const updateTasks = tokenBatch.map(token => () => this.updateTokenPrice(token));

        await pAll(updateTasks, {
          concurrency: this.concurrency,
          stopOnError: false,
        });

        processedTokens += tokenBatch.length;
        offset += this.batchSize;

        this.logger.log(`Completed batch: ${processedTokens}/${totalTokens} tokens processed`);
      }
      
      this.logger.log(`Price update cycle completed: ${processedTokens} tokens processed`);
    } catch (error) {
      this.logger.error(`Error updating prices: ${error.message}`);      
    }
  }

  private async updateTokenPrice(token: Token): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const oldPrice = token.price;
      const newPrice = await this.priceService.getRandomPriceForToken(token);
      
      if (oldPrice !== newPrice) {
        token.price = newPrice;
        token.lastPriceUpdate = new Date();

        await queryRunner.manager.save(token);

        const message = createTokenPriceUpdateMessage({
          tokenId: token.id,
          symbol: token.symbol || 'UNKNOWN',
          oldPrice: oldPrice,
          newPrice: newPrice,
        });
        
        await this.kafkaProducer.sendPriceUpdateMessage(message);
        await queryRunner.commitTransaction();
        this.logger.log(`Updated price for ${token.symbol}: ${oldPrice / 100000000n} -> ${newPrice / 100000000n}`);
      }
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error updating price for token ${token.id}: ${error.message}`);      
    } finally {
      await queryRunner.release();
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
