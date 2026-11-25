import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator.js';
import { MetricsService, type ProjectMetrics } from './metrics.service.js';

@ApiTags('metrics')
@ApiBearerAuth()
@Controller('projects/:projectId/metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Métricas del proyecto: tareas por estado, por responsable, vencidas y próximas',
  })
  get(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ProjectMetrics> {
    return this.metrics.get(projectId, user.id);
  }
}
