import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Token } from '../entities/token.entity';
import { MockPriceService } from './mock-price.service';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { DistributedLockService } from './distributed-lock.service';
import { createTokenPriceUpdateMessage } from '../schemas/token-price-updated.message';
import pAll from 'p-all';
import { REDIS_LOCKS } from 'src/constants/redis-locks';

@Injectable()
export class TokenPriceUpdateService {
  private readonly logger = new Logger(TokenPriceUpdateService.name);
  private readonly batchSize: number = 100;
  private readonly concurrency: number = 20;

  constructor(
    @InjectRepository(Token)
    private readonly tokenRepository: Repository<Token>,
    private readonly priceService: MockPriceService,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly dataSource: DataSource,
    private readonly distributedLock: DistributedLockService
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async handlePriceUpdateCron(): Promise<void> {
    const lockAcquired = await this.distributedLock.acquireLock(
      REDIS_LOCKS.TOKEN_PRICE_UPDATE,
      30
    );

    if (!lockAcquired) {
      this.logger.debug(
        'Price update already running on another instance, skipping this execution'
      );
      return;
    }

    this.logger.debug('Starting scheduled price update...');

    try {
      await this.updatePrices(async () => {
        this.logger.debug('Heartbeat: price update in progress...');
        await this.distributedLock.extendLock(
          REDIS_LOCKS.TOKEN_PRICE_UPDATE,
          30
        );
      });
    } catch (error) {
      this.logger.error(`Error in scheduled price update: ${error.message}`);
    } finally {
      await this.distributedLock.releaseLock(REDIS_LOCKS.TOKEN_PRICE_UPDATE);
    }
  }

  private async updatePrices(heartbeat: () => Promise<void>): Promise<void> {
    try {
      const totalTokens = await this.tokenRepository.count();
      this.logger.log(
        `Starting batch price updates for ${totalTokens} tokens (batch size: ${this.batchSize}, concurrency: ${this.concurrency})`
      );

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

        this.logger.log(
          `Processing batch ${Math.floor(offset / this.batchSize) + 1}: ${
            tokenBatch.length
          } tokens (${processedTokens + 1}-${
            processedTokens + tokenBatch.length
          } of ${totalTokens})`
        );

        // Process batch with parallel execution
        const updateTasks = tokenBatch.map(
          token => () => this.updateTokenPrice(token)
        );

        await pAll(updateTasks, {
          concurrency: this.concurrency,
          stopOnError: false,
        });

        processedTokens += tokenBatch.length;
        offset += this.batchSize;

        this.logger.log(
          `Completed batch: ${processedTokens}/${totalTokens} tokens processed`
        );
        await heartbeat();
      }

      this.logger.log(
        `Price update cycle completed: ${processedTokens} tokens processed`
      );
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
          oldPrice,
          newPrice,
        });

        await this.kafkaProducer.sendPriceUpdateMessage(message);
        this.logger.log(
          `Updated price for ${token.symbol}: ${oldPrice / 100000000n} -> ${
            newPrice / 100000000n
          }`
        );
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error updating price for token ${token.id}: ${error.message}`
      );
    } finally {
      await queryRunner.release();
    }
  }
}
