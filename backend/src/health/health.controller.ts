import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator.js';
import { HealthService, type HealthStatus } from './health.service.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Comprueba que la API y la base de datos responden',
  })
  check(): Promise<HealthStatus> {
    return this.health.check();
  }
}
