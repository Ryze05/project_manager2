import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator.js';
import { MyTasksQueryDto } from './dto/my-tasks-query.dto.js';
import { MyTasksService, type MyTaskView } from './my-tasks.service.js';

@ApiTags('my-tasks')
@ApiBearerAuth()
@Controller('me/tasks')
export class MyTasksController {
  constructor(private readonly myTasks: MyTasksService) {}

  @Get()
  @ApiOperation({
    summary: 'Mis tareas: todo lo asignado a mí en todos mis proyectos',
  })
  list(
    @Query() query: MyTasksQueryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<MyTaskView[]> {
    return this.myTasks.list(user.id, query.includeDone);
  }
}
