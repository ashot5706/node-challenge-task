export const REDIS_LOCKS = {
  TOKEN_PRICE_UPDATE: 'token-price-update',
} as const;

export type RedisLockKey = typeof REDIS_LOCKS[keyof typeof REDIS_LOCKS];
