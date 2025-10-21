import { Injectable, Logger } from '@nestjs/common';
import {
  TokenPriceUpdateMessage,
  tokenPriceUpdateMessageSchema,
} from '../schemas/token-price-updated.message';
import { KafkaClientService } from './kafka-client.service';
import { KAFKA_TOPICS } from '../constants/kafka-topics';

@Injectable()
export class KafkaProducerService {
  private readonly logger = new Logger(KafkaProducerService.name);

  constructor(private readonly kafkaClient: KafkaClientService) {}

  async sendPriceUpdateMessage(
    message: TokenPriceUpdateMessage
  ): Promise<void> {
    try {
      // Validate the message with Zod schema
      tokenPriceUpdateMessageSchema.parse(message);

      const value = JSON.stringify(message, (_, v) =>
        typeof v === 'bigint' ? v.toString() : v
      );

      const producer = this.kafkaClient.getProducer();

      await producer.send({
        topic: KAFKA_TOPICS.TOKEN_PRICE_UPDATES,
        messages: [
          {
            key: message.tokenId,
            value,
          },
        ],
      });

      this.logger.log(`Sent message to Kafka: ${value}`);
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      throw error;
    }
  }
}
