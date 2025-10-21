import 'reflect-metadata';
import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TerminusModule } from '@nestjs/terminus';
import { TokenPriceUpdateService } from './services/token-price-update.service';
import { MockPriceService } from './services/mock-price.service';
import { KafkaProducerService } from './kafka/kafka-producer.service';
import { KafkaClientService } from './kafka/kafka-client.service';
import { DistributedLockService } from './services/distributed-lock.service';
import { RedisHealthIndicator } from './services/redis-health-indicator.service';
import { TokenSeeder } from './data/token.seeder';
import { databaseConfig } from './config/database.config';
import { KafkaConfigService } from './config/kafka.config';
import { PriceConfigService } from './config/price.config';
import { RedisConfigService } from './config/redis.config';
import * as controllers from './controllers';
import * as entities from './entities';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    ScheduleModule.forRoot(),
    TerminusModule,
    TypeOrmModule.forRoot(databaseConfig),
    TypeOrmModule.forFeature(Object.values(entities)),
  ],
  controllers: Object.values(controllers),
  providers: [
    // Configuration services
    KafkaConfigService,
    PriceConfigService,
    RedisConfigService,

    // Core services
    KafkaClientService,
    KafkaProducerService,
    DistributedLockService,
    RedisHealthIndicator,
    MockPriceService,
    TokenPriceUpdateService,
    TokenSeeder,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly tokenSeeder: TokenSeeder) {}

  async onModuleInit() {
    try {
      // Seed initial data
      await this.tokenSeeder.seed();
    } catch (error) {
      console.error('Failed to initialize application:', error);
    }
  }
}
