import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import { KafkaConfigService } from '../config/kafka.config';

@Injectable()
export class KafkaClientService implements OnModuleDestroy {
  private readonly logger = new Logger(KafkaClientService.name);
  private readonly kafka: Kafka;
  private readonly producer: Producer;

  constructor(private readonly kafkaConfig: KafkaConfigService) {
    this.kafka = new Kafka({
      clientId: this.kafkaConfig.clientId,
      brokers: this.kafkaConfig.brokers,
      retry: this.kafkaConfig.retry,
    });
    
    this.producer = this.kafka.producer();
    this.connect();
  }

  private async connect(): Promise<void> {
    try {
      await this.producer.connect();
      this.logger.log('Connected to Kafka');
    } catch (error) {
      this.logger.error('Failed to connect to Kafka', error.stack);
      throw error;
    }
  }

  getProducer(): Producer {
    return this.producer;
  }


  async onModuleDestroy(): Promise<void> {
    try {
      await this.producer.disconnect();
      this.logger.log('Disconnected from Kafka');
    } catch (error) {
      this.logger.error('Error disconnecting from Kafka', error.stack);
    }
  }
}
