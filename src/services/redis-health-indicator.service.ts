import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { DistributedLockService } from './distributed-lock.service';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly distributedLockService: DistributedLockService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const isHealthy = await this.distributedLockService.ping();
      const result = this.getStatus(key, isHealthy);

      if (isHealthy) {
        return result;
      }

      throw new HealthCheckError('Redis health check failed', result);
    } catch (error) {
      throw new HealthCheckError('Redis health check failed', {
        [key]: {
          status: 'down',
          message: error.message,
        },
      });
    }
  }
}
