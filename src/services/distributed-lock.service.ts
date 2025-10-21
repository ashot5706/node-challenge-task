import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { RedisConfigService } from '../config/redis.config';
import { RedisLockKey } from '../constants/redis-locks';

@Injectable()
export class DistributedLockService implements OnModuleDestroy {
  private readonly logger = new Logger(DistributedLockService.name);
  private readonly client: RedisClientType;
  private readonly instanceId: string;
  private locksHeld: Set<string> = new Set();

  constructor(private readonly redisConfig: RedisConfigService) {
    this.client = createClient({
      url: this.redisConfig.url,
    });
    this.instanceId = `instance-${Date.now()}-${Math.random()
      .toString(36)
      .substring(7)}`;
    this.connect();
  }

  private async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.logger.log('Connected to Redis for distributed locking');
    } catch (error) {
      this.logger.error('Failed to connect to Redis', error.stack);
      throw error;
    }
  }

  async acquireLock(
    lockKey: RedisLockKey,
    lockTimeout: number
  ): Promise<boolean> {
    try {
      const lockValue = `${this.instanceId}`;
      const result = await this.client.set(lockKey, lockValue, {
        EX: lockTimeout,
        NX: true, // Only set if key doesn't exist
      });

      if (result === 'OK') {
        this.locksHeld.add(lockKey);
        this.logger.debug(`Lock acquired by instance: ${this.instanceId}`);
        return true;
      } else {
        this.logger.debug(`Lock already held by another instance`);
        return false;
      }
    } catch (error) {
      this.logger.error('Error acquiring lock', error.stack);
      return false;
    }
  }

  async releaseLock(lockKey: string): Promise<boolean> {
    try {
      // Use Lua script to ensure atomic release (only release if we own the lock)
      const luaScript = `
        if redis.call("GET", KEYS[1]) == ARGV[1] then
          return redis.call("DEL", KEYS[1])
        else
          return 0
        end
      `;

      const lockValue = `${this.instanceId}`;
      const result = (await this.client.eval(luaScript, {
        keys: [lockKey],
        arguments: [lockValue],
      })) as number;

      this.locksHeld.delete(lockKey);

      if (result === 1) {
        this.logger.debug(`Lock released by instance: ${this.instanceId}`);
        return true;
      } else {
        this.logger.debug(`Lock not released - not owned by this instance`);
        return false;
      }
    } catch (error) {
      this.logger.error('Error releasing lock', error.stack);
      return false;
    }
  }

  async isLocked(lockKey: RedisLockKey): Promise<boolean> {
    try {
      const exists = await this.client.exists(lockKey);
      return exists === 1;
    } catch (error) {
      this.logger.error('Error checking lock status', error.stack);
      return false;
    }
  }

  async extendLock(
    lockKey: RedisLockKey,
    additionalTime: number
  ): Promise<boolean> {
    try {
      const result = await this.client.expire(lockKey, additionalTime);
      if (result) {
        this.logger.debug(
          `Lock on ${lockKey} extended by ${additionalTime} seconds`
        );
      } else {
        this.logger.debug(
          `Failed to extend lock on ${lockKey} - lock may not be held`
        );
      }
      return result;
    } catch (error) {
      this.logger.error('Error extending lock', error.stack);
      return false;
    }
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error('Redis ping failed', error.stack);
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      for (const lockKey of this.locksHeld) {
        await this.releaseLock(lockKey);
      }
      await this.client.disconnect();
      this.logger.log('Disconnected from Redis');
    } catch (error) {
      this.logger.error('Error during Redis cleanup', error.stack);
    }
  }
}
