import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Token } from './entities/token.entity';
import { TokenPriceUpdateService } from './services/token-price-update.service';
import { MockPriceService } from './services/mock-price.service';
import { KafkaProducerService } from './kafka/kafka-producer.service';
import { TokenSeeder } from './data/token.seeder';
import { databaseConfig } from './config/database.config';
import * as controllers from './controllers';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot(databaseConfig),
    TypeOrmModule.forFeature([Token]),
  ],
  controllers: Object.values(controllers),
  providers: [
    TokenPriceUpdateService,
    MockPriceService,
    KafkaProducerService,
    TokenSeeder,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(
    private readonly tokenSeeder: TokenSeeder,
    private readonly tokenPriceUpdateService: TokenPriceUpdateService,
  ) {}

  async onModuleInit() {
    try {
      // Seed initial data
      await this.tokenSeeder.seed();
      
      // Start price update service
      this.tokenPriceUpdateService.start();
    } catch (error) {
      console.error('Failed to initialize application:', error);
    }
  }
}
