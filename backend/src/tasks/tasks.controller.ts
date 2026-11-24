import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { TasksService, type Board, type TaskView } from './tasks.service.js';

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('projects/:projectId')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get('board')
  @ApiOperation({
    summary: 'Tablero: tareas por columna (sin subtareas), con su progreso',
  })
  board(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<Board> {
    return this.tasks.board(projectId, user.id);
  }

  @Post('tasks')
  @ApiOperation({ summary: 'Crear una tarea (empieza en "por hacer")' })
  create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: AuthUser,
  ): Promise<TaskView> {
    return this.tasks.create(projectId, user.id, dto);
  }

  @Get('tasks/:taskId')
  @ApiOperation({ summary: 'Detalle de una tarea o subtarea' })
  findOne(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<TaskView> {
    return this.tasks.findOne(projectId, taskId, user.id);
  }

  @Patch('tasks/:taskId')
  @ApiOperation({
    summary: 'Editar o mover una tarea o subtarea (cambiando status)',
  })
  update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: AuthUser,
  ): Promise<TaskView> {
    return this.tasks.update(projectId, taskId, user.id, dto);
  }

  @Delete('tasks/:taskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Borrar una tarea o subtarea (propietario, o quien la creó)',
  })
  remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.tasks.remove(projectId, taskId, user.id);
  }
}
