import { Controller, Get } from '@nestjs/common';

@Controller('api/health')
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: 'ok',
    };
  }

  @Get('ready')
  getReadiness() {
    // TODO: Add readiness checks (e.g., database connectivity)
    return {
      status: 'ok',
    };
  }
}
