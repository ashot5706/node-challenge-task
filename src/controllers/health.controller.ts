import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HealthCheck,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { RedisHealthIndicator } from '../services/redis-health-indicator.service';

@Controller('api/health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly redis: RedisHealthIndicator
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // Database health check
      () => this.db.pingCheck('database'),

      // Redis health check
      () => this.redis.isHealthy('redis'),

      // Memory health check - warn if using more than 300MB
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),

      // Disk health check - warn if using more than 80% of disk space
      () =>
        this.disk.checkStorage('storage', { path: '/', thresholdPercent: 0.8 }),
    ]);
  }

  @Get('ready')
  @HealthCheck()
  checkReadiness() {
    return this.health.check([
      // Database readiness check
      () => this.db.pingCheck('database'),

      // Redis readiness check
      () => this.redis.isHealthy('redis'),
    ]);
  }

  @Get('live')
  @HealthCheck()
  checkLiveness() {
    return this.health.check([
      // Basic liveness check - just check if the process is running
      () =>
        Promise.resolve({
          process: {
            status: 'up',
            info: {
              uptime: process.uptime(),
              timestamp: new Date().toISOString(),
            },
          },
        }),
    ]);
  }
}
