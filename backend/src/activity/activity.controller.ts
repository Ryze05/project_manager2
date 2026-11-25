import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator.js';
import { ActivityService, type ActivityPage } from './activity.service.js';
import { ActivityQueryDto } from './dto/activity-query.dto.js';

@ApiTags('activity')
@ApiBearerAuth()
@Controller('projects/:projectId/activity')
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  @ApiOperation({
    summary:
      'Historial del proyecto, o de una tarea con ?taskId, del más reciente al más antiguo',
  })
  list(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: ActivityQueryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ActivityPage> {
    return this.activity.list(projectId, user.id, query);
  }
}
