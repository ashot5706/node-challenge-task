export const kafkaConfig = {
  clientId: process.env.KAFKA_CLIENT_ID || 'token-price-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: {
    initialRetryTime: 100,
    retries: 8,
  },
};
