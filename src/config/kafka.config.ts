import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class KafkaConfigService {
  constructor(private readonly configService: ConfigService) {}

  get clientId(): string {
    return this.configService.get<string>(
      'KAFKA_CLIENT_ID',
      'token-price-service'
    );
  }

  get brokers(): string[] {
    const brokers = this.configService.get<string>(
      'KAFKA_BROKERS',
      'localhost:9092'
    );
    return brokers.split(',');
  }

  get retry() {
    return {
      initialRetryTime: this.configService.get<number>(
        'KAFKA_RETRY_INITIAL_TIME',
        100
      ),
      retries: this.configService.get<number>('KAFKA_RETRY_ATTEMPTS', 8),
    };
  }
}
