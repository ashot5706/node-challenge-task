export const KAFKA_TOPICS = {
  TOKEN_PRICE_UPDATES: 'token-price-updates',
} as const;

export type KafkaTopic = typeof KAFKA_TOPICS[keyof typeof KAFKA_TOPICS];
